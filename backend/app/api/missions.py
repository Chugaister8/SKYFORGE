import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.mission import Mission

logger=structlog.get_logger(); router=APIRouter()

class MissionCreate(BaseModel):
    name:str; description:str|None=None; waypoints:list[dict]=[]; threat_sites:list[dict]=[]
    uav_rcs:float=0.1; uav_speed:float=30.0; overall_risk:float=0.0; weather:dict|None=None

class MissionUpdate(BaseModel):
    name:str|None=None; waypoints:list[dict]|None=None; threat_sites:list[dict]|None=None
    overall_risk:float|None=None; status:str|None=None; aar_data:dict|None=None; weather:dict|None=None

class MissionResponse(BaseModel):
    id:str; name:str; description:str|None; status:str; waypoints:list; threat_sites:list
    uav_rcs:float; uav_speed:float; overall_risk:float; weather:dict|None; aar_data:dict|None
    duration_s:float; score:int; created_at:str
    model_config={"from_attributes":True}

@router.get("/",response_model=list[MissionResponse])
async def list_missions(current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    r=await db.execute(select(Mission).where(Mission.owner_id==current_user.id).order_by(Mission.created_at.desc()))
    return r.scalars().all()

@router.post("/",response_model=MissionResponse,status_code=status.HTTP_201_CREATED)
async def create_mission(payload:MissionCreate,current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    m=Mission(owner_id=current_user.id,**payload.model_dump()); db.add(m); await db.commit(); await db.refresh(m); return m

@router.get("/{mid}",response_model=MissionResponse)
async def get_mission(mid:str,current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    r=await db.execute(select(Mission).where(Mission.id==mid,Mission.owner_id==current_user.id))
    m=r.scalar_one_or_none()
    if not m: raise HTTPException(404,"Mission not found")
    return m

@router.patch("/{mid}",response_model=MissionResponse)
async def update_mission(mid:str,payload:MissionUpdate,current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    r=await db.execute(select(Mission).where(Mission.id==mid,Mission.owner_id==current_user.id))
    m=r.scalar_one_or_none()
    if not m: raise HTTPException(404,"Mission not found")
    for k,v in payload.model_dump(exclude_none=True).items(): setattr(m,k,v)
    if payload.status=="COMPLETED" and not m.completed_at: m.completed_at=datetime.now(timezone.utc)
    await db.commit(); await db.refresh(m); return m

@router.delete("/{mid}",status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(mid:str,current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    r=await db.execute(select(Mission).where(Mission.id==mid,Mission.owner_id==current_user.id))
    m=r.scalar_one_or_none()
    if not m: raise HTTPException(404,"Mission not found")
    await db.delete(m); await db.commit()

@router.post("/{mid}/aar")
async def save_aar(mid:str,aar:dict,current_user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    r=await db.execute(select(Mission).where(Mission.id==mid,Mission.owner_id==current_user.id))
    m=r.scalar_one_or_none()
    if not m: raise HTTPException(404,"Mission not found")
    m.aar_data=aar.get("aar_data"); m.duration_s=aar.get("duration_s",0); m.score=aar.get("score",0)
    m.status="COMPLETED"; m.completed_at=datetime.now(timezone.utc)
    await db.commit(); return {"saved":True,"score":m.score}
