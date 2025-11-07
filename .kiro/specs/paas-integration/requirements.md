# Requirements Document

## Introduction

This document defines the requirements for integrating Platform-as-a-Service (PaaS) capabilities into SkyPanelV2. The PaaS feature enables customers to deploy and manage containerized applications (similar to Heroku) alongside existing VPS offerings. The system provides a control-plane architecture where SkyPanelV2 manages deployments across multiple worker nodes running containerized workloads. Administrators configure hosting plans, runtimes, and infrastructure nodes, while customers deploy applications via Git integration with automated builds and deployments.

## Glossary

- **Control Plane**: The central SkyPanelV2 application that manages PaaS deployments, billing, and orchestration
- **Worker Node**: A server running the PaaS Agent that executes container workloads
- **PaaS Agent**: Lightweight service installed on Worker Nodes that communicates with the Control Plane
- **App Instance**: A containerized application deployment running on a Worker Node
- **App Hosting Plan**: A pricing tier defining resource limits (CPU, RAM, storage) for applications
- **Runtime**: Pre-configured execution environment (Node.js, Python, PHP, or custom Docker)
- **Buildpack**: Automated build system that detects and builds applications from source code
- **Ingress Proxy**: Reverse proxy (Nginx/Traefik) on Worker Nodes routing traffic to App Instances
- **System Domain**: Default subdomain assigned to applications (e.g., appname.platform.com)
- **Database Instance**: Managed database container (MySQL, PostgreSQL) provisioned for customer use
- **Prepaid Wallet**: Existing SkyPanelV2 billing mechanism for hourly usage charges

## Requirements

### Requirement 1

**User Story:** As a platform administrator, I want to configure App Hosting Plans with resource limits and pricing, so that customers can select appropriate tiers for their applications

#### Acceptance Criteria

1. WHEN the administrator accesses the admin dashboard, THE Control Plane SHALL display a PaaS Plans management section
2. WHEN the administrator creates an App Hosting Plan, THE Control Plane SHALL require plan name, CPU limit, RAM limit, storage limit, monthly price, and hourly rate
3. WHEN the administrator defines a plan, THE Control Plane SHALL allow specification of supported runtimes from available options
4. WHEN the administrator saves a plan, THE Control Plane SHALL store the configuration in the database and make it available to customers
5. WHEN the administrator updates plan pricing, THE Control Plane SHALL apply new rates to future deployments while maintaining existing instance rates

### Requirement 2

**User Story:** As a platform administrator, I want to manage available runtime environments and build configurations, so that customers can deploy applications in supported languages and frameworks

#### Acceptance Criteria

1. WHEN the administrator accesses runtime settings, THE Control Plane SHALL display available runtimes with versions
2. WHEN the administrator adds a runtime, THE Control Plane SHALL require runtime type, version identifier, and base Docker image reference
3. WHEN the administrator configures build presets, THE Control Plane SHALL allow specification of default build commands and start commands per runtime
4. WHERE custom Docker image support is enabled, THE Control Plane SHALL allow administrators to toggle this feature for security control
5. WHEN the administrator saves runtime configurations, THE Control Plane SHALL validate Docker image references and store settings

### Requirement 3

**User Story:** As a platform administrator, I want to add and manage Worker Nodes to the PaaS infrastructure, so that I can scale hosting capacity across regions

#### Acceptance Criteria

1. WHEN the administrator initiates node addition, THE Control Plane SHALL generate a unique registration token with expiration
2. WHEN the administrator requests setup instructions, THE Control Plane SHALL provide a script that installs Docker and the PaaS Agent
3. WHEN a Worker Node executes the setup script, THE PaaS Agent SHALL register with the Control Plane using the token
4. WHEN a PaaS Agent connects, THE Control Plane SHALL authenticate the token and establish a persistent secure connection
5. WHEN the administrator views infrastructure, THE Control Plane SHALL display all Worker Nodes with status, region, resource usage, and capacity metrics

