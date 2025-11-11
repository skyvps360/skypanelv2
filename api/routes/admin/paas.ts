/**
 * PaaS Admin API Routes
 * Admin-only endpoints for managing PaaS infrastructure, settings, and all applications
 */

import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { pool } from '../../lib/database.js';
import { PaasSettingsService } from '../../services/paas/settingsService.js';
import { NodeManagerService } from '../../services/paas/nodeManagerService.js';
import { DeployerService } from '../../services/paas/deployerService.js';
import { SlugService } from '../../services/paas/slugService.js';
import { logActivity } from '../../services/activityLogger.js';
import { body, param, validationResult } from 'express-validator';
import { handlePaasApiError } from '../../utils/paasApiError.js';
import { PaasBillingService } from '../../services/paas/billingService.js';
import { PaasPlanService } from '../../services/paas/planService.js';

const router = express.Router();
const SENSITIVE_PLACEHOLDER = '***REDACTED***';
const APP_STATUSES = ['inactive', 'building', 'deploying', 'running', 'stopped', 'failed', 'suspended'];
const WORKER_STATUSES = ['provisioning', 'active', 'draining', 'down', 'unreachable'];

interface StatusCountRow {
  status: string;
  count: number | string;
}

const normalizeStatusCounts = (rows: StatusCountRow[], knownStatuses: string[]): StatusCountRow[] => {
  const normalized = knownStatuses.map((status) => {
    const row = rows.find((r) => r.status === status);
    return {
      status,
      count: row ? Number(row.count) : 0,
    };
  });

  const extraStatuses = rows.filter((row) => !knownStatuses.includes(row.status));
  for (const extra of extraStatuses) {
    normalized.push({
      status: extra.status,
      count: Number(extra.count ?? 0),
    });
  }

  return normalized;
};

const getStatusCount = (rows: StatusCountRow[], status: string): number =>
  Number(rows.find((row) => row.status === status)?.count ?? 0);

interface AdminActivityPayload {
  userId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

const logAdminPaasActivity = async (payload: AdminActivityPayload): Promise<void> => {
  const { userId, eventType, entityType, entityId, message, metadata } = payload;

  await logActivity({
    userId,
    eventType,
    entityType,
    entityId: entityId ?? null,
    metadata,
    message,
  });
};

const isSensitiveSettingKey = (key: string): boolean => {
  const lowered = key.toLowerCase();
  return (
    lowered.includes('secret') ||
    lowered.includes('token') ||
    lowered.includes('password') ||
    lowered.includes('key')
  );
};

// Apply authentication and admin middleware to all routes
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/paas/overview
 * Get PaaS system overview stats
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const applicationStatusResult = await pool.query(
      `SELECT status, COUNT(*)::int as count
       FROM paas_applications
       GROUP BY status`
    );
    const applicationStats = normalizeStatusCounts(applicationStatusResult.rows, APP_STATUSES);
    const totalApplications = applicationStats.reduce((sum, row) => sum + Number(row.count), 0);
    const runningApplications = getStatusCount(applicationStats, 'running');

