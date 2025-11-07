import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { buildService, applicationService } from '../../../services/paas/index.js';

const router = Router();

router.get('/:appId/builds', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const builds = await buildService.getByApplicationId(appId, limit);
    
    res.json({ success: true, builds });
  } catch (error: any) {
    console.error('Error fetching builds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch builds' });
  }
});

router.get('/:appId/builds/:buildId', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const buildId = parseInt(req.params.buildId);
    
    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const build = await buildService.getById(buildId);
    
    if (!build || build.application_id !== appId) {
      return res.status(404).json({ success: false, error: 'Build not found' });
    }

    res.json({ success: true, build });
  } catch (error: any) {
    console.error('Error fetching build:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch build' });
  }
});

router.get('/:appId/builds/:buildId/logs', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const buildId = parseInt(req.params.buildId);
    
    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const build = await buildService.getById(buildId);
    
    if (!build || build.application_id !== appId) {
      return res.status(404).json({ success: false, error: 'Build not found' });
    }

    res.json({ success: true, logs: build.build_log || '' });
  } catch (error: any) {
    console.error('Error fetching build logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch build logs' });
  }
});

export default router;
