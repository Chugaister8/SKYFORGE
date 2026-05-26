"""Mission CRUD + flight log API tests."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MISSION_PAYLOAD = {
    "name": "Test Mission Alpha",
    "waypoints": [
        {"id":"wp1","lat":48.38,"lon":31.16,"alt_m":150,"speed_ms":20,
         "action":"WAYPOINT","risk":"SAFE","max_pk":0},
        {"id":"wp2","lat":48.39,"lon":31.17,"alt_m":200,"speed_ms":22,
         "action":"WAYPOINT","risk":"LOW","max_pk":0.1},
    ],
    "threat_sites": [
        {"id":"s1","name":"TOR-M1","lat":48.40,"lon":31.20,"preset":"tor-m1","alt_m":0}
    ],
    "uav_rcs":      0.1,
    "uav_speed":    25.0,
    "overall_risk": 0.15,
}


async def test_create_mission(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    assert r.status_code == 201
    m = r.json()
    assert m["name"]           == "Test Mission Alpha"
    assert len(m["waypoints"]) == 2
    assert m["status"]         == "DRAFT"


async def test_list_missions(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    r = await client.get("/api/missions/", headers=clean)
    assert r.status_code == 200
    items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
    assert len(items) >= 1


async def test_get_mission(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]
    r2 = await client.get(f"/api/missions/{mid}", headers=clean)
    assert r2.status_code == 200
    assert r2.json()["id"] == mid


async def test_update_mission(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]
    r2 = await client.patch(f"/api/missions/{mid}", json={"name":"Updated Name"}, headers=clean)
    assert r2.status_code == 200
    assert r2.json()["name"] == "Updated Name"


async def test_delete_mission(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]
    r2 = await client.delete(f"/api/missions/{mid}", headers=clean)
    assert r2.status_code == 204
    r3 = await client.get(f"/api/missions/{mid}", headers=clean)
    assert r3.status_code == 404


async def test_flight_log_append(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]

    log_payload = {
        "mission_id": mid,
        "events": [
            {"t": 0.0,  "type": "TAKEOFF",           "data": {"lat":48.38,"lon":31.16,"alt_m":0}},
            {"t": 15.5, "type": "WAYPOINT_REACHED",  "data": {"index":0,"alt_m":150,"speed_ms":20}},
            {"t": 45.2, "type": "THREAT_DETECTED",   "data": {"threat_level":"MEDIUM"}},
        ],
        "track": [
            {"t":5.0,"lat":48.380,"lon":31.160,"alt_m":50,"speed_ms":10,
             "heading_deg":45,"battery_pct":98,"ew_threat":"NONE"},
        ],
    }
    r2 = await client.post(f"/api/missions/{mid}/flight-log",
                           json=log_payload, headers=clean)
    assert r2.status_code == 200
    assert r2.json()["appended"] == 3


async def test_flight_log_get(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]
    await client.post(f"/api/missions/{mid}/flight-log", json={
        "mission_id": mid,
        "events": [{"t":0.0,"type":"TAKEOFF","data":{}}],
        "track": [],
    }, headers=clean)
    r2 = await client.get(f"/api/missions/{mid}/flight-log", headers=clean)
    assert r2.status_code == 200
    assert len(r2.json()["events"]) == 1


async def test_aar_save_and_score(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]

    # Upload flight log with scoring events
    await client.post(f"/api/missions/{mid}/flight-log", json={
        "mission_id": mid,
        "events": [
            {"t":0.0,   "type":"TAKEOFF",           "data":{}},
            {"t":15.0,  "type":"WAYPOINT_REACHED",  "data":{"index":0}},
            {"t":30.0,  "type":"WAYPOINT_REACHED",  "data":{"index":1}},
            {"t":45.0,  "type":"MISSION_COMPLETE",  "data":{}},
        ],
        "track": [],
    }, headers=clean)

    r2 = await client.post(f"/api/missions/{mid}/aar", json={
        "aar_data":   {"summary": "test"},
        "duration_s": 60.0,
        "score":      0,
    }, headers=clean)
    assert r2.status_code == 200
    assert r2.json()["score"] > 0      # server computed
    assert r2.json()["saved"] is True


async def test_mission_isolation(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/missions/", json=MISSION_PAYLOAD, headers=clean)
    mid = r.json()["id"]
    # Admin cannot access pilot's mission
    r2 = await client.get(f"/api/missions/{mid}", headers=admin_headers)
    assert r2.status_code == 404
