# Requirements Document

## Introduction

This document specifies the requirements for integrating Easypanel Container as a Service (CaaS) into SkyPanelV2. The integration will enable the platform to offer containerized application hosting alongside existing VPS services. Users will be able to deploy, manage, and monitor containerized applications through subscription-based plans, while administrators can configure available templates, manage plans, and monitor container deployments.

## Glossary

- **Easypanel**: A container management platform that provides an API for deploying and managing Docker containers
- **CaaS**: Container as a Service - a cloud service model that allows users to deploy and manage containerized applications
- **Container Plan**: A subscription tier that defines resource limits and pricing for container deployments
- **Project**: An Easypanel organizational unit that contains one or more services
- **Service**: A containerized application running within an Easypanel project (can be App, Database, or WordPress)
- **Template**: A pre-configured application blueprint available for one-click deployment
- **App Service**: A custom containerized application deployed from Docker image, Git repository, or uploaded code
- **Database Service**: A managed database container (PostgreSQL, MySQL, MariaDB, MongoDB, Redis)
- **Resource Quota**: The maximum CPU, memory, and storage allocated to a container plan
- **SkyPanelV2**: The platform application integrating Easypanel CaaS
- **Admin Dashboard**: The administrative interface for managing platform settings and resources
- **User Dashboard**: The customer-facing interface for deploying and managing containers

## Requirements

### Requirement 1

**User Story:** As a platform administrator, I want to configure Easypanel API credentials, so that the platform can communicate with the Easypanel instance

#### Acceptance Criteria

1. WHEN the administrator accesses platform settings, THE SkyPanelV2 SHALL display an Easypanel configuration section
2. THE SkyPanelV2 SHALL accept an Easypanel API URL input field
3. THE SkyPanelV2 SHALL accept an Easypanel API key input field
4. WHEN the administrator saves Easypanel credentials, THE SkyPanelV2 SHALL encrypt the API key before storing in the database
5. WHEN the administrator tests the connection, THE SkyPanelV2 SHALL verify connectivity by calling the Easypanel auth.getUser endpoint
6. IF the connection test fails, THEN THE SkyPanelV2 SHALL display an error message with failure details
7. WHEN the connection test succeeds, THE SkyPanelV2 SHALL display a success confirmation message

### Requirement 2

**User Story:** As a platform administrator, I want to create and manage container plans, so that users can subscribe to different service tiers

#### Acceptance Criteria

1. WHEN the administrator navigates to Plan Management, THE SkyPanelV2 SHALL display a "Container Plans" section alongside "VPS Plans"
2. THE SkyPanelV2 SHALL allow the administrator to create a new container plan with name, description, and pricing
3. THE SkyPanelV2 SHALL accept resource quota inputs including maximum CPU cores, maximum memory in GB, maximum storage in GB, and maximum number of containers
4. THE SkyPanelV2 SHALL accept pricing inputs for monthly subscription cost
5. WHEN the administrator saves a container plan, THE SkyPanelV2 SHALL store the plan configuration in the database
6. THE SkyPanelV2 SHALL allow the administrator to edit existing container plans
7. THE SkyPanelV2 SHALL allow the administrator to activate or deactivate container plans
8. WHEN a container plan is deactivated, THE SkyPanelV2 SHALL hide the plan from new user subscriptions while maintaining existing subscriptions

### Requirement 3

**User Story:** As a platform administrator, I want to configure available application templates, so that users can deploy pre-configured applications

#### Acceptance Criteria

1. WHEN the administrator accesses template management, THE SkyPanelV2 SHALL fetch available templates from the Easypanel API using the templates.createFromSchema endpoint
2. THE SkyPanelV2 SHALL display a list of all available Easypanel templates with name, description, and category
3. THE SkyPanelV2 SHALL allow the administrator to enable or disable specific templates for user deployment
4. THE SkyPanelV2 SHALL allow the administrator to set custom display names for templates
5. THE SkyPanelV2 SHALL allow the administrator to organize templates into categories
6. WHEN the administrator saves template configuration, THE SkyPanelV2 SHALL store the enabled templates and customizations in the database
7. THE SkyPanelV2 SHALL display only enabled templates to users in the deployment interface

