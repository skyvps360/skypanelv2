/**
 * PaaS API Routes
 * Client-facing endpoints for managing PaaS applications
 */

import express, { Request, Response } from 'express';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import { pool } from '../lib/database.js';
import { BuilderService } from '../services/paas/builderService.js';
import { DeployerService } from '../services/paas/deployerService.js';
import { ScalerService } from '../services/paas/scalerService.js';
import { LoggerService } from '../services/paas/loggerService.js';
import { PaasEnvironmentService } from '../services/paas/environmentService.js';
import { PaasOrganizationService } from '../services/paas/organizationService.js';
import { logActivity } from '../services/activityLogger.js';
import { body, param, query as validateQuery, validationResult } from 'express-validator';
import { handlePaasApiError } from '../utils/paasApiError.js';
import { PaasBillingService } from '../services/paas/billingService.js';
import { buildQueue, deployQueue } from '../worker/queues.js';
import { SSLService } from '../services/paas/sslService.js';
import { SlugService } from '../services/paas/slugService.js';
import { PaasPlanService } from '../services/paas/planService.js';
import { BuildCacheService } from '../services/paas/buildCacheService.js';

const router = express.Router();

const APP_QUERY = {
  appOrganization: {
    name: 'paas_app_get_org',
    text: 'SELECT organization_id FROM paas_applications WHERE id = $1',
  },
  appIdForOrg: {
    name: 'paas_app_id_for_org',
    text: 'SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2',
  },
};

