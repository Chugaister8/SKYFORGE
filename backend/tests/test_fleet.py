"""Fleet CRUD API tests."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

UAV_PAYLOAD = {
    "name":         "Test UAV Alpha",
    "callsign":     "ALPHA-1",
    "uav_class":    "TACTICAL_MULTIROTOR",
    "manufacturer": "Test Corp",
    "model":        "TX-100",
    "mass_kg":       1.2,
    "max_speed_ms":  20.0,
    "cruise_speed_ms": 15.0,
    "max_altitude_m":  400.0,
    "max_range_km":    5.0,
    "endurance_min":   30.0,
}


async def test_fleet_empty(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.get("/api/fleet/", headers=clean)
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == [] or data.get("total") == 0


async def test_create_uav(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    assert r.status_code == 201
    uav = r.json()
    assert uav["callsign"]  == "ALPHA-1"
    assert uav["name"]      == "Test UAV Alpha"
    assert uav["uav_class"] == "TACTICAL_MULTIROTOR"
    assert uav["status"]    == "OFFLINE"
    return uav["id"]


async def test_create_uav_invalid_callsign(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/fleet/", json={
        **UAV_PAYLOAD, "callsign": "has spaces!",
    }, headers=clean)
    assert r.status_code == 422


async def test_get_uav(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    uav_id = r.json()["id"]
    r2 = await client.get(f"/api/fleet/{uav_id}", headers=clean)
    assert r2.status_code == 200
    assert r2.json()["id"] == uav_id


async def test_update_uav_status(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    uav_id = r.json()["id"]
    r2 = await client.patch(f"/api/fleet/{uav_id}", json={"status": "ONLINE"}, headers=clean)
    assert r2.status_code == 200
    assert r2.json()["status"] == "ONLINE"


async def test_delete_uav(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    uav_id = r.json()["id"]
    r2 = await client.delete(f"/api/fleet/{uav_id}", headers=clean)
    assert r2.status_code == 204
    r3 = await client.get(f"/api/fleet/{uav_id}", headers=clean)
    assert r3.status_code == 404


async def test_fleet_stats(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    r = await client.get("/api/fleet/stats", headers=clean)
    assert r.status_code == 200
    data = r.json()
    assert "total"   in data
    assert "active"  in data
    assert "offline" in data
    assert data["total"] >= 1


async def test_fleet_isolation(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    """Users cannot see each other's fleet."""
    await client.post("/api/fleet/", json=UAV_PAYLOAD, headers=clean)
    r = await client.get("/api/fleet/", headers=admin_headers)
    admin_items = r.json().get("items", [])
    assert all(u["callsign"] != "ALPHA-1" for u in admin_items)


async def test_no_auth_rejected(client: AsyncClient):
    r = await client.get("/api/fleet/")
    assert r.status_code == 403
