# syntax=docker/dockerfile:1.7
# =============================================================================
# Rinda CRM - Frontend (React + Vite)
# Production image for Dokploy deployment
#
# Build-time env (via --build-arg):
#   VITE_API_URL   Optional. Set to "" (empty) to keep API calls relative so
#                  nginx proxies them via BACKEND_URL. Set to an absolute URL
#                  only if the frontend should bypass nginx and hit the API
#                  directly.
#
# Runtime env:
#   BACKEND_URL    Required. Upstream the nginx /api proxy forwards to.
#                  Example: http://elysia-server:3001
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the static bundle
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifest + lockfile first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build-time API URL. Empty by default => bundle uses relative /api paths
# which nginx then rewrites to BACKEND_URL at runtime.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve via nginx
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# gettext provides `envsubst` used by docker-entrypoint.sh.
RUN apk add --no-cache gettext curl

# Drop the default site so our template owns the config.
RUN rm /etc/nginx/conf.d/default.conf

# nginx.conf.template uses ${BACKEND_URL}; entrypoint substitutes it at boot.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/30-render-template.sh

# Static assets from the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.d/30-render-template.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost/ -o /dev/null || exit 1

# Use the official nginx entrypoint — it runs every script in
# /docker-entrypoint.d/ (including ours) before launching nginx.
CMD ["nginx", "-g", "daemon off;"]
