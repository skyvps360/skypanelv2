import { Router } from 'express';
import { nodeService, taskService } from '../../../services/paas/index.js';

const router = Router();

router.post('/nodes/register', async (req, res) => {
  try {
    const { registration_token, cpu_total, memory_total, disk_total } = req.body;

    if (!registration_token || !cpu_total || !memory_total || !disk_total) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await nodeService.completeRegistration(registration_token, {
      cpu_total,
      memory_total,
      disk_total
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Invalid registration token' });
    }

    res.json({
      success: true,
      node_id: result.node.id,
      jwt_secret: result.jwtSecret
    });
  } catch (error: any) {
    console.error('Error registering node:', error);
    res.status(500).json({ success: false, error: 'Failed to register node' });
  }
});

router.post('/nodes/:id/heartbeat', async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    const heartbeat = req.body;

    const node = await nodeService.getById(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing authorization' });
    }

    const token = authHeader.substring(7);
    const verification = nodeService.verifyNodeJWT(token, node.jwt_secret!);
    
    if (!verification.valid || verification.nodeId !== nodeId) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    await nodeService.processHeartbeat(nodeId, heartbeat);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({ success: false, error: 'Failed to process heartbeat' });
  }
});

router.get('/nodes/:id/tasks', async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);

    const node = await nodeService.getById(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing authorization' });
    }

    const token = authHeader.substring(7);
    const verification = nodeService.verifyNodeJWT(token, node.jwt_secret!);
    
    if (!verification.valid || verification.nodeId !== nodeId) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const tasks = await taskService.getPendingTasksForNode(nodeId);

    res.json({ success: true, tasks });
  } catch (error: any) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to get tasks' });
  }
});

router.put('/tasks/:id/status', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { status, output, message } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const task = await taskService.getById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const node = await nodeService.getById(task.node_id!);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing authorization' });
    }

    const token = authHeader.substring(7);
    const verification = nodeService.verifyNodeJWT(token, node.jwt_secret!);
    
    if (!verification.valid || verification.nodeId !== task.node_id) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    await taskService.updateStatus(taskId, status, output, message);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, error: 'Failed to update task status' });
  }
});

export default router;
