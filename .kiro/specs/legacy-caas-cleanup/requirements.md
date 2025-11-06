# Requirements Document

## Introduction

This document specifies the requirements for removing all legacy Container as a Service (CaaS) references, Easypanel integration, and Dokploy integration from SkyPanelV2. The platform will be simplified to focus exclusively on VPS services, removing all container-related functionality, database schemas, API endpoints, and documentation references that were part of the abandoned container service implementations.

## Glossary

- **SkyPanelV2**: The platform application that will be simplified to VPS-only services
- **Legacy_CaaS**: The abandoned native Docker-based Container as a Service implementation
- **Easypanel_Integration**: The abandoned Easypanel third-party container platform integration
- **Dokploy_Integration**: The abandoned Dokploy third-party container platform integration
- **Container_Schema**: Database tables and fields related to container services that need removal
- **Container_API**: API endpoints and routes related to container management that need removal
- **Container_UI**: Frontend components and pages related to container services that need removal
- **VPS_Platform**: The core VPS management functionality that will remain as the primary service offering

## Requirements

### Requirement 1

**User Story:** As a platform administrator, I want all container-related database schema removed, so that the database only contains VPS and billing structures

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove all container-related database tables including caas_config, container_plans, container_subscriptions, container_projects, container_services, and container_billing_cycles
2. THE SkyPanelV2 SHALL remove all container-related columns from existing tables
3. THE SkyPanelV2 SHALL create a database migration script to safely drop container tables and columns
4. WHEN the migration runs, THE SkyPanelV2 SHALL preserve all VPS and billing data while removing container data
5. THE SkyPanelV2 SHALL update any foreign key constraints that reference removed container tables

### Requirement 2

**User Story:** As a developer, I want all container-related API endpoints removed, so that the API surface only includes VPS management

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove all API routes under /api/containers and /api/caas paths
2. THE SkyPanelV2 SHALL remove container-related service classes including CaasService, ContainerBillingService, and EasypanelService
3. THE SkyPanelV2 SHALL remove container-related middleware and authentication handlers
4. THE SkyPanelV2 SHALL remove all container-related TypeScript interfaces and types
5. THE SkyPanelV2 SHALL update API documentation to remove container endpoint references

### Requirement 3

**User Story:** As a user, I want all container-related UI components removed, so that the interface only shows VPS management options

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove all container-related React components and pages
2. THE SkyPanelV2 SHALL remove container navigation items from menus and sidebars
3. THE SkyPanelV2 SHALL remove container-related dashboard sections and widgets
4. THE SkyPanelV2 SHALL update the home page to remove container service references
5. THE SkyPanelV2 SHALL remove container-related forms, modals, and management interfaces

### Requirement 4

**User Story:** As a platform administrator, I want all container configuration removed from admin settings, so that admin interface only manages VPS providers

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove CaaS configuration sections from admin settings
2. THE SkyPanelV2 SHALL remove Easypanel and Dokploy configuration options
3. THE SkyPanelV2 SHALL remove container plan management from admin interface
4. THE SkyPanelV2 SHALL remove container template management functionality
5. THE SkyPanelV2 SHALL remove container billing configuration options

### Requirement 5

**User Story:** As a developer, I want all container-related environment variables removed, so that configuration only includes VPS and billing settings

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove CAAS_API_URL, CAAS_API_KEY, and CAAS_MODE environment variables from .env.example
2. THE SkyPanelV2 SHALL remove EASYPANEL_API_URL and EASYPANEL_API_TOKEN environment variables
3. THE SkyPanelV2 SHALL remove DOKPLOY_API_URL and DOKPLOY_API_TOKEN environment variables
4. THE SkyPanelV2 SHALL update environment variable documentation to remove container references
5. THE SkyPanelV2 SHALL remove container-related configuration validation from startup scripts

### Requirement 6

**User Story:** As a developer, I want all container-related documentation removed, so that documentation only covers VPS functionality

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove all container-related sections from README.md
2. THE SkyPanelV2 SHALL remove Container API Reference documentation files
3. THE SkyPanelV2 SHALL remove Easypanel and Dokploy integration guides
4. THE SkyPanelV2 SHALL update feature highlights to remove container service mentions
5. THE SkyPanelV2 SHALL remove container-related examples from API documentation

### Requirement 7

