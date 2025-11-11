-- SkyPanelV2 PaaS Schema Migration
-- Date: 2025-11-11
-- This migration adds comprehensive PaaS (Platform as a Service) functionality using Docker Swarm

-- ============================================================
-- PaaS Core Tables
-- ============================================================

-- PaaS Plans - Extending existing plan structure for PaaS offerings
CREATE TABLE IF NOT EXISTS paas_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    base_hourly_rate DECIMAL(10,4) NOT NULL CHECK (base_hourly_rate >= 0),
    cpu_cores INTEGER NOT NULL CHECK (cpu_cores > 0),
    memory_mb INTEGER NOT NULL CHECK (memory_mb > 0),
    storage_gb INTEGER NOT NULL CHECK (storage_gb >= 0),
    bandwidth_gb INTEGER NOT NULL CHECK (bandwidth_gb >= 0),
    max_applications INTEGER DEFAULT 10 CHECK (max_applications > 0),
    max_clusters INTEGER DEFAULT 1 CHECK (max_clusters > 0),
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Clusters - Docker Swarm clusters managed by the platform
CREATE TABLE IF NOT EXISTS paas_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_provider_id UUID REFERENCES service_providers(id) ON DELETE SET NULL,
    plan_id UUID NOT NULL REFERENCES paas_plans(id),
    name VARCHAR(255) NOT NULL,
    provider_cluster_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN (
        'provisioning', 'initializing', 'active', 'updating', 'error', 'maintenance', 'terminating'
    )),
    configuration JSONB DEFAULT '{}',
    node_count INTEGER DEFAULT 1 CHECK (node_count > 0),
    manager_nodes INTEGER DEFAULT 1 CHECK (manager_nodes > 0),
    worker_nodes INTEGER DEFAULT 0 CHECK (worker_nodes >= 0),
    network_config JSONB DEFAULT '{}',
    storage_config JSONB DEFAULT '{}',
    last_billed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Applications - Applications deployed on clusters
CREATE TABLE IF NOT EXISTS paas_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES paas_clusters(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    repository_url VARCHAR(500),
    branch VARCHAR(100) DEFAULT 'main',
    commit_hash VARCHAR(40),
    dockerfile_path VARCHAR(255) DEFAULT 'Dockerfile',
    build_context_path VARCHAR(255) DEFAULT '.',
    build_command VARCHAR(500),
    start_command VARCHAR(500),
    environment_variables JSONB DEFAULT '{}',
    secrets JSONB DEFAULT '{}',
    port_bindings JSONB DEFAULT '{}',
    volume_mounts JSONB DEFAULT '{}',
    resource_limits JSONB DEFAULT '{}',
    health_check JSONB DEFAULT '{}',
    deployment_config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN (
        'stopped', 'building', 'deploying', 'running', 'updating', 'error', 'deleting'
    )),
    replicas INTEGER DEFAULT 1 CHECK (replicas >= 0),
    deployed_at TIMESTAMPTZ,
    last_deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Deployments - Deployment history and tracking
CREATE TABLE IF NOT EXISTS paas_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    deployment_number INTEGER NOT NULL,
    commit_hash VARCHAR(40),
    commit_message TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'building', 'deploying', 'success', 'failed', 'cancelled', 'rolling_back'
    )),
    build_logs TEXT,
    deployment_logs TEXT,
    error_message TEXT,
    build_time_seconds INTEGER,
    deployment_time_seconds INTEGER,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Domains - Custom domain management
CREATE TABLE IF NOT EXISTS paas_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    ssl_status VARCHAR(50) DEFAULT 'none' CHECK (ssl_status IN (
        'none', 'pending', 'validating', 'issued', 'error', 'renewing', 'expired'
    )),
    ssl_certificate JSONB DEFAULT '{}',
    dns_challenge JSONB DEFAULT '{}',
    validation_method VARCHAR(50) DEFAULT 'http' CHECK (validation_method IN ('http', 'dns', 'tls')),
    primary_domain BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'active', 'error', 'deleting'
    )),
    verification_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Billing Cycles - Extending existing billing system
