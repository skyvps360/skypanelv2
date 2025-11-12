/**
 * Quota Recalculation Background Job
 * Runs every 30 seconds to update organization quota usage and check thresholds
 */

import { QuotaService } from '../services/containers/QuotaService.js';
import { QuotaAlertService } from '../services/containers/QuotaAlertService.js';

let intervalId: NodeJS.Timeout | null = null;
let cleanupIntervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the quota recalculation job
 */
export function startQuotaRecalculationJob(): void {
  if (intervalId) {
    console.log('⚠️  Quota recalculation job is already running');
    return;
  }

  console.log('🔄 Starting quota recalculation job (every 30 seconds)');

  // Run immediately on start
  runQuotaRecalculation();

  // Then run every 30 seconds
  intervalId = setInterval(() => {
    runQuotaRecalculation();
  }, 30000); // 30 seconds

  // Clean up expired alerts every hour
  cleanupIntervalId = setInterval(() => {
    QuotaAlertService.clearExpiredAlerts();
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Stop the quota recalculation job
 */
export function stopQuotaRecalculationJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 Quota recalculation job stopped');
  }

  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Run quota recalculation and alert checking for all organizations
 */
async function runQuotaRecalculation(): Promise<void> {
  // Prevent concurrent runs
  if (isRunning) {
    console.log('⏭️  Skipping quota recalculation - previous run still in progress');
    return;
  }

  isRunning = true;

  try {
    const startTime = Date.now();
    
    // Recalculate quotas for all organizations
    await QuotaService.recalculateAllQuotas();
    
    // Check for quota threshold violations and send alerts
    await QuotaAlertService.checkAllOrganizationQuotas();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Quota recalculation and alert check completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error during quota recalculation:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status
 */
export function getQuotaRecalculationJobStatus(): {
  running: boolean;
  intervalActive: boolean;
} {
  return {
    running: isRunning,
    intervalActive: intervalId !== null,
  };
}
