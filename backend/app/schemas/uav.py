from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.uav import UAVClass, UAVStatus


class UAVCreate(BaseModel):
    name:             str
    callsign:         str
    uav_class:        UAVClass
    manufacturer:     str | None = None
    model:            str | None = None
    mass_kg:          float      = 1.0
    wingspan_m:       float | None = None
    max_speed_ms:     float      = 15.0
    cruise_speed_ms:  float      = 10.0
    max_altitude_m:   float      = 400.0
    max_range_km:     float      = 5.0
    endurance_min:    float      = 30.0
    motor_type:       str | None = None
    battery_mah:      float | None = None
    fuel_liters:      float | None = None
    datalink_freq_mhz:float | None = None
    gps_type:         str | None = None
    has_eo:           bool       = False
    has_ir:           bool       = False
    has_lidar:        bool       = False
    rcs_m2:           float | None = None
    ir_signature:     str | None = None
    jamming_resistance: str | None = None
    custom_params:    dict       = {}

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v: raise ValueError("Name cannot be empty")
        if len(v) > 64: raise ValueError("Name too long (max 64)")
        return v

    @field_validator("callsign")
    @classmethod
    def callsign_upper(cls, v: str) -> str:
        v = v.upper().strip()
        if not v: raise ValueError("Callsign cannot be empty")
        if len(v) > 16: raise ValueError("Callsign too long (max 16)")
        import re
        if not re.match(r"^[A-Z0-9\-_]+$", v):
            raise ValueError("Callsign must be uppercase alphanumeric")
        return v

    @field_validator("mass_kg", "max_speed_ms", "endurance_min")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be positive")
        return v


class UAVUpdate(BaseModel):
    name:             str | None = None
    status:           UAVStatus | None = None
    mass_kg:          float | None = None
    max_speed_ms:     float | None = None
    cruise_speed_ms:  float | None = None
    max_altitude_m:   float | None = None
    max_range_km:     float | None = None
    endurance_min:    float | None = None
    has_eo:           bool | None = None
    has_ir:           bool | None = None
    custom_params:    dict | None = None


class TelemetrySnapshot(BaseModel):
    uav_id:      str
    callsign:    str
    status:      UAVStatus
    lat:         float | None
    lon:         float | None
    altitude_m:  float | None
    speed_ms:    float | None
    heading_deg: float | None
    battery_pct: float | None
    link_quality:float | None
    timestamp:   str


class UAVResponse(BaseModel):
    id:               str
    name:             str
    callsign:         str
    uav_class:        UAVClass
    manufacturer:     str | None
    model:            str | None
    status:           UAVStatus
    mass_kg:          float
    max_speed_ms:     float
    cruise_speed_ms:  float
    max_altitude_m:   float
    max_range_km:     float
    endurance_min:    float
    motor_type:       str | None
    battery_mah:      float | None
    has_eo:           bool
    has_ir:           bool
    has_lidar:        bool
    rcs_m2:           float | None
    ir_signature:     str | None
    jamming_resistance: str | None
    custom_params:    dict
    created_at:       datetime

    model_config = {"from_attributes": True}
