-- Migration: Add container volumes and backups tables
-- Description: Support for persistent Docker volumes and backups

-- Container volumes table
CREATE TABLE IF NOT EXISTS container_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  mount_path VARCHAR(500) NOT NULL,
  size_limit_mb INTEGER,
  backup_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_container_volumes_organization ON container_volumes(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_volumes_service ON container_volumes(service_name);

-- Container volume backups table
CREATE TABLE IF NOT EXISTS container_volume_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES container_volumes(id) ON DELETE CASCADE,
  volume_name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_container_volume_backups_volume ON container_volume_backups(volume_id);
CREATE INDEX IF NOT EXISTS idx_container_volume_backups_created ON container_volume_backups(created_at DESC);

-- Add comment
COMMENT ON TABLE container_volumes IS 'Persistent Docker volumes for container services';
COMMENT ON TABLE container_volume_backups IS 'Backup records for container volumes';
