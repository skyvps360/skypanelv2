# Design Document

## Overview

The PaaS integration extends SkyPanelV2 with Heroku-like application hosting capabilities using a control-plane/worker-node architecture. The existing SkyPanelV2 application serves as the control plane, managing deployments, billing, and orchestration. Worker nodes run a lightweight PaaS Agent that executes containerized workloads. This design leverages Docker for container isolation, Git for source code management, and the existing prepaid wallet system for hourly billing.

### Architecture Goals

- **Minimal infrastructure complexity**: Use Docker containers instead of full orchestration platforms
- **Tight billing integration**: Extend existing hourly billing to PaaS resources
- **Security through isolation**: Container-level separation with non-privileged execution
- **Scalable capacity**: Add worker nodes to increase hosting capacity across regions
- **Developer-friendly UX**: Git-based deployments with automated builds and SSL

### Key Design Decisions

1. **Container-based isolation**: Each application runs in its own Docker container with resource limits, providing strong isolation without per-app VMs
2. **Custom control plane**: Build orchestration into SkyPanelV2 rather than adopting Kubernetes, keeping complexity low and billing logic tight
3. **Agent-based workers**: Lightweight agents on worker nodes communicate with the control plane via secure WebSocket connections
4. **Buildpack + Dockerfile support**: Automatic runtime detection for common languages, with custom Docker support for advanced users
5. **Single-node app instances**: Initially deploy all instances of an app on the same worker node to simplify networking


## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     SkyPanelV2 Control Plane                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Admin UI   │  │  Customer UI │  │  PaaS API    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Scheduler & Orchestration Service            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket / HTTPS
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  Worker Node 1 │  │  Worker Node 2 │  │  Worker Node N │
│  (US-East)     │  │  (EU-West)     │  │  (Asia)        │
├────────────────┤  ├────────────────┤  ├────────────────┤
│  PaaS Agent    │  │  PaaS Agent    │  │  PaaS Agent    │
│  Docker Engine │  │  Docker Engine │  │  Docker Engine │
│  Nginx/Traefik │  │  Nginx/Traefik │  │  Nginx/Traefik │
├────────────────┤  ├────────────────┤  ├────────────────┤
│ ┌────┐ ┌────┐ │  │ ┌────┐ ┌────┐ │  │ ┌────┐ ┌────┐ │
│ │App1│ │App2│ │  │ │App3│ │DB1 │ │  │ │App4│ │DB2 │ │
│ └────┘ └────┘ │  │ └────┘ └────┘ │  │ └────┘ └────┘ │
└────────────────┘  └────────────────┘  └────────────────┘
```

### Control Plane Responsibilities

- **Plan Management**: Store and manage App Hosting Plans, runtime configurations, and pricing
- **Node Registry**: Track worker nodes, health status, capacity, and regional assignments
- **Deployment Orchestration**: Schedule deployments to appropriate worker nodes based on region and capacity
- **Build Coordination**: Trigger builds on worker nodes and monitor progress
- **Billing Integration**: Track resource usage and deduct hourly charges from prepaid wallets
- **Domain Management**: Assign system domains and manage SSL certificate provisioning
- **User Interface**: Provide admin and customer portals for PaaS management

### Worker Node Responsibilities

- **Agent Service**: Maintain persistent connection to control plane and execute deployment tasks
- **Container Runtime**: Run Docker containers with resource limits and isolation
- **Build Execution**: Clone Git repositories, run buildpacks or Docker builds, create images
- **Ingress Routing**: Route HTTP/HTTPS traffic to appropriate containers via Nginx/Traefik
- **SSL Management**: Request and renew Let's Encrypt certificates for applications
- **Metrics Collection**: Report CPU, memory, disk usage, and container counts to control plane
- **Log Streaming**: Send build logs and application logs to control plane

### Communication Protocol

Worker nodes communicate with the control plane via:

1. **WebSocket Connection**: Persistent bidirectional channel for real-time commands and status updates
2. **Authentication**: JWT tokens issued during node registration, refreshed periodically
3. **Heartbeat Messages**: Every 30 seconds, agents send health metrics (CPU, RAM, disk, container count)
4. **Task Queue**: Control plane sends deployment/management tasks; agent acknowledges and reports results
5. **Log Streaming**: Agents stream build and runtime logs back to control plane for customer viewing


## Components and Interfaces

### Database Schema Extensions

#### `paas_plans` Table
```sql
CREATE TABLE paas_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  cpu_limit INTEGER NOT NULL,        -- CPU cores (millicores, e.g., 1000 = 1 core)
  memory_limit INTEGER NOT NULL,     -- RAM in MB
  storage_limit INTEGER NOT NULL,    -- Disk in MB
  monthly_price DECIMAL(10,2) NOT NULL,
  hourly_rate DECIMAL(10,4) NOT NULL,
  supported_runtimes JSONB,          -- Array of runtime IDs
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_runtimes` Table
```sql
CREATE TABLE paas_runtimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,         -- e.g., "Node.js 18", "Python 3.11"
  runtime_type VARCHAR(20) NOT NULL, -- node, python, php, docker
  version VARCHAR(20) NOT NULL,
  base_image VARCHAR(200) NOT NULL,  -- Docker image reference
  default_build_cmd TEXT,
  default_start_cmd TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_nodes` Table
```sql
CREATE TABLE paas_nodes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  host_address VARCHAR(255) NOT NULL,
  registration_token VARCHAR(255) UNIQUE,
  jwt_secret VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, online, offline, disabled
  cpu_total INTEGER,
  memory_total INTEGER,
  disk_total INTEGER,
  cpu_used INTEGER DEFAULT 0,
  memory_used INTEGER DEFAULT 0,
  disk_used INTEGER DEFAULT 0,
  container_count INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_applications` Table
```sql
CREATE TABLE paas_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-safe name
  runtime_id INTEGER REFERENCES paas_runtimes(id),
  plan_id INTEGER REFERENCES paas_plans(id),
  node_id INTEGER REFERENCES paas_nodes(id),
  region VARCHAR(50) NOT NULL,
  
  -- Git configuration
  git_repo_url TEXT,
  git_branch VARCHAR(100) DEFAULT 'main',
  git_oauth_token TEXT,                -- Encrypted
  auto_deploy BOOLEAN DEFAULT false,
  
  -- Deployment state
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, running, stopped, failed
  current_build_id INTEGER,
  instance_count INTEGER DEFAULT 1,
  
  -- Domain configuration
  system_domain VARCHAR(255) UNIQUE,
  custom_domains JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_builds` Table
```sql
CREATE TABLE paas_builds (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  build_number INTEGER NOT NULL,
  git_commit_sha VARCHAR(40),
  git_commit_message TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, success, failed
  build_log TEXT,
  image_tag VARCHAR(255),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_environment_vars` Table
```sql
CREATE TABLE paas_environment_vars (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,                 -- Encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id, key)
);
```

#### `paas_databases` Table
```sql
CREATE TABLE paas_databases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  db_type VARCHAR(20) NOT NULL,        -- mysql, postgresql, redis, mongodb
  version VARCHAR(20) NOT NULL,
  plan_id INTEGER REFERENCES paas_plans(id),
  node_id INTEGER REFERENCES paas_nodes(id),
  
  -- Connection details
  host VARCHAR(255),
  port INTEGER,
  username VARCHAR(100),
  password TEXT,                        -- Encrypted
  database_name VARCHAR(100),
  
  -- State
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, stopped, failed
  container_id VARCHAR(255),
  volume_path VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `paas_app_databases` Table (Link table)
```sql
CREATE TABLE paas_app_databases (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  database_id INTEGER REFERENCES paas_databases(id) ON DELETE CASCADE,
  env_var_prefix VARCHAR(50) DEFAULT 'DATABASE',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id, database_id)
);
```

#### `paas_billing_records` Table
```sql
CREATE TABLE paas_billing_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL,  -- application, database
  resource_id INTEGER NOT NULL,
  plan_id INTEGER REFERENCES paas_plans(id),
  instance_count INTEGER DEFAULT 1,
  hourly_rate DECIMAL(10,4) NOT NULL,
  hours_used DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```


