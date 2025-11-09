-- PaaS Integration Migration
-- Date: 2025-11-09
-- This migration adds all tables and structures needed for the PaaS service

-- ============================================================
-- PaaS Core Tables
-- ============================================================

-- PaaS Plans (must be created first, referenced by paas_applications)
CREATE TABLE IF NOT EXISTS paas_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., 'Hobby', 'Pro', 'Business'
    slug VARCHAR(255) NOT NULL UNIQUE,
    cpu_cores DECIMAL(10,2) NOT NULL, -- e.g., 0.5, 1, 2
    ram_mb INTEGER NOT NULL, -- e.g., 512, 1024, 2048
    max_replicas INTEGER DEFAULT 1,
    disk_gb INTEGER DEFAULT 10,
    price_per_hour DECIMAL(10,4) NOT NULL,
    price_per_month DECIMAL(10,2), -- Display price (if calculated)
    is_active BOOLEAN DEFAULT TRUE,
    features JSONB DEFAULT '{}', -- e.g., {"custom_domain": true, "auto_scaling": false}
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hourly_rate DECIMAL(10,4) NOT NULL DEFAULT 0 -- Add hourly_rate column for billing
);

-- PaaS Applications
CREATE TABLE IF NOT EXISTS paas_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    git_url TEXT,
    git_branch VARCHAR(255) DEFAULT 'main',
    buildpack VARCHAR(255), -- e.g., 'heroku/nodejs', 'heroku/python', or 'auto'
    plan_id UUID REFERENCES paas_plans(id),
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('inactive', 'building', 'deploying', 'running', 'stopped', 'failed', 'suspended')),
    subdomain VARCHAR(255) UNIQUE, -- e.g., 'myapp' for myapp.yourdomain.com
    stack VARCHAR(50) DEFAULT 'heroku-22', -- Buildpack stack version
    replicas INTEGER DEFAULT 1,
    last_billed_at TIMESTAMP WITH TIME ZONE, -- For billing system
    metadata JSONB DEFAULT '{}', -- Additional app-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- PaaS Deployments
CREATE TABLE IF NOT EXISTS paas_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    version INTEGER NOT NULL, -- Incremental version number
    git_commit VARCHAR(255),
    slug_url TEXT, -- S3 or local path to compiled slug
    slug_size_bytes BIGINT,
    buildpack_used VARCHAR(255),
    build_log TEXT, -- Full build output
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'build_failed', 'deploying', 'deployed', 'failed', 'rolled_back')),
    error_message TEXT,
    build_started_at TIMESTAMP WITH TIME ZONE,
    build_completed_at TIMESTAMP WITH TIME ZONE,
    deployed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Worker Nodes
CREATE TABLE IF NOT EXISTS paas_worker_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL UNIQUE,
    ssh_port INTEGER DEFAULT 22,
    ssh_user VARCHAR(100) DEFAULT 'root',
    ssh_key_encrypted TEXT, -- Encrypted SSH private key for node access
    swarm_node_id VARCHAR(255) UNIQUE, -- Docker Swarm node ID
    swarm_role VARCHAR(50) DEFAULT 'worker' CHECK (swarm_role IN ('manager', 'worker')),
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'draining', 'down', 'unreachable')),
    capacity_cpu DECIMAL(10,2), -- Total CPU cores
    capacity_ram_mb INTEGER, -- Total RAM in MB
    used_cpu DECIMAL(10,2) DEFAULT 0,
    used_ram_mb INTEGER DEFAULT 0,
    labels JSONB DEFAULT '{}', -- Node labels for scheduling
    metadata JSONB DEFAULT '{}',
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Environment Variables
CREATE TABLE IF NOT EXISTS paas_environment_vars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL, -- Encrypted value
    is_system BOOLEAN DEFAULT FALSE, -- System vars like PORT, DATABASE_URL (auto-generated)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(application_id, key)
);

-- PaaS Custom Domains
CREATE TABLE IF NOT EXISTS paas_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    ssl_enabled BOOLEAN DEFAULT FALSE,
    ssl_cert_path TEXT, -- Path to Let's Encrypt certificate
    ssl_cert_expires_at TIMESTAMP WITH TIME ZONE,
    dns_verification_token VARCHAR(255), -- For domain ownership verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Build Cache
CREATE TABLE IF NOT EXISTS paas_build_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL, -- e.g., 'node_modules-checksum'
    cache_url TEXT NOT NULL, -- S3 or local path to cached layer
    size_bytes BIGINT,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(application_id, cache_key)
);

