-- PaaS Integration Schema Migration
-- Date: 2025-11-07
-- This migration adds all tables required for the Platform-as-a-Service functionality

-- ============================================================
-- PaaS Plans Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  cpu_limit INTEGER NOT NULL,        -- CPU millicores (e.g., 1000 = 1 core)
  memory_limit INTEGER NOT NULL,     -- RAM in MB
  storage_limit INTEGER NOT NULL,    -- Disk in MB
  monthly_price DECIMAL(10,2) NOT NULL,
  hourly_rate DECIMAL(10,4) NOT NULL,
  supported_runtimes JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Runtimes Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_runtimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,         -- e.g., "Node.js 18", "Python 3.11"
  runtime_type VARCHAR(20) NOT NULL, -- node, python, php, docker
  version VARCHAR(20) NOT NULL,
  base_image VARCHAR(200) NOT NULL,  -- Docker image reference
  default_build_cmd TEXT,
  default_start_cmd TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Worker Nodes Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_nodes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  host_address VARCHAR(255) NOT NULL,
  registration_token VARCHAR(255) UNIQUE,
  jwt_secret VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, online, offline, disabled
  cpu_total INTEGER,
  memory_total INTEGER,
  disk_total INTEGER,
  cpu_used INTEGER DEFAULT 0,
  memory_used INTEGER DEFAULT 0,
  disk_used INTEGER DEFAULT 0,
  container_count INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Applications Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-safe name
  runtime_id INTEGER REFERENCES paas_runtimes(id),
  plan_id INTEGER REFERENCES paas_plans(id),
  node_id INTEGER REFERENCES paas_nodes(id),
  region VARCHAR(50) NOT NULL,
  
  -- Git configuration
  git_repo_url TEXT,
  git_branch VARCHAR(100) DEFAULT 'main',
  git_oauth_token TEXT,                -- Encrypted
  auto_deploy BOOLEAN DEFAULT false,
  
  -- Deployment state
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, running, stopped, failed
  current_build_id INTEGER,
  instance_count INTEGER DEFAULT 1,
  
  -- Domain configuration
  system_domain VARCHAR(255) UNIQUE,
  custom_domains JSONB DEFAULT '[]',
  
  -- Container configuration
  port INTEGER DEFAULT 8080,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Builds Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_builds (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  build_number INTEGER NOT NULL,
  git_commit_sha VARCHAR(40),
  git_commit_message TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, success, failed
  build_log TEXT,
  image_tag VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Environment Variables Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_environment_vars (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,                 -- Encrypted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, key)
);

-- ============================================================
-- PaaS Databases Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_databases (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  db_type VARCHAR(20) NOT NULL,        -- mysql, postgresql, redis, mongodb
  version VARCHAR(20) NOT NULL,
  plan_id INTEGER REFERENCES paas_plans(id),
  node_id INTEGER REFERENCES paas_nodes(id),
  
  -- Connection details
  host VARCHAR(255),
  port INTEGER,
  username VARCHAR(100),
  password TEXT,                        -- Encrypted
  database_name VARCHAR(100),
  
  -- State
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, stopped, failed
  container_id VARCHAR(255),
  volume_path VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS App-Database Link Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_app_databases (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES paas_applications(id) ON DELETE CASCADE,
  database_id INTEGER REFERENCES paas_databases(id) ON DELETE CASCADE,
  env_var_prefix VARCHAR(50) DEFAULT 'DATABASE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, database_id)
);

-- ============================================================
-- PaaS Billing Records Table
-- ============================================================
CREATE TABLE IF NOT EXISTS paas_billing_records (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL,  -- application, database
  resource_id INTEGER NOT NULL,
  plan_id INTEGER REFERENCES paas_plans(id),
  instance_count INTEGER DEFAULT 1,
  hourly_rate DECIMAL(10,4) NOT NULL,
  hours_used DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- PaaS Applications indexes
CREATE INDEX IF NOT EXISTS idx_paas_applications_user_id ON paas_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_paas_applications_organization_id ON paas_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_applications_node_id ON paas_applications(node_id);
CREATE INDEX IF NOT EXISTS idx_paas_applications_status ON paas_applications(status);
CREATE INDEX IF NOT EXISTS idx_paas_applications_slug ON paas_applications(slug);

-- PaaS Builds indexes
CREATE INDEX IF NOT EXISTS idx_paas_builds_application_id ON paas_builds(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_builds_status ON paas_builds(status);

-- PaaS Environment Variables indexes
CREATE INDEX IF NOT EXISTS idx_paas_environment_vars_application_id ON paas_environment_vars(application_id);

-- PaaS Databases indexes
CREATE INDEX IF NOT EXISTS idx_paas_databases_user_id ON paas_databases(user_id);
CREATE INDEX IF NOT EXISTS idx_paas_databases_organization_id ON paas_databases(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_databases_node_id ON paas_databases(node_id);

-- PaaS App-Database links indexes
CREATE INDEX IF NOT EXISTS idx_paas_app_databases_application_id ON paas_app_databases(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_app_databases_database_id ON paas_app_databases(database_id);

-- PaaS Billing Records indexes
CREATE INDEX IF NOT EXISTS idx_paas_billing_records_user_id ON paas_billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_records_organization_id ON paas_billing_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_records_resource_type ON paas_billing_records(resource_type);

-- PaaS Nodes indexes
CREATE INDEX IF NOT EXISTS idx_paas_nodes_status ON paas_nodes(status);
CREATE INDEX IF NOT EXISTS idx_paas_nodes_region ON paas_nodes(region);

-- ============================================================
-- Triggers for Updated_at columns
-- ============================================================

CREATE TRIGGER update_paas_plans_updated_at
    BEFORE UPDATE ON paas_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_nodes_updated_at
    BEFORE UPDATE ON paas_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_applications_updated_at
    BEFORE UPDATE ON paas_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_databases_updated_at
    BEFORE UPDATE ON paas_databases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
