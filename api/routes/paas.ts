/**
 * PaaS API Routes
 * Client-facing endpoints for managing PaaS applications
 */

import express, { Request, Response } from 'express';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import { pool } from '../lib/database.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { BuilderService } from '../services/paas/builderService.js';
import { DeployerService } from '../services/paas/deployerService.js';
import { ScalerService } from '../services/paas/scalerService.js';
import { LoggerService } from '../services/paas/loggerService.js';
import { logActivity } from '../services/activityLogger.js';
import { body, param, query as validateQuery, validationResult } from 'express-validator';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, requireOrganization);

/**
 * GET /api/paas/apps
 * List all applications for the current organization
 */
router.get('/apps', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).organizationId;

    const result = await pool.query(
      `SELECT a.*, p.name as plan_name, p.cpu_cores, p.ram_mb
       FROM paas_applications a
       LEFT JOIN paas_plans p ON a.plan_id = p.id
       WHERE a.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );

    res.json({ apps: result.rows });
  } catch (error: any) {
    console.error('Failed to list apps:', error);
    res.status(500).json({ error: 'Failed to list applications' });
  }
});

/**
 * GET /api/paas/apps/:id
 * Get details of a specific application
 */
router.get(
  '/apps/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;

      const result = await pool.query(
        `SELECT a.*, p.name as plan_name, p.cpu_cores, p.ram_mb, p.disk_gb
         FROM paas_applications a
         LEFT JOIN paas_plans p ON a.plan_id = p.id
         WHERE a.id = $1 AND a.organization_id = $2`,
        [appId, orgId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json({ app: result.rows[0] });
    } catch (error: any) {
      console.error('Failed to get app:', error);
      res.status(500).json({ error: 'Failed to get application' });
    }
  }
);

/**
 * POST /api/paas/apps
 * Create a new application
 */
router.post(
  '/apps',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('slug')
      .trim()
      .isLength({ min: 1, max: 255 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('git_url').optional().isURL(),
    body('git_branch').optional().trim().isLength({ min: 1, max: 255 }),
    body('buildpack').optional().trim().isLength({ min: 1, max: 255 }),
    body('plan_id').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const { name, slug, git_url, git_branch, buildpack, plan_id } = req.body;

      // Check if slug is unique within organization
      const existingApp = await pool.query(
        'SELECT id FROM paas_applications WHERE organization_id = $1 AND slug = $2',
        [orgId, slug]
      );

      if (existingApp.rows.length > 0) {
        return res.status(400).json({ error: 'Slug already in use' });
      }

      // Verify plan exists
      const plan = await pool.query('SELECT id FROM paas_plans WHERE id = $1 AND is_active = true', [
        plan_id,
      ]);

      if (plan.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive plan' });
      }

      // Generate subdomain
      const subdomain = `${slug}-${orgId.substring(0, 8)}`;

      // Create application
      const result = await pool.query(
        `INSERT INTO paas_applications (
          organization_id, name, slug, git_url, git_branch, buildpack, plan_id, subdomain, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [orgId, name, slug, git_url, git_branch || 'main', buildpack, plan_id, subdomain, 'inactive']
      );

      const app = result.rows[0];

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.create',
        resource: `paas:app:${app.id}`,
        details: {
          app_name: name,
          app_slug: slug,
        },
      });

      res.status(201).json({ app });
    } catch (error: any) {
      console.error('Failed to create app:', error);
      res.status(500).json({ error: 'Failed to create application' });
    }
  }
);

/**
 * PATCH /api/paas/apps/:id
 * Update application settings
 */