### API Endpoints

#### Admin Endpoints

**PaaS Plans Management**
- `GET /api/admin/paas/plans` - List all App Hosting Plans
- `POST /api/admin/paas/plans` - Create new plan
- `PUT /api/admin/paas/plans/:id` - Update plan
- `DELETE /api/admin/paas/plans/:id` - Delete plan

**Runtime Management**
- `GET /api/admin/paas/runtimes` - List available runtimes
- `POST /api/admin/paas/runtimes` - Add new runtime
- `PUT /api/admin/paas/runtimes/:id` - Update runtime
- `DELETE /api/admin/paas/runtimes/:id` - Remove runtime

**Node Management**
- `GET /api/admin/paas/nodes` - List all worker nodes
- `POST /api/admin/paas/nodes/register` - Generate registration token
- `PUT /api/admin/paas/nodes/:id` - Update node configuration
- `DELETE /api/admin/paas/nodes/:id` - Remove node
- `GET /api/admin/paas/nodes/:id/metrics` - Get detailed node metrics

**Monitoring & Analytics**
- `GET /api/admin/paas/stats` - Overall PaaS usage statistics
- `GET /api/admin/paas/capacity` - Capacity planning data

#### Customer Endpoints

**Application Management**
- `GET /api/paas/applications` - List user's applications
- `POST /api/paas/applications` - Create new application
- `GET /api/paas/applications/:id` - Get application details
- `PUT /api/paas/applications/:id` - Update application settings
- `DELETE /api/paas/applications/:id` - Delete application
- `POST /api/paas/applications/:id/deploy` - Trigger deployment
- `POST /api/paas/applications/:id/restart` - Restart application
- `POST /api/paas/applications/:id/stop` - Stop application
- `POST /api/paas/applications/:id/start` - Start application
- `POST /api/paas/applications/:id/scale` - Scale instances
- `GET /api/paas/applications/:id/logs` - Stream application logs
- `GET /api/paas/applications/:id/metrics` - Get resource usage metrics

**Environment Variables**
- `GET /api/paas/applications/:id/env` - List environment variables
- `POST /api/paas/applications/:id/env` - Add environment variable
- `PUT /api/paas/applications/:id/env/:key` - Update variable
- `DELETE /api/paas/applications/:id/env/:key` - Delete variable

**Build History**
- `GET /api/paas/applications/:id/builds` - List builds
- `GET /api/paas/applications/:id/builds/:buildId` - Get build details
- `GET /api/paas/applications/:id/builds/:buildId/logs` - Get build logs

**Database Management**
- `GET /api/paas/databases` - List user's databases
- `POST /api/paas/databases` - Create new database
- `GET /api/paas/databases/:id` - Get database details
- `DELETE /api/paas/databases/:id` - Delete database
- `POST /api/paas/databases/:id/backup` - Create manual backup
- `GET /api/paas/databases/:id/backups` - List backups
- `POST /api/paas/databases/:id/restore` - Restore from backup

**Database Linking**
- `POST /api/paas/applications/:id/databases/:dbId` - Link database to app
- `DELETE /api/paas/applications/:id/databases/:dbId` - Unlink database

**GitHub Integration**
- `GET /api/paas/github/authorize` - Initiate OAuth flow
- `GET /api/paas/github/callback` - OAuth callback handler
- `GET /api/paas/github/repositories` - List user's repositories
- `GET /api/paas/github/repositories/:owner/:repo/branches` - List branches

**Plans & Regions**
- `GET /api/paas/plans` - List available plans
- `GET /api/paas/regions` - List available regions with capacity

#### Agent Endpoints (Internal)

**Node Registration & Communication**
- `POST /api/internal/paas/nodes/register` - Complete node registration
- `WS /api/internal/paas/nodes/:id/connect` - WebSocket connection for agent
- `POST /api/internal/paas/nodes/:id/heartbeat` - Send heartbeat (fallback to HTTP)

