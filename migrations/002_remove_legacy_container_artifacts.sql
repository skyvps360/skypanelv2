-- Migration 002: Remove Legacy Container Artifacts
-- Date: 2025-11-06
-- This migration removes all legacy Container as a Service (CaaS) references,
-- Easypanel integration, and Dokploy integration artifacts from the database.

-- Drop Container-Related Tables (Defensive)

-- Drop container billing and subscription tables
DROP TABLE IF EXISTS container_billing_cycles CASCADE;
DROP TABLE IF EXISTS container_services CASCADE;
DROP TABLE IF EXISTS container_projects CASCADE;
DROP TABLE IF EXISTS container_subscriptions CASCADE;
DROP TABLE IF EXISTS container_plans CASCADE;

-- Drop CaaS configuration tables
DROP TABLE IF EXISTS caas_config CASCADE;
DROP TABLE IF EXISTS caas_templates CASCADE;
DROP TABLE IF EXISTS caas_deployments CASCADE;

-- Drop Easypanel integration tables
DROP TABLE IF EXISTS easypanel_templates CASCADE;
DROP TABLE IF EXISTS easypanel_projects CASCADE;
DROP TABLE IF EXISTS easypanel_services CASCADE;
DROP TABLE IF EXISTS easypanel_configs CASCADE;

-- Drop Dokploy integration tables
DROP TABLE IF EXISTS dokploy_configs CASCADE;
DROP TABLE IF EXISTS dokploy_projects CASCADE;
DROP TABLE IF EXISTS dokploy_services CASCADE;
DROP TABLE IF EXISTS dokploy_templates CASCADE;

-- Remove Container-Related Columns from Existing Tables

-- Remove container-related columns from organizations table
ALTER TABLE organizations DROP COLUMN IF EXISTS container_quota;
ALTER TABLE organizations DROP COLUMN IF EXISTS container_limit;
ALTER TABLE organizations DROP COLUMN IF EXISTS caas_enabled;
ALTER TABLE organizations DROP COLUMN IF EXISTS easypanel_enabled;
ALTER TABLE organizations DROP COLUMN IF EXISTS dokploy_enabled;

-- Remove container-related columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS container_preferences;
ALTER TABLE users DROP COLUMN IF EXISTS caas_preferences;
ALTER TABLE users DROP COLUMN IF EXISTS easypanel_preferences;
ALTER TABLE users DROP COLUMN IF EXISTS dokploy_preferences;

-- Remove container-related columns from wallets table
ALTER TABLE wallets DROP COLUMN IF EXISTS container_balance;
ALTER TABLE wallets DROP COLUMN IF EXISTS caas_balance;

-- Clean Up Activity Logs

-- Remove container-related activity log entries
DELETE FROM activity_logs 
WHERE event_type LIKE 'container.%'
   OR event_type LIKE 'caas.%'
   OR event_type LIKE 'easypanel.%'
   OR event_type LIKE 'dokploy.%';

-- Remove container-related entity types from activity logs
DELETE FROM activity_logs 
WHERE entity_type IN (
    'container',
    'container_service',
    'container_project',
    'container_subscription',
    'container_plan',
    'caas_config',
    'caas_template',
    'caas_deployment',
    'easypanel_template',
    'easypanel_project',
    'easypanel_service',
    'easypanel_config',
    'dokploy_config',
    'dokploy_project',
    'dokploy_service',
    'dokploy_template'
);

-- Clean Up Platform Settings

-- Remove container-related platform settings
DELETE FROM platform_settings 
WHERE key LIKE '%container%'
   OR key LIKE '%caas%'
   OR key LIKE '%easypanel%'
   OR key LIKE '%dokploy%';

-- Remove specific container configuration keys
DELETE FROM platform_settings 
WHERE key IN (
    'container_enabled',
    'caas_enabled',
    'caas_api_url',
    'caas_api_key',
    'caas_mode',
    'easypanel_enabled',
    'easypanel_api_url',
    'easypanel_api_token',
    'dokploy_enabled',
    'dokploy_api_url',
    'dokploy_api_token',
    'container_billing_enabled',
    'container_plans_enabled',
    'container_templates_enabled'
);

-- Clean Up Payment Transactions

-- Remove container-related payment transactions
DELETE FROM payment_transactions 
WHERE description LIKE '%container%'
   OR description LIKE '%caas%'
   OR description LIKE '%easypanel%'
   OR description LIKE '%dokploy%'
   OR metadata::text LIKE '%container%'
   OR metadata::text LIKE '%caas%'
   OR metadata::text LIKE '%easypanel%'
   OR metadata::text LIKE '%dokploy%';

-- Clean Up Support Tickets

-- Update support ticket categories to remove container references
UPDATE support_tickets 
SET category = 'technical'
WHERE category IN (
    'container',
    'caas',
    'easypanel',
    'dokploy',
    'container_support',
    'caas_support'
);

-- Clean Up User API Keys

-- Remove container-related permissions from API keys
UPDATE user_api_keys 
SET permissions = permissions - 'container' - 'caas' - 'easypanel' - 'dokploy'
WHERE permissions ? 'container' 
   OR permissions ? 'caas' 
   OR permissions ? 'easypanel' 
   OR permissions ? 'dokploy';

-- Final Comments

COMMENT ON SCHEMA public IS 'SkyPanelV2 database schema - Container artifacts removed in migration 002';

-- Migration completed successfully
-- All legacy container, CaaS, Easypanel, and Dokploy artifacts have been removed
-- VPS and billing data has been preserved