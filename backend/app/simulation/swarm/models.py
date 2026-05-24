from dataclasses import dataclass, field
from enum import Enum
import math

class SwarmRole(str, Enum):
    LEADER="LEADER"; WINGMAN="WINGMAN"; SCOUT="SCOUT"
    STRIKER="STRIKER"; DECOY="DECOY"; JAMMER="JAMMER"

class SwarmBehavior(str, Enum):
    FORMATION="FORMATION"; SEARCH="SEARCH"; CONVERGE="CONVERGE"
    SCATTER="SCATTER"; ORBIT="ORBIT"; ATTACK="ATTACK"; RTB="RTB"

@dataclass
class SwarmAgent:
    id:str; role:SwarmRole; lat:float; lon:float; alt_m:float
    vx:float=0.0; vy:float=0.0; vz:float=0.0
    alive:bool=True; fuel_pct:float=1.0; link_ok:bool=True
    formation_x:float=0.0; formation_y:float=0.0; formation_z:float=0.0

@dataclass
class SwarmTarget:
    id:str; lat:float; lon:float; alt_m:float=0.0; priority:int=1; hit:bool=False

@dataclass
class SwarmState:
    behavior:SwarmBehavior=SwarmBehavior.FORMATION
    agents:list[SwarmAgent]=field(default_factory=list)
    targets:list[SwarmTarget]=field(default_factory=list)
    tick:int=0; time_s:float=0.0
    center_lat:float=0.0; center_lon:float=0.0; center_alt:float=0.0

    def to_dict(self)->dict:
        return{"behavior":self.behavior.value,"tick":self.tick,"time_s":round(self.time_s,2),
               "center_lat":round(self.center_lat,6),"center_lon":round(self.center_lon,6),"center_alt":round(self.center_alt,1),
               "alive_count":sum(1 for a in self.agents if a.alive),
               "agents":[{"id":a.id,"role":a.role.value,"lat":round(a.lat,6),"lon":round(a.lon,6),
                          "alt_m":round(a.alt_m,1),"vx":round(a.vx,2),"vy":round(a.vy,2),
                          "alive":a.alive,"fuel_pct":round(a.fuel_pct,3),"link_ok":a.link_ok} for a in self.agents],
               "targets":[{"id":t.id,"lat":t.lat,"lon":t.lon,"priority":t.priority,"hit":t.hit} for t in self.targets]}
