# Implementation Plan

## Phase 1: Foundation & Infrastructure

- [-] 1. Initial setup and configuration
  - [-] 1.1 Update .env.example with container platform variables
    - Add DOCKER_SWARM_ADVERTISE_ADDR with description
    - Add DOCKER_REGISTRY_URL (optional)
    - Add NIX_CACHE_URL (optional)
    - Add CONTAINER_BILLING_ENABLED (default: true)
    - Add WORKER_HEARTBEAT_INTERVAL (default: 30)
    - Add WORKER_HEARTBEAT_TIMEOUT (default: 120)
    - _Requirements: All_
  - [ ] 1.2 Create container platform directory structure
    - Create api/services/containers/ directory
    - Create api/routes/containers/ directory (if using subdirectories)
    - Create api/worker/ directory for worker agent
    - Create api/middleware/workerAuth.ts
    - Create src/components/Containers/ directory
    - Create src/components/admin/Workers/ directory
    - _Requirements: All_

- [ ] 2. Database schema and migrations
  - [ ] 2.1 Create migration file with all container-related tables
    - Create `container_workers` table with status tracking and capacity fields
    - Create `container_services` table with organization isolation and resource limits
    - Create `container_deployments` table with build and deployment logs
    - Create `application_templates` table with Nix expressions and multi-service support
    - Create `container_builds` table for build tracking
    - Create `container_secrets` table with encryption
    - Create `container_service_secrets` junction table
    - Create `container_billing_cycles` table for hourly billing
    - _Requirements: 1.3, 3.2, 4.4, 6.4, 11.1_
  - [ ] 2.2 Add indexes for performance optimization
    - Add indexes on foreign keys (organization_id, service_id, worker_id)
    - Add indexes on status fields for filtering
    - Add indexes on timestamp fields for time-based queries
    - Add composite indexes for common query patterns
    - _Requirements: All_
  - [ ] 2.3 Set up triggers for updated_at columns
    - Create trigger function for automatic timestamp updates
    - Apply trigger to all container tables
    - _Requirements: All_
  - [ ] 2.4 Create seed script for default application templates
    - Create templates for Node.js, Python, Go, static sites
    - Include multi-service templates (MERN, Rails, Django)
    - Set default resource limits and environment variables
    - _Requirements: 6.1, 6.4_

## Phase 2: Backend Services & API

- [ ] 3. Backend service layer - Core container management
  - [ ] 3.1 Implement ContainerService for CRUD operations
    - Create service with validation and quota checks
    - Update service configuration
    - Delete service with cleanup
    - List services with filtering and pagination
    - Get service details with current deployment
    - _Requirements: 3.1, 3.2, 3.5, 8.2_

  - [ ] 3.2 Implement service lifecycle actions
    - Start service (create deployment if needed)
    - Stop service (preserve data and configuration)
    - Restart service (without rebuilding)
    - Rebuild service (trigger new build and deploy)
    - All actions complete within 5 seconds or return async status
    - _Requirements: 3.5_

  - [ ] 3.3 Implement service status tracking and transitions
    - Track status changes (pending → building → deploying → running)
    - Handle failure states and error recovery
    - Update current_deployment_id on successful deployment
    - _Requirements: 3.4_

- [ ] 4. Docker Swarm orchestration
  - [ ] 4.1 Implement SwarmOrchestrator service
    - Initialize Swarm manager node
    - Deploy container to Swarm with resource limits
    - Scale service replicas
    - Remove service from Swarm
    - Get service status and health
    - _Requirements: 3.3, 9.2_

  - [ ] 4.2 Implement network isolation per organization
    - Create organization-specific overlay networks
    - Attach containers to organization networks
    - Configure internal DNS for service discovery
    - Block cross-organization communication
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 4.3 Implement service update and rollback
    - Update service configuration without downtime
    - Rollback to previous deployment
    - Preserve previous container images for rollback
    - Zero-downtime deployment (start new before stopping old)
    - _Requirements: 7.3_

