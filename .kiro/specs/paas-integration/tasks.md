# Implementation Plan

- [ ] 1. Database schema and migrations
  - Create migration file with all PaaS-related tables
  - Implement paas_plans, paas_runtimes, paas_nodes tables
  - Implement paas_applications, paas_builds, paas_environment_vars tables
  - Implement paas_databases, paas_app_databases tables
  - Implement paas_billing_records table
  - Add indexes for performance optimization
  - _Requirements: 1.4, 2.5, 3.5, 5.5, 10.4, 15.2_

- [ ] 2. Backend API foundation and configuration
  - [ ] 2.1 Create PaaS service layer structure
    - Create api/services/paas/ directory structure
    - Implement PlanService for plan management operations
    - Implement RuntimeService for runtime configuration
    - Implement NodeService for worker node management
    - _Requirements: 1.4, 2.5, 3.4_
  
  - [ ] 2.2 Create PaaS API routes
    - Create api/routes/paas/ directory structure
    - Implement admin routes for plans, runtimes, and nodes
    - Implement customer routes for applications and databases
    - Implement internal routes for agent communication
    - Add authentication and authorization middleware
    - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [ ] 3. Admin UI for PaaS management
  - [ ] 3.1 Create admin PaaS plans management interface
    - Create src/components/admin/PaaSPlansModal.tsx component
    - Implement plan creation form with validation
    - Implement plan listing with edit/delete actions
    - Add runtime selection multi-select
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 3.2 Create admin runtime management interface
    - Create src/components/admin/PaaSRuntimesModal.tsx component
    - Implement runtime creation form
    - Add Docker image validation
    - Implement build preset configuration
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 3.3 Create admin node management interface
    - Create src/components/admin/PaaSNodesModal.tsx component
    - Implement node registration token generation
    - Display setup script with installation instructions
    - Create node listing with status indicators
    - Add node metrics display (CPU, RAM, disk, containers)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3_

- [ ] 4. Node registration and agent authentication
  - [ ] 4.1 Implement node registration endpoint
    - Create POST /api/internal/paas/nodes/register endpoint
    - Validate registration token
    - Generate JWT secret for agent
    - Store node information in database
    - Return authentication credentials
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [ ] 4.2 Implement agent WebSocket connection
    - Create WebSocket endpoint at /api/internal/paas/nodes/:id/connect
    - Implement JWT authentication for WebSocket
    - Handle connection lifecycle (connect, disconnect, reconnect)
    - Implement connection state tracking
    - _Requirements: 3.4, 4.1_
  
  - [ ] 4.3 Implement heartbeat processing
    - Create POST /api/internal/paas/nodes/:id/heartbeat endpoint
    - Parse and validate heartbeat messages
    - Update node metrics in database
    - Detect offline nodes (90 second timeout)
    - Generate capacity alerts at 90% threshold
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_


- [ ] 5. PaaS Agent core implementation
  - [ ] 5.1 Create agent project structure
    - Create agent/ directory in project root
    - Initialize Node.js project with TypeScript
    - Create agent configuration schema
    - Implement configuration loading from config.json
    - _Requirements: 3.2_
  
  - [ ] 5.2 Implement agent connection manager
    - Create WebSocket client for control plane connection
    - Implement JWT authentication
    - Implement reconnection logic with exponential backoff
    - Add HTTP polling fallback
    - _Requirements: 3.4, 4.1_
  
  - [ ] 5.3 Implement agent heartbeat sender
    - Collect system metrics (CPU, RAM, disk)
    - Collect container metrics via Docker API
    - Format heartbeat message
    - Send heartbeat every 30 seconds
    - _Requirements: 4.1_
  
  - [ ] 5.4 Implement agent task executor
    - Create task queue and processing loop
    - Implement task acknowledgment
    - Implement task status reporting
    - Handle task cancellation
    - _Requirements: 7.2, 7.3_
  
  - [ ] 5.5 Implement Docker container manager
    - Create Docker API client wrapper
    - Implement container creation with resource limits
    - Implement container start/stop/restart operations
    - Implement container removal and cleanup
    - Apply security configurations (non-privileged, user namespaces)
    - _Requirements: 7.5, 12.3, 12.4, 14.1, 14.2, 14.3_

