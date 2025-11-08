/**
 * Admin PaaS API Routes for SkyPanelv2
 * Handles administrative PaaS management functions
 */

import express from 'express';
import { PaaSService } from '../services/paasService.js';
import { WorkerNodeService } from '../services/workerNodeService.js';
import { BuildService } from '../services/buildService.js';
import { AddOnService } from '../services/addOnService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// Admin authentication middleware
router.use(authenticateToken);
router.use(requireRole('admin'));

// ============================================================
// PaaS Plans Management
// ============================================================

/**
 * GET /api/admin/paas/plans
 * Get all PaaS plans (including inactive)
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await PaaSService.getAllPlans(true);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting PaaS plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch PaaS plans'
    });
  }
});

/**
 * POST /api/admin/paas/plans
 * Create new PaaS plan
 */
router.post('/plans', async (req, res) => {
  try {
    const plan = await PaaSService.createPlan(req.body);

    // Log admin action
    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.plan.create',
      entityType: 'paas_plan',
      entityId: plan.id || 'unknown',
      message: `Created PaaS plan: ${plan.name}`,
      metadata: plan
    }, req);

    res.status(201).json({
      success: true,
      data: plan,
      message: 'PaaS plan created successfully'
    });
  } catch (error) {
    console.error('Error creating PaaS plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to create PaaS plan';
    const status = message.startsWith('Invalid plan data') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * PUT /api/admin/paas/plans/:planId
 * Update PaaS plan
 */
router.put('/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const updatedPlan = await PaaSService.updatePlan(planId, req.body);

    // Log admin action
    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.plan.update',
      entityType: 'paas_plan',
      entityId: planId,
      message: `Updated PaaS plan: ${planId}`,
      metadata: updatedPlan
    }, req);

    res.json({
      success: true,
      data: updatedPlan,
      message: 'PaaS plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating PaaS plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to update PaaS plan';
    const status = (message.startsWith('Invalid plan data') || message === 'No valid plan fields provided for update') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/admin/paas/plans/:planId
 * Delete PaaS plan
 */
router.delete('/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    await PaaSService.deletePlan(planId);

    // Log admin action
    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.plan.delete',
      entityType: 'paas_plan',
      entityId: planId,
      message: `Deleted PaaS plan: ${planId}`,
      metadata: { planId }
    }, req);

    res.json({
      success: true,
      message: 'PaaS plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting PaaS plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete PaaS plan';
    let status = 500;
    if (message === 'Plan not found') status = 404;
    else if (message.startsWith('Cannot delete plan')) status = 409;
    else if (message === 'Invalid plan id format') status = 400;
    res.status(status).json({ success: false, error: message });
  }
});

// ============================================================
// Worker Nodes Management
// ============================================================

/**
 * GET /api/admin/paas/workers
 * Get all worker nodes
 */
router.get('/workers', async (req, res) => {
  try {
    const workers = await WorkerNodeService.getAllWorkerNodes();
    const stats = await WorkerNodeService.getWorkerNodeStats();

    res.json({
      success: true,
      data: {
        workers,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting worker nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker nodes'
    });
  }
});

/**
 * GET /api/admin/paas/workers/:workerId
 * Get specific worker node
 */
router.get('/workers/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const worker = await WorkerNodeService.getWorkerNodeById(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Error getting worker node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker node'
    });
  }
});

/**
 * POST /api/admin/paas/workers
 * Create new worker node
 */
router.post('/workers', async (req, res) => {
  try {
    const workerData = req.body;
    const worker = await WorkerNodeService.createWorkerNode(workerData, req.user.id);

    res.status(201).json({
      success: true,
      data: worker,
      message: 'Worker node created successfully'
    });
  } catch (error) {
    console.error('Error creating worker node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create worker node'
    });
  }
});

/**
 * PUT /api/admin/paas/workers/:workerId
 * Update worker node configuration
 */
