import random
import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.uav import UAV, UAVStatus
from app.schemas.uav import UAVCreate, UAVUpdate, UAVResponse, TelemetrySnapshot

router = APIRouter()


@router.get("/", response_model=list[UAVResponse])
async def list_fleet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UAV).where(UAV.owner_id == current_user.id).order_by(UAV.created_at)
    )
    return result.scalars().all()


@router.post("/", response_model=UAVResponse, status_code=status.HTTP_201_CREATED)
async def create_uav(
    payload: UAVCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uav = UAV(owner_id=current_user.id, **payload.model_dump())
    db.add(uav)
    await db.commit()
    await db.refresh(uav)
    return uav


@router.get("/stats")
async def fleet_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(
        select(func.count()).where(UAV.owner_id == current_user.id)
    )
    total = total_result.scalar() or 0

    online_result = await db.execute(
        select(func.count()).where(
            UAV.owner_id == current_user.id,
            UAV.status.in_([UAVStatus.ONLINE, UAVStatus.IN_MISSION]),
        )
    )
    active = online_result.scalar() or 0

    return {
        "total":      total,
        "active":     active,
        "offline":    total - active,
        "in_mission": 0,
    }


@router.get("/telemetry", response_model=list[TelemetrySnapshot])
async def fleet_telemetry(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UAV).where(
            UAV.owner_id == current_user.id,
            UAV.status.in_([UAVStatus.ONLINE, UAVStatus.IN_MISSION]),
        )
    )
    uavs = result.scalars().all()

    snapshots = []
    for uav in uavs:
        t = datetime.now(timezone.utc).timestamp()
        snapshots.append(TelemetrySnapshot(
            uav_id=uav.id,
            callsign=uav.callsign,
            status=uav.status,
            lat=48.3794 + math.sin(t * 0.1) * 0.01,
            lon=31.1656 + math.cos(t * 0.1) * 0.01,
            altitude_m=round(random.uniform(80, 250), 1),
            speed_ms=round(random.uniform(8, uav.cruise_speed_ms), 1),
            heading_deg=round(random.uniform(0, 360), 1),
            battery_pct=round(random.uniform(40, 95), 1),
            link_quality=round(random.uniform(0.7, 1.0), 2),
            timestamp=datetime.now(timezone.utc).isoformat(),
        ))

    return snapshots


@router.get("/{uav_id}", response_model=UAVResponse)
async def get_uav(
    uav_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UAV).where(UAV.id == uav_id, UAV.owner_id == current_user.id)
    )
    uav = result.scalar_one_or_none()
    if not uav:
        raise HTTPException(status_code=404, detail="UAV not found")
    return uav


@router.patch("/{uav_id}", response_model=UAVResponse)
async def update_uav(
    uav_id: str,
    payload: UAVUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UAV).where(UAV.id == uav_id, UAV.owner_id == current_user.id)
    )
    uav = result.scalar_one_or_none()
    if not uav:
        raise HTTPException(status_code=404, detail="UAV not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(uav, field, value)

    await db.commit()
    await db.refresh(uav)
    return uav


@router.delete("/{uav_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_uav(
    uav_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UAV).where(UAV.id == uav_id, UAV.owner_id == current_user.id)
    )
    uav = result.scalar_one_or_none()
    if not uav:
        raise HTTPException(status_code=404, detail="UAV not found")
    await db.delete(uav)
    await db.commit()