interface AppActivityPayload {
  userId: string;
  organizationId: string;
  appId: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

const logPaasActivity = async ({
  userId,
  organizationId,
  appId,
  eventType,
  message,
  metadata = {},
}: AppActivityPayload): Promise<void> => {
  await logActivity({
    userId,
    organizationId,
    eventType,
    entityType: 'paas_app',
    entityId: appId,
    message,
    metadata,
  });
};

const ensureOrgActive = async (orgId: string) => {
  await PaasOrganizationService.assertActive(orgId);
};

const ensureAppOrgActive = async (appId: string, orgId?: string) => {
  if (orgId) {
    await ensureOrgActive(orgId);
    return;
  }
  const app = await pool.query<{ organization_id: string }>({
    ...APP_QUERY.appOrganization,
    values: [appId],
  });
  if (app.rows.length === 0) {
    throw new Error('Application not found');
  }
  await ensureOrgActive(app.rows[0].organization_id as unknown as string);
};

const appExistsForOrg = async (appId: string, orgId: string): Promise<boolean> => {
  const result = await pool.query<{ id: string }>({
    ...APP_QUERY.appIdForOrg,
    values: [appId, orgId],
  });
  return result.rowCount > 0;
};

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
      `SELECT a.*, p.name as plan_name, p.cpu_cores, p.ram_mb, p.max_replicas, p.price_per_hour as plan_price_per_hour
       FROM paas_applications a
       LEFT JOIN paas_plans p ON a.plan_id = p.id
       WHERE a.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );

    res.json({ apps: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list organization PaaS apps',
      clientMessage: 'Failed to list applications',
    });
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
        `SELECT a.*, p.name as plan_name, p.cpu_cores, p.ram_mb, p.disk_gb, p.max_replicas, p.price_per_hour as plan_price_per_hour
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
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to get PaaS application',
        clientMessage: 'Failed to get application',
      });
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

      await ensureOrgActive(orgId);

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

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId: app.id,
        eventType: 'paas.app.create',
        metadata: {
          app_name: name,
          app_slug: slug,
        },
      });

      res.status(201).json({ app });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to create PaaS application',
        clientMessage: 'Failed to create application',
      });
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
    body('health_check_enabled').optional().isBoolean(),
    body('health_check_path').optional().isLength({ min: 1, max: 255 }),
    body('health_check_interval_seconds').optional().isInt({ min: 5, max: 600 }),
    body('health_check_timeout_seconds').optional().isInt({ min: 1, max: 60 }),
    body('health_check_retries').optional().isInt({ min: 1, max: 10 }),
    body('health_check_protocol').optional().isIn(['http', 'https']),
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

      const allowedFields = new Set([
        'name',
        'git_url',
        'git_branch',
        'buildpack',
        'health_check_enabled',
        'health_check_path',
        'health_check_interval_seconds',
        'health_check_timeout_seconds',
        'health_check_retries',
        'health_check_protocol',
      ]);

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.has(key)) {
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

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId: appId,
        eventType: 'paas.app.update',
        metadata: updates,
      });

      res.json({ app: result.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update PaaS application',
        clientMessage: 'Failed to update application',
      });
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

    // Remove slug artifacts from storage
    await SlugService.deleteAppSlugs(appId);

    // Delete from database (cascades to related tables)
    const result = await pool.query(
      'DELETE FROM paas_applications WHERE id = $1 AND organization_id = $2 RETURNING name',
      [appId, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await logPaasActivity({
      userId,
      organizationId: orgId,
      appId,
      eventType: 'paas.app.delete',
      metadata: {
        app_name: result.rows[0].name,
      },
      message: `Application ${result.rows[0].name} deleted`,
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

      await ensureAppOrgActive(appId, orgId);

      const job = await buildQueue.add({
        applicationId: app.id,
        gitUrl: app.git_url,
        gitBranch: app.git_branch,
        gitCommit: git_commit,
        buildpack: app.buildpack,
        userId,
        replicas: app.replicas,
      });

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.deploy',
        metadata: {
          git_commit,
          job_id: job.id,
        },
        message: 'Deployment queued',
      });

      res.json({ message: 'Deployment queued', appId, jobId: job.id, queue: job.queue.name });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to queue PaaS deployment',
        clientMessage: 'Failed to queue deployment',
      });
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
    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = await pool.query(
      `SELECT d.id,
              d.version,
              d.git_commit,
              d.status,
              d.build_started_at,
              d.build_completed_at,
              d.deployed_at,
              d.error_message,
              d.rolled_back_from,
              prev.version as rolled_back_from_version
       FROM paas_deployments d
       LEFT JOIN paas_deployments prev ON prev.id = d.rolled_back_from
       WHERE d.application_id = $1
       ORDER BY d.version DESC
       LIMIT 50`,
      [appId]
    );

    res.json({ deployments: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS deployments',
      clientMessage: 'Failed to get deployments',
    });
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
      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const rollback = await DeployerService.rollback(appId, version, userId);
      let cachedSlugPath: string | undefined;
      try {
        cachedSlugPath = await DeployerService.prefetchSlug(rollback.targetDeployment.slug_url!);
      } catch (cacheError) {
        console.warn(`[Rollback] Failed to prefetch slug for deployment ${rollback.targetDeployment.id}:`, cacheError);
      }

      const job = await deployQueue.add({
        deploymentId: rollback.newDeployment.id,
        replicas: rollback.app.replicas,
        cachedSlugPath,
        rollback: true,
      });

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.rollback',
        metadata: {
          jobId: job.id,
          targetVersion: version,
          newVersion: rollback.newDeployment.version,
        },
        message: `Rollback to version ${version} queued`,
      });

      res.json({
        message: 'Rollback queued',
        version,
        deploymentId: rollback.newDeployment.id,
        jobId: job.id,
      });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to rollback PaaS deployment',
        clientMessage: 'Failed to rollback deployment',
      });
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
      if (!(await appExistsForOrg(appId, orgId))) {
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
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to get PaaS logs',
        clientMessage: 'Failed to get logs',
      });
    }
  }
);

/**
 * GET /api/paas/apps/:id/logs/stream
 * Stream logs in real-time (SSE)
 */
router.get(
  '/apps/:id/logs/stream',
  [
    param('id').isUUID(),
    validateQuery('level').optional().isIn(['info', 'warn', 'error', 'debug']),
    validateQuery('search').optional().isLength({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;

      // Verify app belongs to org
      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      await ensureAppOrgActive(appId, orgId);

      const level = req.query.level as 'info' | 'warn' | 'error' | 'debug' | undefined;
      const search = (req.query.search as string) || undefined;

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      try {
        const logStream = LoggerService.streamLogs(
          appId,
          {
            level,
            search,
          },
          abortController.signal
        );

        for await (const log of logStream) {
          if (abortController.signal.aborted) {
            break;
          }
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        }
      } finally {
        abortController.abort();
      }
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to stream PaaS logs',
        clientMessage: 'Failed to stream logs',
      });
    }
  }
);

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
    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const envVars = await PaasEnvironmentService.list(appId);
    res.json({ env_vars: envVars });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get environment variables',
      clientMessage: 'Failed to get environment variables',
    });
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
      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const updatedKeys = await PaasEnvironmentService.upsertMany(appId, orgId, vars);

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.env.update',
        metadata: {
          keys_updated: updatedKeys,
        },
      });

      void triggerEnvRedeploy(appId);

      res.json({ message: 'Environment variables updated', keys: updatedKeys });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to update environment variables',
        clientMessage: 'Failed to update environment variables',
      });
    }
  }
);

