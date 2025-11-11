# Design Document

## Overview

The Container Platform extends SkyPanelV2 to provide a Nix-styled Heroku alternative with Container-as-a-Service (CaaS) and Platform-as-a-Service (PaaS) capabilities. The platform leverages Docker Swarm for orchestration, Nix for reproducible builds, and integrates seamlessly with the existing multi-tenant architecture, hourly billing system, and real-time notification infrastructure.

### Key Design Principles

- **Leverage Existing Infrastructure**: Reuse provider abstraction, billing system, multi-tenancy, and notification patterns
- **Low Resource Consumption**: Lightweight worker agents with minimal overhead
- **Developer-Friendly**: Simple worker setup, embedded development mode, and intuitive deployment workflows
- **Gradual Nix Integration**: Start with basic Nix support and expand capabilities over time
- **Container-Per-App Isolation**: Each application runs in its own container with resource limits
- **Hybrid Worker Management**: Support both manual provisioning and auto-provisioning via cloud APIs

## Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           SkyPanelV2 Manager Node                              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                          Frontend Layer (Port 5173)                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │  Container   │  │   Worker     │  │   Template   │  │  Metrics   │  │  │
│  │  │  Management  │  │  Management  │  │   Library    │  │  Dashboard │  │  │
│  │  │     UI       │  │  (Admin UI)  │  │      UI      │  │     UI     │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                          │
│                                      │ HTTPS/WebSocket                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                          API Layer (Port 3001)                           │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │  │                        Route Handlers                             │   │  │
│  │  │  /api/containers  /api/workers  /api/templates  /api/webhooks    │   │  │
│  │  └──────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │  │                        Service Layer                              │   │  │
│  │  │  ContainerService  WorkerService  NixBuildService                 │   │  │
│  │  │  SwarmOrchestrator  ContainerBillingService  WebhookService       │   │  │
│  │  └──────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Existing Services (Reused)                     │   │  │
│  │  │  AuthService  BillingService  NotificationService                 │   │  │
│  │  │  ActivityLogger  PayPalService  EmailService                      │   │  │
│  │  └──────────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                          │
│                    ┌─────────────────┼─────────────────┐                       │
│                    │                 │                 │                       │
│                    ▼                 ▼                 ▼                       │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │    PostgreSQL        │  │      Redis       │  │  Docker Swarm    │        │
│  │   (Port 5432)        │  │   (Port 6379)    │  │    Manager       │        │
│  │                      │  │                  │  │  (Port 2377)     │        │
│  │ • container_services │  │ • Worker cache   │  │                  │        │
│  │ • container_workers  │  │ • Metrics cache  │  │ • Service defs   │        │
│  │ • deployments        │  │ • Build queue    │  │ • Network mgmt   │        │
│  │ • templates          │  │ • Pub/sub        │  │ • Health checks  │        │
│  │ • billing_cycles     │  │                  │  │ • Load balancing │        │
│  │ • secrets            │  │                  │  │                  │        │
│  └──────────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                              │                  │
└──────────────────────────────────────────────────────────────┼──────────────────┘
                                                               │
                                                               │ Swarm Cluster
                                                               │ Communication
                                                               │ (Encrypted)
                    ┌──────────────────────────────────────────┼──────────────────┐
                    │                                          │                  │
                    ▼                                          ▼                  ▼
        ┌───────────────────────┐              ┌───────────────────────┐  ┌──────────────┐
        │   Worker Node 1       │              │   Worker Node 2       │  │  Worker N    │
        │                       │              │                       │  │              │
        │ ┌───────────────────┐ │              │ ┌───────────────────┐ │  │     ...      │
        │ │  Worker Agent     │ │              │ │  Worker Agent     │ │  │              │
        │ │  (Node.js)        │ │              │ │  (Node.js)        │ │  │              │
        │ │                   │ │              │ │                   │ │  │              │
        │ │ • Heartbeat (30s) │ │              │ │ • Heartbeat (30s) │ │  │              │
        │ │ • Metrics report  │ │              │ │ • Metrics report  │ │  │              │
        │ │ • Log streaming   │ │              │ │ • Log streaming   │ │  │              │
        │ └───────────────────┘ │              │ └───────────────────┘ │  │              │
        │           │           │              │           │           │  │              │
        │           ▼           │              │           ▼           │  │              │
        │ ┌───────────────────┐ │              │ ┌───────────────────┐ │  │              │
        │ │  Docker Engine    │ │              │ │  Docker Engine    │ │  │              │
        │ │  (Swarm Worker)   │ │              │ │  (Swarm Worker)   │ │  │              │
        │ └───────────────────┘ │              │ └───────────────────┘ │  │              │
        │           │           │              │           │           │  │              │
        │           ▼           │              │           ▼           │  │              │
        │ ┌───────────────────┐ │              │ ┌───────────────────┐ │  │              │
        │ │  Nix Package Mgr  │ │              │ │  Nix Package Mgr  │ │  │              │
        │ │  • Build isolation│ │              │ │  • Build isolation│ │  │              │
        │ │  • Package cache  │ │              │ │  • Package cache  │ │  │              │
        │ └───────────────────┘ │              │ └───────────────────┘ │  │              │
        │           │           │              │           │           │  │              │
        │           ▼           │              │           ▼           │  │              │
        │ ┌───────────────────┐ │              │ ┌───────────────────┐ │  │              │
        │ │ Running Containers│ │              │ │ Running Containers│ │  │              │
        │ │                   │ │              │ │                   │ │  │              │
        │ │ ┌───┐ ┌───┐ ┌───┐│ │              │ │ ┌───┐ ┌───┐ ┌───┐│ │  │              │
        │ │ │C1 │ │C2 │ │C3 ││ │              │ │ │C4 │ │C5 │ │C6 ││ │  │              │
        │ │ └───┘ └───┘ └───┘│ │              │ │ └───┘ └───┘ └───┘│ │  │              │
        │ │                   │ │              │ │                   │ │  │              │
        │ │ Org A Network     │ │              │ │ Org B Network     │ │  │              │
        │ │ (Isolated)        │ │              │ │ (Isolated)        │ │  │              │
        │ └───────────────────┘ │              │ └───────────────────┘ │  │              │
        └───────────────────────┘              └───────────────────────┘  └──────────────┘
                    │                                      │
                    │                                      │
                    └──────────────┬───────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │      Reverse Proxy (Traefik)     │
                    │                                  │
                    │  • SSL/TLS termination           │
                    │  • Service discovery             │
                    │  • Load balancing                │
                    │  • Rate limiting                 │
                    │  • DDoS protection               │
                    │                                  │
                    │  Routes:                         │
                    │  app1.example.com → Container C1 │
                    │  app2.example.com → Container C4 │
                    └──────────────────────────────────┘
                                   │
                                   ▼
                            Internet / Users


External Integrations:
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Git Providers          Payment          Email                 │
│  ┌──────────┐          ┌──────────┐     ┌──────────┐          │
│  │ GitHub   │──webhook─▶│ PayPal   │     │ SMTP2GO  │          │
│  │ GitLab   │          │ Wallet   │     │          │          │
│  │Bitbucket │          └──────────┘     └──────────┘          │
│  └──────────┘                 │                │               │
│       │                       │                │               │
│       └───────────────────────┴────────────────┘               │
│                               │                                 │
│                               ▼                                 │
│                    SkyPanelV2 API Layer                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Component Layers

1. **Frontend Layer**: React components for container management, worker monitoring, template selection
2. **API Layer**: Express routes and services for container lifecycle, build pipeline, worker registration
3. **Orchestration Layer**: Docker Swarm for container scheduling, networking, and health monitoring
4. **Worker Layer**: Lightweight agents running on worker nodes with Nix package manager
5. **Build Layer**: Nix-based build pipeline for reproducible container images

### Detailed Architecture Components

#### 1. Frontend Layer (React + TypeScript)

**Container Management UI** (`src/components/Containers/`)
- **ContainerServiceList**: Displays all services with status, resource usage, and quick actions
- **ContainerServiceDetail**: Shows detailed service info, metrics, logs, and deployment history
- **CreateContainerService**: Multi-step wizard for service creation with template selection, Git config, resource limits, and cost estimation
- **ContainerDeployments**: Deployment history with rollback functionality and diff comparison
- **ContainerLogs**: Real-time log streaming with filtering, search, and download capabilities
- **ContainerMetrics**: Resource usage charts with cost breakdown and historical data