### Requirement 4

**User Story:** As a user, I want to subscribe to a container plan, so that I can deploy containerized applications

#### Acceptance Criteria

1. WHEN the user navigates to container services, THE SkyPanelV2 SHALL display all active container plans with pricing and resource limits
2. THE SkyPanelV2 SHALL display plan details including maximum containers, CPU cores, memory, and storage
3. WHEN the user selects a plan, THE SkyPanelV2 SHALL verify the organization wallet has sufficient balance
4. IF the wallet balance is insufficient, THEN THE SkyPanelV2 SHALL display an error message and prompt to add funds
5. WHEN the user confirms subscription, THE SkyPanelV2 SHALL deduct the monthly fee from the organization wallet
6. THE SkyPanelV2 SHALL create a container subscription record linked to the organization
7. THE SkyPanelV2 SHALL log the subscription activity in the activity logs
8. WHEN subscription is successful, THE SkyPanelV2 SHALL redirect the user to the container management dashboard

### Requirement 5

**User Story:** As a user, I want to create a new project in Easypanel, so that I can organize my containerized services

#### Acceptance Criteria

1. WHEN the user accesses the container dashboard, THE SkyPanelV2 SHALL display a "Create Project" button
2. WHEN the user clicks create project, THE SkyPanelV2 SHALL display a project creation form
3. THE SkyPanelV2 SHALL accept a project name input following the pattern ^[a-z0-9-_]+$
4. THE SkyPanelV2 SHALL validate the project name matches the required pattern before submission
5. WHEN the user submits the form, THE SkyPanelV2 SHALL call the Easypanel projects.createProject endpoint
6. THE SkyPanelV2 SHALL store the project metadata in the database linked to the organization
7. IF project creation fails, THEN THE SkyPanelV2 SHALL display an error message with failure details
8. WHEN project creation succeeds, THE SkyPanelV2 SHALL display the new project in the projects list

### Requirement 6

**User Story:** As a user, I want to deploy a containerized application from a template, so that I can quickly launch pre-configured services

#### Acceptance Criteria

1. WHEN the user selects a project, THE SkyPanelV2 SHALL display a "Deploy from Template" option
2. WHEN the user clicks deploy from template, THE SkyPanelV2 SHALL display all enabled templates
3. THE SkyPanelV2 SHALL display template details including name, description, required resources, and configuration options
4. WHEN the user selects a template, THE SkyPanelV2 SHALL verify the deployment does not exceed plan resource quotas
5. IF resource quotas would be exceeded, THEN THE SkyPanelV2 SHALL display an error message and prevent deployment
6. THE SkyPanelV2 SHALL accept service name input following the pattern ^[a-z0-9-_]+$
7. THE SkyPanelV2 SHALL accept template-specific configuration inputs as defined by the template schema
8. WHEN the user submits deployment, THE SkyPanelV2 SHALL call the Easypanel templates.createFromSchema endpoint
9. THE SkyPanelV2 SHALL store the service metadata in the database linked to the project
10. THE SkyPanelV2 SHALL log the deployment activity in the activity logs
11. WHEN deployment succeeds, THE SkyPanelV2 SHALL display the new service in the services list

### Requirement 7

**User Story:** As a user, I want to deploy a custom application from a Docker image, so that I can run my own containerized applications

#### Acceptance Criteria

1. WHEN the user selects a project, THE SkyPanelV2 SHALL display a "Deploy Custom App" option
2. WHEN the user clicks deploy custom app, THE SkyPanelV2 SHALL display an app deployment form
3. THE SkyPanelV2 SHALL accept service name input following the pattern ^[a-z0-9-_]+$
4. THE SkyPanelV2 SHALL accept Docker image name input
5. THE SkyPanelV2 SHALL accept optional environment variables as key-value pairs
6. THE SkyPanelV2 SHALL accept optional port mappings
7. THE SkyPanelV2 SHALL accept optional resource limits for CPU and memory
8. WHEN the user submits deployment, THE SkyPanelV2 SHALL verify the deployment does not exceed plan resource quotas
9. IF resource quotas would be exceeded, THEN THE SkyPanelV2 SHALL display an error message and prevent deployment
10. THE SkyPanelV2 SHALL call the Easypanel services.app.createService endpoint
11. THE SkyPanelV2 SHALL store the service metadata in the database
12. WHEN deployment succeeds, THE SkyPanelV2 SHALL display the new service in the services list

