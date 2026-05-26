# SKYFORGE — Deployment Guide

## Quick Start (Development)

```bash
git clone https://github.com/Chugaister8/SKYFORGE.git
cd SKYFORGE
cp .env.example .env
docker-compose up --build
```

Access: http://localhost:3000

---

## Production Deployment

### Prerequisites
- VPS with Docker + Docker Compose
- Domain name pointing to server IP
- Port 80 + 443 open

### 1. Server setup

```bash
ssh user@your-server

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repo
git clone https://github.com/Chugaister8/SKYFORGE.git /opt/skyforge
cd /opt/skyforge
```

### 2. Environment

```bash
cp .env.example .env
nano .env

# Fill in:
# SECRET_KEY=<openssl rand -hex 32>
# DOMAIN=skyforge.yourdomain.com
# POSTGRES_PASSWORD=<strong password>
```

### 3. SSL Certificate (Let's Encrypt)

```bash
# Start nginx on port 80 first (without SSL)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx postgres redis

# Issue certificate
docker-compose run certbot certonly \
  --webroot -w /var/www/certbot \
  -d skyforge.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos --non-interactive

# Restart with SSL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### 4. Start all services

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run DB migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec backend alembic upgrade head
```

### 5. Verify

```bash
curl https://skyforge.yourdomain.com/api/health
curl https://skyforge.yourdomain.com/api/health/deep
```

---

## GitHub Actions CD

Set these secrets in **Settings → Secrets → Actions**:

| Secret | Description |
|--------|-------------|
| `DOMAIN` | Your domain (skyforge.yourdomain.com) |
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private SSH key (full content) |
| `CESIUM_TOKEN` | Cesium Ion token (optional) |

On every push to `main` → images built → deployed via SSH.

---

## Maintenance

```bash
# View logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# Run migration
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Backup DB
docker-compose exec postgres pg_dump -U skyforge skyforge > backup.sql

# SSL renewal (auto via certbot container, manual trigger)
docker-compose run certbot renew
```

---

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Shallow — always fast |
| `GET /api/health/deep` | DB + Redis connectivity check |
