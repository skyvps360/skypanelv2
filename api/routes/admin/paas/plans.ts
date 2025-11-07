/**
 * Admin PaaS Plans Routes
 * Manage App Hosting Plans
 */

import express from 'express';
import { PlanService } from '../../../services/paas/PlanService.js';

const router = express.Router();

/**
 * GET /api/admin/paas/plans
 * List all App Hosting Plans
 */
router.get('/', async (req, res) => {
  try {
    const plans = await PlanService.getAllPlans();
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/plans/:id
 * Get a single plan by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const plan = await PlanService.getPlanById(id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/plans
 * Create a new plan
 */
router.post('/', async (req, res) => {
  try {
    const { name, cpu_limit, memory_limit, storage_limit, monthly_price, hourly_rate, supported_runtimes } = req.body;

    // Validation
    if (!name || !cpu_limit || !memory_limit || !storage_limit || !monthly_price || !hourly_rate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const plan = await PlanService.createPlan({
      name,
      cpu_limit: parseInt(cpu_limit),
      memory_limit: parseInt(memory_limit),
      storage_limit: parseInt(storage_limit),
      monthly_price: parseFloat(monthly_price),
      hourly_rate: parseFloat(hourly_rate),
      supported_runtimes: supported_runtimes || []
    });

    res.status(201).json({ success: true, plan });
  } catch (error: any) {
    console.error('Error creating plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/plans/:id
 * Update a plan
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData: any = {};

    // Only include fields that are present in the request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.cpu_limit !== undefined) updateData.cpu_limit = parseInt(req.body.cpu_limit);
    if (req.body.memory_limit !== undefined) updateData.memory_limit = parseInt(req.body.memory_limit);
    if (req.body.storage_limit !== undefined) updateData.storage_limit = parseInt(req.body.storage_limit);
    if (req.body.monthly_price !== undefined) updateData.monthly_price = parseFloat(req.body.monthly_price);
    if (req.body.hourly_rate !== undefined) updateData.hourly_rate = parseFloat(req.body.hourly_rate);
    if (req.body.supported_runtimes !== undefined) updateData.supported_runtimes = req.body.supported_runtimes;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    const plan = await PlanService.updatePlan(id, updateData);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Error updating plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/plans/:id
 * Delete a plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if plan is in use
    const inUse = await PlanService.isPlanInUse(id);
    if (inUse) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete plan that is currently in use' 
      });
    }

    const deleted = await PlanService.deletePlan(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
