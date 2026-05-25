import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.engineer.failures import FAILURE_LIBRARY, generate_random_failure, FailureCategory
from app.simulation.engineer.aero import (
    motor_prop_match, full_performance, battery_analysis, isa_density, prop_thrust
)
from app.simulation.engineer.ballistics import simulate_drop, cep_estimate, DropSimConfig

logger = structlog.get_logger()
router = APIRouter()


# ─── Failure endpoints (existing) ────────────────────────────────

class FailureSimRequest(BaseModel):
    uav_class: str = "TACTICAL_MULTIROTOR"
    flight_hours: float = 1.0
    has_ecm: bool = False

def _fdict(f):
    return {"id":f.id,"name":f.name,"category":f.category.value,"severity":f.severity.value,
            "description":f.description,"symptoms":f.symptoms,"procedures":f.procedures,
            "can_continue":f.can_continue,"thrust_loss":f.thrust_loss_pct,
            "control_loss":f.control_loss_pct,"sensor_loss":f.sensor_loss,"comms_loss":f.comms_loss_pct}

@router.get("/failures")
async def list_failures(category: str | None = None, current_user: User = Depends(get_current_user)):
    fl = list(FAILURE_LIBRARY.values())
    if category: fl = [f for f in fl if f.category.value == category.upper()]
    return {"failures": [_fdict(f) for f in fl], "categories": [c.value for c in FailureCategory]}

@router.post("/simulate-failure")
async def simulate_failure(payload: FailureSimRequest, current_user: User = Depends(get_current_user)):
    f = generate_random_failure(payload.uav_class, payload.flight_hours, payload.has_ecm)
    if not f: return {"failure": None, "message": "No failure — flight nominal"}
    return {"failure": {**_fdict(f), "effects": {"thrust_loss_pct": f.thrust_loss_pct,
            "control_loss_pct": f.control_loss_pct, "sensor_loss": f.sensor_loss, "comms_loss_pct": f.comms_loss_pct}}}

@router.get("/failures/{fid}")
async def get_failure(fid: str, current_user: User = Depends(get_current_user)):
    f = FAILURE_LIBRARY.get(fid)
    if not f: raise HTTPException(404, f"Failure '{fid}' not found")
    return {**_fdict(f), "probability": f.probability}


# ─── Aerodynamic Calculator ────────────────────────────────────────

class PropCalcRequest(BaseModel):
    motor_kv:       float = Field(2300, description="KV rating (RPM/V)")
    voltage_v:      float = Field(14.8, description="Battery voltage (V)")
    prop_diam_in:   float = Field(5.0,  description="Propeller diameter (inches)")
    prop_pitch_in:  float = Field(4.3,  description="Propeller pitch (inches)")
    motor_r_ohm:    float = Field(0.08, description="Motor winding resistance (Ohm)")
    num_blades:     int   = Field(2,    description="Number of blades")
    altitude_m:     float = Field(0.0,  description="Operating altitude (m)")

class FullPerformanceRequest(BaseModel):
    num_rotors:      int   = Field(4,    ge=1,  le=12)
    motor_kv:        float = Field(2300)
    voltage_v:       float = Field(14.8)
    prop_diam_in:    float = Field(5.0)
    prop_pitch_in:   float = Field(4.3)
    motor_r_ohm:     float = Field(0.08)
    frame_g:         float = Field(150)
    battery_g:       float = Field(300)
    motors_g:        float = Field(120)
    electronics_g:   float = Field(80)
    payload_g:       float = Field(0)
    battery_mah:     float = Field(2200)
    battery_cells:   int   = Field(4, ge=1, le=12)
    altitude_m:      float = Field(0.0)

class BatteryRequest(BaseModel):
    capacity_mah:      float = Field(2200)
    cells:             int   = Field(4)
    internal_r_mohm:   float = Field(15.0)
    hover_current_a:   float = Field(12.0)
    max_current_a:     float = Field(40.0)

class AtmosphereRequest(BaseModel):
    altitude_m: float = Field(0.0, ge=0, le=20000)

@router.post("/calc/prop")
async def calc_prop(payload: PropCalcRequest, current_user: User = Depends(get_current_user)):
    try:
        result = motor_prop_match(
            payload.motor_kv, payload.voltage_v,
            payload.prop_diam_in, payload.prop_pitch_in,
            payload.motor_r_ohm, payload.num_blades, payload.altitude_m,
        )
        return {
            "thrust_n":    result.thrust_n,
            "thrust_kg":   round(result.thrust_n / 9.80665, 3),
            "thrust_g":    round(result.thrust_n / 9.80665 * 1000, 0),
            "torque_nm":   result.torque_nm,
            "power_w":     result.power_w,
            "efficiency":  result.efficiency,
            "current_a":   result.current_a,
            "rpm":         result.rpm_actual,
        }
    except Exception as ex:
        raise HTTPException(400, str(ex))

