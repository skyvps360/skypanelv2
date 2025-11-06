import express, { Request, Response } from 'express';
import { authenticateToken, requireOrganization, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { encryptSecret, decryptSecret } from '../lib/crypto.js';
import { caasService, type CaasConfig } from '../services/caasService.js';
import { logActivity } from '../services/activityLogger.js';
import { ContainerPlanService } from '../services/containerPlanService.js';
import { ResourceQuotaService } from '../services/resourceQuotaService.js';
import { ContainerTemplateService } from '../services/containerTemplateService.js';
import { templateDeploymentService } from '../services/templateDeploymentService.js';
import { 
  ContainerServiceError, 
  formatErrorResponse, 
  ERROR_CODES 
} from '../lib/containerErrors.js';
import { validateCaasConfig, validateCreateContainerPlan } from '../middleware/containerValidation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, requireOrganization);

// Admin role check middleware for admin routes
const requireAdminRole = requireAdmin;

// Global error handler for container routes
function handleContainerError(error: any, req: Request, res: Response, _next: any) {
  console.error('Container route error:', error);

  if (error instanceof ContainerServiceError) {
    return res.status(error.statusCode).json(formatErrorResponse(error));
  }

  // Handle database errors
  if (error.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      error: {
        code: ERROR_CODES.DEPLOYMENT_FAILED,
        message: 'Resource already exists with that name',
        details: { constraint: error.constraint }
      }
    });
  }

  if (error.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      error: {
        code: ERROR_CODES.DEPLOYMENT_FAILED,
        message: 'Referenced resource not found',
        details: { constraint: error.constraint }
      }
    });
  }

  // Generic error fallback
  return res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    }
  });
}

// ============================================================
// Configuration Routes
// ============================================================

/**
 * GET /api/containers/admin/config
 * Get CaaS configuration
 * Admin only
 */
router.get('/admin/config', requireAdminRole, async (_req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const summary = await caasService.getConfigSummary();

    if (!summary) {
      return res.json({
        config: {
          apiUrl: '',
          hasApiKey: false,
          lastConnectionTest: null,
          connectionStatus: null,
          source: 'none'
        }
      });
    }

    let normalizedStatus: string | null = null;
    if (summary.connectionStatus === 'connected') {
      normalizedStatus = 'success';
    } else if (summary.connectionStatus === 'failed') {
      normalizedStatus = 'failed';
    } else if (summary.connectionStatus) {
      normalizedStatus = summary.connectionStatus;
    }

    res.json({
      config: {
        apiUrl: summary.apiUrl,
        hasApiKey: summary.hasApiKey,
        lastConnectionTest: summary.lastConnectionTest,
        connectionStatus: normalizedStatus,
        source: summary.source
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/containers/admin/config
 * Update CaaS configuration with encryption
 * Admin only
 */
router.post('/admin/config', requireAdminRole, validateCaasConfig, async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { apiUrl, apiKey } = req.body;

    // Use caasService to update config
    await caasService.updateConfig(apiUrl, apiKey);

    // Log the configuration update
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.config.update',
      entityType: 'caas_config',
      entityId: null,
      metadata: { apiUrl }
    });

    res.json({
      success: true,
      message: 'Container platform configuration updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/containers/admin/config/test
 * Test CaaS connection
 * Admin only
 */
router.post('/admin/config/test', requireAdminRole, async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const testResult = await caasService.testConnection();

    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.config.test',
      entityType: 'caas_config',
      entityId: null,
      status: testResult.success ? 'success' : 'error',
      metadata: { 
        status: testResult.success ? 'success' : 'failed',
        message: testResult.message,
        version: testResult.version
      }
    });

    if (testResult.success) {
      return res.json({
        success: true,
        message: testResult.message,
        status: 'success',
        version: testResult.version
      });
    }

    return res.status(400).json({
      error: {
        code: ERROR_CODES.CAAS_CONNECTION_FAILED,
        message: testResult.message,
        details: { status: 'failed' }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/containers/admin/config/detect
 * Detect available Docker connection methods
 * Admin only
 */
router.get('/admin/config/detect', requireAdminRole, async (_req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const detected = await caasService.detectDockerSetup();
    
    res.json({
      success: true,
      detected: detected.detected,
      socketPath: detected.socketPath,
      tcpUrl: detected.tcpUrl,
      recommendations: {
        preferred: detected.socketPath ? detected.socketPath : detected.tcpUrl,
        connectionType: detected.socketPath ? 'socket' : 'tcp'
      }
    });
  } catch (error) {
    next(error);
  }
});



// ============================================================
// Plan Management Routes
// ============================================================

/**
 * GET /api/containers/plans
 * List active container plans for users
 */
router.get('/plans', async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const plans = await ContainerPlanService.listPlans(true); // Only active plans for users
    
    res.json({
      plans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/containers/admin/plans
 * List all container plans for admin
 */
router.get('/admin/plans', requireAdminRole, async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const plans = await ContainerPlanService.listPlans(false); // All plans for admin
    
    res.json({
      plans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/containers/admin/plans
 * Create a new container plan
 */
router.post('/admin/plans', requireAdminRole, validateCreateContainerPlan, async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { name, description, priceMonthly, maxCpuCores, maxMemoryGb, maxStorageGb, maxContainers, maxProjects } = req.body;

    const plan = await ContainerPlanService.createPlan({
      name,
      description,
      priceMonthly,
      maxCpuCores,
      maxMemoryGb,
      maxStorageGb,
      maxContainers,
      maxProjects: maxProjects || 1
    });

    // Log the plan creation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.plan.create',
      entityType: 'container_plan',
      entityId: plan.id,
      metadata: { 
        planName: plan.name,
        priceMonthly: plan.priceMonthly,
        maxCpuCores: plan.maxCpuCores,
        maxMemoryGb: plan.maxMemoryGb,
        maxStorageGb: plan.maxStorageGb,
        maxContainers: plan.maxContainers,
        maxProjects: plan.maxProjects
      }
    });

    res.status(201).json({
      plan
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/containers/admin/plans/:id
 * Update an existing container plan
 */
router.put('/admin/plans/:id', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, priceMonthly, maxCpuCores, maxMemoryGb, maxStorageGb, maxContainers, maxProjects } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID format'
        }
      });
    }

    // Validate data types if provided
    if (priceMonthly !== undefined && (typeof priceMonthly !== 'number' || priceMonthly < 0)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PRICE',
          message: 'Price must be a non-negative number'
        }
      });
    }

    if ((maxCpuCores !== undefined && (typeof maxCpuCores !== 'number' || maxCpuCores <= 0)) ||
        (maxMemoryGb !== undefined && (typeof maxMemoryGb !== 'number' || maxMemoryGb <= 0)) ||
        (maxStorageGb !== undefined && (!Number.isInteger(maxStorageGb) || maxStorageGb <= 0)) ||
        (maxContainers !== undefined && (!Number.isInteger(maxContainers) || maxContainers <= 0)) ||
        (maxProjects !== undefined && (!Number.isInteger(maxProjects) || maxProjects <= 0))) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESOURCE_LIMITS',
          message: 'CPU and Memory must be positive numbers, Storage/Containers/Projects must be positive integers'
        }
      });
    }

    const plan = await ContainerPlanService.updatePlan(id, {
      name,
      description,
      priceMonthly,
      maxCpuCores,
      maxMemoryGb,
      maxStorageGb,
      maxContainers,
      maxProjects
    });

    // Log the plan update
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.plan.update',
      entityType: 'container_plan',
      entityId: plan.id,
      metadata: { 
        planName: plan.name,
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({
      plan
    });
  } catch (error) {
    console.error('Failed to update container plan:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'Container plan not found'
          }
        });
      }
      
      if (error.message.includes('No fields to update')) {
        return res.status(400).json({
          error: {
            code: 'NO_FIELDS_TO_UPDATE',
            message: 'No valid fields provided for update'
          }
        });
      }
      
      if (error.message.includes('cannot be empty') || error.message.includes('positive')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'PLAN_UPDATE_FAILED',
        message: 'Failed to update container plan'
      }
    });
  }
});

/**
 * POST /api/containers/admin/plans/:id/activate
 * Activate a container plan
 */
router.post('/admin/plans/:id/activate', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID format'
        }
      });
    }

    await ContainerPlanService.activatePlan(id);

    // Get plan details for logging
    const plan = await ContainerPlanService.getPlan(id);

    // Log the plan activation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.plan.activate',
      entityType: 'container_plan',
      entityId: id,
      metadata: { 
        planName: plan?.name || 'Unknown'
      }
    });

    res.json({
      success: true,
      message: 'Container plan activated successfully'
    });
  } catch (error) {
    console.error('Failed to activate container plan:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Container plan not found'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'PLAN_ACTIVATE_FAILED',
        message: 'Failed to activate container plan'
      }
    });
  }
});

