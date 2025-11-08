/**
 * Build Service for Worker Agent
 */

import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { DockerService } from './docker.js';
import { SkyPanelClient } from './client.js';

export interface BuildConfig {
  deploymentId: string;
  appId: string;
  appName: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  githubCommitSha?: string;
  dockerfilePath?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
}

export interface BuildResult {
  success: boolean;
  imageId?: string;
  containerId?: string;
  logs: string[];
  error?: string;
}

export class BuildService {
  private docker: DockerService;
  private client: SkyPanelClient;
  private workspaceDir: string;

  constructor(docker: DockerService, client: SkyPanelClient, workspaceDir: string) {
    this.docker = docker;
    this.client = client;
    this.workspaceDir = workspaceDir;
  }

  /**
   * Execute a complete build and deployment
   */
  async executeBuild(config: BuildConfig): Promise<BuildResult> {
    const buildDir = path.join(this.workspaceDir, config.deploymentId);
    const logs: string[] = [];

    try {
      logger.info(`Starting build for app ${config.appName} (${config.deploymentId})`);

      // Create build directory
      await fs.mkdir(buildDir, { recursive: true });
      logs.push(`Created build directory: ${buildDir}`);

      // Update build status to deploying
      await this.client.updateBuildStatus(config.deploymentId, 'deploying', logs.join('\n'));

      // Clone repository if provided
      if (config.githubRepoUrl) {
        await this.cloneRepository(config.githubRepoUrl, config.githubBranch || 'main', buildDir);
        logs.push(`Cloned repository: ${config.githubRepoUrl}`);

        // Checkout specific commit if provided
        if (config.githubCommitSha) {
          await this.checkoutCommit(buildDir, config.githubCommitSha);
          logs.push(`Checked out commit: ${config.githubCommitSha}`);
        }
      }

      // Build Docker image
      const imageName = `skypanel-app-${config.appId}:${config.deploymentId}`;
      const imageId = await this.buildDockerImage(buildDir, config.dockerfilePath || 'Dockerfile', imageName);
      logs.push(`Built Docker image: ${imageId}`);

      // Run container for deployment
      const containerId = await this.runContainer(imageId, config);
      logs.push(`Started container: ${containerId}`);

      // Update status to deployed
      await this.client.updateBuildStatus(config.deploymentId, 'deployed', logs.join('\n'), undefined, {
        imageId,
        containerId
      });

      logger.info(`Build completed successfully for ${config.appName}`);

      return {
        success: true,
        imageId,
        containerId,
        logs
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logs.push(`Build failed: ${errorMessage}`);
      logger.error(`Build failed for ${config.appName}:`, error);

      try {
        await this.client.updateBuildStatus(config.deploymentId, 'building_failed', logs.join('\n'), errorMessage);
      } catch (updateError) {
        logger.error('Failed to update build status to failed:', updateError);
      }

      return {
        success: false,
        logs,
        error: errorMessage
      };

    } finally {
      // Cleanup build directory
      try {
        await fs.rm(buildDir, { recursive: true, force: true });
        logger.debug(`Cleaned up build directory: ${buildDir}`);
      } catch (cleanupError) {
        logger.error(`Failed to cleanup build directory ${buildDir}:`, cleanupError);
      }
    }
  }

  /**
   * Clone a Git repository
   */
  private async cloneRepository(repoUrl: string, branch: string, targetDir: string): Promise<void> {
    try {
      const git = simpleGit();

      // Clone the repository
      await git.clone(repoUrl, targetDir, ['--branch', branch, '--depth', '1']);

      logger.info(`Cloned repository ${repoUrl} (branch: ${branch}) to ${targetDir}`);
    } catch (error) {
      logger.error(`Failed to clone repository ${repoUrl}:`, error);
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checkout a specific commit
   */
  private async checkoutCommit(repoDir: string, commitSha: string): Promise<void> {
    try {
      const git = simpleGit(repoDir);
      await git.checkout(commitSha);

      logger.info(`Checked out commit ${commitSha} in ${repoDir}`);
    } catch (error) {
      logger.error(`Failed to checkout commit ${commitSha}:`, error);
      throw new Error(`Failed to checkout commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build Docker image
   */
  private async buildDockerImage(buildDir: string, dockerfilePath: string, imageName: string): Promise<string> {
    try {
      logger.info(`Building Docker image ${imageName} from ${buildDir}/${dockerfilePath}`);

      // Check if Dockerfile exists
      const fullDockerfilePath = path.join(buildDir, dockerfilePath);
      try {
        await fs.access(fullDockerfilePath);
      } catch (error) {
        throw new Error(`Dockerfile not found: ${fullDockerfilePath}`);
      }

      // Build the image
      const imageId = await this.docker.buildImage({
        contextPath: buildDir,
        dockerfilePath,
        tags: [imageName]
      });

      logger.info(`Docker image built successfully: ${imageId}`);
      return imageId;

    } catch (error) {
      logger.error(`Failed to build Docker image:`, error);
      throw new Error(`Docker build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run Docker container for deployment
   */
  private async runContainer(imageName: string, config: BuildConfig): Promise<string> {
    try {
      logger.info(`Running container for image ${imageName}`);

      const containerName = `skypanel-app-${config.appId}-${config.deploymentId}`;

      // Prepare environment variables
      const environment = {
        ...config.environmentVariables,
        PORT: '3000',
        NODE_ENV: 'production'
      };

      // Map port 3000 in container to a random host port
      const portBindings: Record<string, any> = {
        '3000/tcp': [{ HostPort: '0' }] // 0 means random port
      };

      const containerId = await this.docker.runContainer({
        image: imageName,
        name: containerName,
        environment,
        portBindings,
        memoryLimit: '1g',
        cpuLimit: '1'
      });

      // Wait a moment for the container to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if container is still running
      const containerInfo = await this.docker.getContainerInfo(containerId);
      if (containerInfo.State.Status !== 'running') {
        throw new Error(`Container failed to start: ${containerInfo.State.Status}`);
      }

      logger.info(`Container started successfully: ${containerId}`);
      return containerId;

    } catch (error) {
      logger.error(`Failed to run container:`, error);
      throw new Error(`Container deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string): Promise<string> {
    try {
      const logStream = await this.docker.getContainerLogs(containerId, false);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        logStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        logStream.on('end', () => {
          const logs = Buffer.concat(chunks).toString();
          resolve(logs);
        });

        logStream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error(`Failed to get logs for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Stop a deployment
   */
  async stopDeployment(containerId: string): Promise<void> {
    try {
      logger.info(`Stopping deployment container: ${containerId}`);
      await this.docker.stopContainer(containerId);
      logger.info(`Deployment stopped: ${containerId}`);
    } catch (error) {
      logger.error(`Failed to stop deployment ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup old images and containers
   */
  async cleanup(): Promise<void> {
    try {
      await this.docker.cleanup();
    } catch (error) {
      logger.error('Failed to cleanup Docker resources:', error);
    }
  }
}