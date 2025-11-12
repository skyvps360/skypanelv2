/**
 * Quota Alert Service
 * Handles quota threshold notifications and alerts
 */

import { query } from '../../lib/database.js';
import { logActivity } from '../activityLogger.js';
import { QuotaService } from './QuotaService.js';

interface QuotaThreshold {
  level: 'warning' | 'critical' | 'exceeded';
  percent: number;
  message: string;
}

const QUOTA_THRESHOLDS: QuotaThreshold[] = [
  {
    level: 'warning',
    percent: 80,
    message: 'Organization is approaching quota limits (80% utilization)',
  },
  {
    level: 'critical',
    percent: 90,
    message: 'Organization is critically close to quota limits (90% utilization)',
  },
  {
    level: 'exceeded',
    percent: 100,
    message: 'Organization has exceeded quota limits (100% utilization)',
  },
];

interface AlertState {
  organizationId: string;
  resourceType: 'cpu' | 'memory' | 'disk' | 'service_count';
  level: 'warning' | 'critical' | 'exceeded';
  lastAlertedAt: Date;
}

// In-memory cache of recent alerts to prevent spam
const recentAlerts = new Map<string, AlertState>();
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown between same alerts

export class QuotaAlertService {
  /**
   * Check all organizations for quota threshold violations
   * Called by background job every 30 seconds
   */
  static async checkAllOrganizationQuotas(): Promise<void> {
    try {
      const organizations = await QuotaService.getAllOrganizationQuotas();

      for (const org of organizations) {
        await this.checkOrganizationQuotaThresholds(
          org.id,
          org.name,
          org.utilization
        );
      }
    } catch (error) {
      console.error('Error checking organization quotas:', error);
    }
  }

  /**
   * Check quota thresholds for a specific organization
   */
  static async checkOrganizationQuotaThresholds(
    organizationId: string,
    organizationName: string,
    utilization: {
      cpu_percent: number;
      memory_percent: number;
      disk_percent: number;
      service_count_percent: number;
    }
  ): Promise<void> {
    // Check each resource type
    await this.checkResourceThreshold(
      organizationId,
      organizationName,
      'cpu',
      'CPU',
      utilization.cpu_percent
    );

    await this.checkResourceThreshold(
      organizationId,
      organizationName,
      'memory',
      'Memory',
      utilization.memory_percent
    );

    await this.checkResourceThreshold(
      organizationId,
      organizationName,
      'disk',
      'Disk',
      utilization.disk_percent
    );

    await this.checkResourceThreshold(
      organizationId,
      organizationName,
      'service_count',
      'Service Count',
      utilization.service_count_percent
    );
  }

  /**
   * Check threshold for a specific resource type
   */
  private static async checkResourceThreshold(
    organizationId: string,
    organizationName: string,
    resourceType: 'cpu' | 'memory' | 'disk' | 'service_count',
    resourceLabel: string,
    utilizationPercent: number
  ): Promise<void> {
    // Determine which threshold is crossed
    let crossedThreshold: QuotaThreshold | null = null;

    for (const threshold of QUOTA_THRESHOLDS.reverse()) {
      if (utilizationPercent >= threshold.percent) {
        crossedThreshold = threshold;
        break;
      }
    }

    if (!crossedThreshold) {
      // No threshold crossed, clear any existing alert state
      this.clearAlertState(organizationId, resourceType);
      return;
    }

    // Check if we've already alerted for this threshold recently
    const alertKey = `${organizationId}:${resourceType}:${crossedThreshold.level}`;
    const existingAlert = recentAlerts.get(alertKey);

    if (existingAlert) {
      const timeSinceLastAlert = Date.now() - existingAlert.lastAlertedAt.getTime();
      if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
        // Still in cooldown period, don't send another alert
        return;
      }
    }

    // Send alert
    await this.sendQuotaAlert(
      organizationId,
      organizationName,
      resourceType,
      resourceLabel,
      utilizationPercent,
      crossedThreshold
    );