**Task Reporting**
- `POST /api/internal/paas/tasks/:taskId/status` - Update task status
- `POST /api/internal/paas/tasks/:taskId/logs` - Stream task logs


### PaaS Agent Architecture

The PaaS Agent is a lightweight Node.js service installed on each worker node. It runs as a systemd service and maintains a persistent connection to the control plane.

#### Agent Components

**Connection Manager**
- Establishes and maintains WebSocket connection to control plane
- Handles authentication using JWT tokens
- Implements reconnection logic with exponential backoff
- Falls back to HTTP polling if WebSocket fails

**Task Executor**
- Receives deployment tasks from control plane
- Executes build and deployment workflows
- Reports progress and results back to control plane
- Handles task cancellation and cleanup

**Container Manager**
- Interfaces with Docker Engine via Docker API
- Creates, starts, stops, and removes containers
- Applies resource limits (CPU, memory) via cgroups
- Manages container networks and volumes

**Build System**
- Clones Git repositories in isolated build containers
- Detects runtime and selects appropriate buildpack
- Executes build commands and captures output
- Creates Docker images and tags them appropriately
- Cleans up build artifacts after completion

**Metrics Collector**
- Monitors host system resources (CPU, RAM, disk)
- Tracks running container count and resource usage
- Sends heartbeat messages with metrics every 30 seconds
- Detects and reports container failures

**Ingress Manager**
- Configures Nginx/Traefik reverse proxy
- Updates routing rules when containers start/stop
- Manages SSL certificate requests via Certbot/ACME
- Handles domain verification for custom domains

#### Agent Installation Script

```bash
#!/bin/bash
# install-paas-agent.sh

CONTROL_PLANE_URL="$1"
REGISTRATION_TOKEN="$2"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Download and install PaaS Agent
mkdir -p /opt/skypanel-agent
cd /opt/skypanel-agent
curl -L "${CONTROL_PLANE_URL}/agent/download" -o agent.tar.gz
tar -xzf agent.tar.gz
npm install --production

# Configure agent
cat > config.json <<EOF
{
  "controlPlaneUrl": "${CONTROL_PLANE_URL}",
  "registrationToken": "${REGISTRATION_TOKEN}"
}
EOF

# Install systemd service
cat > /etc/systemd/system/skypanel-agent.service <<EOF
[Unit]
Description=SkyPanel PaaS Agent
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skypanel-agent
ExecStart=/usr/bin/node /opt/skypanel-agent/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start agent
systemctl daemon-reload
systemctl enable skypanel-agent
systemctl start skypanel-agent

echo "PaaS Agent installed and started successfully"
```

#### Agent Configuration

```javascript
// Agent config.json structure
{
  "controlPlaneUrl": "https://panel.example.com",
  "registrationToken": "token-from-admin-ui",
  "nodeId": null,  // Set after registration
  "jwtSecret": null,  // Set after registration
  "region": "us-east",
  "maxContainers": 50,
  "maxCpuPercent": 90,
  "maxMemoryPercent": 90,
  "ingressType": "nginx",  // or "traefik"
  "sslProvider": "letsencrypt",
  "logLevel": "info"
}
```


## Data Models

### Application Lifecycle States

```
pending → building → running
                  ↓
                failed
                  ↓
              stopped
```

**State Transitions:**
- `pending`: Application created, awaiting first deployment
- `building`: Build in progress on worker node
- `running`: Container(s) running successfully
- `failed`: Build or runtime failure
- `stopped`: User stopped the application

### Build Process Flow

```
1. User triggers deployment
2. Control plane creates build record
3. Control plane selects worker node
4. Control plane sends build task to agent
5. Agent clones Git repository
6. Agent detects runtime or uses Dockerfile
7. Agent executes build commands
8. Agent creates Docker image
9. Agent starts container with resource limits
10. Agent reports success/failure to control plane
11. Control plane updates application status
```

### Deployment Task Structure

