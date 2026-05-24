from dataclasses import dataclass, field
from enum import Enum
import math

class SAMState(str, Enum):
    STANDBY="STANDBY"; SEARCHING="SEARCHING"; TRACKING="TRACKING"
    ENGAGING="ENGAGING"; RELOADING="RELOADING"

class MissileState(str, Enum):
    READY="READY"; IN_FLIGHT="IN_FLIGHT"; DETONATED="DETONATED"; MISSED="MISSED"

@dataclass
class SAMSite:
    id:str; name:str; lat:float; lon:float; altitude_m:float=0.0
    radar_band:str="H"; search_range_km:float=25.0; track_range_km:float=20.0
    min_rcs_m2:float=0.1; radar_active:bool=True
    missile_max_range_km:float=12.0; missile_min_range_km:float=1.5
    missile_max_alt_m:float=6000.0; missile_min_alt_m:float=10.0
    missile_speed_ms:float=850.0; missile_fuze_radius_m:float=15.0
    ready_rounds:int=8; current_rounds:int=8
    reload_time_s:float=1080.0; reaction_time_s:float=7.4
    state:SAMState=SAMState.SEARCHING; reload_elapsed_s:float=0.0

@dataclass
class EngagementResult:
    engaged:bool; killed:bool; miss_distance_m:float; pk:float; reason:str
