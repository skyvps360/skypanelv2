# Docker Setup for SkyPanelV2

This directory contains Docker configuration files for running SkyPanelV2 in containerized environments.

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git repository cloned

### 1. Configure Environment

Copy the example environment file and customize it:

```bash
cp docker/.env docker/.env
# Edit docker/.env with your production values
```

**Important:** The `DATABASE_URL` should use `postgres` as the hostname to connect to the PostgreSQL container:
```
DATABASE_URL=postgresql://skypanel:skypanel@postgres:5432/skypanel
```

### 2. Start All Services

```bash
# Build and start PostgreSQL, Redis, and the application
docker-compose up -d --build

# View application logs
docker-compose logs -f app

# Check status of all services
docker-compose ps
```

### 3. Access the Application

- **Web Interface:** http://localhost:3001
- **Health Check:** http://localhost:3001/api/health
- **PostgreSQL:** localhost:5432 (user: `skypanel`, database: `skypanel`)
- **Redis:** localhost:6379

## File Structure

```
docker/
├── .env                 # Environment variables for Docker Compose
└── README.md           # This file

../docker-compose.yml   # Service definitions (postgres, redis, app)
../Dockerfile          # Application container build instructions
```

## Environment Configuration

### Required Variables

Edit `docker/.env` to set these critical values:

```bash
# Security (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
SSH_CRED_SECRET=your-32-character-encryption-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Database (matches docker-compose services)
DATABASE_URL=postgresql://skypanel:skypanel@postgres:5432/skypanel
REDIS_URL=redis://default@redis:6379

# Application
NODE_ENV=production
COMPANY_NAME=YourCompany
VITE_COMPANY_NAME=YourCompany

# Payment Processing
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # or 'live' for production

# Email (SMTP2GO example)
SMTP2GO_API_KEY=your-smtp2go-api-key
FROM_EMAIL=noreply@yourdomain.com
CONTACT_FORM_RECIPIENT=support@yourdomain.com

# VPS Provider APIs
LINODE_API_TOKEN=your-linode-token
DIGITALOCEAN_API_TOKEN=your-digitalocean-token
```

### Development vs Production

**Development:** Use the root `.env` file with external databases (Neon, Railway, etc.)
**Production:** Use `docker/.env` with the containerized PostgreSQL and Redis

## Common Commands

### Service Management

```bash
# Start all services in background
docker-compose up -d

# Rebuild and start (after code changes)
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove all data (WARNING: deletes database)
docker-compose down -v

# View logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Check service status
docker-compose ps

# Restart a specific service
docker-compose restart app
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U skypanel -d skypanel

# Create database backup
docker-compose exec postgres pg_dump -U skypanel skypanel > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U skypanel skypanel < backup.sql

# Run migrations manually
docker-compose exec app node scripts/run-migration.js

# Check database connection
docker-compose exec app node scripts/test-connection.js
```

### Container Management

```bash
# Shell into application container
docker-compose exec app sh

# Check environment variables in container
docker-compose exec app printenv | grep DATABASE

# View container resource usage
docker stats

# Remove unused Docker resources
docker system prune -a
```

## Troubleshooting

### Application Won't Start

**Check logs:**
```bash
docker-compose logs app
```

**Common issues:**
- Database connection failed → Check `DATABASE_URL` in `docker/.env`
- Port already in use → Stop other services using port 3001
- Environment variables missing → Ensure all required vars are set in `docker/.env`

### Database Connection Issues

**Verify database is running:**
```bash
docker-compose ps postgres
docker-compose logs postgres
```

**Test connection:**
```bash
docker-compose exec postgres pg_isready -U skypanel
```

**Check if app can reach database:**
```bash
docker-compose exec app ping postgres
```

### Migration Failures

**Run migrations manually:**
```bash
docker-compose exec app node scripts/run-migration.js
```

**Check migration status:**
```bash
docker-compose exec postgres psql -U skypanel -d skypanel -c "SELECT * FROM migration_history ORDER BY applied_at DESC LIMIT 5;"
```

### Performance Issues

**Monitor resource usage:**
```bash
docker stats
```

**Check container logs for errors:**
```bash
docker-compose logs --tail=100 app
```

### Reset Everything

If you need to start fresh:

```bash
# Stop and remove everything (INCLUDING DATA!)
docker-compose down -v

# Remove application image
docker rmi skypanelv2-app

# Rebuild and start
docker-compose up -d --build
```

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Change default passwords in `docker/.env`
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Set secure `SSH_CRED_SECRET` (32+ characters)
- [ ] Configure real PayPal credentials (not sandbox)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS with reverse proxy (nginx/Caddy)
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set resource limits in docker-compose.yml

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backup Strategy

Set up automated backups:

```bash
#!/bin/bash
# backup-script.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U skypanel skypanel > "backups/skypanel_${DATE}.sql"

# Keep only last 7 days of backups
find backups/ -name "skypanel_*.sql" -mtime +7 -delete
```

## Support

For issues specific to Docker setup:
1. Check this README
2. Review logs: `docker-compose logs app`
3. Verify environment variables are correct
4. Ensure Docker and Docker Compose are up to date

For application-specific issues, see the main `README.md` in the project root.