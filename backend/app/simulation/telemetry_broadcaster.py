import asyncio, math, random, structlog
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.websocket_manager import ws_manager
from app.models.uav import UAV, UAVStatus

logger = structlog.get_logger()
_uav_state: dict[str, dict] = {}

def _init_state(uav: UAV) -> dict:
    return {
        "lat": 48.3794 + random.uniform(-0.05, 0.05),
        "lon": 31.1656 + random.uniform(-0.05, 0.05),
        "altitude_m": random.uniform(80, 250),
        "speed_ms": uav.cruise_speed_ms * random.uniform(0.8, 1.0),
        "heading_deg": random.uniform(0, 360),
        "battery_pct": random.uniform(60, 95),
        "link_quality": random.uniform(0.85, 1.0),
        "phase": random.uniform(0, math.pi * 2),
        "orbit_r": random.uniform(0.005, 0.015),
        "orbit_speed": random.uniform(0.02, 0.06),
    }

def _update_state(state: dict, uav: UAV, tick: float) -> dict:
    phase = state["phase"] + state["orbit_speed"]
    lat = 48.3794 + math.sin(phase) * state["orbit_r"]
    lon = 31.1656 + math.cos(phase) * state["orbit_r"] * 1.4
    prev_lat = 48.3794 + math.sin(phase - state["orbit_speed"]) * state["orbit_r"]
    prev_lon = 31.1656 + math.cos(phase - state["orbit_speed"]) * state["orbit_r"] * 1.4
    heading = math.degrees(math.atan2(lon - prev_lon, lat - prev_lat)) % 360
    battery = max(5.0, state["battery_pct"] - random.uniform(0.01, 0.05))
    altitude = max(50, min(uav.max_altitude_m, state["altitude_m"] + random.uniform(-2, 2)))
    link = min(1.0, max(0.3, state["link_quality"] + random.uniform(-0.02, 0.02)))
    return {**state, "lat": round(lat,6), "lon": round(lon,6), "altitude_m": round(altitude,1),
            "speed_ms": round(uav.cruise_speed_ms * random.uniform(0.85, 1.05), 1),
            "heading_deg": round(heading,1), "battery_pct": round(battery,1),
            "link_quality": round(link,3), "phase": phase}

async def _broadcast_tick() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UAV).where(UAV.status.in_([UAVStatus.ONLINE, UAVStatus.IN_MISSION])))
        uavs = result.scalars().all()
    tick = asyncio.get_event_loop().time()
    by_owner: dict[str, list[dict]] = {}
    for uav in uavs:
        if uav.id not in _uav_state:
            _uav_state[uav.id] = _init_state(uav)
        _uav_state[uav.id] = _update_state(_uav_state[uav.id], uav, tick)
        s = _uav_state[uav.id]
        snap = {"type": "telemetry", "uav_id": uav.id, "callsign": uav.callsign,
                "status": uav.status.value, "lat": s["lat"], "lon": s["lon"],
                "altitude_m": s["altitude_m"], "speed_ms": s["speed_ms"],
                "heading_deg": s["heading_deg"], "battery_pct": s["battery_pct"],
                "link_quality": s["link_quality"], "timestamp": datetime.now(timezone.utc).isoformat()}
        by_owner.setdefault(uav.owner_id, []).append(snap)
    for owner_id, snapshots in by_owner.items():
        await ws_manager.send_to_user(owner_id, {"type": "fleet_telemetry", "snapshots": snapshots, "tick": tick})

async def start_telemetry_broadcaster(interval: float = 1.0) -> None:
    logger.info("telemetry.broadcaster.start", interval=interval)
    while True:
        try:
            await _broadcast_tick()
        except Exception as e:
            logger.error("telemetry.broadcaster.error", error=str(e))
        await asyncio.sleep(interval)