- [ ] 5. Worker node management
  - [ ] 5.1 Implement WorkerService for registration and management
    - Generate installation script with auth token
    - Register worker node with validation
    - Update worker status and capacity
    - List workers with filtering
    - Remove and drain workers
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 5.2 Implement worker heartbeat and health monitoring
    - Process heartbeat updates every 30 seconds
    - Track resource metrics (CPU, memory, disk)
    - Mark workers unhealthy after 2 minutes of missed heartbeats
    - Detect resource exhaustion (CPU > 90%, memory > 95%, disk > 90%)
    - Send real-time alerts to administrators
    - _Requirements: 1.4, 12.1, 12.2, 12.5_

  - [ ] 5.3 Implement automatic container migration on worker failure
    - Detect worker failure and identify affected containers
    - Select healthy worker with available capacity
    - Migrate containers using existing images
    - Update service routing to new instances
    - Notify users of migration
    - Support configurable migration policies (automatic, manual, none)
    - _Requirements: 12.3, 12.4_

- [ ] 6. Nix build pipeline
  - [ ] 6.1 Implement NixBuildService for build orchestration
    - Build from Nix expression with dependency resolution
    - Build from Git repository (clone, build, package)
    - Build from application template
    - Get build status and logs
    - Cancel running builds
    - _Requirements: 4.1, 4.2, 7.2_

  - [ ] 6.2 Implement Git repository integration
    - Validate Git URLs and branch access
    - Clone repositories (support private repos via SSH keys/tokens)
    - Implement shallow clones for faster builds
    - Store commit SHA for traceability
    - _Requirements: 7.1, 7.5_

  - [ ] 6.3 Implement build pipeline execution
    - Create Docker image from Nix build output
    - Push image to internal registry
    - Track build duration and artifact size
    - Store build logs for debugging
    - Handle build failures without disrupting running services
    - _Requirements: 4.2, 7.4_

  - [ ] 6.4 Implement Nix package caching
    - Cache common packages on worker nodes
    - Share Nix store across builds
    - Support external Nix binary cache
    - _Requirements: 4.3_

- [ ] 7. Git webhook integration
  - [ ] 7.1 Implement WebhookService for Git providers
    - Generate unique webhook URLs per service
    - Validate webhook signatures (GitHub, GitLab, Bitbucket)
    - Extract commit information from webhook payload
    - Check if branch matches service configuration
    - _Requirements: 7.1_

  - [ ] 7.2 Implement automatic build triggering
    - Trigger build via NixBuildService on webhook
    - Send notification to user about build start
    - Process webhooks asynchronously
    - Return 200 OK immediately
    - _Requirements: 7.1, 7.2_

  - [ ] 7.3 Implement automatic deployment on build success
    - Deploy new version when build completes
    - Preserve previous deployment for rollback
    - Perform health check before routing traffic
    - Automatic rollback if health check fails
    - _Requirements: 7.3_

- [ ] 8. Application templates
  - [ ] 8.1 Implement template CRUD operations
    - Create template with Nix expression validation
    - Update template configuration
    - Delete template (prevent if in use)
    - List templates with filtering by category
    - Get template details
    - _Requirements: 6.4_

  - [ ] 8.2 Implement template deployment
    - Pre-populate service configuration from template
    - Apply template's Nix expression and environment variables
    - Set default resource limits from template
    - _Requirements: 6.2, 6.3_

  - [ ] 8.3 Implement multi-service template support
    - Deploy services in dependency order
    - Configure internal networking between services
    - Inject connection details as environment variables
    - Group services for unified management
    - Handle cascading deletion with user confirmation
    - _Requirements: 6.5_

- [ ] 9. Container billing integration
  - [ ] 9.1 Implement ContainerBillingService
    - Calculate resource costs (CPU, memory, storage, network, build time)
    - Track usage in container_billing_cycles table
    - Integrate with existing PayPalService for wallet deductions
    - Create payment_transactions records
    - _Requirements: 5.1, 5.2_

  - [ ] 9.2 Implement hourly billing reconciliation
    - Run hourly billing job for all running containers
    - Calculate costs based on resource usage
    - Attempt wallet deduction
    - Send notifications on success or failure
    - Start grace period on payment failure
    - _Requirements: 5.2, 5.5_

  - [ ] 9.3 Implement billing dashboard and history
    - Display itemized container costs
    - Show breakdown by service, resource type, and time period
    - Provide cost estimation before deployment
    - Show real-time cost projections (hourly, daily, monthly)
    - _Requirements: 5.3, 5.4_

