/**
 * Admin PaaS Runtimes Routes
 * Manage available runtime environments
 */

import express from 'express';
import { RuntimeService } from '../../../services/paas/RuntimeService.js';

const router = express.Router();

/**
 * GET /api/admin/paas/runtimes
 * List all runtimes
 */
router.get('/', async (req, res) => {
  try {
    const runtimes = await RuntimeService.getAllRuntimes();
    res.json({ success: true, runtimes });
  } catch (error: any) {
    console.error('Error fetching runtimes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/runtimes/:id
 * Get a single runtime by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const runtime = await RuntimeService.getRuntimeById(id);
    
    if (!runtime) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }

    res.json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error fetching runtime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/runtimes
 * Create a new runtime
 */
router.post('/', async (req, res) => {
  try {
    const { name, runtime_type, version, base_image, default_build_cmd, default_start_cmd } = req.body;

    // Validation
    if (!name || !runtime_type || !version || !base_image) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    if (!['node', 'python', 'php', 'docker'].includes(runtime_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid runtime_type. Must be one of: node, python, php, docker'
      });
    }

    const runtime = await RuntimeService.createRuntime({
      name,
      runtime_type,
      version,
      base_image,
      default_build_cmd,
      default_start_cmd
    });

    res.status(201).json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error creating runtime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/runtimes/:id
 * Update a runtime
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData: any = {};

    // Only include fields that are present in the request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.version !== undefined) updateData.version = req.body.version;
    if (req.body.base_image !== undefined) updateData.base_image = req.body.base_image;
    if (req.body.default_build_cmd !== undefined) updateData.default_build_cmd = req.body.default_build_cmd;
    if (req.body.default_start_cmd !== undefined) updateData.default_start_cmd = req.body.default_start_cmd;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    const runtime = await RuntimeService.updateRuntime(id, updateData);

    if (!runtime) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }

    res.json({ success: true, runtime });
  } catch (error: any) {
    console.error('Error updating runtime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/runtimes/:id
 * Delete a runtime
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if runtime is in use
    const inUse = await RuntimeService.isRuntimeInUse(id);
    if (inUse) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete runtime that is currently in use' 
      });
    }

    const deleted = await RuntimeService.deleteRuntime(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Runtime not found' });
    }

    res.json({ success: true, message: 'Runtime deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting runtime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
