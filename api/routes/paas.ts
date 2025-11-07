/**
 * Customer PaaS Router
 * Central router for all customer PaaS functionality
 */

import express from 'express';
import applicationsRouter from './paas/applications.js';
import { RuntimeService } from '../services/paas/RuntimeService.js';
import { PlanService } from '../services/paas/PlanService.js';
import { NodeService } from '../services/paas/NodeService.js';

const router = express.Router();

// Mount sub-routers
router.use('/applications', applicationsRouter);

/**
 * GET /api/paas/plans
 * List available plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await PlanService.getAllPlans(true); // Only active plans
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paas/runtimes
 * List available runtimes
 */
router.get('/runtimes', async (req, res) => {
  try {
    const runtimes = await RuntimeService.getAllRuntimes(true); // Only active runtimes
    res.json({ success: true, runtimes });
  } catch (error: any) {
    console.error('Error fetching runtimes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paas/regions
 * List available regions with capacity
 */
router.get('/regions', async (req, res) => {
  try {
    const nodes = await NodeService.getAllNodes();
    
    // Group by region and calculate availability
    const regionMap = new Map<string, any>();
    
    for (const node of nodes) {
      if (node.status !== 'online') continue;
      
      if (!regionMap.has(node.region)) {
        regionMap.set(node.region, {
          region: node.region,
          available_nodes: 0,
          total_capacity: {
            cpu: 0,
            memory: 0,
            disk: 0
          },
          used_capacity: {
            cpu: 0,
            memory: 0,
            disk: 0
          }
        });
      }
      
      const regionData = regionMap.get(node.region)!;
      regionData.available_nodes++;
      regionData.total_capacity.cpu += node.cpu_total || 0;
      regionData.total_capacity.memory += node.memory_total || 0;
      regionData.total_capacity.disk += node.disk_total || 0;
      regionData.used_capacity.cpu += node.cpu_used || 0;
      regionData.used_capacity.memory += node.memory_used || 0;
      regionData.used_capacity.disk += node.disk_used || 0;
    }
    
    const regions = Array.from(regionMap.values());
    
    res.json({ success: true, regions });
  } catch (error: any) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paas/github/authorize
 * Initiate GitHub OAuth flow
 */
router.get('/github/authorize', async (req, res) => {
  try {
    // TODO: Implement GitHub OAuth flow
    res.json({ 
      success: false, 
      error: 'GitHub OAuth not yet implemented' 
    });
  } catch (error: any) {
    console.error('Error initiating GitHub OAuth:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paas/github/callback
 * GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    // TODO: Handle GitHub OAuth callback
    res.json({ 
      success: false, 
      error: 'GitHub OAuth not yet implemented' 
    });
  } catch (error: any) {
    console.error('Error handling GitHub OAuth callback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
