import structlog
import math
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.physics.base import PhysicsState, ControlInput

logger = structlog.get_logger()
router = APIRouter()


class EWInfluence(BaseModel):
    """EW state that modifies physics step."""
    gps_denied:           bool  = False
    gps_accuracy_m:       float = 2.5
    link_quality:         float = 1.0   # 0.0–1.0
    datalink_denied:      bool  = False
    control_latency_ms:   float = 0.0   # extra latency degrades control authority
    nav_drift_ms:         float = 0.0   # INS drift in metres/second (cumulative)


class SimStepRequest(BaseModel):
    library_id:   str
    state:        dict
    control:      dict
    dt:           float = Field(default=0.05, ge=0.001, le=0.5)
    wind_speed:   float = Field(default=0.0, ge=0.0, le=100.0)
    wind_dir_deg: float = Field(default=0.0, ge=0.0, le=360.0)
    turbulence:   float = Field(default=0.0, ge=0.0, le=1.0)
    ew:           EWInfluence = EWInfluence()


class SimStepResponse(BaseModel):
    state:       dict
    diagnostics: dict


def _apply_ew_to_control(
    cmd:    ControlInput,
    ew:     EWInfluence,
    dt:     float,
) -> ControlInput:
    """
    Degrade control input based on EW state.
    - Datalink denied → zero control (failsafe drift)
    - High latency  → reduced control authority (smoother response only)
    - Low link quality → random noise injected into inputs
    """
    if ew.datalink_denied:
        # RC link lost → all controls center (failsafe hover/glide)
        return ControlInput(
            roll_cmd=0.0, pitch_cmd=0.0, yaw_cmd=0.0,
            throttle_cmd=cmd.throttle_cmd * 0.5,  # RTH throttle
        )

    # Link quality degradation → noise injection
    if ew.link_quality < 0.8:
        import random
        noise = (1.0 - ew.link_quality) * 0.15
        return ControlInput(
            roll_cmd     = cmd.roll_cmd     + random.gauss(0, noise),
            pitch_cmd    = cmd.pitch_cmd    + random.gauss(0, noise),
            yaw_cmd      = cmd.yaw_cmd      + random.gauss(0, noise * 0.5),
            throttle_cmd = max(0.0, min(1.0,
                cmd.throttle_cmd + random.gauss(0, noise * 0.3)
            )),
        )

    return cmd


def _apply_ew_to_state(state: PhysicsState, ew: EWInfluence, dt: float) -> PhysicsState:
    """
    Apply INS drift when GPS is denied.
    Drift accumulates over time in x/y position.
    """
    if ew.gps_denied and ew.nav_drift_ms > 0:
        import random
        drift_rate = ew.nav_drift_ms / 1000.0  # m/s
        state.x += random.gauss(0, drift_rate * dt)
        state.y += random.gauss(0, drift_rate * dt)
    return state


@router.post("/step", response_model=SimStepResponse)
async def simulation_step(
    payload:      SimStepRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        from app.simulation.physics.factory import physics_from_library
        from app.simulation.physics.atmosphere import WindModel

        wind   = WindModel(payload.wind_speed, payload.wind_dir_deg, payload.turbulence)
        physics = physics_from_library(payload.library_id, wind)

        valid_s = PhysicsState.__dataclass_fields__.keys()
        valid_c = ControlInput.__dataclass_fields__.keys()
        state   = PhysicsState(**{k: v for k, v in payload.state.items()   if k in valid_s})
        cmd     = ControlInput(**{k: v for k, v in payload.control.items() if k in valid_c})

        # Apply EW degradation to control inputs BEFORE physics step
        cmd = _apply_ew_to_control(cmd, payload.ew, payload.dt)

        new_state = physics.step(state, cmd, payload.dt)

        # Apply EW degradation to resulting state (GPS drift)
        new_state = _apply_ew_to_state(new_state, payload.ew, payload.dt)

        stall_speed = getattr(physics.cfg, "stall_speed_ms", 0)
        return SimStepResponse(
            state = new_state.to_dict(),
            diagnostics = {
                "thrust_pct":   round(new_state.actual_throttle * 100, 1),
                "fuel_pct":     round(new_state.fuel_remaining  * 100, 1),
                "stall":        new_state.airspeed_ms < stall_speed,
                "ew_active":    payload.ew.datalink_denied or payload.ew.gps_denied,
                "link_quality": round(payload.ew.link_quality, 2),
            },
        )
    except Exception as e:
        logger.error("sim.step.error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/presets")
async def simulation_presets(current_user: User = Depends(get_current_user)):
    return {
        "presets": [
            {"id":"mavic-3t",      "name":"DJI Mavic 3T",    "type":"MULTIROTOR",   "difficulty":"easy"},
            {"id":"leleka-100",    "name":"Leleka-100",       "type":"FIXED_WING",   "difficulty":"medium"},
            {"id":"bayraktar-tb2", "name":"Bayraktar TB2",    "type":"FIXED_WING",   "difficulty":"hard"},
            {"id":"uj-22",         "name":"UJ-22 Airborne",   "type":"FIXED_WING",   "difficulty":"hard"},
            {"id":"shahed-136",    "name":"Shahed-136",       "type":"LOITERING",    "difficulty":"medium"},
        ]
    }
