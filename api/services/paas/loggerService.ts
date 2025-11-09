/**
 * PaaS Logger Service
 * Handles log streaming to Grafana Loki and log retrieval
 */

import { pool, PaasApplication } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface LogQuery {
  applicationId: string;
  deploymentId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  search?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
}

export interface LogLine {
  timestamp: string;
  message: string;
  level?: string;
  source: string;
}

export class LoggerService {
  /**
   * Stream logs from an application to Loki
   */
  static async streamLogsToLoki(applicationId: string): Promise<void> {
    const app = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [applicationId]
    );

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const serviceName = `paas-${app.rows[0].slug}`;
    const lokiConfig = await PaasSettingsService.getLokiConfig();

    if (!lokiConfig.endpoint) {
      console.warn('Loki endpoint not configured, skipping log streaming');
      return;
    }

    // Use Promtail or docker logs with Loki driver
    // This is typically configured at the Docker daemon level
    // For now, we'll document this in the setup
  }

  /**
   * Query logs from Loki
   */
  static async queryLogs(options: LogQuery): Promise<LogLine[]> {
    const app = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [options.applicationId]
    );

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const lokiConfig = await PaasSettingsService.getLokiConfig();

    if (!lokiConfig.endpoint) {
      // Fallback to Docker logs if Loki not configured
      return await this.getDockerLogs(app.rows[0].slug, options);
    }

    try {
      // Build LogQL query
      const logQL = this.buildLogQLQuery(app.rows[0].slug, options);
      const since = options.since || new Date(Date.now() - 3600000); // Default: 1 hour ago
      const until = options.until || new Date();

      // Query Loki
      const response = await axios.get(`${lokiConfig.endpoint}/loki/api/v1/query_range`, {
        params: {
          query: logQL,
          start: since.getTime() * 1000000, // Nanoseconds
          end: until.getTime() * 1000000,
          limit: options.limit || 1000,
          direction: 'backward',
        },
      });

      // Parse Loki response
      const logs: LogLine[] = [];

      if (response.data.data && response.data.data.result) {
        for (const stream of response.data.data.result) {
          for (const entry of stream.values) {
            logs.push({
              timestamp: new Date(parseInt(entry[0]) / 1000000).toISOString(),
              message: entry[1],
              source: 'loki',
            });
          }
        }
      }

      return logs;
    } catch (error: any) {
      console.error('Failed to query Loki:', error.message);
      // Fallback to Docker logs
      return await this.getDockerLogs(app.rows[0].slug, options);
    }
  }

  /**
   * Build LogQL query for Loki
   */
  private static buildLogQLQuery(appSlug: string, options: LogQuery): string {
    let query = `{app="${appSlug}"}`;

    // Add deployment filter if specified
    if (options.deploymentId) {
      query = `{app="${appSlug}", deployment_id="${options.deploymentId}"}`;
    }

    // Add search filter
    if (options.search) {
      query += ` |~ "${options.search}"`;
    }

    // Add level filter
    if (options.level) {
      query += ` | level="${options.level}"`;
    }

    return query;
  }

  /**
   * Get logs directly from Docker (fallback when Loki unavailable)
   */
  private static async getDockerLogs(appSlug: string, options: LogQuery): Promise<LogLine[]> {
    try {
      const serviceName = `paas-${appSlug}`;
      const limit = options.limit || 1000;
      const since = options.since ? `--since ${Math.floor((Date.now() - options.since.getTime()) / 1000)}s` : '--since 1h';

      const command = `docker service logs ${serviceName} ${since} --tail ${limit} --timestamps`;

      const { stdout } = await execAsync(command);

      const logs: LogLine[] = [];
      const lines = stdout.split('\n').filter(Boolean);

      for (const line of lines) {
        // Parse Docker log format: timestamp container_id message
        const match = line.match(/^(\S+\s+\S+)\s+\S+\s+(.*)$/);
        if (match) {
          const [, timestamp, message] = match;

          // Apply search filter
          if (options.search && !message.toLowerCase().includes(options.search.toLowerCase())) {
            continue;
          }

          logs.push({
            timestamp,
            message,
            source: 'docker',
          });
        }
      }

      return logs;
    } catch (error: any) {
      console.error('Failed to get Docker logs:', error.message);
      return [];
    }
  }

  /**
   * Stream logs in real-time (for SSE endpoint)
   */
  static async* streamLogs(applicationId: string): AsyncGenerator<LogLine> {
    const app = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [applicationId]
    );

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const serviceName = `paas-${app.rows[0].slug}`;

    // Use docker service logs --follow
    const { spawn } = await import('child_process');
    const proc = spawn('docker', ['service', 'logs', serviceName, '--follow', '--timestamps']);

    for await (const chunk of proc.stdout) {
      const lines = chunk.toString().split('\n').filter(Boolean);

      for (const line of lines) {
        const match = line.match(/^(\S+\s+\S+)\s+\S+\s+(.*)$/);
        if (match) {
          const [, timestamp, message] = match;
          yield {
            timestamp,
            message,
            source: 'docker',
          };
        }
      }
    }
  }

  /**
   * Get build logs for a deployment
   */
  static async getBuildLogs(deploymentId: string): Promise<string> {
    const result = await pool.query(
      'SELECT build_log FROM paas_deployments WHERE id = $1',
      [deploymentId]
    );

    return result.rows[0]?.build_log || '';
  }

  /**
   * Get container logs for debugging
   */
  static async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs ${containerId} --tail ${tail} --timestamps`);
      return stdout;
    } catch (error: any) {
      throw new Error(`Failed to get container logs: ${error.message}`);
    }
  }
}
