/**
 * PaaS Worker Process
 * Background worker for build/deploy/billing queue processing
 */

import dotenv from 'dotenv';
if (!process.env.IN_DOCKER) {
  dotenv.config();
}

import { BuilderService } from '../services/paas/builderService.js';
import { DeployerService } from '../services/paas/deployerService.js';
import { NodeManagerService } from '../services/paas/nodeManagerService.js';
import { PaasBillingService } from '../services/paas/billingService.js';
import { HealthCheckService } from '../services/paas/healthCheckService.js';
import { LoggerService } from '../services/paas/loggerService.js';
import { BuildCacheService } from '../services/paas/buildCacheService.js';
import { buildQueue, deployQueue, billingQueue, redisUrl } from './queues.js';

console.log('PaaS worker starting...');
console.log(`Redis URL: ${redisUrl}`);

/**
 * Build Queue Processor
 */
buildQueue.process(async (job) => {
  console.log(`[Build] Processing job ${job.id}`);
  job.progress(5);

  const { applicationId, gitUrl, gitBranch, gitCommit, buildpack, userId, replicas } = job.data;

  try {
    job.progress(20);
    const buildResult = await BuilderService.build({
      applicationId,
      gitUrl,
      gitBranch,
      gitCommit,
      buildpack,
      userId,
    });

    if (buildResult.success) {
      job.progress(80);
      await deployQueue.add({
        deploymentId: buildResult.deploymentId,
        replicas,
      });
    }

    job.progress(100);
    return buildResult;
  } catch (error: any) {
    console.error('[Build] Failed:', error);
    throw error;
  }
});

/**
 * Deploy Queue Processor
 */
deployQueue.process(async (job) => {
  console.log(`[Deploy] Processing job ${job.id}`);
  job.progress(10);

  const { deploymentId, replicas, cachedSlugPath } = job.data as {
    deploymentId: string;
    replicas?: number;
    cachedSlugPath?: string;
  };

  try {
    const deployResult = await DeployerService.deploy({
      deploymentId,
      replicas,
      cachedSlugPath,
      startedAt: Date.now(),
    });

    job.progress(100);
    return deployResult;
  } catch (error: any) {
    console.error('[Deploy] Failed:', error);
    throw error;
  }
});

/**
 * Billing Queue Processor
 */
billingQueue.process(async (job) => {
  console.log(`[Billing] Processing job ${job.id}`);

  try {
    const result = await PaasBillingService.recordHourlyUsage();
    console.log(`[Billing] Completed - ${result.billedInstances} apps billed, $${result.totalAmount.toFixed(2)} charged`);

    if (result.failedInstances.length > 0) {
      console.warn(`[Billing] ${result.failedInstances.length} apps failed billing:`, result.errors);
    }

    return result;
  } catch (error: any) {
    console.error('[Billing] Critical error:', error);
    throw error;
  }
});

/**
 * Ensure hourly billing job is scheduled
 */
const ensureBillingSchedule = async () => {
  try {
    const scheduled = await billingQueue.getRepeatableJobs();
    const hourlyJobId = 'paas-hourly-billing';
    const exists = scheduled.some((job) => job.id === hourlyJobId);

    if (!exists) {
      await billingQueue.add(
        'hourly',
        {},
        {
          repeat: { cron: '0 * * * *' },
          jobId: hourlyJobId,
          removeOnComplete: true,
        }
      );
      console.log('[Billing] Scheduled hourly billing job');
    }
  } catch (error) {
    console.error('[Billing] Failed to ensure hourly billing schedule:', error);
  }
};

ensureBillingSchedule().catch((error) => console.error('Failed to initialize billing schedule:', error));

/**
 * Node Health Monitor
 */
const pollWorkerNodes = async (): Promise<void> => {
  try {
    await NodeManagerService.updateNodeResources();
  } catch (error) {
    console.error('[Health] Failed to update node resources:', error);
  }
};

pollWorkerNodes().catch((error) => console.error('Initial worker node sync failed:', error));
setInterval(pollWorkerNodes, 30 * 1000);

/**
 * Application Health Monitor
 */
setInterval(async () => {
  try {
    await HealthCheckService.monitorHealthChecks();
  } catch (error) {
    console.error('[Health] Failed to monitor application health:', error);
  }
}, 60 * 1000);

/**
 * Log retention enforcement
 */
const enforceLogRetention = async () => {
  try {
    await LoggerService.enforceRetention();
  } catch (error) {
    console.error('[Logs] Failed to enforce log retention:', error);
  }
};

enforceLogRetention().catch((error) => console.error('Initial log retention check failed:', error));
setInterval(enforceLogRetention, 6 * 60 * 60 * 1000);

/**
 * Build cache cleanup
 */
const cleanupBuildCache = async () => {
  try {
    const { removed, reclaimedBytes } = await BuildCacheService.cleanupExpiredCaches();
    if (removed > 0) {
      console.log(
        `[BuildCache] Removed ${removed} expired cache${removed === 1 ? '' : 's'} (~${(
          reclaimedBytes / (1024 * 1024)
        ).toFixed(2)} MB reclaimed)`
      );
    }
  } catch (error) {
    console.error('[BuildCache] Failed to cleanup caches:', error);
  }
};

cleanupBuildCache().catch((error) => console.error('Initial cache cleanup failed:', error));
setInterval(cleanupBuildCache, 6 * 60 * 60 * 1000);

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

billingQueue.on('completed', (job) => {
  console.log(`[Billing] Job ${job.id} completed`);
});

billingQueue.on('failed', (job, err) => {
  console.error(`[Billing] Job ${job?.id} failed:`, err);
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');

  await buildQueue.close();
  await deployQueue.close();
  await billingQueue.close();

  console.log('Worker shut down gracefully');
  process.exit(0);
});

console.log('PaaS worker ready.');
console.log('   - Build queue: listening');
console.log('   - Deploy queue: listening');
console.log('   - Billing queue: listening');
console.log('   - Node health monitor: active');
