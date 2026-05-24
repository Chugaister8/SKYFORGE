from app.simulation.physics.base import UAVPhysicsConfig, UAVType
from app.simulation.physics.multirotor import MultirotorPhysics
from app.simulation.physics.fixed_wing import FixedWingPhysics
from app.simulation.physics.atmosphere import WindModel
from app.library.loader import get_entry

def physics_from_library(library_id: str, wind: WindModel | None = None):
    entry=get_entry(library_id)
    if not entry: raise ValueError(f"Library entry not found: {library_id}")
    sp=entry.sim_params; uav_type=_map_subtype(entry.uav_subtype)
    cfg=UAVPhysicsConfig(
        uav_id=library_id, uav_type=uav_type,
        mass_kg=sp.mass_kg, wingspan_m=sp.wingspan_m, length_m=sp.length_m, wing_area_m2=sp.wing_area_m2,
        drag_coefficient=sp.drag_coefficient, lift_coefficient=sp.lift_coefficient,
        max_thrust_n=sp.mass_kg*9.81*2.2,
        battery_capacity_j=getattr(entry.propulsion,"battery_mah",0)*3.7*3600/1000 if getattr(entry.propulsion,"battery_mah",None) else 0,
        fuel_capacity_kg=(getattr(entry.propulsion,"fuel_capacity_l",0) or 0)*0.72,
        max_speed_ms=entry.performance.max_speed_kmh/3.6,
        max_altitude_m=entry.performance.max_altitude_m,
        stall_speed_ms=entry.performance.cruise_speed_kmh*0.6/3.6 if uav_type!=UAVType.MULTIROTOR else 0.0,
        pid_roll=sp.pid_roll, pid_pitch=sp.pid_pitch, pid_yaw=sp.pid_yaw, pid_altitude=sp.pid_altitude,
    )
    if uav_type==UAVType.MULTIROTOR: return MultirotorPhysics(cfg,wind)
    return FixedWingPhysics(cfg,wind)

def _map_subtype(subtype: str) -> UAVType:
    return {"MULTIROTOR":UAVType.MULTIROTOR,"FIXED_WING":UAVType.FIXED_WING,"VTOL":UAVType.VTOL,"LOITERING":UAVType.LOITERING}.get(subtype.upper(),UAVType.FIXED_WING)
