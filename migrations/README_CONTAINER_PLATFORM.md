# Container Platform Database Schema

This document describes the database schema for the Container Platform feature added in migration `002_container_platform.sql`.

## Overview

The Container Platform extends SkyPanelV2 with Container-as-a-Service (CaaS) capabilities, enabling users to deploy containerized applications with Nix-based builds, Docker Swarm orchestration, and hourly billing.

## Tables

### container_workers
Stores information about worker nodes that run containerized applications.

**Key Fields:**
- `id`: Unique worker identifier
- `name`: Human-readable worker name
- `hostname`, `ip_address`: Network identification
- `swarm_node_id`: Docker Swarm node identifier
- `auth_token_hash`: Hashed authentication token for worker registration
- `status`: Worker health status (pending, active, unhealthy, draining, offline)
- `capacity`: JSON object with CPU cores, memory MB, disk GB
- `current_load`: JSON object with resource utilization percentages
- `last_heartbeat_at`: Timestamp of last health check

**Indexes:**
- Status, last_heartbeat_at, swarm_node_id for health monitoring queries

### application_templates
Pre-configured deployment templates for common frameworks and application types.

**Key Fields:**
- `id`: Unique template identifier
- `name`: Template name (e.g., "Node.js", "Django", "MERN Stack")
- `category`: Template category (web, api, worker, database, static, custom)
- `nix_expression`: Nix package definition for reproducible builds
- `default_env_vars`: JSON object with default environment variables
- `default_resource_limits`: JSON object with CPU, memory, disk defaults
- `is_multi_service`: Boolean indicating if template deploys multiple services
- `services`: JSON array of service definitions for multi-service templates

**Indexes:**
- Category, is_active, display_order for template library queries

### container_services
User-deployed container services.

**Key Fields:**
- `id`: Unique service identifier
- `organization_id`: Multi-tenant isolation
- `name`, `slug`: Service identification
- `template_id`: Reference to application template (optional)
- `git_repository`, `git_branch`: Git source configuration
- `build_config`: JSON object with build settings
- `environment_vars`: JSON object with environment variables
- `resource_limits`: JSON object with CPU, memory, disk limits
- `status`: Service status (pending, building, deploying, running, stopped, failed, deleted)
- `current_deployment_id`: Reference to active deployment

**Indexes:**
- organization_id, status, template_id for service listing
- Composite index on (organization_id, slug) for uniqueness
- created_at for chronological queries

### container_deployments
Individual deployment instances of container services.

**Key Fields:**
- `id`: Unique deployment identifier
- `service_id`: Reference to container service
- `worker_id`: Worker node running this deployment
- `swarm_service_id`, `container_id`: Docker Swarm identifiers
- `image_tag`: Container image reference
- `status`: Deployment status (pending, building, deploying, running, stopped, failed, rolled_back)
- `build_logs`, `deployment_logs`: Deployment process logs
- `public_url`: External access URL
- `deployed_at`, `stopped_at`: Lifecycle timestamps

**Indexes:**
- service_id, worker_id, status for deployment queries
- Composite index on (service_id, status) for active deployment lookup
- created_at, deployed_at for chronological queries

### container_builds
Build process tracking for container images.

**Key Fields:**
- `id`: Unique build identifier
- `service_id`: Reference to container service
- `deployment_id`: Reference to resulting deployment (optional)
- `git_commit_sha`: Git commit that triggered build
- `build_status`: Build status (pending, building, success, failed, cancelled)
- `build_logs`: Complete build output
- `image_tag`: Resulting container image tag
- `build_duration_seconds`: Build performance metric
- `artifact_size_mb`: Image size metric

**Indexes:**
- service_id, build_status, git_commit_sha for build history
- Composite index on (service_id, created_at) for recent builds

### container_secrets
Encrypted secrets for container services.

**Key Fields:**
- `id`: Unique secret identifier
- `organization_id`: Multi-tenant isolation
- `name`: Secret name (unique per organization)
- `encrypted_value`: Encrypted secret value
- `created_by`: User who created the secret
- `last_rotated_at`: Secret rotation timestamp

