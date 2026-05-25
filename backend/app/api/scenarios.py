import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.simulation.scenarios.builder import BUILTIN_BUILDERS, SCENARIO_CATALOG

logger = structlog.get_logger()
router = APIRouter()


class BuildRequest(BaseModel):
    scenario_id: str
    difficulty:  str   = "MEDIUM"
    center_lat:  float = 48.3794
    center_lon:  float = 31.1656


@router.get("/catalog")
async def get_catalog(current_user: User = Depends(get_current_user)):
    return {
        "scenarios":    SCENARIO_CATALOG,
        "difficulties": ["TRAINING", "EASY", "MEDIUM", "HARD", "EXPERT"],
    }


@router.post("/build")
async def build_scenario(
    payload:      BuildRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Build a scenario and return in mission-planner-compatible format.
    The frontend can directly load this into the mission planner.
    """
    builder = BUILTIN_BUILDERS.get(payload.scenario_id)
    if not builder:
        raise HTTPException(404, f"Scenario '{payload.scenario_id}' not found")
    try:
        scenario = builder(payload.center_lat, payload.center_lon, payload.difficulty)
        s = scenario.to_dict()

        # Convert to mission-planner format
        mission_format = {
            "name":         s["name"],
            "waypoints": [
                {
                    "id":       f"wp_{i}",
                    "lat":      w["lat"],
                    "lon":      w["lon"],
                    "alt_m":    w["alt_m"],
                    "speed_ms": w["speed_ms"],
                    "action":   w.get("action", "WAYPOINT"),
                    "risk":     "SAFE",
                    "max_pk":   0.0,
                }
                for i, w in enumerate(s["waypoints"])
            ],
            "threat_sites": [
                {
                    "id":     f"site_{i}",
                    "name":   t["preset"].upper(),
                    "lat":    t["lat"],
                    "lon":    t["lon"],
                    "preset": t["preset"],
                    "alt_m":  t.get("alt_m", 0),
                }
                for i, t in enumerate(s["threats"])
                if t.get("type") == "SAM"
            ],
            "uav_rcs":      s["uav_rcs_m2"],
            "uav_speed":    s["uav_speed_ms"],
            "overall_risk": 0.0,
            # Raw scenario for reference
            "scenario": s,
        }
        return mission_format
    except Exception as ex:
        logger.error("scenario.build.error", error=str(ex))
        raise HTTPException(400, str(ex))
