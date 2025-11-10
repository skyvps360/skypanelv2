import { promisify } from 'util';
import { exec } from 'child_process';
import { pool, PaasApplication } from '../../lib/database.js';

const execAsync = promisify(exec);

export interface HealthCheckConfig {
  enabled: boolean;
  path: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  retries: number;
  protocol: 'http' | 'https';
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  enabled: true,
  path: '/health',
  intervalSeconds: 30,
  timeoutSeconds: 10,
  retries: 3,
  protocol: 'http',
};

export class HealthCheckService {
  static getConfig(app: Partial<PaasApplication>): HealthCheckConfig {
    return {
      enabled: app.health_check_enabled ?? DEFAULT_CONFIG.enabled,
      path: app.health_check_path || DEFAULT_CONFIG.path,
      intervalSeconds: app.health_check_interval_seconds ?? DEFAULT_CONFIG.intervalSeconds,
      timeoutSeconds: app.health_check_timeout_seconds ?? DEFAULT_CONFIG.timeoutSeconds,
      retries: app.health_check_retries ?? DEFAULT_CONFIG.retries,
      protocol: (app.health_check_protocol as 'http' | 'https') || DEFAULT_CONFIG.protocol,
    };
  }

  static buildDockerArgs(config: HealthCheckConfig): string[] {
    if (!config.enabled) {
      return ['--no-healthcheck'];
    }

    const port = 5000;
    const cmd =
      config.protocol === 'https'
        ? `curl -f https://localhost:${port}${config.path} || exit 1`
        : `curl -f http://localhost:${port}${config.path} || exit 1`;

    return [
      `--health-cmd "${cmd}"`,
      `--health-interval ${config.intervalSeconds}s`,
      `--health-timeout ${config.timeoutSeconds}s`,
      `--health-retries ${config.retries}`,
    ];
  }

  static async configureHealthCheck(serviceName: string, config: HealthCheckConfig): Promise<void> {
    if (!config.enabled) {
      await execAsync(`docker service update --no-healthcheck ${serviceName}`);
      return;
    }

    const args = this.buildDockerArgs(config).join(' ');
    await execAsync(`docker service update ${args} ${serviceName}`);
  }

  static async monitorHealthChecks(): Promise<void> {
    const apps = await pool.query<Pick<PaasApplication, 'id' | 'slug' | 'health_check_enabled'>>(
      `SELECT id, slug, health_check_enabled
         FROM paas_applications
        WHERE health_check_enabled = true
          AND status IN ('running', 'deploying', 'building')`
    );

    for (const app of apps.rows) {
      const serviceName = `paas-${app.slug}`;
      let state = 'unknown';

      try {
        const { stdout } = await execAsync(
          `docker service ps ${serviceName} --format "{{.CurrentState}}" --no-trunc | head -1`
        );
        state = stdout.trim() || 'unknown';
      } catch (error) {
        state = 'unreachable';
      }

      await pool.query(
        `UPDATE paas_applications
            SET last_health_status = $1,
                last_health_check_at = NOW()
          WHERE id = $2`,
        [state, app.id]
      );
    }
  }
}