/**
 * POST /api/containers/admin/plans/:id/deactivate
 * Deactivate a container plan
 */
router.post('/admin/plans/:id/deactivate', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID format'
        }
      });
    }

    await ContainerPlanService.deactivatePlan(id);

    // Get plan details for logging
    const plan = await ContainerPlanService.getPlan(id);

    // Log the plan deactivation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.plan.deactivate',
      entityType: 'container_plan',
      entityId: id,
      metadata: { 
        planName: plan?.name || 'Unknown'
      }
    });

    res.json({
      success: true,
      message: 'Container plan deactivated successfully'
    });
  } catch (error) {
    console.error('Failed to deactivate container plan:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Container plan not found'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'PLAN_DEACTIVATE_FAILED',
        message: 'Failed to deactivate container plan'
      }
    });
  }
});

/**
 * DELETE /api/containers/admin/plans/:id
 * Delete a container plan
 * Only allows deletion if there are no active subscriptions
 */
router.delete('/admin/plans/:id', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID format'
        }
      });
    }

    // Get plan details for logging before deletion
    const plan = await ContainerPlanService.getPlan(id);
    
    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Container plan not found'
        }
      });
    }

    await ContainerPlanService.deletePlan(id);

    // Log the plan deletion
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.plan.delete',
      entityType: 'container_plan',
      entityId: id,
      metadata: { 
        planName: plan.name
      }
    });

    res.json({
      success: true,
      message: 'Container plan deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete container plan:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Container plan not found'
        }
      });
    }

    if (error instanceof Error && error.message.includes('active subscription')) {
      return res.status(400).json({
        error: {
          code: 'PLAN_HAS_SUBSCRIPTIONS',
          message: error.message
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'PLAN_DELETE_FAILED',
        message: 'Failed to delete container plan'
      }
    });
  }
});

// ============================================================
// Subscription Management Routes
// ============================================================

/**
 * GET /api/containers/subscription
 * Get current container subscription for the organization
 */
router.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    const subscription = await ContainerPlanService.getSubscription(organizationId);
    
    res.json({
      subscription
    });
  } catch (error) {
    console.error('Failed to get container subscription:', error);
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_FETCH_FAILED',
        message: 'Failed to fetch container subscription'
      }
    });
  }
});

/**
 * POST /api/containers/subscription
 * Subscribe to a container plan with wallet balance check
 */
router.post('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PLAN_ID',
          message: 'Plan ID is required'
        }
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(planId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID format'
        }
      });
    }

    const subscription = await ContainerPlanService.subscribe(organizationId, planId);

    // Log the subscription creation
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.subscription.create',
      entityType: 'container_subscription',
      entityId: subscription.id,
      metadata: { 
        planId: subscription.planId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

    res.status(201).json({
      subscription
    });
  } catch (error) {
    console.error('Failed to create container subscription:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already has an active')) {
        return res.status(409).json({
          error: {
            code: 'SUBSCRIPTION_EXISTS',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'PLAN_NOT_FOUND',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('not active')) {
        return res.status(400).json({
          error: {
            code: 'PLAN_INACTIVE',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('Insufficient wallet balance')) {
        return res.status(402).json({
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('Failed to deduct')) {
        return res.status(402).json({
          error: {
            code: 'PAYMENT_FAILED',
            message: error.message
          }
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_CREATE_FAILED',
        message: 'Failed to create container subscription'
      }
    });
  }
});

/**
 * DELETE /api/containers/subscription
 * Cancel the current container subscription
 */
router.delete('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    
    // Get current subscription
    const subscription = await ContainerPlanService.getSubscription(organizationId);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No active subscription found'
        }
      });
    }

    const { refundAmount, projectsDeleted } = await ContainerPlanService.cancelSubscription(subscription.id);

    // Log the subscription cancellation
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.subscription.cancel',
      entityType: 'container_subscription',
      entityId: subscription.id,
      metadata: { 
        planId: subscription.planId,
        cancelledAt: new Date().toISOString(),
        refundAmount,
        projectsDeleted
      }
    });

    res.json({
      success: true,
      message: refundAmount > 0 
        ? `Container subscription cancelled successfully. $${refundAmount.toFixed(2)} has been refunded to your wallet.`
        : 'Container subscription cancelled successfully.',
      refundAmount,
      projectsDeleted
    });
  } catch (error) {
    console.error('Failed to cancel container subscription:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('not active')) {
        return res.status(400).json({
          error: {
            code: 'SUBSCRIPTION_NOT_ACTIVE',
            message: error.message
          }
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_CANCEL_FAILED',
        message: 'Failed to cancel container subscription'
      }
    });
  }
});

/**
 * GET /api/containers/subscription/usage
 * Get resource usage for the current subscription
 */
router.get('/subscription/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;

    // Provide sane defaults when a subscription is not yet active
    const zeroUsage = {
      cpuCores: 0,
      memoryGb: 0,
      storageGb: 0,
      containerCount: 0
    };
    const zeroPercentages = {
      cpu: 0,
      memory: 0,
      storage: 0,
      containers: 0
    };

    const subscription = await ContainerPlanService.getSubscription(organizationId);

    if (!subscription) {
      return res.json({
        subscription: null,
        usage: zeroUsage,
        quota: { ...zeroUsage },
        percentages: zeroPercentages
      });
    }

    const usageSummary = await ResourceQuotaService.getResourceUsageSummary(organizationId);

    const quota = usageSummary.planLimits || { ...zeroUsage };
    const percentages = usageSummary.usagePercentages ? {
      cpu: usageSummary.usagePercentages.cpuCores,
      memory: usageSummary.usagePercentages.memoryGb,
      storage: usageSummary.usagePercentages.storageGb,
      containers: usageSummary.usagePercentages.containerCount
    } : zeroPercentages;

    res.json({
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd
      },
      usage: usageSummary.currentUsage,
      quota,
      percentages
    });
  } catch (error) {
    console.error('Failed to get subscription usage:', error);
    res.status(500).json({
      error: {
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to fetch subscription usage'
      }
    });
  }
});

// ============================================================
// Project Management Routes
// ============================================================

/**
 * GET /api/containers/projects
 * List user projects
 */
router.get('/projects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    
    // Check if organization has an active subscription
    const subscription = await ContainerPlanService.getSubscription(organizationId);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No active container subscription found'
        }
      });
    }

    // Get projects from database
    const result = await query(
      `SELECT cp.*, 
              COUNT(cs.id) as service_count
       FROM container_projects cp
       LEFT JOIN container_services cs ON cp.id = cs.project_id
       WHERE cp.organization_id = $1 AND cp.status = 'active'
       GROUP BY cp.id
       ORDER BY cp.created_at DESC`,
      [organizationId]
    );

    const projects = result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      subscriptionId: row.subscription_id,
      projectName: row.project_name,
      dokployProjectId: row.dokploy_project_id,
      status: row.status,
      metadata: row.metadata || {},
      serviceCount: parseInt(row.service_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      projects
    });
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({
      error: {
        code: 'PROJECTS_FETCH_FAILED',
        message: 'Failed to fetch projects'
      }
    });
  }
});

/**
 * POST /api/containers/projects
 * Create project with name validation
 */
