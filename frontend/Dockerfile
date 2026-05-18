# syntax=docker/dockerfile:1.7
# =============================================================================
# Rinda CRM - Frontend (React + Vite)
# Production image for Dokploy deployment
#
# Build-time env (via Dokploy --build-arg):
#   VITE_API_URL   REQUIRED. Absolute URL of the Elysia API.
#                  Baked into the JS bundle; the browser calls it directly.
#                  Example: https://rinda-ai-crm-api.192.3.128.209.sslip.io
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the static bundle
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Manifest + lockfile first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Browser calls this URL directly. CORS on the backend must allow the
# frontend origin (FRONTEND_URLS on the API server).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve static assets via nginx
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl

# Drop the default site, install ours.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost/ -o /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
