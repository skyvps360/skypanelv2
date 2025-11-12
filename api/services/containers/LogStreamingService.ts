import { EventEmitter } from 'events';
import { SwarmOrchestrator } from './SwarmOrchestrator.js';
import { query } from '../../lib/database.js';

export interface LogEntry {
  timestamp: Date;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  containerId?: string;
  serviceId: string;
  metadata?: Record<string, any>;
}

export interface LogFilter {
  level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
  containerId?: string;
}

export interface LogStreamOptions {
  tail?: number;
  follow?: boolean;
  since?: Date;
  until?: Date;
  timestamps?: boolean;
}

/**
 * Service for streaming and managing container logs
 */
export class LogStreamingService extends EventEmitter {
  private activeStreams: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Stream logs from a container service in real-time
   */
  async streamLogs(
    serviceId: string,
    organizationId: string,
    options: LogStreamOptions = {}
  ): Promise<AsyncGenerator<LogEntry>> {
    // Verify service belongs to organization
    const serviceResult = await query(
      'SELECT id, slug, current_deployment_id FROM container_services WHERE id = $1 AND organization_id = $2',
      [serviceId, organizationId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found or access denied');
    }

    const service = serviceResult.rows[0];

    if (!service.current_deployment_id) {
      throw new Error('Service has no active deployment');
    }

    // Get deployment details
    const deploymentResult = await query(
      'SELECT swarm_service_id, container_id FROM container_deployments WHERE id = $1',
      [service.current_deployment_id]
    );

    if (deploymentResult.rows.length === 0) {
      throw new Error('Deployment not found');
    }

    const deployment = deploymentResult.rows[0];
    const swarmServiceId = deployment.swarm_service_id;

    if (!swarmServiceId) {
      throw new Error('Service not deployed to Swarm');
    }

    // Stream logs from Docker Swarm
    return this.streamSwarmLogs(swarmServiceId, serviceId, options);
  }

  /**
   * Stream logs from Docker Swarm service
   */
  private async *streamSwarmLogs(
    swarmServiceId: string,
    serviceId: string,
    options: LogStreamOptions
  ): AsyncGenerator<LogEntry> {
    const logStream = await SwarmOrchestrator.getServiceLogs(swarmServiceId, {
      follow: options.follow ?? true,
      tail: options.tail ?? 100,
      since: options.since,
      until: options.until,
      timestamps: options.timestamps ?? true,
    });

    for await (const logLine of logStream) {
      const entry = this.parseLogLine(logLine, serviceId);
      if (entry) {
        yield entry;
      }
    }
  }

  /**
   * Get historical logs with filtering
   */
  async getLogs(
    serviceId: string,
    organizationId: string,
    filter: LogFilter = {},
    limit: number = 1000
  ): Promise<LogEntry[]> {
    // Verify service belongs to organization
    const serviceResult = await query(
      'SELECT id, slug, current_deployment_id FROM container_services WHERE id = $1 AND organization_id = $2',
      [serviceId, organizationId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found or access denied');
    }

    const service = serviceResult.rows[0];

    if (!service.current_deployment_id) {
      return [];
    }

    // Get deployment details
    const deploymentResult = await query(
      'SELECT swarm_service_id, deployment_logs FROM container_deployments WHERE id = $1',
      [service.current_deployment_id]
    );

    if (deploymentResult.rows.length === 0) {
      return [];
    }

    const deployment = deploymentResult.rows[0];
    const swarmServiceId = deployment.swarm_service_id;

    if (!swarmServiceId) {
      // Return stored logs if service not in Swarm
      return this.parseStoredLogs(deployment.deployment_logs || '', serviceId);
    }

    // Get logs from Docker Swarm
    const logStream = await SwarmOrchestrator.getServiceLogs(swarmServiceId, {
      follow: false,
      tail: limit,
      since: filter.startTime,
      until: filter.endTime,
      timestamps: true,
    });

    const logs: LogEntry[] = [];
    for await (const logLine of logStream) {
      const entry = this.parseLogLine(logLine, serviceId);
      if (entry && this.matchesFilter(entry, filter)) {
        logs.push(entry);
      }
    }

    return logs;
  }

  /**
   * Download logs in specified format
   */
  async downloadLogs(
    serviceId: string,
    organizationId: string,
    format: 'json' | 'text' | 'csv',
    filter: LogFilter = {}
  ): Promise<string> {
    const logs = await this.getLogs(serviceId, organizationId, filter, 10000);

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      
      case 'csv':
        return this.logsToCSV(logs);
      
      case 'text':
      default:
        return this.logsToText(logs);
    }
  }

  /**
   * Parse a log line into a structured LogEntry
   */
  private parseLogLine(logLine: string, serviceId: string): LogEntry | null {
    if (!logLine || logLine.trim() === '') {
      return null;
    }

    // Try to parse timestamp if present
    const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
    let timestamp = new Date();
    let message = logLine;

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1]);
      message = timestampMatch[2];
    }

    // Try to detect log level
    let level: LogEntry['level'] = 'INFO';
    const levelMatch = message.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG)\b/i);
    if (levelMatch) {
      const detectedLevel = levelMatch[1].toUpperCase();
      if (detectedLevel === 'WARNING') {
        level = 'WARN';
      } else if (['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(detectedLevel)) {
        level = detectedLevel as LogEntry['level'];
      }
    }

    return {
      timestamp,
      level,
      message: message.trim(),
      serviceId,
    };
  }

  /**
   * Parse stored logs from database
   */
  private parseStoredLogs(logsText: string, serviceId: string): LogEntry[] {
    if (!logsText) {
      return [];
    }

    const lines = logsText.split('\n');
    const entries: LogEntry[] = [];

    for (const line of lines) {
      const entry = this.parseLogLine(line, serviceId);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Check if log entry matches filter criteria
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.level && entry.level !== filter.level) {
      return false;
    }

    if (filter.startTime && entry.timestamp < filter.startTime) {
      return false;
    }

    if (filter.endTime && entry.timestamp > filter.endTime) {
      return false;
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      if (!entry.message.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    if (filter.containerId && entry.containerId !== filter.containerId) {
      return false;
    }

    return true;
  }

  /**
   * Convert logs to CSV format
   */
  private logsToCSV(logs: LogEntry[]): string {
    const header = 'Timestamp,Level,Message,Container ID\n';
    const rows = logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const message = `"${log.message.replace(/"/g, '""')}"`;
      const containerId = log.containerId || '';
      return `${timestamp},${log.level},${message},${containerId}`;
    });

    return header + rows.join('\n');
  }

  /**
   * Convert logs to plain text format
   */
  private logsToText(logs: LogEntry[]): string {
    return logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const container = log.containerId ? ` [${log.containerId}]` : '';
      return `${timestamp} ${log.level}${container}: ${log.message}`;
    }).join('\n');
  }

  /**
   * Clean up active streams
   */
  cleanup(): void {
    for (const [streamId, timeout] of this.activeStreams) {
      clearTimeout(timeout);
    }
    this.activeStreams.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const logStreamingService = new LogStreamingService();