/**
 * POST /api/paas/apps/:id/env/import
 * Bulk import environment variables
 */
router.post(
  '/apps/:id/env/import',
  [param('id').isUUID(), body('content').isString(), body('format').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const userId = (req as any).userId;
      const appId = req.params.id;
      const { content, format = 'env' } = req.body;

      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const parsed = PaasEnvironmentService.parseEnv(content);
      const updatedKeys = await PaasEnvironmentService.upsertMany(appId, orgId, parsed);

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.env.import',
        metadata: { format, keys_updated: updatedKeys },
      });

      void triggerEnvRedeploy(appId);

      res.json({ message: 'Environment variables imported', keys: updatedKeys });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to import environment variables',
        clientMessage: 'Failed to import environment variables',
      });
    }
  }
);

/**
 * GET /api/paas/apps/:id/env/export
 * Export encrypted environment variables
 */
router.get('/apps/:id/env/export', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const appId = req.params.id;

    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const payload = await PaasEnvironmentService.export(appId);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="env-${appId}.enc"`);
    res.send(payload);
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to export environment variables',
      clientMessage: 'Failed to export environment variables',
    });
  }
});

/**
 * GET /api/paas/apps/:id/domains
 * List custom domains for an application
 */
router.get('/apps/:id/domains', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const appId = req.params.id;

    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const domains = await pool.query('SELECT * FROM paas_domains WHERE application_id = $1 ORDER BY created_at DESC', [
      appId,
    ]);

    res.json({ domains: domains.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list PaaS domains',
      clientMessage: 'Failed to list domains',
    });
  }
});

/**
 * POST /api/paas/apps/:id/domains
 * Add a custom domain
 */
router.post(
  '/apps/:id/domains',
  [param('id').isUUID(), body('domain').isFQDN({ require_tld: true })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;
      const { domain } = req.body;

      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const token = SSLService.generateVerificationToken();
      const recordValue = `paas-verify=${token}`;

      const result = await pool.query(
        `INSERT INTO paas_domains (
          application_id,
          domain,
          is_verified,
          ssl_enabled,
          dns_verification_token,
          verification_status,
          verification_requested_at,
          ssl_status
        ) VALUES ($1, $2, false, false, $3, 'pending', NOW(), 'pending')
        RETURNING *`,
        [appId, domain.toLowerCase(), token]
      );

      res.status(201).json({
        domain: result.rows[0],
        verification: {
          type: 'TXT',
          host: `_paas-verify.${domain.toLowerCase()}`,
          value: recordValue,
        },
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'Domain already in use' });
      }
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to add custom domain',
        clientMessage: 'Failed to add domain',
      });
    }
  }
);

/**
 * POST /api/paas/apps/:id/domains/:domainId/verify
 * Verify DNS ownership and enable SSL
 */
router.post(
  '/apps/:id/domains/:domainId/verify',
  [param('id').isUUID(), param('domainId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;
      const domainId = req.params.domainId;

      const domainResult = await pool.query(
        `SELECT d.*
           FROM paas_domains d
          JOIN paas_applications a ON a.id = d.application_id
          WHERE d.id = $1 AND d.application_id = $2 AND a.organization_id = $3`,
        [domainId, appId, orgId]
      );

      if (domainResult.rows.length === 0) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      const domain = domainResult.rows[0];

      const verified = await SSLService.validateDomainOwnership(domain);
      if (!verified) {
        return res.status(400).json({ error: 'DNS verification record not found yet' });
      }

      await SSLService.markDomainVerified(domain.id);
      await SSLService.beginCertificateProvision(domain.id);
      await SSLService.markCertificateActive(domain.id);

      const updated = await pool.query('SELECT * FROM paas_domains WHERE id = $1', [domain.id]);

      res.json({ domain: updated.rows[0] });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to verify custom domain',
        clientMessage: 'Failed to verify domain',
      });
    }
  }
);

/**
 * DELETE /api/paas/apps/:id/domains/:domainId
 * Remove a custom domain
 */
router.delete(
  '/apps/:id/domains/:domainId',
  [param('id').isUUID(), param('domainId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = (req as any).organizationId;
      const appId = req.params.id;
      const domainId = req.params.domainId;

      const result = await pool.query(
        `DELETE FROM paas_domains
          USING paas_applications
          WHERE paas_domains.id = $1
            AND paas_domains.application_id = paas_applications.id
            AND paas_applications.id = $2
            AND paas_applications.organization_id = $3
        RETURNING paas_domains.*`,
        [domainId, appId, orgId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      res.json({ message: 'Domain removed' });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to delete custom domain',
        clientMessage: 'Failed to delete domain',
      });
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
      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const deleted = await PaasEnvironmentService.delete(appId, key);
      if (!deleted) {
        return res.status(404).json({ error: 'Environment variable not found or is system variable' });
      }

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.env.delete',
        metadata: { key },
      });

      void triggerEnvRedeploy(appId);

      res.json({ message: 'Environment variable deleted' });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to delete environment variable',
        clientMessage: 'Failed to delete environment variable',
      });
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
      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      await ensureAppOrgActive(appId, orgId);

      const result = await ScalerService.scale({
        applicationId: appId,
        replicas,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.scale',
        metadata: {
          replicas,
          previousReplicas: result.previousReplicas,
          hourlyCostBefore: result.hourlyCostBefore,
          hourlyCostAfter: result.hourlyCostAfter,
        },
        message: `Scaling to ${replicas} replicas`,
      });

      res.json({
        message: 'Application scaled',
        replicas: result.currentReplicas,
        previousReplicas: result.previousReplicas,
        hourlyCostBefore: result.hourlyCostBefore,
        hourlyCostAfter: result.hourlyCostAfter,
        walletBalance: result.walletBalance,
      });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to scale PaaS application',
        clientMessage: 'Failed to scale application',
      });
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
    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await DeployerService.stop(appId);

    await logPaasActivity({
      userId,
      organizationId: orgId,
      appId,
      eventType: 'paas.app.stop',
      message: 'Application stopped',
    });

    res.json({ message: 'Application stopped' });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to stop PaaS application',
      clientMessage: 'Failed to stop application',
    });
  }
});

/**
 * POST /api/paas/apps/:id/restart
 * Restart an application (scale back up or redeploy latest slug)
 */
router.post(
  '/apps/:id/restart',
  [param('id').isUUID(), body('replicas').optional().isInt({ min: 1, max: 100 })],
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

      if (!(await appExistsForOrg(appId, orgId))) {
        return res.status(404).json({ error: 'Application not found' });
      }

      await ensureAppOrgActive(appId, orgId);

      const result = await DeployerService.restart(appId, replicas);

      await logPaasActivity({
        userId,
        organizationId: orgId,
        appId,
        eventType: 'paas.app.restart',
        metadata: { replicas: result.replicas },
        message: `Application restarted with ${result.replicas} replica${result.replicas !== 1 ? 's' : ''}`,
      });

      res.json({ message: 'Application restarted', replicas: result.replicas });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to restart PaaS application',
        clientMessage: 'Failed to restart application',
      });
    }
  }
);

/**
 * POST /api/paas/apps/:id/cache/clear
 * Manually invalidate build cache for an application
 */
router.post('/apps/:id/cache/clear', param('id').isUUID(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orgId = (req as any).organizationId;
    const userId = (req as any).userId;
    const appId = req.params.id;

    if (!(await appExistsForOrg(appId, orgId))) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await ensureAppOrgActive(appId, orgId);

    const removed = await BuildCacheService.invalidateCache(appId);

    await logPaasActivity({
      userId,
      organizationId: orgId,
      appId,
      eventType: 'paas.app.cache.cleared',
      metadata: { removed },
      message:
        removed > 0
          ? `Cleared ${removed} build cache entr${removed === 1 ? 'y' : 'ies'}`
          : 'No build cache entries to clear',
    });

    res.json({ success: true, removed });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to clear build cache',
      clientMessage: 'Failed to clear build cache',
    });
  }
});

/**
 * GET /api/paas/plans
 * List available PaaS plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await PaasPlanService.getActivePlans();
    res.json({ plans });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get active PaaS plans',
      clientMessage: 'Failed to get plans',
    });
  }
});

/**
 * GET /api/paas/usage
 * Get billing usage for the current organization
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).organizationId;
    const range = (req.query.range as string) || '7d';

    const usage = await PaasBillingService.getOrganizationUsage(orgId, range);
    res.json(usage);
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS usage summary',
      clientMessage: 'Failed to get usage summary',
    });
  }
});

/**
 * GET /api/paas/jobs/:id
 * Retrieve job status for build/deploy queues
 */
router.get('/jobs/:id', param('id').isLength({ min: 1 }), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const jobId = req.params.id;
    const preferredQueue = typeof req.query.queue === 'string' ? req.query.queue : null;
    const queueOrder = preferredQueue ? [preferredQueue] : ['paas-build', 'paas-deploy'];

    let job: any = null;
    for (const queueName of queueOrder) {
      if (!job && (queueName === 'paas-build' || queueName === 'build')) {
        job = await buildQueue.getJob(jobId);
      }
      if (!job && (queueName === 'paas-deploy' || queueName === 'deploy')) {
        job = await deployQueue.getJob(jobId);
      }
    }

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = await job.progress();
    res.json({
      id: job.id,
      queue: job.queue.name,
      state,
      progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
      data: job.data,
    });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get PaaS job status',
      clientMessage: 'Failed to get job status',
    });
  }
});

/**
 * GET /api/paas/marketplace/templates
 * List all active marketplace templates
 */
router.get('/marketplace/templates', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const featured = req.query.featured === 'true';
    const search = req.query.search as string;

    let whereClause = 'WHERE is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (featured) {
      whereClause += ` AND is_featured = true`;
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT
        id, name, slug, description, category, icon_url,
        git_url, git_branch, buildpack, recommended_plan_slug,
        min_cpu_cores, min_ram_mb, deploy_count, rating,
        is_featured, created_at
       FROM paas_marketplace_templates
       ${whereClause}
       ORDER BY is_featured DESC, deploy_count DESC, name ASC`,
      queryParams
    );

    res.json({ templates: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list marketplace templates',
      clientMessage: 'Failed to load templates',
    });
  }
});

