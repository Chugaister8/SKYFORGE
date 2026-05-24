from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum
import uuid


class UserRole(str, enum.Enum):
    PILOT      = "PILOT"
    ENGINEER   = "ENGINEER"
    COMMANDER  = "COMMANDER"
    INSTRUCTOR = "INSTRUCTOR"
    ADMIN      = "ADMIN"


class UserStatus(str, enum.Enum):
    ACTIVE   = "ACTIVE"
    INACTIVE = "INACTIVE"
    BANNED   = "BANNED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    username: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole),
        default=UserRole.PILOT,
        nullable=False,
    )
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus),
        default=UserStatus.ACTIVE,
        nullable=False,
    )

    # Profile
    full_name: Mapped[str | None] = mapped_column(String(128))
    unit:      Mapped[str | None] = mapped_column(String(128))
    avatar_url:Mapped[str | None] = mapped_column(String(512))

    # Stats
    missions_completed: Mapped[int] = mapped_column(default=0)
    flight_hours:       Mapped[float] = mapped_column(default=0.0)

    # Meta
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    last_login:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<User {self.username} [{self.role}]>"