- [ ] 10. Resource quotas and limits
  - [ ] 10.1 Implement quota enforcement
    - Check quotas before service creation (synchronous)
    - Enforce runtime limits via Docker cgroups
    - Recalculate quota utilization every 30 seconds
    - Block deployments when quota exceeded
    - _Requirements: 8.1, 8.2_

  - [ ] 10.2 Implement quota notifications and alerts
    - Send warning at 80% utilization
    - Send critical alert at 90% utilization
    - Block deployment at 100% utilization
    - Handle quota violations with grace period
    - _Requirements: 8.3_

  - [ ] 10.3 Implement quota management UI
    - Display current quota usage and limits
    - Show per-organization resource consumption
    - Allow administrators to configure quotas
    - Provide quota override functionality
    - _Requirements: 8.4, 8.5_

- [ ] 11. Secrets management
  - [ ] 11.1 Implement secret CRUD operations
    - Create secret with encryption
    - Update secret value
    - Delete secret (prevent if in use)
    - List secrets for organization
    - Audit secret access
    - _Requirements: 11.1, 11.5_

  - [ ] 11.2 Implement secret injection
    - Inject secrets as environment variables
    - Mount secrets as files in containers
    - Support multiple injection methods per secret
    - Never expose secrets in logs or API responses
    - _Requirements: 11.2_

  - [ ] 11.3 Implement secret rotation
    - Update secret with automatic or manual restart options
    - Support rolling restart for zero-downtime
    - Retain old secret values for 30 days
    - Track rotation audit trail
    - Send notifications to service owners
    - _Requirements: 11.3_

- [ ] 12. Monitoring and logging
  - [ ] 12.1 Implement real-time log streaming
    - Stream container logs via WebSocket or SSE
    - Support log filtering by level, time range, and text search
    - Provide download functionality (JSON, plain text, CSV)
    - Implement auto-scroll and tail mode
    - _Requirements: 10.1_

  - [ ] 12.2 Implement metrics collection and visualization
    - Collect CPU, memory, network, and disk metrics (1-minute granularity)
    - Store metrics in Redis with appropriate TTL
    - Display resource usage charts with time range selection
    - Show cost breakdown by resource type
    - Provide visual alerts when approaching limits
    - _Requirements: 10.2_

  - [ ] 12.3 Implement notification system integration
    - Send build events (started, completed, failed)
    - Send deployment events (started, completed, failed, rollback)
    - Send service events (started, stopped, crashed, restarted)
    - Send resource events (limit reached, quota warning)
    - Send worker events (offline, unhealthy, recovered)
    - Use existing PostgreSQL LISTEN/NOTIFY and SSE infrastructure
    - _Requirements: 10.3_

## Phase 3: API Routes & Middleware

