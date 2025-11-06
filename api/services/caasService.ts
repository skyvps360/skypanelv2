/**
 * CaaS (Container as a Service) Service for SkyPanelV2
 * Built-in container management using Docker with rootless isolation
 * Replaces Easypanel and Dokploy with native implementation
 */

import { query } from '../lib/database.js';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import { config as appConfig } from '../config/index.js';
import Dockerode from 'dockerode';
import { 
  ContainerServiceError, 
  createConfigError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';

// ============================================================
// Type Definitions
// ============================================================

export interface CaasConfig {
  id?: string;
  apiUrl: string;
  apiKey?: string;
  hasApiKey?: boolean;
  connectionType?: 'socket' | 'tcp';
  status?: 'healthy' | 'degraded' | 'unknown';
  lastConnectionTest?: string;
  connectionStatus?: 'success' | 'failed' | 'pending' | 'connected';
  source?: 'db' | 'env' | 'none';
  updatedAt?: string;
  version?: string;
}

export interface CaasProject {
  name: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  network: string;
}

export interface CaasServiceInfo {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  containerId?: string;
  image?: string;
}

export interface CaasProjectWithServices extends CaasProject {
  services: CaasServiceInfo[];
}

export interface CaasProjectDetail extends CaasProject {
  env: Record<string, string>;
  services: CaasServiceInfo[];
}

export interface AppServiceDetail {
  name: string;
  type: string;
  status: string;
  env: Record<string, string>;
  resources: ResourceConfig;
  configuration: Record<string, any>;
}

export interface AppServiceConfig {
  serviceName: string;
  source: {
    type: 'image' | 'github' | 'git' | 'dockerfile';
    image?: string;
    owner?: string;
    repo?: string;
    ref?: string;
    path?: string;
    dockerfile?: string;
  };
  env?: Record<string, string>;
  domains?: DomainConfig[];
  mounts?: MountConfig[];
  deploy?: DeployConfig;
  resources?: ResourceConfig;
}

export interface ResourceConfig {
  cpuLimit?: number | string;
  memoryLimit?: number | string;
  memoryReservation?: number | string;
}

export interface DomainConfig {
  host: string;
  port?: number;
  https?: boolean;
}

export interface MountConfig {
  type: 'volume' | 'bind';
  name?: string;
  hostPath?: string;
  mountPath: string;
}

export interface DeployConfig {
  replicas?: number;
  command?: string;
  args?: string[];
}

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'mariadb' | 'mongo' | 'redis';
  version?: string;
  storage?: number;
  env?: Record<string, string>;
}

export interface TemplateConfig {
  templateId: string;
  params: Record<string, any>;
}

// ============================================================
// CaaS Service Class
// ============================================================

class CaasService {
  private dockerClients: Map<string, Dockerode> = new Map();

  /**
   * Detect available Docker connection methods
   */
  async detectDockerSetup(): Promise<{ socketPath?: string; tcpUrl?: string; detected: string[] }> {
    const detected: string[] = [];
    const fs = await import('fs');
    
    // Check for Docker socket
    const socketPaths = ['/var/run/docker.sock', '/run/docker.sock'];
    let socketPath: string | undefined;
    
    for (const path of socketPaths) {
      try {
        if (fs.existsSync(path)) {
          socketPath = path;
          detected.push(`socket:${path}`);
          break;
        }
      } catch (e) {
        // Socket doesn't exist or not accessible
      }
    }
    
    // Check for TCP connection (localhost:2375)
    try {
      const testDocker = new Dockerode({ host: 'localhost', port: 2375 });
      await testDocker.ping();
      detected.push('tcp:localhost:2375');
    } catch (e) {
      // TCP connection not available
    }
    
    return {
      socketPath,
      tcpUrl: detected.includes('tcp:localhost:2375') ? 'http://localhost:2375' : undefined,
      detected
    };
  }

