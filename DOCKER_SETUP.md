# Docker Setup Guide for SkyPanelV2

## Overview
The fixes applied ensure that when running in Docker, the application uses environment variables from `docker/.env` and `docker-compose.yml` instead of loading the root `.env` file (which contains development/Railway database URLs).

## Changes Made

### 1. Conditional dotenv Loading
Modified files to only load `.env` files when NOT running in Docker:
- `api/lib/database.ts` - Skips `dotenv.config()` if `IN_DOCKER=true`
- `api/app.ts` - Skips `dotenv.config()` if `IN_DOCKER=true`

### 2. Docker Environment Flag
- `Dockerfile` - Sets `ENV IN_DOCKER=true`
- `docker-compose.yml` - Passes `IN_DOCKER: "true"` to the container

This ensures Docker containers use only the environment variables passed via docker-compose, not the root `.env` file.

---

## Using Docker Compose (Recommended)

### Step 1: Configure docker/.env
Ensure `docker/.env` has the correct database connection for the postgres container:

```bash
# Database connection (matches postgres service in docker-compose.yml)
DATABASE_URL=postgresql://skypanel:skypanel@postgres:5432/skypanel
POSTGRES_DB=skypanel
POSTGRES_USER=skypanel
POSTGRES_PASSWORD=skypanel
```

**Important:** The hostname `postgres` matches the service name in `docker-compose.yml`. This works because Docker Compose creates a network where services can reach each other by name.

### Step 2: Build and Start Services
```bash
# Build the Docker image
docker-compose build

# Start all services (postgres, redis, app)
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Step 3: Verify Everything is Running
```bash
# Check service status
docker-compose ps

# Test database connection
docker-compose exec postgres psql -U skypanel -d skypanel -c "SELECT version();"

# Check application health
curl http://localhost:3001/api/health
```

### Step 4: Stop Services
```bash
# Stop containers (preserves data in volumes)
docker-compose down

# Stop and remove volumes (deletes database data)
docker-compose down -v
```

---

## Using Docker Run (Manual Setup)

If you prefer `docker run` instead of `docker-compose`, you need to:

### Step 1: Create a Docker Network
```bash
docker network create skypanel-network
```

### Step 2: Start PostgreSQL Container
```bash
docker run -d \
  --name skypanelv2-postgres \
  --network skypanel-network \
  -e POSTGRES_DB=skypanel \
  -e POSTGRES_USER=skypanel \
  -e POSTGRES_PASSWORD=skypanel \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:16
```

### Step 3: Start Redis Container
```bash
docker run -d \
  --name skypanelv2-redis \
  --network skypanel-network \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine redis-server --save "" --appendonly no
```

### Step 4: Build Application Image
```bash
docker build -t skypanelv2-app .
```

### Step 5: Run Application Container
```bash
docker run -d \
  --name skypanelv2-app \
  --network skypanel-network \
  --env-file ./docker/.env \
  -p 3001:3001 \
  skypanelv2-app
```

**Note:** The `--network` flag is critical! Without it, your app container can't reach the postgres container using the hostname `postgres`.

---

## Troubleshooting

### Issue: "Connection refused" to postgres
**Cause:** App container can't reach postgres container

**Solutions:**
- **Using docker-compose:** Make sure both services are in the `docker-compose.yml` and you're using `docker-compose up`
- **Using docker run:** Ensure all containers are on the same Docker network (`--network skypanel-network`)

### Issue: "database does not exist"
**Cause:** Database hasn't been created or migrations haven't run

**Solution:**
```bash
# Check if database exists
docker-compose exec postgres psql -U skypanel -l

# Manually run migrations
docker-compose exec app node scripts/run-migration.js
```

### Issue: App still connecting to Railway/Neon database
**Cause:** The root `.env` file is being loaded instead of docker environment variables

**Solution:** This should be fixed by the changes made. Verify:
```bash
# Check which DATABASE_URL the container sees
docker-compose exec app printenv DATABASE_URL

# Should output: postgresql://skypanel:skypanel@postgres:5432/skypanel
```

### Issue: Changes to docker/.env not taking effect
**Solution:** Restart the containers to pick up new environment variables:
```bash
docker-compose down
docker-compose up -d
```

### Issue: Port already in use
**Solution:**
```bash
# Check what's using the port
netstat -ano | findstr :3001    # Windows
lsof -i :3001                   # Linux/Mac

# Kill the process or change the port in docker/.env
```

---

## Development Workflow

### For Local Development (without Docker)
```bash
# Uses root .env with Railway/Neon database
npm run dev
```

### For Docker Development
```bash
# 1. Update docker/.env with your settings
# 2. Build and start
docker-compose up --build

# 3. Watch logs
docker-compose logs -f app

# 4. Make code changes, rebuild
docker-compose build app
docker-compose up -d app
```

### Database Management in Docker
```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U skypanel -d skypanel

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d

# Backup database
docker-compose exec postgres pg_dump -U skypanel skypanel > backup.sql

# Restore database
docker-compose exec -T postgres psql -U skypanel skypanel < backup.sql
```

---

## Quick Reference

### Docker Compose Commands
```bash
docker-compose build              # Build images
docker-compose up -d              # Start in background
docker-compose down               # Stop containers
docker-compose down -v            # Stop and remove volumes
docker-compose logs -f app        # Follow app logs
docker-compose ps                 # Show running containers
docker-compose exec app sh        # Shell into app container
docker-compose restart app        # Restart app service
```

### Docker Network Commands
```bash
docker network ls                 # List networks
docker network inspect skypanel-network  # Inspect network
docker network create skypanel-network   # Create network
```

### Environment Variable Priority
1. **Docker Compose:** Variables in `docker-compose.yml` override `docker/.env`
2. **Docker Run:** Variables from `--env-file` override image defaults
3. **Dockerfile:** `ENV` statements in Dockerfile
4. **.env files NOT loaded** when `IN_DOCKER=true` (our fix)

---

## Production Deployment

For production, ensure:
1. ✅ Update `JWT_SECRET` in `docker/.env` to a strong secret
2. ✅ Update `SSH_CRED_SECRET` to 32+ character secret
3. ✅ Set `NODE_ENV=production`
4. ✅ Configure real PayPal credentials
5. ✅ Use managed PostgreSQL (or secure the Docker postgres container)
6. ✅ Set up SSL/TLS certificates (nginx/caddy reverse proxy)
7. ✅ Configure backups for postgres and redis volumes
8. ✅ Set `TRUST_PROXY` correctly for your infrastructure

```bash
# Production start with docker-compose
docker-compose -f docker-compose.yml up -d

# Monitor in production
docker-compose logs -f --tail=100 app
```
