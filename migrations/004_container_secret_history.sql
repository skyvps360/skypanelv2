-- Container Secret History Migration
-- Date: 2025-11-12
-- This migration adds the secret history table for tracking secret rotations

-- ============================================================
-- Container Secret History Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_secret_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  secret_id UUID NOT NULL REFERENCES container_secrets(id) ON DELETE CASCADE,
  encrypted_value TEXT NOT NULL,
  rotated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_container_secret_history_secret ON container_secret_history(secret_id);
CREATE INDEX IF NOT EXISTS idx_container_secret_history_expires ON container_secret_history(expires_at);
CREATE INDEX IF NOT EXISTS idx_container_secret_history_created ON container_secret_history(created_at DESC);

-- Composite index for common query pattern: recent history per secret
CREATE INDEX IF NOT EXISTS idx_container_secret_history_secret_created ON container_secret_history(secret_id, created_at DESC);

-- ============================================================
-- Cleanup Job for Expired Secret History
-- ============================================================

-- This function can be called periodically to clean up expired secret history
CREATE OR REPLACE FUNCTION cleanup_expired_secret_history()
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM container_secret_history
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Note: To run this cleanup automatically, you can set up a cron job or scheduled task
-- that calls: SELECT cleanup_expired_secret_history();