### Requirement 4

**User Story:** As a platform administrator, I want to monitor Worker Node health and capacity, so that I can ensure reliable service and plan infrastructure expansion

#### Acceptance Criteria

1. WHILE a PaaS Agent is connected, THE PaaS Agent SHALL send heartbeat messages with CPU usage, memory usage, disk usage, and container count every 30 seconds
2. IF a Worker Node stops sending heartbeats for 90 seconds, THEN THE Control Plane SHALL mark the node as offline
3. WHEN the administrator views a Worker Node, THE Control Plane SHALL display current resource utilization and deployment count
4. WHEN a Worker Node reaches 90% capacity, THE Control Plane SHALL generate an alert notification
5. WHEN the administrator disables a Worker Node, THE Control Plane SHALL prevent new deployments to that node

### Requirement 5

**User Story:** As a customer, I want to create a new application deployment, so that I can host my web application on the platform

#### Acceptance Criteria

1. WHEN the customer accesses the PaaS section, THE Control Plane SHALL display an option to create a new application
2. WHEN the customer creates an application, THE Control Plane SHALL require application name, runtime selection, App Hosting Plan, and deployment region
3. WHEN the customer selects a runtime, THE Control Plane SHALL display only runtimes enabled by administrators
4. WHEN the customer selects a region, THE Control Plane SHALL display only regions with available Worker Node capacity
5. WHEN the customer submits the application, THE Control Plane SHALL validate inputs and create the application record

### Requirement 6

**User Story:** As a customer, I want to connect my GitHub repository for deployments, so that I can deploy code directly from my version control system

#### Acceptance Criteria

1. WHEN the customer configures deployment source, THE Control Plane SHALL offer GitHub OAuth integration
2. WHEN the customer authorizes GitHub access, THE Control Plane SHALL store OAuth tokens securely
3. WHEN the customer selects a repository, THE Control Plane SHALL display available branches
4. WHEN the customer selects a branch, THE Control Plane SHALL store the repository URL and branch reference
5. WHERE the customer enables auto-deploy, THE Control Plane SHALL configure webhook listeners for push events

### Requirement 7

**User Story:** As a customer, I want to deploy my application with one click, so that my code is built and running without manual server configuration

#### Acceptance Criteria

1. WHEN the customer triggers deployment, THE Control Plane SHALL select an available Worker Node in the specified region
2. WHEN the Control Plane initiates deployment, THE Control Plane SHALL send a deployment task to the selected PaaS Agent
3. WHEN the PaaS Agent receives a deployment task, THE PaaS Agent SHALL clone the Git repository in an isolated build container
4. WHEN the source code is retrieved, THE PaaS Agent SHALL detect the appropriate buildpack or use the provided Dockerfile
5. WHEN the build completes successfully, THE PaaS Agent SHALL create a Docker image and start a container with plan-allocated resources

### Requirement 8

**User Story:** As a customer, I want to view build and deployment logs, so that I can troubleshoot issues and verify successful deployments

#### Acceptance Criteria

1. WHILE a build is in progress, THE PaaS Agent SHALL stream build output to the Control Plane
2. WHEN the customer views deployment details, THE Control Plane SHALL display real-time build logs
3. IF a build fails, THEN THE Control Plane SHALL display error messages and exit codes
4. WHEN a deployment completes, THE Control Plane SHALL display the final build status and container startup logs
5. WHEN the customer views application logs, THE Control Plane SHALL display stdout and stderr from the running container

### Requirement 9

**User Story:** As a customer, I want to configure environment variables for my application, so that I can provide configuration and secrets without hardcoding them

#### Acceptance Criteria

1. WHEN the customer accesses application settings, THE Control Plane SHALL display an environment variables section
2. WHEN the customer adds an environment variable, THE Control Plane SHALL require a key and value
3. WHEN the customer saves environment variables, THE Control Plane SHALL store them securely in the database
4. WHEN the PaaS Agent starts an App Instance, THE PaaS Agent SHALL inject environment variables into the container
5. WHEN the customer updates environment variables, THE Control Plane SHALL require redeployment to apply changes

