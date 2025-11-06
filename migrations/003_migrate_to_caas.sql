-- Migration: Replace Easypanel/Dokploy with CaaS
-- Date: 2025-11-05
-- Description: Removes legacy container provider tables and creates new caas_config table

-- ============================================================
-- Drop Legacy Provider Tables
-- ============================================================

-- Drop Dokploy configuration table if exists
DROP TABLE IF EXISTS dokploy_config CASCADE;

-- Drop Easypanel configuration table if exists (may not exist in all deployments)
DROP TABLE IF EXISTS easypanel_config CASCADE;

-- ============================================================
-- Remove Legacy Columns from Container Tables
-- ============================================================

-- Remove Dokploy-specific columns from container_projects
ALTER TABLE container_projects 
DROP COLUMN IF EXISTS dokploy_project_id CASCADE;

-- Remove Dokploy-specific columns from container_services
ALTER TABLE container_services 
DROP COLUMN IF EXISTS dokploy_application_id CASCADE,
DROP COLUMN IF EXISTS dokploy_environment_id CASCADE;

-- ============================================================
-- Create CaaS Configuration Table
-- ============================================================

CREATE TABLE IF NOT EXISTS caas_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_url TEXT NOT NULL,
    api_key_encrypted TEXT,
    status VARCHAR(50) DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'unknown')),
    last_connection_test TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Create Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_caas_config_status ON caas_config(status);
CREATE INDEX IF NOT EXISTS idx_caas_config_updated_at ON caas_config(updated_at);

-- ============================================================
-- Create Triggers
-- ============================================================

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_caas_config_updated_at
BEFORE UPDATE ON caas_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Remove Legacy Indexes
-- ============================================================

DROP INDEX IF EXISTS idx_container_projects_dokploy_project;
DROP INDEX IF EXISTS idx_container_services_dokploy_app;
DROP INDEX IF EXISTS idx_container_services_dokploy_env;

-- ============================================================
-- Comments for Documentation
-- ============================================================

COMMENT ON TABLE caas_config IS 'Container as a Service configuration for built-in Docker-based container management';
COMMENT ON COLUMN caas_config.api_url IS 'API URL for CaaS service (typically local Docker socket endpoint)';
COMMENT ON COLUMN caas_config.api_key_encrypted IS 'Encrypted API key for CaaS authentication';
COMMENT ON COLUMN caas_config.status IS 'Health status of CaaS service: healthy, degraded, or unknown';
COMMENT ON COLUMN caas_config.last_connection_test IS 'Timestamp of last successful connection test';
