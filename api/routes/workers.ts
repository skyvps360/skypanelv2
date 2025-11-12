/**
 * Worker Management Routes
 * Handles worker node registration, heartbeat, and admin management
 */
import { Router, Response } from 'express';
import { WorkerService } from '../services/containers/WorkerService.js';
import { authenticateToken, AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import { authenticateWorker, WorkerAuthRequest } from '../middleware/workerAuth.js';

const router = Router();

/**
 * List all workers (admin only)
 * GET /api/workers
 */
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search, limit, offset } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;

    const pagination: any = {};
    if (limit) pagination.limit = parseInt(limit as string);
    if (offset) pagination.offset = parseInt(offset as string);

    const result = await WorkerService.listWorkers(filters, pagination);

    res.json({
      success: true,
      data: result.workers,
      pagination: {
        total: result.total,
        limit: pagination.limit || 50,
        offset: pagination.offset || 0
      }
    });
  } catch (error: any) {
    console.error('Error listing workers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKER_LIST_ERROR',
        message: error.message || 'Failed to list workers'
      }
    });
  }
});

/**
 * Get worker details (admin only)
 * GET /api/workers/:id
 */
router.get('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const worker = await WorkerService.getWorkerStatus(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKER_NOT_FOUND',
          message: 'Worker not found'
        }
      });
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error: any) {
    console.error('Error getting worker:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKER_GET_ERROR',
        message: error.message || 'Failed to get worker'
      }
    });
  }
});

/**
 * Generate worker installation script (admin only)
 * POST /api/workers/generate-script
 */
router.post('/generate-script', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUserId = req.user!.id;

    const result = await WorkerService.generateWorkerScript(adminUserId);

    res.json({
      success: true,
      data: {
        script: result.script,
        token: result.token
      }
    });
  } catch (error: any) {
    console.error('Error generating worker script:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCRIPT_GENERATION_ERROR',
        message: error.message || 'Failed to generate worker installation script'
      }
    });
  }
});

/**
 * Register worker node (worker auth)
 * POST /api/workers/register
 */
router.post('/register', authenticateWorker, async (req: WorkerAuthRequest, res: Response) => {
  try {
    const authToken = req.workerToken!;
    const { hostname, ipAddress, capacity, metadata } = req.body;

    // Validate required fields
    if (!hostname || !ipAddress || !capacity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: hostname, ipAddress, capacity'
        }
      });
    }

    if (!capacity.cpuCores || !capacity.memoryMb || !capacity.diskGb) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Capacity must include cpuCores, memoryMb, and diskGb'
        }
      });
    }

    const worker = await WorkerService.registerWorker(authToken, {
      hostname,
      ipAddress,
      capacity,
      metadata
    });

    // Attach worker ID to request for future use
    req.workerId = worker.id;

    res.status(201).json({
      success: true,
      data: worker
    });
  } catch (error: any) {
    console.error('Error registering worker:', error);

    // Handle validation errors
    if (error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // Handle authentication errors
    if (error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'WORKER_REGISTRATION_ERROR',
        message: error.message || 'Failed to register worker'
      }
    });
  }
});

/**
 * Remove worker node (admin only)
 * DELETE /api/workers/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await WorkerService.removeWorker(id);

    res.json({
      success: true,
      message: 'Worker removed successfully'
    });
  } catch (error: any) {
    console.error('Error removing worker:', error);

    // Handle not found
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKER_NOT_FOUND',
          message: 'Worker not found'
        }
      });
    }

    // Handle workers with running containers
    if (error.message.includes('containers still running')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'WORKER_HAS_CONTAINERS',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'WORKER_REMOVE_ERROR',
        message: error.message || 'Failed to remove worker'
      }
    });
  }
});

/**
 * Drain worker node (admin only)
 * POST /api/workers/:id/drain
 */
router.post('/:id/drain', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await WorkerService.drainWorker(id);

    res.json({
      success: true,
      message: 'Worker marked for draining. Containers will be migrated.'
    });
  } catch (error: any) {
    console.error('Error draining worker:', error);

    // Handle not found
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKER_NOT_FOUND',
          message: 'Worker not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'WORKER_DRAIN_ERROR',
        message: error.message || 'Failed to drain worker'
      }
    });
  }
});

/**
 * Update worker heartbeat (worker auth)
 * POST /api/workers/:id/heartbeat
 */
router.post('/:id/heartbeat', authenticateWorker, async (req: WorkerAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { cpuPercent, memoryPercent, diskPercent, containerCount } = req.body;

    // Validate required fields
    if (
      cpuPercent === undefined ||
      memoryPercent === undefined ||
      diskPercent === undefined ||
      containerCount === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required metrics: cpuPercent, memoryPercent, diskPercent, containerCount'
        }
      });
    }

    await WorkerService.updateWorkerHeartbeat(id, {
      cpuPercent,
      memoryPercent,
      diskPercent,
      containerCount
    });

    res.json({
      success: true,
      message: 'Heartbeat received'
    });
  } catch (error: any) {
    console.error('Error updating worker heartbeat:', error);

    // Handle validation errors
    if (error.message.includes('must be') || error.message.includes('between')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'HEARTBEAT_ERROR',
        message: error.message || 'Failed to update worker heartbeat'
      }
    });
  }
});

export default router;
