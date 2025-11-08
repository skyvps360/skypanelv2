/**
 * Main Worker Agent
 */

import logger from './logger.js';
import { SkyPanelClient } from './client.js';
import { DockerService } from './docker.js';
import { BuildService } from './build.js';
import { config } from './config.js';
import fs from 'fs/promises';

export class WorkerAgent {
  private client: SkyPanelClient;
  private docker: DockerService;
  private buildService: BuildService;
  private isRunning: boolean = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private pollInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.client = new SkyPanelClient(config.skypanelUrl);
    this.docker = new DockerService(config.dockerHost, config.dockerPort);
    this.buildService = new BuildService(this.docker, this.client, config.workspaceDir);
  }

  /**
   * Start the worker agent
   */
  async start(): Promise<void> {
    try {
      logger.info(`Starting SkyPanel Worker Agent: ${config.name}`);
      logger.info(`SkyPanel URL: ${config.skypanelUrl}`);
      logger.info(`Worker ID: ${config.nodeId || 'Not registered yet'}`);

      // Test Docker connection
      const dockerConnected = await this.docker.testConnection();
      if (!dockerConnected) {
        throw new Error('Docker connection failed');
      }

      // Wait for SkyPanel API to become available (useful in dev when starting concurrently)
      await this.waitForSkyPanel();

      // Register or re-register worker
      await this.registerWorker();

      // Start intervals
      this.startHeartbeat();
      this.startBuildPolling();
      this.startCleanup();

      this.isRunning = true;
      logger.info('Worker agent started successfully');

    } catch (error) {
      logger.error('Failed to start worker agent:', error);
      throw error;
    }
  }

  /**
   * Wait for SkyPanel API health endpoint to become reachable
   * Retries with backoff up to the timeout to avoid failing
   * during concurrent startup in development.
   */
  private async waitForSkyPanel(timeoutMs: number = 60000, intervalMs: number = 2000): Promise<void> {
    const start = Date.now();
    let attempt = 0;

    while (true) {
      attempt += 1;
      try {
        const ok = await this.client.testConnection();
        if (ok) {
          logger.info('Connected to SkyPanel API');
          return;
        }
      } catch (_err) {
        // Swallow and retry until timeout
      }

      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        throw new Error('SkyPanel connection failed');
      }

      const remaining = Math.max(0, timeoutMs - elapsed);
      if (attempt === 1 || attempt % 5 === 0) {
        logger.warn(`Waiting for SkyPanel API... retry ${attempt} (remaining ${(remaining / 1000).toFixed(0)}s)`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Stop the worker agent
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping worker agent...');

      this.isRunning = false;

      // Clear intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Final cleanup
      await this.buildService.cleanup();

      logger.info('Worker agent stopped');

    } catch (error) {
      logger.error('Error stopping worker agent:', error);
    }
  }

  /**
   * Register worker with SkyPanel
   */
  private async registerWorker(): Promise<void> {
    try {
      const registration = {
        name: config.name,
        hostname: config.hostname,
        ipAddress: config.ipAddress,
        port: config.port,
        capabilities: {
          nodejs: true,
          docker: true,
          git: true
        },
        maxConcurrentBuilds: config.maxConcurrentBuilds,
        resourceLimits: {
          buildTimeoutMinutes: config.buildTimeoutMinutes,
          workspaceDir: config.workspaceDir
        }
      };

      // If we have existing credentials, try to reuse them
      if (config.nodeId && config.authToken) {
        this.client['nodeId'] = config.nodeId;
        this.client['authToken'] = config.authToken;
        this.client['axios'].defaults.headers.common['Authorization'] = `Bearer ${config.authToken}`;

        // Test if existing credentials are valid
        try {
          await this.client.sendHeartbeat();
          logger.info('Reconnected with existing credentials');
          return;
        } catch (error) {
          logger.warn('Existing credentials invalid, re-registering...');
        }
      }

      // Register new worker
      const result = await this.client.registerWorker(registration);
      logger.info(`Worker registered: ${result.nodeId}`);

    } catch (error) {
      logger.error('Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.client.sendHeartbeat();
      } catch (error) {
        logger.error('Heartbeat failed:', error);
        // Try to re-register on heartbeat failure
        try {
          await this.registerWorker();
        } catch (regError) {
          logger.error('Re-registration failed:', regError);
        }
      }
    }, 30000);

    logger.debug('Heartbeat interval started');
  }

  /**
   * Start build polling
   */
  private startBuildPolling(): void {
    // Poll for builds every 10 seconds
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.pollForBuilds();
      } catch (error) {
        logger.error('Build polling failed:', error);
      }
    }, 10000);

    logger.debug('Build polling interval started');
  }

  /**
   * Poll for queued builds
   */
  private async pollForBuilds(): Promise<void> {
    try {
      const queuedBuilds = await this.client.getQueuedBuilds();

      if (queuedBuilds.length > 0) {
        logger.info(`Found ${queuedBuilds.length} queued builds`);

        // Process builds one at a time (respect maxConcurrentBuilds)
        for (const build of queuedBuilds) {
          if (!this.isRunning) break;

          try {
            await this.processBuild(build);
          } catch (error) {
            logger.error(`Failed to process build ${build.deploymentId}:`, error);
          }
        }
      }

    } catch (error) {
      logger.error('Failed to poll for builds:', error);
    }
  }

  /**
   * Process a single build
   */
  private async processBuild(build: any): Promise<void> {
    try {
      logger.info(`Processing build: ${build.appName} (${build.deploymentId})`);

      // Accept the build
      await this.client.acceptBuild(build.deploymentId);

      // Prepare build configuration
      const buildConfig = {
        deploymentId: build.deploymentId,
        appId: build.appId,
        appName: build.appName,
        githubRepoUrl: build.githubRepoUrl,
        githubBranch: build.githubBranch,
        dockerfilePath: build.dockerfilePath,
        buildCommand: build.buildCommand,
        startCommand: build.startCommand,
        environmentVariables: build.environmentVariables || {}
      };

      // Execute the build
      const result = await this.buildService.executeBuild(buildConfig);

      if (result.success) {
        logger.info(`Build completed successfully: ${build.deploymentId}`);
      } else {
        logger.error(`Build failed: ${build.deploymentId} - ${result.error}`);
      }

    } catch (error) {
      logger.error(`Build processing failed for ${build.deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    // Cleanup every 30 minutes
    this.cleanupInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Cleanup failed:', error);
      }
    }, config.cleanupIntervalMinutes * 60 * 1000);

    logger.debug('Cleanup interval started');
  }

  /**
   * Perform system cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      logger.info('Starting system cleanup...');

      // Cleanup Docker resources
      await this.buildService.cleanup();

      // Cleanup workspace directory
      await this.cleanupWorkspace();

      logger.info('System cleanup completed');

    } catch (error) {
      logger.error('System cleanup failed:', error);
    }
  }

  /**
   * Cleanup workspace directory
   */
  private async cleanupWorkspace(): Promise<void> {
    try {
      const files = await fs.readdir(config.workspaceDir);

      for (const file of files) {
        const filePath = `${config.workspaceDir}/${file}`;
        const stats = await fs.stat(filePath);

        // Remove directories older than 1 hour
        if (stats.isDirectory() && Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          try {
            await fs.rm(filePath, { recursive: true, force: true });
            logger.debug(`Cleaned up old build directory: ${file}`);
          } catch (error) {
            logger.debug(`Failed to cleanup directory ${file}:`, error);
          }
        }
      }

    } catch (error) {
      logger.debug('Failed to cleanup workspace:', error);
    }
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<any> {
    try {
      const dockerInfo = await this.docker.getDockerInfo();
      const workerStatus = await this.client.getWorkerStatus();

      return {
        worker: {
          name: config.name,
          hostname: config.hostname,
          ipAddress: config.ipAddress,
          nodeId: this.client['nodeId'],
          isRunning: this.isRunning,
          uptime: process.uptime()
        },
        docker: {
          connected: await this.docker.testConnection(),
          info: dockerInfo
        },
        skypanel: {
          connected: await this.client.testConnection(),
          status: workerStatus
        }
      };

    } catch (error) {
      logger.error('Failed to get worker status:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
