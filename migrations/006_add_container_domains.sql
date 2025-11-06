-- Migration: Add container domains table
-- Description: Support for custom domain configuration with Traefik integration

-- Container domains table
CREATE TABLE IF NOT EXISTS container_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  hostname VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 80,
  path_prefix VARCHAR(255),
  ssl_enabled BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'pending',
  validated_at TIMESTAMP WITH TIME ZONE,
  certificate_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_id, hostname, path_prefix)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_container_domains_organization ON container_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_domains_service ON container_domains(service_id);
CREATE INDEX IF NOT EXISTS idx_container_domains_hostname ON container_domains(hostname);
CREATE INDEX IF NOT EXISTS idx_container_domains_status ON container_domains(status);

-- Add comment
COMMENT ON TABLE container_domains IS 'Custom domain configurations for container services with Traefik routing';