    const deploymentsResult = await pool.query(
      `SELECT
        COALESCE(COUNT(*), 0)::int as total,
        COALESCE(COUNT(*) FILTER (WHERE status = 'deployed'), 0)::int as deployed,
        COALESCE(COUNT(*) FILTER (WHERE status = 'failed' OR status = 'build_failed'), 0)::int as failed
       FROM paas_deployments
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    const deployments = deploymentsResult.rows[0] ?? { total: 0, deployed: 0, failed: 0 };

    const capacityResult = await pool.query(
      `SELECT
        COALESCE(SUM(COALESCE(p.cpu_cores, 0) * GREATEST(COALESCE(a.replicas, 1), 1)), 0)::float as total_cpu,
        COALESCE(SUM(COALESCE(p.ram_mb, 0) * GREATEST(COALESCE(a.replicas, 1), 1)), 0)::float as total_ram_mb
       FROM paas_applications a
       LEFT JOIN paas_plans p ON p.id = a.plan_id
       WHERE a.status IN ('running', 'deploying', 'building')`
    );
    const billingResult = await pool.query(
      `SELECT
        COALESCE(SUM(total_cost), 0)::float as total_cost_today
       FROM paas_resource_usage
       WHERE (
        (billed_at IS NOT NULL AND billed_at >= NOW() - INTERVAL '24 hours')
        OR (billed_at IS NULL AND period_end >= NOW() - INTERVAL '24 hours')
       )`
    );
    const resourceUsage = {
      total_cpu: Number(capacityResult.rows[0]?.total_cpu ?? 0),
      total_ram_mb: Number(capacityResult.rows[0]?.total_ram_mb ?? 0),
      total_cost_today: Number(billingResult.rows[0]?.total_cost_today ?? 0),
    };

    const nodesResult = await pool.query(
      `SELECT status, COUNT(*)::int as count
       FROM paas_worker_nodes
       GROUP BY status`
    );
    const workerNodes = normalizeStatusCounts(nodesResult.rows, WORKER_STATUSES);
    const activeWorkers = getStatusCount(workerNodes, 'active');

    res.json({
      applications: applicationStats,
      deployments,
      resource_usage: resourceUsage,
      worker_nodes: workerNodes,
      summary: {
        total_applications: totalApplications,
        running_applications: runningApplications,
        active_workers: activeWorkers,
      },
    });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS overview',
      clientMessage: 'Failed to get overview',
    });
  }
});

/**
 * GET /api/admin/paas/apps
 * List all applications across all organizations
 */
router.get('/apps', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';

    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause = `WHERE (a.name ILIKE $${paramIndex} OR o.name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ` a.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM paas_applications a
       JOIN organizations o ON a.organization_id = o.id
       ${whereClause}`,
      queryParams
    );
    const totalApps = parseInt(countResult.rows[0].count);

    // Get paginated apps
    const result = await pool.query(
      `SELECT
        a.*,
        o.name as organization_name,
        p.name as plan_name,
        p.cpu_cores,
        p.ram_mb
       FROM paas_applications a
       JOIN organizations o ON a.organization_id = o.id
       LEFT JOIN paas_plans p ON a.plan_id = p.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    res.json({
      apps: result.rows,
      pagination: {
        page,
        limit,
        total: totalApps,
        totalPages: Math.ceil(totalApps / limit)
      }
    });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list all apps',
      clientMessage: 'Failed to list applications',
    });
  }
});

/**
 * POST /api/admin/paas/apps/:id/suspend
 * Suspend an application
 */
router.post('/apps/:id/suspend', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const appId = req.params.id;

    // Get application details
    const appResult = await pool.query(
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Stop the Docker Swarm service
    try {
      await DeployerService.stop(appId);
    } catch (error) {
      console.error('Failed to stop Docker service:', error);
      // Continue even if Docker stop fails - at least update the status
    }

    // Update database status
    await pool.query(
      'UPDATE paas_applications SET status = $1 WHERE id = $2',
      ['suspended', appId]
    );

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.app.suspend',
      entityType: 'paas_app',
      entityId: appId,
      metadata: { appName: app.name },
      message: `Suspended ${app.name}`,
    });

    res.json({ message: 'Application suspended' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to suspend PaaS application',
      clientMessage: 'Failed to suspend application',
    });
  }
});

/**
 * POST /api/admin/paas/apps/:id/resume
 * Resume a suspended application
 */
router.post('/apps/:id/resume', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const appId = req.params.id;

    // Get application and latest deployment
    const appResult = await pool.query(
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Get the latest successful deployment
    const deploymentResult = await pool.query(
      'SELECT id FROM paas_deployments WHERE application_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [appId, 'deployed']
    );

    if (deploymentResult.rows.length === 0) {
      // No deployment exists, just update status to allow user to deploy
      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['stopped', appId]
      );
    } else {
      // Redeploy the latest deployment
      try {
        await DeployerService.deploy({
          deploymentId: deploymentResult.rows[0].id,
          replicas: app.replicas,
        });

        await pool.query(
          'UPDATE paas_applications SET status = $1 WHERE id = $2',
          ['running', appId]
        );
      } catch (error) {
        console.error('Failed to redeploy app:', error);
        // Update to stopped state so user can manually deploy
        await pool.query(
          'UPDATE paas_applications SET status = $1 WHERE id = $2',
          ['stopped', appId]
        );
      }
    }

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.app.resume',
      entityType: 'paas_app',
      entityId: appId,
      metadata: { appName: app.name },
      message: `Resumed ${app.name}`,
    });

    res.json({ message: 'Application resumed' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to resume PaaS application',
      clientMessage: 'Failed to resume application',
    });
  }
});

/**
 * DELETE /api/admin/paas/apps/:id
 * Delete an application (admin only)
 */
router.delete('/apps/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const appId = req.params.id;

    // Get application details
    const appResult = await pool.query(
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Remove runtime service/network and artifacts
    try {
      await DeployerService.delete(appId);
    } catch (error) {
      console.error('Failed to remove Swarm service/network during delete:', error);
      // Continue even if Docker removal fails — DB delete will still proceed
    }

    try {
      await SlugService.deleteAppSlugs(appId);
    } catch (error) {
      console.warn('Failed to delete slug artifacts during delete:', error);
      // Non-blocking
    }

    // Delete the application (child tables use ON DELETE CASCADE)
    await pool.query('DELETE FROM paas_applications WHERE id = $1', [appId]);

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.app.delete',
      entityType: 'paas_app',
      entityId: appId,
      metadata: { appName: app.name, organizationId: app.organization_id },
      message: `Deleted application ${app.name}`,
    });

    res.json({ message: 'Application deleted successfully' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to delete PaaS application',
      clientMessage: 'Failed to delete application',
    });
  }
});

/**
 * PATCH /api/admin/paas/apps/:id/plan
 * Reassign plan for an application
 */
router.patch('/apps/:id/plan',
  param('id').isUUID(),
  body('plan_id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const appId = req.params.id;
      const { plan_id } = req.body;

      // Check if application exists
      const appResult = await pool.query(
        'SELECT * FROM paas_applications WHERE id = $1',
        [appId]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const app = appResult.rows[0];

      // Check if plan exists
      const planResult = await pool.query(
        'SELECT * FROM paas_plans WHERE id = $1 AND is_active = true',
        [plan_id]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found or inactive' });
      }

      const newPlan = planResult.rows[0];
      const oldPlanResult = await pool.query(
        'SELECT name FROM paas_plans WHERE id = $1',
        [app.plan_id]
      );
      const oldPlanName = oldPlanResult.rows[0]?.name || 'Unknown';

      // Update the plan
      await pool.query(
        'UPDATE paas_applications SET plan_id = $1, updated_at = NOW() WHERE id = $2',
        [plan_id, appId]
      );

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.app.plan_change',
        entityType: 'paas_app',
        entityId: appId,
        metadata: {
          appName: app.name,
          oldPlan: oldPlanName,
          newPlan: newPlan.name
        },
        message: `Changed plan for ${app.name} from ${oldPlanName} to ${newPlan.name}`,
      });

      res.json({
        message: 'Plan updated successfully',
        plan: newPlan
      });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update app plan',
        clientMessage: 'Failed to update plan',
      });
    }
});

/**
 * POST /api/admin/paas/apps/bulk-action
 * Perform bulk actions on applications
 */
router.post('/apps/bulk-action',
  body('app_ids').isArray({ min: 1 }),
  body('action').isIn(['suspend', 'resume', 'delete']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { app_ids, action } = req.body;

      const results = {
        success: [] as string[],
        failed: [] as { id: string; error: string }[]
      };

      for (const appId of app_ids) {
        try {
          if (action === 'suspend') {
            await DeployerService.stop(appId);
            await pool.query(
              'UPDATE paas_applications SET status = $1 WHERE id = $2',
              ['suspended', appId]
            );
          } else if (action === 'resume') {
            const appResult = await pool.query(
              'SELECT * FROM paas_applications WHERE id = $1',
              [appId]
            );
            if (appResult.rows.length > 0) {
              const app = appResult.rows[0];
              const deploymentResult = await pool.query(
                'SELECT id FROM paas_deployments WHERE application_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
                [appId, 'deployed']
              );

              if (deploymentResult.rows.length > 0) {
                await DeployerService.deploy({
                  deploymentId: deploymentResult.rows[0].id,
                  replicas: app.replicas,
                });
                await pool.query(
                  'UPDATE paas_applications SET status = $1 WHERE id = $2',
                  ['running', appId]
                );
              }
            }
          } else if (action === 'delete') {
            await DeployerService.stop(appId);
            await pool.query('DELETE FROM paas_deployments WHERE application_id = $1', [appId]);
            await pool.query('DELETE FROM paas_environment_vars WHERE application_id = $1', [appId]);
            await pool.query('DELETE FROM paas_resource_usage WHERE application_id = $1', [appId]);
            await pool.query('DELETE FROM paas_applications WHERE id = $1', [appId]);
          }

          results.success.push(appId);
        } catch (error: any) {
          results.failed.push({
            id: appId,
            error: error.message || 'Unknown error'
          });
        }
      }

      await logAdminPaasActivity({
        userId,
        eventType: `admin.paas.app.bulk_${action}`,
        entityType: 'paas_app',
        entityId: 'bulk',
        metadata: {
          action,
          totalApps: app_ids.length,
          successCount: results.success.length,
          failedCount: results.failed.length
        },
        message: `Bulk ${action}: ${results.success.length} succeeded, ${results.failed.length} failed`,
      });

      res.json(results);
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to perform bulk action',
        clientMessage: 'Bulk action failed',
      });
    }
});

/**
 * POST /api/admin/paas/apps/create
 * Create an application with admin overrides (organization selection, custom pricing)
 */
router.post('/apps/create',
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('slug').trim().matches(/^[a-z0-9-]+$/),
  body('plan_id').isUUID(),
  body('organization_id').optional().isUUID(),
  body('custom_price_per_hour').optional().isFloat({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const {
        name,
        slug,
        git_url,
        git_branch,
        buildpack,
        plan_id,
        organization_id,
        custom_price_per_hour
      } = req.body;

      // If organization_id is provided, use it; otherwise use admin's organization
      let targetOrgId = organization_id;
      if (!targetOrgId) {
        const adminResult = await pool.query(
          'SELECT organization_id FROM users WHERE id = $1',
          [userId]
        );
        if (adminResult.rows.length === 0 || !adminResult.rows[0].organization_id) {
          return res.status(400).json({ error: 'No organization specified and admin has no organization' });
        }
        targetOrgId = adminResult.rows[0].organization_id;
      }

      // Check if organization exists
      const orgResult = await pool.query(
        'SELECT id FROM organizations WHERE id = $1',
        [targetOrgId]
      );
      if (orgResult.rows.length === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Check if plan exists
      const planResult = await pool.query(
        'SELECT * FROM paas_plans WHERE id = $1',
        [plan_id]
      );
      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      // Check if slug is unique within organization
      const existingSlug = await pool.query(
        'SELECT id FROM paas_applications WHERE organization_id = $1 AND slug = $2',
        [targetOrgId, slug]
      );
      if (existingSlug.rows.length > 0) {
        return res.status(400).json({ error: 'An application with this slug already exists in the organization' });
      }

      // Create the application
      const appResult = await pool.query(
        `INSERT INTO paas_applications
        (organization_id, name, slug, git_url, git_branch, buildpack, plan_id, status, replicas, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`,
        [
          targetOrgId,
          name,
          slug,
          git_url || null,
          git_branch || 'main',
          buildpack || null,
          plan_id,
          'inactive',
          1
        ]
      );

      const app = appResult.rows[0];

      // If custom pricing is specified, record it
      if (custom_price_per_hour !== undefined) {
        await pool.query(
          `INSERT INTO paas_app_pricing_overrides
          (application_id, custom_price_per_hour, created_by, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (application_id)
          DO UPDATE SET custom_price_per_hour = $2, updated_at = NOW()`,
          [app.id, custom_price_per_hour, userId]
        );
      }

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.app.create',
        entityType: 'paas_app',
        entityId: app.id,
        metadata: {
          appName: name,
          organizationId: targetOrgId,
          customPricing: custom_price_per_hour || null
        },
        message: `Created application ${name} for organization ${targetOrgId}`,
      });

      res.status(201).json({ app });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to create PaaS application (admin)',
        clientMessage: 'Failed to create application',
      });
    }
});

/**
 * GET /api/admin/paas/workers
 * List all worker nodes
 */
router.get('/workers', async (req: Request, res: Response) => {
  try {
    const statuses = await NodeManagerService.getNodeStatuses();
    res.json({ workers: statuses });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get worker nodes',
      clientMessage: 'Failed to get worker nodes',
    });
  }
});

/**
 * POST /api/admin/paas/workers
 * Add a new worker node
 */
router.post(
  '/workers',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('ip_address').isIP(),
    body('ssh_port').optional().isInt({ min: 1, max: 65535 }),
    body('ssh_user').optional().trim().isLength({ min: 1, max: 100 }),
    body('ssh_key').optional().isString(),
    body('auto_provision').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { name, ip_address, ssh_port, ssh_user, ssh_key, auto_provision } = req.body;

      const nodeId = await NodeManagerService.addWorkerNode({
        name,
        ipAddress: ip_address,
        sshPort: ssh_port,
        sshUser: ssh_user,
        sshKey: ssh_key,
        autoProvision: auto_provision,
      });

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.worker.add',
        entityType: 'paas_worker',
        entityId: nodeId,
        metadata: { name, ip_address },
      });

      res.status(201).json({ message: 'Worker node added', nodeId });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to add worker node',
        clientMessage: (error as Error)?.message || 'Failed to add worker node',
      });
    }
  }
);

/**
 * DELETE /api/admin/paas/workers/:id
 * Remove a worker node
 */
router.delete('/workers/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const nodeId = req.params.id;

    await NodeManagerService.removeNode(nodeId);

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.worker.remove',
      entityType: 'paas_worker',
      entityId: nodeId,
    });

    res.json({ message: 'Worker node removed' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to remove worker node',
      clientMessage: (error as Error)?.message || 'Failed to remove worker node',
    });
  }
});

/**
 * POST /api/admin/paas/swarm/init
 * Initialize Docker Swarm
 */
router.post('/swarm/init', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const swarmConfig = await NodeManagerService.initializeSwarm();

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.swarm.init',
      entityType: 'paas_swarm',
    });

    res.json({
      message: 'Swarm initialized',
      managerIp: swarmConfig.managerIp,
    });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to initialize Swarm',
      clientMessage: (error as Error)?.message || 'Failed to initialize Swarm',
    });
  }
});

/**
 * GET /api/admin/paas/settings
 * Get all PaaS settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await PaasSettingsService.getAll(false); // Don't include sensitive values
    res.json({ settings });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS settings',
      clientMessage: 'Failed to get settings',
    });
  }
});

/**
 * PUT /api/admin/paas/settings
 * Update PaaS settings
 */
router.put(
  '/settings',
  body('settings').isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const incomingSettings = req.body.settings || {};

      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(incomingSettings)) {
        if (value === undefined) continue;
        if (typeof value === 'string' && value === SENSITIVE_PLACEHOLDER) {
          continue;
        }
        updates[key] = value;
      }

      const keysToUpdate = Object.keys(updates);
      if (keysToUpdate.length === 0) {
        return res.json({ message: 'No changes detected' });
      }

      const optionsMap: Record<string, any> = {};
      for (const key of keysToUpdate) {
        if (isSensitiveSettingKey(key)) {
          optionsMap[key] = { is_sensitive: true };
        }
      }

      await PaasSettingsService.updateSettings(updates, optionsMap);

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.settings.update',
        entityType: 'paas_settings',
        metadata: {
          keys_updated: keysToUpdate,
        },
      });

      res.json({ message: 'Settings updated' });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update PaaS settings',
        clientMessage: 'Failed to update settings',
      });
    }
  }
);

/**
 * POST /api/admin/paas/settings/validate
 * Validate external dependencies (S3, Loki, Swarm)
 */
router.post('/settings/validate', async (req: Request, res: Response) => {
  try {
    const diagnostics = await PaasSettingsService.runDiagnostics();

    const swarm = await NodeManagerService.validateSwarmConnectivity()
      .then((details) => ({
        ok: true,
        details,
      }))
      .catch((error: any) => ({
        ok: false,
        details: error?.message || 'Failed to validate Swarm connectivity',
      }));

    res.json({
      validation: {
        storage: diagnostics.storage,
        logging: diagnostics.logging,
        swarm,
      },
    });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to validate PaaS settings',
      clientMessage: 'Failed to validate settings',
    });
  }
});

/**
 * GET /api/admin/paas/plans
 * Get all PaaS plans (including inactive)
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await PaasPlanService.getAdminPlans();
    res.json({ plans });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS plans',
      clientMessage: 'Failed to get plans',
    });
  }
});

/**
 * POST /api/admin/paas/plans
 * Create a new PaaS plan
 */
router.post(
  '/plans',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('slug').trim().matches(/^[a-z0-9-]+$/),
    body('cpu_cores').isFloat({ min: 0.1 }),
    body('ram_mb').isInt({ min: 128 }),
    body('disk_gb').isInt({ min: 1 }),
    body('max_replicas').isInt({ min: 1 }),
    body('price_per_hour').isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { name, slug, cpu_cores, ram_mb, disk_gb, max_replicas, price_per_hour, features } = req.body;
      const pricing = PaasPlanService.calculatePricing(Number(price_per_hour));
      const featuresPayload = features || {};

      const result = await pool.query(
        `INSERT INTO paas_plans (name, slug, cpu_cores, ram_mb, disk_gb, max_replicas, price_per_hour, price_per_month, hourly_rate, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name,
          slug,
          cpu_cores,
          ram_mb,
          disk_gb,
          max_replicas,
          pricing.price_per_hour,
          pricing.price_per_month,
          pricing.hourly_rate,
          featuresPayload,
        ]
      );

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.plan.create',
        entityType: 'paas_plan',
        entityId: result.rows[0].id,
        metadata: { name, slug },
      });

      res.status(201).json({ plan: PaasPlanService.formatPlanRow(result.rows[0]) });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to create PaaS plan',
        clientMessage: 'Failed to create plan',
      });
    }
  }
);

