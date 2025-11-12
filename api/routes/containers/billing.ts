/**
 * Container Billing Routes
 * Handles billing history, summaries, and cost estimation
 */
import { Router, Response } from 'express';
import { ContainerBillingService } from '../../services/containers/ContainerBillingService.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// All billing routes require authentication
router.use(authenticateToken);

/**
 * GET /api/containers/billing/history
 * Get billing history for the authenticated user's organization
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await ContainerBillingService.getContainerBillingHistory(
      organizationId,
      limit,
      offset
    );

    res.json({ history });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

/**
 * GET /api/containers/billing/summary
 * Get billing summary for the authenticated user's organization
 */
router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    const summary = await ContainerBillingService.getContainerBillingSummary(organizationId);

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    res.status(500).json({ error: 'Failed to fetch billing summary' });
  }
});

/**
 * POST /api/containers/billing/estimate
 * Estimate costs for a container service configuration
 */
router.post('/estimate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cpuCores, memoryMb, diskGb, estimatedBuildMinutesPerDay, estimatedNetworkGbPerDay } = req.body as {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
      estimatedBuildMinutesPerDay?: number;
      estimatedNetworkGbPerDay?: number;
    };

    // Validate input
    if (!cpuCores || !memoryMb || !diskGb) {
      return res.status(400).json({
        error: 'Missing required fields: cpuCores, memoryMb, diskGb',
      });
    }

    if (cpuCores < 0.5 || cpuCores > 16) {
      return res.status(400).json({
        error: 'CPU cores must be between 0.5 and 16',
      });
    }

    if (memoryMb < 256 || memoryMb > 32768) {
      return res.status(400).json({
        error: 'Memory must be between 256 MB and 32 GB',
      });
    }

    if (diskGb < 1 || diskGb > 500) {
      return res.status(400).json({
        error: 'Disk must be between 1 GB and 500 GB',
      });
    }

    const estimate = ContainerBillingService.estimateServiceCosts(
      cpuCores,
      memoryMb,
      diskGb,
      estimatedBuildMinutesPerDay || 0,
      estimatedNetworkGbPerDay || 0
    );

    res.json({ estimate });
  } catch (error) {
    console.error('Error estimating costs:', error);
    res.status(500).json({ error: 'Failed to estimate costs' });
  }
});

/**
 * GET /api/containers/billing/service/:serviceId
 * Get billing history for a specific container service
 */
router.get('/service/:serviceId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    const { serviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get all billing history for the organization
    const allHistory = await ContainerBillingService.getContainerBillingHistory(
      organizationId,
      1000, // Get more records to filter
      0
    );

    // Filter by service ID
    const serviceHistory = allHistory
      .filter((cycle) => cycle.serviceId === serviceId)
      .slice(offset, offset + limit);

    res.json({ history: serviceHistory });
  } catch (error) {
    console.error('Error fetching service billing history:', error);
    res.status(500).json({ error: 'Failed to fetch service billing history' });
  }
});

export default router;
