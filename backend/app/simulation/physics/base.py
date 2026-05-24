from dataclasses import dataclass, field
from enum import Enum
import numpy as np

class UAVType(str, Enum):
    MULTIROTOR = "MULTIROTOR"
    FIXED_WING = "FIXED_WING"
    VTOL       = "VTOL"
    LOITERING  = "LOITERING"

@dataclass
class UAVPhysicsConfig:
    uav_id: str; uav_type: UAVType
    mass_kg: float; wingspan_m: float; length_m: float; wing_area_m2: float
    drag_coefficient: float; lift_coefficient: float
    cl_alpha: float = 5.7; cd0: float = 0.025; oswald_e: float = 0.8
    max_thrust_n: float = 0.0; max_throttle: float = 1.0; motor_time_const: float = 0.1
    battery_capacity_j: float = 0.0; fuel_capacity_kg: float = 0.0
    pid_roll:     dict = field(default_factory=lambda: {"p":1.0,"i":0.1,"d":0.05})
    pid_pitch:    dict = field(default_factory=lambda: {"p":1.0,"i":0.1,"d":0.05})
    pid_yaw:      dict = field(default_factory=lambda: {"p":0.8,"i":0.05,"d":0.02})
    pid_altitude: dict = field(default_factory=lambda: {"p":1.2,"i":0.15,"d":0.1})
    pid_velocity: dict = field(default_factory=lambda: {"p":0.8,"i":0.05,"d":0.02})
    max_speed_ms: float = 30.0; max_altitude_m: float = 400.0
    max_roll_deg: float = 45.0; max_pitch_deg: float = 30.0; max_climb_ms: float = 8.0
    stall_speed_ms: float = 0.0
    ixx: float = 0.1; iyy: float = 0.1; izz: float = 0.2

@dataclass
class PhysicsState:
    x: float = 0.0; y: float = 0.0; z: float = 0.0
    vx: float = 0.0; vy: float = 0.0; vz: float = 0.0
    roll: float = 0.0; pitch: float = 0.0; yaw: float = 0.0
    p: float = 0.0; q: float = 0.0; r: float = 0.0
    throttle: float = 0.0; actual_throttle: float = 0.0; fuel_remaining: float = 1.0
    airspeed_ms: float = 0.0; groundspeed_ms: float = 0.0; altitude_m: float = 0.0
    sim_time_s: float = 0.0

    def to_dict(self) -> dict:
        import math
        return {
            "x":round(self.x,3),"y":round(self.y,3),"z":round(self.z,3),
            "vx":round(self.vx,3),"vy":round(self.vy,3),"vz":round(self.vz,3),
            "roll":round(math.degrees(self.roll),2),"pitch":round(math.degrees(self.pitch),2),"yaw":round(math.degrees(self.yaw),2),
            "p":round(self.p,4),"q":round(self.q,4),"r":round(self.r,4),
            "throttle":round(self.throttle,3),"actual_throttle":round(self.actual_throttle,3),
            "fuel_remaining":round(self.fuel_remaining,4),
            "airspeed_ms":round(self.airspeed_ms,2),"groundspeed_ms":round(self.groundspeed_ms,2),
            "altitude_m":round(self.altitude_m,2),"sim_time_s":round(self.sim_time_s,3),
        }

@dataclass
class ControlInput:
    roll_cmd: float = 0.0; pitch_cmd: float = 0.0; yaw_cmd: float = 0.0; throttle_cmd: float = 0.0
    target_altitude_m: float | None = None; target_speed_ms: float | None = None
    target_heading_deg: float | None = None; target_lat: float | None = None; target_lon: float | None = None
