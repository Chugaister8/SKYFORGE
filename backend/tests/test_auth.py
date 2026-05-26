"""
Auth API tests — register, login, refresh, profile update.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_register_success(client: AsyncClient):
    r = await client.post("/api/auth/register", json={
        "username": "newpilot",
        "email":    "newpilot@test.com",
        "password": "securepass123",
        "role":     "PILOT",
    })
    assert r.status_code == 201
    data = r.json()
    assert "tokens" in data
    assert data["tokens"]["access_token"]
    assert data["tokens"]["refresh_token"]
    assert data["user"]["username"] == "newpilot"
    assert data["user"]["role"] == "PILOT"


async def test_register_duplicate_email(client: AsyncClient):
    payload = {"username": "dupu1", "email": "dup2@test.com", "password": "pass1234", "role": "PILOT"}
    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201
    # Same email, different username
    r = await client.post("/api/auth/register", json={**payload, "username": "dupu2"})
    assert r.status_code == 409


async def test_register_short_password(client: AsyncClient):
    r = await client.post("/api/auth/register", json={
        "username": "badpass", "email": "bp@test.com",
        "password": "short", "role": "PILOT",
    })
    assert r.status_code == 422


async def test_register_invalid_username(client: AsyncClient):
    r = await client.post("/api/auth/register", json={
        "username": "ab",        # too short
        "email": "x@test.com",
        "password": "validpass",
        "role": "PILOT",
    })
    assert r.status_code == 422


async def test_login_success(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["username"]  # just verify username exists


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "username": "logintest", "email": "lt@test.com",
        "password": "correctpass", "role": "PILOT",
    })
    r = await client.post("/api/auth/login", json={
        "username": "logintest", "password": "wrongpass",
    })
    assert r.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient):
    r = await client.post("/api/auth/login", json={
        "username": "nobody", "password": "whatever",
    })
    assert r.status_code == 401


async def test_refresh_token(client: AsyncClient):
    r = await client.post("/api/auth/register", json={
        "username": "refreshtest", "email": "rt@test.com",
        "password": "testpass123", "role": "PILOT",
    })
    assert r.status_code == 201, f"Register failed: {r.text}"
    # Register returns AuthResponse with nested tokens
    tokens = r.json().get("tokens") or r.json()
    refresh = tokens["refresh_token"]
    r2 = await client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 200, f"Refresh failed: {r2.text}"
    # Refresh returns TokenResponse (flat, no nesting)
    assert r2.json()["access_token"]
    assert r2.json()["refresh_token"]


async def test_refresh_invalid_token(client: AsyncClient):
    r = await client.post("/api/auth/refresh", json={"refresh_token": "bad.token.here"})
    assert r.status_code == 401


async def test_me_unauthorized(client: AsyncClient):
    r = await client.get("/api/auth/me")
    assert r.status_code == 403


async def test_update_profile(client: AsyncClient, auth_headers: dict):
    clean_headers = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.patch("/api/auth/profile", json={
        "full_name": "Test Pilot"
    }, headers=clean_headers)
    assert r.status_code == 200


async def test_update_password(client: AsyncClient, auth_headers: dict):
    clean_headers = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.patch("/api/auth/profile", json={
        "current_password": "testpass123",
        "new_password":     "newpass456",
    }, headers=clean_headers)
    assert r.status_code == 200

    username = auth_headers.get("_username", "testpilot")
    # Verify old password no longer works
    r2 = await client.post("/api/auth/login", json={
        "username": username, "password": "testpass123",
    })
    assert r2.status_code == 401

    # New password works
    r3 = await client.post("/api/auth/login", json={
        "username": username, "password": "newpass456",
    })
    assert r3.status_code == 200


async def test_update_password_wrong_current(client: AsyncClient, auth_headers: dict):
    clean_headers = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.patch("/api/auth/profile", json={
        "current_password": "wrongcurrent",
        "new_password":     "newpass456",
    }, headers=clean_headers)
    assert r.status_code == 400
