-- SkyPanelV2 PaaS GitHub integration
-- Adds tables for storing GitHub OAuth tokens per user/organization

BEGIN;

CREATE TABLE IF NOT EXISTS paas_github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50),
  scope TEXT,
  expires_at TIMESTAMPTZ,
  github_user_id BIGINT,
  github_login VARCHAR(255),
  github_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_paas_github_connections_org ON paas_github_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_github_connections_user ON paas_github_connections(user_id);

DROP TRIGGER IF EXISTS update_paas_github_connections_updated_at ON paas_github_connections;
CREATE TRIGGER update_paas_github_connections_updated_at
  BEFORE UPDATE ON paas_github_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