```typescript
interface DeploymentTask {
  taskId: string;
  type: 'deploy' | 'restart' | 'stop' | 'scale';
  applicationId: number;
  buildId: number;
  
  // Git configuration
  gitRepoUrl: string;
  gitBranch: string;
  gitCommitSha?: string;
  gitOAuthToken?: string;
  
  // Runtime configuration
  runtimeType: string;
  runtimeVersion: string;
  baseImage: string;
  buildCommand?: string;
  startCommand?: string;
  
  // Resource limits
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  instanceCount: number;
  
  // Environment
  environmentVars: Record<string, string>;
  
  // Networking
  systemDomain: string;
  customDomains: string[];
  port: number;
}
```

### Heartbeat Message Structure

```typescript
interface HeartbeatMessage {
  nodeId: number;
  timestamp: string;
  status: 'online' | 'degraded';
  
  // System metrics
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskUsedMB: number;
  diskTotalMB: number;
  
  // Container metrics
  containerCount: number;
  containers: Array<{
    containerId: string;
    applicationId: number;
    status: 'running' | 'stopped' | 'failed';
    cpuUsagePercent: number;
    memoryUsedMB: number;
    restartCount: number;
  }>;
}
```

### Billing Record Structure

```typescript
interface BillingRecord {
  userId: number;
  resourceType: 'application' | 'database';
  resourceId: number;
  planId: number;
  instanceCount: number;
  hourlyRate: number;
  hoursUsed: number;
  totalCost: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}
```


## Error Handling

### Build Failures

**Scenario**: Git clone fails, build command errors, or Docker image creation fails

**Handling**:
1. Agent captures error output and exit code
2. Agent updates build status to 'failed' with error details
3. Control plane stores error in build log
4. Customer UI displays error message with actionable guidance
5. Application remains in previous working state (if exists)

**User Actions**:
- View detailed build logs
- Fix code/configuration issues
- Retry deployment

### Node Disconnection

**Scenario**: Worker node loses connection to control plane

**Handling**:
1. Control plane detects missing heartbeats (90 second timeout)
2. Control plane marks node as 'offline'
3. Control plane excludes node from new deployments
4. Running containers continue operating (no immediate impact)
5. Agent reconnects automatically when network restored
6. Agent re-syncs state with control plane on reconnection

**Admin Actions**:
- Receive alert notification
- Check node health via SSH
- Restart agent service if needed
- Remove node if permanently failed

### Resource Exhaustion

**Scenario**: Worker node reaches capacity limits

**Handling**:
1. Agent reports high resource usage in heartbeat
2. Control plane marks node as 'degraded' at 90% capacity
3. Scheduler avoids degraded nodes for new deployments
4. Admin receives capacity alert
5. Existing containers continue running with resource limits enforced

**Admin Actions**:
- Add additional worker nodes
- Migrate applications to other nodes
- Upgrade node hardware

### Insufficient Wallet Balance

**Scenario**: Customer's prepaid wallet cannot cover hourly charges

**Handling**:
1. Hourly billing job detects insufficient balance
2. Control plane sends low-balance notification
3. After grace period (e.g., 24 hours), control plane suspends applications
4. Agent stops containers but preserves data
5. Customer receives suspension notification with top-up instructions

**Customer Actions**:
- Add funds to prepaid wallet
- Applications automatically resume after payment

### SSL Certificate Failures

**Scenario**: Let's Encrypt certificate request fails

**Handling**:
1. Agent attempts certificate request via ACME protocol
2. If domain verification fails, agent logs error
3. Agent retries with exponential backoff (max 3 attempts)
4. If all attempts fail, application serves HTTP only
5. Control plane notifies customer of SSL issue

**Customer Actions**:
- Verify DNS configuration
- Check domain ownership
- Retry SSL provisioning manually

### Container Crashes

**Scenario**: Application container exits unexpectedly

**Handling**:
1. Agent detects container exit
2. Agent attempts automatic restart (max 3 attempts in 5 minutes)
3. If restart limit exceeded, agent marks application as 'failed'
4. Control plane notifies customer
5. Billing stops for failed applications

**Customer Actions**:
- View application logs to diagnose issue
- Fix application code
- Redeploy application

