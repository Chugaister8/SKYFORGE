"""
Aerodynamic & propulsion calculator.
Real physics: blade element theory, momentum theory, ISA atmosphere.
"""
import math
from dataclasses import dataclass


@dataclass
class PropCalcResult:
    thrust_n:        float   # Тяга (N)
    torque_nm:       float   # Момент (Nm)
    power_w:         float   # Потужність (W)
    efficiency:      float   # КПД 0–1
    current_a:       float   # Струм (A)
    rpm_actual:      float   # Фактичні обороти


@dataclass
class FlightPerformanceResult:
    max_thrust_n:      float
    total_weight_n:    float
    thrust_to_weight:  float   # > 2.0 для хорошого FPV, > 1.5 для БПЛА
    hover_throttle_pct:float   # % дроселю в ховері
    hover_current_a:   float
    hover_power_w:     float
    max_speed_ms:      float
    endurance_min:     float
    range_km:          float
    service_ceiling_m: float


@dataclass  
class BatteryAnalysis:
    capacity_wh:        float
    usable_wh:          float   # 80% (не розряджаємо нижче 3.5V)
    hover_time_min:     float
    cruise_time_min:    float
    peak_current_a:     float
    c_rating_required:  float
    voltage_sag_v:      float
    heat_watts:         float   # I²R втрати


# ── ISA атмосфера ─────────────────────────────────────────────────

def isa_density(alt_m: float) -> float:
    """Air density kg/m³ via ISA model."""
    T0, P0, L, R, g = 288.15, 101325.0, 0.0065, 287.05, 9.80665
    if alt_m < 11000:
        T = T0 - L * alt_m
        P = P0 * (T / T0) ** (g / (R * L))
    else:
        T = 216.65
        P = 22632.1 * math.exp(-g * (alt_m - 11000) / (R * T))
    return P / (R * T)


# ── Пропелер (Blade Element + Momentum Theory) ───────────────────

def prop_thrust(
    diameter_m:  float,
    pitch_m:     float,
    rpm:         float,
    rho:         float = 1.225,
    num_blades:  int   = 2,
    cl:          float = 0.6,
    cd:          float = 0.02,
) -> PropCalcResult:
    """
    Thrust calculation using simplified BET + momentum theory.
    Returns thrust N, torque Nm, power W.
    """
    r     = diameter_m / 2.0
    omega = rpm * 2 * math.pi / 60.0
    v_tip = omega * r

    # Momentum theory advance ratio
    J = pitch_m * rpm / 60.0 / (v_tip + 1e-6)

    # Induced velocity (Froude momentum)
    disk_area = math.pi * r ** 2
    # Estimate thrust coefficient
    ct = num_blades * cl * (pitch_m / (math.pi * diameter_m)) * 0.7

    thrust_n  = ct * rho * (rpm / 60.0) ** 2 * diameter_m ** 4
    thrust_n  = max(0.0, thrust_n)

    # Torque & power
    cp        = ct * J * 0.7
    power_w   = cp * rho * (rpm / 60.0) ** 3 * diameter_m ** 5
    power_w   = max(0.1, power_w)
    torque_nm = power_w / max(omega, 0.1)

    # Efficiency = thrust power / shaft power
    v_induced = math.sqrt(max(0, thrust_n / (2 * rho * disk_area)))
    efficiency = min(0.85, thrust_n * v_induced / power_w) if power_w > 0 else 0

    return PropCalcResult(
        thrust_n   = round(thrust_n,  3),
        torque_nm  = round(torque_nm, 4),
        power_w    = round(power_w,   2),
        efficiency = round(efficiency,3),
        current_a  = 0.0,   # filled by motor calc
        rpm_actual = rpm,
    )


def motor_prop_match(
    kv:           float,   # об/хв/В
    voltage_v:    float,
    diameter_in:  float,   # дюйми
    pitch_in:     float,   # дюйми
    motor_r_ohm:  float = 0.08,
    num_blades:   int   = 2,
    altitude_m:   float = 0.0,
) -> PropCalcResult:
    """
    Motor + prop matching. Returns full operating point.
    """
    d_m  = diameter_in * 0.0254
    p_m  = pitch_in    * 0.0254
    rho  = isa_density(altitude_m)

    # No-load RPM
    rpm_nl = kv * voltage_v

    # Iterative solve: motor equilibrium
    # P_mech = I * V_back_emf = I * (V - I*R)
    # P_prop = f(rpm)
    rpm = rpm_nl * 0.85   # initial guess

    for _ in range(30):
        pc = prop_thrust(d_m, p_m, rpm, rho, num_blades)
        # Current from power
        back_emf = rpm / kv
        if back_emf >= voltage_v:
            break
        current  = (voltage_v - back_emf) / max(motor_r_ohm, 0.001)
        p_avail  = current * (voltage_v - current * motor_r_ohm)
        # Balance: adjust rpm so P_prop ≈ P_avail
        if pc.power_w > p_avail + 0.5:
            rpm *= 0.97
        elif pc.power_w < p_avail - 0.5:
            rpm *= 1.01
        else:
            break

    pc = prop_thrust(d_m, p_m, rpm, rho, num_blades)
    back_emf = rpm / kv
    current  = max(0, (voltage_v - back_emf) / max(motor_r_ohm, 0.001))
    pc.current_a  = round(current, 2)
    pc.rpm_actual = round(rpm, 0)
    return pc


