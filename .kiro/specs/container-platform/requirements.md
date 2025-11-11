# Requirements Document

## Introduction

This document specifies the requirements for transforming SkyPanelV2 into a Nix-styled Heroku alternative that provides Container-as-a-Service (CaaS) and Platform-as-a-Service (PaaS) capabilities along side the exsisting vps hosting with linode and digitalocean. The platform will enable users to deploy isolated applications and containers with hourly billing, while administrators can easily manage worker nodes through a simple dashboard interface. The system will support both manual worker provisioning and embedded worker deployment for development environments.

## Glossary

- **Container Platform**: The system that manages containerized application deployments
- **Worker Node**: A server that runs containerized applications and reports to the cluster
- **Container Service**: A user-deployed application running in an isolated container
- **Nix Package Manager**: A reproducible package management system for building applications
- **Docker Swarm**: The container orchestration platform used for managing containers
- **Embedded Worker**: A worker node that runs alongside the SkyPanelV2 application for development
- **Application Template**: Pre-configured deployment patterns for common frameworks
- **Build Pipeline**: The automated system that converts application code into deployable containers
- **Organization**: A multi-tenant isolation boundary for users and resources
- **Billing System**: The existing hourly billing infrastructure extended for container workloads

## Requirements

### Requirement 1: Worker Node Management

**User Story:** As an administrator, I want to easily add worker nodes to the cluster through the admin dashboard, so that I can scale the platform's capacity without complex manual configuration.

#### Acceptance Criteria

1. WHEN the administrator clicks "Add Worker Node" in the admin dashboard, THE Container Platform SHALL generate a unique installation script containing authentication tokens and cluster connection details.
2. WHEN the generated installation script is executed on a fresh server, THE Container Platform SHALL automatically register the worker node and add it to the available worker pool.
3. WHEN a worker node successfully registers, THE Container Platform SHALL display the worker in the admin dashboard with status indicators showing health, capacity, and current workload.
4. WHEN a worker node becomes unhealthy or disconnected, THE Container Platform SHALL update the worker status in real-time and send notifications to administrators.
5. WHEN an administrator removes a worker node, THE Container Platform SHALL gracefully drain running containers and decommission the worker from the cluster.

### Requirement 2: Embedded Worker for Development

**User Story:** As a developer, I want to run a worker node alongside the SkyPanelV2 application using a simple command, so that I can test container deployments in my local development environment.

#### Acceptance Criteria

1. WHEN the developer executes `npm run dev:all`, THE Container Platform SHALL start both the SkyPanelV2 application and an embedded worker process.
2. WHEN the embedded worker starts, THE Container Platform SHALL automatically register the worker using database connection information from the .env file.
3. WHEN the administrator views the admin dashboard, THE Container Platform SHALL display the embedded worker as an available node with appropriate development environment indicators.
4. WHEN the embedded worker is running, THE Container Platform SHALL allow container deployments to be tested locally with the same functionality as production workers.
5. WHEN the development environment is stopped, THE Container Platform SHALL gracefully shut down the embedded worker and update its status.

### Requirement 3: Container Service Deployment

**User Story:** As an end user, I want to deploy my application as a container service through a simple interface, so that I can run my code without managing infrastructure.

#### Acceptance Criteria

1. WHEN a user initiates a container deployment, THE Container Platform SHALL provide options to deploy from Git repositories, application templates, or custom Nix expressions.
2. WHEN a user selects resource requirements (CPU, memory, storage), THE Container Platform SHALL validate availability and display estimated hourly costs before deployment.
3. WHEN a deployment is submitted, THE Container Platform SHALL queue the build, execute the build pipeline, and deploy the container to an available worker node.
4. WHEN a container is successfully deployed, THE Container Platform SHALL provide the user with access URLs, environment configuration options, and real-time logs.
5. WHEN a user requests container lifecycle operations (start, stop, restart, delete), THE Container Platform SHALL execute the operation and update the container status within 5 seconds.

