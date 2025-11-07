-- SkyPanelV2 PaaS Enhancements
-- Date: 2025-02-14

-- This migration augments the initial PaaS schema with operational data
-- (metrics, logs, backups), richer status tracking, and administrative
-- controls (capacity limits, spending alerts, backup policies).

BEGIN;

-- ------------------------------------------------------------------
-- Node capacity tracking
-- ------------------------------------------------------------------

ALTER TABLE IF EXISTS paas_nodes
  ADD COLUMN IF NOT EXISTS max_containers INTEGER,
  ADD COLUMN IF NOT EXISTS max_cpu_percent INTEGER,
  ADD COLUMN IF NOT EXISTS max_memory_percent INTEGER,
  ADD COLUMN IF NOT EXISTS last_capacity_alert_at TIMESTAMPTZ;

-- ------------------------------------------------------------------
-- Application lifecycle extensions
-- ------------------------------------------------------------------

ALTER TABLE IF EXISTS paas_applications
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metrics_retention_days INTEGER NOT NULL DEFAULT 7;

ALTER TABLE IF EXISTS paas_applications
  DROP CONSTRAINT IF EXISTS paas_applications_status_check;

ALTER TABLE IF EXISTS paas_applications
  ADD CONSTRAINT paas_applications_status_check
    CHECK (status IN ('pending','building','running','stopped','failed','suspended'));

-- ------------------------------------------------------------------
-- Database lifecycle extensions
-- ------------------------------------------------------------------

ALTER TABLE IF EXISTS paas_databases
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS paas_databases
  DROP CONSTRAINT IF EXISTS paas_databases_status_check;

ALTER TABLE IF EXISTS paas_databases
  ADD CONSTRAINT paas_databases_status_check
    CHECK (status IN ('pending','running','stopped','failed','suspended'));

-- ------------------------------------------------------------------
-- Application runtime logs
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paas_application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  chunk TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_app_logs_app ON paas_application_logs(application_id, created_at DESC);

-- ------------------------------------------------------------------
-- Application metrics (time-series)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paas_application_metrics (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  cpu_millicores INTEGER NOT NULL,
  memory_mb INTEGER NOT NULL,
  request_rate INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_app_metrics_app_time ON paas_application_metrics(application_id, created_at DESC);

-- ------------------------------------------------------------------
-- Database backups
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paas_database_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  database_id UUID NOT NULL REFERENCES paas_databases(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_task VARCHAR(255),
  retention_days INTEGER NOT NULL DEFAULT 7,
  restored_from_backup_id UUID REFERENCES paas_database_backups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_paas_db_backups_db ON paas_database_backups(database_id, created_at DESC);

-- ------------------------------------------------------------------
-- Backup policies
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paas_backup_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  database_id UUID REFERENCES paas_databases(id) ON DELETE CASCADE,
  frequency_minutes INTEGER NOT NULL DEFAULT 1440,
  retention_days INTEGER NOT NULL DEFAULT 7,
  next_run_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, database_id)
);

-- ------------------------------------------------------------------
-- Spending alerts
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paas_spending_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  threshold_amount DECIMAL(10,2) NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paas_spending_alerts_org ON paas_spending_alerts(organization_id);

COMMIT;
