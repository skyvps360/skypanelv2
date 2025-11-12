/**
 * Container Service Routes
 * Handles container service CRUD operations and lifecycle management
 */
import { Router, Response } from 'express';
import { ContainerServiceManager } from '../../services/containers/ContainerService.js';
import { authenticateToken, AuthenticatedRequest, requireOrganization } from '../../middleware/auth.js';

const router = Router();

/**
 * Create a new container service
 * POST /api/containers/services
 */
router.post('/', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    const {
      name,
      slug,
      templateId,
      gitRepository,
      gitBranch,
      buildConfig,
      environmentVars,
      resourceLimits
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Service name is required'
        }
      });
    }

    if (!resourceLimits || !resourceLimits.cpuCores || !resourceLimits.memoryMb || !resourceLimits.diskGb) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Resource limits (cpuCores, memoryMb, diskGb) are required'
        }
      });
    }

    const service = await ContainerServiceManager.createService({
      organizationId,
      name,
      slug,
      templateId,
      gitRepository,
      gitBranch,
      buildConfig,
      environmentVars,
      resourceLimits
    });

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error: any) {
    console.error('Error creating container service:', error);

    // Handle validation errors
    if (error.message.includes('must be between') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // Handle quota errors
    if (error.message.includes('quota exceeded')) {
      return res.status(507).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_CREATE_ERROR',
        message: error.message || 'Failed to create container service'
      }
    });
  }
});

/**
 * List all container services for the organization
 * GET /api/containers/services
 */
router.get('/', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    const { status, templateId, search, limit, offset } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (templateId) filters.templateId = templateId as string;
    if (search) filters.search = search as string;

    const pagination: any = {};
    if (limit) pagination.limit = parseInt(limit as string);
    if (offset) pagination.offset = parseInt(offset as string);

    const result = await ContainerServiceManager.listServices(
      organizationId,
      filters,
      pagination
    );

    res.json({
      success: true,
      data: result.services,
      pagination: {
        total: result.total,
        limit: pagination.limit || 50,
        offset: pagination.offset || 0
      }
    });
  } catch (error: any) {
    console.error('Error listing container services:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_LIST_ERROR',
        message: error.message || 'Failed to list container services'
      }
    });
  }
});

/**
 * Get container service details
 * GET /api/containers/services/:id
 */
router.get('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const service = await ContainerServiceManager.getService(id, organizationId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (error: any) {
    console.error('Error getting container service:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_GET_ERROR',
        message: error.message || 'Failed to get container service'
      }
    });
  }
});

/**
 * Update container service configuration
 * PATCH /api/containers/services/:id
 */
router.patch('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const updates = req.body;

    const service = await ContainerServiceManager.updateService(id, organizationId, updates);

    res.json({
      success: true,
      data: service
    });
  } catch (error: any) {
    console.error('Error updating container service:', error);

    // Handle not found
    if (error.message === 'Service not found' || error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    // Handle validation errors
    if (error.message.includes('must be between')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // Handle quota errors
    if (error.message.includes('quota exceeded')) {
      return res.status(507).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_UPDATE_ERROR',
        message: error.message || 'Failed to update container service'
      }
    });
  }
});

/**
 * Delete container service
 * DELETE /api/containers/services/:id
 */
router.delete('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    await ContainerServiceManager.deleteService(id, organizationId);

    res.json({
      success: true,
      message: 'Container service deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_DELETE_ERROR',
        message: error.message || 'Failed to delete container service'
      }
    });
  }
});

/**
 * Deploy container service
 * POST /api/containers/services/:id/deploy
 */
router.post('/:id/deploy', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const { gitCommitSha } = req.body;

    // Check if service exists
    const service = await ContainerServiceManager.getService(id, organizationId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    // Trigger deployment (this will be handled by build/deployment services)
    // For now, just update the status to indicate deployment is starting
    await ContainerServiceManager.updateServiceStatus(id, 'building');

    res.status(202).json({
      success: true,
      message: 'Deployment initiated',
      data: {
        serviceId: id,
        status: 'building'
      }
    });
  } catch (error: any) {
    console.error('Error deploying container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_DEPLOY_ERROR',
        message: error.message || 'Failed to deploy container service'
      }
    });
  }
});

/**
 * Start container service
 * POST /api/containers/services/:id/start
 */
router.post('/:id/start', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const result = await ContainerServiceManager.performAction(id, organizationId, 'start');

    res.json({
      success: result.success,
      message: result.message,
      async: result.async
    });
  } catch (error: any) {
    console.error('Error starting container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_START_ERROR',
        message: error.message || 'Failed to start container service'
      }
    });
  }
});

/**
 * Stop container service
 * POST /api/containers/services/:id/stop
 */
router.post('/:id/stop', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const result = await ContainerServiceManager.performAction(id, organizationId, 'stop');

    res.json({
      success: result.success,
      message: result.message,
      async: result.async
    });
  } catch (error: any) {
    console.error('Error stopping container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_STOP_ERROR',
        message: error.message || 'Failed to stop container service'
      }
    });
  }
});

/**
 * Restart container service
 * POST /api/containers/services/:id/restart
 */
router.post('/:id/restart', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const result = await ContainerServiceManager.performAction(id, organizationId, 'restart');

    res.json({
      success: result.success,
      message: result.message,
      async: result.async
    });
  } catch (error: any) {
    console.error('Error restarting container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_RESTART_ERROR',
        message: error.message || 'Failed to restart container service'
      }
    });
  }
});

/**
 * Rebuild container service
 * POST /api/containers/services/:id/rebuild
 */
router.post('/:id/rebuild', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const result = await ContainerServiceManager.performAction(id, organizationId, 'rebuild');

    res.json({
      success: result.success,
      message: result.message,
      async: result.async
    });
  } catch (error: any) {
    console.error('Error rebuilding container service:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_REBUILD_ERROR',
        message: error.message || 'Failed to rebuild container service'
      }
    });
  }
});

/**
 * Get container service logs
 * GET /api/containers/services/:id/logs
 */
router.get('/:id/logs', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const { lines, since, follow } = req.query;

    // Check if service exists
    const service = await ContainerServiceManager.getService(id, organizationId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    // Import LogStreamingService dynamically
    const { LogStreamingService } = await import('../../services/containers/LogStreamingService.js');

    // If follow is requested, set up SSE streaming
    if (follow === 'true') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Stream logs
      await LogStreamingService.streamLogs(id, res, {
        lines: lines ? parseInt(lines as string) : undefined,
        since: since as string
      });
    } else {
      // Get logs as JSON
      const logs = await LogStreamingService.getLogs(id, {
        lines: lines ? parseInt(lines as string) : undefined,
        since: since as string
      });

      res.json({
        success: true,
        data: logs
      });
    }
  } catch (error: any) {
    console.error('Error getting container service logs:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_LOGS_ERROR',
        message: error.message || 'Failed to get container service logs'
      }
    });
  }
});

/**
 * Get container service metrics
 * GET /api/containers/services/:id/metrics
 */
router.get('/:id/metrics', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const { timeRange } = req.query;

    // Check if service exists
    const service = await ContainerServiceManager.getService(id, organizationId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    // Import MetricsCollectionService dynamically
    const { MetricsCollectionService } = await import('../../services/containers/MetricsCollectionService.js');

    const metrics = await MetricsCollectionService.getServiceMetrics(id, timeRange as string);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Error getting container service metrics:', error);

    // Handle not found
    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Container service not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_METRICS_ERROR',
        message: error.message || 'Failed to get container service metrics'
      }
    });
  }
});

export default router;
