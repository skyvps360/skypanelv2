import { nodeService } from './paas/index.js';

export class PaaSMonitor {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    console.log('[PaaS Monitor] Starting node health monitoring...');
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkNodeHealth();
      } catch (error) {
        console.error('[PaaS Monitor] Error checking node health:', error);
      }
    }, 60000);

    this.checkNodeHealth().catch(err => {
      console.error('[PaaS Monitor] Initial health check failed:', err);
    });
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[PaaS Monitor] Stopped node health monitoring');
    }
  }

  private async checkNodeHealth() {
    const offlineNodes = await nodeService.checkOfflineNodes();
    
    if (offlineNodes.length > 0) {
      console.warn(`[PaaS Monitor] Detected ${offlineNodes.length} offline nodes:`, 
        offlineNodes.map(n => ({ id: n.id, name: n.name, last_heartbeat: n.last_heartbeat }))
      );
    }
  }
}

export const paasMonitor = new PaaSMonitor();
