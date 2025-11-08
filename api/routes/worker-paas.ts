/**
 * Worker Node API Routes for SkyPanelV2 PaaS
 * Handles communication between worker nodes and main application
 */

import express from 'express';
import { WorkerNodeService } from '../services/workerNodeService.js';
import { BuildService } from '../services/buildService.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

/**
 * POST /api/paas/worker/register
 * Register a new worker node
 */
router.post('/register', async (req, res) => {
  try {
    const registrationData = req.body;

    // Validate required fields
    const required = ['name', 'hostname', 'ipAddress'];
    const missing = required.filter(field => !registrationData[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const result = await WorkerNodeService.registerWorkerNode(registrationData);

    res.status(201).json({
      success: true,
      data: {
        nodeId: result.nodeId,
        authToken: result.authToken
      },
      message: 'Worker node registered successfully'
    });
  } catch (error) {
    console.error('Error registering worker node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register worker node'
    });
  }
});

/**
 * POST /api/paas/worker/heartbeat
 * Receive heartbeat from worker node
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { nodeId, timestamp, ...systemInfo } = req.body;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing worker node ID'
      });
    }

    // Authenticate worker node (this would need token validation in production)
    const success = await WorkerNodeService.updateHeartbeat(nodeId, systemInfo);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    res.json({
      success: true,
      message: 'Heartbeat received'
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat'
    });
  }
});

/**
 * GET /api/paas/worker/builds/queued
 * Get queued builds for worker nodes
 */
router.get('/builds/queued', async (req, res) => {
  try {
    const queuedBuilds = await BuildService.getQueuedBuilds();

    res.json({
      success: true,
      data: {
        builds: queuedBuilds
      }
    });
  } catch (error) {
    console.error('Error getting queued builds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queued builds'
    });
  }
});

/**
 * POST /api/paas/worker/builds/:deploymentId/accept
 * Worker accepts a build job
 */
router.post('/builds/:deploymentId/accept', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { nodeId } = req.body;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing worker node ID'
      });
    }

    // Validate worker exists and is online
    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker || worker.status !== 'online') {
      return res.status(403).json({
        success: false,
        error: 'Worker node not found or not online'
      });
    }

    // Assign build to worker (update deployment)
    // This would need to be implemented in BuildService
    console.log(`Worker ${nodeId} accepted build ${deploymentId}`);

    res.json({
      success: true,
      message: 'Build job accepted'
    });
  } catch (error) {
    console.error('Error accepting build job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept build job'
    });
  }
});

/**
 * POST /api/paas/worker/builds/:deploymentId/status
 * Update build status from worker
 */
router.post('/builds/:deploymentId/status', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { nodeId, status, logs, errorMessage, result } = req.body;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing worker node ID'
      });
    }

    // Validate worker exists
    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker) {
      return res.status(403).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    // Update build status
    const success = await BuildService.updateBuildStatus(
      deploymentId,
      status,
      logs,
      errorMessage,
      result
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Log worker activity
    await logActivity({
      userId: null, // System action
      eventType: 'paas.worker.build_status_update',
      entityType: 'paas_deployment',
      entityId: deploymentId,
      message: `Worker ${worker.name} updated build status: ${status}`,
      metadata: {
        workerId: nodeId,
        workerName: worker.name,
        deploymentId,
        status,
        hasError: !!errorMessage
      }
    });

    res.json({
      success: true,
      message: 'Build status updated successfully'
    });
  } catch (error) {
    console.error('Error updating build status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update build status'
    });
  }
});

/**
 * POST /api/paas/worker/builds/:deploymentId/logs
 * Add build log entry from worker
 */
router.post('/builds/:deploymentId/logs', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { nodeId, level, message, timestamp, metadata } = req.body;

    if (!nodeId || !level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nodeId, level, message'
      });
    }

    // Validate log level
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        error: `Invalid log level. Must be one of: ${validLevels.join(', ')}`
      });
    }

    // Add build log
    await BuildService.addBuildLog(deploymentId, level, message, metadata || {});

    res.json({
      success: true,
      message: 'Build log added successfully'
    });
  } catch (error) {
    console.error('Error adding build log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add build log'
    });
  }
});

/**
 * GET /api/paas/worker/:nodeId/status
 * Get worker node status and details
 */
router.get('/:nodeId/status', async (req, res) => {
  try {
    const { nodeId } = req.params;

    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    // Get additional worker statistics
    const stats = await WorkerNodeService.getWorkerNodeStats();

    res.json({
      success: true,
      data: {
        worker,
        systemStats: stats
      }
    });
  } catch (error) {
    console.error('Error getting worker status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker status'
    });
  }
});

/**
 * GET /api/paas/worker/:nodeId/builds
 * Get current and recent builds for a specific worker
 */
router.get('/:nodeId/builds', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate worker exists
    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    // Get builds assigned to this worker
    // This would need to be implemented in BuildService
    const builds = [];

    res.json({
      success: true,
      data: {
        workerId: nodeId,
        builds,
        pagination: {
          limit,
          offset,
          hasMore: builds.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Error getting worker builds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker builds'
    });
  }
});

/**
 * POST /api/paas/worker/:nodeId/maintenance
 * Put worker node in maintenance mode
 */
router.post('/:nodeId/maintenance', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { enabled, reason } = req.body;

    // Validate worker exists
    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    const newStatus = enabled ? 'maintenance' : 'online';
    const success = await WorkerNodeService.updateWorkerNodeStatus(nodeId, newStatus);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update worker status'
      });
    }

    // Log admin action (this would need authentication middleware)
    await logActivity({
      userId: null, // System action
      eventType: 'paas.worker.maintenance_mode',
      entityType: 'paas_worker_node',
      entityId: nodeId,
      message: `Worker ${worker.name} put in ${newStatus} mode`,
      metadata: {
        workerName: worker.name,
        previousStatus: worker.status,
        newStatus,
        reason
      }
    });

    res.json({
      success: true,
      message: `Worker ${newStatus === 'maintenance' ? 'entered' : 'exited'} maintenance mode`
    });
  } catch (error) {
    console.error('Error updating worker maintenance mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update worker maintenance mode'
    });
  }
});

/**
 * POST /api/paas/worker/:nodeId/restart
 * Restart worker node service (if supported)
 */
router.post('/:nodeId/restart', async (req, res) => {
  try {
    const { nodeId } = req.params;

    // Validate worker exists
    const worker = await WorkerNodeService.getWorkerNodeById(nodeId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker node not found'
      });
    }

    // In a real implementation, this would send a restart signal to the worker
    // For now, just update the status
    await WorkerNodeService.updateWorkerNodeStatus(nodeId, 'offline');

    // Log the restart action
    await logActivity({
      userId: null, // System action
      eventType: 'paas.worker.restart',
      entityType: 'paas_worker_node',
      entityId: nodeId,
      message: `Worker node restarted: ${worker.name}`,
      metadata: {
        workerName: worker.name,
        ipAddress: worker.ipAddress
      }
    });

    res.json({
      success: true,
      message: 'Worker node restart initiated'
    });
  } catch (error) {
    console.error('Error restarting worker node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart worker node'
    });
  }
});

/**
 * GET /api/paas/worker/health
 * Health check endpoint for worker API
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

export default router;