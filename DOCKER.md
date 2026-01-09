# Docker Deployment Guide for RINDA CRM

## Overview

RINDA CRM uses a **2-container Docker Compose setup** with:
- **Frontend Container**: React + Vite app served by Nginx on port 80
- **Backend Container**: Express API server on port 3001
- **Database**: SQLite file persisted via Docker volume

This architecture enables:
- Independent scaling of frontend and backend
- Simple single-command deployment
- Production-ready security headers and optimizations
- Database persistence across container restarts

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- For production: 2GB+ RAM, 5GB+ disk space for images and database

## Quick Start

### 1. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and fill in your values
# Most importantly: set your GEMINI_API_KEY
nano .env
```

Required variables:
- `GEMINI_API_KEY`: Your Google Gemini API key (required for AI features)
- `NODE_ENV`: Set to `production`
- `FRONTEND_URL`: Your frontend URL (e.g., `http://localhost` or `https://yourdomain.com`)

### 2. Build and Start Containers

```bash
# Build images and start containers
docker-compose up -d --build

# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Stop on error? View specific service logs
docker-compose logs backend
docker-compose logs frontend
```

### 3. Access the Application

- **Frontend**: http://localhost (or your configured domain)
- **Backend API**: http://localhost/api (proxied through nginx)
- **Direct Backend**: http://localhost:3001 (API only)
- **Health Check**: http://localhost:3001/health

### 4. Verify Everything Works

```bash
# Check backend is running
curl http://localhost:3001/health

# Check frontend loads
curl http://localhost

# Test API call through frontend
curl http://localhost/api/config
```

## Common Tasks

### View Real-Time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Follow only errors
docker-compose logs -f backend | grep ERROR
```

### Restart Containers

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Stop Containers

```bash
# Stop running containers (data persists)
docker-compose stop

# Stop and remove containers (data persists in volumes)
docker-compose down

# Complete cleanup including volumes
docker-compose down -v  # WARNING: Deletes database!
```

### Scale Services

```bash
# Scale backend to 3 instances (with reverse proxy)
docker-compose up -d --scale backend=3

# Note: Frontend doesn't need scaling in typical setup
# Load balancing would require additional reverse proxy (not included)
```

### Access Container Shell

```bash
# Access backend container
docker-compose exec backend sh

# Access frontend container
docker-compose exec frontend sh

# Run a command in container
docker-compose exec backend node --version
```

### Backup Database

```bash
# The SQLite database is stored at ./server/crm.db
# Backup before updates
cp server/crm.db server/crm.db.backup

# Restore from backup
cp server/crm.db.backup server/crm.db
```

### Update Environment Variables

```bash
# Edit .env file
nano .env

# Restart containers to apply changes
docker-compose restart

# Or rebuild if needed
docker-compose up -d --build
```

## Troubleshooting

### Frontend Not Loading

**Problem**: Page not found or blank page

**Solutions**:
```bash
# Check if frontend container is running
docker-compose ps

# Check frontend logs
docker-compose logs frontend

# Rebuild frontend image
docker-compose build --no-cache frontend
docker-compose up -d
```

### Backend Not Responding

**Problem**: API calls failing or 502 Bad Gateway

**Solutions**:
```bash
# Check if backend container is running
docker-compose ps

# Check backend logs
docker-compose logs backend

# Verify health check
curl http://localhost:3001/health

# Check if port is in use
# On Windows
netstat -ano | findstr :3001

# Restart backend
docker-compose restart backend
```

### Database Issues

**Problem**: "Database is locked" or data loss

**Solutions**:
```bash
# Check database file exists
ls -la server/crm.db

# Stop containers
docker-compose down

# Wait a moment
sleep 2

# Start containers again
docker-compose up -d

# Check database with sqlite3
docker-compose exec backend sqlite3 /app/crm.db ".tables"
```

### Port Already in Use

**Problem**: "Port 80/3001 already in use"

**Solutions**:

On Windows PowerShell (find process using port):
```powershell
netstat -ano | findstr :80
# Or use lsof
Get-Process -Id (Get-NetTCPConnection -LocalPort 80).OwningProcess
```

On Mac/Linux:
```bash
lsof -i :80
lsof -i :3001
```

To use different ports, modify `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Use port 8080 instead of 80

  backend:
    ports:
      - "3002:3001"  # Use port 3002 instead of 3001
