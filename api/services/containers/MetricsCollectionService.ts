import { createClient, RedisClientType } from 'redis';
import { query } from '../../lib/database.js';
import { SwarmOrchestrator } from './SwarmOrchestrator.js';

export interface ServiceMetrics {
  serviceId: string;
  timestamp: Date;
  cpu: {
    usagePercent: number;
    usageCores: number;
    limitCores: number;
  };
  memory: {
    usageMb: number;
    usagePercent: number;
    limitMb: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    requestsPerSecond?: number;
  };
  disk: {
    readOps: number;
    writeOps: number;
    readMb: number;
    writeMb: number;
  };
}

export interface MetricsSummary {
  current: ServiceMetrics;
  history: ServiceMetrics[];
  costs: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    total: number;
  };
  alerts: {
    type: 'warning' | 'critical';
    resource: 'cpu' | 'memory' | 'disk' | 'network';
    message: string;
    threshold: number;
    current: number;
  }[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity: '1m' | '5m' | '1h' | '1d';
}

/**
 * Service for collecting and storing container metrics
 */
export class MetricsCollectionService {
  private redisClient: RedisClientType | null = null;
  private collectionInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly COLLECTION_INTERVAL = 60 * 1000; // 1 minute

  // Pricing rates (per hour)
  private readonly PRICING = {
    cpuPerCore: 0.01,
    memoryPerGb: 0.005,
    storagePerGb: 0.000137, // ~$0.10/GB/month
    networkPerGb: 0.01,
  };

  /**
   * Initialize Redis connection and start metrics collection
   */
  async initialize(): Promise<void> {
    if (this.redisClient) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('REDIS_URL not configured, metrics collection disabled');
      return;
    }

    try {
      this.redisClient = createClient({ url: redisUrl });
      await this.redisClient.connect();
      console.log('✅ Metrics collection service connected to Redis');

      // Start periodic metrics collection
      this.startCollection();
    } catch (error) {
      console.error('Failed to initialize metrics collection service:', error);
      this.redisClient = null;
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startCollection(): void {
    if (this.collectionInterval) {
      return;
    }

    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectAllMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, this.COLLECTION_INTERVAL);

    console.log('✅ Metrics collection started (1-minute interval)');
  }

  /**
   * Collect metrics for all running services
   */
  private async collectAllMetrics(): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    // Get all running services
    const servicesResult = await query(
      `SELECT cs.id, cs.slug, cs.organization_id, cs.resource_limits, cd.swarm_service_id
       FROM container_services cs
       JOIN container_deployments cd ON cs.current_deployment_id = cd.id
       WHERE cs.status = 'running' AND cd.swarm_service_id IS NOT NULL`
    );

