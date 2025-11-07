import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { environmentService, applicationService } from '../../../services/paas/index.js';

const router = Router();

router.get('/:appId/env', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const envVars = await environmentService.getByApplicationId(appId);
    res.json({ success: true, variables: envVars });
  } catch (error: any) {
    console.error('Error fetching environment variables:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch environment variables' });
  }
});

router.post('/:appId/env', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const validation = environmentService.validateKey(key);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const envVar = await environmentService.set(appId, key, value);
    res.status(201).json({ success: true, variable: envVar });
  } catch (error: any) {
    console.error('Error creating environment variable:', error);
    res.status(500).json({ success: false, error: 'Failed to create environment variable' });
  }
});

router.put('/:appId/env/:key', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const key = req.params.key;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Missing value' });
    }

    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const envVar = await environmentService.set(appId, key, value);
    res.json({ success: true, variable: envVar });
  } catch (error: any) {
    console.error('Error updating environment variable:', error);
    res.status(500).json({ success: false, error: 'Failed to update environment variable' });
  }
});

router.delete('/:appId/env/:key', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const key = req.params.key;

    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const success = await environmentService.delete(appId, key);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Environment variable not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting environment variable:', error);
    res.status(500).json({ success: false, error: 'Failed to delete environment variable' });
  }
});

export default router;