### Database Connection Failures

**Scenario**: Application cannot connect to linked database

**Handling**:
1. Application logs connection errors
2. Customer views logs and identifies database issue
3. Control plane provides database status and connection details
4. If database container failed, agent attempts restart

**Customer Actions**:
- Verify database is running
- Check environment variables
- Verify network connectivity
- Restart database if needed


## Testing Strategy

### Unit Tests

**Control Plane Services**
- Plan management CRUD operations
- Runtime configuration validation
- Node registration and token generation
- Deployment scheduling logic
- Billing calculation accuracy
- Environment variable encryption/decryption

**Agent Components**
- Docker API interaction mocking
- Build process execution
- Heartbeat message formatting
- Task execution workflow
- Metrics collection accuracy

**Test Framework**: Vitest with mocked dependencies

### Integration Tests

**API Endpoints**
- Admin plan management endpoints
- Customer application CRUD operations
- Environment variable management
- Database provisioning and linking
- GitHub OAuth flow
- Build triggering and status updates

**Database Operations**
- Schema migrations
- Foreign key constraints
- Cascade deletions
- Transaction handling

**Test Framework**: Supertest for HTTP testing, test database instance

### End-to-End Tests

**Deployment Workflow**
1. Create application via API
2. Configure Git repository
3. Trigger deployment
4. Verify build completion
5. Verify container running
6. Verify domain accessibility
7. Verify SSL certificate

**Scaling Workflow**
1. Deploy application
2. Scale to multiple instances
3. Verify load balancing
4. Verify billing adjustment
5. Scale down
6. Verify instance termination

**Database Workflow**
1. Create database
2. Link to application
3. Verify environment variables injected
4. Verify connection from application
5. Create backup
6. Restore from backup

**Test Environment**: Staging environment with test worker node

### Security Tests

**Container Isolation**
- Verify non-privileged execution
- Verify resource limit enforcement
- Verify network isolation between tenants
- Verify filesystem isolation
- Attempt privilege escalation (should fail)

**Authentication & Authorization**
- Verify JWT token validation
- Verify user can only access own resources
- Verify admin-only endpoints protected
- Verify agent authentication

**Data Protection**
- Verify environment variable encryption
- Verify database password encryption
- Verify OAuth token encryption
- Verify secure communication (HTTPS/WSS)

**Test Framework**: Manual penetration testing, automated security scans

### Performance Tests

**Load Testing**
- Concurrent deployments (10+ simultaneous)
- High-frequency heartbeat processing
- Large log streaming
- Multiple instance scaling

**Capacity Testing**
- Maximum containers per node
- Maximum applications per customer
- Database query performance under load

**Test Tools**: Artillery.io or k6 for load generation

### Monitoring & Observability

**Metrics to Track**
- Deployment success/failure rates
- Average build time
- Node uptime percentage
- Container restart frequency
- API response times
- Billing accuracy

**Logging**
- Structured JSON logs
- Centralized log aggregation (optional)
- Log retention policies
- Customer-accessible application logs

**Alerting**
- Node offline alerts
- Capacity threshold alerts
- Build failure alerts
- SSL certificate expiration alerts


## Security Considerations

### Container Isolation

**Non-Privileged Execution**
- Containers run without `--privileged` flag
- No access to host devices or Docker socket
- Drop unnecessary Linux capabilities
- Use `--security-opt=no-new-privileges`

**User Namespaces**
- Enable Docker user namespace remapping
- Map container root to unprivileged host UID
- Prevent container root from being host root

**Resource Limits**
- Enforce CPU limits via cgroups
- Enforce memory limits with OOM kill isolation
- Enforce disk I/O limits
- Prevent resource exhaustion attacks

**Network Isolation**
- Each customer's containers on isolated bridge networks
- No direct inter-customer communication
- Only ingress proxy can route to containers
- Firewall rules prevent unauthorized access

**Filesystem Isolation**
- Each container has isolated filesystem
- No shared volumes between customers
- Persistent volumes with proper permissions
- Regular security updates to base images

### Authentication & Authorization

