import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from typing import Any
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.mission import Mission

logger = structlog.get_logger()
router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────

class WaypointSchema(BaseModel):
    id:       str
    lat:      float
    lon:      float
    alt_m:    float = 150.0
    speed_ms: float = 20.0
    action:   str   = "WAYPOINT"
    risk:     str   = "SAFE"
    max_pk:   float = 0.0

class ThreatSiteSchema(BaseModel):
    id:     str
    name:   str
    lat:    float
    lon:    float
    preset: str   = "tor-m1"
    alt_m:  float = 0.0

class MissionCreate(BaseModel):
    name:         str
    description:  str | None = None
    waypoints:    list[dict] = []
    threat_sites: list[dict] = []
    uav_rcs:      float = 0.1
    uav_speed:    float = 30.0
    overall_risk: float = 0.0
    weather:      dict | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v: raise ValueError("Name cannot be empty")
        if len(v) > 128: raise ValueError("Name too long (max 128)")
        return v

    @field_validator("waypoints", "threat_sites")
    @classmethod
    def validate_list_size(cls, v: list) -> list:
        if len(v) > 500: raise ValueError("Too many items (max 500)")
        return v

class MissionUpdate(BaseModel):
    name:         str | None = None
    waypoints:    list[dict] | None = None
    threat_sites: list[dict] | None = None
    overall_risk: float | None = None
    status:       str | None = None
    aar_data:     dict | None = None
    weather:      dict | None = None

class MissionResponse(BaseModel):
    id:           str
    name:         str
    description:  str | None
    status:       str
    waypoints:    list
    threat_sites: list
    uav_rcs:      float
    uav_speed:    float
    overall_risk: float
    weather:      dict | None
    aar_data:     dict | None
    duration_s:   float
    score:        int
    created_at:   str
    model_config  = {"from_attributes": True}

class FlightLogEvent(BaseModel):
    t:       float                  # mission time seconds
    type:    str                    # TAKEOFF, WAYPOINT_REACHED, THREAT_DETECTED, ...
    data:    dict[str, Any] = {}    # event-specific payload

class FlightLogBatch(BaseModel):
    """Batch of events appended from simulator."""
    mission_id: str
    events:     list[FlightLogEvent]
    track:      list[dict] = []     # position snapshots

class AARSaveRequest(BaseModel):
    aar_data:   dict
    duration_s: float = 0.0
    score:      int   = 0
    flight_log: dict | None = None  # full log from simulator

# ── Helpers ───────────────────────────────────────────────────────

async def _get_own_mission(mid: str, user: User, db: AsyncSession) -> Mission:
    r = await db.execute(
        select(Mission).where(Mission.id == mid, Mission.owner_id == user.id)
    )
    m = r.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Mission not found")
    return m

def _score_from_log(log: dict) -> int:
    """Compute mission score from flight log events."""
    if not log: return 0
    events = log.get("events", [])
    score  = 1000

    # Deductions
    threats_hit    = sum(1 for e in events if e.get("type") == "THREAT_HIT")
    threats_evaded = sum(1 for e in events if e.get("type") == "THREAT_EVADED")
    wps_missed     = sum(1 for e in events if e.get("type") == "WAYPOINT_MISSED")
    ew_impacts     = sum(1 for e in events if e.get("type") == "EW_IMPACT")

    score -= threats_hit    * 200
    score -= wps_missed     * 100
    score -= ew_impacts     *  30
    score += threats_evaded *  50

    # Time bonus (under 15 min)
    duration = log.get("duration_s", 0)
    if 0 < duration < 900:
        score += max(0, int((900 - duration) / 9))

    return max(0, min(1000, score))

# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/", response_model=list[MissionResponse])
async def list_missions(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Mission).where(Mission.owner_id == current_user.id)
    if status_filter:
        q = q.where(Mission.status == status_filter.upper())
    q = q.order_by(Mission.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload:      MissionCreate,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    m = Mission(owner_id=current_user.id, **payload.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    logger.info("mission.created", id=m.id, name=m.name, user=current_user.id)
    return m


@router.get("/{mid}", response_model=MissionResponse)
async def get_mission(
    mid:          str,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    return await _get_own_mission(mid, current_user, db)


@router.patch("/{mid}", response_model=MissionResponse)
async def update_mission(
    mid:          str,
    payload:      MissionUpdate,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    m = await _get_own_mission(mid, current_user, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    if payload.status == "COMPLETED" and not m.completed_at:
        m.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(m)
    return m


@router.delete("/{mid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mid:          str,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    m = await _get_own_mission(mid, current_user, db)
    await db.delete(m)
    await db.commit()


@router.post("/{mid}/flight-log")
async def append_flight_log(
    mid:          str,
    payload:      FlightLogBatch,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Append events and track points to mission flight log.
    Called periodically from simulator (every 5s or on events).
    """
    m = await _get_own_mission(mid, current_user, db)

    existing = m.flight_log or {"events": [], "track": [], "duration_s": 0}
    existing["events"] += [e.model_dump() for e in payload.events]
    existing["track"]  += payload.track
    # Keep track to last 2000 points (prevents DB bloat)
    if len(existing["track"]) > 2000:
        existing["track"] = existing["track"][-2000:]

    # Update duration from last event time
    if payload.events:
        existing["duration_s"] = max(
            existing.get("duration_s", 0),
            payload.events[-1].t,
        )

    m.flight_log = existing
    m.status     = "IN_PROGRESS"
    await db.commit()
    return {"appended": len(payload.events), "total_events": len(existing["events"])}


@router.get("/{mid}/flight-log")
async def get_flight_log(
    mid:          str,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    m = await _get_own_mission(mid, current_user, db)
    return m.flight_log or {"events": [], "track": [], "duration_s": 0}


@router.post("/{mid}/aar")
async def save_aar(
    mid:          str,
    payload:      AARSaveRequest,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    m = await _get_own_mission(mid, current_user, db)

    # Use server-side scoring if flight log available
    log  = payload.flight_log or m.flight_log or {}
    score = _score_from_log(log) if log.get("events") else payload.score

    m.aar_data     = payload.aar_data
    m.duration_s   = payload.duration_s or log.get("duration_s", 0)
    m.score        = score
    m.status       = "COMPLETED"
    m.completed_at = datetime.now(timezone.utc)
    if payload.flight_log:
        m.flight_log = payload.flight_log

    await db.commit()
    logger.info("mission.aar_saved", id=mid, score=score, user=current_user.id)
    return {"saved": True, "score": score}