**Worker Management UI** (`src/components/admin/Workers/`)
- **WorkerList**: Admin dashboard showing all workers with health status and capacity
- **WorkerDetail**: Detailed worker metrics, container list, and heartbeat history
- **AddWorkerDialog**: Generates installation script with auth token and setup instructions
- **WorkerMetrics**: Cluster-wide resource utilization and capacity planning

**Template Library UI** (`src/components/Containers/Templates/`)
- **TemplateLibrary**: Grid view of templates with category filtering and search
- **TemplateCard**: Template preview with description, resource requirements, and estimated cost
- **TemplateEditor**: Admin interface for creating/editing templates with Nix expression editor

**Integration with Existing UI**
- Reuses `AppLayout`, `AppSidebar`, and navigation components
- Integrates with `AuthContext` for authentication
- Uses `NotificationDropdown` for real-time container events
- Follows existing shadcn/ui component patterns

#### 2. API Layer (Express + TypeScript)

**Route Handlers** (`api/routes/`)
- **containers.ts**: Container service CRUD, deployment, lifecycle actions (start/stop/restart/rebuild)
- **workers.ts**: Worker registration, heartbeat, metrics, admin management
- **templates.ts**: Template CRUD, deployment from template
- **secrets.ts**: Secret management with encryption
- **webhooks.ts**: Git webhook handlers for GitHub, GitLab, Bitbucket

**Service Layer** (`api/services/`)
- **ContainerService**: Core business logic for container lifecycle management
- **SwarmOrchestrator**: Docker Swarm API integration for container orchestration
- **WorkerService**: Worker registration, health monitoring, capacity tracking
- **NixBuildService**: Build pipeline orchestration with Nix integration
- **ContainerBillingService**: Hourly billing calculation and wallet deduction
- **WebhookService**: Git webhook validation and build triggering

**Middleware** (`api/middleware/`)
- Reuses existing `auth.ts` for JWT validation
- Reuses existing `rateLimiting.ts` for API rate limiting
- Reuses existing `security.ts` for Helmet and CORS
- New: `workerAuth.ts` for worker token validation

**Integration with Existing Backend**
- Uses `api/lib/database.ts` for PostgreSQL queries
- Uses `api/lib/crypto.ts` for secret encryption
- Uses `api/services/billingService.ts` for wallet operations
- Uses `api/services/notificationService.ts` for real-time events
- Uses `api/services/activityLogger.ts` for audit logging

#### 3. Orchestration Layer (Docker Swarm)

**Docker Swarm Manager**
- Runs on the same server as SkyPanelV2 application
- Manages cluster state and service definitions
- Handles service scheduling across worker nodes
- Provides built-in service discovery via DNS
- Manages overlay networks for multi-tenant isolation

**Service Orchestration**
- Each container service maps to a Docker Swarm service
- Services are deployed with resource constraints (CPU, memory, disk)
- Health checks configured per service with automatic restart
- Rolling updates for zero-downtime deployments
- Automatic load balancing across replicas (if scaled)

**Network Management**
- One overlay network per organization: `org-{organizationId}-network`
- Containers within organization can communicate via service names
- External access via Traefik reverse proxy with automatic routing
- Network isolation enforced at Docker network level

**Storage Management**
- Persistent volumes for stateful services (databases, file storage)
- Volume mounts for secrets and configuration files
- Automatic cleanup of unused volumes on service deletion

#### 4. Worker Layer (Node.js Agent)

**Worker Agent** (`api/worker/embedded-worker.js` for dev, standalone for production)
- Lightweight Node.js process running on each worker node
- Registers with manager using auth token
- Sends heartbeat every 30 seconds with resource metrics
- Receives deployment commands from manager
- Reports container status and logs
- Handles graceful shutdown and container draining

**Resource Monitoring**
- Collects CPU, memory, disk, and network metrics
- Reports current container count and resource utilization
- Detects resource exhaustion and sends alerts
- Provides metrics for capacity planning

**Docker Integration**
- Joins Docker Swarm as worker node
- Executes container workloads assigned by manager
- Monitors container health and restarts on failure
- Streams container logs to manager

**Nix Integration**
- Nix package manager installed on each worker
- Shared Nix store for package caching
- Builds executed in isolated Nix environments
- Binary cache for faster builds

#### 5. Build Layer (Nix + Docker)

**Build Pipeline**
1. **Source Acquisition**: Clone Git repository or load Nix expression
2. **Dependency Resolution**: Nix resolves all package dependencies
3. **Build Execution**: Nix builds application in isolated environment
4. **Image Creation**: Package build output into Docker image
5. **Registry Push**: Push image to internal Docker registry
6. **Deployment Trigger**: Notify orchestrator to deploy new image

**Nix Build Process**
- Uses Nix derivations for reproducible builds
- Caches build artifacts in Nix store
- Supports custom Nix expressions and templates
- Fallback to Docker-based builds for non-Nix applications

**Build Isolation**
- Each build runs in isolated Nix environment
- No shared state between builds
- Resource limits enforced (CPU, memory, time)
- Build logs captured and stored

**Image Registry**
- Internal Docker registry for storing images
- Images tagged with commit SHA and build ID
- Automatic cleanup of old images (keep last 10 per service)
- Optional external registry support (Docker Hub, ECR, GCR)

#### 6. Data Layer (PostgreSQL + Redis)

**PostgreSQL**
- Stores all container metadata (services, deployments, workers, templates)
- Stores billing records and transaction history
- Stores secrets (encrypted) and audit logs
- Uses LISTEN/NOTIFY for real-time event streaming
- Reuses existing database connection pool

**Redis**
- Caches worker status (30-second TTL)
- Caches template list (5-minute TTL)
- Caches service metrics (1-minute TTL)
- Pub/sub for real-time notifications
- Queue for background jobs (builds, billing)

**Data Flow**
1. User action in UI → API request
2. API validates and writes to PostgreSQL
3. PostgreSQL triggers NOTIFY event
4. NotificationService streams event to connected clients
5. Background jobs process builds and billing
6. Metrics collected and cached in Redis
7. UI polls or subscribes for updates

#### 7. Integration Points with Existing SkyPanelV2

**Authentication & Authorization**
- Reuses JWT-based authentication from `AuthContext`
- Reuses organization-based multi-tenancy
- Reuses admin role checks for worker management
- Reuses impersonation functionality for support

**Billing System**
- Extends `BillingService` with container-specific logic
- Reuses `PayPalService` for wallet deductions
- Reuses `payment_transactions` table for audit trail
- Reuses invoice generation for monthly summaries

**Notification System**
- Reuses `NotificationService` for real-time events
- Reuses PostgreSQL LISTEN/NOTIFY pattern
- Reuses Server-Sent Events (SSE) for streaming
- Adds container-specific notification types

**Activity Logging**
- Reuses `activityLogger` service for audit trail
- Adds container-specific activity types
- Maintains consistent logging format

**UI Components**
- Reuses shadcn/ui component library
- Reuses theme system and branding
- Reuses navigation and layout components
- Follows existing design patterns

This architecture ensures seamless integration with SkyPanelV2 while adding powerful container orchestration capabilities. The design leverages existing infrastructure to minimize development effort and maintain consistency across the platform.


## Components and Interfaces

### Database Schema Extensions

#### container_workers Table
```sql
CREATE TABLE container_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  swarm_node_id VARCHAR(255) UNIQUE,
  auth_token_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unhealthy', 'draining', 'offline')),
  capacity JSONB NOT NULL DEFAULT '{"cpu_cores": 0, "memory_mb": 0, "disk_gb": 0}',
  current_load JSONB NOT NULL DEFAULT '{"cpu_percent": 0, "memory_percent": 0, "disk_percent": 0}',
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### container_services Table
```sql
CREATE TABLE container_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES application_templates(id),
  git_repository VARCHAR(500),
  git_branch VARCHAR(255) DEFAULT 'main',
  build_config JSONB NOT NULL DEFAULT '{}',
  environment_vars JSONB DEFAULT '{}',
  resource_limits JSONB NOT NULL DEFAULT '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'running', 'stopped', 'failed', 'deleted')),
  current_deployment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);
```

#### container_deployments Table
```sql
CREATE TABLE container_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES container_workers(id) ON DELETE SET NULL,
  swarm_service_id VARCHAR(255),
  container_id VARCHAR(255),
  image_tag VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'running', 'stopped', 'failed', 'rolled_back')),
  build_logs TEXT,
  deployment_logs TEXT,
  public_url VARCHAR(500),
  internal_port INTEGER,
  external_port INTEGER,
  deployed_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### application_templates Table
