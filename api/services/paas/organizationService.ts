import { pool } from '../../lib/database.js';
import { logActivity } from '../activityLogger.js';
import { DeployerService } from './deployerService.js';

export class PaasOrganizationService {
  static async isSuspended(orgId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT paas_suspended FROM organizations WHERE id = $1',
      [orgId]
    );
    return Boolean(result.rows[0]?.paas_suspended);
  }

  static async assertActive(orgId: string): Promise<void> {
    if (await this.isSuspended(orgId)) {
      const reason = await this.getSuspendReason(orgId);
      const message = reason
        ? `PaaS access is suspended for this organization: ${reason}`
        : 'PaaS access is suspended for this organization.';
      const error = new Error(message);
      (error as any).statusCode = 403;
      throw error;
    }
  }

  static async suspend(orgId: string, actorUserId: string, reason?: string): Promise<void> {
    await pool.query(
      `UPDATE organizations
         SET paas_suspended = TRUE,
             paas_suspend_reason = $2,
             paas_suspended_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
      [orgId, reason || 'Suspended by administrator']
    );

    const apps = await pool.query(
      `SELECT id, name
         FROM paas_applications
        WHERE organization_id = $1
          AND status IN ('running', 'deploying', 'building')`,
      [orgId]
    );

    for (const app of apps.rows) {
      try {
        await DeployerService.stop(app.id);
      } catch (error) {
        console.warn(`Failed to stop app ${app.id} during suspension:`, error);
      }

      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['suspended', app.id]
      );
    }

    await logActivity({
      userId: actorUserId,
      organizationId: orgId,
      eventType: 'admin.paas.organization.suspend',
      entityType: 'organization',
      entityId: orgId,
      status: 'warning',
      message: `Organization PaaS suspended${reason ? `: ${reason}` : ''}`,
    });
  }

  static async resume(orgId: string, actorUserId: string): Promise<void> {
    await pool.query(
      `UPDATE organizations
         SET paas_suspended = FALSE,
             paas_suspend_reason = NULL,
             paas_suspended_at = NULL,
             updated_at = NOW()
       WHERE id = $1`,
      [orgId]
    );

    const apps = await pool.query(
      `SELECT id
         FROM paas_applications
        WHERE organization_id = $1
          AND status = 'suspended'`,
      [orgId]
    );

    for (const app of apps.rows) {
      try {
        await DeployerService.restart(app.id);
      } catch (error) {
        console.warn(`Failed to restart app ${app.id} during resume:`, error);
      }
    }

    await logActivity({
      userId: actorUserId,
      organizationId: orgId,
      eventType: 'admin.paas.organization.resume',
      entityType: 'organization',
      entityId: orgId,
      status: 'success',
      message: 'Organization PaaS access resumed',
    });
  }

  static async getSuspendReason(orgId: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT paas_suspend_reason FROM organizations WHERE id = $1',
      [orgId]
    );
    return result.rows[0]?.paas_suspend_reason || null;
  }
}
