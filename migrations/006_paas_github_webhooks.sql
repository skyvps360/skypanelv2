-- SkyPanelV2 PaaS GitHub webhooks
-- Adds metadata fields for repository ownership and webhook tracking

BEGIN;

ALTER TABLE IF EXISTS paas_applications
  ADD COLUMN IF NOT EXISTS git_repo_full_name TEXT,
  ADD COLUMN IF NOT EXISTS git_webhook_id BIGINT,
  ADD COLUMN IF NOT EXISTS git_webhook_secret TEXT;

COMMIT;