-- PaaS Resource Usage (for billing)
CREATE TABLE IF NOT EXISTS paas_resource_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cpu_hours DECIMAL(10,4), -- CPU cores × hours
    ram_mb_hours INTEGER, -- RAM MB × hours
    total_cost DECIMAL(10,4), -- Calculated cost for this period
    billed_at TIMESTAMP WITH TIME ZONE, -- When billing was completed (NULL = failed billing)
    metadata JSONB DEFAULT '{}', -- Additional billing metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Logs Metadata
CREATE TABLE IF NOT EXISTS paas_logs_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    deployment_id UUID REFERENCES paas_deployments(id),
    loki_stream_id VARCHAR(255), -- Loki label selector
    container_id VARCHAR(255),
    log_type VARCHAR(50) DEFAULT 'app' CHECK (log_type IN ('build', 'app', 'router', 'system')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Addons (Future: managed databases, Redis, etc.)
CREATE TABLE IF NOT EXISTS paas_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    addon_type VARCHAR(100) NOT NULL, -- 'postgres', 'mysql', 'redis', 'mongodb'
    addon_plan VARCHAR(100), -- 'hobby-dev', 'standard-0', 'premium-0'
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'available', 'upgrading', 'maintenance', 'failed')),
    connection_url_encrypted TEXT, -- Encrypted connection string
    config JSONB DEFAULT '{}',
    price_per_hour DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Settings (Admin-configurable, zero .env)
CREATE TABLE IF NOT EXISTS paas_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value_encrypted TEXT, -- Encrypted setting value
    value_type VARCHAR(50) DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE, -- If true, encrypt the value
    category VARCHAR(100) DEFAULT 'general', -- 'storage', 'swarm', 'buildpack', 'logging'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Applications
CREATE INDEX idx_paas_apps_org_id ON paas_applications(organization_id);
CREATE INDEX idx_paas_apps_status ON paas_applications(status);
CREATE INDEX idx_paas_apps_subdomain ON paas_applications(subdomain);

-- Deployments
CREATE INDEX idx_paas_deployments_app_id ON paas_deployments(application_id);
CREATE INDEX idx_paas_deployments_status ON paas_deployments(status);
CREATE INDEX idx_paas_deployments_version ON paas_deployments(application_id, version DESC);

-- Worker Nodes
CREATE INDEX idx_paas_workers_status ON paas_worker_nodes(status);
CREATE INDEX idx_paas_workers_swarm_id ON paas_worker_nodes(swarm_node_id);

-- Environment Variables
CREATE INDEX idx_paas_env_app_id ON paas_environment_vars(application_id);

-- Domains
CREATE INDEX idx_paas_domains_app_id ON paas_domains(application_id);
CREATE INDEX idx_paas_domains_domain ON paas_domains(domain);

-- Resource Usage
CREATE INDEX idx_paas_usage_app_id ON paas_resource_usage(application_id);
CREATE INDEX idx_paas_usage_org_id ON paas_resource_usage(organization_id);
CREATE INDEX idx_paas_usage_billed_at ON paas_resource_usage(billed_at DESC);
CREATE INDEX idx_paas_usage_period ON paas_resource_usage(period_start, period_end);

-- Logs Metadata
CREATE INDEX idx_paas_logs_app_id ON paas_logs_metadata(application_id);
CREATE INDEX idx_paas_logs_deployment_id ON paas_logs_metadata(deployment_id);

-- Plans
CREATE INDEX idx_paas_plans_active ON paas_plans(is_active);

-- Settings
CREATE INDEX idx_paas_settings_category ON paas_settings(category);

-- ============================================================
-- Triggers for updated_at
-- ============================================================

CREATE TRIGGER update_paas_applications_updated_at BEFORE UPDATE ON paas_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_deployments_updated_at BEFORE UPDATE ON paas_deployments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_worker_nodes_updated_at BEFORE UPDATE ON paas_worker_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_environment_vars_updated_at BEFORE UPDATE ON paas_environment_vars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_domains_updated_at BEFORE UPDATE ON paas_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_plans_updated_at BEFORE UPDATE ON paas_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_addons_updated_at BEFORE UPDATE ON paas_addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paas_settings_updated_at BEFORE UPDATE ON paas_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PostgreSQL LISTEN/NOTIFY Triggers for Real-time Updates
-- ============================================================

