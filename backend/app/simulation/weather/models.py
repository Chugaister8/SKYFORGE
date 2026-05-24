from dataclasses import dataclass, field
from enum import Enum
import math, random

class WeatherCondition(str, Enum):
    CLEAR="CLEAR"; FEW_CLOUDS="FEW_CLOUDS"; OVERCAST="OVERCAST"; FOG="FOG"
    RAIN="RAIN"; THUNDERSTORM="THUNDERSTORM"; SNOW="SNOW"; DUST_STORM="DUST_STORM"

class TurbulenceLevel(str, Enum):
    NONE="NONE"; LIGHT="LIGHT"; MODERATE="MODERATE"; SEVERE="SEVERE"; EXTREME="EXTREME"

@dataclass
class WindLayer:
    altitude_m:float; speed_ms:float; direction_deg:float; gust_ms:float=0.0

@dataclass
class WeatherState:
    condition:WeatherCondition=WeatherCondition.CLEAR
    temperature_c:float=15.0; pressure_hpa:float=1013.25; humidity_pct:float=60.0
    visibility_km:float=10.0; cloud_base_m:float=3000.0; cloud_top_m:float=5000.0
    wind_layers:list[WindLayer]=field(default_factory=list)
    turbulence:TurbulenceLevel=TurbulenceLevel.NONE
    icing_risk:bool=False; rain_mm_hr:float=0.0; snow_cm_hr:float=0.0

    def to_dict(self)->dict:
        return {"condition":self.condition.value,"temperature_c":self.temperature_c,
                "pressure_hpa":self.pressure_hpa,"humidity_pct":self.humidity_pct,
                "visibility_km":self.visibility_km,"cloud_base_m":self.cloud_base_m,
                "cloud_top_m":self.cloud_top_m,"turbulence":self.turbulence.value,
                "icing_risk":self.icing_risk,"rain_mm_hr":self.rain_mm_hr,"snow_cm_hr":self.snow_cm_hr,
                "wind_layers":[{"altitude_m":w.altitude_m,"speed_ms":round(w.speed_ms,2),
                    "direction_deg":round(w.direction_deg,1),"gust_ms":round(w.gust_ms,2)} for w in self.wind_layers]}

@dataclass
class UAVWeatherEffect:
    drag_multiplier:float=1.0; endurance_factor:float=1.0
    sensor_degradation:float=0.0; comms_degradation:float=0.0; gps_degradation:float=0.0
    icing_probability:float=0.0; structural_risk:float=0.0
    wind_x_ms:float=0.0; wind_y_ms:float=0.0; wind_z_ms:float=0.0
    effective_headwind_ms:float=0.0; max_safe_altitude_m:float=400.0
    flight_recommended:bool=True; abort_recommended:bool=False
    warnings:list[str]=field(default_factory=list)

    def to_dict(self)->dict:
        return {"drag_multiplier":round(self.drag_multiplier,3),"endurance_factor":round(self.endurance_factor,3),
                "sensor_degradation":round(self.sensor_degradation,3),"comms_degradation":round(self.comms_degradation,3),
                "gps_degradation":round(self.gps_degradation,3),"icing_probability":round(self.icing_probability,3),
                "structural_risk":round(self.structural_risk,3),"wind_x_ms":round(self.wind_x_ms,2),
                "wind_y_ms":round(self.wind_y_ms,2),"wind_z_ms":round(self.wind_z_ms,2),
                "effective_headwind_ms":round(self.effective_headwind_ms,2),"max_safe_altitude_m":self.max_safe_altitude_m,
                "flight_recommended":self.flight_recommended,"abort_recommended":self.abort_recommended,"warnings":self.warnings}