```sql
CREATE TABLE application_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  icon_url VARCHAR(500),
  nix_expression TEXT NOT NULL,
  default_env_vars JSONB DEFAULT '{}',
  default_resource_limits JSONB NOT NULL DEFAULT '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}',
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### container_builds Table
```sql
CREATE TABLE container_builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES container_deployments(id),
  git_commit_sha VARCHAR(255),
  build_status VARCHAR(50) DEFAULT 'pending' CHECK (build_status IN ('pending', 'building', 'success', 'failed', 'cancelled')),
  build_logs TEXT,
  image_tag VARCHAR(255),
  build_duration_seconds INTEGER,
  artifact_size_mb DECIMAL(10,2),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### container_secrets Table
```sql
CREATE TABLE container_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)
);
```

#### container_service_secrets Table (junction)
```sql
CREATE TABLE container_service_secrets (
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  secret_id UUID NOT NULL REFERENCES container_secrets(id) ON DELETE CASCADE,
  mount_path VARCHAR(500),
  env_var_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (service_id, secret_id)
);
```

#### container_billing_cycles Table
```sql
CREATE TABLE container_billing_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cpu_hours DECIMAL(10,2) NOT NULL,
  memory_gb_hours DECIMAL(10,2) NOT NULL,
  storage_gb_hours DECIMAL(10,2) NOT NULL,
  network_gb DECIMAL(10,4) NOT NULL,
  build_minutes INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```


### Backend Services

#### WebhookService (api/services/webhookService.ts)

Handles Git repository webhooks for automatic deployments.

**Key Methods:**
- `generateWebhookUrl(serviceId)`: Generate unique webhook URL for service
- `validateWebhookSignature(provider, payload, signature)`: Verify webhook authenticity
- `handleGitHubWebhook(payload)`: Process GitHub push events
- `handleGitLabWebhook(payload)`: Process GitLab push events
- `handleBitbucketWebhook(payload)`: Process Bitbucket push events
- `extractCommitInfo(provider, payload)`: Extract commit SHA and branch from payload

**Webhook Processing:**
1. Validate webhook signature using service secret
2. Extract commit SHA, branch, and author information
3. Check if branch matches service configuration
4. Trigger build via `NixBuildService`
5. Send notification to user about build start
6. Return 200 OK immediately (async processing)

**Design Rationale:**
Webhook integration enables true CI/CD workflows where code pushes automatically trigger deployments. The service validates webhook signatures to prevent unauthorized build triggers and processes webhooks asynchronously to avoid timeout issues with Git providers.

#### ContainerService (api/services/containerService.ts)

Primary service for managing container lifecycle operations.

**Key Methods:**
- `createService(organizationId, params)`: Create a new container service
- `deployService(serviceId, gitCommitSha?)`: Trigger deployment of a service
- `getService(serviceId)`: Retrieve service details with current deployment
- `listServices(organizationId, filters)`: List all services for an organization
- `updateService(serviceId, updates)`: Update service configuration
- `deleteService(serviceId)`: Delete service and all deployments
- `performAction(serviceId, action)`: Execute lifecycle actions (start, stop, restart, rebuild)
  - **start**: Starts a stopped service, creates new deployment if needed
  - **stop**: Gracefully stops service, preserves data and configuration
  - **restart**: Stops and starts service without rebuilding
  - **rebuild**: Triggers new build from latest Git commit and deploys
  - All actions complete within 5 seconds or return async status
- `getServiceLogs(serviceId, lines, since)`: Stream or retrieve service logs
- `getServiceMetrics(serviceId, timeRange)`: Retrieve resource usage metrics

**Integration Points:**
- Uses `SwarmOrchestrator` for Docker Swarm operations
- Uses `NixBuildService` for building container images
- Uses `BillingService` for hourly resource billing
- Uses `notificationService` for real-time updates

**Notification Integration:**
The Container Platform leverages the existing notification system to provide real-time updates:
- **Build Events**: Build started, build completed, build failed
- **Deployment Events**: Deployment started, deployment completed, deployment failed, rollback completed
- **Service Events**: Service started, service stopped, service crashed, service restarted
- **Resource Events**: Resource limit reached, quota warning, quota exceeded
- **Worker Events**: Worker offline, worker unhealthy, worker recovered
- **Billing Events**: Container billed, billing failed, low balance warning

Notifications are sent via PostgreSQL LISTEN/NOTIFY and streamed to users through Server-Sent Events (SSE), consistent with the existing VPS notification patterns.

#### SwarmOrchestrator (api/services/swarmOrchestrator.ts)

Manages Docker Swarm cluster operations and container orchestration.

**Key Methods:**
- `initializeSwarm()`: Initialize Swarm manager node
- `deployContainer(deployment)`: Deploy container to Swarm
- `scaleService(serviceId, replicas)`: Scale service replicas
- `removeService(serviceId)`: Remove service from Swarm
- `getServiceStatus(serviceId)`: Get current service status
- `getServiceLogs(serviceId, options)`: Retrieve service logs
- `updateService(serviceId, config)`: Update service configuration
- `drainNode(nodeId)`: Drain containers from a node
- `removeNode(nodeId)`: Remove node from Swarm

**Docker Swarm Integration:**
- Uses Docker Engine API via `dockerode` library
- Manages service definitions with resource constraints
- Handles network creation and service discovery
- Implements health checks and auto-restart policies

#### WorkerService (api/services/workerService.ts)

Manages worker node registration, health monitoring, and capacity tracking.

**Key Methods:**
- `generateWorkerScript(adminUserId)`: Generate installation script with auth token
- `registerWorker(authToken, workerInfo)`: Register new worker node
- `updateWorkerHeartbeat(workerId, metrics)`: Update worker health and metrics
- `getWorkerStatus(workerId)`: Get worker status and capacity
- `listWorkers(filters)`: List all workers with status
- `removeWorker(workerId)`: Decommission worker node
- `drainWorker(workerId)`: Gracefully drain containers from worker
- `getWorkerMetrics(workerId, timeRange)`: Retrieve historical metrics

**Health Monitoring:**
- Tracks heartbeat every 30 seconds with resource metrics
- Marks workers unhealthy after 2 consecutive minutes of missed heartbeats
- Triggers automatic container migration on worker failure:
  - Identifies containers on failed worker
  - Selects healthy worker with available capacity
  - Redeploys containers using existing images
  - Updates service routing to new instances
  - Notifies users of migration
- Sends real-time alerts to administrators:
  - Worker offline notification
  - Worker unhealthy warning
  - Worker recovery notification
  - Migration status updates
- Automatic worker recovery detection and restoration
- Resource exhaustion alerts (CPU > 90%, memory > 95%, disk > 90%)

**Container Migration Implementation:**
When a worker fails health checks (2 consecutive minutes without heartbeat):
1. `WorkerService.handleWorkerFailure(workerId)` is triggered
2. Query `container_deployments` for all running containers on the failed worker
3. For each container:
   - Calculate required resources (CPU, memory, disk)
   - Query available workers with sufficient capacity
   - Select worker with lowest current load percentage
   - Create new deployment record with status 'deploying'
   - Call `SwarmOrchestrator.migrateService(serviceId, targetWorkerId)`
   - Update service routing via Docker Swarm service update
   - Mark old deployment as 'stopped' with migration metadata
4. Send notification to each affected user with migration details
5. Send summary notification to administrators
6. Log migration event in activity log

**Migration Policies (Administrator Configurable):**
- **Automatic Migration**: Enabled by default, migrates containers immediately on worker failure
- **Manual Migration**: Requires administrator approval before migration
- **No Migration**: Containers remain stopped until worker recovers or user redeploys

**Design Rationale:**
Automatic health monitoring and container migration ensure high availability without manual intervention. The 2-minute timeout balances responsiveness with tolerance for temporary network issues. Resource exhaustion alerts enable proactive capacity management before failures occur. The configurable migration policies provide flexibility for different operational requirements and risk tolerances.

#### NixBuildService (api/services/nixBuildService.ts)

Handles Nix-based application builds and container image creation.

**Key Methods:**
- `buildFromNixExpression(serviceId, nixExpr, envVars)`: Build from Nix expression
- `buildFromGitRepository(serviceId, repoUrl, branch, commitSha)`: Build from Git
- `buildFromTemplate(serviceId, templateId, customizations)`: Build from template
- `getBuildStatus(buildId)`: Get build status and logs
- `cancelBuild(buildId)`: Cancel running build
- `getBuildArtifacts(buildId)`: Retrieve build artifacts
- `cleanupOldBuilds(serviceId, keepCount)`: Clean up old build artifacts