router.post('/projects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate required fields
    if (!projectName) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PROJECT_NAME',
          message: 'Project name is required'
        }
      });
    }

    // Validate project name pattern
    const projectNamePattern = /^[a-z0-9-_]+$/;
    if (!projectNamePattern.test(projectName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PROJECT_NAME',
          message: 'Project name must contain only lowercase letters, numbers, hyphens, and underscores'
        }
      });
    }

    // Check if organization has an active subscription
    const subscription = await ContainerPlanService.getSubscription(organizationId);
    
    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No active container subscription found'
        }
      });
    }

    // Check if project name already exists for this organization
    const existingResult = await query(
      'SELECT id FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'PROJECT_NAME_EXISTS',
          message: 'A project with this name already exists'
        }
      });
    }

    // Create project in container platform
    const dokployProjectId = `${organizationId.substring(0, 8)}-${projectName}`;
    
    try {
      await caasService.createProject(dokployProjectId, req.user!.id);
      // CaaS: Project access managed via Docker networks
    } catch (caasError) {
      console.error('Failed to create project:', caasError);
      return res.status(500).json({
        error: {
          code: 'CAAS_PROJECT_CREATE_FAILED',
          message: 'Failed to create project',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Create project record in database
    const insertResult = await query(
      `INSERT INTO container_projects (organization_id, subscription_id, project_name, dokploy_project_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [organizationId, subscription.id, projectName, dokployProjectId, 'active', {}]
    );

    const project = {
      id: insertResult.rows[0].id,
      organizationId: insertResult.rows[0].organization_id,
      subscriptionId: insertResult.rows[0].subscription_id,
      projectName: insertResult.rows[0].project_name,
      dokployProjectId: insertResult.rows[0].dokploy_project_id,
      status: insertResult.rows[0].status,
      metadata: insertResult.rows[0].metadata || {},
      serviceCount: 0,
      createdAt: insertResult.rows[0].created_at,
      updatedAt: insertResult.rows[0].updated_at
    };

    // Log the project creation
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.project.create',
      entityType: 'container_project',
      entityId: project.id,
      metadata: { 
        projectName: project.projectName,
        dokployProjectId: project.dokployProjectId
      }
    });

    res.status(201).json({
      project
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({
      error: {
        code: 'PROJECT_CREATE_FAILED',
        message: 'Failed to create project'
      }
    });
  }
});

/**
 * GET /api/containers/projects/:projectName
 * Get project details
 */
router.get('/projects/:projectName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      `SELECT cp.*, 
              COUNT(cs.id) as service_count
       FROM container_projects cp
       LEFT JOIN container_services cs ON cp.id = cs.project_id
       WHERE cp.organization_id = $1 AND cp.project_name = $2 AND cp.status = 'active'
       GROUP BY cp.id`,
      [organizationId, projectName]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const projectRow = projectResult.rows[0];

    // Get project details from Easypanel
    let easypanelProject = null;
    try {
      easypanelProject = await caasService.getProjectDetail(projectRow.dokploy_project_id);
    } catch (caasError) {
      console.error('Failed to get project details from Easypanel:', caasError);
      // Continue without Easypanel data - project might be in database but not in Easypanel
    }

    // Get services for this project
    const servicesResult = await query(
      `SELECT * FROM container_services 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [projectRow.id]
    );

    const services = servicesResult.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      serviceName: row.service_name,
      dokployApplicationId: row.dokploy_application_id,
      serviceType: row.service_type,
      status: row.status,
      cpuLimit: row.cpu_limit,
      memoryLimitGb: row.memory_limit_gb,
      storageLimitGb: row.storage_limit_gb,
      configuration: row.configuration || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const project = {
      id: projectRow.id,
      organizationId: projectRow.organization_id,
      subscriptionId: projectRow.subscription_id,
      projectName: projectRow.project_name,
      dokployProjectId: projectRow.dokploy_project_id,
      status: projectRow.status,
      metadata: projectRow.metadata || {},
      serviceCount: parseInt(projectRow.service_count) || 0,
      services: services,
      easypanelData: easypanelProject,
      createdAt: projectRow.created_at,
      updatedAt: projectRow.updated_at
    };

    res.json({
      project
    });
  } catch (error) {
    console.error('Failed to get project details:', error);
    res.status(500).json({
      error: {
        code: 'PROJECT_FETCH_FAILED',
        message: 'Failed to fetch project details'
      }
    });
  }
});

/**
 * DELETE /api/containers/projects/:projectName
 * Delete project with service check
 */
router.delete('/projects/:projectName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      `SELECT cp.*, COUNT(cs.id) as service_count
       FROM container_projects cp
       LEFT JOIN container_services cs ON cp.id = cs.project_id
       WHERE cp.organization_id = $1 AND cp.project_name = $2 AND cp.status = 'active'
       GROUP BY cp.id`,
      [organizationId, projectName]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];
    const serviceCount = parseInt(project.service_count) || 0;

    // Check if project has any services
    if (serviceCount > 0) {
      return res.status(409).json({
        error: {
          code: 'PROJECT_HAS_SERVICES',
          message: 'Cannot delete project that contains services. Please delete all services first.'
        }
      });
    }

    // Delete project from Easypanel
    try {
      await caasService.deleteProject(project.dokploy_project_id);
    } catch (caasError) {
      console.error('Failed to delete project from Easypanel:', caasError);
      // Continue with database deletion even if Easypanel deletion fails
      // The project might not exist in Easypanel anymore
    }

    // Mark project as deleted in database (soft delete)
    await query(
      `UPDATE container_projects 
       SET status = 'deleted', updated_at = NOW()
       WHERE id = $1`,
      [project.id]
    );

    // Log the project deletion
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.project.delete',
      entityType: 'container_project',
      entityId: project.id,
      metadata: { 
        projectName: project.project_name,
        dokployProjectId: project.dokploy_project_id
      }
    });

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({
      error: {
        code: 'PROJECT_DELETE_FAILED',
        message: 'Failed to delete project'
      }
    });
  }
});

/**
 * PUT /api/containers/projects/:projectName/env
 * Update project environment variables
 */
router.put('/projects/:projectName/env', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const { environmentVariables } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate environment variables
    if (!environmentVariables || typeof environmentVariables !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_ENVIRONMENT_VARIABLES',
          message: 'Environment variables must be provided as an object'
        }
      });
    }

    // Validate that all values are strings
    for (const [key, value] of Object.entries(environmentVariables)) {
      if (typeof value !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_ENV_VALUE',
            message: `Environment variable '${key}' must be a string`
          }
        });
      }
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Update environment variables in Easypanel
    try {
      // CaaS: Environment variables are per-service, not per-project
    } catch (caasError) {
      console.error('Failed to update project environment in Easypanel:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_ENV_UPDATE_FAILED',
          message: 'Failed to update project environment in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update metadata in database
    const updatedMetadata = {
      ...project.metadata,
      environmentVariables: environmentVariables,
      lastEnvUpdate: new Date().toISOString()
    };

    await query(
      `UPDATE container_projects 
       SET metadata = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updatedMetadata), project.id]
    );

    // Log the environment update
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.project.env.update',
      entityType: 'container_project',
      entityId: project.id,
      metadata: { 
        projectName: project.project_name,
        envVariableCount: Object.keys(environmentVariables).length
      }
    });

    res.json({
      success: true,
      message: 'Project environment variables updated successfully',
      environmentVariables: environmentVariables
    });
  } catch (error) {
    console.error('Failed to update project environment:', error);
    res.status(500).json({
      error: {
        code: 'PROJECT_ENV_UPDATE_FAILED',
        message: 'Failed to update project environment variables'
      }
    });
  }
});

// ============================================================
// Service Management Routes
// ============================================================

/**
 * GET /api/containers/projects/:projectName/services
 * List services within a project
 */
