# ⚡ SKYFORGE

**Professional UAV Mission Simulation & Training Platform**

[![CI](https://github.com/Chugaister8/SKYFORGE/actions/workflows/ci.yml/badge.svg)](https://github.com/Chugaister8/SKYFORGE/actions/workflows/ci.yml)

---

## 🚀 Quick Start

```bash
git clone https://github.com/Chugaister8/SKYFORGE.git
cd SKYFORGE
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:8000 |
| API Docs | http://localhost:8000/api/docs |

Register at `/login` to get started.

---

## 🏗 Architecture

```
SKYFORGE/
├── frontend/          # Next.js 14 (TypeScript, Tailwind, Zustand)
├── backend/           # FastAPI (Python 3.12, SQLAlchemy 2.x)
├── nginx/             # Reverse proxy config
├── .github/workflows/ # CI + CD + Security audit
└── docker-compose*.yml
```

**Simulation Engines:** Physics (6DOF RK4) · EW (Friis J/S) · SAM (P(k)) · Weather (ISA) · Swarm · Scenarios

**Pages:** Dashboard · Missions (2D/3D) · Simulator · Fleet · Library · AAR · Training · Engineer · Multiplayer

---

## 📋 Production Deployment

See [DEPLOY.md](./DEPLOY.md) for full guide.

**Required secrets:** `SECRET_KEY`, `DOMAIN`, `POSTGRES_PASSWORD`

```bash
# One-line prod start
cp .env.example .env && nano .env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose exec backend alembic upgrade head
```

---

## 🔌 API Reference

Full Swagger: `http://localhost:8000/api/docs`

| Module | Key endpoints |
|--------|---------------|
| Auth | POST /api/auth/login, /register, /refresh · GET /me |
| Fleet | CRUD /api/fleet/ · GET /stats /telemetry |
| Missions | CRUD /api/missions/ · POST /{id}/flight-log · /{id}/aar |
| Training | GET /courses · POST /module /certify · GET /leaderboard |
| Simulation | /api/sim/ · /ew/ · /sam/ · /weather/ · /swarm/ |
| Multiplayer | REST /api/rooms/ · WS /api/rooms/{id}/ws |
| Scenarios | GET /catalog · POST /build |

---

## 📄 License

SKYFORGE — Training Use Only. Not for operational military use.
