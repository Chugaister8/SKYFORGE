from dataclasses import dataclass, field
from enum import Enum

class ScenarioType(str, Enum):
    ISR_PATROL="ISR_PATROL"; STRIKE_RUN="STRIKE_RUN"; SEAD="SEAD"
    SWARM_ATTACK="SWARM_ATTACK"; CUSTOM="CUSTOM"

class DifficultyLevel(str, Enum):
    TRAINING="TRAINING"; EASY="EASY"; MEDIUM="MEDIUM"; HARD="HARD"; EXPERT="EXPERT"

@dataclass
class ScenarioWaypoint:
    lat:float; lon:float; alt_m:float; action:str="WAYPOINT"; speed_ms:float=20.0

@dataclass
class ScenarioThreat:
    type:str; preset:str; lat:float; lon:float; alt_m:float=0.0; active:bool=True

@dataclass
class ScenarioObjective:
    id:str; description:str; type:str; lat:float|None=None; lon:float|None=None
    radius_m:float=100.0; required:bool=True; completed:bool=False

@dataclass
class Scenario:
    id:str; name:str; description:str; type:ScenarioType; difficulty:DifficultyLevel
    center_lat:float; center_lon:float
    waypoints:list[ScenarioWaypoint]=field(default_factory=list)
    threats:list[ScenarioThreat]=field(default_factory=list)
    objectives:list[ScenarioObjective]=field(default_factory=list)
    weather_scenario:str="clear"; time_of_day:str="DAY"; terrain:str="FLAT"
    recommended_uav:str|None=None; uav_rcs_m2:float=0.1; uav_speed_ms:float=25.0
    time_limit_s:int=1800; max_casualties:int=0; tags:list[str]=field(default_factory=list)

    def to_dict(self)->dict:
        return{"id":self.id,"name":self.name,"description":self.description,
               "type":self.type.value,"difficulty":self.difficulty.value,
               "center_lat":self.center_lat,"center_lon":self.center_lon,
               "waypoints":[{"lat":w.lat,"lon":w.lon,"alt_m":w.alt_m,"action":w.action,"speed_ms":w.speed_ms} for w in self.waypoints],
               "threats":[{"type":t.type,"preset":t.preset,"lat":t.lat,"lon":t.lon,"active":t.active} for t in self.threats],
               "objectives":[{"id":o.id,"description":o.description,"type":o.type,"lat":o.lat,"lon":o.lon,"radius_m":o.radius_m,"required":o.required} for o in self.objectives],
               "weather_scenario":self.weather_scenario,"time_of_day":self.time_of_day,
               "recommended_uav":self.recommended_uav,"uav_rcs_m2":self.uav_rcs_m2,
               "uav_speed_ms":self.uav_speed_ms,"time_limit_s":self.time_limit_s,"tags":self.tags}