### Requirement 8

**User Story:** As a user, I want to view all my deployed containers, so that I can monitor and manage my services

#### Acceptance Criteria

1. WHEN the user accesses the container dashboard, THE SkyPanelV2 SHALL display all projects owned by the organization
2. THE SkyPanelV2 SHALL call the Easypanel projects.listProjectsAndServices endpoint to fetch current data
3. THE SkyPanelV2 SHALL display project name, creation date, and service count for each project
4. WHEN the user selects a project, THE SkyPanelV2 SHALL display all services within that project
5. THE SkyPanelV2 SHALL display service name, type, status, and resource usage for each service
6. THE SkyPanelV2 SHALL display service status as running, stopped, or error based on Easypanel data
7. THE SkyPanelV2 SHALL display current resource usage including CPU percentage, memory usage, and storage usage
8. THE SkyPanelV2 SHALL refresh service data automatically every 30 seconds

### Requirement 9

**User Story:** As a user, I want to start, stop, and restart my containers, so that I can control service availability

#### Acceptance Criteria

1. WHEN the user views a service, THE SkyPanelV2 SHALL display start, stop, and restart action buttons
2. WHEN the user clicks start on a stopped service, THE SkyPanelV2 SHALL call the Easypanel services.app.startService endpoint
3. WHEN the user clicks stop on a running service, THE SkyPanelV2 SHALL call the Easypanel services.app.stopService endpoint
4. WHEN the user clicks restart on a running service, THE SkyPanelV2 SHALL call the Easypanel services.app.restartService endpoint
5. THE SkyPanelV2 SHALL display a loading indicator while the action is in progress
6. IF the action fails, THEN THE SkyPanelV2 SHALL display an error message with failure details
7. WHEN the action succeeds, THE SkyPanelV2 SHALL update the service status display
8. THE SkyPanelV2 SHALL log the action in the activity logs

### Requirement 10

**User Story:** As a user, I want to view container logs, so that I can troubleshoot issues and monitor application behavior

#### Acceptance Criteria

1. WHEN the user selects a service, THE SkyPanelV2 SHALL display a "View Logs" option
2. WHEN the user clicks view logs, THE SkyPanelV2 SHALL call the Easypanel projects.getDockerContainers endpoint to retrieve container information
3. THE SkyPanelV2 SHALL display the most recent 100 log lines by default
4. THE SkyPanelV2 SHALL display log timestamp, log level, and log message for each entry
5. THE SkyPanelV2 SHALL allow the user to filter logs by log level
6. THE SkyPanelV2 SHALL allow the user to search logs by text content
7. THE SkyPanelV2 SHALL provide a "Refresh" button to fetch updated logs
8. THE SkyPanelV2 SHALL provide a "Download" button to export logs as a text file

### Requirement 11

**User Story:** As a user, I want to update container environment variables, so that I can configure application settings

#### Acceptance Criteria

1. WHEN the user selects a service, THE SkyPanelV2 SHALL display an "Environment Variables" section
2. WHEN the user accesses environment variables, THE SkyPanelV2 SHALL call the Easypanel services.app.inspectService endpoint to fetch current configuration
3. THE SkyPanelV2 SHALL display all current environment variables as key-value pairs
4. THE SkyPanelV2 SHALL allow the user to add new environment variables
5. THE SkyPanelV2 SHALL allow the user to edit existing environment variable values
6. THE SkyPanelV2 SHALL allow the user to delete environment variables
7. WHEN the user saves changes, THE SkyPanelV2 SHALL call the Easypanel services.app.updateEnv endpoint
8. THE SkyPanelV2 SHALL display a confirmation message when changes are saved
9. THE SkyPanelV2 SHALL log the configuration change in the activity logs

### Requirement 12

**User Story:** As a user, I want to delete a container service, so that I can remove services I no longer need

#### Acceptance Criteria

