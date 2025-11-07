# SkyPanel PaaS - Complete Implementation

## Overview

SkyPanel PaaS provides Heroku-like Platform-as-a-Service capabilities, enabling customers to deploy containerized applications with automatic builds, SSL certificates, scaling, and database provisioning.

## Architecture

### Components

1. **Control Plane** (SkyPanel Backend)
   - Manages applications, plans, and nodes
   - Orchestrates deployments
   - Handles billing and wallet integration
   - Provides admin and customer APIs

2. **Worker Nodes** (PaaS Agent)
   - Execute containerized applications
   - Run Docker containers with security isolation
   - Manage Nginx reverse proxy and SSL
   - Provision and manage databases
   - Report metrics to control plane

3. **Frontend**
   - Admin interface for managing plans, runtimes, and nodes
   - Customer interface for application deployment and management

## Features Implemented

### ✅ Core Functionality
- [x] Application deployment from Git repositories
- [x] Docker container orchestration
- [x] Buildpack support (Node.js, Python, PHP, Custom Dockerfile)
- [x] Nginx reverse proxy with load balancing
- [x] Automatic SSL certificates (Let's Encrypt)
- [x] Horizontal scaling (1-10 instances per app)
- [x] Environment variable management
- [x] Database provisioning (MySQL, PostgreSQL, MongoDB, Redis)
- [x] Database backup and restore
- [x] Hourly billing with wallet integration
- [x] Application suspension on insufficient funds

### ✅ Security
- [x] Non-privileged container execution
- [x] Capability dropping (ALL dropped, essential re-added)
- [x] Network isolation per user/organization
- [x] Resource limits (CPU, Memory, PIDs, Storage)
- [x] Input validation and sanitization
- [x] Command injection prevention
- [x] Encrypted secrets (env vars, OAuth tokens, database passwords)

### ✅ Operations
- [x] Worker node registration and management
- [x] Heartbeat monitoring and health checks
- [x] Task queue system
- [x] Deployment scheduling
- [x] Container lifecycle management
- [x] Log collection (build and runtime)

### ✅ GitHub Integration
- [x] OAuth authentication
- [x] Repository listing
- [x] Branch selection
- [x] Secure token storage

## Setup Guide

### Prerequisites

- PostgreSQL 12+
- Node.js 20+
- Docker 20+ (for worker nodes)
- Nginx (for worker nodes)
- Certbot (for SSL on worker nodes)

### 1. Database Migration

Run the PaaS migration:

```bash
npm run db:migrate
```

Or manually:

```bash
node scripts/run-migration.js
```

This creates all necessary tables for PaaS functionality.

### 2. Environment Variables

Add to your `.env` file:

```env
# PaaS Configuration
CONTROL_PLANE_URL=https://your-panel-domain.com
PLATFORM_DOMAIN=apps.yourdomain.com

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-panel-domain.com/api/paas/github/callback

# SSL/Certbot
CERTBOT_EMAIL=admin@yourdomain.com

# Frontend URL (for OAuth redirect)
FRONTEND_URL=https://your-panel-domain.com
```

### 3. Admin Setup

1. **Create PaaS Plans**
   - Navigate to Admin → PaaS → Plans
   - Click "Create Plan"
   - Configure resources and pricing
   - Example plans are auto-created in migration

2. **Configure Runtimes**
   - Navigate to Admin → PaaS → Runtimes
   - Default runtimes are auto-created
   - Add custom runtimes as needed

3. **Register Worker Nodes**
   - Navigate to Admin → PaaS → Nodes
   - Click "Add Node"
   - Enter name, region, and host address
   - Copy the installation command

### 4. Worker Node Setup

On each worker node (must be Ubuntu/Debian):

```bash
# Download and run installation script
curl -fsSL https://your-panel-domain.com/api/paas/agent/install-script-raw | bash -s \
  "https://your-panel-domain.com" \
  "YOUR_REGISTRATION_TOKEN" \
  "us-east" \
  "worker-1"
```

The installation script will:
- Install Docker
- Install Node.js 20
- Install Nginx
- Install Certbot
- Download and configure the PaaS Agent
- Create systemd service
- Start the agent

### 5. Verify Installation

Check agent status:
```bash
systemctl status skypanel-agent
journalctl -u skypanel-agent -f
```

Check in admin panel:
- Node should show as "online"
- Resource metrics should be visible

## Usage

### For Customers

#### 1. Create an Application

```
1. Navigate to PaaS section
2. Click "Create Application"
3. Select:
   - Application name
   - Runtime (Node.js, Python, PHP, or Docker)
   - Plan (resource tier)
   - Region (where to deploy)
4. Click Create
```

#### 2. Configure Git Repository

**Option A: GitHub OAuth (Recommended)**
```
1. Open application settings
2. Click "Connect GitHub"
3. Authorize SkyPanel
4. Select repository and branch
5. Enable auto-deploy (optional)
```

**Option B: Manual Git URL**
```
1. Open application settings
2. Enter Git repository URL (HTTPS)
3. Enter branch name
4. Save
```

#### 3. Deploy

```
1. Open application details
2. Click "Deploy"
3. Watch build logs in real-time
4. Once complete, app is accessible via system domain
```

#### 4. Manage Environment Variables

```
1. Open application → Environment tab
2. Add key-value pairs
3. Save
4. Redeploy for changes to take effect
```

#### 5. Provision a Database

```
1. Navigate to Databases
2. Click "Create Database"
3. Select type (MySQL, PostgreSQL, MongoDB, Redis)
4. Choose plan
5. Click Create
6. Link to application for automatic connection strings
```

#### 6. Scale Application

```
1. Open application settings
2. Adjust instance count (1-10)
3. Save
4. Nginx load balancer automatically distributes traffic
```

## Architecture Details

### Container Security

Each application container runs with:
- **User**: 1000:1000 (non-root)
- **Capabilities**: ALL dropped, only essential added (NET_BIND_SERVICE, CHOWN, SETGID, SETUID)
- **Security Options**: no-new-privileges
- **Network**: Isolated per user/organization
- **Resources**: CPU and memory limits enforced
- **Process Limit**: Max 512 PIDs
- **Health Checks**: Automatic with restart policy

### Network Architecture

```
Internet
    ↓
[Nginx on Worker Node]
    ↓
[Application Containers] (isolated networks)
    ↓
[Database Containers] (same network as linked apps)
```

- Each user/org has isolated Docker network
- Containers cannot communicate across user boundaries
- Nginx provides TLS termination and load balancing
- Internal container communication via Docker DNS

### Billing Flow

1. Application starts → Billing begins
2. Every hour → Billing service runs
3. Check wallet balance → Deduct hourly rate × instance count
4. Insufficient funds → Suspend application
5. Funds added → Resume automatically
6. Application stopped → Billing stops immediately

### Task Execution Flow

```
1. User triggers action (deploy/scale/restart)
2. Control plane creates task in database
3. Agent polls for tasks every 10 seconds
4. Agent receives task and acknowledges
5. Agent executes task (Docker operations)
6. Agent reports progress/completion
7. Control plane updates application status
```

## API Reference

### Customer Endpoints

- `GET /api/paas/applications` - List applications
- `POST /api/paas/applications` - Create application
- `GET /api/paas/applications/:id` - Get application details
- `PUT /api/paas/applications/:id` - Update application
- `DELETE /api/paas/applications/:id` - Delete application
- `POST /api/paas/applications/:id/deploy` - Trigger deployment
- `POST /api/paas/applications/:id/restart` - Restart application
- `POST /api/paas/applications/:id/stop` - Stop application
- `POST /api/paas/applications/:id/start` - Start application
- `POST /api/paas/applications/:id/scale` - Scale instances
- `GET /api/paas/applications/:appId/env` - List environment variables
- `POST /api/paas/applications/:appId/env` - Add environment variable
- `PUT /api/paas/applications/:appId/env/:key` - Update variable
- `DELETE /api/paas/applications/:appId/env/:key` - Delete variable
- `GET /api/paas/databases` - List databases
- `POST /api/paas/databases` - Create database
- `GET /api/paas/databases/:id` - Get database details
- `POST /api/paas/databases/:id/backup` - Create backup
- `POST /api/paas/databases/:id/restore` - Restore from backup
- `POST /api/paas/applications/:id/databases/:dbId` - Link database

### Admin Endpoints

- `GET /api/paas/admin/plans` - List plans
- `POST /api/paas/admin/plans` - Create plan
- `PUT /api/paas/admin/plans/:id` - Update plan
- `DELETE /api/paas/admin/plans/:id` - Delete plan
- `GET /api/paas/admin/runtimes` - List runtimes
- `POST /api/paas/admin/runtimes` - Create runtime
- `GET /api/paas/admin/nodes` - List nodes
- `POST /api/paas/admin/nodes` - Register node

### GitHub Integration

- `GET /api/paas/github/authorize` - Start OAuth flow
- `GET /api/paas/github/callback` - OAuth callback
- `GET /api/paas/github/repositories` - List repositories
- `GET /api/paas/github/repositories/:owner/:repo/branches` - List branches
- `GET /api/paas/github/status` - Check connection status
- `DELETE /api/paas/github/disconnect` - Disconnect GitHub

## Troubleshooting

### Agent Not Connecting

```bash
# Check agent status
systemctl status skypanel-agent

# View logs
journalctl -u skypanel-agent -n 100

# Common issues:
# 1. CONTROL_PLANE_URL incorrect in config
# 2. Firewall blocking outbound HTTPS
# 3. Registration token expired (regenerate in admin panel)
```

### Build Failures

```bash
# Check build logs in application details
# Common issues:
# 1. Missing dependencies in package.json
# 2. Build command incorrect
# 3. Wrong Node.js version selected
# 4. Insufficient disk space on worker node
```

### SSL Certificate Failures

```bash
# Check certbot status
certbot certificates

# Verify domain points to worker node
dig your-app.apps.yourdomain.com

# Check Nginx config
nginx -t

# Manual certificate request
certbot certonly --webroot -w /var/www/certbot -d your-app.apps.yourdomain.com
```

### Application Not Accessible

```bash
# Check container status
docker ps | grep paas-

# Check Nginx config
cat /etc/nginx/sites-available/paas-yourapp.conf

# Check container logs
docker logs paas-yourapp

# Verify DNS
dig your-app.apps.yourdomain.com
```

## Performance Tuning

### Worker Node Resources

Recommended specs per capacity:
- **Small** (10-20 apps): 4 CPU, 16GB RAM, 100GB SSD
- **Medium** (20-50 apps): 8 CPU, 32GB RAM, 250GB SSD
- **Large** (50-100 apps): 16 CPU, 64GB RAM, 500GB SSD

### Database Optimization

- Use separate worker nodes for databases in production
- Regular backups (automated via cron)
- Monitor disk space on nodes with databases

### Scaling Tips

- Distribute applications across multiple regions
- Use horizontal scaling for high-traffic apps
- Monitor node resource usage in admin panel
- Add nodes before reaching 80% capacity

## Security Best Practices

1. **Use Strong Secrets**
   - Set `SSH_CRED_SECRET` to 32+ random characters
   - Rotate secrets periodically

2. **Network Isolation**
   - Run worker nodes in private network
   - Expose only Nginx ports (80, 443)
   - Use firewall rules

3. **Access Control**
   - Limit admin access
   - Use strong passwords
   - Enable 2FA (when available)

4. **Regular Updates**
   - Keep worker nodes updated
   - Update agent when new versions released
   - Monitor security advisories

5. **Monitoring**
   - Monitor node metrics
   - Set up alerts for offline nodes
   - Review failed deployments

## Future Enhancements

- Real-time log streaming via WebSocket
- Metrics dashboard with charts
- Auto-scaling based on metrics
- Multi-region load balancing
- CLI tool for deployments
- Webhook notifications
- CI/CD pipeline integration
- Scheduled tasks/cron jobs

## Support

For issues or questions:
1. Check logs: `journalctl -u skypanel-agent -f`
2. Review this documentation
3. Check admin panel for node status
4. Contact support with relevant logs

## License

Proprietary - SkyPanel