**Control Plane Authentication**
- JWT tokens for API authentication
- Secure session management
- Password hashing with bcrypt
- OAuth token encryption at rest

**Agent Authentication**
- JWT tokens issued during registration
- Token rotation every 24 hours
- Mutual TLS for WebSocket connections (optional)
- IP whitelisting for agent connections (optional)

**Customer Authorization**
- Users can only access their own resources
- Admin role for platform management
- Resource ownership validation on all operations
- Audit logging for sensitive actions

### Data Protection

**Encryption at Rest**
- Environment variables encrypted in database
- Database passwords encrypted
- OAuth tokens encrypted
- Use AES-256 encryption

**Encryption in Transit**
- HTTPS for all API communication
- WSS (WebSocket Secure) for agent connections
- TLS 1.2+ minimum version
- Strong cipher suites only

**Secret Management**
- Secrets injected as environment variables
- No secrets in logs or error messages
- Secure secret rotation procedures
- Secrets never exposed in API responses

### Input Validation

**User Input**
- Validate all API inputs
- Sanitize application names and slugs
- Validate Git URLs and branches
- Prevent command injection in build commands
- Limit environment variable sizes

**Docker Image Security**
- Validate base image references
- Use official images from trusted registries
- Scan images for vulnerabilities (optional)
- Restrict custom Docker images to verified users

### Rate Limiting & Abuse Prevention

**API Rate Limits**
- Per-user rate limits on API endpoints
- Stricter limits on deployment operations
- Prevent brute force attacks
- Prevent resource exhaustion

**Resource Quotas**
- Limit applications per user
- Limit databases per user
- Limit total resource consumption
- Require minimum wallet balance

**Build Limits**
- Maximum build time (e.g., 15 minutes)
- Maximum build log size
- Maximum image size
- Prevent infinite build loops

### Monitoring & Incident Response

**Security Monitoring**
- Log all authentication attempts
- Log all authorization failures
- Monitor for suspicious activity patterns
- Alert on repeated failures

**Incident Response**
- Procedures for container escape attempts
- Procedures for compromised nodes
- Procedures for data breaches
- Regular security audits

**Compliance**
- GDPR compliance for user data
- Data retention policies
- Right to deletion procedures
- Data export capabilities


## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal**: Basic single-node PaaS with manual deployments

**Deliverables**:
- Database schema and migrations
- Admin UI for plan and runtime management
- Node registration system (manual setup)
- Basic PaaS Agent with Docker integration
- Customer UI for application creation
- Manual deployment trigger (no Git integration)
- Simple buildpack support (Node.js only)
- Container execution with resource limits
- Basic logging and status reporting
- Hourly billing integration

**Timeline**: 4-6 weeks

### Phase 2: Git Integration & Automation

**Goal**: Automated deployments from Git repositories

**Deliverables**:
- GitHub OAuth integration
- Repository and branch selection UI
- Automated Git clone in agent
- Build process automation
- Build log streaming
- Multiple runtime support (Node.js, Python, PHP)
- Dockerfile support
- Environment variable management
- Auto-deploy on push (webhooks)

**Timeline**: 3-4 weeks

### Phase 3: Databases & Networking

**Goal**: Managed databases and domain management

**Deliverables**:
- Database provisioning (MySQL, PostgreSQL)
- Database linking to applications
- Automatic environment variable injection
- System domain assignment
- Nginx/Traefik ingress configuration
- Let's Encrypt SSL automation
- Custom domain support
- Database backup and restore

**Timeline**: 3-4 weeks

### Phase 4: Multi-Node & Scaling

**Goal**: Multiple worker nodes and horizontal scaling

**Deliverables**:
- Multi-node deployment scheduling
- Regional node support
- Node capacity management
- Horizontal scaling (multiple instances)
- Load balancing across instances
- Node health monitoring and failover
- Capacity alerts and planning tools

**Timeline**: 4-5 weeks

### Phase 5: Advanced Features

**Goal**: Production-ready enhancements

