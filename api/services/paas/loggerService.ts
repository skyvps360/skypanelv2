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

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    }
  });

export class LoggerService {
  /**
   * Query logs from Loki (or Docker fallback)
   */
  static async queryLogs(options: LogQuery): Promise<LogLine[]> {
    const app = await pool.query<PaasApplication>('SELECT * FROM paas_applications WHERE id = $1', [options.applicationId]);

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const lokiConfig = await PaasSettingsService.getLokiConfig();

    if (!lokiConfig.endpoint) {
      return await this.getDockerLogs(app.rows[0].slug, options);
    }

    try {
      const logQL = this.buildLogQLQuery(app.rows[0].slug, options);
      const since = options.since || new Date(Date.now() - 3600000);
      const until = options.until || new Date();

      const response = await axios.get(`${lokiConfig.endpoint}/loki/api/v1/query_range`, {
        params: {
          query: logQL,
          start: since.getTime() * 1_000_000,
          end: until.getTime() * 1_000_000,
          limit: options.limit || 1000,
          direction: 'backward',
        },
      });

      const logs: LogLine[] = [];
      const results = response.data?.data?.result || [];

      for (const stream of results) {
        for (const entry of stream.values) {
          const timestamp = new Date(parseInt(entry[0], 10) / 1_000_000).toISOString();
          const message = entry[1];

          if (!this.matchesFilters(message, options)) {
            continue;
          }

          logs.push({
            timestamp,
            message,
            source: 'loki',
          });
        }
      }

      return logs;
    } catch (error: any) {
      console.error('Failed to query Loki:', error?.message || error);
      return await this.getDockerLogs(app.rows[0].slug, options);
    }
  }

  /**
   * Build LogQL query for Loki
   */
  private static buildLogQLQuery(appSlug: string, options: LogQuery): string {
    let query = `{app="${appSlug}"}`;

    if (options.deploymentId) {
      query = `{app="${appSlug}", deployment_id="${options.deploymentId}"}`;
    }

    if (options.search) {
      query += ` |~ "${options.search}"`;
    }

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
      const sinceArg = options.since ? `--since ${Math.floor((Date.now() - options.since.getTime()) / 1000)}s` : '--since 1h';
      const command = `docker service logs ${serviceName} ${sinceArg} --tail ${limit} --timestamps`;

      const { stdout } = await execAsync(command);
      const logs: LogLine[] = [];

      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        const match = line.match(/^(\S+\s+\S+)\s+\S+\s+(.*)$/);
        if (!match) continue;

        const [, timestamp, message] = match;
        if (!this.matchesFilters(message, options)) {
          continue;
        }

        logs.push({
          timestamp,
          message,
          source: 'docker',
        });
      }

      return logs;
    } catch (error: any) {
      console.error('Failed to get Docker logs:', error?.message || error);
      return [];
    }
  }

  /**
   * Stream logs in real-time (for SSE endpoint)
   */
  static async *streamLogs(applicationId: string, options: Partial<LogQuery> = {}, signal?: AbortSignal): AsyncGenerator<LogLine> {
    const app = await pool.query<PaasApplication>('SELECT * FROM paas_applications WHERE id = $1', [applicationId]);

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const lokiConfig = await PaasSettingsService.getLokiConfig();
    const streamOptions: LogQuery = {
      applicationId,
      ...options,
    };

    if (lokiConfig.endpoint) {
      yield* this.streamLokiLogs(app.rows[0].slug, streamOptions, lokiConfig.endpoint, signal);
      return;
    }

    yield* this.streamDockerLogs(app.rows[0].slug, streamOptions, signal);
  }

  private static async *streamDockerLogs(appSlug: string, options: LogQuery, signal?: AbortSignal): AsyncGenerator<LogLine> {
    const { spawn } = await import('child_process');
    const serviceName = `paas-${appSlug}`;
    const proc = spawn('docker', ['service', 'logs', serviceName, '--follow', '--timestamps']);

    const stop = () => {
      if (!proc.killed) {
        proc.kill();
      }
    };

    signal?.addEventListener('abort', stop, { once: true });

    try {
      for await (const chunk of proc.stdout) {
        if (signal?.aborted) {
          break;
        }

        const lines = chunk.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          const match = line.match(/^(\S+\s+\S+)\s+\S+\s+(.*)$/);
          if (match) {
            const [, timestamp, message] = match;
            if (!this.matchesFilters(message, options)) {
              continue;
            }
            yield {
              timestamp,
              message,
              source: 'docker',
            };
          }
        }
      }
    } finally {
      stop();
    }
  }

  private static async *streamLokiLogs(appSlug: string, options: LogQuery, endpoint: string, signal?: AbortSignal): AsyncGenerator<LogLine> {
    let cursor = Date.now() - 60 * 1000;

    while (!signal?.aborted) {
      const rangeEnd = Date.now();
      try {
        const logQL = this.buildLogQLQuery(appSlug, options);
        const response = await axios.get(`${endpoint}/loki/api/v1/query_range`, {
          params: {
            query: logQL,
            start: cursor * 1_000_000,
            end: rangeEnd * 1_000_000,
            limit: 500,
            direction: 'forward',
          },
        });

        const results = response.data?.data?.result || [];
        let lastTimestamp = cursor;

        for (const stream of results) {
          for (const entry of stream.values) {
            const ts = parseInt(entry[0], 10) / 1_000_000;
            lastTimestamp = Math.max(lastTimestamp, ts + 1);
            const message = entry[1];
            if (!this.matchesFilters(message, options)) {
              continue;
            }
            yield {
              timestamp: new Date(ts).toISOString(),
              message,
              source: 'loki',
            };
          }
        }

        cursor = Math.max(lastTimestamp, rangeEnd - 5_000);
      } catch (error: any) {
        console.error('[Logs] Loki stream error:', error?.message || error);
        cursor = rangeEnd;
      }

      await sleep(2000, signal);
    }
  }

  private static matchesFilters(message: string, options: LogQuery): boolean {
    if (options.search && !message.toLowerCase().includes(options.search.toLowerCase())) {
      return false;
    }

    if (!options.level) {
      return true;
    }

    const normalized = message.toLowerCase();
    switch (options.level) {
      case 'error':
        return normalized.includes('error');
      case 'warn':
        return normalized.includes('warn');
      case 'debug':
        return normalized.includes('debug') || normalized.includes('trace');
      case 'info':
        return !normalized.includes('error') && !normalized.includes('warn');
      default:
        return true;
    }
  }

  /**
   * Get build logs for a deployment
   */
  static async getBuildLogs(deploymentId: string): Promise<string> {
    const result = await pool.query('SELECT build_log FROM paas_deployments WHERE id = $1', [deploymentId]);
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

  /**
   * Enforce log retention by pruning metadata rows
   */
  static async enforceRetention(): Promise<void> {
    const lokiConfig = await PaasSettingsService.getLokiConfig();
    const retentionDays = lokiConfig.retentionDays || 7;

    await pool.query(
      `DELETE FROM paas_logs_metadata
        WHERE started_at < NOW() - $1::interval`,
      [`${retentionDays} days`]
    );
  }
}