CREATE TABLE IF NOT EXISTS paas_billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES paas_clusters(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    hourly_rate DECIMAL(10,4) NOT NULL,
    total_hours DECIMAL(10,2) NOT NULL CHECK (total_hours >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    resource_usage JSONB DEFAULT '{}',
    application_usage JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'billed', 'failed', 'refunded', 'disputed'
    )),
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PaaS Worker Management Tables
-- ============================================================

-- PaaS Worker Nodes - Individual worker nodes in clusters
CREATE TABLE IF NOT EXISTS paas_worker_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES paas_clusters(id) ON DELETE CASCADE,
    provider_node_id VARCHAR(255),
    node_type VARCHAR(50) DEFAULT 'worker' CHECK (node_type IN ('manager', 'worker')),
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN (
        'provisioning', 'active', 'draining', 'unavailable', 'error', 'removing'
    )),
    internal_ip INET,
    external_ip INET,
    hostname VARCHAR(255),
    configuration JSONB DEFAULT '{}',
    resource_capacity JSONB DEFAULT '{}',
    resource_usage JSONB DEFAULT '{}',
    labels JSONB DEFAULT '{}',
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(50) DEFAULT 'unknown' CHECK (health_status IN (
        'healthy', 'unhealthy', 'unknown', 'maintenance'
    )),
    docker_version VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Worker Setup Codes - Generated codes for worker provisioning
CREATE TABLE IF NOT EXISTS paas_worker_setup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES paas_clusters(id) ON DELETE SET NULL,
    code_name VARCHAR(255) NOT NULL,
    setup_token VARCHAR(255) NOT NULL UNIQUE,
    setup_script TEXT NOT NULL,
    configuration JSONB DEFAULT '{}',
    usage_limit INTEGER DEFAULT 1 CHECK (usage_limit > 0),
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PaaS Service & Database Tables
-- ============================================================

-- PaaS Services - Additional services (databases, caches, etc.)
CREATE TABLE IF NOT EXISTS paas_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES paas_clusters(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID REFERENCES paas_applications(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL CHECK (service_type IN (
        'postgresql', 'mysql', 'redis', 'mongodb', 'nginx', 'custom'
    )),
    version VARCHAR(50),
    configuration JSONB DEFAULT '{}',
    environment_variables JSONB DEFAULT '{}',
    resource_limits JSONB DEFAULT '{}',
    volume_mounts JSONB DEFAULT '{}',
    connection_info JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN (
        'stopped', 'starting', 'running', 'updating', 'error', 'deleting'
    )),
    backups_enabled BOOLEAN DEFAULT false,
    backup_schedule JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PaaS Backups - Backup management for applications and services
CREATE TABLE IF NOT EXISTS paas_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('application', 'service', 'cluster')),
    entity_id UUID NOT NULL,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN (
        'manual', 'scheduled', 'pre-deployment'
    )),
    backup_method VARCHAR(50) NOT NULL CHECK (backup_method IN (
        'full', 'incremental', 'snapshot'
    )),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'deleting'
    )),
    backup_location VARCHAR(500),
    backup_size_bytes BIGINT,
    compression_method VARCHAR(50) DEFAULT 'gzip',
    encryption_enabled BOOLEAN DEFAULT false,
    retention_days INTEGER DEFAULT 30 CHECK (retention_days > 0),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Organization Invitations (Enhancing existing system)
-- ============================================================

-- Organization Invitations - Extend invitation system for organizations
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    invitation_token VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'declined', 'expired', 'cancelled'
    )),
    message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

-- PaaS Plans indexes
CREATE INDEX IF NOT EXISTS idx_paas_plans_active ON paas_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_paas_plans_name ON paas_plans(name);

