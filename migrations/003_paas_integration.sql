-- Migration 003: PaaS (Platform as a Service) Integration
-- Date: 2025-11-08
-- This migration adds comprehensive PaaS support for Node.js applications
-- Features: Docker-based deployment, GitHub integration, managed services, hourly billing

-- ============================================================
-- PaaS Core Tables
-- ============================================================

-- PaaS Plans table - defines available service tiers
CREATE TABLE IF NOT EXISTS paas_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cpu_cores DECIMAL(5,2) NOT NULL CHECK (cpu_cores > 0),
    memory_mb INTEGER NOT NULL CHECK (memory_mb > 0),
    storage_gb INTEGER NOT NULL CHECK (storage_gb > 0),
    bandwidth_gb INTEGER DEFAULT 0,
    price_hourly DECIMAL(10,6) NOT NULL CHECK (price_hourly >= 0),
    price_monthly DECIMAL(10,2) NOT NULL CHECK (price_monthly >= 0),
    max_deployments INTEGER DEFAULT 10,
    max_environment_vars INTEGER DEFAULT 100,
    supports_custom_domains BOOLEAN DEFAULT TRUE,
    supports_auto_deployments BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Worker Nodes table - tracks available build/deployment nodes
CREATE TABLE IF NOT EXISTS paas_worker_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER DEFAULT 3001,
    auth_token_encrypted TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'maintenance', 'error')),
    capabilities JSONB DEFAULT '{"nodejs": true, "docker": true}'::jsonb,
    max_concurrent_builds INTEGER DEFAULT 3,
    current_builds INTEGER DEFAULT 0,
    resource_limits JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Applications table - main application registry
CREATE TABLE IF NOT EXISTS paas_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES paas_plans(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    github_repo_url VARCHAR(1000),
    github_branch VARCHAR(255) DEFAULT 'main',
    github_commit_sha VARCHAR(40),
    status VARCHAR(50) DEFAULT 'created' CHECK (status IN ('created', 'building', 'deployed', 'stopped', 'error', 'building_failed', 'deployment_failed')),
    dockerfile_path VARCHAR(500) DEFAULT 'Dockerfile',
    build_command VARCHAR(500) DEFAULT 'npm run build',
    start_command VARCHAR(500) DEFAULT 'npm start',
    environment_variables JSONB DEFAULT '{}',
    auto_deployments BOOLEAN DEFAULT TRUE,
    last_deployed_at TIMESTAMP WITH TIME ZONE,
    last_built_at TIMESTAMP WITH TIME ZONE,
    assigned_worker_id UUID REFERENCES paas_worker_nodes(id) ON DELETE SET NULL,
    resource_usage JSONB DEFAULT '{"cpu": 0, "memory": 0, "storage": 0}'::jsonb,
    health_check_url VARCHAR(1000),
    health_check_interval INTEGER DEFAULT 60,
    custom_domains JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT paas_apps_unique_slug UNIQUE (organization_id, slug)
);

-- PaaS Deployments table - tracks deployment history
CREATE TABLE IF NOT EXISTS paas_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES paas_apps(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL,
    github_commit_sha VARCHAR(40),
    github_commit_message TEXT,
    github_commit_author VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'building_success', 'building_failed', 'deploying', 'deployed', 'deployment_failed', 'rollback', 'rollback_success', 'rollback_failed')),
    build_started_at TIMESTAMP WITH TIME ZONE,
    build_completed_at TIMESTAMP WITH TIME ZONE,
    deployment_started_at TIMESTAMP WITH TIME ZONE,
    deployment_completed_at TIMESTAMP WITH TIME ZONE,
    worker_node_id UUID REFERENCES paas_worker_nodes(id) ON DELETE SET NULL,
    build_logs TEXT,
    deployment_logs TEXT,
    error_message TEXT,
    docker_image_name VARCHAR(500),
    container_id VARCHAR(100),
    rollback_from_deployment_id UUID REFERENCES paas_deployments(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Build Logs table - real-time build log storage
CREATE TABLE IF NOT EXISTS paas_build_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES paas_deployments(id) ON DELETE CASCADE,
    log_level VARCHAR(20) DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- PaaS Environment Variables table - encrypted storage for sensitive data
CREATE TABLE IF NOT EXISTS paas_environment_vars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES paas_apps(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT paas_env_vars_unique_key UNIQUE (app_id, key)
);

-- ============================================================
-- PaaS Add-ons (Managed Services)
-- ============================================================

-- PaaS Add-on Plans table - managed service offerings
CREATE TABLE IF NOT EXISTS paas_addon_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('postgresql', 'redis', 'mysql', 'mongodb')),
    description TEXT,
    specifications JSONB NOT NULL DEFAULT '{}',
    price_hourly DECIMAL(10,6) NOT NULL CHECK (price_hourly >= 0),
    price_monthly DECIMAL(10,2) NOT NULL CHECK (price_monthly >= 0),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PaaS Add-on Subscriptions table - user's managed service instances