router.get('/projects/:projectName/services', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get services from database
    const servicesResult = await query(
      `SELECT * FROM container_services 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [project.id]
    );

    // Get services from Easypanel for real-time status
    let containerServices = [];
    try {
      const easypanelProject = await caasService.listProjects();
      const projectData = easypanelProject.find(p => p.name === project.dokploy_project_id);
      if (projectData && projectData.services) {
        containerServices = projectData.services;
      }
    } catch (caasError) {
      console.error('Failed to get services from Easypanel:', caasError);
      // Continue without real-time data
    }

    // Merge database and Easypanel data
    const services = servicesResult.rows.map(row => {
      const containerService = containerServices.find(es => es.name === row.dokploy_application_id);
      
      return {
        id: row.id,
        projectId: row.project_id,
        serviceName: row.service_name,
        dokployApplicationId: row.dokploy_application_id,
        serviceType: row.service_type,
        status: containerService?.status || row.status,
        cpuLimit: row.cpu_limit,
        memoryLimitGb: row.memory_limit_gb,
        storageLimitGb: row.storage_limit_gb,
        configuration: row.configuration || {},
        easypanelData: containerService || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    res.json({
      project: {
        id: project.id,
        projectName: project.project_name,
        dokployProjectId: project.dokploy_project_id
      },
      services
    });
  } catch (error) {
    console.error('Failed to list services:', error);
    res.status(500).json({
      error: {
        code: 'SERVICES_FETCH_FAILED',
        message: 'Failed to fetch services'
      }
    });
  }
});

/**
 * GET /api/containers/projects/:projectName/services/:serviceName
 * Get service details
 */
router.get('/projects/:projectName/services/:serviceName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const serviceRow = serviceResult.rows[0];

    // Get detailed service information from Easypanel
    let caasServiceDetail = null;
    try {
      if (serviceRow.service_type === 'app') {
        // CaaS: Service details retrieved differently
      }
      // For database services, we might need different inspection methods
      // This can be extended based on Easypanel API capabilities
    } catch (caasError) {
      console.error('Failed to get service details from Easypanel:', caasError);
      // Continue without detailed Easypanel data
    }

    const service = {
      id: serviceRow.id,
      projectId: serviceRow.project_id,
      serviceName: serviceRow.service_name,
      dokployApplicationId: serviceRow.dokploy_application_id,
      serviceType: serviceRow.service_type,
      status: serviceRow.status,
      cpuLimit: serviceRow.cpu_limit,
      memoryLimitGb: serviceRow.memory_limit_gb,
      storageLimitGb: serviceRow.storage_limit_gb,
      configuration: serviceRow.configuration || {},
      easypanelData: containerServiceDetail,
      project: {
        id: project.id,
        projectName: project.project_name,
        dokployProjectId: project.dokploy_project_id
      },
      createdAt: serviceRow.created_at,
      updatedAt: serviceRow.updated_at
    };

    res.json({
      service
    });
  } catch (error) {
    console.error('Failed to get service details:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_FETCH_FAILED',
        message: 'Failed to fetch service details'
      }
    });
  }
});

/**
 * GET /api/containers/projects/:projectName/services/:serviceName/logs
 * Get service logs
 */
router.get('/projects/:projectName/services/:serviceName/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const { lines = 100 } = req.query;
    const organizationId = req.user!.organizationId!;

    // Validate lines parameter
    const logLines = parseInt(lines as string) || 100;
    if (logLines < 1 || logLines > 1000) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LINES_PARAMETER',
          message: 'Lines parameter must be between 1 and 1000'
        }
      });
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Get logs from Easypanel
    let logs = [];
    let error = null;
    
    try {
      // Get Docker containers for this service to retrieve logs
      // CaaS: Docker containers managed directly
      
      if (containers && containers.length > 0) {
        // For now, we'll return container information
        // In a real implementation, you'd need to get actual logs from Docker
        logs = containers.map(container => ({
          containerId: container.id,
          containerName: container.name,
          status: container.status,
          created: container.created,
          // Placeholder for actual log entries
          // Real implementation would fetch logs from Docker API
          entries: [
            {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Container ${container.name} is ${container.status}`
            }
          ]
        }));
      }
    } catch (caasError) {
      console.error('Failed to get logs from Easypanel:', caasError);
      error = {
        code: 'LOGS_FETCH_FAILED',
        message: 'Failed to fetch logs from container service',
        details: caasError instanceof Error ? caasError.message : 'Unknown error'
      };
    }

    // Check for service errors
    let serviceError = null;
    try {
        // CaaS: Service errors retrieved from Docker logs
    } catch (errorCheckError) {
      console.error('Failed to check service errors:', errorCheckError);
    }

    res.json({
      service: {
        id: service.id,
        serviceName: service.service_name,
        serviceType: service.service_type,
        status: service.status
      },
      logs: logs,
      serviceError: serviceError,
      error: error,
      metadata: {
        requestedLines: logLines,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get service logs:', error);
    res.status(500).json({
      error: {
        code: 'LOGS_FETCH_FAILED',
        message: 'Failed to fetch service logs'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/app
 * Deploy app service with quota validation
 */
router.post('/projects/:projectName/services/app', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const { serviceName, source, env, domains, mounts, deploy, resources } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate required fields
    if (!serviceName || !source) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Service name and source configuration are required'
        }
      });
    }

    // Validate service name pattern
    const serviceNamePattern = /^[a-z0-9-_]+$/;
    if (!serviceNamePattern.test(serviceName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SERVICE_NAME',
          message: 'Service name must contain only lowercase letters, numbers, hyphens, and underscores'
        }
      });
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Check if service name already exists in this project
    const existingServiceResult = await query(
      'SELECT id FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (existingServiceResult.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'SERVICE_NAME_EXISTS',
          message: 'A service with this name already exists in the project'
        }
      });
    }

    // Validate resource quotas
    const resourceRequirement = {
      cpuCores: resources?.cpuLimit || 0.5,
      memoryGb: resources?.memoryLimit ? resources.memoryLimit / 1024 : 0.5,
      storageGb: 1, // Default storage for app services
      containerCount: 1
    };

    const quotaCheck = await ResourceQuotaService.checkQuotaAvailability(organizationId, resourceRequirement);
    
    if (!quotaCheck.allowed) {
      return res.status(409).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Deployment would exceed resource quotas',
          details: {
            exceededQuotas: quotaCheck.exceededQuotas,
            availableResources: quotaCheck.availableResources
          }
        }
      });
    }

    // Prepare app service configuration
    const dokployApplicationId = `${serviceName}`;
    const appConfig = {
      serviceName: dokployApplicationId,
      source: source,
      env: env || {},
      domains: domains || [],
      mounts: mounts || [],
      deploy: deploy || {},
      resources: resources || {}
    };

    // Create app service in Easypanel
    try {
      await caasService.deployApp({...appConfig, project: projectRow.project_name});
    } catch (caasError) {
      console.error('Failed to create app service in Easypanel:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_SERVICE_CREATE_FAILED',
          message: 'Failed to create app service in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Create service record in database
    const insertResult = await query(
      `INSERT INTO container_services (project_id, service_name, dokploy_application_id, service_type, status, cpu_limit, memory_limit_gb, storage_limit_gb, configuration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.id,
        serviceName,
        dokployApplicationId,
        'app',
        'deploying',
        resourceRequirement.cpuCores,
        resourceRequirement.memoryGb,
        resourceRequirement.storageGb,
        JSON.stringify(appConfig)
      ]
    );

    const service = {
      id: insertResult.rows[0].id,
      projectId: insertResult.rows[0].project_id,
      serviceName: insertResult.rows[0].service_name,
      dokployApplicationId: insertResult.rows[0].dokploy_application_id,
      serviceType: insertResult.rows[0].service_type,
      status: insertResult.rows[0].status,
      cpuLimit: insertResult.rows[0].cpu_limit,
      memoryLimitGb: insertResult.rows[0].memory_limit_gb,
      storageLimitGb: insertResult.rows[0].storage_limit_gb,
      configuration: insertResult.rows[0].configuration,
      createdAt: insertResult.rows[0].created_at,
      updatedAt: insertResult.rows[0].updated_at
    };

    // Log the service deployment
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.create',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        sourceType: source.type
      }
    });

    res.status(201).json({
      service
    });
  } catch (error) {
    console.error('Failed to deploy app service:', error);
    res.status(500).json({
      error: {
        code: 'APP_SERVICE_DEPLOY_FAILED',
        message: 'Failed to deploy app service'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/database
 * Deploy database service with quota validation
 */
router.post('/projects/:projectName/services/database', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const { serviceName, databaseType, version, credentials, resources } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate required fields
    if (!serviceName || !databaseType) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Service name and database type are required'
        }
      });
    }

    // Validate service name pattern
    const serviceNamePattern = /^[a-z0-9-_]+$/;
    if (!serviceNamePattern.test(serviceName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SERVICE_NAME',
          message: 'Service name must contain only lowercase letters, numbers, hyphens, and underscores'
        }
      });
    }

    // Validate database type
    const validDatabaseTypes = ['postgres', 'mysql', 'mariadb', 'mongo', 'redis'];
    if (!validDatabaseTypes.includes(databaseType)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATABASE_TYPE',
          message: `Database type must be one of: ${validDatabaseTypes.join(', ')}`
        }
      });
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Check if service name already exists in this project
    const existingServiceResult = await query(
      'SELECT id FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (existingServiceResult.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'SERVICE_NAME_EXISTS',
          message: 'A service with this name already exists in the project'
        }
      });
    }

    // Validate resource quotas
    const resourceRequirement = {
      cpuCores: resources?.cpuLimit || 0.5,
      memoryGb: resources?.memoryLimit ? resources.memoryLimit / 1024 : 1,
      storageGb: resources?.storageLimit || 5,
      containerCount: 1
    };

    const quotaCheck = await ResourceQuotaService.checkQuotaAvailability(organizationId, resourceRequirement);
    
    if (!quotaCheck.allowed) {
      return res.status(409).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Deployment would exceed resource quotas',
          details: {
            exceededQuotas: quotaCheck.exceededQuotas,
            availableResources: quotaCheck.availableResources
          }
        }
      });
    }

    // Prepare database service configuration
    const dokployApplicationId = `${serviceName}`;
    
    // Generate default password if not provided
    const defaultPassword = credentials?.password || `${serviceName}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create database service in Easypanel based on type
    try {
      switch (databaseType) {
        case 'postgres': {
          const postgresConfig = {
            serviceName: dokployApplicationId,
            password: defaultPassword,
            database: credentials?.database || serviceName,
            user: credentials?.user || 'postgres',
            resources: resources || {}
          };
          await caasService.deployDatabase({type: "postgres", ...postgresConfig, project: projectRow.project_name, serviceName: serviceName});
          break;
        }
        case 'mysql': {
          const mysqlConfig = {
            serviceName: dokployApplicationId,
            password: defaultPassword,
            database: credentials?.database || serviceName,
            user: credentials?.user || 'mysql',
            resources: resources || {}
          };
          await caasService.deployDatabase({type: "mysql", ...mysqlConfig, project: projectRow.project_name, serviceName: serviceName});
          break;
        }
        case 'mariadb': {
          const mariadbConfig = {
            serviceName: dokployApplicationId,
            password: defaultPassword,
            database: credentials?.database || serviceName,
            user: credentials?.user || 'mariadb',
            resources: resources || {}
          };
          await caasService.deployDatabase({type: "mariadb", ...mariadbConfig, project: projectRow.project_name, serviceName: serviceName});
          break;
        }
        case 'mongo': {
          const mongoConfig = {
            serviceName: dokployApplicationId,
            password: defaultPassword,
            database: credentials?.database || serviceName,
            user: credentials?.user || 'mongo',
            resources: resources || {}
          };
          await caasService.deployDatabase({type: "mongo", ...mongoConfig, project: projectRow.project_name, serviceName: serviceName});
          break;
        }
        case 'redis': {
          const redisConfig = {
            serviceName: dokployApplicationId,
            password: credentials?.password, // Redis password is optional
            resources: resources || {}
          };
          await caasService.deployDatabase({type: "redis", ...redisConfig, project: projectRow.project_name, serviceName: serviceName});
          break;
        }
        default:
          throw new Error(`Unsupported database type: ${databaseType}`);
      }
    } catch (caasError) {
      console.error('Failed to create database service in Easypanel:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_DATABASE_CREATE_FAILED',
          message: 'Failed to create database service in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Create service record in database
    const insertResult = await query(
      `INSERT INTO container_services (project_id, service_name, dokploy_application_id, service_type, status, cpu_limit, memory_limit_gb, storage_limit_gb, configuration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.id,
        serviceName,
        dokployApplicationId,
        databaseType,
        'deploying',
        resourceRequirement.cpuCores,
        resourceRequirement.memoryGb,
        resourceRequirement.storageGb,
        JSON.stringify({
          databaseType: databaseType,
          version: version || 'latest',
          credentials: {
            password: defaultPassword,
            database: credentials?.database || serviceName,
            user: credentials?.user || (databaseType === 'postgres' ? 'postgres' : databaseType)
          },
          resources: resources || {}
        })
      ]
    );

    const service = {
      id: insertResult.rows[0].id,
      projectId: insertResult.rows[0].project_id,
      serviceName: insertResult.rows[0].service_name,
      dokployApplicationId: insertResult.rows[0].dokploy_application_id,
      serviceType: insertResult.rows[0].service_type,
      status: insertResult.rows[0].status,
      cpuLimit: insertResult.rows[0].cpu_limit,
      memoryLimitGb: insertResult.rows[0].memory_limit_gb,
      storageLimitGb: insertResult.rows[0].storage_limit_gb,
      configuration: insertResult.rows[0].configuration,
      createdAt: insertResult.rows[0].created_at,
      updatedAt: insertResult.rows[0].updated_at
    };

    // Log the service deployment
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.create',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        databaseType: databaseType,
        version: version
      }
    });

    res.status(201).json({
      service
    });
  } catch (error) {
    console.error('Failed to deploy database service:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_SERVICE_DEPLOY_FAILED',
        message: 'Failed to deploy database service'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/template
 * Deploy from template with quota validation
 */
router.post('/projects/:projectName/services/template', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName } = req.params;
    const { serviceName, templateName, templateConfig } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate required fields
    if (!serviceName || !templateName) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Service name and template name are required'
        }
      });
    }

    // Validate service name pattern
    const serviceNamePattern = /^[a-z0-9-_]+$/;
    if (!serviceNamePattern.test(serviceName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SERVICE_NAME',
          message: 'Service name must contain only lowercase letters, numbers, hyphens, and underscores'
        }
      });
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Check if service name already exists in this project
    const existingServiceResult = await query(
      'SELECT id FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (existingServiceResult.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'SERVICE_NAME_EXISTS',
          message: 'A service with this name already exists in the project'
        }
      });
    }

    // Get template from database to verify it's enabled
    const templateResult = await query(
      'SELECT * FROM container_templates WHERE template_name = $1 AND enabled = true',
      [templateName]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found or not enabled'
        }
      });
    }

    const template = templateResult.rows[0];

    // Estimate resource requirements from template (this would need to be enhanced based on template schema)
    const resourceRequirement = {
      cpuCores: templateConfig?.resources?.cpuLimit || 0.5,
      memoryGb: templateConfig?.resources?.memoryLimit ? templateConfig.resources.memoryLimit / 1024 : 0.5,
      storageGb: templateConfig?.resources?.storageLimit || 2,
      containerCount: 1
    };

    // Validate resource quotas
    const quotaCheck = await ResourceQuotaService.checkQuotaAvailability(organizationId, resourceRequirement);
    
    if (!quotaCheck.allowed) {
      return res.status(409).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Deployment would exceed resource quotas',
          details: {
            exceededQuotas: quotaCheck.exceededQuotas,
            availableResources: quotaCheck.availableResources
          }
        }
      });
    }

    // Deploy template via Dokploy
    let deploymentResult;
    try {
      deploymentResult = await templateDeploymentService.deployTemplate({
        projectId: project.dokploy_project_id,
        projectName: project.project_name,
        organizationId,
        primaryServiceName: serviceName,
        template: {
          id: template.id,
          templateName: template.template_name,
          displayName: template.display_name,
          description: template.description,
          category: template.category,
          templateSchema: template.template_schema,
          enabled: template.enabled,
          displayOrder: template.display_order,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
        },
        overrides: templateConfig || undefined,
      });
    } catch (deploymentError) {
      console.error('Failed to deploy template via Dokploy:', deploymentError);
      return res.status(500).json({
        error: {
          code: 'DOKPLOY_TEMPLATE_DEPLOY_FAILED',
          message: 'Failed to deploy template using Dokploy',
          details: deploymentError instanceof Error ? deploymentError.message : 'Unknown error'
        }
      });
    }

    const dokployApplicationId = deploymentResult.primaryApplicationId;

    // Create service record in database
    const insertResult = await query(
      `INSERT INTO container_services (project_id, service_name, dokploy_application_id, service_type, status, cpu_limit, memory_limit_gb, storage_limit_gb, configuration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.id,
        serviceName,
        dokployApplicationId,
        'app', // Templates typically deploy as app services
        'deploying',
        resourceRequirement.cpuCores,
        resourceRequirement.memoryGb,
        resourceRequirement.storageGb,
        JSON.stringify({
          templateName,
          templateConfig,
          deployedServices: deploymentResult.deployedServices,
          contextSnapshot: deploymentResult.context,
        })
      ]
    );

    const service = {
      id: insertResult.rows[0].id,
      projectId: insertResult.rows[0].project_id,
      serviceName: insertResult.rows[0].service_name,
      dokployApplicationId: insertResult.rows[0].dokploy_application_id,
      serviceType: insertResult.rows[0].service_type,
      status: insertResult.rows[0].status,
      cpuLimit: insertResult.rows[0].cpu_limit,
      memoryLimitGb: insertResult.rows[0].memory_limit_gb,
      storageLimitGb: insertResult.rows[0].storage_limit_gb,
      configuration: insertResult.rows[0].configuration,
      createdAt: insertResult.rows[0].created_at,
      updatedAt: insertResult.rows[0].updated_at
    };

    // Log the service deployment
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.create',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        templateName: templateName,
        templateDisplayName: template.display_name
      }
    });

    res.status(201).json({
      service,
      template: {
        name: template.template_name,
        displayName: template.display_name,
        description: template.description
      }
    });
  } catch (error) {
    console.error('Failed to deploy from template:', error);
    res.status(500).json({
      error: {
        code: 'TEMPLATE_DEPLOY_FAILED',
        message: 'Failed to deploy from template'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/:serviceName/start
 * Start a service
 */
router.post('/projects/:projectName/services/:serviceName/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Start service
    try {
      await caasService.startService(service.dokploy_application_id);
    } catch (caasError) {
      console.error('Failed to start service:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_SERVICE_START_FAILED',
          message: 'Failed to start service in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update service status in database
    await query(
      'UPDATE container_services SET status = $1, updated_at = NOW() WHERE id = $2',
      ['starting', service.id]
    );

    // Log the service start
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.start',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type
      }
    });

    res.json({
      success: true,
      message: 'Service start initiated successfully',
      service: {
        id: service.id,
        serviceName: service.service_name,
        status: 'starting'
      }
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_START_FAILED',
        message: 'Failed to start service'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/:serviceName/stop
 * Stop a service
 */
router.post('/projects/:projectName/services/:serviceName/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Stop service
    try {
      await caasService.stopService(service.dokploy_application_id);
    } catch (caasError) {
      console.error('Failed to stop service:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_SERVICE_STOP_FAILED',
          message: 'Failed to stop service in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update service status in database
    await query(
      'UPDATE container_services SET status = $1, updated_at = NOW() WHERE id = $2',
      ['stopping', service.id]
    );

    // Log the service stop
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.stop',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type
      }
    });

    res.json({
      success: true,
      message: 'Service stop initiated successfully',
      service: {
        id: service.id,
        serviceName: service.service_name,
        status: 'stopping'
      }
    });
  } catch (error) {
    console.error('Failed to stop service:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_STOP_FAILED',
        message: 'Failed to stop service'
      }
    });
  }
});

/**
 * POST /api/containers/projects/:projectName/services/:serviceName/restart
 * Restart a service
 */
router.post('/projects/:projectName/services/:serviceName/restart', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Restart service
    try {
      await caasService.restartService(service.dokploy_application_id);
    } catch (caasError) {
      console.error('Failed to restart service:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_SERVICE_RESTART_FAILED',
          message: 'Failed to restart service in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update service status in database
    await query(
      'UPDATE container_services SET status = $1, updated_at = NOW() WHERE id = $2',
      ['restarting', service.id]
    );

    // Log the service restart
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.restart',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type
      }
    });

    res.json({
      success: true,
      message: 'Service restart initiated successfully',
      service: {
        id: service.id,
        serviceName: service.service_name,
        status: 'restarting'
      }
    });
  } catch (error) {
    console.error('Failed to restart service:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_RESTART_FAILED',
        message: 'Failed to restart service'
      }
    });
  }
});

