/**
 * PaaS API Routes for SkyPanelV2
 * Handles customer-facing PaaS application management
 */

import express from 'express';
import { PaaSService } from '../services/paasService.js';
import { BuildService } from '../services/buildService.js';
import { AddOnService } from '../services/addOnService.js';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import { ActivityLogger } from '../services/activityLogger.js';

const router = express.Router();

const parseGitHubUrl = (repositoryUrl: string | undefined) => {
  if (!repositoryUrl || typeof repositoryUrl !== 'string') {
    return null;
  }
  try {
    const parsedUrl = new URL(repositoryUrl.trim());
    if (!parsedUrl.hostname.toLowerCase().endsWith('github.com')) {
      return null;
    }
    const pathSegments = parsedUrl.pathname.replace(/^\/|\/$/g, '').split('/');
    if (pathSegments.length < 2) {
      return null;
    }
    const owner = pathSegments[0];
    const repo = pathSegments[1].replace(/\.git$/i, '');
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
};

const buildGitHubHeaders = () => {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'SkyPanelV2'
  };
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

// Middleware to authenticate and validate organization access
router.use(authenticateToken);
router.use(requireOrganization);

/**
 * POST /api/paas/validate-repository
 * Validate that we can reach a public GitHub repository (and optional branch)
 */
router.post('/validate-repository', async (req, res) => {
  const { repository_url: repositoryUrl, branch } = req.body || {};

  if (!repositoryUrl || typeof repositoryUrl !== 'string' || repositoryUrl.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Repository URL is required'
    });
  }

  const parsed = parseGitHubUrl(repositoryUrl);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid GitHub repository URL'
    });
  }

  try {
    const headers = buildGitHubHeaders();
    const repoResponse = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });

    if (repoResponse.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found or inaccessible. Make sure it is public.'
      });
    }

    if (!repoResponse.ok) {
      const body = await repoResponse.json().catch(() => ({}));
      const details = body?.message || `GitHub responded with status ${repoResponse.status}`;
      return res.status(502).json({
        success: false,
        message: `Unable to reach GitHub: ${details}`
      });
    }

    const repoData = await repoResponse.json();
    if (repoData.private) {
      return res.status(400).json({
        success: false,
        message: 'Repository is private. Please provide a public repository.'
      });
    }

    const branchToCheck = typeof branch === 'string' && branch.trim().length > 0
      ? branch.trim()
      : repoData.default_branch || 'main';

    const branchResponse = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches/${encodeURIComponent(branchToCheck)}`,
      { headers }
    );

    if (branchResponse.status === 404) {
      return res.status(400).json({
        success: false,
        message: `Branch "${branchToCheck}" was not found in this repository.`,
        data: {
          defaultBranch: repoData.default_branch
        }
      });
    }

    if (!branchResponse.ok) {
      const body = await branchResponse.json().catch(() => ({}));
      const details = body?.message || `GitHub responded with status ${branchResponse.status}`;
      return res.status(502).json({
        success: false,
        message: `Unable to verify branch: ${details}`
      });
    }

    const branchData = await branchResponse.json();

    return res.json({
      success: true,
      message: 'Repository validated successfully',
      data: {
        owner: repoData.owner?.login || parsed.owner,
        repo: repoData.name || parsed.repo,
        fullName: repoData.full_name || `${parsed.owner}/${parsed.repo}`,
        defaultBranch: repoData.default_branch,
        requestedBranch: branchToCheck,
        branchSha: branchData?.commit?.sha || null,
        visibility: repoData.private ? 'private' : 'public',
        lastPushedAt: repoData.pushed_at,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        sizeKb: repoData.size,
        description: repoData.description
      }
    });
  } catch (error) {
    console.error('Error validating GitHub repository:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate repository. Please try again.'
    });
  }
});

/**
 * GET /api/paas/plans
 * Get available PaaS plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await PaaSService.getAvailablePlans();
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
 * GET /api/paas/apps
 * Get organization's PaaS applications
 */
router.get('/apps', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const apps = await PaaSService.getOrganizationApps(organizationId, limit, offset);
    const stats = await PaaSService.getOrganizationStats(organizationId);

    res.json({
      success: true,
      data: {
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
    console.error('Error getting PaaS apps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications'
    });
  }
});

/**
 * GET /api/paas/apps/:appId
 * Get specific PaaS application
 */
router.get('/apps/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;

    const app = await PaaSService.getAppById(appId, organizationId);

    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Error getting PaaS app:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application'
    });
  }
});

/**
 * POST /api/paas/apps
 * Create new PaaS application
 */
router.post('/apps', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const planId = req.body.planId || req.body.plan_id;
    const appData = {
      organizationId,
      ...req.body,
      planId
    };

    if (!appData.planId) {
      return res.status(400).json({
        success: false,
        error: 'A valid planId is required to create an application'
      });
    }

    const app = await PaaSService.createApp(appData, userId);

    // Bill for initial hour
    const plan = await PaaSService.getPlanById(app.planId);
    if (plan) {
      await import('../services/billingService.js').then(({ BillingService }) => {
        BillingService.billPaaSCreation(app.id, organizationId, plan.priceHourly, app.name);
      });
    }

    res.status(201).json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Error creating PaaS app:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create application'
    });
  }
});

/**
 * PUT /api/paas/apps/:appId
 * Update PaaS application
 */
router.put('/apps/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const app = await PaaSService.updateApp(appId, organizationId, req.body, userId);

    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Error updating PaaS app:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update application'
    });
  }
});

/**
 * DELETE /api/paas/apps/:appId
 * Delete PaaS application
 */
router.delete('/apps/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    await PaaSService.deleteApp(appId, organizationId, userId);

    // Stop billing
    await import('../services/billingService.js').then(({ BillingService }) => {
      BillingService.stopPaaSBilling(appId);
    });

    res.json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting PaaS app:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete application'
    });
  }
});

/**
 * POST /api/paas/apps/:appId/deploy
 * Trigger deployment for an application
 */
router.post('/apps/:appId/deploy', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const app = await PaaSService.getAppById(appId, organizationId);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const buildData = {
      appId,
      organizationId,
      triggeredBy: userId,
      isAutoDeployment: false,
      ...req.body
    };

    const result = await BuildService.triggerBuild(buildData);

    res.json({
      success: true,
      data: {
        deploymentId: result.deploymentId,
        message: 'Deployment started successfully'
      }
    });
  } catch (error) {
    console.error('Error triggering deployment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger deployment'
    });
  }
});

/**
 * GET /api/paas/apps/:appId/deployments
 * Get deployment history for an application
 */
router.get('/apps/:appId/deployments', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const deployments = await BuildService.getDeploymentHistory(appId, organizationId, limit, offset);

    res.json({
      success: true,
      data: {
        deployments,
        pagination: {
          limit,
          offset,
          hasMore: deployments.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting deployment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployment history'
    });
  }
});

/**
 * GET /api/paas/apps/:appId/addons
 * Get add-ons attached to a specific application
 */
router.get('/apps/:appId/addons', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;

    const app = await PaaSService.getAppById(appId, organizationId);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const addons = await AddOnService.getAppAddOns(appId, organizationId);

    res.json({
      success: true,
      data: addons.map(addon => ({
        id: addon.id,
        name: addon.name,
        status: addon.status,
        type: addon.serviceType,
        plan_name: addon.planName,
        price_hourly: addon.priceHourly,
        price_monthly: addon.priceMonthly,
        connection_string: addon.connectionString,
        created_at: addon.createdAt,
        updated_at: addon.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error getting application add-ons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application add-ons'
    });
  }
});

/**
 * GET /api/paas/apps/:appId/stats
 * Get live statistics for a specific application
 */
router.get('/apps/:appId/stats', async (req, res) => {
  try {
    const { appId } = req.params;
    const organizationId = req.user.organizationId;

    const stats = await PaaSService.getAppStats(appId, organizationId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    res.json({
      success: true,
      data: {
        cpu_usage: stats.cpuUsage,
        memory_usage: stats.memoryUsage,
        disk_usage: stats.diskUsage,
        bandwidth_usage: stats.bandwidthUsage,
        uptime: stats.uptime,
        request_count: stats.requestCount,
        error_rate: stats.errorRate
      }
    });
  } catch (error) {
    console.error('Error getting application stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application stats'
    });
  }
});

/**
 * GET /api/paas/deployments/:deploymentId
 * Get specific deployment details
 */
router.get('/deployments/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const organizationId = req.user.organizationId;

    const deployment = await BuildService.getDeployment(deploymentId, organizationId);

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    res.json({
      success: true,
      data: deployment
    });
  } catch (error) {
    console.error('Error getting deployment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployment'
    });
  }
});

/**
 * GET /api/paas/deployments/:deploymentId/logs
 * Get build logs for a deployment
 */
router.get('/deployments/:deploymentId/logs', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const organizationId = req.user.organizationId;
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await BuildService.getBuildLogs(deploymentId, organizationId, limit, offset);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit,
          offset,
          hasMore: logs.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting build logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch build logs'
    });
  }
});

/**
 * POST /api/paas/deployments/:deploymentId/rollback
 * Rollback to a previous deployment
 */
router.post('/deployments/:deploymentId/rollback', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const result = await BuildService.rollbackDeployment(deploymentId, organizationId, userId);

    res.json({
      success: true,
      data: {
        deploymentId: result.newDeploymentId,
        message: 'Rollback initiated successfully'
      }
    });
  } catch (error) {
    console.error('Error rolling back deployment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rollback deployment'
    });
  }
});

/**
 * GET /api/paas/addons/plans
 * Get available add-on plans
 */
router.get('/addons/plans', async (req, res) => {
  try {
    const serviceType = req.query.serviceType as string;
    const plans = await AddOnService.getAvailablePlans(serviceType);

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
 * GET /api/paas/addons
 * Get organization's add-on subscriptions
 */
router.get('/addons', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const serviceType = req.query.serviceType as string;
    const appId = req.query.appId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const subscriptions = await AddOnService.getOrganizationSubscriptions(
      organizationId,
      serviceType,
      appId,
      limit,
      offset
    );

    const stats = await AddOnService.getOrganizationStats(organizationId);

    res.json({
      success: true,
      data: {
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
    console.error('Error getting add-on subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch add-on subscriptions'
    });
  }
});

/**
 * POST /api/paas/addons
 * Create new add-on subscription
 */
router.post('/addons', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const subscriptionData = {
      organizationId,
      ...req.body
    };

    const subscription = await AddOnService.createSubscription(subscriptionData, userId);

    res.status(201).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error creating add-on subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create add-on subscription'
    });
  }
});

/**
 * GET /api/paas/addons/:subscriptionId
 * Get specific add-on subscription
 */
router.get('/addons/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const organizationId = req.user.organizationId;

    const subscription = await AddOnService.getSubscriptionById(subscriptionId, organizationId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Add-on subscription not found'
      });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error getting add-on subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch add-on subscription'
    });
  }
});

/**
 * GET /api/paas/addons/:subscriptionId/connection
 * Get connection details for an add-on
 */
router.get('/addons/:subscriptionId/connection', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const organizationId = req.user.organizationId;

    const connectionDetails = await AddOnService.getConnectionDetails(subscriptionId, organizationId);

    if (!connectionDetails) {
      return res.status(404).json({
        success: false,
        error: 'Add-on subscription not found or inactive'
      });
    }

    res.json({
      success: true,
      data: connectionDetails
    });
  } catch (error) {
    console.error('Error getting connection details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connection details'
    });
  }
});

/**
 * PUT /api/paas/addons/:subscriptionId
 * Update add-on subscription
 */
router.put('/addons/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const subscription = await AddOnService.updateSubscription(
      subscriptionId,
      organizationId,
      req.body,
      userId
    );

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error updating add-on subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update add-on subscription'
    });
  }
});

/**
 * DELETE /api/paas/addons/:subscriptionId
 * Delete add-on subscription
 */
router.delete('/addons/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    await AddOnService.deleteSubscription(subscriptionId, organizationId, userId);

    res.json({
      success: true,
      message: 'Add-on subscription terminated successfully'
    });
  } catch (error) {
    console.error('Error deleting add-on subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete add-on subscription'
    });
  }
});

/**
 * GET /api/paas/billing/history
 * Get PaaS billing history
 */
router.get('/billing/history', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const billingHistory = await import('../services/billingService.js').then(({ BillingService }) => {
      return BillingService.getPaaSBillingHistory(organizationId, limit, offset);
    });

    res.json({
      success: true,
      data: {
        billingHistory: await billingHistory,
        pagination: {
          limit,
          offset,
          hasMore: (await billingHistory).length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting billing history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing history'
    });
  }
});

/**
 * GET /api/paas/stats
 * Get PaaS statistics for the organization
 */
router.get('/stats', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const appStats = await PaaSService.getOrganizationStats(organizationId);
    const addonStats = await AddOnService.getOrganizationStats(organizationId);

    res.json({
      success: true,
      data: {
        applications: appStats,
        addons: addonStats,
        totalApps: appStats.totalApps,
        totalAddOns: addonStats.totalAddOns,
        activeApps: appStats.deployedApps,
        activeAddOns: addonStats.activeAddOns,
        totalDeployments: appStats.totalDeployments,
        monthlySpend: appStats.monthlySpend + addonStats.monthlySpend
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

export default router;
