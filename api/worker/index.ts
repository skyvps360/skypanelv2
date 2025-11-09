/**
 * PaaS Worker Process
 * Background worker for build/deploy queue processing
 */

import dotenv from 'dotenv';
if (!process.env.IN_DOCKER) {
  dotenv.config();
}

import Queue from 'bull';
import { BuilderService } from '../services/paas/builderService.js';
import { DeployerService } from '../services/paas/deployerService.js';
import { NodeManagerService } from '../services/paas/nodeManagerService.js';
import { BillingService } from '../services/billingService.js';

// Initialize Bull queues
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const buildQueue = new Queue('paas-build', REDIS_URL);
const deployQueue = new Queue('paas-deploy', REDIS_URL);
const billingQueue = new Queue('paas-billing', REDIS_URL);

console.log('🚀 PaaS Worker starting...');
console.log(`📦 Redis URL: ${REDIS_URL}`);

/**
 * Build Queue Processor
 */
buildQueue.process(async (job) => {
  console.log(`[Build] Processing job ${job.id}`);

  const { applicationId, gitUrl, gitBranch, gitCommit, buildpack, userId } = job.data;

  try {
    const buildResult = await BuilderService.build({
      applicationId,
      gitUrl,
      gitBranch,
      gitCommit,
      buildpack,
      userId,
    });

    if (buildResult.success) {
      // Queue deployment
      await deployQueue.add({
        deploymentId: buildResult.deploymentId,
      });
    }

    return buildResult;
  } catch (error: any) {
    console.error(`[Build] Failed:`, error);
    throw error;
  }
});

/**
 * Deploy Queue Processor
 */
deployQueue.process(async (job) => {
  console.log(`[Deploy] Processing job ${job.id}`);

  const { deploymentId, replicas } = job.data;

  try {
    const deployResult = await DeployerService.deploy({
      deploymentId,
      replicas,
    });

    return deployResult;
  } catch (error: any) {
    console.error(`[Deploy] Failed:`, error);
    throw error;
  }
});

/**
 * Billing Queue Processor
 * Runs hourly to calculate PaaS resource usage and charge organizations
 */
billingQueue.process(async (job) => {
  console.log(`[Billing] Processing job ${job.id}`);

  try {
    // Run PaaS hourly billing
    const result = await BillingService.runPaaSHourlyBilling();

    console.log(`[Billing] Completed - ${result.billedInstances} apps billed, $${result.totalAmount.toFixed(2)} charged`);

    if (result.failedInstances.length > 0) {
      console.warn(`[Billing] ${result.failedInstances.length} apps failed billing:`, result.errors);
    }

    return result;
  } catch (error: any) {
    console.error(`[Billing] Critical error:`, error);
    throw error;
  }
});

/**
 * Node Health Monitor
 * Updates node status every 5 minutes
 */
setInterval(async () => {
  try {
    await NodeManagerService.updateNodeResources();
  } catch (error) {
    console.error('[Health] Failed to update node resources:', error);
  }
}, 5 * 60 * 1000);

/**
 * Queue Event Handlers
 */
buildQueue.on('completed', (job) => {
  console.log(`[Build] Job ${job.id} completed`);
});

buildQueue.on('failed', (job, err) => {
  console.error(`[Build] Job ${job?.id} failed:`, err);
});

deployQueue.on('completed', (job) => {
  console.log(`[Deploy] Job ${job.id} completed`);
});

deployQueue.on('failed', (job, err) => {
  console.error(`[Deploy] Job ${job?.id} failed:`, err);
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
  console.log('⏸️  Shutting down worker...');

  await buildQueue.close();
  await deployQueue.close();
  await billingQueue.close();

  console.log('👋 Worker shut down gracefully');
  process.exit(0);
});

console.log('✅ PaaS Worker is ready!');
console.log('   - Build queue: listening');
console.log('   - Deploy queue: listening');
console.log('   - Billing queue: listening');
console.log('   - Node health monitor: active');
