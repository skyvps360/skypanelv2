/**
 * Container Metrics Routes
 * Handles metrics collection, retrieval, and visualization for container services
 */
import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { metricsCollectionService, TimeRange } from '../../services/containers/MetricsCollectionService.js';

const router = express.Router();

// All metrics endpoints require authentication
router.use(authenticateToken);

/**
 * Get current metrics for a service
 * GET /api/containers/services/:serviceId/metrics/current
 */
router.get('/services/:serviceId/current', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;

    const metrics = await metricsCollectionService.getCurrentMetrics(serviceId, user.organizationId);

    if (!metrics) {
      return res.status(404).json({ error: 'No metrics available for this service' });
    }

    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching current metrics:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch current metrics' 
    });
  }
});

/**
 * Get historical metrics for a service
 * GET /api/containers/services/:serviceId/metrics/history?start=2024-01-01&end=2024-01-02&granularity=1m
 */
router.get('/services/:serviceId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;

    // Parse time range
    const start = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end as string) : new Date();
    const granularity = (req.query.granularity as TimeRange['granularity']) || '1m';

    const timeRange: TimeRange = {
      start,
      end,
      granularity,
    };

    const metrics = await metricsCollectionService.getHistoricalMetrics(serviceId, user.organizationId, timeRange);

    res.json({ 
      metrics,
      count: metrics.length,
      timeRange,
    });
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch historical metrics' 
    });
  }
});

/**
 * Get metrics summary with costs and alerts
 * GET /api/containers/services/:serviceId/metrics/summary?start=2024-01-01&end=2024-01-02
 */
router.get('/services/:serviceId/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;

    // Parse time range
    const start = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end as string) : new Date();
    const granularity = (req.query.granularity as TimeRange['granularity']) || '1m';

    const timeRange: TimeRange = {
      start,
      end,
      granularity,
    };

    const summary = await metricsCollectionService.getMetricsSummary(serviceId, user.organizationId, timeRange);

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch metrics summary' 
    });
  }
});

/**
 * Export metrics data
 * GET /api/containers/services/:serviceId/metrics/export?format=json&start=2024-01-01&end=2024-01-02
 */
router.get('/services/:serviceId/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;
    const format = (req.query.format as string) || 'json';

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be json or csv' });
    }

    // Parse time range
    const start = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end as string) : new Date();
    const granularity = (req.query.granularity as TimeRange['granularity']) || '1m';

    const timeRange: TimeRange = {
      start,
      end,
      granularity,
    };

    const metricsContent = await metricsCollectionService.exportMetrics(
      serviceId,
      user.organizationId,
      timeRange,
      format as 'json' | 'csv'
    );

    // Set appropriate content type and filename
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
    };

    const extensions = {
      json: 'json',
      csv: 'csv',
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `container-metrics-${serviceId}-${timestamp}.${extensions[format as keyof typeof extensions]}`;

    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(metricsContent);
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to export metrics' 
    });
  }
});

export default router;
