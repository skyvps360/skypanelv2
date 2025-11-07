-- SkyPanelV2 PaaS Schema (MVP)
-- Date: 2025-11-07

-- This migration adds core tables for the PaaS control-plane MVP.
-- It follows the repository style: UUID PKs, timestamptz, updated_at triggers.

-- Helper function `update_updated_at_column` is expected to exist from 001 migration

-- ============================================================
-- Plans and Runtimes
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cpu_millicores INTEGER NOT NULL,
  memory_mb INTEGER NOT NULL,
  storage_gb INTEGER NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_hourly DECIMAL(10,4) NOT NULL,
  supported_runtimes JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_plans_active ON paas_plans(active);
CREATE INDEX IF NOT EXISTS idx_paas_plans_name ON paas_plans(name);

DROP TRIGGER IF EXISTS update_paas_plans_updated_at ON paas_plans;
CREATE TRIGGER update_paas_plans_updated_at
  BEFORE UPDATE ON paas_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS paas_runtimes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  runtime_type VARCHAR(50) NOT NULL, -- nodejs, python, php, docker
  version VARCHAR(50) NOT NULL,
  base_image VARCHAR(255) NOT NULL,
  default_build_command TEXT,
  default_start_command TEXT,
  allow_custom_docker BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_runtimes_active ON paas_runtimes(active);
CREATE INDEX IF NOT EXISTS idx_paas_runtimes_type_version ON paas_runtimes(runtime_type, version);

DROP TRIGGER IF EXISTS update_paas_runtimes_updated_at ON paas_runtimes;
CREATE TRIGGER update_paas_runtimes_updated_at
  BEFORE UPDATE ON paas_runtimes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- Worker Nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  host_address VARCHAR(255) NOT NULL,
  registration_token VARCHAR(255) UNIQUE,
  registration_token_expires_at TIMESTAMPTZ,
  jwt_secret VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline','disabled','degraded')),
  cpu_total INTEGER,
  memory_total_mb INTEGER,
  disk_total_mb INTEGER,
  cpu_used INTEGER DEFAULT 0,
  memory_used_mb INTEGER DEFAULT 0,
  disk_used_mb INTEGER DEFAULT 0,
  container_count INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_nodes_region ON paas_nodes(region);
CREATE INDEX IF NOT EXISTS idx_paas_nodes_status ON paas_nodes(status);

DROP TRIGGER IF EXISTS update_paas_nodes_updated_at ON paas_nodes;
CREATE TRIGGER update_paas_nodes_updated_at
  BEFORE UPDATE ON paas_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- Applications & Builds
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  runtime_id UUID REFERENCES paas_runtimes(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES paas_plans(id) ON DELETE SET NULL,
  node_id UUID REFERENCES paas_nodes(id) ON DELETE SET NULL,
  region VARCHAR(50) NOT NULL,

  -- Git configuration
  git_repo_url TEXT,
  git_branch VARCHAR(100) NOT NULL DEFAULT 'main',
  git_oauth_token TEXT,
  auto_deploy BOOLEAN NOT NULL DEFAULT FALSE,

  -- Deployment state
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','building','running','stopped','failed')),
  current_build_id UUID,
  instance_count INTEGER NOT NULL DEFAULT 1,
  port INTEGER NOT NULL DEFAULT 3000,

  -- Domain configuration
  system_domain VARCHAR(255) UNIQUE,
  custom_domains JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_apps_org ON paas_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_apps_status ON paas_applications(status);
CREATE INDEX IF NOT EXISTS idx_paas_apps_region ON paas_applications(region);

DROP TRIGGER IF EXISTS update_paas_applications_updated_at ON paas_applications;
CREATE TRIGGER update_paas_applications_updated_at
  BEFORE UPDATE ON paas_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS paas_builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  build_number INTEGER NOT NULL,
  git_commit_sha VARCHAR(40),
  git_commit_message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','building','success','failed')),
  build_log TEXT,
  image_tag VARCHAR(255),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paas_builds_app_buildnum ON paas_builds(application_id, build_number);
CREATE INDEX IF NOT EXISTS idx_paas_builds_status ON paas_builds(status);

-- Add FK from applications.current_build_id to paas_builds(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_applications_current_build_id_fkey'
  ) THEN
    ALTER TABLE paas_applications
      ADD CONSTRAINT paas_applications_current_build_id_fkey
      FOREIGN KEY (current_build_id) REFERENCES paas_builds(id) ON DELETE SET NULL;
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS paas_environment_vars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL, -- encrypted at app layer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, key)
);

CREATE INDEX IF NOT EXISTS idx_paas_envvars_app ON paas_environment_vars(application_id);


-- ============================================================
-- Databases & Links
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  db_type VARCHAR(20) NOT NULL CHECK (db_type IN ('mysql','postgresql','redis','mongodb')),
  version VARCHAR(20) NOT NULL,
  plan_id UUID REFERENCES paas_plans(id) ON DELETE SET NULL,
  node_id UUID REFERENCES paas_nodes(id) ON DELETE SET NULL,

  -- Connection details
  host VARCHAR(255),
  port INTEGER,
  username VARCHAR(100),
  password TEXT, -- encrypted at app layer
  database_name VARCHAR(100),

  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','stopped','failed')),
  container_id VARCHAR(255),
  volume_path VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_databases_org ON paas_databases(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_databases_type ON paas_databases(db_type);
CREATE INDEX IF NOT EXISTS idx_paas_databases_status ON paas_databases(status);

DROP TRIGGER IF EXISTS update_paas_databases_updated_at ON paas_databases;
CREATE TRIGGER update_paas_databases_updated_at
  BEFORE UPDATE ON paas_databases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS paas_app_databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  database_id UUID NOT NULL REFERENCES paas_databases(id) ON DELETE CASCADE,
  env_var_prefix VARCHAR(50) NOT NULL DEFAULT 'DATABASE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, database_id)
);

CREATE INDEX IF NOT EXISTS idx_paas_app_dbs_app ON paas_app_databases(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_app_dbs_db ON paas_app_databases(database_id);


-- ============================================================
-- Billing Records
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_billing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('application','database')),
  resource_id UUID NOT NULL,
  plan_id UUID REFERENCES paas_plans(id) ON DELETE SET NULL,
  instance_count INTEGER NOT NULL DEFAULT 1,
  hourly_rate DECIMAL(10,4) NOT NULL,
  hours_used DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paas_billing_org ON paas_billing_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_resource ON paas_billing_records(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_period ON paas_billing_records(billing_period_start, billing_period_end);