1. WHEN the user views a service, THE SkyPanelV2 SHALL display a "Delete Service" option
2. WHEN the user clicks delete service, THE SkyPanelV2 SHALL display a confirmation dialog
3. THE SkyPanelV2 SHALL display a warning that deletion is permanent and cannot be undone
4. THE SkyPanelV2 SHALL require the user to type the service name to confirm deletion
5. WHEN the user confirms deletion, THE SkyPanelV2 SHALL call the Easypanel services.app.destroyService endpoint
6. THE SkyPanelV2 SHALL remove the service metadata from the database
7. THE SkyPanelV2 SHALL update the organization resource usage calculations
8. THE SkyPanelV2 SHALL log the deletion activity in the activity logs
9. WHEN deletion succeeds, THE SkyPanelV2 SHALL redirect the user to the project services list

### Requirement 13

**User Story:** As a user, I want to delete a project, so that I can remove projects I no longer need

#### Acceptance Criteria

1. WHEN the user views a project, THE SkyPanelV2 SHALL display a "Delete Project" option
2. WHEN the user clicks delete project, THE SkyPanelV2 SHALL verify the project contains no services
3. IF the project contains services, THEN THE SkyPanelV2 SHALL display an error message requiring service deletion first
4. WHEN the project is empty, THE SkyPanelV2 SHALL display a confirmation dialog
5. THE SkyPanelV2 SHALL require the user to type the project name to confirm deletion
6. WHEN the user confirms deletion, THE SkyPanelV2 SHALL call the Easypanel projects.destroyProject endpoint
7. THE SkyPanelV2 SHALL remove the project metadata from the database
8. THE SkyPanelV2 SHALL log the deletion activity in the activity logs
9. WHEN deletion succeeds, THE SkyPanelV2 SHALL redirect the user to the projects list

### Requirement 14

**User Story:** As a platform administrator, I want to view all container deployments across all organizations, so that I can monitor platform usage

#### Acceptance Criteria

1. WHEN the administrator accesses the admin dashboard, THE SkyPanelV2 SHALL display a "Container Management" section
2. THE SkyPanelV2 SHALL display total number of active container subscriptions
3. THE SkyPanelV2 SHALL display total number of deployed projects across all organizations
4. THE SkyPanelV2 SHALL display total number of deployed services across all organizations
5. THE SkyPanelV2 SHALL display aggregate resource usage including total CPU, memory, and storage
6. THE SkyPanelV2 SHALL display a list of all organizations with active container subscriptions
7. WHEN the administrator selects an organization, THE SkyPanelV2 SHALL display that organization's projects and services
8. THE SkyPanelV2 SHALL allow the administrator to view service details for any organization

### Requirement 15

**User Story:** As a platform administrator, I want to enforce resource quotas, so that users cannot exceed their plan limits

#### Acceptance Criteria

1. WHEN a user attempts to deploy a new service, THE SkyPanelV2 SHALL calculate the total resource usage including the new service
2. THE SkyPanelV2 SHALL retrieve the organization's active container plan resource quotas
3. THE SkyPanelV2 SHALL verify the total CPU usage does not exceed the plan maximum CPU cores
4. THE SkyPanelV2 SHALL verify the total memory usage does not exceed the plan maximum memory in GB
5. THE SkyPanelV2 SHALL verify the total storage usage does not exceed the plan maximum storage in GB
6. THE SkyPanelV2 SHALL verify the total service count does not exceed the plan maximum number of containers
7. IF any quota would be exceeded, THEN THE SkyPanelV2 SHALL prevent the deployment and display an error message
8. THE SkyPanelV2 SHALL display which specific quota limit would be exceeded in the error message

### Requirement 16

**User Story:** As a user, I want to view my current resource usage, so that I can understand my plan utilization

#### Acceptance Criteria

1. WHEN the user accesses the container dashboard, THE SkyPanelV2 SHALL display a resource usage summary
2. THE SkyPanelV2 SHALL display current CPU usage as cores used out of plan maximum
3. THE SkyPanelV2 SHALL display current memory usage as GB used out of plan maximum
4. THE SkyPanelV2 SHALL display current storage usage as GB used out of plan maximum
5. THE SkyPanelV2 SHALL display current container count out of plan maximum
6. THE SkyPanelV2 SHALL display usage percentages for each resource type
7. THE SkyPanelV2 SHALL display visual progress bars for each resource quota
8. WHEN usage exceeds 80 percent of any quota, THE SkyPanelV2 SHALL display a warning indicator

