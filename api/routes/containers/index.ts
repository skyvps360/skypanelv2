/**
 * Container Platform Routes
 * Main entry point for all container-related routes
 */
import { Router } from 'express';
import servicesRoutes from './services.js';
import webhookRoutes from './webhooks.js';
import templateRoutes from './templates.js';
import billingRoutes from './billing.js';
import quotaRoutes from './quotas.js';
import logsRoutes from './logs.js';
import metricsRoutes from './metrics.js';
import secretsRoutes from './secrets.js';

const router = Router();

// Mount service routes
router.use('/services', servicesRoutes);

// Mount webhook routes
router.use('/webhooks', webhookRoutes);

// Mount template routes
router.use('/templates', templateRoutes);

// Mount billing routes
router.use('/billing', billingRoutes);

// Mount quota routes
router.use('/quotas', quotaRoutes);

// Mount logs routes
router.use('/logs', logsRoutes);

// Mount metrics routes
router.use('/metrics', metricsRoutes);

// Mount secrets routes
router.use('/secrets', secretsRoutes);

export default router;