@router.post("/calc/performance")
async def calc_performance(payload: FullPerformanceRequest, current_user: User = Depends(get_current_user)):
    try:
        r = full_performance(
            payload.num_rotors, payload.motor_kv, payload.voltage_v,
            payload.prop_diam_in, payload.prop_pitch_in, payload.motor_r_ohm,
            payload.frame_g, payload.battery_g, payload.motors_g,
            payload.electronics_g, payload.payload_g,
            payload.battery_mah, payload.battery_cells,
            altitude_m=payload.altitude_m,
        )
        total_g = (payload.frame_g + payload.battery_g + payload.motors_g +
                   payload.electronics_g + payload.payload_g)
        return {
            "total_mass_g":        total_g,
            "max_thrust_n":        r.max_thrust_n,
            "max_thrust_g":        round(r.max_thrust_n / 9.80665 * 1000),
            "weight_n":            r.total_weight_n,
            "thrust_to_weight":    r.thrust_to_weight,
            "t2w_rating":          "EXCELLENT" if r.thrust_to_weight>3 else "GOOD" if r.thrust_to_weight>2 else "ACCEPTABLE" if r.thrust_to_weight>1.5 else "MARGINAL",
            "hover_throttle_pct":  r.hover_throttle_pct,
            "hover_current_a":     r.hover_current_a,
            "hover_power_w":       r.hover_power_w,
            "max_speed_ms":        r.max_speed_ms,
            "max_speed_kmh":       round(r.max_speed_ms * 3.6, 1),
            "endurance_min":       r.endurance_min,
            "range_km":            r.range_km,
            "service_ceiling_m":   r.service_ceiling_m,
        }
    except Exception as ex:
        raise HTTPException(400, str(ex))

@router.post("/calc/battery")
async def calc_battery(payload: BatteryRequest, current_user: User = Depends(get_current_user)):
    try:
        r = battery_analysis(payload.capacity_mah, payload.cells,
                             payload.internal_r_mohm, payload.hover_current_a, payload.max_current_a)
        nom_v = payload.cells * 3.7
        return {
            "nominal_voltage_v":  nom_v,
            "capacity_wh":        r.capacity_wh,
            "usable_wh":          r.usable_wh,
            "hover_time_min":     r.hover_time_min,
            "cruise_time_min":    r.cruise_time_min,
            "c_rating_required":  r.c_rating_required,
            "c_rating_ok":        r.c_rating_required < 30,
            "voltage_sag_v":      r.voltage_sag_v,
            "heat_watts":         r.heat_watts,
            "risk":               "HIGH" if r.c_rating_required > 50 else "MEDIUM" if r.c_rating_required > 30 else "LOW",
        }
    except Exception as ex:
        raise HTTPException(400, str(ex))

@router.post("/calc/atmosphere")
async def calc_atmosphere(payload: AtmosphereRequest, current_user: User = Depends(get_current_user)):
    import math
    alt = payload.altitude_m
    T0, L, g, R = 288.15, 0.0065, 9.80665, 287.05
    T = T0 - L * alt if alt < 11000 else 216.65
    rho = isa_density(alt)
    P = rho * R * T
    a = math.sqrt(1.4 * R * T)   # speed of sound
    return {
        "altitude_m":    alt,
        "temperature_c": round(T - 273.15, 1),
        "pressure_hpa":  round(P / 100, 1),
        "density_kgm3":  round(rho, 4),
        "density_ratio": round(rho / 1.225, 4),
        "speed_of_sound_ms": round(a, 1),
        "thrust_factor":  round(rho / 1.225, 3),
    }


# ─── Ballistics Calculator ─────────────────────────────────────────

class DropRequest(BaseModel):
    release_alt_m:    float = Field(100.0,  ge=10,  le=5000)
    release_speed_ms: float = Field(20.0,   ge=0,   le=200)
    release_heading:  float = Field(0.0,    ge=0,   le=360)
    wind_speed_ms:    float = Field(5.0,    ge=0,   le=40)
    wind_dir_deg:     float = Field(270.0,  ge=0,   le=360)
    payload_mass_kg:  float = Field(0.5,    ge=0.01,le=50)
    payload_cd:       float = Field(0.47,   ge=0.1, le=2.0)
    payload_area_m2:  float = Field(0.005,  ge=0.001)
    include_trajectory: bool = True

class CEPRequest(BaseModel):
    alt_m:       float = Field(100.0)
    speed_ms:    float = Field(20.0)
    wind_ms:     float = Field(5.0)
    payload_cd:  float = Field(0.47)
    payload_area:float = Field(0.005)
    mass_kg:     float = Field(0.5)

@router.post("/calc/drop")
async def calc_drop(payload: DropRequest, current_user: User = Depends(get_current_user)):
    try:
        cfg = DropSimConfig(
            release_alt_m=payload.release_alt_m,
            release_speed_ms=payload.release_speed_ms,
            release_heading=payload.release_heading,
            wind_speed_ms=payload.wind_speed_ms,
            wind_dir_deg=payload.wind_dir_deg,
            payload_mass_kg=payload.payload_mass_kg,
            payload_cd=payload.payload_cd,
            payload_area_m2=payload.payload_area_m2,
            target_lat=0, target_lon=0,
        )
        r = simulate_drop(cfg)
        import math
        result = {
            "flight_time_s":       r.flight_time_s,
            "impact_north_m":      r.impact_north_m,
            "impact_east_m":       r.impact_east_m,
            "total_drift_m":       round(math.sqrt(r.impact_north_m**2 + r.impact_east_m**2), 1),
            "required_lead_m":     r.required_lead_m,
            "impact_speed_ms":     r.impact_speed_ms,
            "impact_speed_kmh":    round(r.impact_speed_ms * 3.6, 1),
        }
        if payload.include_trajectory:
            result["trajectory"] = r.trajectory
        return result
    except Exception as ex:
        raise HTTPException(400, str(ex))

@router.post("/calc/cep")
async def calc_cep(payload: CEPRequest, current_user: User = Depends(get_current_user)):
    try:
        return cep_estimate(
            payload.alt_m, payload.speed_ms, payload.wind_ms,
            payload.payload_cd, payload.payload_area, payload.mass_kg,
        )
    except Exception as ex:
        raise HTTPException(400, str(ex))