**Build Pipeline:**
1. Clone Git repository or load Nix expression
2. Resolve Nix dependencies and create derivation
3. Build application using Nix
4. Create Docker image with built artifacts
5. Push image to internal registry
6. Update deployment with new image tag

**Git Integration:**
- Supports webhook integration for automatic builds on push
- Validates Git URLs and branch access before cloning
- Stores commit SHA for each build for traceability
- Supports private repositories via SSH keys or tokens
- Implements shallow clones to reduce build time

**Webhook Setup Process:**
1. User connects Git repository to container service
2. System generates unique webhook URL: `{CLIENT_URL}/api/containers/webhooks/{provider}/{serviceId}`
3. System generates webhook secret for signature validation
4. User adds webhook URL and secret to Git repository settings
5. On Git push, provider sends webhook to SkyPanelV2
6. `WebhookService` validates signature and extracts commit information
7. If branch matches service configuration, triggers build via `NixBuildService`
8. Build runs asynchronously, user receives notification on completion

**Supported Git Providers:**
- GitHub: Validates `X-Hub-Signature-256` header
- GitLab: Validates `X-Gitlab-Token` header
- Bitbucket: Validates `X-Hub-Signature` header
- Generic: Supports custom webhook formats with configurable validation

**Automatic Deployment on Build Success:**
- When build completes successfully, system automatically deploys new version
- Previous deployment is preserved for rollback
- Zero-downtime deployment: new container starts before old container stops
- Health check ensures new container is healthy before routing traffic
- If new container fails health check, automatic rollback to previous version

**Design Rationale:**
The build service is designed to be provider-agnostic, supporting multiple build methods (Nix, Docker, buildpacks) to accommodate different application types. Nix is prioritized for its reproducibility guarantees, but the architecture allows fallback to Docker-based builds for compatibility. Webhook integration enables true CI/CD workflows where code changes automatically propagate to production, following modern development practices.

#### ContainerBillingService (api/services/containerBillingService.ts)

Extends existing billing system for container resource billing.

**Key Methods:**
- `runHourlyContainerBilling()`: Process hourly billing for all containers
- `billContainerService(serviceId)`: Bill specific service
- `calculateResourceCosts(service, hours)`: Calculate costs based on resource usage
- `getContainerBillingSummary(organizationId)`: Get billing summary
- `getContainerBillingHistory(organizationId, filters)`: Get billing history

**Billing Model:**
- CPU: $0.01 per core-hour
- Memory: $0.005 per GB-hour
- Storage: $0.10 per GB-month (prorated hourly: ~$0.000137/GB/hour)
- Network: $0.01 per GB transferred (outbound only)
- Build time: $0.05 per minute

**Billing Calculation Example:**
A service with 2 CPU cores, 4 GB memory, 20 GB storage running for 1 hour:
- CPU: 2 cores × $0.01 = $0.02
- Memory: 4 GB × $0.005 = $0.02
- Storage: 20 GB × $0.000137 = $0.00274
- Total: $0.04274/hour or ~$30.77/month

**Integration:**
- Reuses existing `PayPalService.deductFundsFromWallet()` for payments
- Creates `payment_transactions` records for audit trail
- Tracks usage in `container_billing_cycles` table
- Sends low balance notifications when wallet < 24 hours of usage
- Provides grace period before service suspension (configurable, default 24 hours)
- Itemized billing breakdown in user dashboard
- Supports billing alerts at custom thresholds

**Hourly Reconciliation Process:**
1. Runs every hour via cron job
2. Calculates resource usage for each running service
3. Generates billing cycle record
4. Attempts wallet deduction
5. On success: Creates transaction record, sends receipt
6. On failure: Sends notification, starts grace period timer
7. After grace period: Optionally suspends service

**Design Rationale:**
Hourly billing provides granular cost control and aligns with the existing VPS billing system. The grace period prevents immediate service disruption due to temporary payment issues. Transparent cost breakdowns help users understand and optimize their spending.


### API Routes

#### Container Service Routes (api/routes/containers.ts)

```typescript
// Container service management
POST   /api/containers/services                    // Create new service
GET    /api/containers/services                    // List services
GET    /api/containers/services/:id                // Get service details
PATCH  /api/containers/services/:id                // Update service
DELETE /api/containers/services/:id                // Delete service

// Service actions
POST   /api/containers/services/:id/deploy         // Deploy service
POST   /api/containers/services/:id/start          // Start service
POST   /api/containers/services/:id/stop           // Stop service
POST   /api/containers/services/:id/restart        // Restart service
POST   /api/containers/services/:id/rebuild        // Rebuild and redeploy

// Service monitoring
GET    /api/containers/services/:id/logs           // Get service logs
GET    /api/containers/services/:id/metrics        // Get resource metrics
GET    /api/containers/services/:id/deployments    // List deployments
GET    /api/containers/services/:id/builds         // List builds

// Deployments
GET    /api/containers/deployments/:id             // Get deployment details
POST   /api/containers/deployments/:id/rollback    // Rollback to deployment
DELETE /api/containers/deployments/:id             // Delete deployment

// Webhooks (for Git integration)
POST   /api/containers/webhooks/github             // GitHub webhook handler
POST   /api/containers/webhooks/gitlab             // GitLab webhook handler
POST   /api/containers/webhooks/bitbucket          // Bitbucket webhook handler
GET    /api/containers/services/:id/webhook-url    // Get webhook URL for service

// Builds
GET    /api/containers/builds/:id                  // Get build details
GET    /api/containers/builds/:id/logs             // Get build logs
POST   /api/containers/builds/:id/cancel           // Cancel build
```

#### Worker Management Routes (api/routes/workers.ts)

```typescript
// Worker management (admin only)
GET    /api/workers                                // List all workers
GET    /api/workers/:id                            // Get worker details
POST   /api/workers/generate-script                // Generate install script
POST   /api/workers/register                       // Register worker (auth token)
DELETE /api/workers/:id                            // Remove worker
POST   /api/workers/:id/drain                      // Drain worker
POST   /api/workers/:id/heartbeat                  // Update heartbeat (worker agent)

// Worker monitoring
GET    /api/workers/:id/metrics                    // Get worker metrics
GET    /api/workers/:id/containers                 // List containers on worker
GET    /api/workers/cluster/status                 // Get cluster status
```

#### Template Routes (api/routes/templates.ts)

```typescript
// Application templates
GET    /api/templates                              // List templates
GET    /api/templates/:id                          // Get template details
POST   /api/templates                              // Create template (admin)
PATCH  /api/templates/:id                          // Update template (admin)
DELETE /api/templates/:id                          // Delete template (admin)
POST   /api/templates/:id/deploy                   // Deploy from template
```

#### Secrets Routes (api/routes/secrets.ts)

```typescript
// Secret management
GET    /api/secrets                                // List secrets
POST   /api/secrets                                // Create secret
PATCH  /api/secrets/:id                            // Update secret
DELETE /api/secrets/:id                            // Delete secret
GET    /api/secrets/:id/services                   // List services using secret
```

### Frontend Components

#### Container Management Components (src/components/Containers/)

**ContainerServiceList.tsx**
- Lists all container services for organization
- Displays status, resource usage, and costs
- Provides quick actions (start, stop, restart, delete)
- Filters by status, template, or search query

**ContainerServiceDetail.tsx**
- Shows detailed service information
- Displays current deployment status
- Shows resource metrics charts
- Provides access to logs and deployments
- Allows configuration updates

**CreateContainerService.tsx**
- Multi-step wizard for service creation
- Template selection or custom Nix expression
- Git repository configuration with branch selection
- Resource limit selection with real-time cost estimates
  - Shows hourly, daily, and monthly cost projections
  - Compares costs across different resource configurations
  - Displays cost breakdown by resource type (CPU, memory, storage)
- Environment variable configuration with validation
- Secret selection and mounting options
- Webhook configuration for automatic deployments
- Review and confirm step with total estimated costs

**Design Rationale:**
Transparent cost estimation before deployment helps users make informed decisions about resource allocation. The wizard validates all inputs before submission to prevent deployment failures and provides clear feedback at each step.

**ContainerDeployments.tsx**
- Lists deployment history for a service
- Shows build status and logs
- Provides rollback functionality with confirmation dialog
- Displays deployment timeline with visual indicators
- Shows diff between deployments (environment variables, resource limits)
- Indicates currently active deployment
- Allows comparison between any two deployments

