# BASE OS
FROM node:20.10-alpine3.19 AS base
RUN apk --no-cache add curl gettext

# CODEBASE
FROM base AS codebase
WORKDIR /app
COPY . .

# DEPS
FROM codebase AS deps
RUN npm i

# DEVELOPMENT
FROM deps AS development
EXPOSE 3000
CMD npm run dev -- --host 0.0.0.0 --port 3000

# BUILDER
FROM deps AS builder
RUN npm run build

# PRODUCTION TARGET
FROM nginx:alpine AS production

# Install gettext for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx config template (will be processed by entrypoint)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy docker entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

# Entrypoint will substitute environment variables and start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]