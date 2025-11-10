# Requirements Document

## Introduction

This specification addresses critical gaps and missing functionality in the SkyPanelV2 PaaS (Platform-as-a-Service) implementation. The PaaS system was designed to provide Heroku-like application deployment capabilities but currently has incomplete implementation, broken API endpoints, missing UI components, and lacks essential features for production use.

## Glossary

- **PaaS System**: The Platform-as-a-Service infrastructure within SkyPanelV2 that enables users to deploy and manage applications
- **Client Dashboard**: The user-facing interface where organization members can manage their PaaS applications
- **Admin Dashboard**: The administrative interface for managing the entire PaaS infrastructure
- **Docker Swarm**: The container orchestration system used to run PaaS applications
- **Worker Node**: A server that runs PaaS application containers
- **Deployment**: The process of building and running an application version
- **Buildpack**: The system that detects and builds applications from source code
- **Resource Plan**: A tier defining CPU, RAM, disk, and pricing for applications
- **Application**: A user's deployed service running on the PaaS
- **Slug**: The compiled application artifact ready for deployment

## Requirements

### Requirement 1: Fix Critical API Errors

**User Story:** As a system administrator, I need all PaaS API endpoints to function correctly so that the admin dashboard can display system information without errors.

#### Acceptance Criteria

1. WHEN the admin dashboard loads the PaaS overview, THE PaaS System SHALL return valid statistics without 500 errors
2. WHEN the database query for application statistics executes, THE PaaS System SHALL handle cases where no applications exist
3. WHEN the database query for resource usage executes, THE PaaS System SHALL handle NULL values from aggregate functions
4. WHEN any PaaS API endpoint encounters an error, THE PaaS System SHALL log detailed error information including stack traces
5. WHERE the paas_applications table is empty, THE PaaS System SHALL return zero counts instead of failing

### Requirement 2: Complete Missing UI Components

**User Story:** As a PaaS user, I need access to all documented features through the user interface so that I can fully manage my applications without using the API directly.

#### Acceptance Criteria

1. THE PaaS System SHALL provide a domain management interface for adding custom domains to applications
2. THE PaaS System SHALL provide a resource metrics dashboard showing CPU and RAM usage over time
3. THE PaaS System SHALL provide a deployment progress indicator with real-time build logs during deployment
4. THE PaaS System SHALL provide a plan comparison page showing all available resource plans
5. WHERE an application is deploying, THE PaaS System SHALL display real-time build progress with streaming logs

### Requirement 3: Implement Missing Backend Services

**User Story:** As a developer, I need all core PaaS services to be fully implemented so that applications can be built, deployed, and managed successfully.

#### Acceptance Criteria

1. THE PaaS System SHALL implement a complete billing integration that charges users hourly for running applications
2. THE PaaS System SHALL implement a build queue system using Bull/Redis for processing deployments
3. THE PaaS System SHALL implement health check monitoring for deployed applications
4. THE PaaS System SHALL implement automatic SSL certificate provisioning via Let's Encrypt
5. THE PaaS System SHALL implement log streaming from Loki to the client dashboard

### Requirement 4: Fix Database Schema Issues

**User Story:** As a system administrator, I need the database schema to support all PaaS features correctly so that data integrity is maintained.

#### Acceptance Criteria

1. THE PaaS System SHALL ensure all foreign key constraints are properly defined with appropriate CASCADE rules
2. THE PaaS System SHALL provide database indexes on frequently queried columns for performance
3. THE PaaS System SHALL implement database triggers for automatic resource usage tracking
4. WHERE an organization is deleted, THE PaaS System SHALL cascade delete or reassign all associated applications
5. THE PaaS System SHALL store encrypted environment variables with proper encryption key management

### Requirement 5: Implement Worker Node Management

**User Story:** As a system administrator, I need to add and manage worker nodes through the admin dashboard so that I can scale the PaaS infrastructure.

#### Acceptance Criteria

1. THE PaaS System SHALL provide an interface to add worker nodes with SSH credentials
2. WHEN a worker node is added with auto-provision enabled, THE PaaS System SHALL automatically install Docker and join the Swarm
3. THE PaaS System SHALL monitor worker node health with heartbeat checks every 30 seconds
4. THE PaaS System SHALL display worker node resource usage including CPU, RAM, and container count
5. WHEN a worker node becomes unhealthy, THE PaaS System SHALL alert administrators and mark it as inactive

### Requirement 6: Implement Application Lifecycle Management