# ── Повна характеристика БПЛА ────────────────────────────────────

def full_performance(
    # Конфігурація
    num_rotors:    int,
    motor_kv:      float,
    voltage_v:     float,
    prop_diam_in:  float,
    prop_pitch_in: float,
    motor_r_ohm:   float,
    # Маса
    frame_g:       float,
    battery_g:     float,
    motors_g:      float,    # загальна
    electronics_g: float,
    payload_g:     float,
    # Батарея
    battery_mah:   float,
    battery_cells: int,
    # Аеродинаміка
    cd_body:       float = 0.4,   # drag coefficient корпусу
    frontal_area:  float = 0.008, # m² (типовий квадрокоптер)
    altitude_m:    float = 0.0,
) -> FlightPerformanceResult:

    g    = 9.80665
    rho  = isa_density(altitude_m)

    # Загальна маса
    total_g = frame_g + battery_g + motors_g + electronics_g + payload_g
    total_kg = total_g / 1000.0
    weight_n = total_kg * g

    # Тяга одного ротора на 100% дроселі
    single = motor_prop_match(motor_kv, voltage_v, prop_diam_in, prop_pitch_in, motor_r_ohm, altitude_m=altitude_m)
    max_thrust = single.thrust_n * num_rotors

    t2w = max_thrust / max(weight_n, 0.01)

    # Ховер
    hover_thrust_each = weight_n / num_rotors
    # Знаходимо дросель для ховера
    hover_throttle = math.sqrt(hover_thrust_each / max(single.thrust_n, 0.01))
    hover_throttle = max(0.1, min(1.0, hover_throttle))

    # Ховерний струм (пропорційний P ∝ T^1.5)
    hover_power_each = single.power_w * (hover_throttle ** 1.5)
    hover_current_each = single.current_a * (hover_throttle ** 1.5)
    hover_power_total  = hover_power_each  * num_rotors
    hover_current_total= hover_current_each* num_rotors

    # Час ховера
    battery_wh    = (battery_mah / 1000.0) * (battery_cells * 3.7)
    usable_wh     = battery_wh * 0.80
    endurance_min = (usable_wh / max(hover_power_total, 0.1)) * 60.0

    # Макс. швидкість (баланс тяги та опору)
    # D = 0.5 * rho * v² * Cd * A
    # F_horizontal ≈ T * sin(pitch_angle), pitch ≈ 30°
    f_horiz = max_thrust * math.sin(math.radians(30)) * 0.7
    v_max   = math.sqrt(2 * f_horiz / max(rho * cd_body * frontal_area, 0.001))
    v_max   = min(v_max, 50.0)   # фізичний ліміт

    # Крейсерська дальність (60% тяги)
    cruise_power = hover_power_total * 1.2
    cruise_speed = v_max * 0.7
    range_km = (usable_wh / max(cruise_power, 0.1)) * cruise_speed * 3.6

    # Стеля (де тяга = вазі)
    ceiling_m = altitude_m
    for alt in range(int(altitude_m), 8000, 50):
        r = isa_density(alt)
        t = single.thrust_n * num_rotors * (r / rho)
        if t < weight_n:
            ceiling_m = float(alt)
            break
    else:
        ceiling_m = 8000.0

    return FlightPerformanceResult(
        max_thrust_n       = round(max_thrust, 2),
        total_weight_n     = round(weight_n,   2),
        thrust_to_weight   = round(t2w,        2),
        hover_throttle_pct = round(hover_throttle * 100, 1),
        hover_current_a    = round(hover_current_total, 2),
        hover_power_w      = round(hover_power_total,   2),
        max_speed_ms       = round(v_max,          1),
        endurance_min      = round(endurance_min,  1),
        range_km           = round(range_km,       2),
        service_ceiling_m  = round(ceiling_m,      0),
    )


def battery_analysis(
    capacity_mah:  float,
    cells:         int,
    internal_r_mohm: float,   # мОм
    hover_current_a: float,
    max_current_a:   float,
) -> BatteryAnalysis:
    nom_v   = cells * 3.7
    cap_wh  = (capacity_mah / 1000.0) * nom_v
    usable  = cap_wh * 0.80
    r_ohm   = internal_r_mohm / 1000.0

    hover_time = (usable / max(hover_current_a * nom_v / 1000, 0.001))
    cruise_c   = hover_current_a * 1.2
    cruise_time= (usable / max(cruise_c * nom_v / 1000, 0.001))

    c_req    = max_current_a / max(capacity_mah / 1000.0, 0.001)
    v_sag    = max_current_a * r_ohm
    heat     = (max_current_a ** 2) * r_ohm

    return BatteryAnalysis(
        capacity_wh       = round(cap_wh,     2),
        usable_wh         = round(usable,     2),
        hover_time_min    = round(hover_time * 60, 1),
        cruise_time_min   = round(cruise_time* 60, 1),
        peak_current_a    = round(max_current_a, 1),
        c_rating_required = round(c_req,      1),
        voltage_sag_v     = round(v_sag,      2),
        heat_watts        = round(heat,        1),
    )
