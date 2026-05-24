import math, random
from app.simulation.scenarios.models import Scenario, ScenarioType, DifficultyLevel, ScenarioWaypoint, ScenarioThreat, ScenarioObjective

DEG_LAT=1.0/111_320.0
def _off(lat,lon,dx,dy): dl=1.0/(111_320.0*math.cos(math.radians(lat))); return lat+dx*DEG_LAT, lon+dy*dl

def build_isr_patrol(clat,clon,difficulty):
    diff=DifficultyLevel(difficulty); n={"TRAINING":0,"EASY":1,"MEDIUM":2,"HARD":3,"EXPERT":4}.get(difficulty,2)
    wps=[ScenarioWaypoint(clat+0.04*math.cos((i/6)*2*math.pi),clon+0.04*math.sin((i/6)*2*math.pi),200 if difficulty in["TRAINING","EASY"] else 120,speed_ms=20) for i in range(6)]
    threats=[ScenarioThreat("SAM",["tor-m1","zu-23-2","manpads","buk-m2"][i%4],*_off(clat,clon,random.uniform(-4000,4000),random.uniform(-4000,4000))) for i in range(n)]
    objectives=[ScenarioObjective("obj1","Complete patrol","SURVIVE",required=True),ScenarioObjective("obj2","Return to base","RTB",clat,clon,required=True)]
    return Scenario(id=f"isr-patrol-{difficulty.lower()}",name=f"ISR Patrol — {difficulty}",description="Reconnaissance patrol with threat avoidance and RTB.",
        type=ScenarioType.ISR_PATROL,difficulty=diff,center_lat=clat,center_lon=clon,waypoints=wps,threats=threats,objectives=objectives,
        recommended_uav="leleka-100",uav_rcs_m2=0.03,uav_speed_ms=18,time_limit_s=1200,tags=["isr","patrol"])

def build_strike_run(clat,clon,difficulty):
    diff=DifficultyLevel(difficulty); n={"TRAINING":0,"EASY":1,"MEDIUM":2,"HARD":3,"EXPERT":5}.get(difficulty,2)
    tlat,tlon=_off(clat,clon,3000,0)
    wps=[ScenarioWaypoint(*_off(clat,clon,0,-500),80,"WAYPOINT",25),ScenarioWaypoint(*_off(clat,clon,1000,-200),60,"WAYPOINT",22),
         ScenarioWaypoint(*_off(clat,clon,2500,0),50,"WAYPOINT",20),ScenarioWaypoint(tlat,tlon,30,"STRIKE",18),
         ScenarioWaypoint(*_off(clat,clon,1000,500),80,"WAYPOINT",25)]
    threats=[ScenarioThreat("SAM",["zu-23-2","tor-m1","manpads","buk-m2"][i%4],*_off(clat,clon,random.uniform(500,3500),random.uniform(-2000,2000))) for i in range(n)]
    objectives=[ScenarioObjective("obj1","Strike primary target","STRIKE",tlat,tlon,200,required=True),
                ScenarioObjective("obj2","Return to base","RTB",clat,clon,required=True)]
    return Scenario(id=f"strike-run-{difficulty.lower()}",name=f"Strike Run — {difficulty}",description="Penetrate AD, strike target, RTB. NOE approach recommended.",
        type=ScenarioType.STRIKE_RUN,difficulty=diff,center_lat=clat,center_lon=clon,waypoints=wps,threats=threats,objectives=objectives,
        recommended_uav="uj-22",uav_rcs_m2=0.15,uav_speed_ms=30,time_limit_s=900,tags=["strike","noe"])

def build_ew_gauntlet(clat,clon,difficulty):
    diff=DifficultyLevel(difficulty); n={"TRAINING":1,"EASY":2,"MEDIUM":3,"HARD":4,"EXPERT":5}.get(difficulty,3)
    wps=[ScenarioWaypoint(*_off(clat,clon,d,s),150,"WAYPOINT",20) for d,s in[(0,0),(2000,500),(4000,-300),(6000,200),(8000,0)]]
    threats=[ScenarioThreat("EW",["pole-21","krasukha-4"][i%2],*_off(clat,clon,random.uniform(1000,7000),random.uniform(-3000,3000))) for i in range(n)]
    objectives=[ScenarioObjective("obj1","Navigate EW denial zone","SURVIVE",required=True),
                ScenarioObjective("obj2","Reach objective","REACH",*_off(clat,clon,8000,0),300,required=True)]
    return Scenario(id=f"ew-gauntlet-{difficulty.lower()}",name=f"EW Gauntlet — {difficulty}",description="Navigate GPS-denied EW zone using INS navigation.",
        type=ScenarioType.ISR_PATROL,difficulty=diff,center_lat=clat,center_lon=clon,waypoints=wps,threats=threats,objectives=objectives,
        recommended_uav="bayraktar-tb2",uav_rcs_m2=0.5,uav_speed_ms=36,time_limit_s=1800,tags=["ew","gps-denied","ins"])

BUILTIN_BUILDERS={"isr_patrol":build_isr_patrol,"strike_run":build_strike_run,"ew_gauntlet":build_ew_gauntlet}
SCENARIO_CATALOG=[
    {"id":"isr_patrol","name":"ISR Patrol","type":"ISR_PATROL","description":"Reconnaissance patrol with SAM threats"},
    {"id":"strike_run","name":"Strike Run","type":"STRIKE_RUN","description":"Deep strike through air defense network"},
    {"id":"ew_gauntlet","name":"EW Gauntlet","type":"ISR_PATROL","description":"GPS-denied navigation through EW zone"},
]
