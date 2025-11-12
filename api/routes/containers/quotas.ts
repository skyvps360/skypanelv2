/**
 * Container Quota Management Routes
 * Handles quota viewing, configuration, and monitoring
 */

import express from 'express';
import { QuotaService } from '../../services/containers/QuotaService.js';
import { QuotaAlertService } from '../../services/containers/QuotaAlertService.js';

const router = express.Router();

/**
 * GET /api/containers/quotas/organization/:organizationId
 * Get quota usage and limits for an organization
 */
router.get('/organization/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user belongs to organization or is admin
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      // TODO: Add organization membership check
      // For now, allow all authenticated users
    }

    const quotaData = await QuotaService.getQuotaUsage(organizationId);

    res.json({
      success: true,
      data: quotaData,
    });
  } catch (error: any) {
    console.error('Error getting organization quota:', error);
    res.status(500).json({
      error: 'Failed to get organization quota',
      message: error.message,
    });
  }
});

/**
 * GET /api/containers/quotas/all
 * Get quota usage for all organizations (admin only)
 */
router.get('/all', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId || userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const quotas = await QuotaService.getAllOrganizationQuotas();

    res.json({
      success: true,
      data: quotas,
    });
  } catch (error: any) {
    console.error('Error getting all organization quotas:', error);
    res.status(500).json({
      error: 'Failed to get organization quotas',
      message: error.message,
    });
  }
});

/**
 * PUT /api/containers/quotas/organization/:organizationId
 * Update quota limits for an organization (admin only)
 */
router.put('/organization/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId || userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { cpu_cores, memory_mb, disk_gb, max_services } = req.body;

    // Validate input
    const limits: any = {};
    if (cpu_cores !== undefined) {
      if (typeof cpu_cores !== 'number' || cpu_cores < 0) {
        return res.status(400).json({ error: 'Invalid cpu_cores value' });
      }
      limits.cpu_cores = cpu_cores;
    }

    if (memory_mb !== undefined) {
      if (typeof memory_mb !== 'number' || memory_mb < 0) {
        return res.status(400).json({ error: 'Invalid memory_mb value' });
      }
      limits.memory_mb = memory_mb;
    }

    if (disk_gb !== undefined) {
      if (typeof disk_gb !== 'number' || disk_gb < 0) {
        return res.status(400).json({ error: 'Invalid disk_gb value' });
      }
      limits.disk_gb = disk_gb;
    }

    if (max_services !== undefined) {
      if (typeof max_services !== 'number' || max_services < 0) {
        return res.status(400).json({ error: 'Invalid max_services value' });
      }
      limits.max_services = max_services;
    }

    if (Object.keys(limits).length === 0) {
      return res.status(400).json({ error: 'No valid quota limits provided' });
    }

    const updatedLimits = await QuotaService.updateQuotaLimits(
      organizationId,
      limits,
      userId
    );

    res.json({
      success: true,
      data: updatedLimits,
      message: 'Quota limits updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating organization quota:', error);
    res.status(500).json({
      error: 'Failed to update organization quota',
      message: error.message,
    });
  }
});

/**
 * POST /api/containers/quotas/check
 * Check if deployment would exceed quota (before creating service)
 */
router.post('/check', async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, cpu_cores, memory_mb, disk_gb } = req.body;

    // Validate input
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    if (
      typeof cpu_cores !== 'number' ||
      typeof memory_mb !== 'number' ||
      typeof disk_gb !== 'number'
    ) {
      return res.status(400).json({
        error: 'cpu_cores, memory_mb, and disk_gb must be numbers',
      });
    }

    const quotaCheck = await QuotaService.checkQuotaBeforeDeployment(
      organizationId,
      { cpu_cores, memory_mb, disk_gb }
    );

    res.json({
      success: true,
      data: quotaCheck,
    });
  } catch (error: any) {
    console.error('Error checking quota:', error);
    res.status(500).json({
      error: 'Failed to check quota',
      message: error.message,
    });
  }
});

/**
 * GET /api/containers/quotas/alerts/stats
 * Get alert statistics (admin only)
 */
router.get('/alerts/stats', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId || userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = QuotaAlertService.getAlertStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error getting alert statistics:', error);
    res.status(500).json({
      error: 'Failed to get alert statistics',
      message: error.message,
    });
  }
});

export default router;