- [ ] 6. Customer UI for application management
  - [ ] 6.1 Create PaaS applications page
    - Create src/pages/PaaS.tsx page component
    - Add route to src/App.tsx
    - Implement application listing with status indicators
    - Add "Create Application" button
    - Display application cards with key metrics
    - _Requirements: 5.1, 12.1_
  
  - [ ] 6.2 Create application creation modal
    - Create src/components/paas/CreateApplicationModal.tsx
    - Implement application name input with slug generation
    - Add runtime selection dropdown
    - Add plan selection dropdown
    - Add region selection dropdown
    - Implement form validation
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 6.3 Create application details page
    - Create src/pages/ApplicationDetails.tsx
    - Display application status and metrics
    - Add action buttons (deploy, restart, stop, delete)
    - Create tabs for logs, settings, builds, databases
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 6.4 Implement environment variables UI
    - Create environment variables tab component
    - Implement add/edit/delete environment variable forms
    - Add validation for variable keys
    - Display warning about requiring redeployment
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 7. Git integration and deployment
  - [ ] 7.1 Implement GitHub OAuth flow
    - Create GET /api/paas/github/authorize endpoint
    - Create GET /api/paas/github/callback endpoint
    - Store OAuth tokens securely (encrypted)
    - Implement token refresh logic
    - _Requirements: 6.1, 6.2_
  
  - [ ] 7.2 Implement repository selection UI
    - Create Git configuration section in application settings
    - Fetch and display user's repositories
    - Implement branch selection dropdown
    - Add auto-deploy toggle
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ] 7.3 Implement deployment trigger endpoint
    - Create POST /api/paas/applications/:id/deploy endpoint
    - Create build record in database
    - Select appropriate worker node
    - Create deployment task
    - Send task to agent via WebSocket
    - _Requirements: 7.1, 7.2_
  
  - [ ] 7.4 Implement agent Git clone functionality
    - Install git in agent environment
    - Implement Git clone in isolated container
    - Handle OAuth token authentication
    - Handle SSH key authentication
    - Capture Git commit SHA and message
    - _Requirements: 7.3_


- [ ] 8. Build system implementation
  - [ ] 8.1 Implement buildpack detection
    - Create buildpack detector for Node.js (package.json)
    - Create buildpack detector for Python (requirements.txt, Pipfile)
    - Create buildpack detector for PHP (composer.json)
    - Implement runtime version detection
    - _Requirements: 7.4_
  
  - [ ] 8.2 Implement Node.js buildpack
    - Create Dockerfile template for Node.js
    - Implement npm/yarn dependency installation
    - Implement build command execution
    - Set default start command
    - _Requirements: 7.4, 7.5_
  
  - [ ] 8.3 Implement Python buildpack
    - Create Dockerfile template for Python
    - Implement pip dependency installation
    - Support for requirements.txt and Pipfile
    - Set default start command (gunicorn/uvicorn)
    - _Requirements: 7.4, 7.5_
  
  - [ ] 8.4 Implement PHP buildpack
    - Create Dockerfile template for PHP
    - Implement composer dependency installation
    - Configure PHP-FPM and Nginx
    - Set default start command
    - _Requirements: 7.4, 7.5_
  
  - [ ] 8.5 Implement custom Dockerfile support
    - Detect Dockerfile in repository root
    - Validate Dockerfile for security issues
    - Build image from custom Dockerfile
    - Apply resource limits during build
    - _Requirements: 2.4, 7.4, 7.5_
  
  - [ ] 8.6 Implement build execution and logging
    - Execute Docker build with captured output
    - Stream build logs to control plane
    - Handle build timeouts (15 minute limit)
    - Handle build failures with error reporting
    - Tag and store built images
    - _Requirements: 7.5, 8.1, 8.2, 8.3, 8.4_

- [ ] 9. Container deployment and lifecycle
  - [ ] 9.1 Implement container startup
    - Create container from built image
    - Inject environment variables
    - Apply CPU and memory limits
    - Configure isolated network
    - Start container and capture logs
    - _Requirements: 7.5, 9.4, 14.2, 14.4_
  
  - [ ] 9.2 Implement application restart
    - Create POST /api/paas/applications/:id/restart endpoint
    - Send restart task to agent
    - Agent stops and starts container
    - Update application status
    - _Requirements: 12.3_
  
  - [ ] 9.3 Implement application stop/start
    - Create POST /api/paas/applications/:id/stop endpoint
    - Create POST /api/paas/applications/:id/start endpoint
    - Agent stops/starts container
    - Stop billing when stopped
    - Resume billing when started
    - _Requirements: 12.4, 15.3_
  
  - [ ] 9.4 Implement application deletion
    - Create DELETE /api/paas/applications/:id endpoint
    - Stop and remove containers
    - Remove Docker images
    - Delete database records
    - Stop billing
    - _Requirements: 12.5_