/**
 * DELETE /api/containers/projects/:projectName/services/:serviceName
 * Delete a service
 */
router.delete('/projects/:projectName/services/:serviceName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const organizationId = req.user!.organizationId!;

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Delete service from Easypanel
    try {
      await caasService.deleteService(service.dokploy_application_id);
    } catch (caasError) {
      console.error('Failed to delete service from Easypanel:', caasError);
      // Continue with database deletion even if Easypanel deletion fails
      // The service might not exist in Easypanel anymore
    }

    // Delete service from database
    await query(
      'DELETE FROM container_services WHERE id = $1',
      [service.id]
    );

    // Log the service deletion
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.delete',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type,
        dokployApplicationId: service.dokploy_application_id
      }
    });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete service:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_DELETE_FAILED',
        message: 'Failed to delete service'
      }
    });
  }
});

/**
 * PUT /api/containers/projects/:projectName/services/:serviceName/env
 * Update service environment variables
 */
router.put('/projects/:projectName/services/:serviceName/env', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const { environmentVariables } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate environment variables
    if (!environmentVariables || typeof environmentVariables !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_ENVIRONMENT_VARIABLES',
          message: 'Environment variables must be provided as an object'
        }
      });
    }

    // Validate that all values are strings
    for (const [key, value] of Object.entries(environmentVariables)) {
      if (typeof value !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_ENV_VALUE',
            message: `Environment variable '${key}' must be a string`
          }
        });
      }
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Update environment variables in Easypanel
    try {
      await caasService.updateEnv(service.dokploy_application_id, environmentVariables
      );
    } catch (caasError) {
      console.error('Failed to update service environment:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_ENV_UPDATE_FAILED',
          message: 'Failed to update service environment in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update configuration in database
    const currentConfig = service.configuration || {};
    const updatedConfig = {
      ...currentConfig,
      env: environmentVariables,
      lastEnvUpdate: new Date().toISOString()
    };

    await query(
      'UPDATE container_services SET configuration = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedConfig), service.id]
    );

    // Log the environment update
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.env.update',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type,
        envVariableCount: Object.keys(environmentVariables).length
      }
    });

    res.json({
      success: true,
      message: 'Service environment variables updated successfully',
      environmentVariables: environmentVariables
    });
  } catch (error) {
    console.error('Failed to update service environment:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_ENV_UPDATE_FAILED',
        message: 'Failed to update service environment variables'
      }
    });
  }
});

