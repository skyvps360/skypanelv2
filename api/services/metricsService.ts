/**
 * Metrics Collection Service for SkyPanelV2
 * Handles real-time and historical container resource usage monitoring
 */

import { query } from '../lib/database.js';
import Dockerode from 'dockerode';
import { 
  ContainerServiceError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';

// ============================================================
// Type Definitions
// ============================================================

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkIn: number;
  networkOut: number;
  blockRead: number;
  blockWrite: number;
  uptime: number;
  restartCount: number;
}

export interface ContainerHealth {
  containerId: string;
  status: string;
  health?: 'healthy' | 'unhealthy' | 'starting';
  running: boolean;
  paused: boolean;
  restarting: boolean;
  exitCode?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface UsageHistory {
  timestamp: string;
  cpuPercent: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}

export interface ResourceSummary {
  totalCpu: number;
  totalMemory: number;
  totalStorage: number;
  containerCount: number;
  runningContainers: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
}

// ============================================================
// Metrics Service Class
// ============================================================

class MetricsService {
  /**
   * Get Docker client
   */
  private getDockerClient(): Dockerode {
    return new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Get real-time container statistics
   */
  async getLiveStats(containerId: string): Promise<ContainerStats> {
    try {
      const docker = this.getDockerClient();
      const container = docker.getContainer(containerId);
      
      // Get container info
      const inspect = await container.inspect();
      
      // Get container stats (single snapshot)
      const stats = await container.stats({ stream: false });
      
      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
      
      // Memory stats
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
      
      // Network stats
      let networkIn = 0;
      let networkOut = 0;
      if (stats.networks) {
        for (const [, net] of Object.entries(stats.networks)) {
          networkIn += (net as any).rx_bytes || 0;
          networkOut += (net as any).tx_bytes || 0;
        }
      }
      
      // Block I/O stats
      let blockRead = 0;
      let blockWrite = 0;
      if (stats.blkio_stats?.io_service_bytes_recursive) {
        for (const io of stats.blkio_stats.io_service_bytes_recursive) {
          if (io.op === 'Read') blockRead += io.value;
          if (io.op === 'Write') blockWrite += io.value;
        }
      }
      
      // Calculate uptime
      const startedAt = new Date(inspect.State.StartedAt).getTime();
      const now = Date.now();
      const uptime = Math.floor((now - startedAt) / 1000);
      
      return {
        cpuPercent: Math.round(cpuPercent * 100) / 100,
        memoryUsage: Math.round(memoryUsage / (1024 * 1024)), // MB
        memoryLimit: Math.round(memoryLimit / (1024 * 1024)), // MB
        memoryPercent: Math.round(memoryPercent * 100) / 100,
        networkIn,
        networkOut,
        blockRead,
        blockWrite,
        uptime,
        restartCount: inspect.RestartCount || 0
      };
    } catch (error) {
      console.error('Error getting container stats:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to get container statistics',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get container health status
   */
  async getContainerHealth(containerId: string): Promise<ContainerHealth> {
    try {
      const docker = this.getDockerClient();
      const container = docker.getContainer(containerId);
      
      const inspect = await container.inspect();
      const state = inspect.State;
      
      return {
        containerId,
        status: state.Status,
        health: state.Health?.Status as any,
        running: state.Running,
        paused: state.Paused,
        restarting: state.Restarting,
        exitCode: state.ExitCode,
        error: state.Error || undefined,
        startedAt: state.StartedAt,
        finishedAt: state.FinishedAt
      };
    } catch (error) {
      console.error('Error getting container health:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to get container health',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Store metrics snapshot in database
   */
  async storeMetricsSnapshot(organizationId: string, containerId: string, stats: ContainerStats): Promise<void> {
    try {
      await query(
        `INSERT INTO container_metrics 
         (organization_id, container_id, cpu_percent, memory_mb, network_in_bytes, network_out_bytes, block_read_bytes, block_write_bytes, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          organizationId,
          containerId,
          stats.cpuPercent,
          stats.memoryUsage,
          stats.networkIn,
          stats.networkOut,
          stats.blockRead,
          stats.blockWrite
        ]
      );
    } catch (error) {
      console.error('Error storing metrics snapshot:', error);
      // Don't throw error - metrics storage failure shouldn't break other operations
    }
  }

  /**
   * Get historical metrics for a container
   */
  async getHistoricalStats(containerId: string, timeRange: { start: Date; end: Date }): Promise<UsageHistory[]> {
    try {
      const result = await query(
        `SELECT 
          timestamp,
          cpu_percent,
          memory_mb,
          network_in_bytes,
          network_out_bytes
         FROM container_metrics
         WHERE container_id = $1
           AND timestamp >= $2
           AND timestamp <= $3
         ORDER BY timestamp ASC`,
        [containerId, timeRange.start, timeRange.end]
      );

      return result.rows.map(row => ({
        timestamp: row.timestamp,
        cpuPercent: parseFloat(row.cpu_percent) || 0,
        memoryUsage: parseFloat(row.memory_mb) || 0,
        networkIn: parseInt(row.network_in_bytes) || 0,
        networkOut: parseInt(row.network_out_bytes) || 0
      }));
    } catch (error) {
      console.error('Error getting historical stats:', error);
      return [];
    }
  }

  /**
   * Get organization resource summary
   */
  async getOrganizationUsage(organizationId: string): Promise<ResourceSummary> {
    try {
      const result = await query(
        `SELECT 
          COUNT(cs.id) as container_count,
          SUM(CASE WHEN cs.status = 'running' THEN 1 ELSE 0 END) as running_count,
          COALESCE(SUM(cs.cpu_limit), 0) as total_cpu,
          COALESCE(SUM(cs.memory_limit_gb), 0) as total_memory,
          COALESCE(SUM(cs.storage_limit_gb), 0) as total_storage
         FROM container_services cs
         INNER JOIN container_projects cp ON cs.project_id = cp.id
         WHERE cp.organization_id = $1
           AND cs.status != 'deleted'`,
        [organizationId]
      );

      const row = result.rows[0];
      
      // Get current CPU and memory usage from recent metrics
      const usageResult = await query(
        `SELECT 
          AVG(cm.cpu_percent) as avg_cpu,
          AVG(cm.memory_mb) as avg_memory
         FROM container_metrics cm
         INNER JOIN container_services cs ON cm.container_id = cs.container_id
         INNER JOIN container_projects cp ON cs.project_id = cp.id
         WHERE cp.organization_id = $1
           AND cm.timestamp >= NOW() - INTERVAL '5 minutes'`,
        [organizationId]
      );

      const usage = usageResult.rows[0];
      const totalCpu = parseFloat(row.total_cpu) || 0;
      const totalMemory = parseFloat(row.total_memory) || 0;
      const avgCpu = parseFloat(usage.avg_cpu) || 0;
      const avgMemory = parseFloat(usage.avg_memory) || 0;

      return {
        totalCpu,
        totalMemory,
        totalStorage: parseFloat(row.total_storage) || 0,
        containerCount: parseInt(row.container_count) || 0,
        runningContainers: parseInt(row.running_count) || 0,
        cpuUsagePercent: totalCpu > 0 ? Math.round((avgCpu / totalCpu) * 100) / 100 : 0,
        memoryUsagePercent: totalMemory > 0 ? Math.round((avgMemory / (totalMemory * 1024)) * 100) / 100 : 0
      };
    } catch (error) {
      console.error('Error getting organization usage:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to get organization resource usage',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Collect metrics for all containers (background task)
   */
  async collectAllMetrics(): Promise<void> {
    try {
      // Get all active container services
      const result = await query(
        `SELECT cs.id, cs.container_id, cp.organization_id
         FROM container_services cs
         INNER JOIN container_projects cp ON cs.project_id = cp.id
         WHERE cs.container_id IS NOT NULL
           AND cs.status = 'running'
           AND cp.status = 'active'`
      );

      for (const row of result.rows) {
        try {
          const stats = await this.getLiveStats(row.container_id);
          await this.storeMetricsSnapshot(row.organization_id, row.container_id, stats);
        } catch (error) {
          console.error(`Failed to collect metrics for container ${row.container_id}:`, error);
          // Continue with other containers
        }
      }
    } catch (error) {
      console.error('Error collecting all metrics:', error);
      // Don't throw - this is a background task
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics(retentionDays: number = 30): Promise<void> {
    try {
      await query(
        `DELETE FROM container_metrics 
         WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'`
      );
    } catch (error) {
      console.error('Error cleaning up old metrics:', error);
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
