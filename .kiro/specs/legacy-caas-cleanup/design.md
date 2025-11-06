# Design Document

## Overview

This design document outlines the systematic removal of all legacy Container as a Service (CaaS) references, Easypanel integration, and Dokploy integration from SkyPanelV2. Based on the codebase analysis, the cleanup primarily involves documentation updates, removal of legacy spec files, provider API files, and environment variable references, as the core application appears to have already been cleaned of most container-related code.

## Architecture

The cleanup will follow a layered approach to ensure complete removal of legacy references:

1. **Documentation Layer**: Remove all container service references from README, guides, and API documentation
2. **Configuration Layer**: Clean environment variables, package dependencies, and build configurations  
3. **Specification Layer**: Remove legacy spec directories and provider API files
4. **Database Layer**: Create migration to remove any remaining container-related schema elements
5. **Validation Layer**: Ensure no orphaned references remain in the codebase

## Components and Interfaces

### Documentation Cleanup Component

**Purpose**: Remove all container-related content from documentation files

**Files to Update**:
- `README.md` - Remove CaaS feature highlights and setup instructions
- `repo-docs/ENVIRONMENT_VARIABLES.md` - Remove container environment variables
- `AGENTS.md` - Remove container service references from agent guide
- Remove `repo-docs/CONTAINER_API_REFERENCE.md` if it exists

**Key Changes**:
- Update feature descriptions to focus on VPS-only services
- Remove container platform integration sections
- Update branding copy to reflect VPS-only platform
- Remove container-related API endpoint documentation

### Configuration Cleanup Component

**Purpose**: Remove container-related configuration and dependencies

**Files to Update**:
- `.env.example` - Remove CAAS_*, EASYPANEL_*, DOKPLOY_* variables
- `package.json` - Remove dockerode and container orchestration dependencies
- Build configuration files - Remove container-related build steps

**Environment Variables to Remove**:
```
CAAS_API_URL
CAAS_API_KEY  
CAAS_MODE
EASYPANEL_API_URL
EASYPANEL_API_TOKEN
DOKPLOY_API_URL
DOKPLOY_API_TOKEN
```

### Specification Cleanup Component

**Purpose**: Remove legacy spec directories and provider files

**Directories to Remove**:
- `.kiro/specs/easypanel-caas-integration/`
- `.kiro/specs/easypanel-connection-fix/`
- `.kiro/specs/native-caas-completion/`

**Provider Files to Remove**:
- `repo-docs/provider-api-files/dokploy/dokploy.json`
- Any other Easypanel or Dokploy provider configuration files

### Database Migration Component

**Purpose**: Ensure database schema contains no container-related artifacts

**Migration Strategy**:
- Create a new migration file to drop any container-related tables if they exist
- The current schema analysis shows no container tables in the main migration
- Migration will be defensive, using IF EXISTS clauses to avoid errors

**Potential Tables to Check**:
```sql
-- Tables that might exist from previous implementations
DROP TABLE IF EXISTS caas_config CASCADE;
DROP TABLE IF EXISTS container_plans CASCADE;
DROP TABLE IF EXISTS container_subscriptions CASCADE;
DROP TABLE IF EXISTS container_projects CASCADE;
DROP TABLE IF EXISTS container_services CASCADE;
DROP TABLE IF EXISTS container_billing_cycles CASCADE;
DROP TABLE IF EXISTS easypanel_templates CASCADE;
DROP TABLE IF EXISTS dokploy_configs CASCADE;
```

### Frontend Cleanup Component

**Purpose**: Remove container references from UI components

**Based on Analysis**: The search results show minimal container references in the frontend:
- `src/pages/Home.tsx` - Update tagline to remove "Container Services"
- Navigation components - Ensure no container menu items exist
- Dashboard components - Remove any container-related widgets

### Validation Component

**Purpose**: Ensure complete cleanup with no orphaned references

**Validation Steps**:
1. Search for remaining container/caas/easypanel/dokploy references
2. Verify all environment variables are removed
3. Check that no container-related imports remain
4. Validate that build processes complete successfully
5. Ensure no broken links in documentation

## Data Models

### Migration Schema Changes

```sql
-- Migration: Remove legacy container artifacts
-- File: migrations/XXX_remove_legacy_container_artifacts.sql

-- Drop container-related tables if they exist
DROP TABLE IF EXISTS container_billing_cycles CASCADE;
DROP TABLE IF EXISTS container_services CASCADE;
DROP TABLE IF EXISTS container_projects CASCADE;
DROP TABLE IF EXISTS container_subscriptions CASCADE;
DROP TABLE IF EXISTS container_plans CASCADE;
DROP TABLE IF EXISTS caas_config CASCADE;
DROP TABLE IF EXISTS easypanel_templates CASCADE;
DROP TABLE IF EXISTS dokploy_configs CASCADE;

-- Remove container-related columns from existing tables
ALTER TABLE organizations DROP COLUMN IF EXISTS container_quota;
ALTER TABLE users DROP COLUMN IF EXISTS container_preferences;
ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'container.%';
ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'caas.%';
ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'easypanel.%';
ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'dokploy.%';

-- Clean up any container-related platform settings
DELETE FROM platform_settings WHERE key LIKE '%container%';
DELETE FROM platform_settings WHERE key LIKE '%caas%';
DELETE FROM platform_settings WHERE key LIKE '%easypanel%';
DELETE FROM platform_settings WHERE key LIKE '%dokploy%';
```