- [ ] 10. Logging and monitoring
  - [ ] 10.1 Implement log streaming from agent
    - Capture container stdout/stderr
    - Stream logs to control plane via WebSocket
    - Store recent logs in memory buffer
    - _Requirements: 8.2, 8.5_
  
  - [ ] 10.2 Implement log viewing endpoint
    - Create GET /api/paas/applications/:id/logs endpoint
    - Support log tailing (real-time streaming)
    - Support historical log retrieval
    - Add log filtering options
    - _Requirements: 8.2, 8.5_
  
  - [ ] 10.3 Implement build log storage and retrieval
    - Store build logs in paas_builds table
    - Create GET /api/paas/applications/:id/builds/:buildId/logs endpoint
    - Display build logs in customer UI
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 10.4 Implement application metrics collection
    - Agent collects per-container CPU and memory usage
    - Send metrics in heartbeat messages
    - Store metrics in time-series format
    - Create GET /api/paas/applications/:id/metrics endpoint
    - _Requirements: 12.2_


- [ ] 11. Database provisioning and management
  - [ ] 11.1 Implement database creation endpoint
    - Create POST /api/paas/databases endpoint
    - Validate database type and version
    - Select appropriate worker node
    - Generate secure credentials
    - Create database record
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 11.2 Implement database container deployment
    - Agent pulls official database image
    - Create persistent volume for data
    - Start database container with credentials
    - Configure resource limits
    - Wait for database to be ready
    - _Requirements: 10.3, 10.4_
  
  - [ ] 11.3 Implement database connection details
    - Store connection details securely (encrypted password)
    - Create GET /api/paas/databases/:id endpoint
    - Display connection details in customer UI
    - Provide connection string formats
    - _Requirements: 10.5_
  
  - [ ] 11.4 Implement database linking to applications
    - Create POST /api/paas/applications/:id/databases/:dbId endpoint
    - Create link record in paas_app_databases
    - Generate environment variables (DATABASE_URL, etc.)
    - Inject variables on next deployment
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 11.5 Implement database unlinking
    - Create DELETE /api/paas/applications/:id/databases/:dbId endpoint
    - Remove link record
    - Remove associated environment variables
    - Update application configuration
    - _Requirements: 11.4_
  
  - [ ] 11.6 Implement database deletion
    - Create DELETE /api/paas/databases/:id endpoint
    - Stop and remove database container
    - Remove persistent volume
    - Delete database records
    - Stop billing
    - _Requirements: 10.3_

- [ ] 12. Domain management and SSL
  - [ ] 12.1 Implement system domain assignment
    - Generate unique subdomain on application creation
    - Store system domain in paas_applications
    - Format: {app-slug}.{platform-domain}
    - _Requirements: 13.1_
  
  - [ ] 12.2 Implement Nginx ingress configuration
    - Install and configure Nginx on agent
    - Generate Nginx config for each application
    - Implement reverse proxy to container
    - Reload Nginx on configuration changes
    - _Requirements: 13.2_
  
  - [ ] 12.3 Implement Let's Encrypt SSL automation
    - Install Certbot on agent
    - Request SSL certificate via ACME protocol
    - Configure Nginx with SSL certificate
    - Implement automatic certificate renewal
    - _Requirements: 13.3_
  
  - [ ] 12.4 Implement custom domain support
    - Add custom domain input in application settings
    - Validate domain ownership via DNS
    - Request SSL certificate for custom domain
    - Update Nginx configuration
    - _Requirements: 13.4, 13.5_

- [ ] 13. Billing integration
  - [ ] 13.1 Implement hourly billing for applications
    - Create billing service for PaaS resources
    - Track application start/stop times
    - Calculate hourly charges based on plan
    - Deduct from prepaid wallet
    - Create billing records
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [ ] 13.2 Implement billing for databases
    - Track database runtime hours
    - Calculate charges based on database plan
    - Include in hourly billing cycle
    - _Requirements: 15.1, 15.2_
  
  - [ ] 13.3 Implement plan upgrade/downgrade billing
    - Handle plan changes mid-billing period
    - Prorate charges by hour
    - Apply new rate immediately
    - _Requirements: 15.4, 18.3, 18.4_
  
  - [ ] 13.4 Implement insufficient balance handling
    - Check wallet balance before deployment
    - Detect insufficient balance in billing cycle
    - Send low-balance notifications
    - Suspend applications after grace period
    - Resume on payment
    - _Requirements: 15.5_
  
  - [ ] 13.5 Implement PaaS billing reports
    - Add PaaS resources to invoice generation
    - Itemize applications and databases
    - Display month-to-date spending
    - Create usage reports with trends
    - Implement spending alerts
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_


