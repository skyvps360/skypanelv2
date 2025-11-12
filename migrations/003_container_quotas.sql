-- Container Quotas Migration
-- Date: 2025-11-12
-- This migration adds resource quota management for container platform

-- ============================================================
-- Add Quota Fields to Organizations Table
-- ============================================================

-- Add quota configuration to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS container_quotas JSONB DEFAULT '{
  "cpu_cores": 10,
  "memory_mb": 10240,
  "disk_gb": 100,
  "max_services": 50
}'::jsonb;

-- Add quota utilization tracking (updated every 30 seconds)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS container_quota_usage JSONB DEFAULT '{
  "cpu_cores": 0,
  "memory_mb": 0,
  "disk_gb": 0,
  "service_count": 0
}'::jsonb;

-- Add last quota calculation timestamp
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS quota_last_calculated_at TIMESTAMP WITH TIME ZONE;

-- Create index for quota queries
CREATE INDEX IF NOT EXISTS idx_organizations_quota_usage ON organizations USING GIN (container_quota_usage);

-- ============================================================
-- Quota Calculation Function
-- ============================================================

-- Function to calculate current quota usage for an organization
CREATE OR REPLACE FUNCTION calculate_organization_quota_usage(org_id UUID)
RETURNS JSONB AS $$
DECLARE
  usage JSONB;
  total_cpu DECIMAL;
  total_memory BIGINT;
  total_disk BIGINT;
  service_count INTEGER;
BEGIN
  -- Calculate total resource usage from running services
  SELECT 
    COALESCE(SUM((resource_limits->>'cpu_cores')::DECIMAL), 0),
    COALESCE(SUM((resource_limits->>'memory_mb')::BIGINT), 0),
    COALESCE(SUM((resource_limits->>'disk_gb')::BIGINT), 0),
    COUNT(*)
  INTO total_cpu, total_memory, total_disk, service_count
  FROM container_services
  WHERE organization_id = org_id
    AND status IN ('running', 'deploying', 'building', 'pending');

  -- Build usage JSON
  usage := jsonb_build_object(
    'cpu_cores', total_cpu,
    'memory_mb', total_memory,
    'disk_gb', total_disk,
    'service_count', service_count
  );

  -- Update organization quota usage and timestamp
  UPDATE organizations
  SET 
    container_quota_usage = usage,
    quota_last_calculated_at = NOW()
  WHERE id = org_id;

  RETURN usage;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Quota Enforcement Function
-- ============================================================

-- Function to check if deployment would exceed quota
CREATE OR REPLACE FUNCTION check_quota_before_deployment(
  org_id UUID,
  required_cpu DECIMAL,
  required_memory BIGINT,
  required_disk BIGINT
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  current_usage JSONB,
  quota_limits JSONB
) AS $$
DECLARE
  current_usage_data JSONB;
  quota_limits_data JSONB;
  new_cpu DECIMAL;
  new_memory BIGINT;
  new_disk BIGINT;
  new_service_count INTEGER;
  max_cpu DECIMAL;
  max_memory BIGINT;
  max_disk BIGINT;
  max_services INTEGER;