/**
 * GET /api/paas/marketplace/templates/:slug
 * Get detailed information about a marketplace template
 */
router.get('/marketplace/templates/:slug', param('slug').trim(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { slug } = req.params;

    const result = await pool.query(
      `SELECT * FROM paas_marketplace_templates WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];

    // Get recommended plan details
    if (template.recommended_plan_slug) {
      const planResult = await pool.query(
        'SELECT * FROM paas_plans WHERE slug = $1 AND is_active = true',
        [template.recommended_plan_slug]
      );
      template.recommended_plan = planResult.rows[0] || null;
    }

    // Get required addons if any
    if (template.required_addons && template.required_addons.length > 0) {
      const addonsResult = await pool.query(
        'SELECT * FROM paas_marketplace_addons WHERE slug = ANY($1::text[]) AND is_active = true',
        [template.required_addons]
      );
      template.required_addons_details = addonsResult.rows;
    }

    res.json({ template });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to get marketplace template',
      clientMessage: 'Failed to load template',
    });
  }
});

/**
 * GET /api/paas/marketplace/addons
 * List all active marketplace addons
 */
router.get('/marketplace/addons', async (req: Request, res: Response) => {
  try {
    const addonType = req.query.type as string;

    let whereClause = 'WHERE is_active = true';
    const queryParams: any[] = [];

    if (addonType) {
      whereClause += ' AND addon_type = $1';
      queryParams.push(addonType);
    }

    const result = await pool.query(
      `SELECT * FROM paas_marketplace_addons ${whereClause} ORDER BY addon_type, name`,
      queryParams
    );

    res.json({ addons: result.rows });
  } catch (error: any) {
    handlePaasApiError({
      req,
      res,
      error,
      logMessage: 'Failed to list marketplace addons',
      clientMessage: 'Failed to load addons',
    });
  }
});

/**
 * POST /api/paas/marketplace/deploy/:slug
 * Deploy an application from a marketplace template
 */
router.post('/marketplace/deploy/:slug',
  param('slug').trim(),
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('custom_slug').optional().trim().matches(/^[a-z0-9-]+$/),
  body('plan_id').isUUID(),
  body('custom_env_vars').optional().isObject(),
  body('selected_addons').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).userId;
      const orgId = (req as any).organizationId;
      const { slug } = req.params;
      const { name, custom_slug, plan_id, custom_env_vars, selected_addons } = req.body;

      // Get template
      const templateResult = await pool.query(
        'SELECT * FROM paas_marketplace_templates WHERE slug = $1 AND is_active = true',
        [slug]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = templateResult.rows[0];

      // Generate app slug
      const appSlug = custom_slug || name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

      // Check slug uniqueness
      const existingSlug = await pool.query(
        'SELECT id FROM paas_applications WHERE organization_id = $1 AND slug = $2',
        [orgId, appSlug]
      );

      if (existingSlug.rows.length > 0) {
        return res.status(400).json({ error: 'An application with this slug already exists' });
      }

      // Check plan
      const planResult = await pool.query(
        'SELECT * FROM paas_plans WHERE id = $1 AND is_active = true',
        [plan_id]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const plan = planResult.rows[0];

      // Validate plan meets template minimum requirements
      if (plan.cpu_cores < template.min_cpu_cores || plan.ram_mb < template.min_ram_mb) {
        return res.status(400).json({
          error: `Selected plan does not meet minimum requirements (${template.min_cpu_cores} CPU, ${template.min_ram_mb}MB RAM)`
        });
      }

      // Create the application
      const appResult = await pool.query(
        `INSERT INTO paas_applications
        (organization_id, name, slug, git_url, git_branch, buildpack, plan_id, status, replicas, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`,
        [
          orgId,
          name,
          appSlug,
          template.git_url,
          template.git_branch || 'main',
          template.buildpack,
          plan_id,
          'building',
          1
        ]
      );

      const app = appResult.rows[0];

      // Merge default env vars with custom env vars
      const envVars = { ...template.default_env_vars, ...custom_env_vars };

      // Insert environment variables
      for (const [key, value] of Object.entries(envVars)) {
        await pool.query(
          'INSERT INTO paas_environment_vars (application_id, key, value, created_at) VALUES ($1, $2, $3, NOW())',
          [app.id, key, value]
        );
      }

      // Create template deployment record
      const deploymentTrackingResult = await pool.query(
        `INSERT INTO paas_template_deployments
        (application_id, template_id, deployed_by, custom_env_vars, selected_addons, deployment_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
        [app.id, template.id, userId, custom_env_vars || {}, selected_addons || [], 'deploying']
      );

      // Increment template deploy count
      await pool.query(
        'UPDATE paas_marketplace_templates SET deploy_count = deploy_count + 1 WHERE id = $1',
        [template.id]
      );

      // Provision selected addons (async)
      if (selected_addons && selected_addons.length > 0) {
        for (const addonId of selected_addons) {
          await pool.query(
            `INSERT INTO paas_app_addons (application_id, addon_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())`,
            [app.id, addonId, 'provisioning']
          );
        }
      }

      await logActivity({
        userId,
        eventType: 'paas.marketplace.deploy',
        entityType: 'paas_template',
        entityId: template.id,
        metadata: { templateSlug: slug, appId: app.id, appName: name },
        message: `Deployed ${template.name} as ${name}`,
      });

      res.status(201).json({
        app,
        template_deployment: deploymentTrackingResult.rows[0]
      });
    } catch (error: any) {
      handlePaasApiError({
        req,
        res,
        error,
        logMessage: 'Failed to deploy from marketplace template',
        clientMessage: 'Failed to deploy template',
      });
    }
});

export default router;

async function triggerEnvRedeploy(appId: string): Promise<void> {
  try {
    const result = await pool.query('SELECT organization_id FROM paas_applications WHERE id = $1', [appId]);
    if (result.rows.length === 0) {
      return;
    }
    const orgId = result.rows[0].organization_id as string;
    const suspended = await PaasOrganizationService.isSuspended(orgId);
    if (suspended) {
      console.warn(`Skipping redeploy for app ${appId} because organization is suspended`);
      return;
    }
    await DeployerService.restart(appId);
  } catch (error: any) {
    console.warn(`Failed to redeploy app ${appId} after env change:`, error?.message || error);
  }
}
