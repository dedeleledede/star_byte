# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (needs both workspaces declared in root package.json)
RUN npm ci

# Copy server source and compile
COPY apps/server/ ./apps/server/
RUN npm run build -w @starbyte/server

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy workspace manifests again for production install
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Persistent data directory (mount a volume here)
RUN mkdir -p /data/uploads
VOLUME ["/data"]

EXPOSE 3001

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    DB_PATH=/data/starbyte.db \
    STARBYTE_RELEASES_DIR=/data/releases

CMD ["node", "apps/server/dist/index.js"]
