/**
 * PaaS Deployer Service
 * Handles deployment of built applications to Docker Swarm
 */

import { pool, PaasApplication, PaasDeployment, PaasEnvironmentVar } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';
import { decrypt } from '../../lib/crypto.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DeployOptions {
  deploymentId: string;
  replicas?: number;
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
      const runtimeDir = await this.extractSlug(deployment.slug_url!, deployment.id);

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
  private static async extractSlug(slugUrl: string, deploymentId: string): Promise<string> {
    const runtimeDir = `/var/paas/runtime/${deploymentId}`;
    await fs.mkdir(runtimeDir, { recursive: true });

    // Extract tar.gz
    await execAsync(`tar -xzf ${slugUrl} -C ${runtimeDir}`);

    return runtimeDir;
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
    await execAsync(`docker build -t ${imageName} ${runtimeDir}`);

    return imageName;
  }

  /**
   * Get application environment variables
   */
  private static async getEnvironmentVariables(appId: string): Promise<Record<string, string>> {
    const result = await pool.query<PaasEnvironmentVar>(
      'SELECT key, value_encrypted FROM paas_environment_vars WHERE application_id = $1',
      [appId]
    );

    const envVars: Record<string, string> = {};

    for (const row of result.rows) {
      envVars[row.key] = decrypt(row.value_encrypted);
    }

    return envVars;
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

    // Build environment variable flags
    const envFlags = Object.entries(envVars)
      .map(([key, value]) => `--env ${key}="${value.replace(/"/g, '\\"')}"`)
      .join(' ');

    // Add system environment variables
    const systemEnvFlags = `
      --env PORT=5000
      --env DYNO=web.1
      --env PS=web
    `;

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

    if (serviceExists) {
      // Update existing service
      const updateCommand = `
        docker service update \\
          --image ${imageName} \\
          --replicas ${replicas} \\
          --limit-cpu ${cpuLimit} \\
          --limit-memory ${ramLimit}m \\
          ${envFlags} \\
          ${systemEnvFlags} \\
          --label "traefik.enable=true" \\
          --label "traefik.http.routers.${app.slug}.rule=Host(\`${appUrl}\`)" \\
          --label "traefik.http.services.${app.slug}.loadbalancer.server.port=5000" \\
          ${serviceName}
      `.replace(/\s+/g, ' ').trim();

      await execAsync(updateCommand);
    } else {
      // Create new service
      const createCommand = `
        docker service create \\
          --name ${serviceName} \\
          --replicas ${replicas} \\
          --limit-cpu ${cpuLimit} \\
          --limit-memory ${ramLimit}m \\
          --reserve-cpu ${cpuLimit * 0.5} \\
          --reserve-memory ${ramLimit * 0.5}m \\
          --network ${networkName} \\
          --network paas-public \\
          ${envFlags} \\
          ${systemEnvFlags} \\
          --label "traefik.enable=true" \\
          --label "traefik.http.routers.${app.slug}.rule=Host(\`${appUrl}\`)" \\
          --label "traefik.http.services.${app.slug}.loadbalancer.server.port=5000" \\
          --label "paas.app.id=${app.id}" \\
          --label "paas.app.name=${app.name}" \\
          --label "paas.deployment.id=${deployment.id}" \\
          --restart-condition on-failure \\
          --restart-max-attempts 3 \\
          --update-parallelism 1 \\
          --update-delay 10s \\
          --health-cmd "curl -f http://localhost:5000/health || exit 1" \\
          --health-interval 30s \\
          --health-timeout 10s \\
          --health-retries 3 \\
          ${imageName}
      `.replace(/\s+/g, ' ').trim();

      await execAsync(createCommand);
    }

    // Get service ID
    const { stdout } = await execAsync(`docker service ps ${serviceName} --format "{{.ID}}" | head -1`);
    return stdout.trim();
  }

  /**
   * Create overlay network for application isolation
   */
  private static async createOverlayNetwork(networkName: string): Promise<void> {
    try {
      await execAsync(`docker network inspect ${networkName}`);
      // Network exists
    } catch (error) {
      // Network doesn't exist, create it
      await execAsync(`docker network create --driver overlay --attachable ${networkName}`);
    }
  }

  /**
   * Check if a Swarm service exists
   */
  private static async checkServiceExists(serviceName: string): Promise<boolean> {
    try {
      await execAsync(`docker service inspect ${serviceName}`);
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
      await execAsync(`docker service scale ${serviceName}=0`);
      await pool.query(
        'UPDATE paas_applications SET status = $1, replicas = 0 WHERE id = $2',
        ['stopped', appId]
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
      await execAsync(`docker service rm ${serviceName}`).catch(() => {});

      // Remove network
      await execAsync(`docker network rm ${networkName}`).catch(() => {});

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
   * Rollback to a previous deployment
   */
  static async rollback(appId: string, targetVersion: number): Promise<DeployResult> {
    // Get target deployment
    const deploymentResult = await pool.query<PaasDeployment>(
      'SELECT * FROM paas_deployments WHERE application_id = $1 AND version = $2',
      [appId, targetVersion]
    );

    if (deploymentResult.rows.length === 0) {
      throw new Error('Target deployment not found');
    }

    const deployment = deploymentResult.rows[0];

    // Deploy the old version
    return await this.deploy({ deploymentId: deployment.id });
  }
}
