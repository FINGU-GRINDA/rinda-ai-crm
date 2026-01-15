#!/bin/sh
# Smart migration script for Drizzle ORM
# Handles both fresh databases and existing schemas

set -e

echo "[+] Checking database state..."

# Check if migration tracking table exists AND has records
MIGRATION_COUNT=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USER:-postgres}" \
  -d "${DB_NAME:-postgres}" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'" 2>/dev/null || echo "0")

MIGRATION_COUNT=$(echo $MIGRATION_COUNT | tr -d ' ')

if [ "$MIGRATION_COUNT" = "0" ]; then
  echo "[+] No migration tracking found - checking if schema exists..."

  # Check if any core tables exist
  TABLE_COUNT=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-postgres}" \
    -d "${DB_NAME:-postgres}" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('slack', 'contacts')" 2>/dev/null || echo "0")

  TABLE_COUNT=$(echo $TABLE_COUNT | tr -d ' ')

  if [ "$TABLE_COUNT" -gt "0" ]; then
    echo "[!] Existing schema detected without migration tracking"
    echo "[+] Initializing migration history from _journal.json..."
    
    # Use Bun script to safely parse JSON and initialize migration history
    bun run ./scripts/init-migration-history.ts
    
    if [ $? -eq 0 ]; then
      echo "[+] Migration history initialized - schema already in sync"
      exit 0
    else
      echo "[!] Failed to initialize migration history"
      echo "[+] Will try to run migrations normally (may fail if schema exists)"
    fi
  else
    echo "[+] Fresh database detected - will apply migrations"
  fi
fi

# Run migrations
echo "[+] Running database migrations..."
bun run db:migrate

echo "[+] Migrations completed successfully"
