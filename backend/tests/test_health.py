"""System health + metrics tests."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_health_shallow(client: AsyncClient):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["uptime_s"] >= 0


async def test_health_deep(client: AsyncClient):
    r = await client.get("/api/health/deep")
    # In test env with SQLite — DB should be ok
    assert r.status_code in (200, 503)
    data = r.json()
    assert "checks" in data
    assert "database" in data["checks"]


async def test_metrics_endpoint(client: AsyncClient):
    r = await client.get("/api/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    body = r.text
    assert "skyforge_uptime_seconds" in body
    assert "skyforge_ws_connections" in body
    assert "skyforge_sim_steps" in body


async def test_library_stats(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/library/stats", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 20
    assert "categories" in data
    assert "factions"   in data


async def test_library_list(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/library/?limit=10", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["units"]) <= 10
    assert data["total"] >= 20


async def test_library_search(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/library/?search=tor", headers=auth_headers)
    assert r.status_code == 200
    units = r.json()["units"]
    assert any("tor" in u["name"].lower() or "tor" in u["id"].lower() for u in units)


async def test_scenarios_catalog(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/scenarios/catalog", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "scenarios"   in data
    assert "difficulties" in data


async def test_engineer_failures(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/engineer/failures", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "failures"   in data
    assert "categories" in data
    assert len(data["failures"]) >= 5


async def test_cert_verify_not_found(client: AsyncClient):
    r = await client.get("/api/training/verify/SKY-9999-XXXXXX")
    assert r.status_code == 404
