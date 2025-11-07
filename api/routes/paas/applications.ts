import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { applicationService, deploymentScheduler } from '../../../services/paas/index.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    
    const applications = await applicationService.getAll(userId, organizationId);
    res.json({ success: true, applications });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const app = await applicationService.getById(parseInt(req.params.id));
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, application: app });
  } catch (error: any) {
    console.error('Error fetching application:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch application' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, runtime_id, plan_id, region } = req.body;

    if (!name || !runtime_id || !plan_id || !region) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const app = await applicationService.create({
      user_id: req.user!.id,
      organization_id: req.user!.organizationId,
      name,
      runtime_id,
      plan_id,
      region
    });

    res.status(201).json({ success: true, application: app });
  } catch (error: any) {
    console.error('Error creating application:', error);
    res.status(500).json({ success: false, error: 'Failed to create application' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updated = await applicationService.update(id, req.body);
    res.json({ success: true, application: updated });
  } catch (error: any) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, error: 'Failed to update application' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await deploymentScheduler.scheduleDelete(id);
    await applicationService.delete(id);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, error: 'Failed to delete application' });
  }
});

router.post('/:id/deploy', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const gitCommit = req.body.git_commit ? {
      sha: req.body.git_commit.sha,
      message: req.body.git_commit.message
    } : undefined;

    const result = await deploymentScheduler.scheduleDeployment(id, gitCommit);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, buildId: result.buildId });
  } catch (error: any) {
    console.error('Error deploying application:', error);
    res.status(500).json({ success: false, error: 'Failed to deploy application' });
  }
});

router.post('/:id/restart', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await deploymentScheduler.scheduleRestart(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error restarting application:', error);
    res.status(500).json({ success: false, error: 'Failed to restart application' });
  }
});

router.post('/:id/stop', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await deploymentScheduler.scheduleStop(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error stopping application:', error);
    res.status(500).json({ success: false, error: 'Failed to stop application' });
  }
});

router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await deploymentScheduler.scheduleStart(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error starting application:', error);
    res.status(500).json({ success: false, error: 'Failed to start application' });
  }
});

router.post('/:id/scale', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { instance_count } = req.body;

    if (!instance_count || instance_count < 1 || instance_count > 10) {
      return res.status(400).json({ success: false, error: 'Invalid instance count (must be 1-10)' });
    }

    const app = await applicationService.getById(id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await deploymentScheduler.scheduleScale(id, instance_count);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error scaling application:', error);
    res.status(500).json({ success: false, error: 'Failed to scale application' });
  }
});

export default router;
