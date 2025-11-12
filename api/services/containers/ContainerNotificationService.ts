import { logActivity } from '../activityLogger.js';
import { query } from '../../lib/database.js';

export type ContainerEventType =
  // Build events
  | 'build_started'
  | 'build_completed'
  | 'build_failed'
  // Deployment events
  | 'deployment_started'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'deployment_rollback'
  // Service events
  | 'service_started'
  | 'service_stopped'
  | 'service_crashed'
  | 'service_restarted'
  // Resource events
  | 'resource_limit_reached'
  | 'quota_warning'
  | 'quota_exceeded'
  // Worker events
  | 'worker_offline'
  | 'worker_unhealthy'
  | 'worker_recovered';

export interface ContainerNotificationOptions {
  userId: string;
  organizationId: string;
  eventType: ContainerEventType;
  entityType: 'container_service' | 'container_deployment' | 'container_build' | 'container_worker';
  entityId: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, any>;
}

/**
 * Service for sending container-related notifications
 * Integrates with existing PostgreSQL LISTEN/NOTIFY and SSE infrastructure
 */
export class ContainerNotificationService {
  /**
   * Send a container-related notification
   * Uses the existing activity logging system which triggers PostgreSQL NOTIFY
   */
  static async sendNotification(options: ContainerNotificationOptions): Promise<void> {
    try {
      await logActivity({
        userId: options.userId,
        organizationId: options.organizationId,
        eventType: options.eventType,
        entityType: options.entityType,
        entityId: options.entityId,
        message: options.message,
        status: options.status,
        metadata: options.metadata,
      });
    } catch (error) {
      console.error('Error sending container notification:', error);
    }
  }