**User Story:** As a developer, I want all container-related scripts removed, so that utility scripts only support VPS operations

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove container billing processing scripts
2. THE SkyPanelV2 SHALL remove container deployment and management scripts
3. THE SkyPanelV2 SHALL remove Easypanel and Dokploy connection testing scripts
4. THE SkyPanelV2 SHALL update existing scripts to remove container-related functionality
5. THE SkyPanelV2 SHALL remove container-related migration scripts except for cleanup migration

### Requirement 8

**User Story:** As a developer, I want all container-related dependencies removed, so that the project only includes VPS-related packages

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove dockerode and Docker-related npm packages
2. THE SkyPanelV2 SHALL remove Easypanel and Dokploy client libraries
3. THE SkyPanelV2 SHALL remove container orchestration dependencies
4. THE SkyPanelV2 SHALL update package.json to remove unused container-related dependencies
5. THE SkyPanelV2 SHALL run npm audit to ensure no security vulnerabilities from removed packages

### Requirement 9

**User Story:** As a platform administrator, I want all container-related activity logging removed, so that activity logs only track VPS operations

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove container-related event types from activity logging
2. THE SkyPanelV2 SHALL remove container deployment, start, stop, and delete log entries
3. THE SkyPanelV2 SHALL remove container billing and subscription activity logs
4. THE SkyPanelV2 SHALL update activity log filtering to remove container categories
5. THE SkyPanelV2 SHALL preserve all VPS-related activity logs during cleanup

### Requirement 10

**User Story:** As a developer, I want all container-related test files removed, so that the test suite only covers VPS functionality

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove all container service test files
2. THE SkyPanelV2 SHALL remove container API endpoint tests
3. THE SkyPanelV2 SHALL remove container billing and subscription tests
4. THE SkyPanelV2 SHALL remove Easypanel and Dokploy integration tests
5. THE SkyPanelV2 SHALL update test configuration to remove container test paths

### Requirement 11

**User Story:** As a developer, I want all container-related build and deployment configuration removed, so that builds only include VPS components

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove container-related build steps from package.json scripts
2. THE SkyPanelV2 SHALL remove container service imports from main application files
3. THE SkyPanelV2 SHALL remove container-related webpack or Vite configuration
4. THE SkyPanelV2 SHALL update deployment scripts to remove container service deployment
5. THE SkyPanelV2 SHALL remove container-related Docker compose configurations

### Requirement 12

**User Story:** As a platform administrator, I want all legacy spec files removed, so that specs directory only contains current feature specifications

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove the easypanel-caas-integration spec directory
2. THE SkyPanelV2 SHALL remove the easypanel-connection-fix spec directory  
3. THE SkyPanelV2 SHALL remove the native-caas-completion spec directory
4. THE SkyPanelV2 SHALL remove any other container-related spec directories
5. THE SkyPanelV2 SHALL preserve VPS-related specs and current active specifications

### Requirement 13

**User Story:** As a developer, I want all provider API files for Dokploy removed, so that provider integrations only include VPS providers

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove the dokploy.json OpenAPI specification file
2. THE SkyPanelV2 SHALL remove any Dokploy-related provider configuration files
3. THE SkyPanelV2 SHALL remove Easypanel provider API files if they exist
4. THE SkyPanelV2 SHALL preserve Linode and DigitalOcean provider API files
5. THE SkyPanelV2 SHALL update provider documentation to remove container provider references

### Requirement 14

**User Story:** As a user, I want the platform branding updated to reflect VPS-only services, so that marketing copy accurately represents available services

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL update the home page tagline to remove container service references
2. THE SkyPanelV2 SHALL update feature descriptions to focus on VPS management capabilities
3. THE SkyPanelV2 SHALL update navigation and menu items to remove container options
4. THE SkyPanelV2 SHALL update dashboard welcome messages to reflect VPS-only platform
5. THE SkyPanelV2 SHALL update any help text or tooltips that reference container services

### Requirement 15

**User Story:** As a developer, I want all container-related error handling removed, so that error messages only cover VPS scenarios

#### Acceptance Criteria

1. THE SkyPanelV2 SHALL remove container-specific error messages and codes
2. THE SkyPanelV2 SHALL remove container quota exceeded error handling
3. THE SkyPanelV2 SHALL remove Easypanel and Dokploy API error handling
4. THE SkyPanelV2 SHALL remove container deployment failure error scenarios
5. THE SkyPanelV2 SHALL preserve all VPS-related error handling and messaging