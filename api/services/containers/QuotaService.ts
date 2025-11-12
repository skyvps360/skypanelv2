import { query } from '../../lib/database.js';
import { logActivity } from '../activityLogger.js';

interface QuotaLimits {
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  max_services: number;
}

interface QuotaUsage {
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  service_count: number;
}

interface QuotaCheckResult {
  allowed: boolean;
  reason: string;
  current_usage: QuotaUsage;
  quota_limits: QuotaLimits;
  utilization?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    service_count_percent: number;
  };
}

export class QuotaService {
  /**
   * Check if a deployment would exceed organization quotas
   * This is called synchronously before service creation
   */
  static async checkQuotaBeforeDeployment(
    organizationId: string,
    resourceLimits: {
      cpu_cores: number;
      memory_mb: number;
      disk_gb: number;
    }
  ): Promise<QuotaCheckResult> {
    const result = await query(
      `SELECT * FROM check_quota_before_deployment($1, $2, $3, $4)`,
      [
        organizationId,
        resourceLimits.cpu_cores,
        resourceLimits.memory_mb,
        resourceLimits.disk_gb,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Quota check failed: no result returned');
    }

    const row = result.rows[0];
    const checkResult: QuotaCheckResult = {
      allowed: row.allowed,
      reason: row.reason,
      current_usage: row.current_usage,
      quota_limits: row.quota_limits,
    };

    // Calculate utilization percentages
    if (checkResult.current_usage && checkResult.quota_limits) {
      checkResult.utilization = {
        cpu_percent: (checkResult.current_usage.cpu_cores / checkResult.quota_limits.cpu_cores) * 100,
        memory_percent: (checkResult.current_usage.memory_mb / checkResult.quota_limits.memory_mb) * 100,
        disk_percent: (checkResult.current_usage.disk_gb / checkResult.quota_limits.disk_gb) * 100,
        service_count_percent: (checkResult.current_usage.service_count / checkResult.quota_limits.max_services) * 100,
      };
    }

    // Log quota check
    if (!checkResult.allowed) {
      await logActivity({
        userId: null, // System action
        organizationId,
        eventType: 'quota.exceeded',
        entityType: 'organization',
        entityId: organizationId,
        message: `Quota check failed: ${checkResult.reason}`,
        status: 'warning',
        metadata: {
          current_usage: checkResult.current_usage,
          quota_limits: checkResult.quota_limits,
          requested_resources: resourceLimits,
        },
      });
    }

    return checkResult;
  }

  /**
   * Get current quota usage for an organization
   */
  static async getQuotaUsage(organizationId: string): Promise<{
    usage: QuotaUsage;
    limits: QuotaLimits;
    utilization: {
      cpu_percent: number;
      memory_percent: number;
      disk_percent: number;
      service_count_percent: number;
    };
    last_calculated_at: Date | null;
  }> {
    // Force recalculation
    await query(`SELECT calculate_organization_quota_usage($1)`, [organizationId]);

    const result = await query(
      `SELECT 
        container_quota_usage,
        container_quotas,
        quota_last_calculated_at
      FROM organizations
      WHERE id = $1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const row = result.rows[0];
    const usage: QuotaUsage = row.container_quota_usage;
    const limits: QuotaLimits = row.container_quotas;

    return {
      usage,
      limits,
      utilization: {
        cpu_percent: (usage.cpu_cores / limits.cpu_cores) * 100,
        memory_percent: (usage.memory_mb / limits.memory_mb) * 100,
        disk_percent: (usage.disk_gb / limits.disk_gb) * 100,
        service_count_percent: (usage.service_count / limits.max_services) * 100,
      },
      last_calculated_at: row.quota_last_calculated_at,
    };
  }

  /**
   * Recalculate quota usage for an organization
   * This is called every 30 seconds by a background job
   */
  static async recalculateQuotaUsage(organizationId: string): Promise<QuotaUsage> {
    const result = await query(
      `SELECT calculate_organization_quota_usage($1) as usage`,
      [organizationId]
    );

    return result.rows[0].usage;
  }

  /**
   * Recalculate quota usage for all organizations
   * Called by background job every 30 seconds
   */
  static async recalculateAllQuotas(): Promise<void> {
    const orgsResult = await query(
      `SELECT id FROM organizations WHERE container_quotas IS NOT NULL`
    );

    for (const org of orgsResult.rows) {
      await this.recalculateQuotaUsage(org.id);
    }
  }

  /**
   * Update organization quota limits (admin only)
   */
  static async updateQuotaLimits(
    organizationId: string,
    limits: Partial<QuotaLimits>,
    adminUserId: string
  ): Promise<QuotaLimits> {
    // Get current limits
    const currentResult = await query(
      `SELECT container_quotas FROM organizations WHERE id = $1`,
      [organizationId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const currentLimits: QuotaLimits = currentResult.rows[0].container_quotas;
    const newLimits = { ...currentLimits, ...limits };

    // Update limits
    await query(
      `UPDATE organizations 
       SET container_quotas = $1
       WHERE id = $2`,
      [JSON.stringify(newLimits), organizationId]
    );

    // Log activity
    await logActivity({
      userId: adminUserId,
      organizationId,
      eventType: 'quota.updated',
      entityType: 'organization',
      entityId: organizationId,
      message: 'Organization quota limits updated',
      status: 'success',
      metadata: {
        old_limits: currentLimits,
        new_limits: newLimits,
      },
    });

    return newLimits;
  }

  /**
   * Get quota utilization for all organizations (admin dashboard)
   */
  static async getAllOrganizationQuotas(): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    quotas: QuotaLimits;
    usage: QuotaUsage;
    utilization: {
      cpu_percent: number;
      memory_percent: number;
      disk_percent: number;
      service_count_percent: number;
    };
    last_calculated_at: Date | null;
  }>> {
    const result = await query(`
      SELECT 
        id,
        name,
        slug,
        container_quotas as quotas,
        container_quota_usage as usage,
        quota_last_calculated_at,
        cpu_utilization_percent,
        memory_utilization_percent,
        disk_utilization_percent,
        service_count_utilization_percent
      FROM organization_quota_utilization
      ORDER BY name
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      quotas: row.quotas,
      usage: row.usage,
      utilization: {
        cpu_percent: parseFloat(row.cpu_utilization_percent) || 0,
        memory_percent: parseFloat(row.memory_utilization_percent) || 0,
        disk_percent: parseFloat(row.disk_utilization_percent) || 0,
        service_count_percent: parseFloat(row.service_count_utilization_percent) || 0,
      },
      last_calculated_at: row.quota_last_calculated_at,
    }));
  }

  /**
   * Check if organization is approaching quota limits
   * Returns true if any resource is at or above the threshold percentage
   */
  static async isApproachingQuota(
    organizationId: string,
    thresholdPercent: number = 80
  ): Promise<{
    approaching: boolean;
    resources: string[];
    utilization: {
      cpu_percent: number;
      memory_percent: number;
      disk_percent: number;
      service_count_percent: number;
    };
  }> {
    const quotaData = await this.getQuotaUsage(organizationId);
    const resources: string[] = [];

    if (quotaData.utilization.cpu_percent >= thresholdPercent) {
      resources.push('CPU');
    }
    if (quotaData.utilization.memory_percent >= thresholdPercent) {
      resources.push('Memory');
    }
    if (quotaData.utilization.disk_percent >= thresholdPercent) {
      resources.push('Disk');
    }
    if (quotaData.utilization.service_count_percent >= thresholdPercent) {
      resources.push('Service Count');
    }

    return {
      approaching: resources.length > 0,
      resources,
      utilization: quotaData.utilization,
    };
  }
}
