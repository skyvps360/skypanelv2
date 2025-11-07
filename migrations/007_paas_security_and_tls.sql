-- PaaS security & redeploy metadata
-- Date: 2025-11-07

ALTER TABLE paas_runtimes
  ADD COLUMN IF NOT EXISTS enforce_non_root BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_run_user VARCHAR(100);

ALTER TABLE paas_applications
  ADD COLUMN IF NOT EXISTS needs_redeploy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_env_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_paas_apps_needs_redeploy
  ON paas_applications (needs_redeploy)
  WHERE needs_redeploy = TRUE;