- [ ] 13. API routes and middleware
  - [ ] 13.1 Implement container service routes
    - POST /api/containers/services (create service)
    - GET /api/containers/services (list services)
    - GET /api/containers/services/:id (get service details)
    - PATCH /api/containers/services/:id (update service)
    - DELETE /api/containers/services/:id (delete service)
    - POST /api/containers/services/:id/deploy (deploy service)
    - POST /api/containers/services/:id/start (start service)
    - POST /api/containers/services/:id/stop (stop service)
    - POST /api/containers/services/:id/restart (restart service)
    - POST /api/containers/services/:id/rebuild (rebuild service)
    - GET /api/containers/services/:id/logs (get logs)
    - GET /api/containers/services/:id/metrics (get metrics)
    - _Requirements: 3.1, 3.5_

  - [ ] 13.2 Implement worker management routes
    - GET /api/workers (list workers - admin only)
    - GET /api/workers/:id (get worker details - admin only)
    - POST /api/workers/generate-script (generate install script - admin only)
    - POST /api/workers/register (register worker - worker auth)
    - DELETE /api/workers/:id (remove worker - admin only)
    - POST /api/workers/:id/drain (drain worker - admin only)
    - POST /api/workers/:id/heartbeat (update heartbeat - worker auth)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 13.3 Implement template routes
    - GET /api/templates (list templates)
    - GET /api/templates/:id (get template details)
    - POST /api/templates (create template - admin only)
    - PATCH /api/templates/:id (update template - admin only)
    - DELETE /api/templates/:id (delete template - admin only)
    - _Requirements: 6.1, 6.4_

  - [ ] 13.4 Implement webhook routes
    - POST /api/containers/webhooks/github (GitHub webhook handler)
    - POST /api/containers/webhooks/gitlab (GitLab webhook handler)
    - POST /api/containers/webhooks/bitbucket (Bitbucket webhook handler)
    - GET /api/containers/services/:id/webhook-url (get webhook URL)
    - _Requirements: 7.1_

  - [ ] 13.5 Implement secrets routes
    - GET /api/secrets (list secrets)
    - POST /api/secrets (create secret)
    - PATCH /api/secrets/:id (update secret)
    - DELETE /api/secrets/:id (delete secret)
    - _Requirements: 11.1, 11.3, 11.4_

  - [ ] 13.6 Implement worker authentication middleware
    - Validate worker auth tokens
    - Extract worker ID from token
    - Restrict worker endpoints to authenticated workers
    - _Requirements: 1.2_

## Phase 4: Frontend Components

- [ ] 14. Frontend components - Container management
  - [ ] 14.1 Implement ContainerServiceList component
    - Display all services with status and resource usage
    - Provide quick actions (start, stop, restart, delete)
    - Implement filtering by status, template, and search
    - Show real-time status updates
    - _Requirements: 3.1_

  - [ ] 14.2 Implement CreateContainerService wizard
    - Step 1: Template selection or custom Nix expression
    - Step 2: Git repository configuration with branch selection
    - Step 3: Resource limit selection with cost estimates
    - Step 4: Environment variable configuration
    - Step 5: Secret selection and mounting
    - Step 6: Review and confirm with total estimated costs
    - Validate all inputs before submission
    - _Requirements: 3.1, 3.2_

  - [ ] 14.3 Implement ContainerServiceDetail component
    - Show detailed service information
    - Display current deployment status
    - Show resource metrics charts
    - Provide access to logs and deployments
    - Allow configuration updates
    - _Requirements: 3.4_

  - [ ] 14.4 Implement ContainerDeployments component
    - List deployment history with status
    - Show build logs for each deployment
    - Provide rollback functionality with confirmation
    - Display deployment timeline with visual indicators
    - Show diff between deployments
    - Indicate currently active deployment
    - _Requirements: 7.3_

  - [ ] 14.5 Implement ContainerLogs component
    - Real-time log streaming via WebSocket or SSE
    - Log filtering by level, time range, and text search
    - Download logs functionality
    - Auto-scroll toggle with scroll-to-bottom button
    - Line wrapping and syntax highlighting
    - _Requirements: 10.1_

  - [ ] 14.6 Implement ContainerMetrics component
    - Resource usage charts (CPU, memory, network, disk)
    - Historical data with time range selection
    - Cost breakdown by resource type
    - Visual alerts when approaching limits
    - Export metrics data
    - _Requirements: 10.2_

- [ ] 15. Frontend components - Worker management (Admin)
  - [ ] 15.1 Implement WorkerList component
    - Display all workers with status and capacity
    - Show health indicators and current load
    - Provide worker actions (drain, remove)
    - Display cluster health overview
    - _Requirements: 1.3_

  - [ ] 15.2 Implement AddWorkerDialog component
    - Generate installation script with auth token
    - Display setup instructions
    - Provide copy-to-clipboard functionality
    - Show script with CLIENT_URL from environment
    - _Requirements: 1.1_

  - [ ] 15.3 Implement WorkerDetail component
    - Show detailed worker information
    - Display resource utilization charts
    - List containers running on worker
    - Show heartbeat history
    - _Requirements: 1.3_

