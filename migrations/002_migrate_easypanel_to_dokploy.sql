-- Migration: Replace Easypanel with Dokploy
-- This migration renames Easypanel-related columns and tables to use Dokploy instead
-- Date: 2025-11-05

-- ============================================================================
-- 1. Create dokploy_config table (new table structure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dokploy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url VARCHAR(500) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  last_connection_test TIMESTAMP,
  connection_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER update_dokploy_config_updated_at
BEFORE UPDATE ON dokploy_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Migrate data from easypanel_config to dokploy_config (if exists)
-- ============================================================================
INSERT INTO dokploy_config (
  id, api_url, api_key_encrypted, active, 
  last_connection_test, connection_status, created_at, updated_at
)
SELECT 
  id, api_url, api_key_encrypted, active,
  last_connection_test, connection_status, created_at, updated_at
FROM easypanel_config
WHERE EXISTS (SELECT 1 FROM easypanel_config LIMIT 1);

-- ============================================================================
-- 3. Update container_subscriptions table
-- ============================================================================
-- Add new dokploy columns (making them nullable initially for migration)
ALTER TABLE container_subscriptions 
  ADD COLUMN IF NOT EXISTS dokploy_project_id VARCHAR(255);

-- Migrate data if easypanel columns exist
DO $$
BEGIN
  -- Check if easypanel_user_id column exists before migrating
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'container_subscriptions' 
    AND column_name = 'easypanel_user_id'
  ) THEN
    -- Note: We're not migrating user data since Dokploy doesn't have users
    -- But we keep the project associations
  END IF;
END $$;

-- Drop old easypanel columns (if they exist)
ALTER TABLE container_subscriptions 
  DROP COLUMN IF EXISTS easypanel_user_id,
  DROP COLUMN IF EXISTS easypanel_user_email,
  DROP COLUMN IF EXISTS easypanel_password_encrypted;

-- Drop old index
DROP INDEX IF EXISTS idx_container_subscriptions_easypanel_user;

-- ============================================================================
-- 4. Update container_projects table
-- ============================================================================
-- Add new dokploy_project_id column
ALTER TABLE container_projects 
  ADD COLUMN IF NOT EXISTS dokploy_project_id VARCHAR(255);

-- Migrate project names from easypanel_project_name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'container_projects' 
    AND column_name = 'easypanel_project_name'
  ) THEN
    -- We can't directly convert project names to IDs
    -- Admins will need to re-link projects after migration
    NULL;
  END IF;
END $$;

-- Drop old easypanel_project_name column
ALTER TABLE container_projects 
  DROP COLUMN IF EXISTS easypanel_project_name;

-- ============================================================================
-- 5. Update container_services table
-- ============================================================================
-- Add new dokploy columns
ALTER TABLE container_services
  ADD COLUMN IF NOT EXISTS dokploy_application_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dokploy_environment_id VARCHAR(255);

-- Drop old easypanel_service_name column
ALTER TABLE container_services
  DROP COLUMN IF EXISTS easypanel_service_name;

-- ============================================================================
-- 6. Create indexes for new dokploy columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_container_subscriptions_dokploy_project
ON container_subscriptions(dokploy_project_id);

CREATE INDEX IF NOT EXISTS idx_container_projects_dokploy_project
ON container_projects(dokploy_project_id);

CREATE INDEX IF NOT EXISTS idx_container_services_dokploy_app
ON container_services(dokploy_application_id);

CREATE INDEX IF NOT EXISTS idx_container_services_dokploy_env
ON container_services(dokploy_environment_id);

-- ============================================================================
-- 7. Add comments for documentation
-- ============================================================================
COMMENT ON TABLE dokploy_config IS 'Dokploy API configuration (replaces easypanel_config)';
COMMENT ON COLUMN container_projects.dokploy_project_id IS 'Dokploy project ID (replaces easypanel_project_name)';
COMMENT ON COLUMN container_services.dokploy_application_id IS 'Dokploy application ID (replaces easypanel_service_name)';
COMMENT ON COLUMN container_services.dokploy_environment_id IS 'Dokploy environment ID within the project';

-- ============================================================================
-- 8. Keep easypanel_config table for backward compatibility (optional)
--    but mark it as deprecated
-- ============================================================================
COMMENT ON TABLE easypanel_config IS 'DEPRECATED: Use dokploy_config instead. Kept for backward compatibility during migration period.';
