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
# Copy .env files
COPY .env* ./

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Expose port
EXPOSE 3001

# Run migrations and start the app
CMD sh -c 'echo "[+] Waiting for PostgreSQL to be ready..." && \
  until pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; do \
    echo "    Waiting for database connection..." && sleep 2; \
  done && \
  echo "[+] PostgreSQL is ready!" && \
  echo "[+] Running smart migration check..." && \
  sh ./scripts/smart-migrate.sh && \
  echo "[+] Database is ready!" && \
  echo "[+] Starting elysia-server..." && \
  exec bun run start'