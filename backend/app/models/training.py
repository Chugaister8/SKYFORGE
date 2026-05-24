from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, JSON, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid

class Course(Base):
    __tablename__="courses"
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    title:Mapped[str]=mapped_column(String(128),nullable=False)
    description:Mapped[str]=mapped_column(Text,default="")
    category:Mapped[str]=mapped_column(String(64),default="GENERAL")
    difficulty:Mapped[str]=mapped_column(String(16),default="BEGINNER")
    duration_min:Mapped[int]=mapped_column(Integer,default=60)
    uav_class:Mapped[str|None]=mapped_column(String(64))
    modules:Mapped[dict]=mapped_column(JSON,default=list)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))

class UserProgress(Base):
    __tablename__="user_progress"
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),nullable=False,index=True)
    course_id:Mapped[str]=mapped_column(String(36),nullable=False)
    progress_pct:Mapped[float]=mapped_column(Float,default=0.0)
    completed:Mapped[bool]=mapped_column(Boolean,default=False)
    score:Mapped[int]=mapped_column(Integer,default=0)
    attempts:Mapped[int]=mapped_column(Integer,default=0)
    module_data:Mapped[dict]=mapped_column(JSON,default=dict)
    started_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))
    completed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class Certificate(Base):
    __tablename__="certificates"
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),nullable=False,index=True)
    course_id:Mapped[str]=mapped_column(String(36),nullable=False)
    cert_number:Mapped[str]=mapped_column(String(32),unique=True)
    score:Mapped[int]=mapped_column(Integer,default=0)
    grade:Mapped[str]=mapped_column(String(4),default="B")
    issued_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))
    expires_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    valid:Mapped[bool]=mapped_column(Boolean,default=True)
