/**
 * PaaS Deployer Service
 * Handles deployment of built applications to Docker Swarm
 */

import { pool, PaasApplication, PaasDeployment } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import crypto from 'crypto';
import { HealthCheckService } from './healthCheckService.js';
import { PaasEnvironmentService } from './environmentService.js';
import { logActivity } from '../activityLogger.js';
import { NodeManagerService } from './nodeManagerService.js';

const execAsync = promisify(exec);
const SLUG_CACHE_DIR = process.env.PAAS_SLUG_CACHE_DIR || path.join(os.tmpdir(), 'paas-slug-cache');
const DOCKER_CMD_TIMEOUT_MS = Number(process.env.PAAS_DOCKER_CMD_TIMEOUT || 120_000);

export interface DeployOptions {
  deploymentId: string;
  replicas?: number;
  cachedSlugPath?: string;
  startedAt?: number;
}

export interface DeployResult {
  success: boolean;
  serviceId?: string;
  error?: string;
}

export class DeployerService {
  /**
   * Deploy an application to Docker Swarm
   */
  static async deploy(options: DeployOptions): Promise<DeployResult> {
    try {
      const startTime = options.startedAt ?? Date.now();
      // Get deployment
      const deploymentResult = await pool.query<PaasDeployment>(
        'SELECT * FROM paas_deployments WHERE id = $1',
        [options.deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Get application
      const appResult = await pool.query<PaasApplication>(
        'SELECT * FROM paas_applications WHERE id = $1',
        [deployment.application_id]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }

      const app = appResult.rows[0];

      // Get plan details
      const planResult = await pool.query(
        'SELECT * FROM paas_plans WHERE id = $1',
        [app.plan_id]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }

      const plan = planResult.rows[0];

      // Update deployment status
      await pool.query(
        'UPDATE paas_deployments SET status = $1 WHERE id = $2',
        ['deploying', options.deploymentId]
      );

      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['deploying', app.id]
      );

      // Extract slug to runtime location
      const runtimeDir = await this.extractSlug(
        deployment.slug_url!,
        deployment.id,
        options.cachedSlugPath
      );

      // Build Docker image from slug
      const imageName = await this.buildDockerImage(runtimeDir, app, deployment);

      // Get environment variables
      const envVars = await this.getEnvironmentVariables(app.id);

      // Deploy to Swarm
      const serviceId = await this.deployToSwarm({
        app,
        deployment,
        plan,
        imageName,
        envVars,
        replicas: options.replicas || app.replicas,
      });

      // Update deployment status
      await pool.query(
        `UPDATE paas_deployments SET
          status = $1,
          deployed_at = NOW()
        WHERE id = $2`,
        ['deployed', options.deploymentId]
      );

      if (deployment.rolled_back_from) {
        const durationMs = Date.now() - startTime;
        console.log(
          `[Rollback] Deployment ${deployment.id} redeployed in ${(durationMs / 1000).toFixed(2)}s`
        );
        await logActivity({
          userId: deployment.created_by || undefined,
          organizationId: app.organization_id,
          eventType: 'paas.app.rollback.complete',
          entityType: 'paas_app',
          entityId: deployment.application_id,
          status: 'success',
          metadata: {
            duration_ms: durationMs,
            replicas: options.replicas || app.replicas,
          },
          message: `Rollback completed in ${(durationMs / 1000).toFixed(2)}s`,
        });
      }

      await pool.query(
        'UPDATE paas_applications SET status = $1, replicas = $2 WHERE id = $3',
        ['running', options.replicas || app.replicas, app.id]
      );

      return {
        success: true,
        serviceId,
      };
    } catch (error: any) {
      // Update deployment with failure
      await pool.query(
        `UPDATE paas_deployments SET
          status = $1,
          error_message = $2
        WHERE id = $3`,
        ['failed', error.message, options.deploymentId]
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract slug to runtime directory
   */
  private static async extractSlug(
    slugUrl: string,
    deploymentId: string,
    cachedPath?: string
  ): Promise<string> {
    if (!slugUrl) {
      throw new Error('Deployment artifact missing slug URL');
    }

    const { localPath, cleanup } = cachedPath
      ? { localPath: cachedPath, cleanup: false }
      : await this.ensureLocalSlug(slugUrl);
    const runtimeDir = `/var/paas/runtime/${deploymentId}`;
    await fs.mkdir(runtimeDir, { recursive: true });

    await tar.x({
      file: localPath,
      cwd: runtimeDir,
      gzip: true,
    });

    if (cleanup) {
      await fs.rm(localPath, { force: true }).catch(() => {});
    }

    return runtimeDir;
  }

  private static async ensureLocalSlug(
    slugUrl: string
  ): Promise<{ localPath: string; cleanup: boolean }> {
    const isRemote = /^https?:\/\//i.test(slugUrl);

    if (!isRemote) {
      return { localPath: slugUrl, cleanup: false };
    }

    await fs.mkdir(SLUG_CACHE_DIR, { recursive: true });
    const cacheKey = crypto.createHash('sha1').update(slugUrl).digest('hex');
    const cachePath = path.join(SLUG_CACHE_DIR, `${cacheKey}.tgz`);

    if (await this.pathExists(cachePath)) {
      return { localPath: cachePath, cleanup: false };
    }

    const tempPath = path.join(SLUG_CACHE_DIR, `${cacheKey}-${Date.now()}.tmp`);
    const response = await axios.get(slugUrl, { responseType: 'stream' });
    await pipeline(response.data, createWriteStream(tempPath));
    await fs.rename(tempPath, cachePath).catch(async () => {
      if (!(await this.pathExists(cachePath))) {
        throw new Error('Failed to cache slug artifact');
      }
    });

    return { localPath: cachePath, cleanup: false };
  }

  private static async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async prefetchSlug(slugUrl: string): Promise<string> {
    const { localPath } = await this.ensureLocalSlug(slugUrl);
    return localPath;
  }

  /**
   * Build Docker image from extracted slug
   */
  private static async buildDockerImage(
    runtimeDir: string,
    app: PaasApplication,
    deployment: PaasDeployment
  ): Promise<string> {
    // Create Dockerfile for slug
    const dockerfile = `
FROM heroku/heroku:22

WORKDIR /app
COPY . /app

# Set default environment variables
ENV PORT=5000
ENV HOME=/app

# Use Heroku's process manager
CMD ["/start", "web"]
`;

    await fs.writeFile(path.join(runtimeDir, 'Dockerfile'), dockerfile);

    // Build image
    const imageName = `paas/${app.slug}:${deployment.version}`;
    await this.execDocker(`docker build -t ${imageName} ${runtimeDir}`);

    const remoteImage = await this.pushImageToRegistry(imageName, app, deployment);
    const finalImageName = remoteImage || imageName;
    await NodeManagerService.preloadImage(finalImageName);
    return finalImageName;
  }

  private static async pushImageToRegistry(
    imageName: string,
    app: PaasApplication,
    deployment: PaasDeployment
  ): Promise<string | null> {
    const registry = await PaasSettingsService.getRegistryConfig();
    if (!registry?.url) {
      return null;
    }

    const remoteName = `${registry.url}/paas/${app.slug}:${deployment.version}`;
    try {
      if (registry.username && registry.password) {
        await this.execDocker(
          `docker login ${registry.url} -u ${registry.username} -p ${registry.password}`
        );
      }
      await this.execDocker(`docker tag ${imageName} ${remoteName}`);
      await this.execDocker(`docker push ${remoteName}`);
      console.log(`[Deploy] Pushed image ${remoteName} to registry ${registry.url}`);
      return remoteName;
    } catch (error: any) {
      console.warn(
        `[Deploy] Failed to push image ${imageName} to registry ${registry.url}:`,
        error?.message || error
      );
      return null;
    }
  }

  /**
   * Get application environment variables
   */
  private static async getEnvironmentVariables(appId: string): Promise<Record<string, string>> {
    return PaasEnvironmentService.getRuntimeEnv(appId);
  }

  /**
   * Deploy service to Docker Swarm
   */
  private static async deployToSwarm(options: {
    app: PaasApplication;
    deployment: PaasDeployment;
    plan: any;
    imageName: string;
    envVars: Record<string, string>;
    replicas: number;
  }): Promise<string> {
    const { app, deployment, plan, imageName, envVars, replicas } = options;

    // Service name
    const serviceName = `paas-${app.slug}`;

    const envArgs = Object.entries(envVars).map(([key, value]) => `--env ${key}="${value.replace(/"/g, '\\"')}"`);
    const systemEnvArgs = ['--env PORT=5000', '--env DYNO=web.1', '--env PS=web'];

    // Get default domain
    const defaultDomain = await PaasSettingsService.get('default_domain') as string || 'apps.example.com';
    const appUrl = `${app.subdomain}.${defaultDomain}`;

    // Resource limits
    const cpuLimit = plan.cpu_cores;
    const ramLimit = plan.ram_mb;

    // Network isolation - create unique overlay network for this app
    const networkName = `paas-net-${app.id}`;
    await this.createOverlayNetwork(networkName);

    // Check if service exists
    const serviceExists = await this.checkServiceExists(serviceName);

    const healthConfig = HealthCheckService.getConfig(app);
    const healthArgs = HealthCheckService.buildDockerArgs(healthConfig);

    if (serviceExists) {
      await this.execDocker(`docker service update --placement-pref-rm "spread=node.id" ${serviceName}`).catch(() => {});
      // Update existing service
      const updateArgs = [
        'docker service update',
        `--image ${imageName}`,
        `--replicas ${replicas}`,
        `--limit-cpu ${cpuLimit}`,
        `--limit-memory ${ramLimit}m`,
        '--placement-pref-add "spread=node.id"',
        '--update-failure-action rollback',
        '--update-monitor 10s',
        '--update-max-failure-ratio 0.2',
        ...envArgs,
        ...systemEnvArgs,
        `--label "traefik.enable=true"`,
        `--label "traefik.http.routers.${app.slug}.rule=Host(\`${appUrl}\`)"`,
        `--label "traefik.http.services.${app.slug}.loadbalancer.server.port=5000"`,
        `--update-parallelism ${Math.max(1, Math.min(replicas || 1, 2))}`,
        '--update-order start-first',
        ...healthArgs,
        serviceName,
      ];

      await this.execDocker(updateArgs.join(' '));
    } else {
      const createUpdateParallelism = Math.max(1, Math.min(replicas || 1, 2));
      const createArgs = [
        'docker service create',
        `--name ${serviceName}`,
        `--replicas ${replicas}`,
        `--limit-cpu ${cpuLimit}`,
        `--limit-memory ${ramLimit}m`,
        `--reserve-cpu ${Math.max(cpuLimit * 0.5, 0.1)}`,
        `--reserve-memory ${Math.max(ramLimit * 0.5, 128)}m`,
        `--network ${networkName}`,
        '--network paas-public',
        '--placement-pref "spread=node.id"',
        ...envArgs,
        ...systemEnvArgs,
        `--label "traefik.enable=true"`,
        `--label "traefik.http.routers.${app.slug}.rule=Host(\`${appUrl}\`)"`,
        `--label "traefik.http.services.${app.slug}.loadbalancer.server.port=5000"`,
        `--label "paas.app.id=${app.id}"`,
        `--label "paas.app.name=${app.name}"`,
        `--label "paas.deployment.id=${deployment.id}"`,
        '--restart-condition on-failure',
        '--restart-max-attempts 3',
        `--update-parallelism ${createUpdateParallelism}`,
        '--update-delay 10s',
        '--update-failure-action rollback',
        '--update-monitor 10s',
        '--update-max-failure-ratio 0.2',
        '--update-order start-first',
        ...healthArgs,
        imageName,
      ];

      await this.execDocker(createArgs.join(' '));
    }

    // Get service ID
    const { stdout } = await this.execDocker(`docker service ps ${serviceName} --format "{{.ID}}" | head -1`);
    return stdout.trim();
  }

  /**
   * Create overlay network for application isolation
   */
  private static async createOverlayNetwork(networkName: string): Promise<void> {
    try {
      await this.execDocker(`docker network inspect ${networkName}`);
      // Network exists
    } catch (error) {
      // Network doesn't exist, create it
      await this.execDocker(`docker network create --driver overlay --attachable ${networkName}`);
    }
  }

  /**
   * Check if a Swarm service exists
   */
  private static async checkServiceExists(serviceName: string): Promise<boolean> {
    try {
      await this.execDocker(`docker service inspect ${serviceName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop (scale to 0) an application
   */
  static async stop(appId: string): Promise<void> {
    const app = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const serviceName = `paas-${app.rows[0].slug}`;

    try {
      const previousReplicas = app.rows[0].replicas || 0;
      await this.execDocker(`docker service scale ${serviceName}=0`);
      await pool.query(
        `UPDATE paas_applications
         SET status = $1,
             replicas = 0,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{last_running_replicas}',
               to_jsonb($3::int),
               true
             )
         WHERE id = $2`,
        ['stopped', appId, previousReplicas]
      );
    } catch (error) {
      throw new Error(`Failed to stop application: ${error}`);
    }
  }

  /**
   * Delete an application's Swarm service
   */
  static async delete(appId: string): Promise<void> {
    const app = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (app.rows.length === 0) {
      throw new Error('Application not found');
    }

    const serviceName = `paas-${app.rows[0].slug}`;
    const networkName = `paas-net-${appId}`;

    try {
      // Remove service
      await this.execDocker(`docker service rm ${serviceName}`).catch(() => {});

      // Remove network
      await this.execDocker(`docker network rm ${networkName}`).catch(() => {});

      // Update database
      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['inactive', appId]
      );
    } catch (error) {
      throw new Error(`Failed to delete application: ${error}`);
    }
  }

  /**
   * Prepare rollback by cloning an existing deployment record and scheduling redeploy
   */
  static async rollback(
    appId: string,
    targetVersion: number,
    userId?: string
  ): Promise<{
    app: PaasApplication;
    targetDeployment: PaasDeployment;
    newDeployment: PaasDeployment;
  }> {
    const appResult = await pool.query<PaasApplication>('SELECT * FROM paas_applications WHERE id = $1', [appId]);

    if (appResult.rows.length === 0) {
      throw new Error('Application not found');
    }

    const app = appResult.rows[0];

    const deploymentResult = await pool.query<PaasDeployment>(
      `SELECT * FROM paas_deployments
       WHERE application_id = $1 AND version = $2 AND status IN ('deployed', 'failed', 'rolled_back')`,
      [appId, targetVersion]
    );

    if (deploymentResult.rows.length === 0) {
      throw new Error('Target deployment not found');
    }

    const targetDeployment = deploymentResult.rows[0];

    if (!targetDeployment.slug_url) {
      throw new Error('Target deployment is missing slug artifact and cannot be rolled back to');
    }

    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM paas_deployments WHERE application_id = $1',
      [appId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    const newDeploymentResult = await pool.query<PaasDeployment>(
      `INSERT INTO paas_deployments (
        application_id,
        version,
        git_commit,
        slug_url,
        slug_size_bytes,
        buildpack_used,
        status,
        created_by,
        build_started_at,
        build_completed_at,
        rolled_back_from
      ) VALUES ($1, $2, $3, $4, $5, $6, 'deploying', $7, NOW(), NOW(), $8)
      RETURNING *`,
      [
        appId,
        nextVersion,
        targetDeployment.git_commit,
        targetDeployment.slug_url,
        targetDeployment.slug_size_bytes,
        targetDeployment.buildpack_used,
        userId || null,
        targetDeployment.id,
      ]
    );

    await pool.query('UPDATE paas_applications SET status = $1 WHERE id = $2', ['deploying', appId]);
    await pool.query('UPDATE paas_deployments SET status = $1 WHERE id = $2', ['rolled_back', targetDeployment.id]);

    return {
      app,
      targetDeployment,
      newDeployment: newDeploymentResult.rows[0],
    };
  }

  /**
   * Restart an application by scaling or redeploying the latest slug
   */
  static async restart(appId: string, requestedReplicas?: number): Promise<{ replicas: number }> {
    const appResult = await pool.query<PaasApplication>('SELECT * FROM paas_applications WHERE id = $1', [appId]);

    if (appResult.rows.length === 0) {
      throw new Error('Application not found');
    }

    const app = appResult.rows[0];

    const planResult = await pool.query('SELECT max_replicas FROM paas_plans WHERE id = $1', [app.plan_id]);
    if (planResult.rows.length === 0) {
      throw new Error('Plan not found');
    }

    const maxReplicas = Number(planResult.rows[0].max_replicas || 1);
    const metadata = (app.metadata as Record<string, any>) || {};
    const fallbackReplicas =
      typeof metadata.last_running_replicas === 'number' && metadata.last_running_replicas > 0
        ? metadata.last_running_replicas
        : 1;

    const desiredReplicas = Math.max(1, Math.min(maxReplicas, requestedReplicas ?? fallbackReplicas));
    const serviceName = `paas-${app.slug}`;

    if (await this.checkServiceExists(serviceName)) {
      await this.execDocker(`docker service scale ${serviceName}=${desiredReplicas}`);
      await pool.query(
        `UPDATE paas_applications
           SET status = 'running',
               replicas = $1,
               metadata = COALESCE(metadata, '{}'::jsonb) - 'last_running_replicas'
         WHERE id = $2`,
        [desiredReplicas, appId]
      );
      return { replicas: desiredReplicas };
    }

    const latestDeployment = await pool.query<PaasDeployment>(
      `SELECT * FROM paas_deployments
         WHERE application_id = $1 AND slug_url IS NOT NULL
         ORDER BY version DESC
         LIMIT 1`,
      [appId]
    );

    if (latestDeployment.rows.length === 0) {
      throw new Error('No deployment artifacts available to restart');
    }

    await this.deploy({ deploymentId: latestDeployment.rows[0].id, replicas: desiredReplicas });
    await pool.query(
      `UPDATE paas_applications
         SET status = 'running',
             replicas = $1,
             metadata = COALESCE(metadata, '{}'::jsonb) - 'last_running_replicas'
       WHERE id = $2`,
      [desiredReplicas, appId]
    );

    return { replicas: desiredReplicas };
  }

  private static execDocker(command: string, options: ExecOptions = {}): Promise<{
    stdout: string;
    stderr: string;
  }> {
    return execAsync(command, {
      timeout: DOCKER_CMD_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  }
}