**Deliverables**:
- Application metrics and monitoring
- Advanced log management
- Autoscaling based on metrics
- CI/CD pipeline integration
- CLI tool for deployments
- Webhook notifications
- Advanced billing reports
- Performance optimization

**Timeline**: 4-6 weeks

### Future Enhancements

**Potential Features**:
- Multi-region load balancing
- Container orchestration (Kubernetes integration)
- Serverless functions
- Scheduled tasks/cron jobs
- Application marketplace
- Team collaboration features
- Advanced security scanning
- Compliance certifications


## Technical Decisions & Rationale

### Why Docker Instead of VMs?

**Decision**: Use Docker containers for application isolation

**Rationale**:
- **Efficiency**: Containers start in seconds vs minutes for VMs
- **Density**: Run 10-50x more containers than VMs on same hardware
- **Cost**: Lower resource overhead means better margins
- **Developer Experience**: Matches Heroku/modern PaaS expectations
- **Ecosystem**: Rich ecosystem of base images and tools

**Trade-offs**:
- Slightly weaker isolation than VMs (mitigated by security hardening)
- Shared kernel (mitigated by user namespaces and seccomp)

### Why Custom Orchestration Instead of Kubernetes?

**Decision**: Build custom control plane instead of using Kubernetes

**Rationale**:
- **Simplicity**: Kubernetes adds significant complexity for initial MVP
- **Billing Integration**: Tight integration with existing SkyPanelV2 billing
- **Learning Curve**: Team familiarity with Node.js vs Kubernetes operators
- **Resource Overhead**: K8s control plane requires dedicated resources
- **Flexibility**: Custom solution allows rapid iteration on features

**Trade-offs**:
- Need to build scheduling, health checking, and orchestration logic
- May need to migrate to K8s if scale demands it (design allows this)

### Why WebSocket for Agent Communication?

**Decision**: Use WebSocket for persistent agent connections

**Rationale**:
- **Real-time**: Instant task delivery without polling
- **Efficiency**: Single persistent connection vs repeated HTTP requests
- **Bidirectional**: Control plane can push tasks, agent can push logs
- **Scalability**: Handles thousands of concurrent connections

**Trade-offs**:
- More complex than HTTP polling
- Requires connection state management
- Fallback to HTTP needed for reliability

### Why Buildpacks + Dockerfile?

**Decision**: Support both buildpack auto-detection and custom Dockerfiles

**Rationale**:
- **Ease of Use**: Buildpacks provide zero-config deployments for common stacks
- **Flexibility**: Dockerfiles allow advanced users full control
- **Compatibility**: Matches Heroku's approach (familiar to developers)
- **Security**: Buildpacks use vetted base images

**Trade-offs**:
- Need to maintain buildpack implementations
- Dockerfile support requires additional security review

### Why Single-Node Instances Initially?

**Decision**: Deploy all instances of an app on the same worker node

**Rationale**:
- **Simplicity**: Avoids cross-node networking complexity
- **Performance**: Local load balancing is faster
- **MVP Focus**: Get core features working before distribution
- **Sufficient**: Most apps don't need multi-node redundancy initially

**Trade-offs**:
- Single point of failure per application
- Limited by single node capacity
- Future enhancement needed for true HA

### Why Hourly Billing?

**Decision**: Bill PaaS resources hourly like existing VPS billing

**Rationale**:
- **Consistency**: Matches existing SkyPanelV2 billing model
- **Fairness**: Pay-per-use aligns with customer expectations
- **Simplicity**: Reuse existing billing infrastructure
- **Flexibility**: Easy to start/stop resources without waste

**Trade-offs**:
- More complex than monthly billing
- Requires accurate usage tracking

### Why Let's Encrypt for SSL?

**Decision**: Use Let's Encrypt for automatic SSL certificates

**Rationale**:
- **Free**: No certificate costs
- **Automated**: ACME protocol enables full automation
- **Trusted**: Widely trusted certificate authority
- **Standard**: Industry standard for PaaS platforms

**Trade-offs**:
- Rate limits (50 certs per domain per week)
- Requires domain validation
- 90-day expiration (mitigated by auto-renewal)

