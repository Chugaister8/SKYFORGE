import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.swarm.engine import SwarmEngine
from app.simulation.swarm.models import SwarmAgent, SwarmTarget, SwarmBehavior, SwarmRole

logger=structlog.get_logger(); router=APIRouter()
_sessions:dict[str,SwarmEngine]={}

class SwarmInitRequest(BaseModel):
    session_id:str; agents:list[dict]; targets:list[dict]=[]
    behavior:str="FORMATION"; center_lat:float=48.3794; center_lon:float=31.1656; center_alt:float=150.0

class SwarmTickRequest(BaseModel):
    session_id:str; dt:float=1.0; speed_ms:float=20.0; formation_pattern:str="wedge"
    threat_lat:float|None=None; threat_lon:float|None=None

class SwarmCommandRequest(BaseModel):
    session_id:str; command:str; params:dict={}

@router.post("/init")
async def swarm_init(payload:SwarmInitRequest, current_user:User=Depends(get_current_user)):
    try:
        engine=SwarmEngine()
        agents=[SwarmAgent(
            id=a.get("id",f"agent_{i}"),role=SwarmRole(a.get("role","WINGMAN" if i>0 else "LEADER")),
            lat=payload.center_lat+0.001*0.5*(i%3-1),lon=payload.center_lon+0.001*0.5*((i//3)%3-1),
            alt_m=payload.center_alt+(i%3)*10,fuel_pct=a.get("fuel_pct",1.0))
            for i,a in enumerate(payload.agents)]
        targets=[SwarmTarget(id=t.get("id",f"tgt_{i}"),lat=t["lat"],lon=t["lon"],alt_m=t.get("alt_m",0),priority=t.get("priority",1))
                 for i,t in enumerate(payload.targets)]
        state=engine.initialize(agents,targets,SwarmBehavior(payload.behavior))
        _sessions[payload.session_id]=engine
        return{"session_id":payload.session_id,"state":state.to_dict()}
    except Exception as ex:
        logger.error("swarm.init.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.post("/tick")
async def swarm_tick(payload:SwarmTickRequest, current_user:User=Depends(get_current_user)):
    engine=_sessions.get(payload.session_id)
    if not engine: raise HTTPException(404,f"Session '{payload.session_id}' not found")
    try:
        return engine.tick(payload.dt,payload.speed_ms,payload.formation_pattern,payload.threat_lat,payload.threat_lon).to_dict()
    except Exception as ex:
        logger.error("swarm.tick.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.post("/command")
async def swarm_command(payload:SwarmCommandRequest, current_user:User=Depends(get_current_user)):
    engine=_sessions.get(payload.session_id)
    if not engine: raise HTTPException(404,"Session not found")
    try:
        match payload.command:
            case "SET_BEHAVIOR": engine.set_behavior(SwarmBehavior(payload.params["behavior"]))
            case "KILL_AGENT":   engine.kill_agent(payload.params["agent_id"])
            case "ADD_TARGET":
                p=payload.params; engine._state.targets.append(SwarmTarget(id=p.get("id","new"),lat=p["lat"],lon=p["lon"],alt_m=p.get("alt_m",0),priority=p.get("priority",1)))
            case _: raise HTTPException(400,f"Unknown: {payload.command}")
        return{"ok":True,"state":engine.get_state().to_dict() if engine.get_state() else None}
    except HTTPException: raise
    except Exception as ex: raise HTTPException(400,str(ex))

@router.get("/sessions")
async def list_sessions(current_user:User=Depends(get_current_user)):
    return{"sessions":list(_sessions.keys()),"count":len(_sessions)}

@router.delete("/session/{sid}")
async def delete_session(sid:str, current_user:User=Depends(get_current_user)):
    _sessions.pop(sid,None); return{"deleted":sid}

@router.get("/formations")
async def list_formations(current_user:User=Depends(get_current_user)):
    return{"formations":[
        {"id":"wedge","name":"Wedge","desc":"V-shape — balanced offense/defense"},
        {"id":"line","name":"Line","desc":"Column behind leader"},
        {"id":"diamond","name":"Diamond","desc":"Diamond — 360° coverage"},
        {"id":"spread","name":"Spread","desc":"Random spread — saturation attack"},
    ]}