CREATE TABLE IF NOT EXISTS paas_addon_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    addon_plan_id UUID NOT NULL REFERENCES paas_addon_plans(id) ON DELETE RESTRICT,
    app_id UUID REFERENCES paas_apps(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'suspended', 'error', 'terminated')),
    connection_string_encrypted TEXT,
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,
    provider_instance_id VARCHAR(255),
    configuration JSONB DEFAULT '{}',
    last_billed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PaaS Domains and SSL
-- ============================================================

-- PaaS Custom Domains table
CREATE TABLE IF NOT EXISTS paas_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES paas_apps(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'validation_required')),
    ssl_status VARCHAR(50) DEFAULT 'none' CHECK (ssl_status IN ('none', 'pending', 'issued', 'error', 'expired')),
    ssl_certificate TEXT,
    ssl_private_key_encrypted TEXT,
    ssl_expires_at TIMESTAMP WITH TIME ZONE,
    dns_validation JSONB DEFAULT '{}',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT paas_domains_unique_domain UNIQUE (domain)
);

-- ============================================================
-- PaaS Billing Integration
-- ============================================================

-- PaaS Billing Cycles table - tracks hourly billing for PaaS resources
CREATE TABLE IF NOT EXISTS paas_billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES paas_apps(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    plan_hourly_rate DECIMAL(10,6) NOT NULL,
    addon_hours JSONB DEFAULT '{}', -- {"addon_plan_id": hours, ...}
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- PaaS Plans indexes
CREATE INDEX IF NOT EXISTS idx_paas_plans_active ON paas_plans(active);
CREATE INDEX IF NOT EXISTS idx_paas_plans_display_order ON paas_plans(display_order);

-- PaaS Worker Nodes indexes
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_status ON paas_worker_nodes(status);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_last_heartbeat ON paas_worker_nodes(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_current_builds ON paas_worker_nodes(current_builds);

-- PaaS Apps indexes
CREATE INDEX IF NOT EXISTS idx_paas_apps_organization_id ON paas_apps(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_apps_plan_id ON paas_apps(plan_id);
CREATE INDEX IF NOT EXISTS idx_paas_apps_status ON paas_apps(status);
CREATE INDEX IF NOT EXISTS idx_paas_apps_slug ON paas_apps(slug);
CREATE INDEX IF NOT EXISTS idx_paas_apps_assigned_worker ON paas_apps(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_paas_apps_last_deployed ON paas_apps(last_deployed_at);

-- PaaS Deployments indexes
CREATE INDEX IF NOT EXISTS idx_paas_deployments_app_id ON paas_deployments(app_id);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_status ON paas_deployments(status);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_created_at ON paas_deployments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_worker_node ON paas_deployments(worker_node_id);

-- PaaS Build Logs indexes
CREATE INDEX IF NOT EXISTS idx_paas_build_logs_deployment_id ON paas_build_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_paas_build_logs_timestamp ON paas_build_logs(timestamp);

-- PaaS Environment Variables indexes
CREATE INDEX IF NOT EXISTS idx_paas_environment_vars_app_id ON paas_environment_vars(app_id);

-- PaaS Add-on indexes
CREATE INDEX IF NOT EXISTS idx_paas_addon_plans_service_type ON paas_addon_plans(service_type);
CREATE INDEX IF NOT EXISTS idx_paas_addon_plans_active ON paas_addon_plans(active);
CREATE INDEX IF NOT EXISTS idx_paas_addon_subscriptions_org_id ON paas_addon_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_addon_subscriptions_app_id ON paas_addon_subscriptions(app_id);
CREATE INDEX IF NOT EXISTS idx_paas_addon_subscriptions_status ON paas_addon_subscriptions(status);

-- PaaS Domains indexes
CREATE INDEX IF NOT EXISTS idx_paas_domains_app_id ON paas_domains(app_id);
CREATE INDEX IF NOT EXISTS idx_paas_domains_domain ON paas_domains(domain);
CREATE INDEX IF NOT EXISTS idx_paas_domains_status ON paas_domains(status);
CREATE INDEX IF NOT EXISTS idx_paas_domains_ssl_status ON paas_domains(ssl_status);

-- PaaS Billing indexes
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_app_id ON paas_billing_cycles(app_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_org_id ON paas_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_period ON paas_billing_cycles(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_status ON paas_billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_created_at ON paas_billing_cycles(created_at);

-- ============================================================
-- Triggers for updated_at columns
-- ============================================================

CREATE TRIGGER update_paas_plans_updated_at BEFORE UPDATE ON paas_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_worker_nodes_updated_at BEFORE UPDATE ON paas_worker_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_apps_updated_at BEFORE UPDATE ON paas_apps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_deployments_updated_at BEFORE UPDATE ON paas_deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_environment_vars_updated_at BEFORE UPDATE ON paas_environment_vars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_addon_plans_updated_at BEFORE UPDATE ON paas_addon_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_addon_subscriptions_updated_at BEFORE UPDATE ON paas_addon_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_domains_updated_at BEFORE UPDATE ON paas_domains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_billing_cycles_updated_at BEFORE UPDATE ON paas_billing_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PaaS-specific Functions and Triggers
-- ============================================================

-- Function to update app slug from name
CREATE OR REPLACE FUNCTION generate_app_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9\s]', '', 'g'));
        NEW.slug := regexp_replace(NEW.slug, '\s+', '-', 'g');
        NEW.slug := substr(NEW.slug, 1, 50);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate slug from name
DROP TRIGGER IF EXISTS paas_apps_generate_slug ON paas_apps;
CREATE TRIGGER paas_apps_generate_slug
    BEFORE INSERT OR UPDATE ON paas_apps
    FOR EACH ROW EXECUTE FUNCTION generate_app_slug();

-- Function to validate GitHub repo URL format
CREATE OR REPLACE FUNCTION validate_github_url()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.github_repo_url IS NOT NULL AND NEW.github_repo_url != '' THEN
        IF NEW.github_repo_url !~ '^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$' THEN
            RAISE EXCEPTION 'Invalid GitHub repository URL format. Expected: https://github.com/owner/repo';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate GitHub URLs
DROP TRIGGER IF EXISTS paas_apps_validate_github_url ON paas_apps;
CREATE TRIGGER paas_apps_validate_github_url
    BEFORE INSERT OR UPDATE ON paas_apps
    FOR EACH ROW EXECUTE FUNCTION validate_github_url();

-- Function to update worker node heartbeat
CREATE OR REPLACE FUNCTION update_worker_heartbeat()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_heartbeat = NOW();
    IF NEW.status = 'online' AND OLD.status != 'online' THEN
        NEW.current_builds = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get current resource usage for an app
CREATE OR REPLACE FUNCTION get_app_resource_usage(app_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'deployments_count', (SELECT COUNT(*) FROM paas_deployments WHERE app_id = app_uuid),
        'successful_deployments', (SELECT COUNT(*) FROM paas_deployments WHERE app_id = app_uuid AND status = 'deployed'),
        'last_deployment', (SELECT created_at FROM paas_deployments WHERE app_id = app_uuid ORDER BY created_at DESC LIMIT 1),
        'addon_count', (SELECT COUNT(*) FROM paas_addon_subscriptions WHERE app_id = app_uuid AND status = 'active'),
        'domain_count', (SELECT COUNT(*) FROM paas_domains WHERE app_id = app_uuid AND status = 'active')
    ) INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Seed Data for PaaS System
-- ============================================================

-- Insert default PaaS plans
INSERT INTO paas_plans (name, description, cpu_cores, memory_mb, storage_gb, bandwidth_gb, price_hourly, price_monthly, display_order, active) VALUES
(
    'Starter',
    'Perfect for small Node.js applications and personal projects',
    0.5, 512, 1024, 100, 0.008, 5.80, 0, TRUE
),
(
    'Professional',
    'Ideal for production applications with moderate traffic',
    1.0, 1024, 2048, 500, 0.015, 10.80, 1, TRUE
),
(
    'Business',
    'High-performance applications with generous resources',
    2.0, 2048, 4096, 2000, 0.028, 20.20, 2, TRUE
),
(
    'Enterprise',
    'Maximum performance for demanding applications',
    4.0, 4096, 8192, 5000, 0.055, 39.60, 3, TRUE
) ON CONFLICT DO NOTHING;

-- Insert default add-on plans
INSERT INTO paas_addon_plans (name, service_type, description, specifications, price_hourly, price_monthly, active) VALUES
(
    'PostgreSQL Mini',
    'postgresql',
    'Small PostgreSQL database for development and small applications',
    '{"cpu": 0.5, "memory_mb": 512, "storage_gb": 10, "max_connections": 25}'::jsonb,
    0.004, 2.90, TRUE
),
(
    'PostgreSQL Standard',
    'postgresql',
    'Standard PostgreSQL database for production applications',
    '{"cpu": 1.0, "memory_mb": 1024, "storage_gb": 25, "max_connections": 100}'::jsonb,
    0.008, 5.80, TRUE
),
(
    'Redis Mini',
    'redis',
    'Small Redis instance for caching and session storage',
    '{"cpu": 0.5, "memory_mb": 512, "storage_gb": 1, "max_memory_policy": "allkeys-lru"}'::jsonb,
    0.002, 1.45, TRUE
),
(
    'Redis Standard',
    'redis',
    'Standard Redis instance for production caching',
    '{"cpu": 1.0, "memory_mb": 1024, "storage_gb": 2, "max_memory_policy": "allkeys-lru"}'::jsonb,
    0.004, 2.90, TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Add PaaS permissions to existing role-based access control
-- ============================================================

-- Insert PaaS-related permissions into platform settings for easy management
INSERT INTO platform_settings (key, value) VALUES
(
    'paas_enabled',
    jsonb_build_object('enabled', true, 'max_apps_per_organization', 10, 'auto_deployments_enabled', true)
),
(
    'paas_runtime_configs',
    jsonb_build_object(
        'nodejs', jsonb_build_object(
            'supported_versions', jsonb_build_array('18.x', '20.x', '22.x'),
            'default_version', '20.x',
            'build_packages', jsonb_build_array('build-essential', 'python3', 'make'),
            'runtime_packages', jsonb_build_array('nodejs', 'npm')
        )
    )
),
(
    'paas_build_limits',
    jsonb_build_object(
        'max_build_time_minutes', 15,
        'max_build_size_mb', 1024,
        'max_log_size_mb', 100,
        'build_timeout_seconds', 900
    )
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Comments and Documentation
-- ============================================================

COMMENT ON TABLE paas_plans IS 'Defines available PaaS service tiers with pricing and resource limits';
COMMENT ON TABLE paas_worker_nodes IS 'Registry of build/deployment worker nodes that execute application builds and deployments';
COMMENT ON TABLE paas_apps IS 'Main registry for all PaaS applications owned by organizations';
COMMENT ON TABLE paas_deployments IS 'Complete deployment history with build logs, status tracking, and rollback capabilities';
COMMENT ON TABLE paas_build_logs IS 'Real-time build log entries for streaming to the user interface';
COMMENT ON TABLE paas_environment_vars IS 'Encrypted storage for application environment variables and secrets';
COMMENT ON TABLE paas_addon_plans IS 'Available managed service add-ons (databases, caching, etc.)';
COMMENT ON TABLE paas_addon_subscriptions IS 'User subscriptions to managed services with provisioning status';
COMMENT ON TABLE paas_domains IS 'Custom domain management with SSL certificate handling';
COMMENT ON TABLE paas_billing_cycles IS 'Hourly billing tracking for PaaS resources and add-on usage';

COMMENT ON COLUMN paas_apps.slug IS 'URL-friendly identifier derived from the application name';
COMMENT ON COLUMN paas_apps.auto_deployments IS 'Whether to automatically deploy on pushes to the configured GitHub branch';
COMMENT ON COLUMN paas_worker_nodes.auth_token_encrypted IS 'Encrypted authentication token for secure communication with worker nodes';
COMMENT ON COLUMN paas_environment_vars.is_secret IS 'Indicates whether the variable contains sensitive data that should be masked in the UI';
COMMENT ON COLUMN paas_deployments.rollback_from_deployment_id IS 'Reference to the deployment being rolled back from, if applicable';

-- Migration completed successfully
-- PaaS system is now ready for Node.js application deployment with GitHub integration