**Indexes:**
- organization_id, created_by for secret management
- Composite index on (organization_id, name) for uniqueness

### container_service_secrets
Junction table linking secrets to services.

**Key Fields:**
- `service_id`, `secret_id`: Composite primary key
- `mount_path`: File system path for secret mounting (optional)
- `env_var_name`: Environment variable name for secret injection (optional)

**Indexes:**
- service_id, secret_id for secret usage queries

### container_billing_cycles
Hourly billing records for container resource usage.

**Key Fields:**
- `id`: Unique billing cycle identifier
- `service_id`: Reference to container service
- `organization_id`: Multi-tenant isolation
- `billing_period_start`, `billing_period_end`: Billing period timestamps
- `cpu_hours`, `memory_gb_hours`, `storage_gb_hours`: Resource usage metrics
- `network_gb`: Network transfer metric
- `build_minutes`: Build time metric
- `total_amount`: Calculated billing amount
- `status`: Billing status (pending, billed, failed, refunded)
- `payment_transaction_id`: Reference to payment transaction

**Indexes:**
- service_id, organization_id, status for billing queries
- Composite index on (organization_id, billing_period_start) for billing history
- Composite index on (status, billing_period_end) for pending billing cycles

## Relationships

```
organizations (1) ──< (N) container_services
organizations (1) ──< (N) container_secrets
organizations (1) ──< (N) container_billing_cycles

users (1) ──< (N) container_secrets (created_by)

application_templates (1) ──< (N) container_services

container_services (1) ──< (N) container_deployments
container_services (1) ──< (N) container_builds
container_services (1) ──< (N) container_billing_cycles
container_services (1) ──< (N) container_service_secrets
container_services (1) ──o (1) container_deployments (current_deployment_id)

container_workers (1) ──< (N) container_deployments

container_deployments (1) ──o (1) container_builds

container_secrets (1) ──< (N) container_service_secrets

payment_transactions (1) ──< (N) container_billing_cycles
```

## Triggers

All tables with `updated_at` columns have triggers that automatically update the timestamp on row modification:
- `container_workers`
- `application_templates`
- `container_services`
- `container_deployments`
- `container_secrets`
- `container_billing_cycles`

The trigger function `update_updated_at_column()` is defined in the initial schema migration.

## Running the Migration

```bash
# Apply all migrations including container platform
# This will automatically seed default application templates
node scripts/run-migration.js
```

The migration includes automatic seeding of 13 default application templates:
- Single-service: Node.js, Next.js, Express.js, Python, Django, Flask, Go, Static Site, Vite Static Site
- Multi-service: MERN Stack, Rails + PostgreSQL, Django + PostgreSQL + Redis

## Rollback

To rollback the container platform migration:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS container_billing_cycles CASCADE;
DROP TABLE IF EXISTS container_service_secrets CASCADE;
DROP TABLE IF EXISTS container_secrets CASCADE;
DROP TABLE IF EXISTS container_builds CASCADE;
DROP TABLE IF EXISTS container_deployments CASCADE;
DROP TABLE IF EXISTS container_services CASCADE;
DROP TABLE IF EXISTS application_templates CASCADE;
DROP TABLE IF EXISTS container_workers CASCADE;
```

## Performance Considerations

- All foreign key columns are indexed for join performance
- Status columns are indexed for filtering queries
- Timestamp columns are indexed for time-based queries
- Composite indexes support common query patterns (e.g., service + status, organization + period)
- JSONB columns use GIN indexes where appropriate (not included in initial migration, can be added later if needed)

## Security Considerations

- `container_secrets.encrypted_value` stores encrypted data using the existing encryption infrastructure
- `container_workers.auth_token_hash` stores hashed authentication tokens
- Multi-tenant isolation enforced via `organization_id` foreign keys
- Cascade deletes ensure data cleanup when organizations or services are removed
- RESTRICT on `container_secrets.created_by` prevents user deletion if they created secrets
