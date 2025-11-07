import { Router } from 'express';
import plansAdminRouter from './plans.admin.js';
import runtimesAdminRouter from './runtimes.admin.js';
import nodesAdminRouter from './nodes.admin.js';
import applicationsRouter from './applications.js';
import buildsRouter from './builds.js';
import environmentRouter from './environment.js';
import databasesRouter from './databases.js';
import configRouter from './config.js';
import internalRouter from './internal.js';

const router = Router();

// Admin routes
router.use('/admin/plans', plansAdminRouter);
router.use('/admin/runtimes', runtimesAdminRouter);
router.use('/admin/nodes', nodesAdminRouter);

// Customer routes
router.use('/applications', applicationsRouter);
router.use('/applications', buildsRouter);
router.use('/applications', environmentRouter);
router.use('/databases', databasesRouter);
router.use('/applications', databasesRouter);
router.use('/', configRouter);

// Internal routes (for agent communication)
router.use('/internal', internalRouter);

export default router;