router.put('/workers/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const body = req.body || {};

    // Basic validation of payload types
    const errors: string[] = [];
    if (body.name && typeof body.name !== 'string') errors.push('name must be a string');
    if (body.hostname && typeof body.hostname !== 'string') errors.push('hostname must be a string');
    if (body.ipAddress && typeof body.ipAddress !== 'string') errors.push('ipAddress must be a string');
    if (body.port && typeof body.port !== 'number') errors.push('port must be a number');
    if (body.maxConcurrentBuilds && typeof body.maxConcurrentBuilds !== 'number') errors.push('maxConcurrentBuilds must be a number');
    if (body.capabilities && typeof body.capabilities !== 'object') errors.push('capabilities must be an object');
    if (body.resourceLimits && typeof body.resourceLimits !== 'object') errors.push('resourceLimits must be an object');
    if (body.metadata && typeof body.metadata !== 'object') errors.push('metadata must be an object');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: `Invalid payload: ${errors.join(', ')}` });
    }

    // Ensure worker exists
    const existing = await WorkerNodeService.getWorkerNodeById(workerId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Worker node not found' });
    }

    const success = await WorkerNodeService.updateWorkerNodeConfig(workerId, {
      name: body.name,
      hostname: body.hostname,
      ipAddress: body.ipAddress,
      port: body.port,
      capabilities: body.capabilities,
      maxConcurrentBuilds: body.maxConcurrentBuilds,
      resourceLimits: body.resourceLimits,
      metadata: body.metadata,
    }, req.user.id);

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to update worker configuration' });
    }

    return res.json({ success: true, message: 'Worker configuration updated successfully' });
  } catch (error) {
    console.error('Error updating worker configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to update worker configuration' });
  }
});

/**
 * PUT /api/admin/paas/workers/:workerId/status
 * Update worker node status
 */
router.put('/workers/:workerId/status', async (req, res) => {
  try {
    const { workerId } = req.params;
    const statusRaw = req.body?.status;
    const status = typeof statusRaw === 'string' ? statusRaw.trim().toLowerCase() : '';

    // Validate status input early
    const allowedStatuses = ['online', 'offline', 'busy', 'maintenance', 'error'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    // Check existence explicitly to return correct error
    const existing = await WorkerNodeService.getWorkerNodeById(workerId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Worker node not found' });
    }

    const success = await WorkerNodeService.updateWorkerNodeStatus(workerId, status, req.user.id);
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to update worker node status' });
    }

    res.json({
      success: true,
      message: 'Worker node status updated successfully'
    });
  } catch (error) {
    console.error('Error updating worker node status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update worker node status'
    });
  }
});

/**
 * DELETE /api/admin/paas/workers/:workerId
 * Delete worker node
 */
router.delete('/workers/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;

    await WorkerNodeService.deleteWorkerNode(workerId, req.user.id);

    res.json({
      success: true,
      message: 'Worker node deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting worker node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete worker node'
    });
  }
});

/**
 * POST /api/admin/paas/workers/maintenance
 * Run worker node maintenance tasks
 */
router.post('/workers/maintenance', async (req, res) => {
  try {
    const { offlineThresholdMinutes } = req.body;
    const threshold = offlineThresholdMinutes || 5;

    const markedOfflineCount = await WorkerNodeService.markOfflineNodes(threshold);
    const cleanedLogsCount = await BuildService.cleanupOldBuildLogs(30);

    res.json({
      success: true,
      data: {
        markedOfflineNodes: markedOfflineCount,
        cleanedLogEntries: cleanedLogsCount,
        thresholdMinutes: threshold
      },
      message: 'Worker maintenance completed successfully'
    });
  } catch (error) {
    console.error('Error running worker maintenance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run worker maintenance'
    });
  }
});

// ============================================================
// Add-on Plans Management
// ============================================================

/**
 * GET /api/admin/paas/addon-plans
 * Get all add-on plans
 */
router.get('/addon-plans', async (req, res) => {
  try {
    const plans = await AddOnService.getAvailablePlans();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting add-on plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch add-on plans'
    });
  }
});

/**
 * POST /api/admin/paas/addon-plans
 * Create new add-on plan
 */
