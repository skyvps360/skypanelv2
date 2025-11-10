-- PaaS Indexes and Constraint Fixes
-- Ensures query performance and referential integrity per PaaS requirements

-- ============================================================
-- Resource Usage Enhancements
-- ============================================================

-- Add recorded_at column for chronological querying
ALTER TABLE paas_resource_usage
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE;

-- Backfill recorded_at for existing rows
UPDATE paas_resource_usage
SET recorded_at = COALESCE(billed_at, period_end, period_start, created_at, NOW())
WHERE recorded_at IS NULL;

-- Ensure future inserts have a default timestamp
ALTER TABLE paas_resource_usage
  ALTER COLUMN recorded_at SET DEFAULT NOW();

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_paas_applications_org_status
  ON paas_applications (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_paas_deployments_app_status
  ON paas_deployments (application_id, status);

CREATE INDEX IF NOT EXISTS idx_paas_resource_usage_recorded_at
  ON paas_resource_usage (recorded_at);

CREATE INDEX IF NOT EXISTS idx_paas_env_vars_application_id
  ON paas_environment_vars (application_id);

-- ============================================================
-- Foreign Key Cascade Rules
-- ============================================================

ALTER TABLE paas_applications
  DROP CONSTRAINT IF EXISTS paas_applications_organization_id_fkey,
  ADD CONSTRAINT paas_applications_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE paas_deployments
  DROP CONSTRAINT IF EXISTS paas_deployments_application_id_fkey,
  ADD CONSTRAINT paas_deployments_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES paas_applications(id) ON DELETE CASCADE;

ALTER TABLE paas_environment_vars
  DROP CONSTRAINT IF EXISTS paas_environment_vars_application_id_fkey,
  ADD CONSTRAINT paas_environment_vars_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES paas_applications(id) ON DELETE CASCADE;

ALTER TABLE paas_domains
  DROP CONSTRAINT IF EXISTS paas_domains_application_id_fkey,
  ADD CONSTRAINT paas_domains_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES paas_applications(id) ON DELETE CASCADE;