### Requirement 17

**User Story:** As a platform administrator, I want to configure billing for container plans, so that users are charged monthly for their subscriptions

#### Acceptance Criteria

1. WHEN a user subscribes to a container plan, THE SkyPanelV2 SHALL create a billing cycle record with start date and end date
2. THE SkyPanelV2 SHALL set the billing cycle end date to 30 days after the start date
3. THE SkyPanelV2 SHALL store the monthly rate from the container plan in the billing cycle record
4. WHEN the billing cycle end date is reached, THE SkyPanelV2 SHALL automatically deduct the monthly fee from the organization wallet
5. THE SkyPanelV2 SHALL create a payment transaction record for the billing charge
6. THE SkyPanelV2 SHALL create a new billing cycle record for the next 30 days
7. IF the wallet balance is insufficient, THEN THE SkyPanelV2 SHALL suspend the container subscription
8. THE SkyPanelV2 SHALL log the billing activity in the activity logs

### Requirement 18

**User Story:** As a user, I want to cancel my container subscription, so that I can stop being charged

#### Acceptance Criteria

1. WHEN the user accesses subscription management, THE SkyPanelV2 SHALL display active container subscriptions
2. THE SkyPanelV2 SHALL display subscription details including plan name, monthly cost, and next billing date
3. WHEN the user clicks cancel subscription, THE SkyPanelV2 SHALL verify the organization has no active projects
4. IF active projects exist, THEN THE SkyPanelV2 SHALL display an error message requiring project deletion first
5. WHEN no projects exist, THE SkyPanelV2 SHALL display a confirmation dialog
6. WHEN the user confirms cancellation, THE SkyPanelV2 SHALL mark the subscription as cancelled
7. THE SkyPanelV2 SHALL prevent new billing cycles from being created
8. THE SkyPanelV2 SHALL log the cancellation activity in the activity logs

### Requirement 19

**User Story:** As a user, I want to deploy database services, so that I can run managed databases for my applications

#### Acceptance Criteria

1. WHEN the user selects a project, THE SkyPanelV2 SHALL display a "Deploy Database" option
2. WHEN the user clicks deploy database, THE SkyPanelV2 SHALL display available database types including PostgreSQL, MySQL, MariaDB, MongoDB, and Redis
3. THE SkyPanelV2 SHALL accept service name input following the pattern ^[a-z0-9-_]+$
4. THE SkyPanelV2 SHALL accept database version selection
5. THE SkyPanelV2 SHALL accept optional database credentials including username and password
6. THE SkyPanelV2 SHALL accept optional resource limits for memory and storage
7. WHEN the user submits deployment, THE SkyPanelV2 SHALL verify the deployment does not exceed plan resource quotas
8. THE SkyPanelV2 SHALL call the appropriate Easypanel database service creation endpoint based on database type
9. THE SkyPanelV2 SHALL store the service metadata in the database
10. WHEN deployment succeeds, THE SkyPanelV2 SHALL display the database connection information

### Requirement 20

**User Story:** As a platform administrator, I want to view container deployment activity logs, so that I can audit user actions

#### Acceptance Criteria

1. WHEN the administrator accesses activity logs, THE SkyPanelV2 SHALL display container-related events
2. THE SkyPanelV2 SHALL log events for project creation with event type "container.project.create"
3. THE SkyPanelV2 SHALL log events for service deployment with event type "container.service.create"
4. THE SkyPanelV2 SHALL log events for service start with event type "container.service.start"
5. THE SkyPanelV2 SHALL log events for service stop with event type "container.service.stop"
6. THE SkyPanelV2 SHALL log events for service restart with event type "container.service.restart"
7. THE SkyPanelV2 SHALL log events for service deletion with event type "container.service.delete"
8. THE SkyPanelV2 SHALL log events for project deletion with event type "container.project.delete"
9. THE SkyPanelV2 SHALL include organization ID, user ID, entity type, entity ID, and timestamp in each log entry
10. THE SkyPanelV2 SHALL allow the administrator to filter logs by event type, organization, and date range
