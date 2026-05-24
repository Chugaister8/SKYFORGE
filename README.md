# ⚡ SKYFORGE

**Professional UAV Mission Simulation & Training Platform**

> "From FPV to Strategic — Train Like You Fly, Fly Like You Win"

---

## 🚀 Quick Start

```bash
git clone https://github.com/Chugaister8/SKYFORGE.git
cd SKYFORGE
docker-compose up --build
```

| Service    | URL                              |
|------------|----------------------------------|
| Frontend   | http://localhost:3000            |
| Backend    | http://localhost:8000            |
| API Docs   | http://localhost:8000/api/docs   |

**First run:** Register at http://localhost:3000/login

---

## 🏗 Architecture

```
SKYFORGE/
├── frontend/          # Next.js 14 (App Router, TypeScript)
│   ├── src/app/       # Pages: dashboard, missions, simulator,
│   │                  #        fleet, library, aar, training, engineer
│   ├── src/components/# UI components per domain
│   └── src/lib/       # hooks, store (Zustand), API client
│
├── backend/           # FastAPI (Python 3.12)
│   ├── app/api/       # REST endpoints (14 routers)
│   ├── app/simulation/# Simulation engines
│   │   ├── physics/   # 6DOF flight model (RK4)
│   │   ├── ew/        # Electronic Warfare (Friis J/S model)
│   │   ├── sam/       # SAM engagement (radar eq., P(k))
│   │   ├── weather/   # ISA atmosphere, wind layers
│   │   ├── swarm/     # Multi-UAV coordination
│   │   ├── scenarios/ # Scenario builder
│   │   └── engineer/  # Failure simulation library
│   ├── app/models/    # SQLAlchemy models
│   ├── app/library/   # Unit data (JSON + Pydantic)
│   └── main.py        # FastAPI app + lifespan
│
└── docker-compose.yml # PostgreSQL + Redis + Backend + Frontend
```

---

## 🛩 Features

### Mission Planner
- Leaflet 2D tactical map + Cesium 3D globe
- Waypoint editor (alt / speed / action)
- SAM threat zones overlay (search + missile rings)
- Route threat analysis → per-waypoint P(k) score
- Mission save/load from PostgreSQL

### 3D Flight Simulator
- Three.js scene: terrain, UAV mesh, fog, lighting
- **FPV** / **Third-person** / **Map** camera modes
- Keyboard controls (WASD + arrows, 20Hz loop)
- Physics: 6DOF RK4 multirotor + fixed-wing with lift/drag
- Wind / turbulence environment

### Electronic Warfare Engine
- GPS jamming model (Friis path-loss, J/S ratio)
- GPS spoofing (coordinate injection)
- Datalink jamming (frequency matching, BER degradation)
- INS drift accumulation
- 4 builtin EW scenarios (Pole-21, Krasukha-4, Leer-3, Spoofer)
- Visual EW effects in simulator (CSS filters)

### SAM Engine
- Radar detection: SNR-based P(d) with sigmoid
- Kill probability P(k): range × RCS × speed × ECM factors
- Engagement loop: detect → track → lock → fire → reload
- Presets: Tor-M1, Buk-M2, ZU-23-2, MANPADS
- Mission threat analysis per waypoint

### Weather Engine
- ISA atmosphere model (air density by altitude)
- Wind layer interpolation (vector, by altitude)
- Per-UAV-class operational limits
- Sensor / comms / GPS degradation models
- Icing risk, turbulence structural risk
- 6 scenarios: clear, moderate wind, rain, thunderstorm, fog, winter icing

### Swarm Engine
- Formation patterns: wedge, line, diamond, spread
- Behaviors: FORMATION / CONVERGE / ORBIT / SCATTER / RTB
- Collision avoidance (repulsion)
- Auto-scatter on threat / auto-converge on target
- Session-based API

### Unit Library (25 entries)
| Category | Count | Examples |
|----------|-------|---------|
| UAV Friendly | 5 | Bayraktar TB2, Leleka-100, Mavic 3T, UJ-22 |
| UAV Hostile | 6 | Shahed-136, Lancet-3, Orlan-10, KUB-BLA |
| Air Defense | 6 | Tor-M1, Buk-M2, ZU-23-2, Igla-S, Stinger |
| EW Systems | 2 | Krasukha-4, Pole-21 |
| Ground Vehicles | 6 | T-72B3, BMP-2, BM-21, M777, Gepard |

### Training Platform
- 6 structured courses (PILOT / ENGINEER / COMMANDER)
- Module types: theory / simulator / quiz / practical
- Progress tracking per module
- Certificate issuance (unique number, grade A–S, 2yr expiry)
- Leaderboard (top-20 by score)

### After Action Review
- Mission replay with EW-colored flight track
- Chronological event timeline
- Score card (grade S/A/B/C/F)
- AI debrief (strengths / improvements / recommendations)

### Engineer Mode
- 10 failure scenarios (motor, ESC, battery, GPS, compass, RC, video, airspeed, structural)
- Failure simulator (weighted random by flight hours)
- Emergency procedures per failure
- Category filter

---

## 🔌 API Reference

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/register, /login, GET /me |
| Fleet | GET/POST/PATCH/DELETE /api/fleet/ |
| Library | GET /api/library/, /api/library/{id} |
| Simulation | POST /api/sim/step, GET /api/sim/presets |
| EW | POST /api/ew/compute, /api/ew/scenario/emitters |
| SAM | POST /api/sam/tick, /api/sam/mission-threat |
| Weather | POST /api/weather/effect, /api/weather/scenario |
| Missions | GET/POST/PATCH/DELETE /api/missions/ |
| Swarm | POST /api/swarm/init, /tick, /command |
| Training | GET /api/training/courses, POST /certify |
| Scenarios | GET /api/scenarios/catalog, POST /build |
| Engineer | GET /api/engineer/failures, POST /simulate-failure |
| WebSocket | WS /ws/telemetry?token={jwt} |

Full Swagger docs: **http://localhost:8000/api/docs**

---

## 🐳 Docker Services

```yaml
services:
  frontend:   Next.js 14  → :3000
  backend:    FastAPI      → :8000
  postgres:   PostgreSQL 16→ :5432
  redis:      Redis 7      → :6379
```

Environment variables (backend):
```
DATABASE_URL=postgresql+asyncpg://skyforge:skyforge@postgres:5432/skyforge
REDIS_URL=redis://redis:6379
SECRET_KEY=change-in-production
ENVIRONMENT=development
```

---

## 🔒 Self-hosted Deployment

```bash
# Production override
cat > docker-compose.prod.yml << 'PROD'
version: '3.9'
services:
  backend:
    environment:
      - SECRET_KEY=your-secret-key-here
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/skyforge
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://your-domain.com
      - NEXT_PUBLIC_WS_URL=wss://your-domain.com
PROD

docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 📋 Tech Stack

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, Zustand, TanStack Query, Three.js, Leaflet

**Backend:** FastAPI, Python 3.12, SQLAlchemy 2.x, Pydantic v2, asyncpg, Redis, NumPy

**Infrastructure:** Docker Compose, PostgreSQL 16, Redis 7

---

## 📄 License

SKYFORGE — Training Use Only. Not for operational military use.

© 2024 SKYFORGE Project