- [ ] 16. Frontend components - Templates
  - [ ] 16.1 Implement TemplateLibrary component
    - Grid view of templates with preview cards
    - Category filtering and search
    - Quick deploy button
    - Template details modal
    - Popular and recently used sections
    - _Requirements: 6.1_

  - [ ] 16.2 Implement TemplateEditor component (Admin)
    - Create/edit templates
    - Nix expression editor with syntax highlighting
    - Default environment variable configuration
    - Resource limit presets
    - Template preview
    - _Requirements: 6.4_

## Phase 5: Development Tools & Infrastructure

- [ ] 17. Embedded worker for development
  - [ ] 17.1 Implement embedded worker script
    - Create api/worker/embedded-worker.js with Node.js worker agent
    - Read database connection from DATABASE_URL in .env
    - Generate or load persistent worker auth token from .dev-worker-state.json
    - Auto-register as dev-worker-{hostname} on first run
    - Check if Docker is running and initialize single-node Swarm if needed
    - Start heartbeat loop (30-second interval) reporting to API
    - Listen for deployment commands from manager
    - Implement graceful shutdown on SIGTERM/SIGINT
    - Store worker state persistently for restarts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 17.2 Implement npm run dev:all command
    - Update package.json with dev:all script using concurrently
    - Add worker:dev script that runs api/worker/embedded-worker.js
    - Ensure proper process cleanup on exit
    - Add development mode indicators in logs
    - _Requirements: 2.1_

- [ ] 18. Reverse proxy integration
  - [ ] 18.1 Implement Traefik integration
    - Configure Traefik service discovery via Docker labels
    - Set up automatic SSL/TLS certificate provisioning
    - Implement rate limiting per service
    - Configure DDoS protection
    - Support custom domain mapping
    - _Requirements: 9.4_

  - [ ] 18.2 Implement public URL generation
    - Generate unique URLs for services: {service-slug}.{CLIENT_URL}
    - Update service routing on deployment
    - Handle custom domain configuration
    - _Requirements: 3.4_

## Phase 6: Error Handling & Documentation

- [ ] 19. Error handling and validation
  - [ ] 19.1 Implement comprehensive error handling
    - Validation errors (400) with field-specific messages
    - Authentication errors (401)
    - Authorization errors (403)
    - Resource not found errors (404)
    - Conflict errors (409)
    - Capacity errors (507)
    - Return consistent error format
    - _Requirements: All_

  - [ ] 19.2 Implement build failure handling
    - Preserve running container on build failure
    - Store complete build logs
    - Send notification with failure reason
    - Provide actionable suggestions based on error type
    - Allow retry with modified configuration
    - _Requirements: 7.4_

- [ ] 20. Documentation and configuration
  - [ ] 20.1 Create database migration documentation
    - Document all new tables and relationships in migrations/README.md
    - Provide rollback procedures for each table
    - Document indexes and performance considerations
    - Include ER diagram for container platform schema
    - _Requirements: All_

  - [ ] 20.2 Create worker setup documentation
    - Document installation script generation process
    - Provide manual setup instructions for various OS
    - Document Docker and Nix installation requirements
    - Document troubleshooting steps for common issues
    - Create worker setup guide in docs/WORKER_SETUP.md
    - _Requirements: 1.1, 1.2_

  - [ ] 20.3 Create template creation guide
    - Document Nix expression format and syntax
    - Provide example templates for common frameworks
    - Document multi-service template structure and dependencies
    - Document environment variable injection patterns
    - Create template guide in docs/TEMPLATE_GUIDE.md
    - _Requirements: 4.4, 6.4_

  - [ ] 20.4 Update environment variable documentation
    - Document all new environment variables in .env.example
    - Add DOCKER_SWARM_ADVERTISE_ADDR configuration
    - Add NIX_CACHE_URL for build optimization
    - Add CONTAINER_BILLING_ENABLED flag
    - Add WORKER_HEARTBEAT_INTERVAL and WORKER_HEARTBEAT_TIMEOUT
    - Document optional vs required variables
    - _Requirements: All_