/**
 * PUT /api/containers/projects/:projectName/services/:serviceName/resources
 * Update service resource limits
 */
router.put('/projects/:projectName/services/:serviceName/resources', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectName, serviceName } = req.params;
    const { resources } = req.body;
    const organizationId = req.user!.organizationId!;

    // Validate resources object
    if (!resources || typeof resources !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESOURCES',
          message: 'Resources configuration must be provided as an object'
        }
      });
    }

    // Validate resource values
    if (resources.cpuLimit !== undefined) {
      if (typeof resources.cpuLimit !== 'number' || resources.cpuLimit <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CPU_LIMIT',
            message: 'CPU limit must be a positive number'
          }
        });
      }
    }

    if (resources.memoryLimit !== undefined) {
      if (typeof resources.memoryLimit !== 'number' || resources.memoryLimit <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MEMORY_LIMIT',
            message: 'Memory limit must be a positive number (in MB)'
          }
        });
      }
    }

    if (resources.memoryReservation !== undefined) {
      if (typeof resources.memoryReservation !== 'number' || resources.memoryReservation <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MEMORY_RESERVATION',
            message: 'Memory reservation must be a positive number (in MB)'
          }
        });
      }
    }

    // Get project from database
    const projectResult = await query(
      'SELECT * FROM container_projects WHERE organization_id = $1 AND project_name = $2 AND status = $3',
      [organizationId, projectName, 'active']
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = projectResult.rows[0];

    // Get service from database
    const serviceResult = await query(
      'SELECT * FROM container_services WHERE project_id = $1 AND service_name = $2',
      [project.id, serviceName]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service not found'
        }
      });
    }

    const service = serviceResult.rows[0];

    // Calculate new resource requirements for quota validation
    const newResourceRequirement = {
      cpuCores: resources.cpuLimit || service.cpu_limit || 0.5,
      memoryGb: resources.memoryLimit ? resources.memoryLimit / 1024 : (service.memory_limit_gb || 0.5),
      storageGb: service.storage_limit_gb || 1,
      containerCount: 0 // Not changing container count
    };

    // Check if new resources would exceed quotas
    const quotaCheck = await ResourceQuotaService.checkQuotaAvailability(organizationId, {
      cpuCores: newResourceRequirement.cpuCores - (service.cpu_limit || 0),
      memoryGb: newResourceRequirement.memoryGb - (service.memory_limit_gb || 0),
      storageGb: 0, // Storage typically can't be changed for existing services
      containerCount: 0
    });

    if (!quotaCheck.allowed) {
      return res.status(409).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Resource update would exceed quotas',
          details: {
            exceededQuotas: quotaCheck.exceededQuotas,
            availableResources: quotaCheck.availableResources
          }
        }
      });
    }

    // Update resources in Easypanel
    try {
      await caasService.updateResources(service.dokploy_application_id, resources
      );
    } catch (caasError) {
      console.error('Failed to update service resources:', caasError);
      return res.status(500).json({
        error: {
          code: 'EASYPANEL_RESOURCES_UPDATE_FAILED',
          message: 'Failed to update service resources in Easypanel',
          details: caasError instanceof Error ? caasError.message : 'Unknown error'
        }
      });
    }

    // Update service record in database
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (resources.cpuLimit !== undefined) {
      updateFields.push(`cpu_limit = $${paramIndex++}`);
      updateValues.push(resources.cpuLimit);
    }

    if (resources.memoryLimit !== undefined) {
      updateFields.push(`memory_limit_gb = $${paramIndex++}`);
      updateValues.push(resources.memoryLimit / 1024); // Convert MB to GB
    }

    // Update configuration
    const currentConfig = service.configuration || {};
    const updatedConfig = {
      ...currentConfig,
      resources: {
        ...currentConfig.resources,
        ...resources
      },
      lastResourceUpdate: new Date().toISOString()
    };

    updateFields.push(`configuration = $${paramIndex++}`);
    updateValues.push(JSON.stringify(updatedConfig));

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(service.id);

    if (updateFields.length > 1) { // More than just updated_at
      await query(
        `UPDATE container_services SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    // Log the resource update
    await logActivity({
      userId: req.user!.id,
      organizationId: organizationId,
      eventType: 'container.service.resources.update',
      entityType: 'container_service',
      entityId: service.id,
      metadata: { 
        projectName: project.project_name,
        serviceName: service.service_name,
        serviceType: service.service_type,
        updatedResources: resources
      }
    });

    res.json({
      success: true,
      message: 'Service resources updated successfully',
      resources: resources
    });
  } catch (error) {
    console.error('Failed to update service resources:', error);
    res.status(500).json({
      error: {
        code: 'SERVICE_RESOURCES_UPDATE_FAILED',
        message: 'Failed to update service resources'
      }
    });
  }
});

// ============================================================
// Template Management Routes
// ============================================================

/**
 * GET /api/containers/templates
 * List enabled templates for users
 */
router.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await ContainerTemplateService.listEnabledTemplates();
    
    res.json({
      templates
    });
  } catch (error) {
    console.error('Failed to list container templates:', error);
    res.status(500).json({
      error: {
        code: 'TEMPLATES_FETCH_FAILED',
        message: 'Failed to fetch container templates'
      }
    });
  }
});

/**
 * GET /api/containers/admin/templates
 * List all templates for admin
 */
router.get('/admin/templates', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await ContainerTemplateService.listAllTemplates();
    
    res.json({
      templates
    });
  } catch (error) {
    console.error('Failed to list all container templates:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_TEMPLATES_FETCH_FAILED',
        message: 'Failed to fetch container templates'
      }
    });
  }
});

/**
 * POST /api/containers/admin/templates
 * Create a new container template
 */
router.post('/admin/templates', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateName, displayName, description, category, templateSchema, displayOrder } = req.body;

    // Validate required fields
    if (!templateName || !displayName || !templateSchema) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Template name, display name, and template schema are required'
        }
      });
    }

    // Validate template schema structure
    if (!templateSchema.services || !Array.isArray(templateSchema.services) || templateSchema.services.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEMPLATE_SCHEMA',
          message: 'Template schema must contain at least one service'
        }
      });
    }

    // Validate template name pattern
    const namePattern = /^[a-z0-9-_]+$/;
    if (!namePattern.test(templateName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEMPLATE_NAME',
          message: 'Template name must contain only lowercase letters, numbers, hyphens, and underscores'
        }
      });
    }

    // Validate display order if provided
    if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISPLAY_ORDER',
          message: 'Display order must be a non-negative integer'
        }
      });
    }

    const template = await ContainerTemplateService.createTemplate({
      templateName,
      displayName,
      description,
      category,
      templateSchema,
      displayOrder
    });

    // Log the template creation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.template.create',
      entityType: 'container_template',
      entityId: template.id,
      metadata: { 
        templateName: template.templateName,
        displayName: template.displayName,
        category: template.category,
        serviceCount: template.templateSchema.services.length
      }
    });

    res.status(201).json({
      template
    });
  } catch (error) {
    console.error('Failed to create container template:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: {
            code: 'TEMPLATE_NAME_EXISTS',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('required') || error.message.includes('must contain') || error.message.includes('cannot be empty')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'TEMPLATE_CREATE_FAILED',
        message: 'Failed to create container template'
      }
    });
  }
});

/**
 * PUT /api/containers/admin/templates/:id
 * Update an existing container template
 */
router.put('/admin/templates/:id', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { templateName, displayName, description, category, templateSchema, displayOrder } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEMPLATE_ID',
          message: 'Invalid template ID format'
        }
      });
    }

    // Validate template name pattern if provided
    if (templateName !== undefined) {
      const namePattern = /^[a-z0-9-_]+$/;
      if (!namePattern.test(templateName)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TEMPLATE_NAME',
            message: 'Template name must contain only lowercase letters, numbers, hyphens, and underscores'
          }
        });
      }
    }

    // Validate template schema if provided
    if (templateSchema !== undefined) {
      if (!templateSchema.services || !Array.isArray(templateSchema.services) || templateSchema.services.length === 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TEMPLATE_SCHEMA',
            message: 'Template schema must contain at least one service'
          }
        });
      }
    }

    // Validate display order if provided
    if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISPLAY_ORDER',
          message: 'Display order must be a non-negative integer'
        }
      });
    }

    const template = await ContainerTemplateService.updateTemplate(id, {
      templateName,
      displayName,
      description,
      category,
      templateSchema,
      displayOrder
    });

    // Log the template update
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.template.update',
      entityType: 'container_template',
      entityId: template.id,
      metadata: { 
        templateName: template.templateName,
        displayName: template.displayName,
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({
      template
    });
  } catch (error) {
    console.error('Failed to update container template:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Container template not found'
          }
        });
      }
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: {
            code: 'TEMPLATE_NAME_EXISTS',
            message: error.message
          }
        });
      }
      
      if (error.message.includes('No fields to update')) {
        return res.status(400).json({
          error: {
            code: 'NO_FIELDS_TO_UPDATE',
            message: 'No valid fields provided for update'
          }
        });
      }
      
      if (error.message.includes('cannot be empty') || error.message.includes('must contain') || error.message.includes('required')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'TEMPLATE_UPDATE_FAILED',
        message: 'Failed to update container template'
      }
    });
  }
});

/**
 * POST /api/containers/admin/templates/:id/enable
 * Enable a container template
 */
router.post('/admin/templates/:id/enable', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEMPLATE_ID',
          message: 'Invalid template ID format'
        }
      });
    }

    await ContainerTemplateService.enableTemplate(id);

    // Get template details for logging
    const template = await ContainerTemplateService.getTemplate(id);

    // Log the template activation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.template.enable',
      entityType: 'container_template',
      entityId: id,
      metadata: { 
        templateName: template?.templateName || 'Unknown',
        displayName: template?.displayName || 'Unknown'
      }
    });

    res.json({
      success: true,
      message: 'Container template enabled successfully'
    });
  } catch (error) {
    console.error('Failed to enable container template:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Container template not found'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'TEMPLATE_ENABLE_FAILED',
        message: 'Failed to enable container template'
      }
    });
  }
});

/**
 * POST /api/containers/admin/templates/:id/disable
 * Disable a container template
 */
router.post('/admin/templates/:id/disable', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEMPLATE_ID',
          message: 'Invalid template ID format'
        }
      });
    }

    await ContainerTemplateService.disableTemplate(id);

    // Get template details for logging
    const template = await ContainerTemplateService.getTemplate(id);

    // Log the template deactivation
    await logActivity({
      userId: req.user!.id,
      organizationId: req.user!.organizationId!,
      eventType: 'container.template.disable',
      entityType: 'container_template',
      entityId: id,
      metadata: { 
        templateName: template?.templateName || 'Unknown',
        displayName: template?.displayName || 'Unknown'
      }
    });

    res.json({
      success: true,
      message: 'Container template disabled successfully'
    });
  } catch (error) {
    console.error('Failed to disable container template:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Container template not found'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'TEMPLATE_DISABLE_FAILED',
        message: 'Failed to disable container template'
      }
    });
  }
});

// ============================================================
// Admin Monitoring Routes
// ============================================================

/**
 * GET /api/containers/admin/overview
 * Platform-wide statistics for admin monitoring
 * Admin only
 */
router.get('/admin/overview', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get total number of active container subscriptions
    const subscriptionsResult = await query(
      `SELECT COUNT(*) as total_subscriptions,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
              COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_subscriptions,
              COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions
       FROM container_subscriptions`
    );

    // Get total number of projects across all organizations
    const projectsResult = await query(
      `SELECT COUNT(*) as total_projects,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects
       FROM container_projects`
    );

    // Get total number of services across all organizations
    const servicesResult = await query(
      `SELECT COUNT(*) as total_services,
              COUNT(CASE WHEN service_type = 'app' THEN 1 END) as app_services,
              COUNT(CASE WHEN service_type = 'postgres' THEN 1 END) as postgres_services,
              COUNT(CASE WHEN service_type = 'mysql' THEN 1 END) as mysql_services,
              COUNT(CASE WHEN service_type = 'mariadb' THEN 1 END) as mariadb_services,
              COUNT(CASE WHEN service_type = 'mongo' THEN 1 END) as mongo_services,
              COUNT(CASE WHEN service_type = 'redis' THEN 1 END) as redis_services
       FROM container_services cs
       JOIN container_projects cp ON cs.project_id = cp.id
       WHERE cp.status = 'active'`
    );

    // Get aggregate resource usage across all organizations
    const resourcesResult = await query(
      `SELECT 
              COALESCE(SUM(cs.cpu_limit), 0) as total_cpu_cores,
              COALESCE(SUM(cs.memory_limit_gb), 0) as total_memory_gb,
              COALESCE(SUM(cs.storage_limit_gb), 0) as total_storage_gb
       FROM container_services cs
       JOIN container_projects cp ON cs.project_id = cp.id
       WHERE cp.status = 'active'`
    );

    // Get organizations with active container subscriptions
    const organizationsResult = await query(
      `SELECT 
              o.id,
              o.name,
              o.created_at,
              cs.status as subscription_status,
              cp_plan.name as plan_name,
              COUNT(DISTINCT cp.id) as project_count,
              COUNT(DISTINCT serv.id) as service_count,
              COALESCE(SUM(serv.cpu_limit), 0) as total_cpu_usage,
              COALESCE(SUM(serv.memory_limit_gb), 0) as total_memory_usage,
              COALESCE(SUM(serv.storage_limit_gb), 0) as total_storage_usage
       FROM organizations o
       JOIN container_subscriptions cs ON o.id = cs.organization_id
       JOIN container_plans cp_plan ON cs.plan_id = cp_plan.id
       LEFT JOIN container_projects cp ON o.id = cp.organization_id AND cp.status = 'active'
       LEFT JOIN container_services serv ON cp.id = serv.project_id
       GROUP BY o.id, o.name, o.created_at, cs.status, cp_plan.name
       ORDER BY o.created_at DESC`
    );

    const subscriptionStats = subscriptionsResult.rows[0];
    const projectStats = projectsResult.rows[0];
    const serviceStats = servicesResult.rows[0];
    const resourceStats = resourcesResult.rows[0];

    const organizations = organizationsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      subscriptionStatus: row.subscription_status,
      planName: row.plan_name,
      projectCount: parseInt(row.project_count) || 0,
      serviceCount: parseInt(row.service_count) || 0,
      resourceUsage: {
        cpuCores: parseFloat(row.total_cpu_usage) || 0,
        memoryGb: parseFloat(row.total_memory_usage) || 0,
        storageGb: parseFloat(row.total_storage_usage) || 0
      },
      createdAt: row.created_at
    }));

    res.json({
      overview: {
        subscriptions: {
          total: parseInt(subscriptionStats.total_subscriptions) || 0,
          active: parseInt(subscriptionStats.active_subscriptions) || 0,
          suspended: parseInt(subscriptionStats.suspended_subscriptions) || 0,
          cancelled: parseInt(subscriptionStats.cancelled_subscriptions) || 0
        },
        projects: {
          total: parseInt(projectStats.total_projects) || 0,
          active: parseInt(projectStats.active_projects) || 0
        },
        services: {
          total: parseInt(serviceStats.total_services) || 0,
          byType: {
            app: parseInt(serviceStats.app_services) || 0,
            postgres: parseInt(serviceStats.postgres_services) || 0,
            mysql: parseInt(serviceStats.mysql_services) || 0,
            mariadb: parseInt(serviceStats.mariadb_services) || 0,
            mongo: parseInt(serviceStats.mongo_services) || 0,
            redis: parseInt(serviceStats.redis_services) || 0
          }
        },
        resources: {
          totalCpuCores: parseFloat(resourceStats.total_cpu_cores) || 0,
          totalMemoryGb: parseFloat(resourceStats.total_memory_gb) || 0,
          totalStorageGb: parseFloat(resourceStats.total_storage_gb) || 0
        }
      },
      organizations: organizations
    });
  } catch (error) {
    console.error('Failed to fetch admin overview:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_OVERVIEW_FETCH_FAILED',
        message: 'Failed to fetch admin overview'
      }
    });
  }
});

/**
 * GET /api/containers/admin/subscriptions
 * List all container subscriptions across all organizations
 * Admin only
 */
router.get('/admin/subscriptions', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, organizationId, planId, limit = 50, offset = 0 } = req.query;

    // Build dynamic query based on filters
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`cs.status = $${paramIndex}`);
      queryParams.push(status as string);
      paramIndex++;
    }

    if (organizationId) {
      whereConditions.push(`cs.organization_id = $${paramIndex}`);
      queryParams.push(organizationId as string);
      paramIndex++;
    }

    if (planId) {
      whereConditions.push(`cs.plan_id = $${paramIndex}`);
      queryParams.push(planId as string);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Add pagination parameters
    queryParams.push(String(parseInt(limit as string) || 50));
    queryParams.push(String(parseInt(offset as string) || 0));

    const subscriptionsQuery = `
      SELECT 
        cs.*,
        o.name as organization_name,
        cp.name as plan_name,
        cp.price_monthly as plan_price,
        cp.max_cpu_cores,
        cp.max_memory_gb,
        cp.max_storage_gb,
        cp.max_containers,
        COUNT(DISTINCT proj.id) as project_count,
        COUNT(DISTINCT serv.id) as service_count,
        COALESCE(SUM(serv.cpu_limit), 0) as current_cpu_usage,
        COALESCE(SUM(serv.memory_limit_gb), 0) as current_memory_usage,
        COALESCE(SUM(serv.storage_limit_gb), 0) as current_storage_usage
      FROM container_subscriptions cs
      JOIN organizations o ON cs.organization_id = o.id
      JOIN container_plans cp ON cs.plan_id = cp.id
      LEFT JOIN container_projects proj ON cs.organization_id = proj.organization_id AND proj.status = 'active'
      LEFT JOIN container_services serv ON proj.id = serv.project_id
      ${whereClause}
      GROUP BY cs.id, o.name, cp.name, cp.price_monthly, cp.max_cpu_cores, cp.max_memory_gb, cp.max_storage_gb, cp.max_containers
      ORDER BY cs.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const subscriptionsResult = await query(subscriptionsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT cs.id) as total
      FROM container_subscriptions cs
      JOIN organizations o ON cs.organization_id = o.id
      JOIN container_plans cp ON cs.plan_id = cp.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset

    const subscriptions = subscriptionsResult.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      planId: row.plan_id,
      plan: {
        id: row.plan_id,
        name: row.plan_name,
        priceMonthly: parseFloat(row.plan_price),
        maxCpuCores: row.max_cpu_cores,
        maxMemoryGb: row.max_memory_gb,
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers
      },
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      projectCount: parseInt(row.project_count) || 0,
      serviceCount: parseInt(row.service_count) || 0,
      resourceUsage: {
        cpuCores: parseFloat(row.current_cpu_usage) || 0,
        memoryGb: parseFloat(row.current_memory_usage) || 0,
        storageGb: parseFloat(row.current_storage_usage) || 0,
        containerCount: parseInt(row.service_count) || 0
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const totalCount = parseInt(countResult.rows[0].total) || 0;

    res.json({
      subscriptions,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        hasMore: (parseInt(offset as string) || 0) + subscriptions.length < totalCount
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin subscriptions:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_SUBSCRIPTIONS_FETCH_FAILED',
        message: 'Failed to fetch admin subscriptions'
      }
    });
  }
});

