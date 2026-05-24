import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.ew.engine import EWEngine
from app.simulation.ew.models import EWEmitter, EWState, JammingType
from app.simulation.ew.scenarios import BUILTIN_SCENARIOS

logger=structlog.get_logger(); router=APIRouter()

class EWComputeRequest(BaseModel):
    uav_lat: float; uav_lon: float; uav_alt_m: float=100.0
    uav_gps_bands: list[str]=["L1"]; uav_datalink_freq_mhz: float|None=None
    emitters: list[dict]=[]; dt: float=1.0; prev_gps_drift: float=0.0

class ScenarioRequest(BaseModel):
    scenario: str; center_lat: float; center_lon: float

@router.post("/compute")
async def compute_ew(payload: EWComputeRequest, current_user: User=Depends(get_current_user)):
    try:
        emitters=[EWEmitter(id=e.get("id",f"e_{i}"),name=e.get("name","EW"),lat=e["lat"],lon=e["lon"],
            altitude_m=e.get("altitude_m",0),jamming_types=[JammingType(jt) for jt in e.get("jamming_types",[])],
            power_kw=e.get("power_kw",1.0),effective_range_km=e.get("effective_range_km",20.0),active=e.get("active",True),
            spoof_lat_offset=e.get("spoof_lat_offset",0.0),spoof_lon_offset=e.get("spoof_lon_offset",0.0))
            for i,e in enumerate(payload.emitters)]
        prev=EWState(gps_drift_ms=payload.prev_gps_drift)
        engine=EWEngine(emitters)
        ew=engine.compute("sim",payload.uav_lat,payload.uav_lon,payload.uav_alt_m,
            payload.uav_gps_bands,payload.uav_datalink_freq_mhz,payload.dt,prev)
        return {"ew_state":ew.to_dict(),"emitters":[{"id":e.id,"name":e.name,"lat":e.lat,"lon":e.lon,
            "power_kw":e.power_kw,"effective_range_km":e.effective_range_km,
            "jamming_types":[jt.value for jt in e.jamming_types],"active":e.active} for e in emitters]}
    except Exception as ex:
        logger.error("ew.compute.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.get("/scenarios")
async def list_scenarios(current_user: User=Depends(get_current_user)):
    return {"scenarios":[
        {"id":"gps_denial","name":"GPS Denial Zone","description":"Pole-21 wide-area GPS blocking","difficulty":"medium"},
        {"id":"datalink_jam","name":"Datalink Jamming","description":"Leer-3 command link suppression","difficulty":"medium"},
        {"id":"full_spectrum","name":"Full Spectrum EW","description":"Krasukha-4 broadband suppression","difficulty":"hard"},
        {"id":"gps_spoofing","name":"GPS Spoofing","description":"Fake position injection","difficulty":"critical"},
    ]}

@router.post("/scenario/emitters")
async def get_scenario_emitters(payload: ScenarioRequest, current_user: User=Depends(get_current_user)):
    fn=BUILTIN_SCENARIOS.get(payload.scenario)
    if not fn: raise HTTPException(404,f"Scenario '{payload.scenario}' not found")
    emitters=fn(payload.center_lat,payload.center_lon)
    return {"emitters":[{"id":e.id,"name":e.name,"lat":e.lat,"lon":e.lon,"power_kw":e.power_kw,
        "effective_range_km":e.effective_range_km,"jamming_types":[jt.value for jt in e.jamming_types],"active":e.active}
        for e in emitters]}
