import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.physics.base import PhysicsState, ControlInput

logger=structlog.get_logger()
router=APIRouter()

class SimStepRequest(BaseModel):
    library_id: str; state: dict; control: dict; dt: float=0.05
    wind_speed: float=0.0; wind_dir_deg: float=0.0; turbulence: float=0.0

class SimStepResponse(BaseModel):
    state: dict; diagnostics: dict

@router.post("/step", response_model=SimStepResponse)
async def simulation_step(payload: SimStepRequest, current_user: User=Depends(get_current_user)):
    try:
        from app.simulation.physics.factory import physics_from_library
        from app.simulation.physics.atmosphere import WindModel
        wind=WindModel(payload.wind_speed,payload.wind_dir_deg,payload.turbulence)
        physics=physics_from_library(payload.library_id,wind)
        valid_s=PhysicsState.__dataclass_fields__.keys()
        valid_c=ControlInput.__dataclass_fields__.keys()
        state=PhysicsState(**{k:v for k,v in payload.state.items() if k in valid_s})
        cmd=ControlInput(**{k:v for k,v in payload.control.items() if k in valid_c})
        new_state=physics.step(state,cmd,payload.dt)
        return SimStepResponse(
            state=new_state.to_dict(),
            diagnostics={"thrust_pct":round(new_state.actual_throttle*100,1),"fuel_pct":round(new_state.fuel_remaining*100,1),"stall":new_state.airspeed_ms<getattr(physics.cfg,"stall_speed_ms",0)}
        )
    except Exception as e:
        logger.error("sim.step.error",error=str(e))
        raise HTTPException(status_code=400,detail=str(e))

@router.get("/presets")
async def simulation_presets(current_user: User=Depends(get_current_user)):
    return {"presets":[
        {"id":"mavic-3t","name":"DJI Mavic 3T","type":"MULTIROTOR","difficulty":"easy"},
        {"id":"leleka-100","name":"Leleka-100","type":"FIXED_WING","difficulty":"medium"},
        {"id":"bayraktar-tb2","name":"Bayraktar TB2","type":"FIXED_WING","difficulty":"hard"},
        {"id":"uj-22","name":"UJ-22 Airborne","type":"FIXED_WING","difficulty":"hard"},
        {"id":"shahed-136","name":"Shahed-136","type":"LOITERING","difficulty":"medium"},
    ]}