### Requirement 10

**User Story:** As a customer, I want to provision managed databases, so that my applications have persistent data storage without manual database setup

#### Acceptance Criteria

1. WHEN the customer requests a database, THE Control Plane SHALL display available database types and versions
2. WHEN the customer selects a database type, THE Control Plane SHALL require database name, version, and plan selection
3. WHEN the customer creates a database, THE Control Plane SHALL deploy an official database image container on an appropriate Worker Node
4. WHEN a Database Instance starts, THE PaaS Agent SHALL initialize credentials and configure persistent volume storage
5. WHEN the database is ready, THE Control Plane SHALL provide connection details including hostname, port, username, password, and database name

### Requirement 11

**User Story:** As a customer, I want databases automatically linked to my applications, so that connection details are available without manual configuration

#### Acceptance Criteria

1. WHEN the customer links a database to an application, THE Control Plane SHALL generate a connection URL
2. WHEN a database is linked, THE Control Plane SHALL automatically create environment variables with connection details
3. WHEN the customer views linked databases, THE Control Plane SHALL display database name, type, and connection status
4. WHEN the customer unlinks a database, THE Control Plane SHALL remove associated environment variables
5. WHEN the application restarts, THE PaaS Agent SHALL inject updated database connection environment variables

### Requirement 12

**User Story:** As a customer, I want to manage my running applications, so that I can control application lifecycle and monitor performance

#### Acceptance Criteria

1. WHEN the customer views an application, THE Control Plane SHALL display current status (running, stopped, building, failed)
2. WHEN the customer views application metrics, THE Control Plane SHALL display CPU usage, memory usage, and request count
3. WHEN the customer restarts an application, THE Control Plane SHALL send a restart command to the PaaS Agent
4. WHEN the customer stops an application, THE Control Plane SHALL halt the container and stop hourly billing
5. WHEN the customer deletes an application, THE Control Plane SHALL remove all containers, data, and billing records

### Requirement 13

**User Story:** As a customer, I want my applications accessible via HTTPS with automatic SSL certificates, so that my users have secure connections

#### Acceptance Criteria

1. WHEN an App Instance is deployed, THE Control Plane SHALL assign a System Domain in the format appname.platform.com
2. WHEN the Ingress Proxy receives a request, THE Ingress Proxy SHALL route traffic to the appropriate App Instance container
3. WHEN a System Domain is assigned, THE PaaS Agent SHALL request a Let's Encrypt SSL certificate automatically
4. WHERE the customer adds a custom domain, THE Control Plane SHALL provide CNAME configuration instructions
5. WHEN a custom domain is verified, THE PaaS Agent SHALL provision an SSL certificate for the custom domain

### Requirement 14

**User Story:** As a customer, I want container-level isolation for my applications, so that my workloads are secure and cannot interfere with other tenants

#### Acceptance Criteria

1. WHEN the PaaS Agent creates a container, THE PaaS Agent SHALL run the container without privileged mode
2. WHEN the PaaS Agent configures a container, THE PaaS Agent SHALL apply resource limits matching the App Hosting Plan
3. WHEN the PaaS Agent starts a container, THE PaaS Agent SHALL use a non-root user for application processes
4. WHEN the PaaS Agent creates container networks, THE PaaS Agent SHALL isolate each customer's containers on separate networks
5. WHEN the PaaS Agent mounts volumes, THE PaaS Agent SHALL ensure filesystem isolation per application

### Requirement 15

**User Story:** As a customer, I want my application usage billed hourly from my prepaid wallet, so that I only pay for resources I consume

#### Acceptance Criteria