**Design Rationale:**
Rollback functionality is critical for production stability. The design preserves all deployment history and allows instant rollback to any previous version. The system maintains the previous container image and configuration, enabling zero-downtime rollbacks by starting the old version before stopping the new one.

**ContainerLogs.tsx**
- Real-time log streaming via WebSocket or SSE
- Log filtering by:
  - Log level (ERROR, WARN, INFO, DEBUG)
  - Time range (last hour, last 24 hours, custom range)
  - Text search with regex support
  - Container instance (for multi-replica services)
- Download logs functionality (JSON, plain text, or CSV)
- Auto-scroll toggle with "scroll to bottom" button
- Line wrapping and syntax highlighting options
- Timestamp display with timezone selection
- Log line numbers for reference
- Tail mode (last N lines) with configurable line count

**Design Rationale:**
Effective log viewing is critical for debugging. The component provides both real-time streaming for active monitoring and historical search for troubleshooting. The filtering options help users quickly find relevant log entries in high-volume applications.

**ContainerMetrics.tsx**
- Resource usage charts with 1-minute granularity:
  - CPU usage (percentage and absolute cores)
  - Memory usage (MB and percentage of limit)
  - Network I/O (bytes in/out, requests per second)
  - Disk I/O (read/write operations and throughput)
- Historical data visualization with time range selection:
  - Last hour, 24 hours, 7 days, 30 days
  - Custom date range picker
- Cost breakdown by resource type:
  - CPU costs, memory costs, storage costs, network costs
  - Cumulative costs over selected time period
  - Cost trend analysis and projections
- Visual alerts when approaching resource limits:
  - Warning at 80% utilization
  - Critical at 90% utilization
  - Historical limit breach indicators
- Export metrics data (CSV, JSON)
- Comparison view for multiple services

**Design Rationale:**
Detailed metrics help users optimize resource allocation and identify performance issues. The 1-minute granularity provides sufficient detail for troubleshooting while keeping data storage manageable. Cost visualization helps users understand their spending patterns.

#### Worker Management Components (src/components/admin/Workers/)

**WorkerList.tsx** (Admin only)
- Lists all worker nodes
- Shows status, capacity, and current load
- Provides worker actions (drain, remove)
- Displays cluster health overview

**WorkerDetail.tsx** (Admin only)
- Detailed worker information
- Resource utilization charts
- Lists containers running on worker
- Shows heartbeat history

**AddWorkerDialog.tsx** (Admin only)
- Generates installation script
- Displays setup instructions
- Shows script with auth token
- Provides copy-to-clipboard functionality

**WorkerMetrics.tsx** (Admin only)
- Cluster-wide resource utilization
- Worker comparison charts
- Capacity planning recommendations
- Historical performance data

#### Template Components (src/components/Containers/Templates/)

**TemplateLibrary.tsx**
- Grid view of available templates with preview cards
- Category filtering (web, api, worker, database, static, custom)
- Template search by name, description, or technology
- Quick deploy button for one-click deployment
- Template details modal showing:
  - Full description and use cases
  - Required environment variables
  - Default resource requirements
  - Estimated monthly cost
  - Sample applications using the template
- Popular templates section
- Recently used templates
- Organization-specific custom templates

**Design Rationale:**
A rich template library reduces the barrier to entry for new users. Pre-configured templates for popular frameworks (Next.js, Django, Rails, etc.) enable quick deployment without Nix expertise. The categorization and search help users find the right template quickly.

**TemplateCard.tsx**
- Template preview with icon
- Description and resource requirements
- Estimated monthly cost
- Deploy button

**TemplateEditor.tsx** (Admin only)
- Create/edit templates
- Nix expression editor with syntax highlighting
- Default environment variable configuration
- Resource limit presets
- Template preview


## Data Models

### Container Service Model

