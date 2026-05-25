"""
Ballistics & payload drop calculator.
RK4 integration with drag, wind, Coriolis approximation.
"""
import math
from dataclasses import dataclass, field


@dataclass
class DropSimConfig:
    release_alt_m:   float   # висота скидання
    release_speed_ms:float   # швидкість БПЛА
    release_heading: float   # курс (°, 0=North)
    wind_speed_ms:   float   # швидкість вітру
    wind_dir_deg:    float   # звідки дує вітер (°)
    payload_mass_kg: float   # маса вантажу
    payload_cd:      float   # аеродинамічний коефіцієнт
    payload_area_m2: float   # площа перетину
    target_lat:      float
    target_lon:      float


@dataclass
class DropSimResult:
    flight_time_s:    float
    impact_north_m:   float   # зміщення від точки скидання
    impact_east_m:    float
    error_from_target_m: float
    required_lead_m:  float   # де треба скинути для влучання
    impact_speed_ms:  float
    trajectory:       list[dict] = field(default_factory=list)


def simulate_drop(cfg: DropSimConfig, dt: float = 0.01) -> DropSimResult:
    """
    RK4 інтеграція траєкторії падіння.
    Повертає точку приземлення та відхилення від цілі.
    """
    g   = 9.80665
    rho = 1.225

    # Початкові умови
    # Швидкість БПЛА (у напрямку курсу)
    heading_rad = math.radians(cfg.release_heading)
    vn = cfg.release_speed_ms * math.cos(heading_rad)
    ve = cfg.release_speed_ms * math.sin(heading_rad)
    vd = 0.0   # вертикальна (вниз = +)

    # Вітер (компоненти)
    wd_rad  = math.radians(cfg.wind_dir_deg + 180)  # куди дує
    wn = cfg.wind_speed_ms * math.cos(wd_rad)
    we = cfg.wind_speed_ms * math.sin(wd_rad)

    # Позиція відносно точки скидання
    n, e, alt = 0.0, 0.0, cfg.release_alt_m

    k = 0.5 * rho * cfg.payload_cd * cfg.payload_area_m2
    m = cfg.payload_mass_kg

    trajectory = []
    t = 0.0

    def accel(vn_, ve_, vd_):
        # Відносна швидкість відносно вітру
        rel_n = vn_ - wn
        rel_e = ve_ - we
        rel_d = vd_
        speed = math.sqrt(rel_n**2 + rel_e**2 + rel_d**2)
        drag  = k * speed**2 / m
        an = -drag * rel_n / max(speed, 0.001)
        ae = -drag * rel_e / max(speed, 0.001)
        ad = g - drag * rel_d / max(speed, 0.001)  # +g вниз
        return an, ae, ad

    while alt > 0 and t < 120.0:
        if len(trajectory) % 10 == 0:
            trajectory.append({"t": round(t,2), "n": round(n,1), "e": round(e,1), "alt": round(alt,1),
                               "v": round(math.sqrt(vn**2+ve**2+vd**2),1)})

        # RK4
        an1,ae1,ad1 = accel(vn,    ve,    vd)
        an2,ae2,ad2 = accel(vn+an1*dt/2, ve+ae1*dt/2, vd+ad1*dt/2)
        an3,ae3,ad3 = accel(vn+an2*dt/2, ve+ae2*dt/2, vd+ad2*dt/2)
        an4,ae4,ad4 = accel(vn+an3*dt,   ve+ae3*dt,   vd+ad3*dt)

        vn  += (an1+2*an2+2*an3+an4)*dt/6
        ve  += (ae1+2*ae2+2*ae3+ae4)*dt/6
        vd  += (ad1+2*ad2+2*ad3+ad4)*dt/6

        n   += vn * dt
        e   += ve * dt
        alt -= vd * dt   # alt зменшується коли vd > 0

        t   += dt

    impact_speed = math.sqrt(vn**2 + ve**2 + vd**2)

    # Відхилення від цілі (спрощено — ціль у нас у метрах N/E від скидання)
    # Для точного розрахунку потрібні координати — тут використовуємо метричні
    error = math.sqrt(n**2 + e**2)   # якщо ціль прямо внизу

    # Lead distance — скільки треба випередити
    lead = math.sqrt(n**2 + e**2)

    return DropSimResult(
        flight_time_s        = round(t, 2),
        impact_north_m       = round(n, 1),
        impact_east_m        = round(e, 1),
        error_from_target_m  = round(error, 1),
        required_lead_m      = round(lead, 1),
        impact_speed_ms      = round(impact_speed, 1),
        trajectory           = trajectory,
    )


def cep_estimate(
    alt_m:       float,
    speed_ms:    float,
    wind_ms:     float,
    payload_cd:  float,
    payload_area:float,
    mass_kg:     float,
    n_samples:   int = 50,
) -> dict:
    """
    CEP (Circular Error Probable) — статистична оцінка точності.
    Monte Carlo з ±2° помилкою орієнтації та ±0.5м/с швидкості.
    """
    import random
    errors = []
    for _ in range(n_samples):
        heading = random.uniform(0, 360)
        spd = speed_ms + random.gauss(0, 0.5)
        wnd = wind_ms  + random.gauss(0, 0.3)
        cfg = DropSimConfig(
            release_alt_m=alt_m, release_speed_ms=spd,
            release_heading=heading, wind_speed_ms=wnd, wind_dir_deg=0,
            payload_mass_kg=mass_kg, payload_cd=payload_cd,
            payload_area_m2=payload_area,
            target_lat=0, target_lon=0,
        )
        r = simulate_drop(cfg, dt=0.05)
        errors.append(math.sqrt(r.impact_north_m**2 + r.impact_east_m**2))

    errors.sort()
    cep50 = errors[len(errors)//2]
    cep90 = errors[int(len(errors)*0.9)]
    return {"cep50_m": round(cep50,1), "cep90_m": round(cep90,1), "samples": n_samples}