### Requirement 4: Nix Package Integration

**User Story:** As a user, I want to deploy applications using Nix package definitions, so that I can ensure reproducible builds and dependency management.

#### Acceptance Criteria

1. WHEN a user provides a Nix expression for their application, THE Container Platform SHALL parse the expression and resolve all package dependencies.
2. WHEN the build pipeline processes a Nix-based application, THE Container Platform SHALL use the Nix package manager to create a reproducible container image.
3. WHEN Nix packages are installed on worker nodes, THE Container Platform SHALL cache common packages to reduce build times for subsequent deployments.
4. WHERE a user selects an application template, THE Container Platform SHALL provide pre-configured Nix expressions for common frameworks (Node.js, Python, Go, static sites).
5. WHEN a Nix build fails, THE Container Platform SHALL provide detailed error messages including dependency conflicts and package resolution issues.

### Requirement 5: Hourly Billing for Containers

**User Story:** As a platform operator, I want to charge users hourly for their container resource usage, so that billing integrates seamlessly with the existing VPS billing system.

#### Acceptance Criteria

1. WHEN a container is running, THE Billing System SHALL track resource consumption (CPU cores, memory GB, storage GB, network transfer) on an hourly basis.
2. WHEN the hourly billing reconciliation runs, THE Billing System SHALL calculate container costs using configurable pricing rates and deduct amounts from user wallet balances.
3. WHEN a user views their billing dashboard, THE Billing System SHALL display itemized container costs with breakdowns by service, resource type, and time period.
4. WHEN a container is stopped or deleted, THE Billing System SHALL calculate final costs and generate a transaction record within 5 minutes.
5. WHEN a user's wallet balance is insufficient, THE Billing System SHALL send notifications and optionally suspend container services based on administrator-configured grace periods.

### Requirement 6: Application Templates

**User Story:** As a user, I want to deploy applications from pre-built templates, so that I can quickly launch common application types without complex configuration.

#### Acceptance Criteria

1. WHEN a user browses the template library, THE Container Platform SHALL display available templates with descriptions, resource requirements, and estimated costs.
2. WHERE a user selects a template, THE Container Platform SHALL pre-populate deployment configuration with recommended settings for that application type.
3. WHEN a template-based deployment is created, THE Container Platform SHALL apply the template's Nix expression and environment variable defaults.
4. WHEN an administrator creates or updates a template, THE Container Platform SHALL validate the template configuration and make it available to users within their organization.
5. WHEN a template includes multiple services (e.g., application + database), THE Container Platform SHALL deploy all services with appropriate networking and dependencies.

### Requirement 7: Build Pipeline

**User Story:** As a user, I want my application code to be automatically built and deployed when I push changes, so that I can follow modern CI/CD practices.

#### Acceptance Criteria

1. WHEN a user connects a Git repository to a container service, THE Build Pipeline SHALL automatically trigger builds on new commits to the configured branch.
2. WHEN a build is triggered, THE Build Pipeline SHALL clone the repository, execute the build process using Nix or Docker, and create a deployable container image.
3. WHEN a build completes successfully, THE Build Pipeline SHALL automatically deploy the new container version and provide rollback options for the previous version.
4. WHEN a build fails, THE Build Pipeline SHALL preserve the currently running container version and notify the user with detailed build logs.
5. WHEN a user views build history, THE Build Pipeline SHALL display all builds with timestamps, status, duration, and artifact storage costs.

### Requirement 8: Resource Management and Quotas

**User Story:** As an administrator, I want to set resource quotas per organization, so that I can prevent resource exhaustion and ensure fair usage across tenants.

#### Acceptance Criteria