- [ ] 14. Horizontal scaling
  - [ ] 14.1 Implement instance scaling endpoint
    - Create POST /api/paas/applications/:id/scale endpoint
    - Validate requested instance count
    - Update application record
    - Send scale task to agent
    - _Requirements: 17.1, 17.2_
  
  - [ ] 14.2 Implement agent scaling logic
    - Start additional containers on same node
    - Apply same configuration to all instances
    - Assign unique container names
    - Update Nginx load balancing configuration
    - _Requirements: 17.2_
  
  - [ ] 14.3 Implement load balancing across instances
    - Configure Nginx upstream with multiple backends
    - Implement round-robin load balancing
    - Add health checks for instances
    - Remove failed instances from pool
    - _Requirements: 17.3_
  
  - [ ] 14.4 Implement scaling billing adjustment
    - Calculate total cost as instances × hourly rate
    - Update billing records on scale changes
    - Display per-instance and total costs
    - _Requirements: 17.4_
  
  - [ ] 14.5 Implement scale down
    - Gracefully terminate excess containers
    - Update Nginx configuration
    - Adjust billing immediately
    - _Requirements: 17.5_

- [ ] 15. Deployment scheduling and node selection
  - [ ] 15.1 Implement deployment scheduler
    - Filter nodes by requested region
    - Filter out offline/disabled nodes
    - Calculate available capacity per node
    - Select node with lowest utilization
    - _Requirements: 19.1, 19.2_
  
  - [ ] 15.2 Implement capacity checking
    - Verify node has sufficient CPU/RAM/disk
    - Check against node capacity limits
    - Reject deployment if no capacity available
    - _Requirements: 19.3, 19.5_
  
  - [ ] 15.3 Implement node exclusion logic
    - Exclude offline nodes from scheduling
    - Exclude disabled nodes from scheduling
    - Respect administrator-set capacity limits
    - _Requirements: 19.4, 19.5_

- [ ] 16. Database backup and restore
  - [ ] 16.1 Implement backup configuration
    - Add backup settings to admin UI
    - Configure backup frequency and retention
    - Store backup configuration in database
    - _Requirements: 20.1_
  
  - [ ] 16.2 Implement scheduled backup execution
    - Create backup scheduler service
    - Send backup task to agent at scheduled time
    - Agent creates database dump
    - Store backup file with timestamp
    - _Requirements: 20.2, 20.3_
  
  - [ ] 16.3 Implement backup listing
    - Create GET /api/paas/databases/:id/backups endpoint
    - Display available backups in customer UI
    - Show backup size and timestamp
    - _Requirements: 20.4_
  
  - [ ] 16.4 Implement backup restore
    - Create POST /api/paas/databases/:id/restore endpoint
    - Stop database container
    - Restore data from backup file
    - Restart database container
    - _Requirements: 20.4, 20.5_

- [ ] 17. Security hardening
  - [ ] 17.1 Implement container security configurations
    - Apply non-privileged container settings
    - Enable user namespace remapping
    - Drop unnecessary Linux capabilities
    - Apply seccomp and AppArmor profiles
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 17.2 Implement network isolation
    - Create isolated bridge networks per customer
    - Configure firewall rules
    - Prevent inter-customer communication
    - _Requirements: 14.4_
  
  - [ ] 17.3 Implement data encryption
    - Encrypt environment variables at rest
    - Encrypt database passwords at rest
    - Encrypt OAuth tokens at rest
    - Use AES-256 encryption
    - _Requirements: 9.3_
  
  - [ ] 17.4 Implement input validation and sanitization
    - Validate all API inputs
    - Sanitize application names and slugs
    - Validate Git URLs
    - Prevent command injection
    - _Requirements: 5.5_
  
  - [ ] 17.5 Implement rate limiting
    - Add rate limits to deployment endpoints
    - Add rate limits to API endpoints
    - Implement per-user quotas
    - _Requirements: 5.5_


