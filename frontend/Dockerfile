# ── Stage 1: deps ────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args for Next.js public env vars
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_CESIUM_TOKEN=""

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CESIUM_TOKEN=$NEXT_PUBLIC_CESIUM_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

# Non-root user
RUN addgroup -g 1001 -S skyforge && adduser -S -u 1001 -G skyforge skyforge

# Copy built assets from builder
COPY --from=builder --chown=skyforge:skyforge /app/.next/standalone ./
COPY --from=builder --chown=skyforge:skyforge /app/.next/static     ./.next/static
COPY --from=builder --chown=skyforge:skyforge /app/public           ./public

USER skyforge

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
