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
import agentRouter from './agent.js';
import githubRouter from './github.js';

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

// GitHub integration
router.use('/github', githubRouter);

// Internal routes (for agent communication)
router.use('/internal', internalRouter);

// Agent distribution
router.use('/agent', agentRouter);

export default router;
