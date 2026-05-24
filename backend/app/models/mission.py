from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid

class Mission(Base):
    __tablename__ = "missions"
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    owner_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),nullable=False,index=True)
    name:Mapped[str]=mapped_column(String(128),nullable=False)
    description:Mapped[str|None]=mapped_column(String(512))
    status:Mapped[str]=mapped_column(String(32),default="DRAFT")
    waypoints:Mapped[dict]=mapped_column(JSON,default=list)
    threat_sites:Mapped[dict]=mapped_column(JSON,default=list)
    uav_rcs:Mapped[float]=mapped_column(Float,default=0.1)
    uav_speed:Mapped[float]=mapped_column(Float,default=30.0)
    overall_risk:Mapped[float]=mapped_column(Float,default=0.0)
    weather:Mapped[dict|None]=mapped_column(JSON)
    aar_data:Mapped[dict|None]=mapped_column(JSON)
    duration_s:Mapped[float]=mapped_column(Float,default=0.0)
    score:Mapped[int]=mapped_column(Integer,default=0)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))
    completed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
