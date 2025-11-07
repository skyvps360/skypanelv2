-- PaaS Integration Migration
-- Date: 2025-11-07
-- This migration adds all PaaS-related tables for Platform-as-a-Service functionality

-- ============================================================
-- PaaS Plans
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cpu_limit INTEGER NOT NULL,           -- CPU millicores (e.g., 1000 = 1 core)
    memory_limit INTEGER NOT NULL,        -- RAM in MB
    storage_limit INTEGER NOT NULL,       -- Disk in MB
    monthly_price DECIMAL(10,2) NOT NULL,
    hourly_rate DECIMAL(10,4) NOT NULL,
    supported_runtimes JSONB DEFAULT '[]', -- Array of runtime IDs
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_plans_active ON paas_plans(is_active);

-- ============================================================
-- PaaS Runtimes
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_runtimes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,            -- e.g., "Node.js 18", "Python 3.11"
    runtime_type VARCHAR(20) NOT NULL,    -- node, python, php, docker
    version VARCHAR(20) NOT NULL,
    base_image VARCHAR(200) NOT NULL,     -- Docker image reference
    default_build_cmd TEXT,
    default_start_cmd TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_runtimes_active ON paas_runtimes(is_active);
CREATE INDEX idx_paas_runtimes_type ON paas_runtimes(runtime_type);

-- ============================================================
-- PaaS Worker Nodes
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
    memory_total INTEGER,                 -- MB
    disk_total INTEGER,                   -- MB
    cpu_used INTEGER DEFAULT 0,
    memory_used INTEGER DEFAULT 0,
    disk_used INTEGER DEFAULT 0,
    container_count INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_nodes_status ON paas_nodes(status);
CREATE INDEX idx_paas_nodes_region ON paas_nodes(region);
CREATE INDEX idx_paas_nodes_last_heartbeat ON paas_nodes(last_heartbeat);

-- ============================================================
-- PaaS Applications
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_applications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,    -- URL-safe name
    runtime_id INTEGER REFERENCES paas_runtimes(id),
    plan_id INTEGER REFERENCES paas_plans(id),
    node_id INTEGER REFERENCES paas_nodes(id),
    region VARCHAR(50) NOT NULL,
    
    -- Git configuration
    git_repo_url TEXT,
    git_branch VARCHAR(100) DEFAULT 'main',
    git_oauth_token TEXT,                 -- Encrypted
    auto_deploy BOOLEAN DEFAULT false,
    
    -- Deployment state
    status VARCHAR(20) DEFAULT 'pending', -- pending, building, running, stopped, failed
    current_build_id INTEGER,
    instance_count INTEGER DEFAULT 1,
    
    -- Domain configuration
    system_domain VARCHAR(255) UNIQUE,
    custom_domains JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_applications_user ON paas_applications(user_id);
CREATE INDEX idx_paas_applications_org ON paas_applications(organization_id);
CREATE INDEX idx_paas_applications_status ON paas_applications(status);
CREATE INDEX idx_paas_applications_node ON paas_applications(node_id);
CREATE INDEX idx_paas_applications_slug ON paas_applications(slug);

