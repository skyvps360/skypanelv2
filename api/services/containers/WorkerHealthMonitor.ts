/**
 * Worker Health Monitor
 * Periodically checks worker health and triggers alerts
 */

import { WorkerService } from './WorkerService.js';

export class WorkerHealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the health monitoring service
   */
  start(intervalSeconds: number = 30): void {
    if (this.isRunning) {
      console.warn('Worker health monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🏥 Starting worker health monitor (interval: ${intervalSeconds}s)`);

    // Run initial check
    this.checkHealth();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the health monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🏥 Worker health monitor stopped');
  }

  /**
   * Perform health check
   */
  private async checkHealth(): Promise<void> {
    try {
      await WorkerService.checkWorkerHealth();
    } catch (error) {
      console.error('Error in worker health check:', error);
    }
  }
}

// Export singleton instance
export const workerHealthMonitor = new WorkerHealthMonitor();
