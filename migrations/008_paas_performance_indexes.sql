-- PaaS Performance Indexes
-- Adds composite and freshness indexes to reduce query latency for billing, cache cleanup, and worker monitoring.

-- Resource usage lookups often filter by organization and period start.
CREATE INDEX IF NOT EXISTS idx_paas_usage_org_period
  ON paas_resource_usage (organization_id, period_start DESC);

-- Build cache maintenance filters by application + last_used_at.
CREATE INDEX IF NOT EXISTS idx_paas_build_cache_app_last_used
  ON paas_build_cache (application_id, last_used_at DESC);

-- Worker monitors frequently sort by heartbeat timestamps.
CREATE INDEX IF NOT EXISTS idx_paas_workers_last_heartbeat
  ON paas_worker_nodes (last_heartbeat_at DESC);

-- Domain verifications use application_id/status filters.
CREATE INDEX IF NOT EXISTS idx_paas_domains_status
  ON paas_domains (application_id, verification_status);