-- ============================================================
-- PaaS Builds
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_builds (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
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

CREATE INDEX idx_paas_builds_application ON paas_builds(application_id);
CREATE INDEX idx_paas_builds_status ON paas_builds(status);
CREATE INDEX idx_paas_builds_created ON paas_builds(created_at DESC);
CREATE UNIQUE INDEX idx_paas_builds_app_number ON paas_builds(application_id, build_number);

-- ============================================================
-- PaaS Environment Variables
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_environment_vars (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,                  -- Encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(application_id, key)
);

CREATE INDEX idx_paas_env_vars_application ON paas_environment_vars(application_id);

-- ============================================================
-- PaaS Databases
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_databases (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_paas_databases_user ON paas_databases(user_id);
CREATE INDEX idx_paas_databases_org ON paas_databases(organization_id);
CREATE INDEX idx_paas_databases_status ON paas_databases(status);
CREATE INDEX idx_paas_databases_node ON paas_databases(node_id);

-- ============================================================
-- PaaS Application-Database Links
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_app_databases (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    database_id INTEGER NOT NULL REFERENCES paas_databases(id) ON DELETE CASCADE,
    env_var_prefix VARCHAR(50) DEFAULT 'DATABASE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(application_id, database_id)
);

CREATE INDEX idx_paas_app_databases_app ON paas_app_databases(application_id);
CREATE INDEX idx_paas_app_databases_db ON paas_app_databases(database_id);

-- ============================================================
-- PaaS Billing Records
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_billing_records (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    resource_type VARCHAR(20) NOT NULL,   -- application, database
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

CREATE INDEX idx_paas_billing_user ON paas_billing_records(user_id);
CREATE INDEX idx_paas_billing_org ON paas_billing_records(organization_id);
CREATE INDEX idx_paas_billing_period ON paas_billing_records(billing_period_start, billing_period_end);
CREATE INDEX idx_paas_billing_resource ON paas_billing_records(resource_type, resource_id);

-- ============================================================
-- PaaS Database Backups
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_database_backups (
    id SERIAL PRIMARY KEY,
    database_id INTEGER NOT NULL REFERENCES paas_databases(id) ON DELETE CASCADE,
    backup_file_path VARCHAR(500) NOT NULL,
    backup_size_mb DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_paas_db_backups_database ON paas_database_backups(database_id);
CREATE INDEX idx_paas_db_backups_created ON paas_database_backups(created_at DESC);

-- ============================================================
-- PaaS Tasks (for agent task queue)
-- ============================================================

CREATE TABLE IF NOT EXISTS paas_tasks (
    id SERIAL PRIMARY KEY,
    node_id INTEGER NOT NULL REFERENCES paas_nodes(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,      -- deploy, restart, stop, scale, backup, restore
    resource_type VARCHAR(20) NOT NULL,   -- application, database
    resource_id INTEGER NOT NULL,
    payload JSONB NOT NULL,               -- Task-specific data
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, acknowledged, in_progress, completed, failed
    result JSONB,                         -- Result data or error info
    priority INTEGER DEFAULT 5,           -- 1 (highest) to 10 (lowest)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_paas_tasks_node ON paas_tasks(node_id);
CREATE INDEX idx_paas_tasks_status ON paas_tasks(status);
CREATE INDEX idx_paas_tasks_priority ON paas_tasks(priority, created_at);
CREATE INDEX idx_paas_tasks_resource ON paas_tasks(resource_type, resource_id);

-- ============================================================
-- Triggers
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

-- ============================================================
-- Initial Data
-- ============================================================

-- Insert default runtimes
INSERT INTO paas_runtimes (name, runtime_type, version, base_image, default_build_cmd, default_start_cmd) VALUES
    ('Node.js 18 LTS', 'node', '18', 'node:18-alpine', 'npm install && npm run build', 'npm start'),
    ('Node.js 20 LTS', 'node', '20', 'node:20-alpine', 'npm install && npm run build', 'npm start'),
    ('Python 3.11', 'python', '3.11', 'python:3.11-slim', 'pip install -r requirements.txt', 'gunicorn app:app'),
    ('Python 3.12', 'python', '3.12', 'python:3.12-slim', 'pip install -r requirements.txt', 'gunicorn app:app'),
    ('PHP 8.2', 'php', '8.2', 'php:8.2-fpm-alpine', 'composer install', 'php-fpm'),
    ('PHP 8.3', 'php', '8.3', 'php:8.3-fpm-alpine', 'composer install', 'php-fpm'),
    ('Custom Docker', 'docker', 'custom', '', '', '')
ON CONFLICT DO NOTHING;

-- Insert default plans
INSERT INTO paas_plans (name, cpu_limit, memory_limit, storage_limit, monthly_price, hourly_rate, supported_runtimes) VALUES
    ('Starter', 500, 512, 1024, 5.00, 0.0069, '[1,2,3,4,5,6,7]'),
    ('Basic', 1000, 1024, 2048, 10.00, 0.0139, '[1,2,3,4,5,6,7]'),
    ('Standard', 2000, 2048, 5120, 20.00, 0.0278, '[1,2,3,4,5,6,7]'),
    ('Professional', 4000, 4096, 10240, 40.00, 0.0556, '[1,2,3,4,5,6,7]'),
    ('Enterprise', 8000, 8192, 20480, 80.00, 0.1111, '[1,2,3,4,5,6,7]')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE paas_plans IS 'PaaS hosting plans with resource limits and pricing';
COMMENT ON TABLE paas_runtimes IS 'Available runtime environments for applications';
COMMENT ON TABLE paas_nodes IS 'Worker nodes running PaaS Agent for container execution';
COMMENT ON TABLE paas_applications IS 'Customer applications deployed on PaaS';
COMMENT ON TABLE paas_builds IS 'Build history for applications';
COMMENT ON TABLE paas_environment_vars IS 'Environment variables for applications (encrypted)';
COMMENT ON TABLE paas_databases IS 'Managed database instances';
COMMENT ON TABLE paas_app_databases IS 'Links between applications and databases';
COMMENT ON TABLE paas_billing_records IS 'Hourly billing records for PaaS resources';
COMMENT ON TABLE paas_database_backups IS 'Database backup records';
COMMENT ON TABLE paas_tasks IS 'Task queue for agent execution';
