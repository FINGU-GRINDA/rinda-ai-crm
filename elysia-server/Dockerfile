FROM oven/bun:1-alpine

WORKDIR /app

# Install PostgreSQL client for health checks
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package.json ./
COPY bun.lock* ./

# Install dependencies using bun
RUN bun install --frozen-lockfile || bun install

# Copy source code and configuration files
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./
# Copy migration files
COPY drizzle ./drizzle
# Copy scripts
COPY scripts ./scripts
# Copy entrypoint script
COPY entrypoint.sh ./
# Copy .env files
COPY .env* ./

# Make scripts executable
RUN chmod +x ./entrypoint.sh ./scripts/*.sh

# Expose port
EXPOSE 3001

# Use entrypoint script to run migrations before starting the app
ENTRYPOINT ["./entrypoint.sh"]