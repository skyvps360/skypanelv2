import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { databaseService, deploymentScheduler, applicationService } from '../../../services/paas/index.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    
    const databases = await databaseService.getAll(userId, organizationId);
    res.json({ success: true, databases });
  } catch (error: any) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch databases' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await databaseService.getById(parseInt(req.params.id));
    if (!db) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }

    if (db.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const connectionString = databaseService.getConnectionString(db);

    res.json({ 
      success: true, 
      database: db,
      connection_string: connectionString
    });
  } catch (error: any) {
    console.error('Error fetching database:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch database' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, db_type, version, plan_id, region } = req.body;

    if (!name || !db_type || !version) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const db = await databaseService.create({
      user_id: req.user!.id,
      organization_id: req.user!.organizationId,
      name,
      db_type,
      version,
      plan_id: plan_id || null,
      region: region || 'default'
    });

    await deploymentScheduler.scheduleDatabaseCreation(db.id);

    res.status(201).json({ success: true, database: db });
  } catch (error: any) {
    console.error('Error creating database:', error);
    res.status(500).json({ success: false, error: 'Failed to create database' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await databaseService.getById(id);
    
    if (!db) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }

    if (db.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await deploymentScheduler.scheduleDatabaseDelete(id);
    await databaseService.delete(id);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting database:', error);
    res.status(500).json({ success: false, error: 'Failed to delete database' });
  }
});

router.post('/:appId/databases/:dbId', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const dbId = parseInt(req.params.dbId);
    const { env_var_prefix } = req.body;

    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const db = await databaseService.getById(dbId);
    
    if (!db) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }

    if (db.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await databaseService.linkToApplication(appId, dbId, env_var_prefix || 'DATABASE');
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error linking database:', error);
    res.status(500).json({ success: false, error: 'Failed to link database' });
  }
});

router.delete('/:appId/databases/:dbId', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const dbId = parseInt(req.params.dbId);

    const app = await applicationService.getById(appId);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (app.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const success = await databaseService.unlinkFromApplication(appId, dbId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error unlinking database:', error);
    res.status(500).json({ success: false, error: 'Failed to unlink database' });
  }
});

export default router;