router.patch(
  '/apps/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('git_url').optional().isURL(),
    body('git_branch').optional().trim().isLength({ min: 1, max: 255 }),
    body('buildpack').optional().trim().isLength({ min: 1, max: 255 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const updates = req.body;

      // Build update query
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (['name', 'git_url', 'git_branch', 'buildpack'].includes(key)) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(appId, orgId);

      const result = await pool.query(
        `UPDATE paas_applications SET ${fields.join(', ')}
         WHERE id = $${paramCount++} AND organization_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.update',
        resource: `paas:app:${appId}`,
        details: updates,
      });

      res.json({ app: result.rows[0] });
    } catch (error: any) {
      console.error('Failed to update app:', error);
      res.status(500).json({ error: 'Failed to update application' });
    }
  }
);

/**
 * DELETE /api/paas/apps/:id
 * Delete an application
 */
router.delete('/apps/:id', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const userId = (req as any).userId;
    const appId = req.params.id;

    // Stop and delete the Swarm service
    await DeployerService.delete(appId);

    // Delete from database (cascades to related tables)
    const result = await pool.query(
      'DELETE FROM paas_applications WHERE id = $1 AND organization_id = $2 RETURNING name',
      [appId, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await logActivity({
      userId,
      organizationId: orgId,
      action: 'paas.app.delete',
      resource: `paas:app:${appId}`,
      details: {
        app_name: result.rows[0].name,
      },
    });

    res.json({ message: 'Application deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete app:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

/**
 * POST /api/paas/apps/:id/deploy
 * Trigger a new deployment
 */
router.post(
  '/apps/:id/deploy',
  [
    param('id').isUUID(),
    body('git_commit').optional().trim().isLength({ min: 1, max: 255 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const { git_commit } = req.body;

      // Get application
      const appResult = await pool.query(
        'SELECT * FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const app = appResult.rows[0];

      if (!app.git_url) {
        return res.status(400).json({ error: 'No git URL configured' });
      }

      // Start build asynchronously
      BuilderService.build({
        applicationId: app.id,
        gitUrl: app.git_url,
        gitBranch: app.git_branch,
        gitCommit: git_commit,
        buildpack: app.buildpack,
        userId,
      })
        .then(async (buildResult) => {
          if (buildResult.success) {
            // Deploy after successful build
            await DeployerService.deploy({ deploymentId: buildResult.deploymentId });
          }
        })
        .catch((error) => {
          console.error('Build/deploy failed:', error);
        });

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.deploy',
        resource: `paas:app:${appId}`,
        details: {
          git_commit,
        },
      });

      res.json({ message: 'Deployment started', appId });
    } catch (error: any) {
      console.error('Failed to start deployment:', error);
      res.status(500).json({ error: 'Failed to start deployment' });
    }
  }
);

/**
 * GET /api/paas/apps/:id/deployments
 * Get deployment history
 */
router.get('/apps/:id/deployments', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const appId = req.params.id;

    // Verify app belongs to org
    const appCheck = await pool.query(
      'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
      [appId, orgId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = await pool.query(
      `SELECT id, version, git_commit, status, build_started_at, build_completed_at, deployed_at, error_message
       FROM paas_deployments
       WHERE application_id = $1
       ORDER BY version DESC
       LIMIT 50`,
      [appId]
    );

    res.json({ deployments: result.rows });
  } catch (error: any) {
    console.error('Failed to get deployments:', error);
    res.status(500).json({ error: 'Failed to get deployments' });
  }
});

/**
 * POST /api/paas/apps/:id/rollback
 * Rollback to a previous deployment
 */
router.post(
  '/apps/:id/rollback',
  [param('id').isUUID(), body('version').isInt({ min: 1 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const { version } = req.body;

      // Verify app belongs to org
      const appCheck = await pool.query(
        'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const result = await DeployerService.rollback(appId, version);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.rollback',
        resource: `paas:app:${appId}`,
        details: { version },
      });

      res.json({ message: 'Rollback initiated', version });
    } catch (error: any) {
      console.error('Failed to rollback:', error);
      res.status(500).json({ error: 'Failed to rollback' });
    }
  }
);

/**
 * GET /api/paas/apps/:id/logs
 * Get application logs
 */
router.get(
  '/apps/:id/logs',
  [
    param('id').isUUID(),
    validateQuery('since').optional().isISO8601(),
    validateQuery('limit').optional().isInt({ min: 1, max: 10000 }),
    validateQuery('search').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;
      const { since, limit, search } = req.query;

      // Verify app belongs to org
      const appCheck = await pool.query(
        'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const logs = await LoggerService.queryLogs({
        applicationId: appId,
        since: since ? new Date(since as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });

      res.json({ logs });
    } catch (error: any) {
      console.error('Failed to get logs:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }
);

/**
 * GET /api/paas/apps/:id/logs/stream
 * Stream logs in real-time (SSE)
 */
router.get('/apps/:id/logs/stream', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const appId = req.params.id;

    // Verify app belongs to org
    const appCheck = await pool.query(
      'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
      [appId, orgId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream logs
    const logStream = LoggerService.streamLogs(appId);

    for await (const log of logStream) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  } catch (error: any) {
    console.error('Failed to stream logs:', error);
    res.status(500).json({ error: 'Failed to stream logs' });
  }
});

/**
 * GET /api/paas/apps/:id/env
 * Get environment variables
 */
router.get('/apps/:id/env', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const appId = req.params.id;

    // Verify app belongs to org
    const appCheck = await pool.query(
      'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
      [appId, orgId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = await pool.query(
      'SELECT id, key, is_system, created_at FROM paas_environment_vars WHERE application_id = $1 ORDER BY key',
      [appId]
    );

    // Don't send decrypted values, just keys
    res.json({ env_vars: result.rows });
  } catch (error: any) {
    console.error('Failed to get env vars:', error);
    res.status(500).json({ error: 'Failed to get environment variables' });
  }
});

/**
 * PUT /api/paas/apps/:id/env
 * Set/update environment variables
 */
router.put(
  '/apps/:id/env',
  [param('id').isUUID(), body('vars').isObject()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const { vars } = req.body;

      // Verify app belongs to org
      const appCheck = await pool.query(
        'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Upsert environment variables
      for (const [key, value] of Object.entries(vars)) {
        const encryptedValue = encrypt(value as string);

        await pool.query(
          `INSERT INTO paas_environment_vars (application_id, key, value_encrypted)
           VALUES ($1, $2, $3)
           ON CONFLICT (application_id, key) DO UPDATE SET
             value_encrypted = EXCLUDED.value_encrypted,
             updated_at = NOW()`,
          [appId, key, encryptedValue]
        );
      }

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.env.update',
        resource: `paas:app:${appId}`,
        details: {
          keys_updated: Object.keys(vars),
        },
      });

      res.json({ message: 'Environment variables updated' });
    } catch (error: any) {
      console.error('Failed to update env vars:', error);
      res.status(500).json({ error: 'Failed to update environment variables' });
    }
  }
);

/**
 * DELETE /api/paas/apps/:id/env/:key
 * Delete an environment variable
 */
router.delete(
  '/apps/:id/env/:key',
  [param('id').isUUID(), param('key').trim().isLength({ min: 1 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const key = req.params.key;

      // Verify app belongs to org
      const appCheck = await pool.query(
        'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const result = await pool.query(
        'DELETE FROM paas_environment_vars WHERE application_id = $1 AND key = $2 AND is_system = false RETURNING key',
        [appId, key]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Environment variable not found or is system variable' });
      }

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.env.delete',
        resource: `paas:app:${appId}`,
        details: { key },
      });

      res.json({ message: 'Environment variable deleted' });
    } catch (error: any) {
      console.error('Failed to delete env var:', error);
      res.status(500).json({ error: 'Failed to delete environment variable' });
    }
  }
);

/**
 * POST /api/paas/apps/:id/scale
 * Scale application replicas
 */
router.post(
  '/apps/:id/scale',
  [param('id').isUUID(), body('replicas').isInt({ min: 0, max: 100 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const { replicas } = req.body;

      // Verify app belongs to org
      const appCheck = await pool.query(
        'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
        [appId, orgId]
      );

      if (appCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const result = await ScalerService.scale({
        applicationId: appId,
        replicas,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await logActivity({
        userId,
        organizationId: orgId,
        action: 'paas.app.scale',
        resource: `paas:app:${appId}`,
        details: { replicas },
      });

      res.json({ message: 'Application scaled', replicas: result.currentReplicas });
    } catch (error: any) {
      console.error('Failed to scale app:', error);
      res.status(500).json({ error: 'Failed to scale application' });
    }
  }
);

/**
 * POST /api/paas/apps/:id/stop
 * Stop application (scale to 0)
 */
router.post('/apps/:id/stop', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const userId = (req as any).userId;
    const appId = req.params.id;

    // Verify app belongs to org
    const appCheck = await pool.query(
      'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
      [appId, orgId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await DeployerService.stop(appId);

    await logActivity({
      userId,
      organizationId: orgId,
      action: 'paas.app.stop',
      resource: `paas:app:${appId}`,
      details: {},
    });

    res.json({ message: 'Application stopped' });
  } catch (error: any) {
    console.error('Failed to stop app:', error);
    res.status(500).json({ error: 'Failed to stop application' });
  }
});

/**
 * GET /api/paas/plans
 * List available PaaS plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM paas_plans WHERE is_active = true ORDER BY price_per_hour ASC'
    );

    res.json({ plans: result.rows });
  } catch (error: any) {
    console.error('Failed to get plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

export default router;