BEGIN
  -- Get current quota limits
  SELECT container_quotas INTO quota_limits_data
  FROM organizations
  WHERE id = org_id;

  -- Calculate current usage (force recalculation)
  current_usage_data := calculate_organization_quota_usage(org_id);

  -- Extract limits
  max_cpu := (quota_limits_data->>'cpu_cores')::DECIMAL;
  max_memory := (quota_limits_data->>'memory_mb')::BIGINT;
  max_disk := (quota_limits_data->>'disk_gb')::BIGINT;
  max_services := (quota_limits_data->>'max_services')::INTEGER;

  -- Calculate new usage
  new_cpu := (current_usage_data->>'cpu_cores')::DECIMAL + required_cpu;
  new_memory := (current_usage_data->>'memory_mb')::BIGINT + required_memory;
  new_disk := (current_usage_data->>'disk_gb')::BIGINT + required_disk;
  new_service_count := (current_usage_data->>'service_count')::INTEGER + 1;

  -- Check CPU quota
  IF new_cpu > max_cpu THEN
    RETURN QUERY SELECT 
      FALSE,
      format('CPU quota exceeded: would use %s cores but limit is %s cores', new_cpu, max_cpu),
      current_usage_data,
      quota_limits_data;
    RETURN;
  END IF;

  -- Check memory quota
  IF new_memory > max_memory THEN
    RETURN QUERY SELECT 
      FALSE,
      format('Memory quota exceeded: would use %s MB but limit is %s MB', new_memory, max_memory),
      current_usage_data,
      quota_limits_data;
    RETURN;
  END IF;

  -- Check disk quota
  IF new_disk > max_disk THEN
    RETURN QUERY SELECT 
      FALSE,
      format('Disk quota exceeded: would use %s GB but limit is %s GB', new_disk, max_disk),
      current_usage_data,
      quota_limits_data;
    RETURN;
  END IF;

  -- Check service count quota
  IF new_service_count > max_services THEN
    RETURN QUERY SELECT 
      FALSE,
      format('Service count quota exceeded: would have %s services but limit is %s services', new_service_count, max_services),
      current_usage_data,
      quota_limits_data;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT 
    TRUE,
    'Quota check passed'::TEXT,
    current_usage_data,
    quota_limits_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Quota Recalculation Trigger
-- ============================================================

-- Function to trigger quota recalculation when service status changes
CREATE OR REPLACE FUNCTION trigger_quota_recalculation()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate quota when service status changes to/from running states
  IF (TG_OP = 'INSERT' AND NEW.status IN ('running', 'deploying', 'building', 'pending'))
     OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status)
     OR (TG_OP = 'DELETE' AND OLD.status IN ('running', 'deploying', 'building', 'pending'))
  THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM calculate_organization_quota_usage(OLD.organization_id);
    ELSE
      PERFORM calculate_organization_quota_usage(NEW.organization_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on container_services
DROP TRIGGER IF EXISTS container_service_quota_trigger ON container_services;
CREATE TRIGGER container_service_quota_trigger
  AFTER INSERT OR UPDATE OR DELETE ON container_services
  FOR EACH ROW
  EXECUTE FUNCTION trigger_quota_recalculation();

-- ============================================================
-- Initial Quota Calculation for Existing Organizations
-- ============================================================

-- Calculate quota usage for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM calculate_organization_quota_usage(org_record.id);
  END LOOP;
END $$;

-- ============================================================
-- Helper Views for Quota Monitoring
-- ============================================================

-- View for quota utilization percentages
CREATE OR REPLACE VIEW organization_quota_utilization AS
SELECT 
  o.id,
  o.name,
  o.slug,
  o.container_quotas,
  o.container_quota_usage,
  o.quota_last_calculated_at,
  -- Calculate utilization percentages
  ROUND(
    ((o.container_quota_usage->>'cpu_cores')::DECIMAL / 
     NULLIF((o.container_quotas->>'cpu_cores')::DECIMAL, 0)) * 100, 
    2
  ) AS cpu_utilization_percent,
  ROUND(
    ((o.container_quota_usage->>'memory_mb')::BIGINT / 
     NULLIF((o.container_quotas->>'memory_mb')::BIGINT, 0)) * 100, 
    2
  ) AS memory_utilization_percent,
  ROUND(
    ((o.container_quota_usage->>'disk_gb')::BIGINT / 
     NULLIF((o.container_quotas->>'disk_gb')::BIGINT, 0)) * 100, 
    2
  ) AS disk_utilization_percent,
  ROUND(
    ((o.container_quota_usage->>'service_count')::INTEGER / 
     NULLIF((o.container_quotas->>'max_services')::INTEGER, 0)) * 100, 
    2
  ) AS service_count_utilization_percent
FROM organizations o
WHERE o.container_quotas IS NOT NULL;

COMMENT ON VIEW organization_quota_utilization IS 
'Provides quota utilization percentages for monitoring and alerting';

