-- PaaS Health Check & SSL Enhancements
-- Adds health check configuration to applications and richer domain tracking

-- ============================================================
-- Health Check Columns
-- ============================================================

ALTER TABLE paas_applications
  ADD COLUMN IF NOT EXISTS health_check_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS health_check_path VARCHAR(255) DEFAULT '/health',
  ADD COLUMN IF NOT EXISTS health_check_interval_seconds INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS health_check_timeout_seconds INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS health_check_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS health_check_protocol VARCHAR(10) DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS last_health_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMP WITH TIME ZONE;

UPDATE paas_applications
SET
  health_check_enabled = COALESCE(health_check_enabled, TRUE),
  health_check_path = COALESCE(NULLIF(health_check_path, ''), '/health'),
  health_check_interval_seconds = COALESCE(health_check_interval_seconds, 30),
  health_check_timeout_seconds = COALESCE(health_check_timeout_seconds, 10),
  health_check_retries = COALESCE(health_check_retries, 3),
  health_check_protocol = COALESCE(NULLIF(health_check_protocol, ''), 'http');

-- ============================================================
-- Domain & SSL Columns
-- ============================================================

ALTER TABLE paas_domains
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ssl_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ssl_last_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ssl_error TEXT;

UPDATE paas_domains
SET verification_status = CASE WHEN is_verified THEN 'verified' ELSE 'pending' END
WHERE verification_status IS NULL;

UPDATE paas_domains
SET ssl_status = CASE WHEN ssl_enabled THEN 'active' ELSE 'pending' END
WHERE ssl_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_paas_apps_health_status ON paas_applications (last_health_status);
CREATE INDEX IF NOT EXISTS idx_paas_domains_verification_status ON paas_domains (verification_status);
CREATE INDEX IF NOT EXISTS idx_paas_domains_ssl_status ON paas_domains (ssl_status);
