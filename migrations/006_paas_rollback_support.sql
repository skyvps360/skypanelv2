-- Migration 006: Add rollback metadata to paas_deployments
-- Enables tracking which deployment a rollback originated from

ALTER TABLE paas_deployments
  ADD COLUMN IF NOT EXISTS rolled_back_from UUID REFERENCES paas_deployments(id);

CREATE INDEX IF NOT EXISTS idx_paas_deployments_rolled_from
  ON paas_deployments (rolled_back_from);