```typescript
interface ContainerService {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  templateId?: string;
  gitRepository?: string;
  gitBranch: string;
  buildConfig: {
    nixExpression?: string;
    buildCommand?: string;
    outputPath?: string;
    environmentType: 'nix' | 'docker' | 'buildpack';
  };
  environmentVars: Record<string, string>;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'deleted';
  currentDeploymentId?: string;
  publicUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Worker Node Model

```typescript
interface WorkerNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  swarmNodeId?: string;
  authTokenHash: string;
  status: 'pending' | 'active' | 'unhealthy' | 'draining' | 'offline';
  capacity: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  currentLoad: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    containerCount: number;
  };
  lastHeartbeatAt?: Date;
  metadata: {
    osVersion?: string;
    dockerVersion?: string;
    nixVersion?: string;
    region?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Deployment Model

```typescript
interface ContainerDeployment {
  id: string;
  serviceId: string;
  workerId?: string;
  swarmServiceId?: string;
  containerId?: string;
  imageTag: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'rolled_back';
  buildLogs?: string;
  deploymentLogs?: string;
  publicUrl?: string;
  internalPort?: number;
  externalPort?: number;
  deployedAt?: Date;
  stoppedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Application Template Model

```typescript
interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'api' | 'worker' | 'database' | 'static' | 'custom';
  iconUrl?: string;
  nixExpression: string;
  defaultEnvVars: Record<string, string>;
  defaultResourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  isActive: boolean;
  displayOrder: number;
  isMultiService: boolean;  // Indicates if template deploys multiple services
  services?: {              // For multi-service templates
    name: string;
    nixExpression: string;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
    };
    dependencies: string[]; // Service names this service depends on
    environmentVars: Record<string, string>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Multi-Service Template Support:**
Templates can define multiple related services (e.g., web application + database + cache). When deployed:
1. Services are created in dependency order
2. Internal networking is automatically configured
3. Environment variables are injected with connection details
4. All services are grouped for unified management
5. Billing is aggregated across all services in the group

**Multi-Service Deployment Process:**
1. User selects multi-service template (e.g., "Next.js + PostgreSQL + Redis")
2. System analyzes service dependencies defined in template
3. Creates services in dependency order:
   - First: Database services (PostgreSQL, Redis, etc.)
   - Second: Application services that depend on databases
   - Third: Proxy/gateway services if defined
4. For each service:
   - Deploys to organization's overlay network
   - Waits for health check to pass before proceeding to next service
   - Injects connection details as environment variables
5. Example environment variable injection:
   ```
   DATABASE_URL=postgres://postgres:5432/myapp
   REDIS_URL=redis://redis:6379
   ```
6. All services in the group share a common prefix in their slug: `{user-chosen-name}-{service-type}`
7. Services can be managed individually or as a group
8. Deleting the primary service optionally deletes all related services (user confirmation required)

**Example Multi-Service Templates:**
- **MERN Stack**: MongoDB + Express + React + Node.js
- **Rails Stack**: PostgreSQL + Redis + Rails app + Sidekiq worker
- **Microservices**: API Gateway + Auth Service + User Service + Shared Database
- **WordPress**: MySQL + WordPress + Redis cache
- **Django**: PostgreSQL + Django app + Celery worker + Redis

**Design Rationale:**
Many applications require multiple services to function (app + database, app + Redis, etc.). Multi-service templates simplify deployment of these common patterns and ensure proper configuration of service dependencies and networking. The dependency-aware deployment order prevents connection failures during startup, and automatic environment variable injection eliminates manual configuration errors.

### Build Model

```typescript
interface ContainerBuild {
  id: string;
  serviceId: string;
  deploymentId?: string;
  gitCommitSha?: string;
  buildStatus: 'pending' | 'building' | 'success' | 'failed' | 'cancelled';
  buildLogs?: string;
  imageTag?: string;
  buildDurationSeconds?: number;
  artifactSizeMb?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
```

## Error Handling

### Error Categories

**Validation Errors (400)**
- Invalid resource limits
- Missing required fields
- Invalid Nix expression syntax
- Duplicate service slug

**Authentication Errors (401)**
- Invalid worker auth token
- Expired JWT token
- Missing authentication

**Authorization Errors (403)**
- Insufficient permissions
- Organization quota exceeded
- Worker not authorized for organization

**Resource Errors (404)**
- Service not found
- Worker not found
- Deployment not found
- Template not found

**Conflict Errors (409)**
- Service already exists
- Worker already registered
- Deployment in progress
- Build already running for service

**Capacity Errors (507)**
- Insufficient cluster capacity
- Worker at capacity
- Organization quota exceeded

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: Record<string, any>;
  };
}
```

### Error Handling Patterns

**Service Layer:**
- Validate inputs before operations
- Use transactions for multi-step operations
- Log errors with context
- Return normalized error objects

**API Layer:**
- Catch service errors and map to HTTP status codes
- Return consistent error format
- Log request context with errors
- Send error notifications for critical failures

**Frontend Layer:**
- Display user-friendly error messages
- Provide actionable error recovery steps
- Log errors to monitoring service
- Show toast notifications for errors

**Build Failure Handling:**
When a build fails, the system:
1. Preserves the currently running container version (no disruption)
2. Stores complete build logs for debugging
3. Sends notification to user with failure reason
4. Provides actionable suggestions based on error type:
   - Dependency resolution failures: Check Nix expression syntax
   - Git clone failures: Verify repository access and credentials
   - Build timeout: Consider increasing build time limit or optimizing build
   - Out of memory: Increase build worker resources
5. Allows retry with same or modified configuration
6. Tracks build failure rate for monitoring

**Design Rationale:**
Build failures should never impact running services. By preserving the current deployment and providing detailed error information, users can troubleshoot and retry without downtime. The actionable suggestions help users resolve common issues quickly.


## Testing Strategy

### Unit Tests

**Backend Services:**
- `ContainerService`: Test service CRUD operations, deployment logic, status transitions
- `SwarmOrchestrator`: Mock Docker API, test service creation, scaling, removal
- `WorkerService`: Test registration, heartbeat processing, health monitoring
- `NixBuildService`: Mock Nix commands, test build pipeline, error handling
- `ContainerBillingService`: Test cost calculations, billing cycles, wallet deductions

**Frontend Components:**
- `ContainerServiceList`: Test rendering, filtering, sorting
- `CreateContainerService`: Test form validation, step navigation, submission
- `WorkerList`: Test admin-only access, worker actions
- `TemplateLibrary`: Test template filtering, deployment initiation

### Integration Tests

**API Endpoints:**
- Test complete request/response cycles
- Verify authentication and authorization
- Test error handling and validation
- Verify database transactions

**Build Pipeline:**
- Test Git repository cloning
- Test Nix expression evaluation
- Test Docker image creation
- Test image registry push

**Billing Integration:**
- Test hourly billing execution
- Verify wallet deductions
- Test billing cycle creation
- Verify transaction records

### End-to-End Tests

**Service Deployment Flow:**
1. Create service from template
2. Trigger deployment
3. Monitor build progress
4. Verify service running
5. Access service URL
6. Check billing records

**Worker Management Flow:**
1. Generate worker script
2. Register worker
3. Verify worker active
4. Deploy service to worker
5. Drain worker
6. Remove worker

**Rollback Flow:**
1. Deploy service version 1
2. Deploy service version 2
3. Trigger rollback
4. Verify version 1 running
5. Check deployment history

### Performance Tests

**Load Testing:**
- Concurrent service deployments
- Multiple worker heartbeats
- High-frequency log streaming
- Billing cycle processing

**Capacity Testing:**
- Maximum services per organization
- Maximum containers per worker
- Maximum workers in cluster
- Database query performance

### Security Tests

**Authentication:**
- Test JWT validation
- Test worker token validation
- Test expired token handling

**Authorization:**
- Test organization isolation
- Test admin-only endpoints
- Test resource ownership

**Input Validation:**
- Test SQL injection prevention
- Test XSS prevention
- Test command injection in Nix expressions
- Test path traversal in Git URLs

## Deployment Architecture

### Prerequisites and Initial Setup

**Manager Node Requirements:**
- Existing SkyPanelV2 installation (PostgreSQL, Redis, Node.js)
- Docker Engine installed (version 20.10+)
- Docker Swarm initialized on the manager node
- Traefik reverse proxy installed and configured (or Nginx as alternative)
- Nix package manager installed (optional for manager, required for workers)
- Sufficient resources: 2+ CPU cores, 4+ GB RAM, 20+ GB disk

**Initial Setup Steps:**
1. **Database Migration**: Run container platform migration to create new tables
   ```bash
   node scripts/run-migration.js
   ```

2. **Initialize Docker Swarm** (if not already initialized):
   ```bash
   docker swarm init --advertise-addr <MANAGER_IP>
   ```

3. **Install Traefik** (for reverse proxy):
   ```bash
   docker service create \
     --name traefik \
     --constraint=node.role==manager \
     --publish 80:80 \
     --publish 443:443 \
     --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
     traefik:v2.10 \
     --providers.docker.swarmMode=true \
     --entrypoints.web.address=:80 \
     --entrypoints.websecure.address=:443
   ```

4. **Configure Environment Variables**: Add to `.env`
   ```bash
   # Container Platform Configuration
   DOCKER_SWARM_ADVERTISE_ADDR=<MANAGER_IP>
   CONTAINER_BILLING_ENABLED=true
   WORKER_HEARTBEAT_INTERVAL=30
   WORKER_HEARTBEAT_TIMEOUT=120
   ```

5. **Start SkyPanelV2**: The container platform features are now available
   ```bash
   npm run build
   npm run start
   ```

**Out-of-Box Functionality:**
After completing the initial setup, the following features work immediately:
- ✅ Container service creation and management UI
- ✅ Template library (requires seeding default templates)
- ✅ Embedded worker for development (`npm run dev:all`)
- ✅ Billing integration (uses existing wallet system)
- ✅ Real-time notifications (uses existing infrastructure)
- ✅ Authentication and authorization (uses existing JWT system)

**Additional Setup for Production:**
- ⚠️ **Worker Nodes**: Must be manually added via admin dashboard (generates installation script)
- ⚠️ **Default Templates**: Must be seeded or created via admin UI
- ⚠️ **SSL Certificates**: Traefik can auto-provision via Let's Encrypt (requires DNS configuration)
- ⚠️ **Nix Binary Cache**: Optional but recommended for faster builds (configure `NIX_CACHE_URL`)

**What Works Immediately vs. What Requires Setup:**

| Feature | Works Out-of-Box | Requires Setup |
|---------|------------------|----------------|
| Container UI | ✅ Yes | - |
| Embedded Worker (Dev) | ✅ Yes | - |
| Database Schema | ✅ Yes (after migration) | - |
| API Endpoints | ✅ Yes | - |
| Billing Integration | ✅ Yes | - |
| Production Workers | ❌ No | Add via admin dashboard |
| Application Templates | ❌ No | Seed or create templates |
| SSL/TLS for Services | ❌ No | Configure Traefik + DNS |
| Nix Build Cache | ❌ No | Optional: Configure cache URL |
| Git Webhooks | ✅ Yes | Configure in Git provider |

**Design Rationale:**
The container platform is designed to integrate seamlessly with existing SkyPanelV2 infrastructure. Most features work immediately after running the database migration and initializing Docker Swarm. The embedded worker enables local development without additional setup. Production deployments require adding worker nodes and configuring templates, but these are one-time setup tasks performed through the admin UI.

### Development Environment

**Embedded Worker Mode:**
```bash
npm run dev:all
```

This command starts:
1. Frontend dev server (Vite on port 5173)
2. Backend API server (Express on port 3001)
3. Embedded worker agent (auto-registers with database)
4. Local Docker Swarm (single-node mode)

**Configuration:**
- Uses `.env` for database connection
- Auto-generates worker auth token on first run
- Registers worker as `dev-worker-{hostname}`
- Enables debug logging for all container operations
- Automatically initializes single-node Docker Swarm
- Uses local Docker daemon (no remote connection needed)
- Stores worker state in `.dev-worker-state.json`

**Development Workflow:**
1. Developer runs `npm run dev:all`
2. System checks if Docker is running locally
3. Initializes Docker Swarm if not already initialized
4. Starts embedded worker process alongside API server
5. Worker auto-registers with database using `CLIENT_URL` from `.env`
6. Developer can deploy and test containers locally
7. All container features work identically to production
8. On shutdown, worker gracefully stops containers and updates status

**Implementation Details:**
The `npm run dev:all` command will be implemented using `concurrently` to run multiple processes:
```json
{
  "scripts": {
    "dev:all": "concurrently \"npm run server:dev\" \"npm run client:dev\" \"npm run worker:dev\"",
    "worker:dev": "node api/worker/embedded-worker.js"
  }
}
```

The embedded worker (`api/worker/embedded-worker.js`) will:
- Read database connection from `DATABASE_URL` in `.env`
- Generate or load a persistent worker auth token from `.dev-worker-state.json`
- Auto-register with the database as `dev-worker-{hostname}` on first run
- Initialize single-node Docker Swarm if not already initialized
- Start heartbeat loop (30-second interval)
- Listen for deployment commands from the API
- Gracefully shutdown on SIGTERM/SIGINT

**Design Rationale:**
The embedded worker eliminates the need for separate worker setup during development. Developers can test the complete container platform workflow on their local machine without additional infrastructure. This significantly reduces the development feedback loop and ensures feature parity between development and production environments. Using `concurrently` keeps the implementation simple and consistent with existing development patterns in SkyPanelV2.

### Production Environment

**Manager Node:**
- Runs SkyPanelV2 application (frontend + API)
- Runs Docker Swarm manager
- Manages worker registration
- Processes billing cycles

**Worker Nodes:**
- Run lightweight worker agent
- Join Docker Swarm as worker nodes
- Report heartbeat every 30 seconds
- Execute container workloads

**Installation Script:**
```bash
#!/bin/bash
# Generated by SkyPanelV2 Admin Dashboard

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Nix
curl -L https://nixos.org/nix/install | sh