1. WHEN an administrator configures organization quotas, THE Container Platform SHALL enforce limits on total CPU cores, memory, storage, and number of containers.
2. WHEN a user attempts to deploy a container that would exceed their organization's quota, THE Container Platform SHALL reject the deployment and display the current quota usage and limits.
3. WHEN an organization approaches quota limits (80% utilization), THE Container Platform SHALL send notifications to organization administrators and platform administrators.
4. WHEN an administrator views the resource management dashboard, THE Container Platform SHALL display cluster-wide capacity, per-organization usage, and worker node distribution.
5. WHEN worker node capacity changes, THE Container Platform SHALL recalculate available resources and update quota enforcement within 30 seconds.

### Requirement 9: Container Networking and Isolation

**User Story:** As a platform operator, I want containers to be network-isolated by organization, so that multi-tenant security is maintained.

#### Acceptance Criteria

1. WHEN a container is deployed, THE Container Platform SHALL assign the container to an organization-specific network namespace.
2. WHEN containers within the same organization communicate, THE Container Platform SHALL allow direct network connectivity using service discovery.
3. WHEN a container attempts to access resources outside its organization, THE Container Platform SHALL block the connection unless explicitly configured by an administrator.
4. WHEN a user requests external network access for a container, THE Container Platform SHALL provide a unique public endpoint with optional SSL/TLS termination.
5. WHEN network traffic is routed to a container, THE Container Platform SHALL apply rate limiting and DDoS protection based on administrator-configured policies.

### Requirement 10: Monitoring and Logging

**User Story:** As a user, I want to view real-time logs and metrics for my containers, so that I can troubleshoot issues and monitor application performance.

#### Acceptance Criteria

1. WHEN a container is running, THE Container Platform SHALL stream application logs in real-time to the user dashboard with filtering and search capabilities.
2. WHEN a user views container metrics, THE Container Platform SHALL display CPU usage, memory usage, network I/O, and disk I/O with 1-minute granularity.
3. WHEN a container experiences errors or crashes, THE Container Platform SHALL send real-time notifications to the user via the existing notification system.
4. WHEN an administrator views cluster monitoring, THE Container Platform SHALL display aggregate metrics across all workers, organizations, and containers.
5. WHEN log retention limits are reached, THE Container Platform SHALL archive older logs and provide options for users to download archived logs for up to 30 days.

### Requirement 11: Security and Secrets Management

**User Story:** As a user, I want to securely store and inject secrets into my containers, so that sensitive credentials are not exposed in code or configuration files.

#### Acceptance Criteria

1. WHEN a user creates a secret, THE Container Platform SHALL encrypt the secret value using the existing encryption infrastructure and store it securely.
2. WHEN a container is deployed with secret references, THE Container Platform SHALL inject secrets as environment variables or mounted files without exposing values in logs.
3. WHEN a user updates a secret, THE Container Platform SHALL provide options to automatically restart affected containers or require manual restart.
4. WHEN a user deletes a secret, THE Container Platform SHALL prevent deletion if the secret is currently in use by running containers.
5. WHEN an administrator audits secret access, THE Container Platform SHALL log all secret creation, modification, and access events with timestamps and user identities.

### Requirement 12: Worker Health Monitoring

**User Story:** As an administrator, I want automatic health monitoring of worker nodes, so that unhealthy workers are detected and workloads are redistributed.

#### Acceptance Criteria

1. WHEN a worker node is registered, THE Container Platform SHALL continuously monitor worker health using heartbeat checks every 30 seconds.
2. WHEN a worker fails to respond to health checks for 2 consecutive minutes, THE Container Platform SHALL mark the worker as unhealthy and stop routing new deployments to it.
3. WHEN a worker is marked unhealthy, THE Container Platform SHALL attempt to migrate running containers to healthy workers based on administrator-configured policies.
4. WHEN a previously unhealthy worker recovers, THE Container Platform SHALL automatically restore the worker to active status and resume normal operations.
5. WHEN worker health metrics indicate resource exhaustion (CPU > 90%, memory > 95%, disk > 90%), THE Container Platform SHALL send alerts to administrators and optionally trigger auto-scaling.