```

### Gemini API Key Issues

**Problem**: AI features not working, 401 errors

**Solutions**:
```bash
# Verify key is set in .env
cat .env | grep GEMINI_API_KEY

# Restart backend to reload env variables
docker-compose restart backend

# Check backend logs for API errors
docker-compose logs backend | grep -i "gemini\|api"
```

### Memory Issues

**Problem**: Out of memory errors, containers crashing

**Solutions**:

Add resource limits to `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  frontend:
    deploy:
      resources:
        limits:
          memory: 256M
```

Then restart:
```bash
docker-compose up -d
```

## Production Deployment

### Using Environment Variables from System

Instead of .env file, use Docker secrets or pass variables directly:

```bash
# On deployment server, set environment variables
export GEMINI_API_KEY=sk-xxxxx
export FRONTEND_URL=https://crm.yourdomain.com

# Start with environment variables
docker-compose up -d
```

### Enable HTTPS

Option 1: Using Traefik reverse proxy

```yaml
# Add to docker-compose.yml
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik.yml:/traefik.yml
```

Option 2: Using Nginx reverse proxy (before Docker)

```nginx
server {
    listen 443 ssl;
    server_name crm.yourdomain.com;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost;
    }
}
```

### Database Backups (Automated)

Add a backup service to `docker-compose.yml`:

```yaml
  backup:
    image: alpine:latest
    volumes:
      - ./server:/app/server
    command: |
      sh -c "while true; do
        cp /app/server/crm.db /app/server/backups/crm.db.backup-$(date +%Y%m%d-%H%M%S)
        find /app/server/backups -name 'crm.db.backup-*' -mtime +7 -delete
        sleep 86400
      done"
    restart: unless-stopped
```

### Monitoring and Logging

```bash
# View resource usage
docker stats

# View detailed logs with timestamps
docker-compose logs --timestamps -f backend

# Export logs to file
docker-compose logs > logs.txt
```

## Performance Tips

### Frontend Optimization

1. **Enable caching**: Nginx already configured with cache headers
2. **Use gzip compression**: Enabled in nginx.conf
3. **Minimize bundle size**: Already done by multi-stage build

### Backend Optimization

1. **Enable compression**: Already configured in Express
2. **Use rate limiting**: Configured in backend
3. **Monitor memory usage**: Use `docker stats`

### Database Optimization

```bash
# Inside backend container
docker-compose exec backend sqlite3 /app/crm.db "PRAGMA optimize;"

# Or create a cron job in backend
```

## Security Considerations

### Secrets Management

Never commit `.env` file:
```bash
# .env is already in .gitignore
echo ".env" >> .gitignore
```

For sensitive keys in production:
```bash
# Use Docker secrets (for Swarm)
docker secret create gemini_key -

# Or use environment variable from host
export GEMINI_API_KEY=sk-xxxxx
docker-compose up -d
```

### Network Security

```yaml
# In docker-compose.yml, containers only talk over internal network
# This is already configured
networks:
  rinda-network:
    driver: bridge
```

### Regular Updates

```bash
# Update Docker images regularly
docker-compose pull
docker-compose up -d

# Check for security vulnerabilities
docker scan rinda-backend
docker scan rinda-frontend
```

## Advanced Configuration

### Multi-Environment Setup

Create separate compose files:

```bash
# Development
docker-compose -f docker-compose.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.staging.yml up -d
```

### Custom Nginx Configuration

Edit `nginx.conf` to customize:
- Cache behavior
- Security headers
- Compression settings
- SSL/TLS configuration

### Custom Backend Configuration

Create `.env.production`:
```env
NODE_ENV=production
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=3600000
```

## Getting Help

- Check service logs: `docker-compose logs`
- Verify all containers running: `docker-compose ps`
- Test connectivity: `docker-compose exec backend curl http://frontend`
- Inspect container: `docker-compose exec backend sh`

## Cleanup

```bash
# Remove all containers and volumes (careful with database!)
docker-compose down -v

# Remove unused images
docker image prune

# Remove all stopped containers
docker container prune

# Clean up everything
docker system prune -a --volumes
```

---

**Last Updated**: 2024
**Version**: 1.0