/**
 * PATCH /api/admin/paas/plans/:id
 * Update a PaaS plan
 */
router.patch(
  '/plans/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('cpu_cores').optional().isFloat({ min: 0.1 }),
    body('ram_mb').optional().isInt({ min: 128 }),
    body('disk_gb').optional().isInt({ min: 1 }),
    body('max_replicas').optional().isInt({ min: 1 }),
    body('price_per_hour').optional().isFloat({ min: 0 }),
    body('is_active').optional().isBoolean(),
    body('features').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const planId = req.params.id;
      const incoming = req.body;

      const allowedFields = [
        'name',
        'cpu_cores',
        'ram_mb',
        'disk_gb',
        'max_replicas',
        'price_per_hour',
        'is_active',
        'features',
      ];

      const resolvedUpdates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (incoming[field] !== undefined) {
          resolvedUpdates[field] = incoming[field];
        }
      }

      if (resolvedUpdates.price_per_hour !== undefined) {
        const pricing = PaasPlanService.calculatePricing(Number(resolvedUpdates.price_per_hour));
        resolvedUpdates.price_per_hour = pricing.price_per_hour;
        resolvedUpdates.price_per_month = pricing.price_per_month;
        resolvedUpdates.hourly_rate = pricing.hourly_rate;
      }

      if (Object.keys(resolvedUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      for (const [field, value] of Object.entries(resolvedUpdates)) {
        setClauses.push(`${field} = $${paramCount++}`);
        values.push(value);
      }

      values.push(planId);

      const result = await pool.query(
        `UPDATE paas_plans SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.plan.update',
        entityType: 'paas_plan',
        entityId: planId,
        metadata: resolvedUpdates,
      });

      res.json({ plan: PaasPlanService.formatPlanRow(result.rows[0]) });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update PaaS plan',
        clientMessage: 'Failed to update plan',
      });
    }
  }
);

/**
 * DELETE /api/admin/paas/plans/:id
 * Delete a PaaS plan
 */
router.delete('/plans/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const planId = req.params.id;

    // Check if plan is in use
    const inUse = await pool.query(
      'SELECT COALESCE(COUNT(*), 0)::int as count FROM paas_applications WHERE plan_id = $1',
      [planId]
    );

    const planUsageCount = Number(inUse.rows[0]?.count ?? 0);

    if (planUsageCount > 0) {
      return res.status(400).json({ error: 'Cannot delete plan that is in use by applications' });
    }

    await pool.query('DELETE FROM paas_plans WHERE id = $1', [planId]);

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.plan.delete',
      entityType: 'paas_plan',
      entityId: planId,
    });

    res.json({ message: 'Plan deleted' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to delete PaaS plan',
      clientMessage: 'Failed to delete plan',
    });
  }
});

/**
 * GET /api/admin/paas/billing
 * Get global billing overview
 */
router.get('/billing', async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const overview = await PaasBillingService.getAdminBillingOverview(range);
    res.json({ billing: overview });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS billing overview',
      clientMessage: 'Failed to get billing overview',
    });
  }
});

/**
 * GET /api/admin/paas/usage
 * Get resource usage statistics
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        DATE_TRUNC('hour', recorded_at) as hour,
        COALESCE(SUM(cpu_hours), 0)::float as total_cpu_hours,
        COALESCE(SUM(ram_mb_hours), 0)::float as total_ram_mb_hours,
        COALESCE(SUM(total_cost), 0)::float as total_cost
       FROM paas_resource_usage
       WHERE recorded_at > NOW() - INTERVAL '7 days'
       GROUP BY hour
       ORDER BY hour DESC`
    );

    res.json({ usage: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS usage statistics',
      clientMessage: 'Failed to get usage statistics',
    });
  }
});

