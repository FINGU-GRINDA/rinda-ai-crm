#!/bin/sh
set -e

echo "[+] Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to be ready
until pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; do
  echo "    Waiting for database connection..."
  sleep 2
done

echo "[+] PostgreSQL is ready!"

# Run smart migration script
# Handles both fresh databases and existing schemas intelligently
# - Fresh DB: runs migrations from scratch
# - Existing schema: marks migrations as applied without re-running
echo "[+] Running smart migration check..."
sh ./scripts/smart-migrate.sh

echo "[+] Running smart seed..."

echo "[+] Database is ready!"

# Start the application
echo "[+] Starting elysia-server..."
exec bun run start
