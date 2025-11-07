/**
 * Admin PaaS Router
 * Central router for all PaaS admin functionality
 */

import express from 'express';
import plansRouter from './paas/plans.js';
import runtimesRouter from './paas/runtimes.js';
import nodesRouter from './paas/nodes.js';

const router = express.Router();

// Mount sub-routers
router.use('/plans', plansRouter);
router.use('/runtimes', runtimesRouter);
router.use('/nodes', nodesRouter);

/**
 * GET /api/admin/paas/stats
 * Get overall PaaS usage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Implement statistics aggregation
    res.json({
      success: true,
      stats: {
        total_applications: 0,
        total_databases: 0,
        total_nodes: 0,
        online_nodes: 0,
        total_containers: 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching PaaS stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/capacity
 * Get capacity planning data
 */
router.get('/capacity', async (req, res) => {
  try {
    // TODO: Implement capacity calculation
    res.json({
      success: true,
      capacity: {
        by_region: []
      }
    });
  } catch (error: any) {
    console.error('Error fetching capacity data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
