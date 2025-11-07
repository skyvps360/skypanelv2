import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { planService, runtimeService, nodeService } from '../../../services/paas/index.js';

const router = Router();

router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const plans = await planService.getAll(false);
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

router.get('/runtimes', authenticateToken, async (req, res) => {
  try {
    const runtimes = await runtimeService.getAll(false);
    res.json({ success: true, runtimes });
  } catch (error: any) {
    console.error('Error fetching runtimes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch runtimes' });
  }
});

router.get('/regions', authenticateToken, async (req, res) => {
  try {
    const nodes = await nodeService.getAll();
    
    const regionMap = new Map<string, { name: string; available: boolean; capacity: number }>();
    
    for (const node of nodes) {
      if (node.status === 'online') {
        const existing = regionMap.get(node.region);
        const cpuPercent = node.cpu_total ? (node.cpu_used / node.cpu_total) * 100 : 100;
        const memoryPercent = node.memory_total ? (node.memory_used / node.memory_total) * 100 : 100;
        const capacity = 100 - Math.max(cpuPercent, memoryPercent);
        
        if (!existing || capacity > existing.capacity) {
          regionMap.set(node.region, {
            name: node.region,
            available: capacity > 10,
            capacity: Math.round(capacity)
          });
        }
      }
    }

    const regions = Array.from(regionMap.values());
    
    res.json({ success: true, regions });
  } catch (error: any) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch regions' });
  }
});

export default router;
