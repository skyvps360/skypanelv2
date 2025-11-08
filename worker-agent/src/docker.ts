/**
 * Docker Service for Worker Agent
 */

import Docker from 'dockerode';
import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import tar from 'tar';
import { URL } from 'url';

export interface DockerBuildOptions {
  contextPath: string;
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  tags?: string[];
}

export interface DockerContainerOptions {
  image: string;
  name?: string;
  environment?: Record<string, string>;
  portBindings?: Record<string, any>;
  volumes?: Record<string, any>;
  memoryLimit?: string;
  cpuLimit?: string;
}

export class DockerService {
  private docker: Docker;

  constructor(dockerHost?: string, dockerPort?: number) {
    const effectiveHost = dockerHost ?? process.env.DOCKER_HOST;
    const effectivePort = dockerHost
      ? dockerPort
      : process.env.DOCKER_PORT
        ? parseInt(process.env.DOCKER_PORT, 10)
        : undefined;

    this.docker = new Docker(this.buildDockerOptions(effectiveHost, effectivePort));
  }

  /**
   * Normalize DOCKER_HOST/DOCKER_PORT into dockerode options.
   */
  private buildDockerOptions(host?: string, port?: number): Docker.DockerOptions {
    if (!host) {
      return {};
    }

    const trimmedHost = host.trim();
    if (!trimmedHost) {
      return {};
    }

    // Unix sockets (unix:///var/run/docker.sock or direct path)
    if (trimmedHost.startsWith('unix://')) {
      return { socketPath: trimmedHost.replace('unix://', '') };
    }
    if (trimmedHost.startsWith('/') || trimmedHost.startsWith('\\')) {
      return { socketPath: trimmedHost };
    }

    // Windows named pipes
    if (trimmedHost.startsWith('npipe://')) {
      return { socketPath: trimmedHost };
    }

    // TCP/HTTP(S) endpoints (e.g. tcp://localhost:2375)
    if (
      trimmedHost.startsWith('tcp://') ||
      trimmedHost.startsWith('http://') ||
      trimmedHost.startsWith('https://')
    ) {
      const normalizedHost = trimmedHost.startsWith('tcp://')
        ? trimmedHost.replace('tcp://', 'http://')
        : trimmedHost;
      const endpoint = new URL(normalizedHost);
      const isHttps = endpoint.protocol === 'https:';
      const resolvedPort =
        port ??
        (endpoint.port ? parseInt(endpoint.port, 10) : undefined) ??
        (isHttps ? 2376 : 2375);

      return {
        host: endpoint.hostname,
        port: resolvedPort,
        protocol: isHttps ? 'https' : 'http'
      };
    }

    // Bare hostname/IP, assume default Docker TCP port unless provided
    return {
      host: trimmedHost,
      port: port ?? 2375
    };
  }

  /**
   * Test Docker connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.docker.ping();
      logger.info('Docker connection established');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Docker:', error);
      return false;
    }
  }

  /**
   * Get Docker info
   */
  async getDockerInfo(): Promise<any> {
    try {
      return await this.docker.info();
    } catch (error) {
      logger.error('Failed to get Docker info:', error);
      throw error;
    }
  }

