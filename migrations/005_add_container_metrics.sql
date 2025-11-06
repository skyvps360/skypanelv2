-- Migration: Add container metrics table
-- Description: Support for container resource usage monitoring and historical data

-- Container metrics table
CREATE TABLE IF NOT EXISTS container_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  container_id VARCHAR(255) NOT NULL,
  cpu_percent NUMERIC(5, 2) NOT NULL,
  memory_mb NUMERIC(10, 2) NOT NULL,
  network_in_bytes BIGINT DEFAULT 0,
  network_out_bytes BIGINT DEFAULT 0,
  block_read_bytes BIGINT DEFAULT 0,
  block_write_bytes BIGINT DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_container_metrics_container ON container_metrics(container_id);
CREATE INDEX IF NOT EXISTS idx_container_metrics_organization ON container_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_metrics_timestamp ON container_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_container_metrics_org_time ON container_metrics(organization_id, timestamp DESC);

-- Add comment
COMMENT ON TABLE container_metrics IS 'Historical container resource usage metrics';
