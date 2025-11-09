/**
 * PaaS Admin API Routes
 * Admin-only endpoints for managing PaaS infrastructure, settings, and all applications
 */

import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { pool } from '../lib/database.js';
import { PaasSettingsService } from '../services/paas/settingsService.js';
import { NodeManagerService } from '../services/paas/nodeManagerService.js';
import { DeployerService } from '../services/paas/deployerService.js';
import { logActivity } from '../services/activityLogger.js';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/paas/overview
 * Get PaaS system overview stats
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    // Total applications
    const appsResult = await pool.query(
      'SELECT COUNT(*) as total, status, COUNT(*) FILTER (WHERE status = \'running\') as running FROM paas_applications GROUP BY status'
    );

    // Total deployments today
    const deploymentsResult = await pool.query(
      'SELECT COUNT(*) as total FROM paas_deployments WHERE created_at > NOW() - INTERVAL \'24 hours\''
    );

    // Total resource usage
    const usageResult = await pool.query(
      `SELECT
        SUM(cpu_cores * replicas) as total_cpu,
        SUM(ram_mb * replicas) as total_ram_mb,
        SUM(cost) as total_cost_today
       FROM paas_resource_usage
       WHERE recorded_at > NOW() - INTERVAL \'24 hours\'`
    );

    // Worker node stats
    const nodesResult = await pool.query(
      'SELECT COUNT(*) as total, status FROM paas_worker_nodes GROUP BY status'
    );

    res.json({
      applications: appsResult.rows,
      deployments: deploymentsResult.rows[0],
      resource_usage: usageResult.rows[0],
      worker_nodes: nodesResult.rows,
    });
  } catch (error: any) {
    console.error('Failed to get PaaS overview:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

/**
 * GET /api/admin/paas/apps
 * List all applications across all organizations
 */
router.get('/apps', async (req: Request, res: Response) => {
  try {
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
       ORDER BY a.created_at DESC
       LIMIT 100`
    );

    res.json({ apps: result.rows });
  } catch (error: any) {
    console.error('Failed to list all apps:', error);
    res.status(500).json({ error: 'Failed to list applications' });
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

    await logActivity({
      userId,
      action: 'admin.paas.app.suspend',
      resource: `paas:app:${appId}`,
      details: { appName: app.name },
    });

    res.json({ message: 'Application suspended' });
  } catch (error: any) {
    console.error('Failed to suspend app:', error);
    res.status(500).json({ error: 'Failed to suspend application' });
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

    await logActivity({
      userId,
      action: 'admin.paas.app.resume',
      resource: `paas:app:${appId}`,
      details: { appName: app.name },
    });

    res.json({ message: 'Application resumed' });
  } catch (error: any) {
    console.error('Failed to resume app:', error);
    res.status(500).json({ error: 'Failed to resume application' });
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
    console.error('Failed to get workers:', error);
    res.status(500).json({ error: 'Failed to get worker nodes' });
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

      await logActivity({
        userId,
        action: 'admin.paas.worker.add',
        resource: `paas:worker:${nodeId}`,
        details: { name, ip_address },
      });

      res.status(201).json({ message: 'Worker node added', nodeId });
    } catch (error: any) {
      console.error('Failed to add worker:', error);
      res.status(500).json({ error: error.message || 'Failed to add worker node' });
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

    await logActivity({
      userId,
      action: 'admin.paas.worker.remove',
      resource: `paas:worker:${nodeId}`,
      details: {},
    });

    res.json({ message: 'Worker node removed' });
  } catch (error: any) {
    console.error('Failed to remove worker:', error);
    res.status(500).json({ error: error.message || 'Failed to remove worker node' });
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

    await logActivity({
      userId,
      action: 'admin.paas.swarm.init',
      resource: 'paas:swarm',
      details: {},
    });

    res.json({
      message: 'Swarm initialized',
      managerIp: swarmConfig.managerIp,
    });
  } catch (error: any) {
    console.error('Failed to initialize Swarm:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize Swarm' });
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
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
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
      const { settings } = req.body;

      // Update settings
      for (const [key, value] of Object.entries(settings)) {
        // Determine if sensitive based on key name
        const isSensitive = key.includes('key') || key.includes('secret') || key.includes('password') || key.includes('token');

        await PaasSettingsService.set(key, value as any, {
          is_sensitive: isSensitive,
        });
      }

      await logActivity({
        userId,
        action: 'admin.paas.settings.update',
        resource: 'paas:settings',
        details: {
          keys_updated: Object.keys(settings),
        },
      });

      res.json({ message: 'Settings updated' });
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

/**
 * GET /api/admin/paas/plans
 * Get all PaaS plans (including inactive)
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM paas_plans ORDER BY price_per_hour ASC'
    );

    res.json({ plans: result.rows });
  } catch (error: any) {
    console.error('Failed to get plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
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

      const result = await pool.query(
        `INSERT INTO paas_plans (name, slug, cpu_cores, ram_mb, disk_gb, max_replicas, price_per_hour, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, slug, cpu_cores, ram_mb, disk_gb, max_replicas, price_per_hour, features || {}]
      );

      await logActivity({
        userId,
        action: 'admin.paas.plan.create',
        resource: `paas:plan:${result.rows[0].id}`,
        details: { name, slug },
      });

      res.status(201).json({ plan: result.rows[0] });
    } catch (error: any) {
      console.error('Failed to create plan:', error);
      res.status(500).json({ error: 'Failed to create plan' });
    }
  }
);

/**
 * PATCH /api/admin/paas/plans/:id
 * Update a PaaS plan
 */
router.patch(
  '/plans/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const planId = req.params.id;
      const updates = req.body;

      // Build update query
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      const allowedFields = ['name', 'cpu_cores', 'ram_mb', 'disk_gb', 'max_replicas', 'price_per_hour', 'is_active', 'features'];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(planId);

      const result = await pool.query(
        `UPDATE paas_plans SET ${fields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      await logActivity({
        userId,
        action: 'admin.paas.plan.update',
        resource: `paas:plan:${planId}`,
        details: updates,
      });

      res.json({ plan: result.rows[0] });
    } catch (error: any) {
      console.error('Failed to update plan:', error);
      res.status(500).json({ error: 'Failed to update plan' });
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
      'SELECT COUNT(*) as count FROM paas_applications WHERE plan_id = $1',
      [planId]
    );

    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete plan that is in use by applications' });
    }

    await pool.query('DELETE FROM paas_plans WHERE id = $1', [planId]);

    await logActivity({
      userId,
      action: 'admin.paas.plan.delete',
      resource: `paas:plan:${planId}`,
      details: {},
    });

    res.json({ message: 'Plan deleted' });
  } catch (error: any) {
    console.error('Failed to delete plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
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
        SUM(cpu_cores * replicas) as total_cpu,
        SUM(ram_mb * replicas) as total_ram_mb,
        SUM(cost) as total_cost
       FROM paas_resource_usage
       WHERE recorded_at > NOW() - INTERVAL '7 days'
       GROUP BY hour
       ORDER BY hour DESC`
    );

    res.json({ usage: result.rows });
  } catch (error: any) {
    console.error('Failed to get usage:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

export default router;
