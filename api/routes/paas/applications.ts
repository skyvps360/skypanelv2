/**
 * Customer PaaS Applications Routes
 * Manage customer applications
 */

import express from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../../middleware/auth.js';
import { ApplicationService } from '../../services/paas/ApplicationService.js';
import { PlanService } from '../../services/paas/PlanService.js';
import { RuntimeService } from '../../services/paas/RuntimeService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/paas/applications
 * List user's applications
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const applications = await ApplicationService.getApplicationsByUser(userId);
    res.json({ success: true, applications });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paas/applications/:id
 * Get application details
 */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const application = await ApplicationService.getApplicationWithDetails(id);
    
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    res.json({ success: true, application });
  } catch (error: any) {
    console.error('Error fetching application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paas/applications
 * Create new application
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    
    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { name, runtime_id, plan_id, region } = req.body;

    // Validation
    if (!name || !plan_id || !region) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, plan_id, region' 
      });
    }

    // Verify plan exists
    const plan = await PlanService.getPlanById(parseInt(plan_id));
    if (!plan || !plan.is_active) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    // Verify runtime if provided
    if (runtime_id) {
      const runtime = await RuntimeService.getRuntimeById(parseInt(runtime_id));
      if (!runtime || !runtime.is_active) {
        return res.status(400).json({ success: false, error: 'Invalid runtime' });
      }
    }

    // Generate unique slug
    const slug = await ApplicationService.generateUniqueSlug(name);

    // Generate system domain
    const systemDomain = `${slug}.${process.env.PAAS_BASE_DOMAIN || 'apps.example.com'}`;

    const application = await ApplicationService.createApplication({
      user_id: userId,
      organization_id: organizationId,
      name,
      slug,
      runtime_id: runtime_id ? parseInt(runtime_id) : undefined,
      plan_id: parseInt(plan_id),
      region,
      system_domain: systemDomain
    });

    res.status(201).json({ success: true, application });
  } catch (error: any) {
    console.error('Error creating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/paas/applications/:id
 * Update application settings
 */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updateData: any = {};

    // Only include fields that are present in the request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.runtime_id !== undefined) updateData.runtime_id = parseInt(req.body.runtime_id);
    if (req.body.plan_id !== undefined) updateData.plan_id = parseInt(req.body.plan_id);
    if (req.body.git_repo_url !== undefined) updateData.git_repo_url = req.body.git_repo_url;
    if (req.body.git_branch !== undefined) updateData.git_branch = req.body.git_branch;
    if (req.body.auto_deploy !== undefined) updateData.auto_deploy = req.body.auto_deploy;
    if (req.body.custom_domains !== undefined) updateData.custom_domains = req.body.custom_domains;

    const application = await ApplicationService.updateApplication(id, updateData);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    res.json({ success: true, application });
  } catch (error: any) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/paas/applications/:id
 * Delete application
 */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // TODO: Send delete task to agent before deleting from database

    const deleted = await ApplicationService.deleteApplication(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/deploy
 * Trigger deployment
 */
router.post('/:id/deploy', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // TODO: Implement deployment orchestration
    // 1. Select appropriate worker node
    // 2. Create build record
    // 3. Send deployment task to agent
    // 4. Update application status to 'building'

    res.json({ 
      success: true, 
      message: 'Deployment initiated',
      status: 'pending'
    });
  } catch (error: any) {
    console.error('Error deploying application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/restart
 * Restart application
 */
router.post('/:id/restart', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // TODO: Send restart task to agent

    res.json({ success: true, message: 'Application restart initiated' });
  } catch (error: any) {
    console.error('Error restarting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/stop
 * Stop application
 */
router.post('/:id/stop', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // TODO: Send stop task to agent
    await ApplicationService.updateApplication(id, { status: 'stopped' });

    res.json({ success: true, message: 'Application stopped' });
  } catch (error: any) {
    console.error('Error stopping application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/start
 * Start application
 */
router.post('/:id/start', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = parseInt(req.params.id);
    
    // Check ownership
    const isOwner = await ApplicationService.isApplicationOwner(id, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // TODO: Send start task to agent

    res.json({ success: true, message: 'Application start initiated' });
  } catch (error: any) {
    console.error('Error starting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
