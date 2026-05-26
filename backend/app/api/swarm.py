"""
Swarm API — session ownership enforced.
Every session is bound to the creating user.
"""
import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.swarm.engine import SwarmEngine
from app.simulation.swarm.models import SwarmAgent, SwarmTarget, SwarmBehavior, SwarmRole

logger = structlog.get_logger()
router = APIRouter()

# session_id → (owner_id, SwarmEngine)
_sessions: dict[str, tuple[str, SwarmEngine]] = {}


def _get_session(session_id: str, user: User) -> SwarmEngine:
    """Get session and validate ownership."""
    entry = _sessions.get(session_id)
    if not entry:
        raise HTTPException(404, f"Swarm session '{session_id}' not found")
    owner_id, engine = entry
    if owner_id != user.id:
        raise HTTPException(403, "Not your swarm session")
    return engine


class SwarmInitRequest(BaseModel):
    session_id:  str  = Field(..., min_length=1, max_length=64)
    agents:      list[dict]
    targets:     list[dict] = []
    behavior:    str        = "FORMATION"
    center_lat:  float      = 48.3794
    center_lon:  float      = 31.1656
    center_alt:  float      = 150.0


class SwarmTickRequest(BaseModel):
    session_id:         str
    dt:                 float = Field(default=1.0,  ge=0.01, le=10.0)
    speed_ms:           float = Field(default=20.0, ge=1.0,  le=200.0)
    formation_pattern:  str   = "wedge"
    threat_lat:         float | None = None
    threat_lon:         float | None = None


class SwarmCommandRequest(BaseModel):
    session_id: str
    command:    str
    params:     dict = {}


@router.post("/init")
async def swarm_init(
    payload:      SwarmInitRequest,
    current_user: User = Depends(get_current_user),
):
    # Limit: 5 concurrent sessions per user
    user_sessions = sum(1 for uid, _ in _sessions.values() if uid == current_user.id)
    if user_sessions >= 5:
        raise HTTPException(429, "Max 5 concurrent swarm sessions per user")

    try:
        engine = SwarmEngine()
        agents = [
            SwarmAgent(
                id       = a.get("id", f"agent_{i}"),
                role     = SwarmRole(a.get("role", "WINGMAN" if i > 0 else "LEADER")),
                lat      = payload.center_lat + 0.001 * 0.5 * (i % 3 - 1),
                lon      = payload.center_lon + 0.001 * 0.5 * ((i // 3) % 3 - 1),
                alt_m    = payload.center_alt + (i % 3) * 10,
                fuel_pct = a.get("fuel_pct", 1.0),
            )
            for i, a in enumerate(payload.agents[:20])  # max 20 agents
        ]
        targets = [
            SwarmTarget(
                id       = t.get("id", f"tgt_{i}"),
                lat      = t["lat"],
                lon      = t["lon"],
                alt_m    = t.get("alt_m", 0),
                priority = t.get("priority", 1),
            )
            for i, t in enumerate(payload.targets[:10])  # max 10 targets
        ]
        state = engine.initialize(agents, targets, SwarmBehavior(payload.behavior))
        _sessions[payload.session_id] = (current_user.id, engine)
        logger.info("swarm.init", session=payload.session_id, user=current_user.id, agents=len(agents))
        return {"session_id": payload.session_id, "state": state.to_dict()}
    except Exception as ex:
        logger.error("swarm.init.error", error=str(ex))
        raise HTTPException(400, str(ex))


@router.post("/tick")
async def swarm_tick(
    payload:      SwarmTickRequest,
    current_user: User = Depends(get_current_user),
):
    engine = _get_session(payload.session_id, current_user)
    try:
        return engine.tick(
            dt                = payload.dt,
            speed_ms          = payload.speed_ms,
            formation_pattern = payload.formation_pattern,
            threat_lat        = payload.threat_lat,
            threat_lon        = payload.threat_lon,
        ).to_dict()
    except Exception as ex:
        logger.error("swarm.tick.error", error=str(ex))
        raise HTTPException(400, str(ex))


@router.post("/command")
async def swarm_command(
    payload:      SwarmCommandRequest,
    current_user: User = Depends(get_current_user),
):
    engine = _get_session(payload.session_id, current_user)
    try:
        match payload.command:
            case "SET_BEHAVIOR":
                engine.set_behavior(SwarmBehavior(payload.params["behavior"]))
            case "KILL_AGENT":
                engine.kill_agent(payload.params["agent_id"])
            case "ADD_TARGET":
                p = payload.params
                if engine._state:
                    engine._state.targets.append(SwarmTarget(
                        id=p.get("id","new_tgt"), lat=p["lat"], lon=p["lon"],
                        alt_m=p.get("alt_m",0), priority=p.get("priority",1),
                    ))
            case _:
                raise HTTPException(400, f"Unknown command: {payload.command}")
        state = engine.get_state()
        return {"ok": True, "state": state.to_dict() if state else None}
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(400, str(ex))


@router.get("/sessions")
async def list_sessions(current_user: User = Depends(get_current_user)):
    """List only the current user's sessions."""
    user_sessions = {
        sid: "active"
        for sid, (uid, _) in _sessions.items()
        if uid == current_user.id
    }
    return {"sessions": list(user_sessions.keys()), "count": len(user_sessions)}


@router.delete("/session/{session_id}")
async def delete_session(
    session_id:   str,
    current_user: User = Depends(get_current_user),
):
    _get_session(session_id, current_user)  # validates ownership
    _sessions.pop(session_id, None)
    return {"deleted": session_id}


@router.get("/formations")
async def list_formations(current_user: User = Depends(get_current_user)):
    return {
        "formations": [
            {"id":"wedge",   "name":"Wedge",    "desc":"V-shape — balanced offense/defense"},
            {"id":"line",    "name":"Line",      "desc":"Column behind leader"},
            {"id":"diamond", "name":"Diamond",   "desc":"Diamond — 360° coverage"},
            {"id":"spread",  "name":"Spread",    "desc":"Random spread — saturation attack"},
        ]
    }
