# PaaS Admin Setup Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Initial Setup](#initial-setup)
3. [Database Migration](#database-migration)
4. [Swarm Initialization](#swarm-initialization)
5. [Configuration](#configuration)
6. [Adding Worker Nodes](#adding-worker-nodes)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Manager Node (Main Server)
- **OS**: Ubuntu 24.04 LTS (recommended) or Ubuntu 22.04 LTS
- **CPU**: 4+ cores
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 100GB+ SSD
- **Docker**: 24.0+ with Swarm mode
- **Node.js**: 20+
- **PostgreSQL**: 14+
- **Redis**: 6+

### Worker Nodes (Optional, for scaling)
- **OS**: Ubuntu 24.04 LTS
- **CPU**: 2+ cores per node
- **RAM**: 4GB+ per node
- **Storage**: 50GB+ SSD
- **Network**: Low latency to manager node

---

## Initial Setup

### 1. Run Database Migration

Run the PaaS migration to create all necessary tables:

```bash
npm run db:migrate
```

This creates:
- `paas_applications` - Application metadata
- `paas_deployments` - Deployment history
- `paas_worker_nodes` - Worker node registry
- `paas_environment_vars` - Environment variables
- `paas_domains` - Custom domains
- `paas_plans` - Resource plans
- `paas_settings` - Configuration storage
- And more...

### 2. Initialize Docker Swarm & Infrastructure

Run the initialization script:

```bash
npm run paas:init
```

This will:
1. ✅ Initialize Docker Swarm on the current server
2. ✅ Deploy core infrastructure services (Loki, Grafana, Traefik, Prometheus)
3. ✅ Create default PaaS settings in the database
4. ✅ Set up overlay networks for application isolation

**Expected Output:**
```
🚀 Initializing Docker Swarm for PaaS...

📦 Step 1: Initializing Docker Swarm...
✅ Swarm initialized successfully!
   Manager IP: 192.168.1.100
   Worker Token: SWMTKN-1-xxx...

📦 Step 2: Deploying infrastructure services...
✅ Infrastructure services deployed!

📦 Step 3: Configuring PaaS settings...
✅ Settings configured!

🎉 PaaS Infrastructure Initialized Successfully!
```

### 3. Verify Infrastructure

Check that all services are running:

```bash
docker ps
```

You should see:
- `grafana` - Log visualization (port 3001)
- `loki` - Log aggregation (port 3100)
- `promtail` - Log shipper
- `traefik` - Reverse proxy (ports 80, 443, 8080)
- `prometheus` - Metrics (port 9090)
- `cadvisor` - Container metrics

---

## Configuration

### Admin Dashboard Configuration

1. **Access Admin Dashboard**
   - Navigate to `/admin#paas-settings` in your SkyPanelV2 admin panel

2. **Configure Default Domain**
   ```
   Setting: default_domain
   Value: apps.yourdomain.com
   ```
   This is the domain where user apps will be accessible (e.g., `myapp.apps.yourdomain.com`)

3. **Configure Storage (Choose One)**

   **Option A: Local Storage** (Default, easier)
   ```
   storage_type: local
   local_storage_path: /var/paas/storage
   ```

   **Option B: S3 Storage** (Recommended for production)
   ```
   storage_type: s3
   s3_bucket: your-paas-builds
   s3_region: us-east-1
   s3_access_key: AKIA...
   s3_secret_key: ***
   s3_endpoint: (optional, for MinIO/B2)
   ```

4. **Configure Logging**
   ```
   loki_endpoint: http://localhost:3100
   loki_retention_days: 7
   ```

5. **Set Resource Limits** (Optional)
   ```
   max_apps_per_org: 10
   max_deployments_per_hour: 5
   ```

---

## Adding Worker Nodes

Worker nodes allow you to scale your PaaS horizontally across multiple servers.

### Method 1: Auto-Provision (Recommended)

1. **Prepare SSH Key**
   - Generate an SSH key pair on the manager node:
     ```bash
     ssh-keygen -t ed25519 -f ~/.ssh/paas_worker
     ```
   - Copy the public key to the worker node:
     ```bash
     ssh-copy-id -i ~/.ssh/paas_worker.pub root@WORKER_IP
     ```

2. **Add Worker via Admin Dashboard**
   - Go to `/admin#paas-workers`
   - Click "Add Worker Node"
   - Fill in:
     - Name: `worker-1`
     - IP Address: `192.168.1.101`
     - SSH Port: `22`
     - SSH User: `root`
     - SSH Private Key: (paste private key)
     - Auto-provision: ✅ **Enable**
   - Click "Add Worker"

3. **Monitor Progress**
   - The system will automatically:
     - SSH into the server
     - Install Docker
     - Configure firewall
     - Join the Swarm cluster
   - Status will update to "Active" when complete

### Method 2: Manual Setup

1. **Get Swarm Join Token**
   ```bash
   docker swarm join-token worker
   ```

2. **Run Setup Script on Worker Node**
   ```bash
   # On the worker node
   wget https://your-domain.com/setup-worker.sh
   chmod +x setup-worker.sh
   sudo ./setup-worker.sh SWMTKN-1-xxx 192.168.1.100
   ```

3. **Register in Admin Dashboard**
   - Go to `/admin#paas-workers`
   - Click "Add Worker Node"
   - Fill in details (no SSH key needed)
   - Auto-provision: ❌ **Disable**

---

## Monitoring

### Access Monitoring Dashboards

1. **Grafana** (Logs)
   - URL: `http://your-server:3001`
   - Username: `admin`
   - Password: `admin` (change on first login)
   - Pre-configured with Loki datasource

2. **Traefik Dashboard** (Routing)
   - URL: `http://your-server:8080`
   - View all active routes and services

3. **Prometheus** (Metrics)
   - URL: `http://your-server:9090`
   - Query container resource usage

### View Application Logs

**Via Grafana:**
```logql
{app="myapp"} |= "error"
```

**Via Admin Dashboard:**
- Go to `/admin#paas-apps`
- Click on an application
- View logs in real-time

### Monitor Resource Usage

**Admin Dashboard:**
- `/admin#paas-overview` shows:
  - Total apps running
  - CPU/RAM usage across cluster
  - Deployments today
  - Worker node health

---

## Troubleshooting

### Problem: Swarm initialization fails

**Solution:**
```bash
# Check if Docker is running
sudo systemctl status docker

# Check network connectivity
docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')
```

### Problem: Worker node won't join

**Solution:**
```bash
# On worker node, check firewall
sudo ufw status

# Ensure ports are open
sudo ufw allow 2377/tcp
sudo ufw allow 7946/tcp
sudo ufw allow 7946/udp
sudo ufw allow 4789/udp

# Try joining again
docker swarm join --token YOUR_TOKEN MANAGER_IP:2377
```

### Problem: Apps not accessible

**Solution:**
```bash
# Check Traefik is running
docker ps | grep traefik

# Check DNS resolution
nslookup myapp.apps.yourdomain.com

# Check app service
docker service ls
docker service ps paas-myapp
```

### Problem: Build fails

**Solution:**
1. Check build logs in `/admin#paas-apps > [App] > Deployments`
2. Common issues:
   - Invalid git URL
   - Missing dependencies in repository
   - Buildpack not detected (specify manually)
   - Out of disk space

### Problem: Logs not appearing in Grafana

**Solution:**
```bash
# Check Loki is running
docker ps | grep loki

# Check Promtail is shipping logs
docker logs promtail

# Verify Loki endpoint in settings
# Settings > loki_endpoint should be http://localhost:3100
```

---

## Security Best Practices

1. **Change Default Passwords**
   - Grafana: Change from `admin/admin`
   - Admin dashboard: Use strong passwords

2. **Enable HTTPS**
   - Configure Let's Encrypt in Traefik
   - Update Traefik email in `docker-compose.yaml`

3. **Firewall Rules**
   - Only expose necessary ports (80, 443)
   - Restrict admin ports (8080, 3001, 9090) to internal network

4. **SSH Key Security**
   - Use SSH keys instead of passwords
   - Restrict worker SSH access to manager IP only

5. **Resource Limits**
   - Set `max_apps_per_org` to prevent abuse
   - Configure plan CPU/RAM limits appropriately

---

## Backup & Recovery

### Backup Critical Data

1. **Database**
   ```bash
   pg_dump skypanelv2 > backup.sql
   ```

2. **Slugs/Build Artifacts**
   ```bash
   # If using local storage
   tar -czf paas-storage-backup.tar.gz /var/paas/storage

   # If using S3, artifacts are already backed up
   ```

3. **Settings**
   ```bash
   # Export from database
   psql skypanelv2 -c "COPY paas_settings TO '/tmp/paas-settings.csv' CSV HEADER"
   ```

### Recovery

1. Restore database
2. Run `npm run paas:init` to reinitialize Swarm
3. Restore slugs/build artifacts
4. Redeploy applications

---

## Performance Tuning

### Optimize Build Times

1. **Enable Buildpack Caching**
   ```
   buildpack_cache_enabled: true
   ```

2. **Use S3 with CDN**
   - Faster slug downloads on distributed workers

### Optimize Deployment

1. **Add More Workers**
   - Distribute load across multiple nodes

2. **Increase Resource Limits**
   - Give critical apps more CPU/RAM

3. **Use Horizontal Scaling**
   - Scale apps to multiple replicas for high availability

---

## Support

For issues or questions:
1. Check logs: `docker service logs paas-APPNAME`
2. Review deployment history in admin dashboard
3. Check GitHub issues: [SkyPanelV2 Issues](https://github.com/your-repo/issues)
4. Community support: [Discord/Forum]

---

**Last Updated**: 2025-11-09
**Version**: 1.0.0
