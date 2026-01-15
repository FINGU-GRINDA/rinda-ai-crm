# Docker Development Environment Setup

This guide explains how to run a local PostgreSQL database using Docker Compose for development.

## Prerequisites

- Docker installed and running
- Docker Compose installed

## Quick Start

### 1. Start Local Services

```bash
# Start PostgreSQL, Redis, and management tools
bun run docker:db-up

# Or use docker compose directly
docker compose -f compose.db.yml up -d
```

### 2. Setup Database Schema

```bash
# Push schema and seed data
bun run db:setup:local
```

### 3. Start Development Server with Local DB

```bash
# Make sure to use .env.local
cp .env.local .env

# Start server
bun run dev
```

Or use the combined command:

```bash
bun run dev:local
```

## Available Scripts

### Docker Commands

- **`bun run docker:db-up`** - Start PostgreSQL, Redis, and management tools
- **`bun run docker:db-down`** - Stop containers (keeps data)
- **`bun run docker:db-logs`** - View PostgreSQL logs
- **`bun run docker:db-clean`** - Stop containers and remove volumes (deletes all data)

### Database Commands

- **`bun run db:setup:local`** - Start Docker, push schema, and seed data
- **`bun run db:push`** - Push schema to database
- **`bun run db:seed`** - Seed database with sample data
- **`bun run db:studio`** - Open Drizzle Studio

### Development

- **`bun run dev`** - Start dev server (requires database)
- **`bun run dev:local`** - Start Docker DB and dev server together

## Services

### PostgreSQL Database

- **Host:** `localhost`
- **Port:** `5432`
- **User:** `postgres`
- **Password:** `postgres`
- **Database:** `postgres`
- **Connection String:** `postgres://postgres:postgres@localhost:5432/postgres`

### Redis Cache

- **Host:** `localhost`
- **Port:** `6379`
- **Password:** `redis`
- **Connection String:** `redis://:redis@localhost:6379`

### pgAdmin (Optional)

- **URL:** <http://localhost:5050>
- **Email:** `admin@localhost.com`
- **Password:** `admin`

To connect to PostgreSQL in pgAdmin:

1. Open <http://localhost:5050>
2. Add New Server
3. General tab: Name = "Local Dev"
4. Connection tab:
   - Host: `postgres` (use container name, not localhost)
   - Port: `5432`
   - Username: `postgres`
   - Password: `postgres`

### RedisInsight (Optional)

- **URL:** <http://localhost:5540>

To connect to Redis in RedisInsight:

1. Open <http://localhost:5540>
2. Add Redis Database
3. Connection:
   - Host: `redis` (use container name) or `localhost`
   - Port: `6379`
   - Password: `redis`

## Environment Files

### `.env` (Production/Remote)
Uses remote database at `43.200.230.4`

### `.env.local` (Development)
Uses local Docker database at `localhost:5432`

**To switch between environments:**

```bash
# Use local database
cp .env.local .env

# Use remote database
git checkout .env
```

## Docker Compose Configuration

The `compose.db.yml` includes:

- **PostgreSQL 16 Alpine** - Lightweight PostgreSQL database
- **Redis 7 Alpine** - In-memory data store for caching and sessions
- **pgAdmin 4** - Web-based PostgreSQL management tool (optional)
- **RedisInsight** - Web-based Redis management tool (optional)
- **Persistent volumes** - Data persists between container restarts
- **Health checks** - Ensures services are ready before connections
- **Init script** - Runs `scripts/init-db.sql` on PostgreSQL first startup

## Data Persistence

Data is stored in Docker volumes:

- `postgres_data` - PostgreSQL database files
- `redis_data` - Redis persistence (AOF)
- `pgadmin_data` - pgAdmin settings
- `redisinsight_data` - RedisInsight settings

This means:

- ✅ Data persists when containers are stopped/started
- ✅ Data persists when containers are recreated
- ❌ All data is deleted when running `bun run docker:db-clean`

## Troubleshooting

### Port Already in Use

If ports are already in use:

```bash
# Check what's using PostgreSQL port
lsof -i :5432

# Check what's using Redis port
lsof -i :6379

# Stop any local PostgreSQL service
sudo systemctl stop postgresql
# or
brew services stop postgresql

# Stop any local Redis service
sudo systemctl stop redis
# or
brew services stop redis
```

### Database Connection Issues

```bash
# Check if container is running
docker ps

# View logs
bun run docker:db-logs

# Restart containers
bun run docker:db-down && bun run docker:db-up
```

### Reset Database Completely

```bash
# Remove all data and start fresh
bun run docker:db-clean
bun run db:setup:local
```

### Access Service CLIs

```bash
# Connect to PostgreSQL CLI
docker exec -it elysia-postgres-dev psql -U postgres -d postgres

# Connect to Redis CLI
docker exec -it elysia-redis-dev redis-cli -a redis

# Test Redis connection
docker exec -it elysia-redis-dev redis-cli -a redis ping
```

## Production vs Development

| Environment | Database | Use Case |
|-------------|----------|----------|
| **Production** | Remote (43.200.230.4) | Deployment, staging |
| **Development** | Local Docker (localhost) | Local testing, offline work |

## Best Practices

1. **Always use `.env.local` for local development**
2. **Don't commit `.env.local` to git** (already in `.gitignore`)
3. **Run `docker:db-up` before starting dev server**
4. **Use `docker:db-clean` sparingly** (deletes all data)
5. **Use `db:studio` to inspect database schema**

## Additional Notes

- The init script (`scripts/init-db.sql`) runs only on first PostgreSQL container creation
- To re-run init script, use `docker:db-clean` then `docker:db-up`
- pgAdmin and RedisInsight are optional and can be removed from `compose.db.yml` if not needed
- Redis uses AOF (Append Only File) persistence for durability
- Database backups are stored in `backups/` directory (not in Docker volume)