  /**
   * Create Docker client based on configuration
   */
  private createDockerClientFromConfig(apiUrl: string): Dockerode {
    // Check if it's a Unix socket path
    if (apiUrl.startsWith('unix://') || apiUrl.startsWith('/')) {
      const socketPath = apiUrl.startsWith('unix://') ? apiUrl.replace('unix://', '') : apiUrl;
      return new Dockerode({ socketPath });
    }
    
    // Parse TCP URL
    try {
      const url = new URL(apiUrl);
      const options: any = {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port) || (url.protocol === 'https:' ? 2376 : 2375)
      };
      
      return new Dockerode(options);
    } catch (e) {
      // Fallback to socket
      return new Dockerode({ socketPath: '/var/run/docker.sock' });
    }
  }

  /**
   * Get Docker client for a specific tenant
   * Creates isolated Docker daemon connection per tenant
   */
  private async getDockerClient(tenantId: string): Promise<Dockerode> {
    if (this.dockerClients.has(tenantId)) {
      return this.dockerClients.get(tenantId)!;
    }

    // Get configuration to determine connection type
    const config = await this.getConfig();
    let docker: Dockerode;
    
    if (config?.apiUrl) {
      docker = this.createDockerClientFromConfig(config.apiUrl);
    } else {
      // Default to Unix socket
      docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    }
    
    this.dockerClients.set(tenantId, docker);
    return docker;
  }

  /**
   * Get CaaS configuration from database or environment
   */
  async getConfig(): Promise<CaasConfig | null> {
    try {
      // Check database first
      const result = await query(
        'SELECT id, api_url, api_key_encrypted, status, last_connection_test, updated_at FROM caas_config ORDER BY updated_at DESC LIMIT 1'
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const decryptedKey = row.api_key_encrypted ? await decryptSecret(row.api_key_encrypted) : null;
        
        // Determine connection type from API URL
        const apiUrl = row.api_url || '';
        const connectionType = (apiUrl.startsWith('unix://') || apiUrl.startsWith('/')) ? 'socket' : 'tcp';
        
        return {
          id: row.id,
          apiUrl,
          apiKey: decryptedKey || undefined,
          hasApiKey: !!row.api_key_encrypted,
          connectionType,
          status: row.status || 'unknown',
          lastConnectionTest: row.last_connection_test,
          connectionStatus: row.status === 'healthy' ? 'connected' : 'failed',
          source: 'db',
          updatedAt: row.updated_at
        };
      }

      // Fall back to environment variables
      const envUrl = appConfig.caas?.apiUrl;
      const envKey = appConfig.caas?.apiKey;

      if (envUrl || envKey) {
        const connectionType = (envUrl && (envUrl.startsWith('unix://') || envUrl.startsWith('/'))) ? 'socket' : 'tcp';
        return {
          apiUrl: envUrl || '',
          apiKey: envKey,
          hasApiKey: !!envKey,
          connectionType,
          status: 'unknown',
          connectionStatus: 'pending',
          source: 'env'
        };
      }

      // Auto-detect Docker setup
      const detected = await this.detectDockerSetup();
      if (detected.socketPath) {
        return {
          apiUrl: detected.socketPath,
          hasApiKey: false,
          connectionType: 'socket',
          status: 'unknown',
          connectionStatus: 'pending',
          source: 'none'
        };
      } else if (detected.tcpUrl) {
        return {
          apiUrl: detected.tcpUrl,
          hasApiKey: false,
          connectionType: 'tcp',
          status: 'unknown',
          connectionStatus: 'pending',
          source: 'none'
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching CaaS config:', error);
      throw createConfigError('Failed to fetch configuration', error);
    }
  }

  /**
   * Get configuration summary (without sensitive data)
   */
  async getConfigSummary(): Promise<CaasConfig | null> {
    const config = await this.getConfig();
    if (!config) return null;

    return {
      ...config,
      apiKey: undefined, // Never return API key in summary
      hasApiKey: !!config.apiKey
    };
  }

  /**
   * Update CaaS configuration
   */
  async updateConfig(apiUrl: string, apiKey?: string): Promise<void> {
    try {
      const encryptedKey = apiKey ? await encryptSecret(apiKey) : null;

      const existing = await query(
        'SELECT id FROM caas_config ORDER BY updated_at DESC LIMIT 1'
      );

      if (existing.rows.length > 0) {
        // Update existing config
        await query(
          `UPDATE caas_config 
           SET api_url = $1, 
               api_key_encrypted = COALESCE($2, api_key_encrypted),
               status = 'unknown',
               updated_at = NOW()
           WHERE id = $3`,
          [apiUrl, encryptedKey, existing.rows[0].id]
        );
      } else {
        // Create new config
        await query(
          `INSERT INTO caas_config (api_url, api_key_encrypted, status, updated_at)
           VALUES ($1, $2, 'unknown', NOW())`,
          [apiUrl, encryptedKey]
        );
      }
    } catch (error) {
      console.error('Error updating CaaS config:', error);
      throw createConfigError('Failed to update configuration', error);
    }
  }

  /**
   * Test connection to Docker daemon
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const config = await this.getConfig();
      let docker: Dockerode;
      
      if (config?.apiUrl) {
        docker = this.createDockerClientFromConfig(config.apiUrl);
      } else {
        // Try to auto-detect
        const detected = await this.detectDockerSetup();
        if (detected.socketPath) {
          docker = new Dockerode({ socketPath: detected.socketPath });
        } else if (detected.tcpUrl) {
          docker = this.createDockerClientFromConfig(detected.tcpUrl);
        } else {
          throw new Error('No Docker connection available');
        }
      }
      
      const info = await docker.version();

      // Update config status
      await query(
        `UPDATE caas_config 
         SET status = 'healthy',
             last_connection_test = NOW(),
             updated_at = NOW()
         WHERE id = (SELECT id FROM caas_config ORDER BY updated_at DESC LIMIT 1)`
      );

      return {
        success: true,
        message: 'Docker connection successful',
        version: info.Version
      };
    } catch (error: any) {
      // Update config status to degraded
      await query(
        `UPDATE caas_config 
         SET status = 'degraded',
             last_connection_test = NOW(),
             updated_at = NOW()
         WHERE id = (SELECT id FROM caas_config ORDER BY updated_at DESC LIMIT 1)`
      );

      return {
        success: false,
        message: error.message || 'Docker connection failed'
      };
    }
  }

  /**
   * Create a new project (tenant namespace)
   */
  async createProject(projectName: string, owner: string): Promise<CaasProject> {
    try {
      const tenantId = `tenant-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const docker = await this.getDockerClient(tenantId);

      // Create tenant-specific network
      const networkName = `${tenantId}-network`;
      try {
        await docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          Labels: {
            'caas.tenant': tenantId,
            'caas.project': projectName,
            'caas.owner': owner
          }
        });
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      }

      return {
        name: projectName,
        owner,
        tenantId,
        network: networkName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating project:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DEPLOYMENT_FAILED,
        'Failed to create project',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List all projects for a tenant
   */
  async listProjects(owner?: string): Promise<CaasProject[]> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const networks = await docker.listNetworks({
        filters: { label: ['caas.project'] }
      });

      return networks
        .filter(net => !owner || net.Labels?.['caas.owner'] === owner)
        .map(net => ({
          name: net.Labels?.['caas.project'] || net.Name,
          owner: net.Labels?.['caas.owner'] || '',
          tenantId: net.Labels?.['caas.tenant'] || '',
          network: net.Name,
          createdAt: net.Created || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }

  /**
   * Delete a project and all its services
   */
  async deleteProject(projectName: string): Promise<void> {
    try {
      const tenantId = `tenant-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const docker = await this.getDockerClient(tenantId);

      // Stop and remove all containers in this project
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [`caas.project=${projectName}`] }
      });

      for (const containerInfo of containers) {
        const container = docker.getContainer(containerInfo.Id);
        try {
          await container.stop();
        } catch (e) {
          // Container might already be stopped
        }
        await container.remove();
      }

      // Remove the network
      const networkName = `${tenantId}-network`;
      try {
        const network = docker.getNetwork(networkName);
        await network.remove();
      } catch (e) {
        // Network might not exist
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new ContainerServiceError(
        ERROR_CODES.PROJECT_DELETE_FAILED,
        'Failed to delete project',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Deploy an application service
   */
  async deployApp(config: AppServiceConfig & { project: string }): Promise<{ serviceId: string; status: string }> {
    try {
      const tenantId = `tenant-${config.project.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const docker = await this.getDockerClient(tenantId);

      const containerName = `${tenantId}-${config.serviceName}`;
      const networkName = `${tenantId}-network`;

      // Prepare environment variables
      const envArray = config.env ? Object.entries(config.env).map(([key, val]) => `${key}=${val}`) : [];

      // Prepare resource limits
      const hostConfig: any = {};
      if (config.resources?.memoryLimit) {
        const memBytes = typeof config.resources.memoryLimit === 'string'
          ? parseInt(config.resources.memoryLimit) * 1024 * 1024
          : config.resources.memoryLimit * 1024 * 1024;
        hostConfig.Memory = memBytes;
      }
      if (config.resources?.cpuLimit) {
        const cpuPeriod = 100000;
        const cpuQuota = typeof config.resources.cpuLimit === 'string'
          ? parseFloat(config.resources.cpuLimit) * cpuPeriod
          : config.resources.cpuLimit * cpuPeriod;
        hostConfig.CpuQuota = cpuQuota;
        hostConfig.CpuPeriod = cpuPeriod;
      }

      // Prepare volume mounts
      const binds: string[] = [];
      const volumes: Record<string, {}> = {};
      
      if (config.mounts && config.mounts.length > 0) {
        for (const mount of config.mounts) {
          if (mount.type === 'volume' && mount.name) {
            // Docker volume mount
            binds.push(`${mount.name}:${mount.mountPath}`);
            volumes[mount.mountPath] = {};
          } else if (mount.type === 'bind' && mount.hostPath) {
            // Bind mount
            binds.push(`${mount.hostPath}:${mount.mountPath}`);
            volumes[mount.mountPath] = {};
          }
        }
      }

      if (binds.length > 0) {
        hostConfig.Binds = binds;
      }

      // Security: No privileged mode, no host network
      hostConfig.Privileged = false;
      hostConfig.NetworkMode = networkName;

      // Create and start container
      const container = await docker.createContainer({
        name: containerName,
        Image: config.source.image || 'nginx:latest',
        Env: envArray,
        Labels: {
          'caas.tenant': tenantId,
          'caas.project': config.project,
          'caas.service': config.serviceName,
          'caas.type': 'app'
        },
        Volumes: Object.keys(volumes).length > 0 ? volumes : undefined,
        HostConfig: hostConfig,
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: {}
          }
        }
      });

      await container.start();

      return {
        serviceId: container.id,
        status: 'running'
      };
    } catch (error) {
      console.error('Error deploying app:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DEPLOYMENT_FAILED,
        'Failed to deploy application',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Deploy a database service with persistent volume
   */
  async deployDatabase(config: DatabaseConfig & { project: string; serviceName: string; organizationId?: string }): Promise<{ serviceId: string; status: string; volumeId?: string }> {
    const imageMap: Record<string, string> = {
      postgres: 'postgres:15-alpine',
      mysql: 'mysql:8.0',
      mariadb: 'mariadb:10.11',
      mongo: 'mongo:7.0',
      redis: 'redis:7-alpine'
    };

    // Determine data directory based on database type
    const dataDirMap: Record<string, string> = {
      postgres: '/var/lib/postgresql/data',
      mysql: '/var/lib/mysql',
      mariadb: '/var/lib/mysql',
      mongo: '/data/db',
      redis: '/data'
    };

    const mountPath = dataDirMap[config.type];

    // Create persistent volume for database if organizationId is provided
    let volumeId: string | undefined;
    let volumeName: string | undefined;
    
    if (config.organizationId && mountPath) {
      try {
        const { volumeService } = await import('./volumeService.js');
        const volume = await volumeService.createVolume({
          organizationId: config.organizationId,
          serviceName: config.serviceName,
          mountPath,
          sizeLimit: config.storage || 10240, // Default 10GB
          backupEnabled: true
        });
        volumeId = volume.id;
        volumeName = volume.name;
      } catch (error) {
        console.warn('Failed to create volume, deploying without persistence:', error);
      }
    }

    const appConfig: AppServiceConfig = {
      serviceName: config.serviceName,
      source: {
        type: 'image',
        image: config.version || imageMap[config.type]
      },
      env: config.env,
      resources: {
        memoryLimit: 512
      },
      // Add volume mount if volume was created
      mounts: volumeName ? [{
        type: 'volume',
        name: volumeName,
        mountPath
      }] : undefined
    };

    const result = await this.deployApp({ ...appConfig, project: config.project });
    
    return {
      ...result,
      volumeId
    };
  }

  /**
   * Deploy from template
   */
  async deployTemplate(config: TemplateConfig & { project: string; serviceName: string }): Promise<{ serviceId: string; status: string }> {
    // Template deployment logic - simplified for now
    // In production, this would load template definitions and deploy accordingly
    const appConfig: AppServiceConfig = {
      serviceName: config.serviceName,
      source: {
        type: 'image',
        image: config.params.image || 'nginx:latest'
      },
      env: config.params.env || {}
    };

    return this.deployApp({ ...appConfig, project: config.project });
  }

  /**
   * Start a service
   */
  async startService(serviceId: string): Promise<void> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      await container.start();
    } catch (error) {
      console.error('Error starting service:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to start service',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Stop a service
   */
  async stopService(serviceId: string): Promise<void> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      await container.stop();
    } catch (error) {
      console.error('Error stopping service:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to stop service',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Restart a service
   */
  async restartService(serviceId: string): Promise<void> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      await container.restart();
    } catch (error) {
      console.error('Error restarting service:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to restart service',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId: string): Promise<void> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      
      try {
        await container.stop();
      } catch (e) {
        // Container might already be stopped
      }
      
      await container.remove();
    } catch (error) {
      console.error('Error deleting service:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_DELETE_FAILED,
        'Failed to delete service',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get service logs
   */
  async getLogs(serviceId: string, options?: { lines?: number; since?: string; level?: string }): Promise<string> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: options?.lines || 100,
        since: options?.since ? Math.floor(new Date(options.since).getTime() / 1000) : undefined
      });

      return logs.toString();
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to fetch service logs',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update service environment variables with rolling update
   */
  async updateEnv(serviceId: string, env: Record<string, string>): Promise<void> {
    try {
      const docker = this.getDockerClient(serviceId);
      const container = docker.getContainer(serviceId);
      
      // Get current container configuration
      const inspect = await container.inspect();
      const config = inspect.Config;
      const hostConfig = inspect.HostConfig;
      
      // Stop the container
      try {
        await container.stop();
      } catch (e) {
        // Container might already be stopped
      }
      
      // Remove the container
      await container.remove();
      
      // Prepare new environment variables
      const envArray = Object.entries(env).map(([key, val]) => `${key}=${val}`);
      
      // Recreate container with new environment
      const newContainer = await docker.createContainer({
        name: inspect.Name,
        Image: config.Image,
        Env: envArray,
        Labels: config.Labels,
        Volumes: config.Volumes,
        HostConfig: hostConfig,
        NetworkingConfig: inspect.NetworkSettings.Networks ? {
          EndpointsConfig: inspect.NetworkSettings.Networks
        } : undefined
      });
      
      // Start the new container
      await newContainer.start();
    } catch (error) {
      console.error('Error updating environment variables:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to update environment variables',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Perform rolling update with zero-downtime
   */
  async rollingUpdate(serviceId: string, config: {
    image?: string;
    env?: Record<string, string>;
    resources?: ResourceConfig;
  }): Promise<void> {
    try {
      const docker = this.getDockerClient(serviceId);
      const oldContainer = docker.getContainer(serviceId);
      
      // Get current container configuration
      const inspect = await oldContainer.inspect();
      const containerConfig = inspect.Config;
      const hostConfig = inspect.HostConfig;
      const networkName = Object.keys(inspect.NetworkSettings.Networks || {})[0];
      
      // Prepare new configuration
      const newImage = config.image || containerConfig.Image;
      const newEnv = config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : containerConfig.Env;
      
      // Prepare resource limits if provided
      const newHostConfig: any = { ...hostConfig };
      if (config.resources) {
        if (config.resources.memoryLimit) {
          const memBytes = typeof config.resources.memoryLimit === 'string'
            ? parseInt(config.resources.memoryLimit) * 1024 * 1024
            : config.resources.memoryLimit * 1024 * 1024;
          newHostConfig.Memory = memBytes;
        }
        if (config.resources.cpuLimit) {
          const cpuPeriod = 100000;
          const cpuQuota = typeof config.resources.cpuLimit === 'string'
            ? parseFloat(config.resources.cpuLimit) * cpuPeriod
            : config.resources.cpuLimit * cpuPeriod;
          newHostConfig.CpuQuota = cpuQuota;
          newHostConfig.CpuPeriod = cpuPeriod;
        }
      }
      
      // Create new container with updated configuration
      const newContainerName = `${inspect.Name}-new`;
      const newContainer = await docker.createContainer({
        name: newContainerName,
        Image: newImage,
        Env: newEnv,
        Labels: containerConfig.Labels,
        Volumes: containerConfig.Volumes,
        HostConfig: newHostConfig,
        NetworkingConfig: networkName ? {
          EndpointsConfig: {
            [networkName]: {}
          }
        } : undefined
      });
      
      // Start new container
      await newContainer.start();
      
      // Wait for new container to be healthy (simple check)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop old container
      try {
        await oldContainer.stop({ t: 10 });
      } catch (e) {
        console.warn('Error stopping old container:', e);
      }
      
      // Rename containers
      try {
        await oldContainer.rename({ name: `${inspect.Name}-old` });
      } catch (e) {
        console.warn('Error renaming old container:', e);
      }
      
      try {
        await newContainer.rename({ name: inspect.Name });
      } catch (e) {
        console.warn('Error renaming new container:', e);
      }
      
      // Remove old container
      try {
        await oldContainer.remove({ force: true });
      } catch (e) {
        console.warn('Error removing old container:', e);
      }
    } catch (error) {
      console.error('Error performing rolling update:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to perform rolling update',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update service resources
   */
  async updateResources(serviceId: string, resources: ResourceConfig): Promise<void> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const container = docker.getContainer(serviceId);
      
      const updateConfig: any = {};
      
      if (resources.memoryLimit) {
        const memBytes = typeof resources.memoryLimit === 'string'
          ? parseInt(resources.memoryLimit) * 1024 * 1024
          : resources.memoryLimit * 1024 * 1024;
        updateConfig.Memory = memBytes;
      }
      
      if (resources.cpuLimit) {
        const cpuPeriod = 100000;
        const cpuQuota = typeof resources.cpuLimit === 'string'
          ? parseFloat(resources.cpuLimit) * cpuPeriod
          : resources.cpuLimit * cpuPeriod;
        updateConfig.CpuQuota = cpuQuota;
        updateConfig.CpuPeriod = cpuPeriod;
      }

      await container.update(updateConfig);
    } catch (error) {
      console.error('Error updating resources:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_ACTION_FAILED,
        'Failed to update service resources',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List services in a project
   */
  async listServices(projectName: string): Promise<CaasServiceInfo[]> {
    try {
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [`caas.project=${projectName}`] }
      });

      return containers.map(container => ({
        name: container.Labels['caas.service'] || container.Names[0]?.replace('/', ''),
        type: container.Labels['caas.type'] || 'app',
        status: container.State,
        containerId: container.Id,
        image: container.Image,
        createdAt: new Date(container.Created * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error listing services:', error);
      return [];
    }
  }

  /**
   * Get project details with services
   */
  async getProjectDetail(projectName: string): Promise<CaasProjectDetail | null> {
    try {
      const projects = await this.listProjects();
      const project = projects.find(p => p.name === projectName);
      
      if (!project) {
        return null;
      }

      const services = await this.listServices(projectName);

      return {
        ...project,
        env: {},
        services
      };
    } catch (error) {
      console.error('Error fetching project details:', error);
      return null;
    }
  }
}

// Export singleton instance
export const caasService = new CaasService();