  /**
   * Build a Docker image
   */
  async buildImage(options: DockerBuildOptions): Promise<string> {
    try {
      logger.info(`Building Docker image: ${options.tags?.join(', ') || 'untagged'}`);

      // Create build context tar
      const tarPath = await this.createBuildContext(options.contextPath);

      // Build the image
      const buildOptions: any = {
        buildargs: options.buildArgs || {},
        rm: true,
        forcerm: true
      };

      // Add tags to build options
      if (options.tags && options.tags.length > 0) {
        buildOptions.t = options.tags;
      }

      return new Promise((resolve, reject) => {
        let imageId = '';
        const chunks: Buffer[] = [];

        // Use the callback-based API to get a stream
        this.docker.buildImage(
          { context: tarPath, src: ['.'] },
          buildOptions,
          (err, stream) => {
            if (err) {
              logger.error('Docker build failed:', err);
              reject(err);
              return;
            }

            if (!stream) {
              reject(new Error('No stream returned from Docker build'));
              return;
            }

            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
              try {
                const data = JSON.parse(chunk.toString());
                if (data.aux?.ID) {
                  imageId = data.aux.ID;
                }
                if (data.stream) {
                  logger.info(`Docker build: ${data.stream.trim()}`);
                }
                if (data.error) {
                  logger.error(`Docker build error: ${data.error}`);
                }
              } catch (e) {
                // Ignore JSON parse errors for progress updates
              }
            });

            stream.on('end', () => {
              logger.info(`Docker build completed: ${imageId}`);
              resolve(imageId);
            });

            stream.on('error', (error: any) => {
              logger.error('Docker build failed:', error);
              reject(error);
            });
          }
        );
      });
    } catch (error) {
      logger.error('Failed to build Docker image:', error);
      throw error;
    }
  }

  /**
   * Create build context tar archive
   */
  private async createBuildContext(contextPath: string): Promise<string> {
    const tarPath = path.join(contextPath, 'build-context.tar');

    try {
      const files = await fs.readdir(contextPath, { withFileTypes: true });

      // Create tar with all files in context
      await tar.create(
        {
          file: tarPath,
          cwd: contextPath,
          filter: (filePath) => {
            // Skip the tar file itself
            return filePath !== 'build-context.tar';
          }
        },
        files.map(file => file.name)
      );

      return tarPath;
    } catch (error) {
      logger.error('Failed to create build context:', error);
      throw error;
    }
  }

  /**
   * Run a Docker container
   */
  async runContainer(options: DockerContainerOptions): Promise<string> {
    try {
      logger.info(`Running Docker container: ${options.image}`);

      const containerConfig: Docker.ContainerCreateOptions = {
        Image: options.image,
        name: options.name,
        Env: options.environment ? Object.entries(options.environment).map(([key, value]) => `${key}=${value}`) : [],
        HostConfig: {
          PortBindings: options.portBindings || {},
          Binds: options.volumes ? Object.entries(options.volumes).map(([host, container]) => `${host}:${container}`) : [],
          Memory: options.memoryLimit ? this.parseMemoryLimit(options.memoryLimit) : undefined,
          CpuQuota: options.cpuLimit ? this.parseCpuLimit(options.cpuLimit) : undefined,
          AutoRemove: true
        }
      };

      const container = await this.docker.createContainer(containerConfig);
      await container.start();

      const containerInfo = await container.inspect();
      logger.info(`Container started: ${containerInfo.Id}`);
      return containerInfo.Id;
    } catch (error) {
      logger.error('Failed to run Docker container:', error);
      throw error;
    }
  }

  /**
   * Stop a Docker container
   */
  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 10 }); // 10 second timeout
      logger.info(`Container stopped: ${containerId}`);
    } catch (error) {
      logger.error(`Failed to stop container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, follow: boolean = false): Promise<NodeJS.ReadableStream> {
    try {
      const container = this.docker.getContainer(containerId);

      const options: any = {
        stdout: true,
        stderr: true,
        timestamps: true,
        follow
      };

      const logs = await container.logs(options);

      return logs as unknown as NodeJS.ReadableStream;
    } catch (error) {
      logger.error(`Failed to get logs for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get container info
   */
  async getContainerInfo(containerId: string): Promise<any> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      logger.error(`Failed to get info for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * List containers
   */
  async listContainers(all: boolean = false): Promise<any[]> {
    try {
      const containers = await this.docker.listContainers({ all });
      return containers;
    } catch (error) {
      logger.error('Failed to list containers:', error);
      throw error;
    }
  }

  /**
   * Remove an image
   */
  async removeImage(imageId: string, force: boolean = false): Promise<void> {
    try {
      await this.docker.getImage(imageId).remove({ force });
      logger.info(`Image removed: ${imageId}`);
    } catch (error) {
      logger.error(`Failed to remove image ${imageId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup old images and containers
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Starting Docker cleanup...');

      // Remove stopped containers
      const stoppedContainers = await this.docker.listContainers({ all: true });
      for (const container of stoppedContainers) {
        if (container.State === 'exited' || container.State === 'dead') {
          try {
            await this.docker.getContainer(container.Id).remove({ force: true });
            logger.debug(`Removed stopped container: ${container.Id}`);
          } catch (error) {
            logger.debug(`Failed to remove container ${container.Id}:`, error);
          }
        }
      }

      // Remove dangling images
      const images = await this.docker.listImages({ filters: { dangling: ['true'] } });
      for (const image of images) {
        try {
          await this.docker.getImage(image.Id).remove({ force: true });
          logger.debug(`Removed dangling image: ${image.Id}`);
        } catch (error) {
          logger.debug(`Failed to remove image ${image.Id}:`, error);
        }
      }

      logger.info('Docker cleanup completed');
    } catch (error) {
      logger.error('Docker cleanup failed:', error);
    }
  }

  /**
   * Parse memory limit string (e.g., "512m", "1g")
   */
  private parseMemoryLimit(limit: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = limit.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) {
      throw new Error(`Invalid memory limit format: ${limit}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2] || 'b';
    return value * (units[unit] || 1);
  }

  /**
   * Parse CPU limit string (e.g., "0.5", "1")
   */
  private parseCpuLimit(limit: string): number {
    const value = parseFloat(limit);
    if (isNaN(value) || value < 0 || value > 1) {
      throw new Error(`Invalid CPU limit: ${limit}. Must be between 0 and 1.`);
    }
    return Math.floor(value * 100000); // Docker expects CPU quota in 100,000s of a CPU
  }
}
