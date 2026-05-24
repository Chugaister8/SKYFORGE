from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum
import uuid


class UAVClass(str, enum.Enum):
    NANO                 = "NANO"
    MICRO_FPV            = "MICRO_FPV"
    STRIKE_FPV           = "STRIKE_FPV"
    TACTICAL_MULTIROTOR  = "TACTICAL_MULTIROTOR"
    TACTICAL_VTOL        = "TACTICAL_VTOL"
    FIXED_WING_ISR       = "FIXED_WING_ISR"
    LOITERING_MUNITION   = "LOITERING_MUNITION"
    MALE                 = "MALE"
    HALE                 = "HALE"


class UAVStatus(str, enum.Enum):
    ONLINE      = "ONLINE"
    OFFLINE     = "OFFLINE"
    IN_MISSION  = "IN_MISSION"
    MAINTENANCE = "MAINTENANCE"
    LOST        = "LOST"


class UAV(Base):
    __tablename__ = "uavs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True,
    )

    # Identity
    name:         Mapped[str]         = mapped_column(String(64), nullable=False)
    callsign:     Mapped[str]         = mapped_column(String(16), nullable=False)
    uav_class:    Mapped[UAVClass]    = mapped_column(SAEnum(UAVClass), nullable=False)
    manufacturer: Mapped[str | None]  = mapped_column(String(128))
    model:        Mapped[str | None]  = mapped_column(String(128))

    # Status
    status: Mapped[UAVStatus] = mapped_column(
        SAEnum(UAVStatus), default=UAVStatus.OFFLINE, nullable=False,
    )

    # Physical specs (SI units)
    mass_kg:          Mapped[float] = mapped_column(Float, default=1.0)
    wingspan_m:       Mapped[float | None] = mapped_column(Float)
    max_speed_ms:     Mapped[float] = mapped_column(Float, default=15.0)
    cruise_speed_ms:  Mapped[float] = mapped_column(Float, default=10.0)
    max_altitude_m:   Mapped[float] = mapped_column(Float, default=400.0)
    max_range_km:     Mapped[float] = mapped_column(Float, default=5.0)
    endurance_min:    Mapped[float] = mapped_column(Float, default=30.0)

    # Propulsion
    motor_type:       Mapped[str | None] = mapped_column(String(32))  # electric/ICE/hybrid
    battery_mah:      Mapped[float | None] = mapped_column(Float)
    fuel_liters:      Mapped[float | None] = mapped_column(Float)

    # Comms & Sensors
    datalink_freq_mhz:  Mapped[float | None] = mapped_column(Float)
    gps_type:           Mapped[str | None]   = mapped_column(String(32))
    has_eo:             Mapped[bool] = mapped_column(Boolean, default=False)
    has_ir:             Mapped[bool] = mapped_column(Boolean, default=False)
    has_lidar:          Mapped[bool] = mapped_column(Boolean, default=False)

    # Vulnerability
    rcs_m2:             Mapped[float | None] = mapped_column(Float)
    ir_signature:       Mapped[str | None]   = mapped_column(String(16))  # LOW/MED/HIGH
    jamming_resistance: Mapped[str | None]   = mapped_column(String(16))  # LOW/MED/HIGH

    # Extended params (JSON для кастомних параметрів)
    custom_params: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # Meta
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relations
    owner: Mapped["User"] = relationship("User", backref="uavs")  # type: ignore

    def __repr__(self) -> str:
        return f"<UAV {self.callsign} [{self.uav_class}] {self.status}>"