- [ ] 18. Error handling and resilience
  - [ ] 18.1 Implement build failure handling
    - Capture build errors and exit codes
    - Store error details in build record
    - Display actionable error messages
    - Maintain previous working state
    - _Requirements: 8.3, 8.4_
  
  - [ ] 18.2 Implement node disconnection handling
    - Detect missing heartbeats (90 second timeout)
    - Mark node as offline
    - Exclude from new deployments
    - Send admin alert notification
    - Implement agent auto-reconnection
    - _Requirements: 4.2_
  
  - [ ] 18.3 Implement container crash handling
    - Detect container exits
    - Attempt automatic restart (max 3 in 5 minutes)
    - Mark application as failed if restart limit exceeded
    - Send customer notification
    - Stop billing for failed applications
    - _Requirements: 12.1_
  
  - [ ] 18.4 Implement SSL certificate failure handling
    - Retry certificate requests with exponential backoff
    - Serve HTTP if SSL fails
    - Notify customer of SSL issues
    - Provide manual retry option
    - _Requirements: 13.3_

- [ ] 19. Agent installation and setup
  - [ ] 19.1 Create agent installation script
    - Write bash script to install Docker
    - Install Node.js 20
    - Download and extract agent package
    - Configure agent with registration token
    - _Requirements: 3.2_
  
  - [ ] 19.2 Create agent systemd service
    - Write systemd service file
    - Configure auto-restart on failure
    - Set up logging
    - Enable service on boot
    - _Requirements: 3.2_
  
  - [ ] 19.3 Create agent package distribution
    - Bundle agent code and dependencies
    - Create downloadable tarball
    - Host on control plane at /agent/download
    - Version agent releases
    - _Requirements: 3.2_

- [ ] 20. Customer UI enhancements
  - [ ] 20.1 Create build history UI
    - Display list of builds with status
    - Show Git commit information
    - Add "View Logs" button for each build
    - Highlight current active build
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 20.2 Create database management UI
    - Create databases listing page
    - Add "Create Database" modal
    - Display database connection details
    - Show linked applications
    - Add backup/restore actions
    - _Requirements: 10.1, 10.2, 10.5, 11.3_
  
  - [ ] 20.3 Create application metrics dashboard
    - Display CPU usage chart
    - Display memory usage chart
    - Display request count/rate
    - Add time range selector
    - _Requirements: 12.2_
  
  - [ ] 20.4 Create plan upgrade UI
    - Display current plan details
    - Show available upgrade options
    - Display cost comparison
    - Implement upgrade confirmation
    - _Requirements: 18.1, 18.2_

- [ ] 21. Admin monitoring and analytics
  - [ ] 21.1 Create PaaS overview dashboard
    - Display total applications and databases
    - Show total resource usage across nodes
    - Display revenue metrics
    - Show recent deployments
    - _Requirements: 4.3_
  
  - [ ] 21.2 Create node monitoring UI
    - Display node list with health status
    - Show resource utilization per node
    - Display container count per node
    - Add capacity alerts
    - _Requirements: 4.3, 4.4_
  
  - [ ] 21.3 Implement capacity planning tools
    - Calculate available capacity per region
    - Project capacity needs based on trends
    - Alert when capacity is low
    - Suggest node additions
    - _Requirements: 4.4_

- [ ] 22. Testing and quality assurance
  - [ ] 22.1 Write unit tests for services
    - Test plan management service
    - Test runtime configuration service
    - Test node management service
    - Test deployment scheduler
    - Test billing calculations
    - _Requirements: All_
  
  - [ ] 22.2 Write integration tests for API endpoints
    - Test admin endpoints
    - Test customer endpoints
    - Test agent endpoints
    - Test authentication and authorization
    - _Requirements: All_
  
  - [ ] 22.3 Write end-to-end deployment tests
    - Test full deployment workflow
    - Test scaling workflow
    - Test database provisioning and linking
    - Test error scenarios
    - _Requirements: 7.1-7.5, 17.1-17.5_
  
  - [ ] 22.4 Perform security testing
    - Test container isolation
    - Test privilege escalation prevention
    - Test authentication mechanisms
    - Test data encryption
    - _Requirements: 14.1-14.5, 17.1-17.5_

- [ ] 23. Documentation and deployment
  - [ ] 23.1 Write administrator documentation
    - Document plan and runtime configuration
    - Document node setup process
    - Document monitoring and troubleshooting
    - Document backup and restore procedures
    - _Requirements: All_
  
  - [ ] 23.2 Write customer documentation
    - Document application deployment process
    - Document environment variable management
    - Document database provisioning
    - Document scaling and plan upgrades
    - _Requirements: All_
  
  - [ ] 23.3 Create deployment guide
    - Document control plane setup
    - Document agent installation
    - Document SSL configuration
    - Document production best practices
    - _Requirements: All_