### Configuration Data Model

**Environment Variables Removal**:
- Remove all CAAS_* prefixed variables
- Remove all EASYPANEL_* prefixed variables  
- Remove all DOKPLOY_* prefixed variables
- Update documentation to reflect VPS-only configuration

**Package Dependencies Removal**:
- Remove dockerode and Docker client libraries
- Remove any Easypanel or Dokploy client packages
- Remove container orchestration utilities
- Update package-lock.json accordingly

## Error Handling

### Migration Error Handling

**Strategy**: Use defensive SQL with IF EXISTS clauses to prevent errors when dropping non-existent tables

**Error Scenarios**:
1. **Table doesn't exist**: Use `DROP TABLE IF EXISTS` to avoid errors
2. **Column doesn't exist**: Use conditional column drops with information_schema checks
3. **Foreign key constraints**: Use CASCADE to handle dependent objects
4. **Data integrity**: Preserve all VPS and billing data during cleanup

### Documentation Update Error Handling

**Strategy**: Validate all documentation links and references after cleanup

**Error Scenarios**:
1. **Broken internal links**: Update or remove links to removed sections
2. **Orphaned references**: Search for and remove any remaining container mentions
3. **Inconsistent branding**: Ensure all copy reflects VPS-only platform

### Configuration Error Handling

**Strategy**: Validate application startup after configuration cleanup

**Error Scenarios**:
1. **Missing dependencies**: Remove unused imports and dependencies
2. **Configuration validation**: Update startup scripts to not check for container variables
3. **Build failures**: Ensure all container-related build steps are removed

## Testing Strategy

### Cleanup Validation Tests

**Database Migration Testing**:
1. Test migration on clean database (should complete without errors)
2. Test migration on database with existing container tables (should clean up properly)
3. Verify all VPS and billing data remains intact after migration

**Configuration Testing**:
1. Verify application starts successfully without container environment variables
2. Test that removed dependencies don't cause import errors
3. Validate that build process completes without container-related steps

**Documentation Testing**:
1. Check all internal links work correctly
2. Verify no broken references to removed sections
3. Ensure consistent messaging about VPS-only platform

### Regression Testing

**Core Functionality Testing**:
1. VPS management features continue to work
2. Billing and payment processing unaffected
3. User authentication and authorization intact
4. Admin panel functionality preserved

**Integration Testing**:
1. Linode and DigitalOcean integrations continue working
2. PayPal payment integration unaffected
3. Email notifications still function
4. SSH console access remains operational

## Implementation Phases

### Phase 1: Documentation Cleanup
- Update README.md and remove container references
- Clean up AGENTS.md and environment variable documentation
- Remove container API documentation files
- Update home page and marketing copy

### Phase 2: Configuration Cleanup  
- Remove container environment variables from .env.example
- Clean up package.json dependencies
- Update build and deployment configurations
- Remove container-related scripts

### Phase 3: Specification Cleanup
- Remove legacy spec directories
- Delete Dokploy provider API files
- Clean up any remaining provider configuration files

### Phase 4: Database Migration
- Create and test database migration
- Remove any container-related tables and columns
- Clean up container-related activity logs and settings

### Phase 5: Validation and Testing
- Search for any remaining container references
- Test application startup and core functionality
- Validate documentation links and consistency
- Perform regression testing on VPS features

## Risk Mitigation

### Data Loss Prevention
- Use defensive SQL with IF EXISTS clauses
- Preserve all VPS and billing data during cleanup
- Create database backup before running migration

### Functionality Preservation
- Focus cleanup only on container-related code
- Preserve all VPS management functionality
- Maintain existing integrations and workflows

### Rollback Strategy
- Keep removed files in version control history
- Document all changes for potential rollback
- Test rollback procedures in development environment

## Success Criteria

1. **Complete Reference Removal**: No mentions of containers, CaaS, Easypanel, or Dokploy in codebase
2. **Clean Documentation**: All documentation reflects VPS-only platform accurately
3. **Functional Application**: All VPS features continue to work without issues
4. **Clean Configuration**: No container-related environment variables or dependencies
5. **Successful Migration**: Database migration completes without errors and preserves VPS data