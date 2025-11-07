import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../../middleware/auth.js';
import { planService } from '../../../services/paas/index.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const plans = await planService.getAll(includeInactive);
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error fetching PaaS plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const plan = await planService.getById(parseInt(req.params.id));
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Error fetching PaaS plan:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plan' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, cpu_limit, memory_limit, storage_limit, monthly_price, supported_runtimes } = req.body;

    if (!name || !cpu_limit || !memory_limit || !storage_limit || !monthly_price) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const hourly_rate = await planService.calculateHourlyRate(monthly_price);

    const plan = await planService.create({
      name,
      cpu_limit,
      memory_limit,
      storage_limit,
      monthly_price,
      hourly_rate,
      supported_runtimes: supported_runtimes || [],
      is_active: true
    });

    res.status(201).json({ success: true, plan });
  } catch (error: any) {
    console.error('Error creating PaaS plan:', error);
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    if (updates.monthly_price) {
      updates.hourly_rate = await planService.calculateHourlyRate(updates.monthly_price);
    }

    const plan = await planService.update(id, updates);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Error updating PaaS plan:', error);
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await planService.delete(id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PaaS plan:', error);
    res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }
});

export default router;