# Join Docker Swarm
docker swarm join --token <SWARM_TOKEN> <MANAGER_IP>:2377

# Install worker agent
curl -o /usr/local/bin/skypanel-worker \
  https://<CLIENT_URL_FROM_ENV>/worker-agent

chmod +x /usr/local/bin/skypanel-worker

# Configure worker
cat > /etc/skypanel-worker.conf <<EOF
CLIENT_URL=<CLIENT_URL_FROM_ENV>
AUTH_TOKEN=<WORKER_AUTH_TOKEN>
WORKER_NAME=<WORKER_NAME>
EOF

# Start worker service
systemctl enable skypanel-worker
systemctl start skypanel-worker
```

### Scaling Considerations

**Horizontal Scaling:**
- Add more worker nodes for capacity
- Load balance across workers
- Distribute containers evenly

**Vertical Scaling:**
- Increase worker node resources
- Adjust resource limits per service
- Optimize container resource usage

**Database Scaling:**
- Use connection pooling
- Add read replicas for queries
- Partition billing data by month

**Caching Strategy:**
- Cache worker status (30 seconds)
- Cache template list (5 minutes)
- Cache service metrics (1 minute)
- Use Redis for distributed caching


## Security Architecture

### Authentication & Authorization

**Worker Authentication:**
- Workers authenticate using JWT tokens generated during registration
- Tokens include worker ID and expiration
- Tokens are validated on every heartbeat and operation
- Expired tokens require re-registration

**User Authentication:**
- Reuses existing JWT authentication system
- Container operations require valid user session
- API keys can be used for programmatic access

**Authorization Model:**
- Organization-based isolation for all container resources
- Admin users can manage workers and templates
- Regular users can only manage their organization's services
- Workers can only report metrics and receive deployment commands

### Network Security

**Container Isolation:**
- Each organization has isolated Docker overlay network
- Network namespace isolation prevents cross-organization communication
- Containers cannot communicate across organizations by default
- Internal DNS for service discovery within organization (service-name.internal)
- External access only through configured ports via reverse proxy
- Network policies enforced at Docker Swarm level
- Optional inter-service communication within organization via internal network

**Service Discovery Implementation:**
When containers within the same organization need to communicate:
1. Each organization gets a dedicated Docker overlay network: `org-{organizationId}-network`
2. All containers for that organization are attached to the organization's network
3. Docker Swarm provides built-in DNS resolution for service names
4. Services can reference each other using: `{service-slug}.internal` or just `{service-slug}`
5. Example: A web app can connect to its database using `postgres://my-database:5432`
6. DNS resolution is automatic and requires no additional configuration
7. Network traffic between services in the same organization stays within the overlay network (no external routing)

**External Access Control:**
- By default, containers have no external network access (ingress or egress)
- Users can enable external access per service via the dashboard
- When enabled, the service is assigned a public endpoint: `{service-slug}.{CLIENT_URL}`
- Reverse proxy (Traefik) routes external traffic to the appropriate container
- Egress filtering can be configured per organization (allow/deny external API calls)
- Rate limiting and DDoS protection applied at the reverse proxy level

**Cross-Organization Communication:**
- Blocked by default at the Docker network level
- Can be explicitly enabled by administrators for specific service pairs
- Requires creation of a shared network bridge with firewall rules
- All cross-organization traffic is logged for audit purposes

**Design Rationale:**
Multi-tenant isolation is critical for security and compliance. Docker overlay networks provide strong isolation guarantees while allowing flexible communication patterns within an organization. The internal DNS system simplifies service-to-service communication without exposing internal IPs. Default-deny external access prevents accidental data exfiltration and reduces attack surface.

**Worker Communication:**
- Workers communicate with manager over TLS
- Heartbeat and metrics sent via HTTPS
- Docker Swarm encrypted overlay network
- Firewall rules restrict worker-to-worker communication

**Public Access:**
- Services exposed via reverse proxy (Traefik or Nginx)
- Automatic SSL/TLS certificate provisioning via Let's Encrypt
- Optional custom domain support with DNS validation
- Rate limiting per service (configurable, default: 100 req/min)
- DDoS protection at edge with connection limits
- HTTP/2 and WebSocket support
- Automatic HTTP to HTTPS redirect

**Design Rationale:**
Using Traefik as the reverse proxy provides automatic service discovery via Docker labels, built-in Let's Encrypt integration, and dynamic configuration updates without restarts. This eliminates manual certificate management and simplifies the deployment process for users.

### Secrets Management

**Secret Storage:**
- Secrets encrypted using existing crypto infrastructure
- Encryption key stored in environment variable
- Secrets never logged or exposed in API responses
- Audit log for secret access

**Secret Injection:**
- Secrets injected as environment variables at runtime
- Secrets can be mounted as files in containers (read-only)
- Multiple injection methods supported per secret
- Secrets never appear in logs or API responses

**Secret Rotation:**
- Update secret value without changing secret ID
- Options for handling rotation:
  - **Automatic restart**: Restart affected containers immediately
  - **Manual restart**: User triggers restart when ready
  - **Rolling restart**: Gradual restart for zero-downtime
- Old secret values retained for 30 days for rollback scenarios
- Rotation audit trail with timestamps and user information
- Notification sent to service owners on secret rotation

**Design Rationale:**
Flexible secret rotation strategies accommodate different application requirements. Some applications can reload secrets dynamically, while others require restarts. The retention of old values enables quick rollback if a rotated secret causes issues.

**Secret Access Control:**
- Secrets scoped to organization
- Services explicitly reference secrets
- Audit trail for secret usage
- Automatic secret expiration

### Resource Limits & Quotas

**Per-Service Limits:**
- CPU cores: 0.5 - 16 cores
- Memory: 256 MB - 32 GB
- Disk: 1 GB - 500 GB
- Network bandwidth: 1 Gbps per service
- Request rate: 100 requests/minute (configurable per service)
- Concurrent connections: 1000 (configurable per service)
- Build time: 30 minutes maximum
- Log retention: 30 days per service

**Per-Organization Quotas:**
- Maximum services: Configurable (default 50)
- Maximum total CPU: Configurable (default 64 cores)
- Maximum total memory: Configurable (default 128 GB)
- Maximum total storage: Configurable (default 1 TB)

**Enforcement:**
- Quotas checked before service creation and updates
- Pre-deployment validation prevents quota violations
- Resource limits enforced by Docker cgroups at runtime
- Billing alerts when approaching limits:
  - 80% utilization: Warning notification
  - 90% utilization: Critical notification
  - 100% utilization: Deployment blocked
- Automatic service suspension on quota breach (configurable)
- Grace period for quota violations (default: 24 hours)
- Administrators can override quotas on per-organization basis

**Quota Enforcement Timing:**
1. **Pre-Deployment Check** (Synchronous):
   - When user submits service creation/update request
   - Calculate total resources if deployment succeeds
   - Compare against organization quotas
   - Reject request immediately if quota would be exceeded
   - Return error with current usage and available capacity

2. **Runtime Enforcement** (Continuous):
   - Docker cgroups enforce CPU, memory, and disk limits per container
   - Containers cannot exceed their allocated resources
   - If container attempts to exceed limits, it is throttled (CPU) or OOM-killed (memory)
   - Automatic restart with same limits if OOM occurs

3. **Quota Recalculation** (Every 30 seconds):
   - Worker heartbeats report actual resource usage
   - System recalculates organization's total resource consumption
   - Updates quota utilization percentages
   - Triggers notifications if thresholds crossed

