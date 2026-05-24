import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.engineer.failures import FAILURE_LIBRARY, generate_random_failure, FailureCategory

logger=structlog.get_logger(); router=APIRouter()

class FailureSimRequest(BaseModel):
    uav_class:str="TACTICAL_MULTIROTOR"; flight_hours:float=1.0; has_ecm:bool=False

def _fdict(f):
    return{"id":f.id,"name":f.name,"category":f.category.value,"severity":f.severity.value,
           "description":f.description,"symptoms":f.symptoms,"procedures":f.procedures,
           "can_continue":f.can_continue,"thrust_loss":f.thrust_loss_pct,"control_loss":f.control_loss_pct,
           "sensor_loss":f.sensor_loss,"comms_loss":f.comms_loss_pct}

@router.get("/failures")
async def list_failures(category:str|None=None, current_user:User=Depends(get_current_user)):
    fl=list(FAILURE_LIBRARY.values())
    if category: fl=[f for f in fl if f.category.value==category.upper()]
    return{"failures":[_fdict(f) for f in fl],"categories":[c.value for c in FailureCategory]}

@router.post("/simulate-failure")
async def simulate_failure(payload:FailureSimRequest, current_user:User=Depends(get_current_user)):
    f=generate_random_failure(payload.uav_class,payload.flight_hours,payload.has_ecm)
    if not f: return{"failure":None,"message":"No failure — flight nominal"}
    return{"failure":{**_fdict(f),"effects":{"thrust_loss_pct":f.thrust_loss_pct,"control_loss_pct":f.control_loss_pct,"sensor_loss":f.sensor_loss,"comms_loss_pct":f.comms_loss_pct}}}

@router.get("/failures/{fid}")
async def get_failure(fid:str, current_user:User=Depends(get_current_user)):
    f=FAILURE_LIBRARY.get(fid)
    if not f: raise HTTPException(404,f"Failure '{fid}' not found")
    return{**_fdict(f),"probability":f.probability}