**User Story:** As a PaaS user, I need complete control over my application lifecycle so that I can deploy, scale, stop, and delete applications as needed.

#### Acceptance Criteria

1. WHEN a user creates an application, THE PaaS System SHALL validate the slug is unique across all organizations
2. WHEN a user deploys an application, THE PaaS System SHALL clone the git repository and detect the appropriate buildpack
3. WHEN a build completes successfully, THE PaaS System SHALL create a slug and store it in configured storage (S3 or local)
4. WHEN a deployment is triggered, THE PaaS System SHALL create a Docker Swarm service with the specified replicas
5. WHEN a user scales an application, THE PaaS System SHALL update the Docker Swarm service replica count

### Requirement 7: Implement Logging and Monitoring

**User Story:** As a PaaS user, I need to view real-time logs and metrics for my applications so that I can debug issues and monitor performance.

#### Acceptance Criteria

1. THE PaaS System SHALL stream application logs from Loki to the client dashboard in real-time
2. THE PaaS System SHALL provide log filtering by time range, search term, and log level
3. THE PaaS System SHALL display resource usage metrics including CPU and RAM over time
4. THE PaaS System SHALL retain logs for the configured retention period (default 7 days)
5. WHERE Loki is unavailable, THE PaaS System SHALL display an error message and fallback to Docker logs

### Requirement 8: Implement Settings Management

**User Story:** As a system administrator, I need to configure all PaaS settings through the admin dashboard without editing configuration files so that setup is simplified.

#### Acceptance Criteria

1. THE PaaS System SHALL store all configuration in the paas_settings database table
2. THE PaaS System SHALL encrypt sensitive settings including S3 credentials and SSH keys
3. WHEN settings are updated, THE PaaS System SHALL validate values before saving
4. THE PaaS System SHALL provide default values for all required settings on first initialization
5. WHERE S3 storage is configured, THE PaaS System SHALL test connectivity before saving settings

### Requirement 9: Implement Resource Plans Management

**User Story:** As a system administrator, I need to create and manage resource plans so that users can choose appropriate tiers for their applications.

#### Acceptance Criteria

1. THE PaaS System SHALL provide an interface to create, update, and delete resource plans
2. THE PaaS System SHALL prevent deletion of plans that are in use by applications
3. THE PaaS System SHALL calculate monthly pricing from hourly rates (hours * 730)
4. WHEN a plan is updated, THE PaaS System SHALL not affect existing applications using that plan
5. THE PaaS System SHALL provide default plans (Hobby, Standard, Pro, Business) on first initialization

### Requirement 10: Implement Billing Integration

**User Story:** As a PaaS user, I need to be charged hourly for my running applications so that I pay only for what I use.

#### Acceptance Criteria

1. THE PaaS System SHALL record resource usage hourly in the paas_resource_usage table
2. THE PaaS System SHALL calculate costs based on plan pricing and replica count
3. THE PaaS System SHALL deduct costs from the organization's wallet balance
4. WHEN wallet balance reaches zero, THE PaaS System SHALL stop all running applications for that organization
5. THE PaaS System SHALL provide usage reports showing costs per application and time period

### Requirement 11: Implement Infrastructure Auto-Deployment

**User Story:** As a system administrator, I need infrastructure services (Loki, Grafana, Traefik, Prometheus) to deploy automatically so that setup is simplified.

#### Acceptance Criteria

1. WHEN the PaaS initialization script runs, THE PaaS System SHALL deploy all infrastructure services via Docker Compose
2. THE PaaS System SHALL configure Traefik with Let's Encrypt for automatic SSL certificates
3. THE PaaS System SHALL configure Loki with the retention period from settings
4. THE PaaS System SHALL configure Grafana with Loki as a datasource
5. THE PaaS System SHALL verify all infrastructure services are healthy before completing initialization

### Requirement 12: Implement Environment Variable Management

**User Story:** As a PaaS user, I need to securely manage environment variables for my applications so that I can configure them without exposing secrets.

#### Acceptance Criteria

1. THE PaaS System SHALL encrypt all environment variable values using the application encryption key
2. THE PaaS System SHALL never return decrypted values in API responses
3. WHEN environment variables are updated, THE PaaS System SHALL trigger a redeploy if the application is running
4. THE PaaS System SHALL inject system environment variables (PORT, DYNO, PS) automatically
5. THE PaaS System SHALL validate environment variable keys match the pattern [A-Z0-9_]+

### Requirement 13: Implement Custom Domain Management

**User Story:** As a PaaS user, I need to add custom domains to my applications so that they are accessible on my own domain names.

