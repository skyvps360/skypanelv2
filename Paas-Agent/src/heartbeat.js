import si from 'systeminformation';
import fetch from 'node-fetch';
import { createAuthHeaders } from './connection.js';
import logger from './logger.js';
import { getDockerStats } from './docker.js';

let heartbeatTimer = null;

export function startHeartbeat(config) {
  // Send initial heartbeat immediately
  sendHeartbeat(config);

  // Then send periodically
  heartbeatTimer = setInterval(() => {
    sendHeartbeat(config);
  }, config.heartbeatInterval);
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function sendHeartbeat(config) {
  try {
    // Gather system metrics
    const [cpu, mem, disk, dockerStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      getDockerStats().catch(() => ({ containerCount: 0 })),
    ]);

    // Find root disk
    const rootDisk = disk.find(d => d.mount === '/' || d.mount === 'C:' || d.mount === 'C:\\') || disk[0];

    const metrics = {
      cpu_used: Math.round(cpu.currentLoad),
      memory_used: Math.round((mem.used / mem.total) * 100),
      disk_used: rootDisk ? Math.round((rootDisk.used / rootDisk.size) * 100) : 0,
      container_count: dockerStats.containerCount || 0,
      cpu_total: 100,
      memory_total: Math.round(mem.total / (1024 * 1024 * 1024)), // GB
      disk_total: rootDisk ? Math.round(rootDisk.size / (1024 * 1024 * 1024)) : 0, // GB
    };

    const url = `${config.controlPlaneUrl}/api/paas/internal/nodes/${config.nodeId}/heartbeat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(config),
      body: JSON.stringify(metrics),
    });

    if (!response.ok) {
      logger.error(`Heartbeat failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    if (data.success) {
      logger.debug(`💓 Heartbeat sent - CPU: ${metrics.cpu_used}%, RAM: ${metrics.memory_used}%, Containers: ${metrics.container_count}`);
    }
  } catch (error) {
    logger.error('Heartbeat error:', error.message);
  }
}