/**
 * GET /api/admin/paas/usage/report
 * Detailed usage report for organizations and applications
 */
router.get('/usage/report', async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const report = await PaasBillingService.getUsageReport(range);
    res.json(report);
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get detailed PaaS usage report',
      clientMessage: 'Failed to get usage report',
    });
  }
});

/**
 * GET /api/admin/paas/usage/report/export
 * Export usage report as CSV
 */
router.get('/usage/report/export', async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const typeParam = (req.query.type as string) || 'organization';
    const type = typeParam === 'application' ? 'application' : 'organization';

    const csv = await PaasBillingService.exportUsageReport(range, type);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paas-usage-${type}-${range}.csv"`);
    res.send(csv);
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to export PaaS usage report',
      clientMessage: 'Failed to export usage report',
    });
  }
});

/**
 * GET /api/admin/paas/marketplace/templates
 * Get all marketplace templates (including inactive)
 */
router.get('/marketplace/templates', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM paas_marketplace_templates ORDER BY is_featured DESC, created_at DESC`
    );
    res.json({ templates: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list marketplace templates (admin)',
      clientMessage: 'Failed to load templates',
    });
  }
});

/**
 * POST /api/admin/paas/marketplace/templates
 * Create a new marketplace template
 */
router.post('/marketplace/templates',
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('slug').trim().matches(/^[a-z0-9-]+$/),
  body('category').trim().isLength({ min: 1 }),
  body('git_url').isURL(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const {
        name,
        slug,
        description,
        category,
        icon_url,
        git_url,
        git_branch,
        buildpack,
        default_env_vars,
        required_addons,
        recommended_plan_slug,
        min_cpu_cores,
        min_ram_mb,
        is_featured
      } = req.body;

      const result = await pool.query(
        `INSERT INTO paas_marketplace_templates
        (name, slug, description, category, icon_url, git_url, git_branch, buildpack,
         default_env_vars, required_addons, recommended_plan_slug, min_cpu_cores, min_ram_mb,
         is_featured, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *`,
        [
          name,
          slug,
          description || null,
          category,
          icon_url || null,
          git_url,
          git_branch || 'main',
          buildpack || null,
          JSON.stringify(default_env_vars || {}),
          JSON.stringify(required_addons || []),
          recommended_plan_slug || null,
          min_cpu_cores || 1,
          min_ram_mb || 512,
          is_featured || false,
          userId
        ]
      );

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.marketplace.template.create',
        entityType: 'marketplace_template',
        entityId: result.rows[0].id,
        metadata: { name, slug },
        message: `Created marketplace template: ${name}`,
      });

      res.status(201).json({ template: result.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to create marketplace template',
        clientMessage: 'Failed to create template',
      });
    }
});

/**
 * PATCH /api/admin/paas/marketplace/templates/:id
 * Update a marketplace template
 */
router.patch('/marketplace/templates/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { id } = req.params;
      const updates = req.body;

      const fields = [];
      const values = [];
      let paramIndex = 1;

      const allowedFields = [
        'name', 'description', 'category', 'icon_url', 'git_url', 'git_branch',
        'buildpack', 'default_env_vars', 'required_addons', 'recommended_plan_slug',
        'min_cpu_cores', 'min_ram_mb', 'is_active', 'is_featured'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          fields.push(`${field} = $${paramIndex}`);
          values.push(
            (field === 'default_env_vars' || field === 'required_addons')
              ? JSON.stringify(updates[field])
              : updates[field]
          );
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await pool.query(
        `UPDATE paas_marketplace_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.marketplace.template.update',
        entityType: 'marketplace_template',
        entityId: id,
        metadata: { templateName: result.rows[0].name },
        message: `Updated marketplace template: ${result.rows[0].name}`,
      });

      res.json({ template: result.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update marketplace template',
        clientMessage: 'Failed to update template',
      });
    }
});