#### Acceptance Criteria

1. THE PaaS System SHALL provide an interface to add custom domains to applications
2. THE PaaS System SHALL validate domain ownership via DNS TXT record before activation
3. THE PaaS System SHALL configure Traefik to route the custom domain to the application
4. THE PaaS System SHALL provision SSL certificates via Let's Encrypt for custom domains
5. THE PaaS System SHALL display DNS configuration instructions (CNAME record) to users

### Requirement 14: Implement Deployment Rollback

**User Story:** As a PaaS user, I need to rollback to previous deployments so that I can quickly recover from bad releases.

#### Acceptance Criteria

1. THE PaaS System SHALL maintain a history of all deployments with their slugs
2. WHEN a user triggers a rollback, THE PaaS System SHALL redeploy the selected previous version
3. THE PaaS System SHALL preserve environment variables during rollback
4. THE PaaS System SHALL update the application status to show the active deployment version
5. THE PaaS System SHALL complete rollbacks within 30 seconds for pre-built slugs

### Requirement 15: Implement Application Scaling

**User Story:** As a PaaS user, I need to scale my applications horizontally so that I can handle increased traffic.

#### Acceptance Criteria

1. THE PaaS System SHALL provide a slider interface to adjust replica count from 1 to the plan's max_replicas
2. WHEN replica count is changed, THE PaaS System SHALL update the Docker Swarm service immediately
3. THE PaaS System SHALL distribute replicas across available worker nodes
4. THE PaaS System SHALL update billing to reflect the new replica count
5. WHERE the plan's max_replicas limit is reached, THE PaaS System SHALL prevent further scaling

### Requirement 16: Fix User Management Integration

**User Story:** As a system administrator, I need to see PaaS application counts in user management so that I can monitor resource usage per organization.

#### Acceptance Criteria

1. THE PaaS System SHALL display the count of PaaS applications in the user management interface
2. THE PaaS System SHALL display total PaaS costs per organization in the user management interface
3. WHEN an organization is deleted, THE PaaS System SHALL prompt to delete or reassign PaaS applications
4. THE PaaS System SHALL show PaaS resource usage in organization detail views
5. THE PaaS System SHALL allow administrators to suspend all PaaS applications for an organization

### Requirement 17: Implement Build Caching

**User Story:** As a PaaS user, I need build caching to work so that subsequent deployments are faster.

#### Acceptance Criteria

1. THE PaaS System SHALL cache buildpack dependencies between builds
2. THE PaaS System SHALL store build cache in the paas_build_cache table
3. WHEN a build runs, THE PaaS System SHALL restore the cache if available
4. THE PaaS System SHALL invalidate cache when buildpack or stack version changes
5. WHERE build cache is disabled in settings, THE PaaS System SHALL skip cache operations

### Requirement 18: Implement Health Checks

**User Story:** As a PaaS user, I need my applications to be monitored with health checks so that unhealthy instances are automatically restarted.

#### Acceptance Criteria

1. THE PaaS System SHALL configure Docker Swarm health checks for all deployed applications
2. THE PaaS System SHALL check the /health endpoint every 30 seconds by default
3. WHEN a health check fails 3 consecutive times, THE PaaS System SHALL restart the container
4. THE PaaS System SHALL allow users to configure custom health check paths
5. WHERE no health check endpoint exists, THE PaaS System SHALL use TCP port checks

### Requirement 19: Implement Git Repository Validation

**User Story:** As a PaaS user, I need git repository URLs to be validated so that I receive clear errors for invalid repositories.

#### Acceptance Criteria

1. WHEN a user provides a git URL, THE PaaS System SHALL validate it is accessible before saving
2. THE PaaS System SHALL support HTTPS and SSH git URLs
3. THE PaaS System SHALL validate the specified branch exists in the repository
4. WHERE authentication is required, THE PaaS System SHALL provide clear error messages
5. THE PaaS System SHALL support private repositories with deploy keys

### Requirement 20: Implement Worker Process

**User Story:** As a system administrator, I need the worker process to handle background jobs so that deployments don't block API requests.

#### Acceptance Criteria

1. THE PaaS System SHALL process build jobs asynchronously using Bull queues
2. THE PaaS System SHALL process deployment jobs asynchronously using Bull queues
3. THE PaaS System SHALL process billing jobs hourly using Bull queues
4. THE PaaS System SHALL allow running the worker on the same server as the API
5. THE PaaS System SHALL allow running workers on separate servers for scaling
