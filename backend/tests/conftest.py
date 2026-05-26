"""
Shared test fixtures.
Strategy:
  - Session-scoped engine (one SQLite file per test session)
  - Function-scoped: truncate all tables between tests
  - Fresh MockRedis per test via autouse
"""
import asyncio
import pytest
import pytest_asyncio
import os

# ── Override settings BEFORE importing app ───────────────────────
os.environ.update({
    "DATABASE_URL":    "sqlite+aiosqlite:///./test_skyforge.db",
    "REDIS_URL":       "redis://localhost:6379",
    "SECRET_KEY":      "test-secret-key-safe-for-ci-only",
    "ENVIRONMENT":     "test",
    "DEBUG":           "false",
    "ALLOWED_ORIGINS": "http://localhost:3000",
})

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine, async_sessionmaker, AsyncSession,
)
from app.core.database import Base
from main import app

# ── Session-scoped engine ─────────────────────────────────────────

_ENGINE = create_async_engine(
    "sqlite+aiosqlite:///./test_skyforge.db",
    echo=False,
)
_SESSION_FACTORY = async_sessionmaker(_ENGINE, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create tables once for entire session."""
    async with _ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup after session
    async with _ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _ENGINE.dispose()
    # Remove test db file
    try:
        os.remove("./test_skyforge.db")
    except FileNotFoundError:
        pass


@pytest_asyncio.fixture(autouse=True)
async def truncate_tables():
    """Truncate all tables BEFORE each test for isolation."""
    async with _ENGINE.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    yield


@pytest_asyncio.fixture
async def db():
    async with _SESSION_FACTORY() as session:
        yield session


# ── Mock Redis — fresh per test ───────────────────────────────────

class MockRedis:
    def __init__(self):
        self._data: dict = {}

    async def get(self, key):          return self._data.get(key)
    async def set(self, key, val, ex=None): self._data[key] = val
    async def setex(self, key, ttl, val):   self._data[key] = val
    async def delete(self, *keys):
        for k in keys: self._data.pop(k, None)
    async def incr(self, key):
        self._data[key] = int(self._data.get(key, 0)) + 1
        return self._data[key]
    async def expire(self, key, ttl):  pass
    async def ttl(self, key):          return 900
    async def ping(self):              return True
    async def keys(self, pattern="*"): return list(self._data.keys())
    async def close(self):             pass


@pytest.fixture(autouse=True)
def mock_redis(monkeypatch):
    redis = MockRedis()
    async def _get(): return redis
    monkeypatch.setattr("app.core.redis_client.get_redis",    _get)
    monkeypatch.setattr("app.core.login_limiter.get_redis",   _get)
    monkeypatch.setattr("app.core.redis_persistence.get_redis", _get)
    return redis


# ── HTTP client ───────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db):
    from app.core.database import get_db
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Auth helpers — unique user per test ──────────────────────────

@pytest_asyncio.fixture
async def auth_headers(client):
    import uuid
    uid = uuid.uuid4().hex[:8]
    r = await client.post("/api/auth/register", json={
        "username": f"pilot{uid}",
        "email":    f"pilot{uid}@test.com",
        "password": "testpass123",
        "role":     "PILOT",
    })
    assert r.status_code == 201, f"Register failed: {r.text}"
    token = r.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}", "_username": f"pilot{uid}"}


@pytest_asyncio.fixture
async def admin_headers(client):
    import uuid
    uid = uuid.uuid4().hex[:8]
    r = await client.post("/api/auth/register", json={
        "username": f"admin{uid}",
        "email":    f"admin{uid}@test.com",
        "password": "adminpass123",
        "role":     "ADMIN",
    })
    assert r.status_code == 201, f"Admin register failed: {r.text}"
    token = r.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
