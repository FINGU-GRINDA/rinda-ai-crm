# syntax=docker/dockerfile:1.7
# =============================================================================
# Rinda CRM - Elysia Server
# Production image for Dokploy deployment
#
# The server itself handles DB readiness + migrations on boot
# (see src/db/bootstrap.ts), so this image stays a thin runtime.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS deps

WORKDIR /app

# Copy lockfile + manifest first to maximize Docker layer cache hits.
COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Runtime
# -----------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS runtime

# tini -> proper PID 1 signal handling
# curl -> used by HEALTHCHECK
RUN apk add --no-cache tini curl

WORKDIR /app

# Copy installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Application source. Keep .dockerignore in sync.
COPY package.json bun.lock ./
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

# Drop privileges. The oven/bun image ships a `bun` user (uid 1000).
RUN chown -R bun:bun /app
USER bun

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "src/index.ts"]
