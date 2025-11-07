import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../../middleware/auth.js';
import { runtimeService } from '../../../services/paas/index.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const runtimes = await runtimeService.getAll(includeInactive);
    res.json({ success: true, runtimes });
  } catch (error: any) {
    console.error('Error fetching PaaS runtimes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch runtimes' });
  }
});

router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const runtime = await runtimeService.getById(parseInt(req.params.id));
    if (!runtime) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }
    res.json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error fetching PaaS runtime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch runtime' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, runtime_type, version, base_image, default_build_cmd, default_start_cmd } = req.body;

    if (!name || !runtime_type || !version || !base_image) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const validation = await runtimeService.validateDockerImage(base_image);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const runtime = await runtimeService.create({
      name,
      runtime_type,
      version,
      base_image,
      default_build_cmd: default_build_cmd || null,
      default_start_cmd: default_start_cmd || null,
      is_active: true
    });

    res.status(201).json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error creating PaaS runtime:', error);
    res.status(500).json({ success: false, error: 'Failed to create runtime' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    if (updates.base_image) {
      const validation = await runtimeService.validateDockerImage(updates.base_image);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
    }

    const runtime = await runtimeService.update(id, updates);
    
    if (!runtime) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }

    res.json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error updating PaaS runtime:', error);
    res.status(500).json({ success: false, error: 'Failed to update runtime' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await runtimeService.delete(id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PaaS runtime:', error);
    res.status(500).json({ success: false, error: 'Failed to delete runtime' });
  }
});

export default router;