-- Notify on application status changes
CREATE OR REPLACE FUNCTION notify_paas_app_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'paas_app_status',
            json_build_object(
                'app_id', NEW.id,
                'org_id', NEW.organization_id,
                'status', NEW.status,
                'timestamp', NOW()
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paas_app_status_notify AFTER INSERT OR UPDATE ON paas_applications
    FOR EACH ROW EXECUTE FUNCTION notify_paas_app_status_change();

-- Notify on deployment status changes
CREATE OR REPLACE FUNCTION notify_paas_deployment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'paas_deployment_status',
            json_build_object(
                'deployment_id', NEW.id,
                'app_id', NEW.application_id,
                'status', NEW.status,
                'version', NEW.version,
                'timestamp', NOW()
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paas_deployment_status_notify AFTER INSERT OR UPDATE ON paas_deployments
    FOR EACH ROW EXECUTE FUNCTION notify_paas_deployment_status_change();

-- ============================================================
-- Default PaaS Plans
-- ============================================================

INSERT INTO paas_plans (name, slug, cpu_cores, ram_mb, max_replicas, disk_gb, price_per_hour, price_per_month, hourly_rate, features) VALUES
    ('Hobby', 'hobby', 0.5, 512, 1, 10, 0.0069, 5.00, 0.0069, '{"custom_domain": false, "auto_scaling": false, "ssl": true}'),
    ('Standard', 'standard', 1, 1024, 3, 20, 0.0347, 25.00, 0.0347, '{"custom_domain": true, "auto_scaling": true, "ssl": true}'),
    ('Pro', 'pro', 2, 2048, 10, 50, 0.0694, 50.00, 0.0694, '{"custom_domain": true, "auto_scaling": true, "ssl": true, "priority_support": true}'),
    ('Business', 'business', 4, 4096, 20, 100, 0.1389, 100.00, 0.1389, '{"custom_domain": true, "auto_scaling": true, "ssl": true, "priority_support": true, "dedicated_resources": true}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Default PaaS Settings (empty initially, populated by admin)
-- ============================================================

INSERT INTO paas_settings (key, value_type, description, is_sensitive, category) VALUES
    ('storage_type', 'string', 'Storage backend: s3 or local', false, 'storage'),
    ('s3_bucket', 'string', 'S3 bucket name for build artifacts', false, 'storage'),
    ('s3_region', 'string', 'S3 region', false, 'storage'),
    ('s3_access_key', 'string', 'S3 access key ID', true, 'storage'),
    ('s3_secret_key', 'string', 'S3 secret access key', true, 'storage'),
    ('s3_endpoint', 'string', 'Custom S3 endpoint (for MinIO, B2, etc.)', false, 'storage'),
    ('local_storage_path', 'string', 'Local filesystem path for builds', false, 'storage'),
    ('swarm_manager_ip', 'string', 'Docker Swarm manager IP address', false, 'swarm'),
    ('swarm_join_token_worker', 'string', 'Swarm worker join token', true, 'swarm'),
    ('swarm_join_token_manager', 'string', 'Swarm manager join token', true, 'swarm'),
    ('swarm_initialized', 'boolean', 'Whether Swarm has been initialized', false, 'swarm'),
    ('buildpack_cache_enabled', 'boolean', 'Enable buildpack layer caching', false, 'buildpack'),
    ('buildpack_default_stack', 'string', 'Default buildpack stack version', false, 'buildpack'),
    ('loki_endpoint', 'string', 'Grafana Loki endpoint URL', false, 'logging'),
    ('loki_retention_days', 'number', 'Log retention period in days', false, 'logging'),
    ('registry_url', 'string', 'Docker registry URL for images', false, 'registry'),
    ('registry_username', 'string', 'Registry username', true, 'registry'),
    ('registry_password', 'string', 'Registry password', true, 'registry'),
    ('default_domain', 'string', 'Default domain for app subdomains (e.g., apps.yourdomain.com)', false, 'general'),
    ('max_apps_per_org', 'number', 'Maximum apps per organization (0 = unlimited)', false, 'limits'),
    ('max_deployments_per_hour', 'number', 'Rate limit for deployments per app', false, 'limits')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Comments for Documentation
-- ============================================================

COMMENT ON TABLE paas_applications IS 'PaaS applications managed by users';
COMMENT ON TABLE paas_deployments IS 'Deployment history and build artifacts for PaaS apps';
COMMENT ON TABLE paas_worker_nodes IS 'Docker Swarm worker nodes for running PaaS apps';
COMMENT ON TABLE paas_environment_vars IS 'Environment variables for PaaS applications';
COMMENT ON TABLE paas_domains IS 'Custom domains and SSL certificates for PaaS apps';
COMMENT ON TABLE paas_resource_usage IS 'Resource usage tracking for billing calculations';
COMMENT ON TABLE paas_plans IS 'Available resource plans for PaaS applications';
COMMENT ON TABLE paas_settings IS 'System-wide PaaS configuration (replaces .env)';