/**
 * DELETE /api/admin/paas/marketplace/templates/:id
 * Delete a marketplace template
 */
router.delete('/marketplace/templates/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM paas_marketplace_templates WHERE id = $1 RETURNING name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.marketplace.template.delete',
      entityType: 'marketplace_template',
      entityId: id,
      metadata: { templateName: result.rows[0].name },
      message: `Deleted marketplace template: ${result.rows[0].name}`,
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to delete marketplace template',
      clientMessage: 'Failed to delete template',
    });
  }
});

/**
 * GET /api/admin/paas/marketplace/addons
 * Get all marketplace addons (including inactive)
 */
router.get('/marketplace/addons', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM paas_marketplace_addons ORDER BY addon_type, name'
    );
    // Ensure numeric fields are returned as numbers
    const addons = result.rows.map((row: any) => ({
      ...row,
      price_per_hour: Number(row.price_per_hour),
    }));
    res.json({ addons });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list marketplace addons (admin)',
      clientMessage: 'Failed to load addons',
    });
  }
});

/**
 * POST /api/admin/paas/marketplace/addons
 * Create a new marketplace addon
 */
router.post('/marketplace/addons',
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('slug').trim().matches(/^[a-z0-9-]+$/),
  body('addon_type').trim().isLength({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const {
        name,
        slug,
        description,
        addon_type,
        provider,
        config_template,
        default_env_vars,
        price_per_hour
      } = req.body;

      const result = await pool.query(
        `INSERT INTO paas_marketplace_addons
        (name, slug, description, addon_type, provider, config_template, default_env_vars, price_per_hour, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`,
        [
          name,
          slug,
          description || null,
          addon_type,
          provider || 'internal',
          JSON.stringify(config_template || {}),
          JSON.stringify(default_env_vars || {}),
          price_per_hour || 0
        ]
      );

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.marketplace.addon.create',
        entityType: 'marketplace_addon',
        entityId: result.rows[0].id,
        metadata: { name, slug },
        message: `Created marketplace addon: ${name}`,
      });

      res.status(201).json({ addon: result.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to create marketplace addon',
        clientMessage: 'Failed to create addon',
      });
    }
});

