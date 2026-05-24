import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.weather.engine import WeatherEngine
from app.simulation.weather.models import WeatherState, WeatherCondition, TurbulenceLevel, WindLayer

logger=structlog.get_logger(); router=APIRouter(); _engine=WeatherEngine()

class WeatherEffectRequest(BaseModel):
    weather:dict; uav_class:str="TACTICAL_MULTIROTOR"; uav_alt_m:float=100.0; uav_heading_deg:float=0.0

class ScenarioRequest(BaseModel):
    scenario:str

@router.post("/effect")
async def compute_weather_effect(payload:WeatherEffectRequest, current_user:User=Depends(get_current_user)):
    try:
        w=payload.weather
        layers=[WindLayer(altitude_m=l["altitude_m"],speed_ms=l["speed_ms"],direction_deg=l["direction_deg"],gust_ms=l.get("gust_ms",0.0)) for l in w.get("wind_layers",[])]
        weather=WeatherState(condition=WeatherCondition(w.get("condition","CLEAR")),temperature_c=w.get("temperature_c",15),
            pressure_hpa=w.get("pressure_hpa",1013),humidity_pct=w.get("humidity_pct",60),visibility_km=w.get("visibility_km",10),
            cloud_base_m=w.get("cloud_base_m",3000),cloud_top_m=w.get("cloud_top_m",5000),
            turbulence=TurbulenceLevel(w.get("turbulence","NONE")),icing_risk=w.get("icing_risk",False),
            rain_mm_hr=w.get("rain_mm_hr",0),snow_cm_hr=w.get("snow_cm_hr",0),wind_layers=layers)
        effect=_engine.compute_uav_effect(weather,payload.uav_class,payload.uav_alt_m,payload.uav_heading_deg)
        return {"weather":weather.to_dict(),"effect":effect.to_dict()}
    except Exception as ex:
        logger.error("weather.error",error=str(ex)); raise HTTPException(400,str(ex))

@router.get("/scenarios")
async def list_scenarios(current_user:User=Depends(get_current_user)):
    return{"scenarios":[
        {"id":"clear","name":"Clear","condition":"CLEAR","severity":0},
        {"id":"moderate_wind","name":"Moderate Wind","condition":"FEW_CLOUDS","severity":2},
        {"id":"overcast_rain","name":"Overcast Rain","condition":"RAIN","severity":3},
        {"id":"thunderstorm","name":"Thunderstorm","condition":"THUNDERSTORM","severity":5},
        {"id":"fog","name":"Dense Fog","condition":"FOG","severity":4},
        {"id":"winter_icing","name":"Winter Icing","condition":"OVERCAST","severity":4},
    ]}

@router.post("/scenario")
async def get_scenario(payload:ScenarioRequest, current_user:User=Depends(get_current_user)):
    try: return _engine.generate_scenario(payload.scenario).to_dict()
    except Exception as ex: raise HTTPException(400,str(ex))
