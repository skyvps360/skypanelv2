# Implementation Plan

- [x] 1. Update documentation to remove container service references




  - Update README.md to remove all CaaS, Easypanel, and Dokploy mentions
  - Remove container service features from feature highlights
  - Update setup instructions to remove container environment variables
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Clean README.md container references


  - Remove "Container as a Service (CaaS)" from feature highlights
  - Remove container platform configuration sections
  - Update tagline to focus on VPS services only
  - Remove CAAS_API_URL and CAAS_API_KEY from environment variable examples
  - _Requirements: 6.1, 6.4, 14.1, 14.2_

- [x] 1.2 Update AGENTS.md to remove container references


  - Remove container service mentions from product overview
  - Remove Easypanel and Dokploy from key integrations list
  - Remove container-related API endpoints from documentation
  - Update development commands to remove container-related scripts
  - _Requirements: 6.1, 6.4_

- [x] 1.3 Clean environment variable documentation


  - Remove CAAS_API_URL, CAAS_API_KEY, CAAS_MODE from .env.example
  - Remove EASYPANEL_API_URL, EASYPANEL_API_TOKEN from examples
  - Remove DOKPLOY_API_URL, DOKPLOY_API_TOKEN from examples
  - Update environment variable documentation files
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 1.4 Update home page branding


  - Change "Deploy VPS and Container Services" tagline in src/pages/Home.tsx
  - Update feature descriptions to focus on VPS management
  - Remove any container service marketing copy
  - _Requirements: 14.1, 14.2, 14.4_

- [x] 2. Remove legacy specification files and provider configurations




  - Delete legacy CaaS-related spec directories
  - Remove Dokploy provider API files
  - Clean up any remaining container provider configurations
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3_

- [x] 2.1 Remove legacy spec directories


  - Delete .kiro/specs/easypanel-caas-integration/ directory
  - Delete .kiro/specs/easypanel-connection-fix/ directory
  - Delete .kiro/specs/native-caas-completion/ directory
  - Verify no other container-related spec directories exist
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 2.2 Remove Dokploy provider API files



  - Delete repo-docs/provider-api-files/dokploy/dokploy.json
  - Remove any other Dokploy-related provider configuration files
  - Remove any Easypanel provider API files if they exist
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 3. Create database migration to remove container artifacts





  - Create migration script to drop any container-related tables
  - Remove container-related activity log entries
  - Clean up container-related platform settings
  - Test migration on clean and existing databases
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 9.1, 9.2, 9.3_

- [x] 3.1 Create container cleanup migration




  - Create new migration file migrations/XXX_remove_legacy_container_artifacts.sql
  - Add defensive DROP TABLE IF EXISTS statements for container tables
  - Remove container-related columns from existing tables if they exist
  - Include cleanup of activity logs with container event types
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.2 Clean up activity logs and platform settings

  - Remove activity log entries with container.*, caas.*, easypanel.*, dokploy.* event types
  - Delete platform settings with container, caas, easypanel, dokploy keys
  - Preserve all VPS and billing related data during cleanup
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3.3 Test database migration


  - Test migration on clean database installation
  - Test migration on database with potential container artifacts
  - Verify all VPS and billing data remains intact
  - Validate migration rollback procedures
  - _Requirements: 1.1, 1.2, 1.3, 1.4_


- [x] 4. Clean up package dependencies and build configuration




  - Remove container-related npm packages
  - Update package.json to remove unused dependencies
  - Clean up build scripts and deployment configurations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.1, 11.2, 11.3_

- [x] 4.1 Remove container-related dependencies


  - Remove dockerode and Docker client libraries from package.json
  - Remove any Easypanel or Dokploy client packages
  - Remove container orchestration utilities
  - Run npm audit to check for security vulnerabilities
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4.2 Update build and deployment configuration


  - Remove container-related build steps from package.json scripts
  - Remove container service imports from main application files
  - Update deployment scripts to remove container service deployment
  - Remove container-related webpack or Vite configuration
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 5. Remove container-related scripts and utilities




  - Delete container billing processing scripts
  - Remove container deployment and management scripts
  - Remove Easypanel and Dokploy connection testing scripts
  - Update existing scripts to remove container functionality
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5.1 Clean up utility scripts


  - Remove container billing processing scripts from scripts/ directory
  - Remove container deployment and management scripts
  - Remove Easypanel and Dokploy connection testing scripts
  - Update existing scripts to remove any container-related functionality
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Validate complete cleanup and test functionality




  - Search for any remaining container references in codebase
  - Test application startup without container environment variables
  - Verify all VPS functionality continues to work
  - Validate documentation links and consistency
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 6.1 Search for remaining container references


  - Use grep/search tools to find any remaining container, caas, easypanel, dokploy references
  - Check for orphaned imports or configuration references
  - Verify no broken links in documentation
  - Ensure consistent VPS-only messaging throughout
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 6.2 Test core application functionality


  - Verify application starts successfully without container environment variables
  - Test VPS management features continue to work
  - Validate billing and payment processing unaffected
  - Ensure admin panel functionality preserved
  - _Requirements: 15.5_

- [x] 6.3 Perform regression testing


  - Test Linode and DigitalOcean integrations
  - Verify PayPal payment integration works
  - Test email notifications functionality
  - Validate SSH console access remains operational
  - _Requirements: 15.5_