4. **Quota Violation Handling**:
   - If organization exceeds quota (e.g., due to administrator quota reduction):
     - Send immediate notification to organization administrators
     - Start grace period timer (default: 24 hours)
     - Block new deployments until under quota
     - After grace period: Optionally stop services (oldest first) until under quota
     - Log all quota violations in audit log

**Design Rationale:**
Proactive quota enforcement prevents resource exhaustion and ensures fair usage. The warning system gives users time to adjust their resource allocation before hitting hard limits. Administrator overrides provide flexibility for special cases while maintaining overall platform stability. The grace period for violations prevents immediate service disruption while encouraging compliance.

### Audit Logging

**Container Events:**
- Service creation, updates, deletion
- Deployments and rollbacks
- Configuration changes
- Secret access

**Worker Events:**
- Worker registration and removal
- Heartbeat failures
- Capacity changes
- Security incidents

**Billing Events:**
- Billing cycles processed
- Wallet deductions
- Failed billing attempts
- Quota breaches

**Log Retention:**
- Activity logs: 90 days
- Build logs: 30 days
- Deployment logs: 30 days
- Audit logs: 1 year

## Monitoring & Observability

### Metrics Collection

**Service Metrics:**
- CPU usage (percentage and cores)
- Memory usage (MB and percentage)
- Network I/O (bytes in/out)
- Disk I/O (read/write operations)
- Request count and latency
- Error rate

**Worker Metrics:**
- CPU utilization
- Memory utilization
- Disk utilization
- Container count
- Network throughput
- Heartbeat latency

**Cluster Metrics:**
- Total capacity (CPU, memory, disk)
- Total utilization
- Service count
- Deployment success rate
- Build success rate
- Average build time

### Alerting

**Critical Alerts:**
- Worker offline for > 5 minutes
- Service deployment failed
- Billing failure
- Cluster capacity < 10%
- Security incident detected

**Warning Alerts:**
- Worker unhealthy
- Service using > 90% of resource limits
- Organization approaching quota
- Build taking > 15 minutes
- High error rate

**Info Alerts:**
- New worker registered
- Service deployed successfully
- Billing cycle completed
- Worker drained

### Logging

**Structured Logging:**
- JSON format for all logs
- Include request ID, user ID, organization ID
- Include timestamp and log level
- Include service/worker context

**Log Aggregation:**
- Centralized log collection
- Searchable log interface
- Log filtering by service, worker, organization
- Real-time log streaming

**Log Levels:**
- ERROR: Critical failures requiring immediate attention
- WARN: Potential issues or degraded performance
- INFO: Normal operations and state changes
- DEBUG: Detailed diagnostic information

### Health Checks

**Service Health:**
- HTTP health check endpoint
- TCP port check
- Custom health check command
- Configurable check interval and timeout

**Worker Health:**
- Heartbeat every 30 seconds
- Resource utilization checks
- Docker daemon health
- Nix availability check

**Cluster Health:**
- Swarm manager health
- Network connectivity
- Storage availability
- Database connectivity

## Migration Strategy

### Phase 1: Foundation (Weeks 1-3)

**Database Schema:**
- Create all container-related tables
- Add indexes and constraints
- Set up triggers for updated_at columns

**Backend Services:**
- Implement `ContainerService` with basic CRUD
- Implement `WorkerService` with registration
- Implement `SwarmOrchestrator` with Docker integration
- Extend `BillingService` for containers

**API Routes:**
- Implement container service endpoints
- Implement worker management endpoints
- Add authentication and authorization

**Frontend Components:**
- Create basic container service list
- Create service creation wizard
- Create worker management dashboard (admin)

### Phase 2: Nix Integration (Weeks 4-6)

**Nix Build Service:**
- Implement `NixBuildService`
- Add Nix expression validation
- Create build pipeline
- Implement image registry integration

**Application Templates:**
- Create template database and API
- Implement template CRUD operations
- Create default templates (Node.js, Python, Go, static)
- Build template library UI

**Build Monitoring:**
- Add build status tracking
- Implement build log streaming
- Create build history UI
- Add build cancellation

### Phase 3: Billing & Monitoring (Weeks 7-8)

**Container Billing:**
- Implement `ContainerBillingService`
- Add hourly billing job
- Create billing history UI
- Add cost estimation

**Monitoring:**
- Implement metrics collection
- Add real-time log streaming
- Create metrics dashboard
- Implement alerting

### Phase 4: Advanced Features (Weeks 9-12)

**Embedded Worker:**
- Create `npm run dev:all` command
- Implement auto-registration
- Add development mode indicators
- Test local deployment workflow

**Secrets Management:**
- Implement secret CRUD operations
- Add secret encryption
- Create secret injection mechanism
- Build secrets UI

**Advanced Nix:**
- Add custom Nix expression support
- Implement multi-stage builds
- Add Nix package caching
- Create Nix expression editor

**Production Readiness:**
- Performance optimization
- Security hardening
- Documentation
- Load testing



## Configuration Management

### Environment Variables

The container platform will use existing environment variables from `.env`:

**Manager Configuration:**
- `CLIENT_URL`: Used as the MANAGER_URL for worker registration and API communication
- `VITE_API_URL`: Backend API endpoint for worker heartbeat and operations
- `DATABASE_URL`: PostgreSQL connection for worker registration and service data
- `REDIS_URL`: Redis connection for caching and pub/sub

**New Environment Variables:**
- `DOCKER_SWARM_ADVERTISE_ADDR`: IP address for Swarm manager (defaults to primary interface)
- `DOCKER_REGISTRY_URL`: Internal Docker registry URL (optional, defaults to local)
- `NIX_CACHE_URL`: Nix binary cache URL (optional, for faster builds)
- `CONTAINER_BILLING_ENABLED`: Enable/disable container billing (default: true)
- `WORKER_HEARTBEAT_INTERVAL`: Heartbeat interval in seconds (default: 30)
- `WORKER_HEARTBEAT_TIMEOUT`: Timeout before marking worker unhealthy in seconds (default: 120)

**Worker Script Generation:**
When generating the worker installation script, the system will:
1. Read `CLIENT_URL` from `.env`
2. Generate a unique auth token for the worker
3. Include the `CLIENT_URL` directly in the worker configuration
4. Include the Swarm join token from the manager node

**Example Worker Configuration:**
```bash
# /etc/skypanel-worker.conf
CLIENT_URL=${CLIENT_URL}  # Uses CLIENT_URL from SkyPanelV2's .env
AUTH_TOKEN=<generated-jwt-token>
WORKER_NAME=worker-${HOSTNAME}
HEARTBEAT_INTERVAL=30
```

This ensures consistency with the existing SkyPanelV2 configuration and avoids duplicate URL management.

## Design Summary

This design document outlines a comprehensive Container-as-a-Service platform that extends SkyPanelV2 with the following key capabilities:

**Core Features:**
- **Worker Management**: Simple dashboard-driven worker provisioning with auto-generated installation scripts
- **Embedded Development**: One-command local development environment with full container platform functionality
- **Nix-Based Builds**: Reproducible builds using Nix package manager with fallback to Docker
- **Automatic Deployments**: Git webhook integration for CI/CD workflows
- **Multi-Tenant Isolation**: Organization-based network isolation and resource quotas
- **Hourly Billing**: Seamless integration with existing wallet-based billing system
- **Real-Time Monitoring**: Live logs, metrics, and notifications using existing infrastructure
- **Template Library**: Pre-configured templates for common frameworks and multi-service applications
- **Secrets Management**: Encrypted secrets with flexible injection and rotation strategies

**Design Principles Applied:**
1. **Leverage Existing Infrastructure**: Reuses authentication, billing, notifications, and database patterns from SkyPanelV2
2. **Developer-Friendly**: Embedded worker mode and intuitive UI reduce complexity
3. **Production-Ready**: Automatic health monitoring, container migration, and rollback capabilities
4. **Transparent Pricing**: Real-time cost estimation and detailed billing breakdowns
5. **Security-First**: Multi-tenant isolation, encrypted secrets, and comprehensive audit logging

**Integration Points:**
- Extends existing PostgreSQL schema with container-specific tables
- Reuses JWT authentication and organization-based authorization
- Integrates with PayPal wallet system for billing
- Uses PostgreSQL LISTEN/NOTIFY for real-time notifications
- Follows established API patterns and error handling conventions

This design provides a solid foundation for implementing a production-grade container platform while maintaining consistency with SkyPanelV2's architecture and user experience.
