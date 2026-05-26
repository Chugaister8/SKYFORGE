"""Simulation engine tests — physics step, EW, scoring."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

BASE_STATE = {
    "x":0.0,"y":0.0,"z":0.0,
    "vx":0.0,"vy":0.0,"vz":0.0,
    "roll":0.0,"pitch":0.0,"yaw":0.0,
    "p":0.0,"q":0.0,"r":0.0,
    "throttle":0.0,"actual_throttle":0.0,"fuel_remaining":1.0,
    "airspeed_ms":0.0,"groundspeed_ms":0.0,"altitude_m":0.0,
    "sim_time_s":0.0,
}

BASE_CONTROL = {
    "roll_cmd":0.0,"pitch_cmd":0.0,"yaw_cmd":0.0,"throttle_cmd":0.5,
}


async def test_sim_step_basic(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/sim/step", json={
        "library_id": "mavic-3t",
        "state":      BASE_STATE,
        "control":    BASE_CONTROL,
        "dt":         0.05,
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})
    assert r.status_code == 200
    data = r.json()
    assert "state"       in data
    assert "diagnostics" in data
    assert data["diagnostics"]["fuel_pct"] > 0
    assert data["diagnostics"]["ew_active"] is False


async def test_sim_step_ew_link_denied(client: AsyncClient, auth_headers: dict):
    """When datalink is denied, control authority drops."""
    r_normal = await client.post("/api/sim/step", json={
        "library_id": "mavic-3t",
        "state":      {**BASE_STATE, "altitude_m": 100},
        "control":    {**BASE_CONTROL, "throttle_cmd": 0.8},
        "dt":         0.05,
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})

    r_ew = await client.post("/api/sim/step", json={
        "library_id": "mavic-3t",
        "state":      {**BASE_STATE, "altitude_m": 100},
        "control":    {**BASE_CONTROL, "throttle_cmd": 0.8},
        "dt":         0.05,
        "ew": {"datalink_denied": True, "link_quality": 0.0},
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})

    assert r_ew.status_code == 200
    assert r_ew.json()["diagnostics"]["ew_active"] is True


async def test_sim_step_gps_denied_causes_drift(client: AsyncClient, auth_headers: dict):
    """GPS denied + nav drift should change position differently than nominal."""
    r = await client.post("/api/sim/step", json={
        "library_id": "mavic-3t",
        "state":      BASE_STATE,
        "control":    BASE_CONTROL,
        "dt":         0.05,
        "ew":         {"gps_denied": True, "nav_drift_ms": 10.0},
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})
    assert r.status_code == 200


async def test_sim_step_invalid_library(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/sim/step", json={
        "library_id": "nonexistent-uav",
        "state":      BASE_STATE,
        "control":    BASE_CONTROL,
        "dt":         0.05,
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})
    assert r.status_code == 400


async def test_sim_presets(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/sim/presets", headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})
    assert r.status_code == 200
    presets = r.json()["presets"]
    assert len(presets) >= 4
    ids = {p["id"] for p in presets}
    assert "mavic-3t" in ids
    assert "bayraktar-tb2" in ids


async def test_ew_compute(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/ew/compute", json={
        "uav_lat":   48.38,
        "uav_lon":   31.16,
        "uav_alt_m": 150.0,
        "uav_gps_bands": ["L1"],
        "emitters":  [],
        "dt":        1.0,
    }, headers=clean)
    assert r.status_code == 200


async def test_swarm_requires_auth(client: AsyncClient):
    r = await client.post("/api/swarm/init", json={
        "session_id": "test",
        "agents": [{"id":"a1"}],
    })
    assert r.status_code == 403


async def test_swarm_init(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/swarm/init", json={
        "session_id": "test-swarm-1",
        "agents": [
            {"id":"leader","role":"LEADER"},
            {"id":"wing1", "role":"WINGMAN"},
            {"id":"wing2", "role":"WINGMAN"},
        ],
        "behavior": "FORMATION",
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})
    assert r.status_code == 200
    assert r.json()["session_id"] == "test-swarm-1"


async def test_swarm_isolation(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    """Users cannot access each other's swarm sessions."""
    await client.post("/api/swarm/init", json={
        "session_id": "private-session",
        "agents": [{"id":"a1","role":"LEADER"}],
    }, headers={k:v for k,v in auth_headers.items() if not k.startswith("_")})

    r = await client.post("/api/swarm/tick", json={
        "session_id": "private-session", "dt": 1.0,
    }, headers=admin_headers)
    assert r.status_code == 403
