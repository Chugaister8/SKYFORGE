import math, random, structlog
from app.simulation.weather.models import WeatherState, WeatherCondition, TurbulenceLevel, WindLayer, UAVWeatherEffect

logger=structlog.get_logger()

def _interp_wind(layers, alt):
    if not layers: return 0.0,0.0
    below=[l for l in layers if l.altitude_m<=alt]; above=[l for l in layers if l.altitude_m>alt]
    if not below:
        l=above[0]; s=l.speed_ms+random.gauss(0,l.gust_ms*0.3)
        return s*math.cos(math.radians(l.direction_deg)),s*math.sin(math.radians(l.direction_deg))
    if not above:
        l=below[-1]; s=l.speed_ms+random.gauss(0,l.gust_ms*0.3)
        return s*math.cos(math.radians(l.direction_deg)),s*math.sin(math.radians(l.direction_deg))
    lo=below[-1]; hi=above[0]; t=(alt-lo.altitude_m)/max(hi.altitude_m-lo.altitude_m,1)
    sl=lo.speed_ms+random.gauss(0,lo.gust_ms*0.3); sh=hi.speed_ms+random.gauss(0,hi.gust_ms*0.3); s=sl+t*(sh-sl)
    dx=(1-t)*math.cos(math.radians(lo.direction_deg))+t*math.cos(math.radians(hi.direction_deg))
    dy=(1-t)*math.sin(math.radians(lo.direction_deg))+t*math.sin(math.radians(hi.direction_deg))
    mag=math.sqrt(dx**2+dy**2) or 1.0
    return s*dx/mag, s*dy/mag

