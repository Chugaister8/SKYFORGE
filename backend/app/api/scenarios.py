import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.scenarios.builder import BUILTIN_BUILDERS, SCENARIO_CATALOG

logger=structlog.get_logger(); router=APIRouter()

class BuildRequest(BaseModel):
    scenario_id:str; difficulty:str="MEDIUM"; center_lat:float=48.3794; center_lon:float=31.1656

@router.get("/catalog")
async def get_catalog(current_user:User=Depends(get_current_user)):
    return{"scenarios":SCENARIO_CATALOG,"difficulties":["TRAINING","EASY","MEDIUM","HARD","EXPERT"]}

@router.post("/build")
async def build_scenario(payload:BuildRequest, current_user:User=Depends(get_current_user)):
    builder=BUILTIN_BUILDERS.get(payload.scenario_id)
    if not builder: raise HTTPException(404,f"Scenario '{payload.scenario_id}' not found")
    try: return builder(payload.center_lat,payload.center_lon,payload.difficulty).to_dict()
    except Exception as ex:
        logger.error("scenario.build.error",error=str(ex)); raise HTTPException(400,str(ex))