  /**
   * Send build started notification
   */
  static async notifyBuildStarted(
    userId: string,
    organizationId: string,
    buildId: string,
    serviceId: string,
    serviceName: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'build_started',
      entityType: 'container_build',
      entityId: buildId,
      message: `Build started for service "${serviceName}"`,
      status: 'info',
      metadata: { serviceId, serviceName },
    });
  }

  /**
   * Send build completed notification
   */
  static async notifyBuildCompleted(
    userId: string,
    organizationId: string,
    buildId: string,
    serviceId: string,
    serviceName: string,
    durationSeconds: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'build_completed',
      entityType: 'container_build',
      entityId: buildId,
      message: `Build completed for service "${serviceName}" in ${durationSeconds}s`,
      status: 'success',
      metadata: { serviceId, serviceName, durationSeconds },
    });
  }

  /**
   * Send build failed notification
   */
  static async notifyBuildFailed(
    userId: string,
    organizationId: string,
    buildId: string,
    serviceId: string,
    serviceName: string,
    errorMessage: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'build_failed',
      entityType: 'container_build',
      entityId: buildId,
      message: `Build failed for service "${serviceName}": ${errorMessage}`,
      status: 'error',
      metadata: { serviceId, serviceName, errorMessage },
    });
  }

  /**
   * Send deployment started notification
   */
  static async notifyDeploymentStarted(
    userId: string,
    organizationId: string,
    deploymentId: string,
    serviceId: string,
    serviceName: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'deployment_started',
      entityType: 'container_deployment',
      entityId: deploymentId,
      message: `Deployment started for service "${serviceName}"`,
      status: 'info',
      metadata: { serviceId, serviceName },
    });
  }

  /**
   * Send deployment completed notification
   */
  static async notifyDeploymentCompleted(
    userId: string,
    organizationId: string,
    deploymentId: string,
    serviceId: string,
    serviceName: string,
    publicUrl?: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'deployment_completed',
      entityType: 'container_deployment',
      entityId: deploymentId,
      message: `Deployment completed for service "${serviceName}"${publicUrl ? ` at ${publicUrl}` : ''}`,
      status: 'success',
      metadata: { serviceId, serviceName, publicUrl },
    });
  }

  /**
   * Send deployment failed notification
   */
  static async notifyDeploymentFailed(
    userId: string,
    organizationId: string,
    deploymentId: string,
    serviceId: string,
    serviceName: string,
    errorMessage: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'deployment_failed',
      entityType: 'container_deployment',
      entityId: deploymentId,
      message: `Deployment failed for service "${serviceName}": ${errorMessage}`,
      status: 'error',
      metadata: { serviceId, serviceName, errorMessage },
    });
  }

  /**
   * Send deployment rollback notification
   */
  static async notifyDeploymentRollback(
    userId: string,
    organizationId: string,
    deploymentId: string,
    serviceId: string,
    serviceName: string,
    previousDeploymentId: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'deployment_rollback',
      entityType: 'container_deployment',
      entityId: deploymentId,
      message: `Service "${serviceName}" rolled back to previous deployment`,
      status: 'warning',
      metadata: { serviceId, serviceName, previousDeploymentId },
    });
  }

  /**
   * Send service started notification
   */
  static async notifyServiceStarted(
    userId: string,
    organizationId: string,
    serviceId: string,
    serviceName: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'service_started',
      entityType: 'container_service',
      entityId: serviceId,
      message: `Service "${serviceName}" started successfully`,
      status: 'success',
      metadata: { serviceName },
    });
  }

  /**
   * Send service stopped notification
   */
  static async notifyServiceStopped(
    userId: string,
    organizationId: string,
    serviceId: string,
    serviceName: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'service_stopped',
      entityType: 'container_service',
      entityId: serviceId,
      message: `Service "${serviceName}" stopped`,
      status: 'info',
      metadata: { serviceName },
    });
  }

  /**
   * Send service crashed notification
   */
  static async notifyServiceCrashed(
    userId: string,
    organizationId: string,
    serviceId: string,
    serviceName: string,
    errorMessage: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'service_crashed',
      entityType: 'container_service',
      entityId: serviceId,
      message: `Service "${serviceName}" crashed: ${errorMessage}`,
      status: 'error',
      metadata: { serviceName, errorMessage },
    });
  }

  /**
   * Send service restarted notification
   */
  static async notifyServiceRestarted(
    userId: string,
    organizationId: string,
    serviceId: string,
    serviceName: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'service_restarted',
      entityType: 'container_service',
      entityId: serviceId,
      message: `Service "${serviceName}" restarted`,
      status: 'info',
      metadata: { serviceName },
    });
  }

  /**
   * Send resource limit reached notification
   */
  static async notifyResourceLimitReached(
    userId: string,
    organizationId: string,
    serviceId: string,
    serviceName: string,
    resourceType: 'cpu' | 'memory' | 'disk',
    usagePercent: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'resource_limit_reached',
      entityType: 'container_service',
      entityId: serviceId,
      message: `Service "${serviceName}" ${resourceType.toUpperCase()} usage at ${usagePercent.toFixed(1)}%`,
      status: 'warning',
      metadata: { serviceName, resourceType, usagePercent },
    });
  }

  /**
   * Send quota warning notification
   */
  static async notifyQuotaWarning(
    userId: string,
    organizationId: string,
    resourceType: string,
    usagePercent: number,
    threshold: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'quota_warning',
      entityType: 'container_service',
      entityId: organizationId,
      message: `Organization ${resourceType} quota at ${usagePercent.toFixed(1)}% (threshold: ${threshold}%)`,
      status: 'warning',
      metadata: { resourceType, usagePercent, threshold },
    });
  }

  /**
   * Send quota exceeded notification
   */
  static async notifyQuotaExceeded(
    userId: string,
    organizationId: string,
    resourceType: string,
    usagePercent: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      organizationId,
      eventType: 'quota_exceeded',
      entityType: 'container_service',
      entityId: organizationId,
      message: `Organization ${resourceType} quota exceeded at ${usagePercent.toFixed(1)}%`,
      status: 'error',
      metadata: { resourceType, usagePercent },
    });
  }

  /**
   * Send worker offline notification (to admins)
   */
  static async notifyWorkerOffline(
    workerId: string,
    workerName: string
  ): Promise<void> {
    // Get all admin users
    const admins = await this.getAdminUsers();

    for (const admin of admins) {
      await this.sendNotification({
        userId: admin.id,
        organizationId: admin.organizationId || '',
        eventType: 'worker_offline',
        entityType: 'container_worker',
        entityId: workerId,
        message: `Worker "${workerName}" is offline`,
        status: 'error',
        metadata: { workerName },
      });
    }
  }

  /**
   * Send worker unhealthy notification (to admins)
   */
  static async notifyWorkerUnhealthy(
    workerId: string,
    workerName: string,
    reason: string
  ): Promise<void> {
    // Get all admin users
    const admins = await this.getAdminUsers();

    for (const admin of admins) {
      await this.sendNotification({
        userId: admin.id,
        organizationId: admin.organizationId || '',
        eventType: 'worker_unhealthy',
        entityType: 'container_worker',
        entityId: workerId,
        message: `Worker "${workerName}" is unhealthy: ${reason}`,
        status: 'warning',
        metadata: { workerName, reason },
      });
    }
  }

  /**
   * Send worker recovered notification (to admins)
   */
  static async notifyWorkerRecovered(
    workerId: string,
    workerName: string
  ): Promise<void> {
    // Get all admin users
    const admins = await this.getAdminUsers();

    for (const admin of admins) {
      await this.sendNotification({
        userId: admin.id,
        organizationId: admin.organizationId || '',
        eventType: 'worker_recovered',
        entityType: 'container_worker',
        entityId: workerId,
        message: `Worker "${workerName}" has recovered`,
        status: 'success',
        metadata: { workerName },
      });
    }
  }

  /**
   * Get all admin users for system notifications
   */
  private static async getAdminUsers(): Promise<Array<{ id: string; organizationId?: string }>> {
    try {
      const result = await query(
        `SELECT u.id, om.organization_id
         FROM users u
         LEFT JOIN organization_members om ON u.id = om.user_id
         WHERE u.role = 'admin'`
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  /**
   * Get service owner for notifications
   */
  static async getServiceOwner(serviceId: string): Promise<{ userId: string; organizationId: string } | null> {
    try {
      const result = await query(
        `SELECT o.owner_id as user_id, cs.organization_id
         FROM container_services cs
         JOIN organizations o ON cs.organization_id = o.id
         WHERE cs.id = $1`,
        [serviceId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        userId: result.rows[0].user_id,
        organizationId: result.rows[0].organization_id,
      };
    } catch (error) {
      console.error('Error fetching service owner:', error);
      return null;
    }
  }
}

export const containerNotificationService = ContainerNotificationService;
