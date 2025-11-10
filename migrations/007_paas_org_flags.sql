-- PaaS Organization Controls
-- Adds suspension tracking columns to organizations

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS paas_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paas_suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paas_suspend_reason TEXT;
