#!/bin/bash
# Database Reset Script
# Wipes the database clean, generates migrations, and applies them

set -e

# Load environment variables
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

echo "=== Database Reset Script ==="

# Step 1: Drop all tables
echo "Step 1: Wiping database (dropping all tables)..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL ON SCHEMA public TO public;
"

# Step 2: Generate migrations
echo "Step 2: Generating migrations from schema..."
bun run db:generate

# Step 3: Apply migrations
echo "Step 3: Applying migrations..."
bun run db:migrate

echo "=== Database reset complete! ==="