    // Update alert state
    recentAlerts.set(alertKey, {
      organizationId,
      resourceType,
      level: crossedThreshold.level,
      lastAlertedAt: new Date(),
    });
  }

  /**
   * Send quota alert notification
   */
  private static async sendQuotaAlert(
    organizationId: string,
    organizationName: string,
    resourceType: string,
    resourceLabel: string,
    utilizationPercent: number,
    threshold: QuotaThreshold
  ): Promise<void> {
    const message = `${resourceLabel} quota ${threshold.level}: ${utilizationPercent.toFixed(1)}% utilized`;

    // Determine status based on threshold level
    const status = threshold.level === 'exceeded' ? 'error' : 'warning';

    // Get organization owner and admins to notify
    const usersResult = await query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 
         AND om.role IN ('owner', 'admin')`,
      [organizationId]
    );

    // Log activity for each user
    for (const user of usersResult.rows) {
      await logActivity({
        userId: user.id,
        organizationId,
        eventType: 'quota.threshold',
        entityType: 'organization',
        entityId: organizationId,
        message,
        status,
        metadata: {
          resource_type: resourceType,
          resource_label: resourceLabel,
          utilization_percent: utilizationPercent,
          threshold_level: threshold.level,
          threshold_percent: threshold.percent,
        },
      });
    }

    // Also notify platform administrators
    const adminsResult = await query(
      `SELECT id, email, name FROM users WHERE role = 'admin'`
    );

    for (const admin of adminsResult.rows) {
      await logActivity({
        userId: admin.id,
        organizationId,
        eventType: 'quota.threshold.admin',
        entityType: 'organization',
        entityId: organizationId,
        message: `Organization "${organizationName}": ${message}`,
        status,
        metadata: {
          organization_name: organizationName,
          resource_type: resourceType,
          resource_label: resourceLabel,
          utilization_percent: utilizationPercent,
          threshold_level: threshold.level,
          threshold_percent: threshold.percent,
        },
      });
    }

    console.log(
      `📊 Quota ${threshold.level} alert sent for ${organizationName}: ${resourceLabel} at ${utilizationPercent.toFixed(1)}%`
    );
  }

  /**
   * Clear alert state for a resource (when utilization drops below thresholds)
   */
  private static clearAlertState(
    organizationId: string,
    resourceType: string
  ): void {
    // Remove all alert states for this resource
    for (const threshold of QUOTA_THRESHOLDS) {
      const alertKey = `${organizationId}:${resourceType}:${threshold.level}`;
      recentAlerts.delete(alertKey);
    }
  }

  /**
   * Check if deployment would exceed quota and send immediate alert
   * Returns true if deployment should be blocked
   */
  static async checkAndAlertOnDeployment(
    organizationId: string,
    resourceLimits: {
      cpu_cores: number;
      memory_mb: number;
      disk_gb: number;
    }
  ): Promise<{ blocked: boolean; reason?: string }> {
    const quotaCheck = await QuotaService.checkQuotaBeforeDeployment(
      organizationId,
      resourceLimits
    );

    if (!quotaCheck.allowed) {
      // Get organization details
      const orgResult = await query(
        'SELECT name FROM organizations WHERE id = $1',
        [organizationId]
      );
      const organizationName = orgResult.rows[0]?.name || 'Unknown';

      // Send immediate alert about blocked deployment
      await this.sendDeploymentBlockedAlert(
        organizationId,
        organizationName,
        quotaCheck.reason,
        resourceLimits,
        quotaCheck.current_usage,
        quotaCheck.quota_limits
      );

      return {
        blocked: true,
        reason: quotaCheck.reason,
      };
    }

    return { blocked: false };
  }

  /**
   * Send alert when deployment is blocked due to quota
   */
  private static async sendDeploymentBlockedAlert(
    organizationId: string,
    organizationName: string,
    reason: string,
    requestedResources: any,
    currentUsage: any,
    quotaLimits: any
  ): Promise<void> {
    // Get organization owner and admins
    const usersResult = await query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 
         AND om.role IN ('owner', 'admin')`,
      [organizationId]
    );

    // Log activity for each user
    for (const user of usersResult.rows) {
      await logActivity({
        userId: user.id,
        organizationId,
        eventType: 'quota.deployment_blocked',
        entityType: 'organization',
        entityId: organizationId,
        message: `Deployment blocked: ${reason}`,
        status: 'error',
        metadata: {
          reason,
          requested_resources: requestedResources,
          current_usage: currentUsage,
          quota_limits: quotaLimits,
        },
      });
    }

    console.log(
      `🚫 Deployment blocked for ${organizationName}: ${reason}`
    );
  }

  /**
   * Handle quota violation with grace period
   * Called when a service exceeds quota after deployment
   */
  static async handleQuotaViolation(
    organizationId: string,
    serviceId: string,
    violationType: 'runtime' | 'billing',
    gracePeriodHours: number = 24
  ): Promise<void> {
    const gracePeriodEnd = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

    // Get organization and service details
    const orgResult = await query(
      'SELECT name FROM organizations WHERE id = $1',
      [organizationId]
    );
    const organizationName = orgResult.rows[0]?.name || 'Unknown';

    const serviceResult = await query(
      'SELECT name FROM container_services WHERE id = $1',
      [serviceId]
    );
    const serviceName = serviceResult.rows[0]?.name || 'Unknown';

    // Get organization members
    const usersResult = await query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 
         AND om.role IN ('owner', 'admin')`,
      [organizationId]
    );

    const message = `Service "${serviceName}" has exceeded quota limits. Grace period ends at ${gracePeriodEnd.toISOString()}. Please reduce resource usage or contact support to increase quotas.`;

    // Log activity for each user
    for (const user of usersResult.rows) {
      await logActivity({
        userId: user.id,
        organizationId,
        eventType: 'quota.violation',
        entityType: 'container_service',
        entityId: serviceId,
        message,
        status: 'error',
        metadata: {
          service_name: serviceName,
          violation_type: violationType,
          grace_period_hours: gracePeriodHours,
          grace_period_end: gracePeriodEnd.toISOString(),
        },
      });
    }

    console.log(
      `⚠️  Quota violation for ${organizationName}/${serviceName}: ${violationType} - Grace period until ${gracePeriodEnd.toISOString()}`
    );
  }

  /**
   * Get alert statistics for monitoring
   */
  static getAlertStatistics(): {
    totalAlerts: number;
    alertsByLevel: Record<string, number>;
    alertsByResource: Record<string, number>;
  } {
    const stats = {
      totalAlerts: recentAlerts.size,
      alertsByLevel: {} as Record<string, number>,
      alertsByResource: {} as Record<string, number>,
    };

    for (const alert of recentAlerts.values()) {
      // Count by level
      stats.alertsByLevel[alert.level] = (stats.alertsByLevel[alert.level] || 0) + 1;

      // Count by resource
      stats.alertsByResource[alert.resourceType] =
        (stats.alertsByResource[alert.resourceType] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear expired alerts from cache
   * Called periodically to prevent memory leaks
   */
  static clearExpiredAlerts(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, alert] of recentAlerts.entries()) {
      const timeSinceAlert = now - alert.lastAlertedAt.getTime();
      if (timeSinceAlert > ALERT_COOLDOWN_MS * 2) {
        // Clear alerts that are 2x the cooldown period old
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      recentAlerts.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleared ${expiredKeys.length} expired quota alerts from cache`);
    }
  }
}