1. WHEN an App Instance starts, THE Control Plane SHALL begin hourly billing at the plan's hourly rate
2. WHEN the hourly billing cycle runs, THE Control Plane SHALL deduct charges from the customer's Prepaid Wallet
3. WHEN an App Instance is stopped, THE Control Plane SHALL cease hourly billing immediately
4. WHEN the customer upgrades a plan, THE Control Plane SHALL apply the new hourly rate from the next billing cycle
5. IF the Prepaid Wallet balance is insufficient, THEN THE Control Plane SHALL suspend the App Instance and notify the customer

### Requirement 16

**User Story:** As a customer, I want to view detailed usage and billing for my PaaS resources, so that I can track spending and optimize costs

#### Acceptance Criteria

1. WHEN the customer views billing, THE Control Plane SHALL display current month-to-date PaaS spending
2. WHEN the customer views an invoice, THE Control Plane SHALL itemize each App Instance and Database Instance with hours and cost
3. WHEN the customer views application details, THE Control Plane SHALL display accumulated charges for the current billing period
4. WHEN the customer sets a spending alert, THE Control Plane SHALL notify when PaaS spending exceeds the threshold
5. WHEN the customer views usage reports, THE Control Plane SHALL show resource consumption trends over time

### Requirement 17

**User Story:** As a customer, I want to scale my application horizontally, so that I can handle increased traffic by running multiple instances

#### Acceptance Criteria

1. WHEN the customer accesses scaling settings, THE Control Plane SHALL display current instance count and scaling options
2. WHEN the customer increases instance count, THE Control Plane SHALL deploy additional containers on the same Worker Node
3. WHEN multiple instances are running, THE Ingress Proxy SHALL distribute requests across instances using round-robin
4. WHEN the customer scales instances, THE Control Plane SHALL adjust hourly billing to reflect the total instance count
5. WHEN the customer decreases instance count, THE Control Plane SHALL gracefully terminate excess containers

### Requirement 18

**User Story:** As a customer, I want to upgrade my application plan, so that I can allocate more resources as my needs grow

#### Acceptance Criteria

1. WHEN the customer selects a plan upgrade, THE Control Plane SHALL display available higher-tier plans
2. WHEN the customer confirms an upgrade, THE Control Plane SHALL update the application record with the new plan
3. WHEN a plan upgrade is applied, THE PaaS Agent SHALL restart the container with updated resource limits
4. WHEN the plan changes, THE Control Plane SHALL begin billing at the new hourly rate immediately
5. WHEN the customer downgrades a plan, THE Control Plane SHALL verify the application fits within new resource limits

### Requirement 19

**User Story:** As a platform administrator, I want the system to schedule deployments intelligently across Worker Nodes, so that resources are utilized efficiently

#### Acceptance Criteria

1. WHEN the Control Plane schedules a deployment, THE Control Plane SHALL filter Worker Nodes by the requested region
2. WHEN multiple Worker Nodes are available, THE Control Plane SHALL select the node with the lowest current resource utilization
3. IF no Worker Node has sufficient capacity, THEN THE Control Plane SHALL reject the deployment and notify the customer
4. WHEN a Worker Node is marked offline, THE Control Plane SHALL exclude it from scheduling decisions
5. WHEN the administrator sets capacity limits on a Worker Node, THE Control Plane SHALL respect those limits during scheduling

### Requirement 20

**User Story:** As a platform administrator, I want to configure database backup schedules, so that customer data is protected against loss

#### Acceptance Criteria

1. WHEN the administrator configures backup settings, THE Control Plane SHALL allow specification of backup frequency and retention period
2. WHEN a scheduled backup time occurs, THE Control Plane SHALL instruct the PaaS Agent to create a database snapshot
3. WHEN the PaaS Agent creates a backup, THE PaaS Agent SHALL store the backup file with timestamp and database identifier
4. WHEN the customer requests a backup restore, THE Control Plane SHALL provide a list of available backup points
5. WHEN the customer initiates a restore, THE PaaS Agent SHALL restore the Database Instance from the selected backup