/**
 * PATCH /api/admin/paas/marketplace/addons/:id
 * Update a marketplace addon
 */
router.patch('/marketplace/addons/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const { id } = req.params;
      const updates = req.body;

      const fields = [];
      const values = [];
      let paramIndex = 1;

      const allowedFields = [
        'name', 'description', 'addon_type', 'provider', 'config_template',
        'default_env_vars', 'price_per_hour', 'is_active'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          fields.push(`${field} = $${paramIndex}`);
          values.push(
            (field === 'config_template' || field === 'default_env_vars')
              ? JSON.stringify(updates[field])
              : updates[field]
          );
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await pool.query(
        `UPDATE paas_marketplace_addons SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Addon not found' });
      }

      await logAdminPaasActivity({
        userId,
        eventType: 'admin.paas.marketplace.addon.update',
        entityType: 'marketplace_addon',
        entityId: id,
        metadata: { addonName: result.rows[0].name },
        message: `Updated marketplace addon: ${result.rows[0].name}`,
      });

      res.json({ addon: result.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update marketplace addon',
        clientMessage: 'Failed to update addon',
      });
    }
});

/**
 * DELETE /api/admin/paas/marketplace/addons/:id
 * Delete a marketplace addon
 */
router.delete('/marketplace/addons/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM paas_marketplace_addons WHERE id = $1 RETURNING name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Addon not found' });
    }

    await logAdminPaasActivity({
      userId,
      eventType: 'admin.paas.marketplace.addon.delete',
      entityType: 'marketplace_addon',
      entityId: id,
      metadata: { addonName: result.rows[0].name },
      message: `Deleted marketplace addon: ${result.rows[0].name}`,
    });

    res.json({ message: 'Addon deleted successfully' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to delete marketplace addon',
      clientMessage: 'Failed to delete addon',
    });
  }
});

export default router;