-- PaaS Clusters indexes
CREATE INDEX IF NOT EXISTS idx_paas_clusters_org_id ON paas_clusters(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_clusters_provider_id ON paas_clusters(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_paas_clusters_plan_id ON paas_clusters(plan_id);
CREATE INDEX IF NOT EXISTS idx_paas_clusters_status ON paas_clusters(status);
CREATE INDEX IF NOT EXISTS idx_paas_clusters_last_billed_at ON paas_clusters(last_billed_at);
CREATE INDEX IF NOT EXISTS idx_paas_clusters_created_at ON paas_clusters(created_at);

-- PaaS Applications indexes
CREATE INDEX IF NOT EXISTS idx_paas_applications_cluster_id ON paas_applications(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paas_applications_org_id ON paas_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_applications_status ON paas_applications(status);
CREATE INDEX IF NOT EXISTS idx_paas_applications_repo_url ON paas_applications(repository_url);
CREATE INDEX IF NOT EXISTS idx_paas_applications_created_at ON paas_applications(created_at);

-- PaaS Deployments indexes
CREATE INDEX IF NOT EXISTS idx_paas_deployments_app_id ON paas_deployments(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_status ON paas_deployments(status);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_created_at ON paas_deployments(created_at);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_number ON paas_deployments(application_id, deployment_number);

-- PaaS Domains indexes
CREATE INDEX IF NOT EXISTS idx_paas_domains_app_id ON paas_domains(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_domains_domain ON paas_domains(domain);
CREATE INDEX IF NOT EXISTS idx_paas_domains_ssl_status ON paas_domains(ssl_status);
CREATE INDEX IF NOT EXISTS idx_paas_domains_status ON paas_domains(status);
CREATE INDEX IF NOT EXISTS idx_paas_domains_primary ON paas_domains(application_id, primary_domain) WHERE primary_domain = true;

-- PaaS Billing indexes
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_cluster_id ON paas_billing_cycles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_org_id ON paas_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_period ON paas_billing_cycles(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_status ON paas_billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_paas_billing_cycles_created_at ON paas_billing_cycles(created_at);

-- PaaS Worker Nodes indexes
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_cluster_id ON paas_worker_nodes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_status ON paas_worker_nodes(status);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_type ON paas_worker_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_health ON paas_worker_nodes(health_status);
CREATE INDEX IF NOT EXISTS idx_paas_worker_nodes_ip ON paas_worker_nodes(internal_ip) WHERE internal_ip IS NOT NULL;

-- PaaS Worker Setup Codes indexes
CREATE INDEX IF NOT EXISTS idx_paas_worker_setup_codes_org_id ON paas_worker_setup_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_worker_setup_codes_cluster_id ON paas_worker_setup_codes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paas_worker_setup_codes_token ON paas_worker_setup_codes(setup_token);
CREATE INDEX IF NOT EXISTS idx_paas_worker_setup_codes_expires_at ON paas_worker_setup_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_paas_worker_setup_codes_active ON paas_worker_setup_codes(is_active);

-- PaaS Services indexes
CREATE INDEX IF NOT EXISTS idx_paas_services_cluster_id ON paas_services(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paas_services_org_id ON paas_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_paas_services_app_id ON paas_services(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_services_type ON paas_services(service_type);
CREATE INDEX IF NOT EXISTS idx_paas_services_status ON paas_services(status);

-- PaaS Backups indexes
CREATE INDEX IF NOT EXISTS idx_paas_backups_entity ON paas_backups(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_paas_backups_type ON paas_backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_paas_backups_status ON paas_backups(status);
CREATE INDEX IF NOT EXISTS idx_paas_backups_created_at ON paas_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_paas_backups_created_by ON paas_backups(created_by);

-- Organization Invitations indexes
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at);

-- ============================================================
-- Triggers for updated_at columns
-- ============================================================

CREATE TRIGGER update_paas_plans_updated_at BEFORE UPDATE ON paas_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_clusters_updated_at BEFORE UPDATE ON paas_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_applications_updated_at BEFORE UPDATE ON paas_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_domains_updated_at BEFORE UPDATE ON paas_domains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_billing_cycles_updated_at BEFORE UPDATE ON paas_billing_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_worker_nodes_updated_at BEFORE UPDATE ON paas_worker_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_worker_setup_codes_updated_at BEFORE UPDATE ON paas_worker_setup_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_services_updated_at BEFORE UPDATE ON paas_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paas_backups_updated_at BEFORE UPDATE ON paas_backups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_invitations_updated_at BEFORE UPDATE ON organization_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PaaS-specific Functions and Procedures
-- ============================================================

-- Function to get cluster resource usage summary
CREATE OR REPLACE FUNCTION get_cluster_resource_usage(cluster_param UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_applications', COUNT(a.id),
        'running_applications', COUNT(CASE WHEN a.status = 'running' THEN 1 END),
        'total_services', COUNT(s.id),
        'running_services', COUNT(CASE WHEN s.status = 'running' THEN 1 END),
        'active_domains', COUNT(d.id),
        'recent_deployments', COUNT(CASE WHEN dep.created_at > NOW() - INTERVAL '24 hours' THEN 1 END),
        'last_activity', GREATEST(
            MAX(a.updated_at),
            MAX(s.updated_at),
            MAX(d.updated_at),
            MAX(dep.created_at)
        )
    ) INTO result
    FROM paas_clusters c
    LEFT JOIN paas_applications a ON c.id = a.cluster_id
    LEFT JOIN paas_services s ON c.id = s.cluster_id AND s.application_id IS NULL
    LEFT JOIN paas_domains d ON a.id = d.application_id
    LEFT JOIN paas_deployments dep ON a.id = dep.application_id
    WHERE c.id = cluster_param;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate cluster billing for a period
CREATE OR REPLACE FUNCTION calculate_cluster_billing(
    cluster_param UUID,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    hourly_rate DECIMAL(10,4);
    hours DECIMAL(10,2);
    total_amount DECIMAL(10,2);
BEGIN
    -- Get the cluster's hourly rate from its plan
    SELECT p.base_hourly_rate INTO hourly_rate
    FROM paas_clusters c
    JOIN paas_plans p ON c.plan_id = p.id
    WHERE c.id = cluster_param;

    -- Calculate hours in the billing period
    hours := EXTRACT(EPOCH FROM (period_end - period_start)) / 3600;

    -- Calculate total amount
    total_amount := hourly_rate * hours;

    RETURN total_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM organization_invitations
    WHERE status = 'expired' AND expires_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Constraints and Additional Features
-- ============================================================

-- Ensure at least one primary domain per application
ALTER TABLE paas_domains ADD CONSTRAINT paas_domains_application_check
CHECK (
    primary_domain = false OR
    (SELECT COUNT(*) FROM paas_domains d2
     WHERE d2.application_id = paas_domains.application_id
     AND d2.primary_domain = true
     AND d2.id != paas_domains.id) = 0
);

-- Ensure reasonable resource limits
ALTER TABLE paas_applications ADD CONSTRAINT paas_applications_replicas_check
CHECK (replicas >= 0 AND replicas <= 100);

-- Ensure billing periods are valid
ALTER TABLE paas_billing_cycles ADD CONSTRAINT paas_billing_cycles_period_check
CHECK (billing_period_end > billing_period_start);

-- Ensure setup codes have reasonable expiration times
ALTER TABLE paas_worker_setup_codes ADD CONSTRAINT paas_worker_setup_codes_expiration_check
CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '30 days');

-- ============================================================
-- Initial Data Seeding
-- ============================================================

-- Seed default PaaS plans
INSERT INTO paas_plans (name, description, base_hourly_rate, cpu_cores, memory_mb, storage_gb, bandwidth_gb, max_applications, max_clusters, features, is_active) VALUES
('Starter', 'Perfect for small projects and development environments', 0.0150, 1, 512, 10, 100, 3, 1, '{"auto_scaling": false, "custom_domains": true, "ssl_certificates": true, "backups": false}', true),
('Professional', 'Ideal for production applications with moderate traffic', 0.0420, 2, 2048, 25, 500, 10, 2, '{"auto_scaling": true, "custom_domains": true, "ssl_certificates": true, "backups": true, "monitoring": true}', true),
('Business', 'For high-traffic applications and multiple services', 0.1250, 4, 4096, 100, 2000, 25, 5, '{"auto_scaling": true, "custom_domains": true, "ssl_certificates": true, "backups": true, "monitoring": true, "priority_support": true}', true),
('Enterprise', 'Maximum resources and features for large-scale applications', 0.2500, 8, 8192, 200, 5000, -1, 10, '{"auto_scaling": true, "custom_domains": true, "ssl_certificates": true, "backups": true, "monitoring": true, "priority_support": true, "dedicated_resources": true}', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Comments and Documentation
-- ============================================================

COMMENT ON TABLE paas_plans IS 'PaaS subscription plans with resource limits and features';
COMMENT ON TABLE paas_clusters IS 'Docker Swarm clusters managed by the platform';
COMMENT ON TABLE paas_applications IS 'Applications deployed on PaaS clusters';
COMMENT ON TABLE paas_deployments IS 'Deployment history and tracking for applications';
COMMENT ON TABLE paas_domains IS 'Custom domain management for applications';
COMMENT ON TABLE paas_billing_cycles IS 'Billing cycles for PaaS clusters, extending existing billing system';
COMMENT ON TABLE paas_worker_nodes IS 'Individual worker nodes in Docker Swarm clusters';
COMMENT ON TABLE paas_worker_setup_codes IS 'Generated setup codes for provisioning new worker nodes';
COMMENT ON TABLE paas_services IS 'Additional services like databases, caches, etc.';
COMMENT ON TABLE paas_backups IS 'Backup management for applications and services';
COMMENT ON TABLE organization_invitations IS 'Invitation system for organization members';

-- Column comments for important fields
COMMENT ON COLUMN paas_clusters.configuration IS 'Docker Swarm configuration, network settings, etc.';
COMMENT ON COLUMN paas_clusters.network_config IS 'Network overlay configuration, ingress settings';
COMMENT ON COLUMN paas_clusters.storage_config IS 'Storage drivers, volume configurations';
COMMENT ON COLUMN paas_applications.environment_variables IS 'Application environment variables (encrypted)';
COMMENT ON COLUMN paas_applications.secrets IS 'Encrypted application secrets';
COMMENT ON COLUMN paas_applications.resource_limits IS 'CPU, memory, and storage limits';
COMMENT ON COLUMN paas_applications.health_check IS 'Health check configuration';
COMMENT ON COLUMN paas_domains.ssl_certificate IS 'SSL certificate details and expiration';
COMMENT ON COLUMN paas_domains.verification_data IS 'Domain ownership verification data';
COMMENT ON COLUMN paas_billing_cycles.resource_usage IS 'Detailed resource usage metrics for billing period';
COMMENT ON COLUMN paas_worker_nodes.resource_capacity IS 'Total capacity of the worker node';
COMMENT ON COLUMN paas_worker_nodes.resource_usage IS 'Current resource usage metrics';
COMMENT ON COLUMN paas_worker_nodes.labels IS 'Docker node labels for scheduling';
COMMENT ON COLUMN paas_services.connection_info IS 'Connection details for the service (encrypted)';
COMMENT ON COLUMN paas_backups.backup_location IS 'Storage location of the backup file';
COMMENT ON COLUMN organization_invitations.invitation_token IS 'Unique token for invitation acceptance';

-- Migration completed successfully