class WeatherEngine:
    UAV_LIMITS={
        "NANO":{"max_wind_ms":5,"max_rain":0,"min_vis_km":0.5},
        "MICRO_FPV":{"max_wind_ms":8,"max_rain":2,"min_vis_km":0.3},
        "STRIKE_FPV":{"max_wind_ms":10,"max_rain":5,"min_vis_km":0.3},
        "TACTICAL_MULTIROTOR":{"max_wind_ms":12,"max_rain":10,"min_vis_km":0.5},
        "TACTICAL_VTOL":{"max_wind_ms":15,"max_rain":15,"min_vis_km":1.0},
        "FIXED_WING_ISR":{"max_wind_ms":20,"max_rain":20,"min_vis_km":1.0},
        "LOITERING_MUNITION":{"max_wind_ms":15,"max_rain":10,"min_vis_km":0.5},
        "MALE":{"max_wind_ms":25,"max_rain":30,"min_vis_km":2.0},
        "HALE":{"max_wind_ms":30,"max_rain":50,"min_vis_km":5.0},
    }

    def compute_uav_effect(self,weather,uav_class,uav_alt_m,uav_heading_deg=0.0):
        effect=UAVWeatherEffect(); lim=self.UAV_LIMITS.get(uav_class,self.UAV_LIMITS["TACTICAL_MULTIROTOR"]); w=[]
        wx,wy=_interp_wind(weather.wind_layers,uav_alt_m)
        effect.wind_x_ms=wx; effect.wind_y_ms=wy; effect.wind_z_ms=random.gauss(0,0.3)
        ws=math.sqrt(wx**2+wy**2)
        r=math.radians(uav_heading_deg); effect.effective_headwind_ms=wx*math.cos(r)+wy*math.sin(r)
        effect.drag_multiplier=1.0+(ws/30.0)**2*0.5; effect.endurance_factor=max(0.3,1.0-ws/(lim["max_wind_ms"]*2))
        if ws>lim["max_wind_ms"]: w.append(f"WIND {ws:.0f}m/s EXCEEDS LIMIT {lim['max_wind_ms']}m/s"); effect.flight_recommended=False
        elif ws>lim["max_wind_ms"]*0.7: w.append(f"WIND {ws:.0f}m/s APPROACHING LIMIT")
        if weather.visibility_km<lim["min_vis_km"]:
            w.append(f"VISIBILITY {weather.visibility_km:.1f}km BELOW MINIMUM")
            effect.sensor_degradation=min(1.0,lim["min_vis_km"]/max(weather.visibility_km,0.01)-1); effect.flight_recommended=False
        if weather.condition in [WeatherCondition.FOG,WeatherCondition.RAIN]:
            effect.sensor_degradation=max(effect.sensor_degradation,min(1.0,1.0-weather.visibility_km/10.0))
        if weather.condition==WeatherCondition.RAIN:
            ra=weather.rain_mm_hr*0.01; effect.comms_degradation=min(0.8,ra*0.1); effect.gps_degradation=min(0.3,ra*0.05)
            effect.endurance_factor*=max(0.7,1.0-weather.rain_mm_hr/max(lim["max_rain"],1))
            if weather.rain_mm_hr>lim["max_rain"]: w.append(f"RAIN {weather.rain_mm_hr:.0f}mm/hr EXCEEDS LIMIT"); effect.flight_recommended=False
        in_cloud=weather.cloud_base_m<=uav_alt_m<=weather.cloud_top_m
        if in_cloud:
            effect.sensor_degradation=max(effect.sensor_degradation,0.7); effect.gps_degradation=max(effect.gps_degradation,0.15)
            if weather.icing_risk or weather.temperature_c<2:
                effect.icing_probability=min(0.9,0.3+(2-weather.temperature_c)*0.05); w.append("ICING RISK IN CLOUD")
        turb_map={TurbulenceLevel.NONE:0.0,TurbulenceLevel.LIGHT:0.1,TurbulenceLevel.MODERATE:0.35,TurbulenceLevel.SEVERE:0.7,TurbulenceLevel.EXTREME:1.0}
        effect.structural_risk=turb_map.get(weather.turbulence,0.0)
        if weather.turbulence in [TurbulenceLevel.SEVERE,TurbulenceLevel.EXTREME]:
            w.append(f"SEVERE TURBULENCE — {weather.turbulence.value}"); effect.flight_recommended=False
            if weather.turbulence==TurbulenceLevel.EXTREME: effect.abort_recommended=True
        if weather.condition==WeatherCondition.THUNDERSTORM:
            w.append("THUNDERSTORM — FLIGHT NOT RECOMMENDED")
            effect.comms_degradation=max(effect.comms_degradation,0.6); effect.gps_degradation=max(effect.gps_degradation,0.4)
            effect.structural_risk=max(effect.structural_risk,0.8); effect.flight_recommended=False; effect.abort_recommended=True
        if weather.cloud_base_m<400: effect.max_safe_altitude_m=weather.cloud_base_m*0.9
        effect.warnings=w; return effect

    def generate_scenario(self,scenario):
        WL=WindLayer; WC=WeatherCondition; TL=TurbulenceLevel
        s={
            "clear":WeatherState(condition=WC.CLEAR,temperature_c=18,pressure_hpa=1015,humidity_pct=45,visibility_km=15,cloud_base_m=3000,cloud_top_m=4000,turbulence=TL.NONE,wind_layers=[WL(0,3.0,270,1.0),WL(100,4.0,265,1.5),WL(500,6.0,260,2.0),WL(1000,8.0,255,2.5)]),
            "moderate_wind":WeatherState(condition=WC.FEW_CLOUDS,temperature_c=12,pressure_hpa=1008,humidity_pct=65,visibility_km=8,cloud_base_m=1500,cloud_top_m=3000,turbulence=TL.LIGHT,wind_layers=[WL(0,8.0,270,3.0),WL(100,10.0,265,4.0),WL(500,14.0,260,5.0)]),
            "overcast_rain":WeatherState(condition=WC.RAIN,temperature_c=8,pressure_hpa=1002,humidity_pct=90,visibility_km=3,cloud_base_m=400,cloud_top_m=2500,turbulence=TL.MODERATE,rain_mm_hr=15,wind_layers=[WL(0,6.0,180,3.0),WL(100,8.0,185,4.0)]),
            "thunderstorm":WeatherState(condition=WC.THUNDERSTORM,temperature_c=22,pressure_hpa=998,humidity_pct=95,visibility_km=1.5,cloud_base_m=300,cloud_top_m=8000,turbulence=TL.SEVERE,rain_mm_hr=40,wind_layers=[WL(0,12.0,220,8.0),WL(100,18.0,225,12.0)]),
            "fog":WeatherState(condition=WC.FOG,temperature_c=6,pressure_hpa=1018,humidity_pct=98,visibility_km=0.3,cloud_base_m=50,cloud_top_m=200,turbulence=TL.NONE,wind_layers=[WL(0,1.0,0,0.5)]),
            "winter_icing":WeatherState(condition=WC.OVERCAST,temperature_c=-2,pressure_hpa=1005,humidity_pct=85,visibility_km=4,cloud_base_m=600,cloud_top_m=2000,turbulence=TL.LIGHT,snow_cm_hr=2,icing_risk=True,wind_layers=[WL(0,5.0,315,3.0),WL(500,9.0,310,4.0)]),
        }
        return s.get(scenario,s["clear"])
