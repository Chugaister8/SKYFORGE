import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.sam.engine import SAMEngine, _los_m, _kill_probability
from app.simulation.sam.presets import make_site, SAM_PRESETS

logger=structlog.get_logger(); router=APIRouter()

class SAMTickRequest(BaseModel):
    uav_lat:float; uav_lon:float; uav_alt_m:float=100.0; uav_rcs_m2:float=0.1
    uav_speed_ms:float=30.0; uav_has_ecm:bool=False; sites:list[dict]=[]; dt:float=1.0

class MissionThreatRequest(BaseModel):
    waypoints:list[dict]; sites:list[dict]; uav_rcs_m2:float=0.1; uav_speed_ms:float=30.0

@router.post("/tick")
async def sam_tick(payload:SAMTickRequest, current_user:User=Depends(get_current_user)):
    try:
        sites=[make_site(s.get("id",f"s_{i}"),s.get("name","SAM"),s["lat"],s["lon"],s.get("preset","tor-m1"),s.get("altitude_m",0))
               for i,s in enumerate(payload.sites)]
        return SAMEngine(sites).tick("sim",payload.uav_lat,payload.uav_lon,payload.uav_alt_m,
            payload.uav_rcs_m2,payload.uav_speed_ms,payload.uav_has_ecm,payload.dt)
    except Exception as ex:
        logger.error("sam.tick.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.post("/mission-threat")
async def mission_threat(payload:MissionThreatRequest, current_user:User=Depends(get_current_user)):
    try:
        sites=[make_site(s.get("id",f"s_{i}"),s.get("name","SAM"),s["lat"],s["lon"],s.get("preset","tor-m1"))
               for i,s in enumerate(payload.sites)]
        threat_map=[]
        for wp in payload.waypoints:
            wlat,wlon,walt=wp["lat"],wp["lon"],wp.get("alt_m",100)
            max_pk=0.0; st=[]
            for site in sites:
                d=_los_m(site,wlat,wlon,walt)
                pk=_kill_probability(site,d,payload.uav_rcs_m2,payload.uav_speed_ms,walt)
                if pk>0.01:
                    st.append({"site_id":site.id,"site_name":site.name,"dist_km":round(d/1000,2),"pk":round(pk,3)})
                    max_pk=max(max_pk,pk)
            threat_map.append({"lat":wlat,"lon":wlon,"alt_m":walt,"max_pk":round(max_pk,3),
                "risk":"CRITICAL" if max_pk>0.7 else "HIGH" if max_pk>0.4 else "MEDIUM" if max_pk>0.15 else "LOW" if max_pk>0.01 else "SAFE",
                "threats":st})
        return {"threat_map":threat_map,"overall_risk":max((t["max_pk"] for t in threat_map),default=0.0)}
    except Exception as ex:
        logger.error("sam.mission.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.get("/presets")
async def get_presets(current_user:User=Depends(get_current_user)):
    return {"presets":[{"id":k,"name":k.upper().replace("-"," "),"search_range_km":v["search_range_km"],
        "missile_range_km":v["missile_max_range_km"],"reaction_time_s":v["reaction_time_s"]}
        for k,v in SAM_PRESETS.items()]}