router.post('/addon-plans', async (req, res) => {
  try {
    const plan = await AddOnService.createPlan(req.body);

    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.addon_plan.create',
      entityType: 'paas_addon_plan',
      entityId: plan.id || 'unknown',
      message: `Created add-on plan: ${plan.name}`,
      metadata: plan
    }, req);

    res.status(201).json({
      success: true,
      data: plan,
      message: 'Add-on plan created successfully'
    });
  } catch (error) {
    console.error('Error creating add-on plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to create add-on plan';
    const status = message.startsWith('Invalid plan data') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * PUT /api/admin/paas/addon-plans/:planId
 * Update add-on plan
 */
router.put('/addon-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const updatedPlan = await AddOnService.updatePlan(planId, req.body);

    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.addon_plan.update',
      entityType: 'paas_addon_plan',
      entityId: planId,
      message: `Updated add-on plan: ${planId}`,
      metadata: updatedPlan
    }, req);

    res.json({
      success: true,
      data: updatedPlan,
      message: 'Add-on plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating add-on plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to update add-on plan';
    const status = (message.startsWith('Invalid plan data') || message === 'No valid plan fields provided for update') ? 400 : (message === 'Add-on plan not found' ? 404 : 500);
    res.status(status).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/admin/paas/addon-plans/:planId
 * Delete add-on plan
 */
router.delete('/addon-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    await AddOnService.deletePlan(planId);

    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.addon_plan.delete',
      entityType: 'paas_addon_plan',
      entityId: planId,
      message: `Deleted add-on plan: ${planId}`,
      metadata: { planId }
    }, req);

    res.json({
      success: true,
      message: 'Add-on plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting add-on plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete add-on plan';
    let status = 500;
    if (message === 'Add-on plan not found') status = 404;
    else if (message.startsWith('Cannot delete add-on plan')) status = 409;
    else if (message === 'Invalid plan id format') status = 400;
    res.status(status).json({ success: false, error: message });
  }
});

// ============================================================
// Global PaaS Statistics and Monitoring
// ============================================================

/**
 * GET /api/admin/paas/stats
 * Get global PaaS statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get worker node stats
    const workerStats = await WorkerNodeService.getWorkerNodeStats();

    // Get all apps stats (would need to be implemented)
    const allAppsStats = {
      totalApps: 0,
      deployedApps: 0,
      buildingApps: 0,
      errorApps: 0
    };

    // Get all add-ons stats (would need to be implemented)
    const allAddOnsStats = {
      totalAddOns: 0,
      activeAddOns: 0,
      suspendedAddOns: 0
    };

    // Get billing overview
    const billingOverview = {
      monthlyRevenue: 0,
      totalRevenue: 0,
      activeSubscriptions: 0
    };

    res.json({
      success: true,
      data: {
        workers: workerStats,
        applications: allAppsStats,
        addons: allAddOnsStats,
        billing: billingOverview,
        systemHealth: {
          totalWorkers: workerStats.totalNodes,
          onlineWorkers: workerStats.onlineNodes,
          availableCapacity: workerStats.availableCapacity,
          totalCapacity: workerStats.totalCapacity
        }
      }
    });
  } catch (error) {
    console.error('Error getting PaaS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch PaaS statistics'
    });
  }
});

/**
 * GET /api/admin/paas/organizations/:orgId/apps
 * Get all PaaS apps for a specific organization (admin view)
 */
router.get('/organizations/:orgId/apps', async (req, res) => {
  try {
    const { orgId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const apps = await PaaSService.getOrganizationApps(orgId, limit, offset);
    const stats = await PaaSService.getOrganizationStats(orgId);

    res.json({
      success: true,
      data: {
        organizationId: orgId,
        apps,
        stats,
        pagination: {
          limit,
          offset,
          hasMore: apps.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting organization apps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organization applications'
    });
  }
});

/**
 * GET /api/admin/paas/organizations/:orgId/addons
 * Get all add-ons for a specific organization (admin view)
 */
router.get('/organizations/:orgId/addons', async (req, res) => {
  try {
    const { orgId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const subscriptions = await AddOnService.getOrganizationSubscriptions(orgId, undefined, undefined, limit, offset);
    const stats = await AddOnService.getOrganizationStats(orgId);

    res.json({
      success: true,
      data: {
        organizationId: orgId,
        subscriptions,
        stats,
        pagination: {
          limit,
          offset,
          hasMore: subscriptions.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting organization add-ons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organization add-ons'
    });
  }
});

/**
 * GET /api/admin/paas/billing/overview
 * Get billing overview for all PaaS services
 */
router.get('/billing/overview', async (req, res) => {
  try {
    // This would need to be implemented in the billing service
    const overview = {
      totalRevenue: 0,
      monthlyRevenue: 0,
      activeBilledApps: 0,
      activeBilledAddOns: 0,
      failedBillingAttempts: 0,
      totalBilledHours: 0
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error getting billing overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing overview'
    });
  }
});

/**
 * POST /api/admin/paas/billing/process
 * Manually trigger billing process
 */
router.post('/billing/process', async (req, res) => {
  try {
    const { type } = req.body; // 'vps', 'paas', or 'all'

    let results = {};

    if (type === 'paas' || type === 'all') {
      const paasResult = await import('../services/billingService.js').then(({ BillingService }) => {
        return BillingService.runPaaSHourlyBilling();
      });
      results.paas = paasResult;
    }

    if (type === 'vps' || type === 'all') {
      const vpsResult = await import('../services/billingService.js').then(({ BillingService }) => {
        return BillingService.runHourlyBilling();
      });
      results.vps = vpsResult;
    }

    // Log admin action
    await logActivity({
      userId: req.user.id,
      eventType: 'paas.admin.billing.manual_trigger',
      entityType: 'system',
      entityId: null,
      message: `Manually triggered ${type} billing process`,
      metadata: { type, results }
    }, req);

    res.json({
      success: true,
      data: results,
      message: 'Billing process completed successfully'
    });
  } catch (error) {
    console.error('Error running billing process:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run billing process'
    });
  }
});

export default router;