    for (const service of servicesResult.rows) {
      try {
        const metrics = await this.collectServiceMetrics(
          service.id,
          service.swarm_service_id,
          service.resource_limits
        );

        if (metrics) {
          await this.storeMetrics(metrics);
        }
      } catch (error) {
        console.error(`Error collecting metrics for service ${service.id}:`, error);
      }
    }
  }

  /**
   * Collect metrics for a specific service
   */
  private async collectServiceMetrics(
    serviceId: string,
    swarmServiceId: string,
    resourceLimits: any
  ): Promise<ServiceMetrics | null> {
    try {
      const stats = await SwarmOrchestrator.getServiceStats(swarmServiceId);

      if (!stats) {
        return null;
      }

      const timestamp = new Date();

      // Parse resource limits
      const limits = {
        cpuCores: resourceLimits.cpuCores || 1,
        memoryMb: resourceLimits.memoryMb || 512,
        diskGb: resourceLimits.diskGb || 10,
      };

      return {
        serviceId,
        timestamp,
        cpu: {
          usagePercent: stats.cpu.usagePercent,
          usageCores: (stats.cpu.usagePercent / 100) * limits.cpuCores,
          limitCores: limits.cpuCores,
        },
        memory: {
          usageMb: stats.memory.usageMb,
          usagePercent: (stats.memory.usageMb / limits.memoryMb) * 100,
          limitMb: limits.memoryMb,
        },
        network: {
          bytesIn: stats.network.bytesIn,
          bytesOut: stats.network.bytesOut,
          requestsPerSecond: stats.network.requestsPerSecond,
        },
        disk: {
          readOps: stats.disk.readOps,
          writeOps: stats.disk.writeOps,
          readMb: stats.disk.readMb,
          writeMb: stats.disk.writeMb,
        },
      };
    } catch (error) {
      console.error(`Error collecting metrics for service ${serviceId}:`, error);
      return null;
    }
  }

  /**
   * Store metrics in Redis with TTL
   */
  private async storeMetrics(metrics: ServiceMetrics): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const key = `metrics:${metrics.serviceId}:${metrics.timestamp.getTime()}`;
    const value = JSON.stringify(metrics);

    await this.redisClient.setEx(key, this.METRICS_TTL, value);

    // Also update current metrics (no TTL)
    const currentKey = `metrics:${metrics.serviceId}:current`;
    await this.redisClient.set(currentKey, value);
  }

  /**
   * Get current metrics for a service
   */
  async getCurrentMetrics(
    serviceId: string,
    organizationId: string
  ): Promise<ServiceMetrics | null> {
    // Verify service belongs to organization
    const serviceResult = await query(
      'SELECT id FROM container_services WHERE id = $1 AND organization_id = $2',
      [serviceId, organizationId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found or access denied');
    }

    if (!this.redisClient) {
      return null;
    }

    const key = `metrics:${serviceId}:current`;
    const value = await this.redisClient.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  }

  /**
   * Get historical metrics for a service
   */
  async getHistoricalMetrics(
    serviceId: string,
    organizationId: string,
    timeRange: TimeRange
  ): Promise<ServiceMetrics[]> {
    // Verify service belongs to organization
    const serviceResult = await query(
      'SELECT id FROM container_services WHERE id = $1 AND organization_id = $2',
      [serviceId, organizationId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found or access denied');
    }

    if (!this.redisClient) {
      return [];
    }

    // Get all metric keys for this service within time range
    const pattern = `metrics:${serviceId}:*`;
    const keys: string[] = [];

    for await (const key of this.redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      // Skip current metrics key
      if (key.endsWith(':current')) {
        continue;
      }

      // Extract timestamp from key
      const timestamp = parseInt(key.split(':')[2]);
      if (timestamp >= timeRange.start.getTime() && timestamp <= timeRange.end.getTime()) {
        keys.push(key);
      }
    }

    // Fetch all metrics
    const metrics: ServiceMetrics[] = [];
    for (const key of keys) {
      const value = await this.redisClient.get(key);
      if (value) {
        metrics.push(JSON.parse(value));
      }
    }

    // Sort by timestamp
    metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return metrics;
  }

  /**
   * Get metrics summary with costs and alerts
   */
  async getMetricsSummary(
    serviceId: string,
    organizationId: string,
    timeRange: TimeRange
  ): Promise<MetricsSummary> {
    const current = await this.getCurrentMetrics(serviceId, organizationId);
    const history = await this.getHistoricalMetrics(serviceId, organizationId, timeRange);

    if (!current) {
      throw new Error('No current metrics available');
    }

    // Calculate costs
    const costs = this.calculateCosts(history, timeRange);

    // Generate alerts
    const alerts = this.generateAlerts(current);

    return {
      current,
      history,
      costs,
      alerts,
    };
  }

  /**
   * Calculate costs based on metrics history
   */
  private calculateCosts(
    metrics: ServiceMetrics[],
    timeRange: TimeRange
  ): MetricsSummary['costs'] {
    if (metrics.length === 0) {
      return {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 0,
        total: 0,
      };
    }

    // Calculate average usage
    const avgCpuCores = metrics.reduce((sum, m) => sum + m.cpu.usageCores, 0) / metrics.length;
    const avgMemoryGb = metrics.reduce((sum, m) => sum + m.memory.usageMb / 1024, 0) / metrics.length;
    const totalNetworkGb = metrics.reduce((sum, m) => sum + (m.network.bytesOut / (1024 * 1024 * 1024)), 0);

    // Calculate time period in hours
    const hours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);

    // Calculate costs
    const cpuCost = avgCpuCores * this.PRICING.cpuPerCore * hours;
    const memoryCost = avgMemoryGb * this.PRICING.memoryPerGb * hours;
    const storageCost = (metrics[0]?.cpu.limitCores || 1) * 10 * this.PRICING.storagePerGb * hours; // Assume 10GB per core
    const networkCost = totalNetworkGb * this.PRICING.networkPerGb;

    return {
      cpu: Math.round(cpuCost * 100) / 100,
      memory: Math.round(memoryCost * 100) / 100,
      storage: Math.round(storageCost * 100) / 100,
      network: Math.round(networkCost * 100) / 100,
      total: Math.round((cpuCost + memoryCost + storageCost + networkCost) * 100) / 100,
    };
  }

  /**
   * Generate alerts based on current metrics
   */
  private generateAlerts(metrics: ServiceMetrics): MetricsSummary['alerts'] {
    const alerts: MetricsSummary['alerts'] = [];

    // CPU alerts
    if (metrics.cpu.usagePercent >= 90) {
      alerts.push({
        type: 'critical',
        resource: 'cpu',
        message: 'CPU usage is critically high',
        threshold: 90,
        current: metrics.cpu.usagePercent,
      });
    } else if (metrics.cpu.usagePercent >= 80) {
      alerts.push({
        type: 'warning',
        resource: 'cpu',
        message: 'CPU usage is approaching limit',
        threshold: 80,
        current: metrics.cpu.usagePercent,
      });
    }

    // Memory alerts
    if (metrics.memory.usagePercent >= 90) {
      alerts.push({
        type: 'critical',
        resource: 'memory',
        message: 'Memory usage is critically high',
        threshold: 90,
        current: metrics.memory.usagePercent,
      });
    } else if (metrics.memory.usagePercent >= 80) {
      alerts.push({
        type: 'warning',
        resource: 'memory',
        message: 'Memory usage is approaching limit',
        threshold: 80,
        current: metrics.memory.usagePercent,
      });
    }

    return alerts;
  }

  /**
   * Export metrics data
   */
  async exportMetrics(
    serviceId: string,
    organizationId: string,
    timeRange: TimeRange,
    format: 'json' | 'csv'
  ): Promise<string> {
    const metrics = await this.getHistoricalMetrics(serviceId, organizationId, timeRange);

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }

    // CSV format
    const header = 'Timestamp,CPU Usage %,CPU Cores,Memory MB,Memory %,Network In (bytes),Network Out (bytes),Disk Read (MB),Disk Write (MB)\n';
    const rows = metrics.map(m => {
      return [
        m.timestamp.toISOString(),
        m.cpu.usagePercent.toFixed(2),
        m.cpu.usageCores.toFixed(2),
        m.memory.usageMb.toFixed(2),
        m.memory.usagePercent.toFixed(2),
        m.network.bytesIn,
        m.network.bytesOut,
        m.disk.readMb.toFixed(2),
        m.disk.writeMb.toFixed(2),
      ].join(',');
    });

    return header + rows.join('\n');
  }

  /**
   * Stop metrics collection and cleanup
   */
  async stop(): Promise<void> {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }

    console.log('Metrics collection service stopped');
  }
}

// Singleton instance
export const metricsCollectionService = new MetricsCollectionService();

// Graceful shutdown
process.on('SIGINT', async () => {
  await metricsCollectionService.stop();
});

process.on('SIGTERM', async () => {
  await metricsCollectionService.stop();
});