/**
 * GET /api/containers/admin/services
 * List all container services across all organizations
 * Admin only
 */
router.get('/admin/services', requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      organizationId, 
      projectId, 
      serviceType, 
      status, 
      limit = 50, 
      offset = 0 
    } = req.query;

    // Build dynamic query based on filters
    const whereConditions = ['cp.status = $1']; // Only active projects
    const queryParams = ['active'];
    let paramIndex = 2;

    if (organizationId) {
      whereConditions.push(`cp.organization_id = $${paramIndex}`);
      queryParams.push(organizationId as string);
      paramIndex++;
    }

    if (projectId) {
      whereConditions.push(`cs.project_id = $${paramIndex}`);
      queryParams.push(projectId as string);
      paramIndex++;
    }

    if (serviceType) {
      whereConditions.push(`cs.service_type = $${paramIndex}`);
      queryParams.push(serviceType as string);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`cs.status = $${paramIndex}`);
      queryParams.push(status as string);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Add pagination parameters
    queryParams.push(String(parseInt(limit as string) || 50));
    queryParams.push(String(parseInt(offset as string) || 0));

    const servicesQuery = `
      SELECT 
        cs.*,
        cp.project_name,
        cp.dokploy_project_id,
        cp.organization_id,
        o.name as organization_name,
        sub.plan_id,
        plan.name as plan_name
      FROM container_services cs
      JOIN container_projects cp ON cs.project_id = cp.id
      JOIN organizations o ON cp.organization_id = o.id
      LEFT JOIN container_subscriptions sub ON cp.organization_id = sub.organization_id AND sub.status = 'active'
      LEFT JOIN container_plans plan ON sub.plan_id = plan.id
      ${whereClause}
      ORDER BY cs.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const servicesResult = await query(servicesQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(cs.id) as total
      FROM container_services cs
      JOIN container_projects cp ON cs.project_id = cp.id
      JOIN organizations o ON cp.organization_id = o.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset

    const services = servicesResult.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      project: {
        id: row.project_id,
        projectName: row.project_name,
        dokployProjectId: row.dokploy_project_id,
        organizationId: row.organization_id
      },
      organization: {
        id: row.organization_id,
        name: row.organization_name
      },
      subscription: {
        planId: row.plan_id,
        planName: row.plan_name
      },
      serviceName: row.service_name,
      dokployApplicationId: row.dokploy_application_id,
      serviceType: row.service_type,
      status: row.status,
      resources: {
        cpuLimit: row.cpu_limit,
        memoryLimitGb: row.memory_limit_gb,
        storageLimitGb: row.storage_limit_gb
      },
      configuration: typeof row.configuration === 'string' ? JSON.parse(row.configuration) : (row.configuration || {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const totalCount = parseInt(countResult.rows[0].total) || 0;

    res.json({
      services,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        hasMore: (parseInt(offset as string) || 0) + services.length < totalCount
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin services:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_SERVICES_FETCH_FAILED',
        message: 'Failed to fetch admin services'
      }
    });
  }
});

// Apply error handler to all container routes
router.use(handleContainerError);

export default router;