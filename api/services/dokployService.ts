/**
 * Dokploy API Service for SkyPanelV2
 * Handles integration with Dokploy API for container management
 */

import { query } from '../lib/database.js';
import { decryptSecret } from '../lib/crypto.js';
import { config as appConfig } from '../config/index.js';
import { 
  ContainerServiceError, 
  transformEasypanelError, 
  createConfigError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';

// ============================================================
// Type Definitions
// ============================================================

export interface DokployProject {
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface DokployEnvironment {
  environmentId: string;
  projectId: string;
  name: string;
  description?: string;
}

export interface DokployApplication {
  applicationId: string;
  name: string;
  appName?: string;
  description?: string;
  environmentId: string;
}

export interface DokployServiceInfo {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DokployProjectDetail extends DokployProject {
  env: Record<string, string>;
  services: DokployServiceInfo[];
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
    type: 'image' | 'github' | 'git' | 'docker';
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

export interface PostgresServiceConfig {
  serviceName: string;
  password: string;
  database?: string;
  user?: string;
  resources?: ResourceConfig;
}

export interface DockerContainer {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: string[];
  created: string;
}

export interface ServiceError {
  message: string;
  code?: string;
  timestamp: string;
}

export interface DokployConfig {
  id: string | null;
  apiUrl: string;
  apiKeyEncrypted?: string;
  apiKeyPlain?: string;
  active: boolean;
  lastConnectionTest?: string | null;
  connectionStatus?: string | null;
  source: 'db' | 'env';
}

// ============================================================
// Dokploy Service Class
// ============================================================

class DokployService {
  private config: DokployConfig | null = null;
  private configLoaded = false;

  /**
   * Load Dokploy configuration from database
   */
  private async loadConfig(): Promise<DokployConfig | null> {
    if (this.configLoaded) {
      return this.config;
    }

    try {
      const result = await query(
        'SELECT id, api_url, api_key_encrypted, active, last_connection_test, connection_status FROM dokploy_config WHERE active = true ORDER BY created_at DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        const envUrl = appConfig.DOKPLOY_API_URL?.trim();
        const envKey = appConfig.DOKPLOY_API_KEY?.trim();

        if (envUrl && envKey) {
          this.config = {
            id: null,
            apiUrl: envUrl,
            apiKeyPlain: envKey,
            active: true,
            lastConnectionTest: null,
            connectionStatus: 'env-config',
            source: 'env',
          };
        } else {
          this.config = null;
        }
      } else {
        const row = result.rows[0];
        this.config = {
          id: row.id,
          apiUrl: row.api_url,
          apiKeyEncrypted: row.api_key_encrypted,
          active: row.active,
          lastConnectionTest: row.last_connection_test,
          connectionStatus: row.connection_status,
          source: 'db',
        };
      }

      this.configLoaded = true;
      return this.config;
    } catch (error) {
      console.error('Error loading Dokploy configuration:', error);
      throw new ContainerServiceError(
        ERROR_CODES.CONFIG_NOT_FOUND,
        'Failed to load Dokploy configuration',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Normalize various Dokploy project payload shapes into a consistent structure
   */
  private normalizeProjectPayload(rawProject: any): DokployProject | null {
    if (!rawProject) {
      return null;
    }

    const source = typeof rawProject.project === 'object' && rawProject.project !== null
      ? rawProject.project
      : rawProject;

    if (!source || typeof source !== 'object') {
      return null;
    }

    const rawId = source.projectId ?? source.id ?? source._id ?? source.uuid ?? source.slug ?? null;
    const resolvedName = source.name ?? source.projectName ?? source.slug ?? (typeof rawId === 'string' ? rawId : null);

    if (!resolvedName) {
      return null;
    }

    const projectId = rawId ? String(rawId) : String(resolvedName);

    return {
      projectId,
      name: String(resolvedName),
      description: source.description ?? '',
      createdAt: source.createdAt ?? source.created_at ?? new Date().toISOString(),
    };
  }

  /**
   * Extract an array of project payloads from flexible Dokploy responses
   */
  private extractProjectArray(payload: any): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.projects)) {
        return payload.projects;
      }

      if (Array.isArray(payload.data)) {
        return payload.data;
      }

      if (Array.isArray(payload.items)) {
        return payload.items;
      }
    }

    return [];
  }

  /**
   * Get decrypted API key
   */
  private async getApiKey(): Promise<string> {
    const config = await this.loadConfig();
    if (!config) {
      throw createConfigError('Dokploy not configured');
    }

    try {
      if (config.source === 'env') {
        if (!config.apiKeyPlain) {
          throw createConfigError('Dokploy API key missing in environment configuration');
        }
        return config.apiKeyPlain;
      }

      if (!config.apiKeyEncrypted) {
        throw createConfigError('Dokploy API key not set');
      }

      return decryptSecret(config.apiKeyEncrypted);
    } catch (error) {
      console.error('Error decrypting Dokploy API key:', error);
      throw createConfigError('Failed to decrypt Dokploy API key', {
        originalError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get API base URL
   */
  private async getBaseUrl(): Promise<string> {
    const config = await this.loadConfig();
    if (!config) {
      throw createConfigError('Dokploy not configured');
    }

    return this.normalizeBaseUrl(config.apiUrl);
  }

  /**
   * Normalize Dokploy base URL
   */
  private normalizeBaseUrl(url: string): string {
    let baseUrl = url.trim();

    if (!baseUrl) {
      throw createConfigError('Dokploy API URL is required');
    }

    // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/+$/, '');

    // Remove trailing /api segment if provided
    baseUrl = baseUrl.replace(/\/api$/, '');

    return baseUrl;
  }

  /**
   * Resolve request context using stored or override configuration
   */
  private async resolveRequestContext(override?: { apiUrl: string; apiKey: string }): Promise<{ baseUrl: string; apiKey: string }> {
    if (override?.apiUrl && override?.apiKey) {
      return {
        baseUrl: this.normalizeBaseUrl(override.apiUrl),
        apiKey: override.apiKey.trim(),
      };
    }

    const baseUrl = await this.getBaseUrl();
    const apiKey = await this.getApiKey();

    return { baseUrl, apiKey };
  }

  /**
   * Make authenticated request to Dokploy API
   */
  private async makeRequest(endpoint: string, options: {
    method?: string;
    body?: any;
    queryParams?: Record<string, string>;
    overrideConfig?: { apiUrl: string; apiKey: string };
  } = {}): Promise<any> {
    const { method = 'POST', body, queryParams, overrideConfig } = options;

    const { baseUrl, apiKey } = await this.resolveRequestContext(overrideConfig);

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    };

    let url = `${baseUrl}/api/${endpoint}`;
    
    // Add query parameters if provided
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PUT/PATCH requests
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const errorMessage = `Dokploy API error: ${response.status} ${response.statusText} ${errorText}`;
        throw new Error(errorMessage);
      }

      const rawText = await response.text();

      if (!rawText) {
        return {};
      }

      try {
        return JSON.parse(rawText);
      } catch {
        return rawText;
      }
    } catch (error: any) {
      console.error(`Dokploy API request failed for ${endpoint}:`, error);
      
      // Transform and throw standardized error
      throw transformEasypanelError(error);
    }
  }

  // ============================================================
  // Authentication Methods
  // ============================================================

  /**
   * Test connection to Dokploy API
   */
  async testConnection(override?: { apiUrl: string; apiKey: string }): Promise<{ success: boolean; message?: string }> {
    try {
      // Use project.all as a simple test endpoint
      await this.makeRequest('project.all', { method: 'GET', overrideConfig: override });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dokploy connection test failed';
      console.error('Dokploy connection test failed:', error);
      return { success: false, message };
    }
  }

  // ============================================================
  // Project Management Methods
  // ============================================================

  /**
   * List all projects
   */
  async listProjects(): Promise<DokployProject[]> {
    try {
      const data = await this.makeRequest('project.all', { method: 'GET' });

      const projectPayloads = this.extractProjectArray(data);

      return projectPayloads
        .map((project: any) => this.normalizeProjectPayload(project))
        .filter((project): project is DokployProject => project !== null);
    } catch (error) {
      console.error('Error listing Dokploy projects:', error);
      throw error;
    }
  }

  /**
   * Get detailed project information
   */
  async inspectProject(projectId: string): Promise<DokployProjectDetail> {
    try {
      const data = await this.makeRequest('project.one', {
        method: 'GET',
        queryParams: { projectId }
      });

      const normalized = this.normalizeProjectPayload(data) ?? {
        projectId,
        name: typeof data === 'string' ? projectId : (data?.name ?? ''),
        description: typeof data === 'string' ? '' : (data?.description ?? ''),
        createdAt: (data?.createdAt ?? data?.created_at ?? new Date().toISOString()),
      };

      return {
        ...normalized,
        env: {}, // Dokploy handles env at application level
        services: [], // Services are applications in Dokploy
      };
    } catch (error) {
      console.error(`Error inspecting Dokploy project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(projectName: string, description?: string): Promise<DokployProject> {
    try {
      const data = await this.makeRequest('project.create', {
        body: { 
          name: projectName,
          description: description || ''
        }
      });

      const normalized = this.normalizeProjectPayload(data);

      if (normalized?.projectId) {
        return normalized;
      }

      // Fallback: attempt to locate the project by name
      try {
        const projects = await this.listProjects();
        const matchingProject = projects.find(project => project.name === projectName);

        if (matchingProject) {
          return matchingProject;
        }
      } catch (listError) {
        console.warn('Unable to verify Dokploy project after creation:', listError);
      }

      console.warn('Dokploy project created but response lacked project identifier. Using fallback identifier.', {
        projectName,
      });

      return {
        projectId: projectName,
        name: projectName,
        description: description || '',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error creating Dokploy project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async destroyProject(projectId: string): Promise<void> {
    try {
      await this.makeRequest('project.remove', {
        body: { projectId }
      });
    } catch (error) {
      console.error(`Error destroying Dokploy project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, updates: { name?: string; description?: string }): Promise<void> {
    try {
      await this.makeRequest('project.update', {
        body: { 
          projectId,
          ...updates
        }
      });
    } catch (error) {
      console.error(`Error updating Dokploy project ${projectId}:`, error);
      throw error;
    }
  }

  // ============================================================
  // Environment Management Methods
  // ============================================================

  /**
   * Create environment within a project
   */
  async createEnvironment(projectId: string, name: string, description?: string): Promise<DokployEnvironment> {
    try {
      const data = await this.makeRequest('environment.create', {
        body: { 
          projectId,
          name,
          description: description || ''
        }
      });

      return {
        environmentId: data.environmentId || '',
        projectId: data.projectId || projectId,
        name: data.name || name,
        description: data.description || '',
      };
    } catch (error) {
      console.error(`Error creating Dokploy environment ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get environments for a project
   */
  async getProjectEnvironments(projectId: string): Promise<DokployEnvironment[]> {
    try {
      const data = await this.makeRequest('environment.byProjectId', {
        method: 'GET',
        queryParams: { projectId }
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((env: any) => ({
        environmentId: env.environmentId || '',
        projectId: env.projectId || projectId,
        name: env.name || '',
        description: env.description || '',
      }));
    } catch (error) {
      console.error(`Error getting environments for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure a default environment exists for the project
   */
  async ensureDefaultEnvironment(projectId: string, name: string = 'production'): Promise<DokployEnvironment> {
    const environments = await this.getProjectEnvironments(projectId);

    if (environments.length > 0) {
      return environments[0];
    }

    return this.createEnvironment(projectId, name, `${name} environment`);
  }

  // ============================================================
  // Application Management Methods
  // ============================================================

  /**
   * Create an application service
   */
  async createApplication(environmentId: string, config: AppServiceConfig): Promise<DokployApplication> {
    try {
      const data = await this.makeRequest('application.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          description: '',
          environmentId,
          serverId: null // Use default server
        }
      });

      return {
        applicationId: data.applicationId || '',
        name: data.name || config.serviceName,
        appName: data.appName || config.serviceName,
        description: data.description || '',
        environmentId: data.environmentId || environmentId,
      };
    } catch (error) {
      console.error(`Error creating application ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Configure docker image/provider for an application
   */
  async configureDockerProvider(applicationId: string, options: { image: string; username?: string; password?: string; registryUrl?: string }): Promise<void> {
    try {
      await this.makeRequest('application.saveDockerProvider', {
        body: {
          applicationId,
          dockerImage: options.image,
          username: options.username || null,
          password: options.password || null,
          registryUrl: options.registryUrl || null,
        }
      });
    } catch (error) {
      console.error(`Error configuring docker provider for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Persist environment variables for an application
   */
  async saveApplicationEnvironment(applicationId: string, env: Record<string, string> | string, options?: { buildArgs?: Record<string, string>; buildSecrets?: Record<string, string> }): Promise<void> {
    const envString = typeof env === 'string'
      ? env
      : Object.entries(env)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

    try {
      await this.makeRequest('application.saveEnvironment', {
        body: {
          applicationId,
          env: envString || null,
          buildArgs: options?.buildArgs
            ? Object.entries(options.buildArgs).map(([k, v]) => `${k}=${v}`).join('\n')
            : null,
          buildSecrets: options?.buildSecrets
            ? Object.entries(options.buildSecrets).map(([k, v]) => `${k}=${v}`).join('\n')
            : null,
        }
      });
    } catch (error) {
      console.error(`Error saving environment for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update application resources (CPU/Memory) and metadata
   */
  async updateApplicationSettings(applicationId: string, options: {
    name: string;
    appName?: string;
    description?: string;
    cpuLimit?: number | string;
    cpuReservation?: number | string;
    memoryLimit?: number | string;
    memoryReservation?: number | string;
  }): Promise<void> {
    const payload: Record<string, any> = {
      applicationId,
      name: options.name,
      appName: options.appName || options.name,
      description: options.description || null,
    };

    if (options.cpuLimit !== undefined) {
      payload.cpuLimit = String(options.cpuLimit);
    }

    if (options.cpuReservation !== undefined) {
      payload.cpuReservation = String(options.cpuReservation);
    }

    if (options.memoryLimit !== undefined) {
      payload.memoryLimit = String(options.memoryLimit);
    }

    if (options.memoryReservation !== undefined) {
      payload.memoryReservation = String(options.memoryReservation);
    }

    try {
      await this.makeRequest('application.update', {
        body: payload,
      });
    } catch (error) {
      console.error(`Error updating application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Create a mount for an application
   */
  async createApplicationMount(applicationId: string, mount: {
    type: 'bind' | 'volume' | 'file';
    mountPath: string;
    volumeName?: string;
    hostPath?: string;
    content?: string;
    filePath?: string;
  }): Promise<void> {
    try {
      await this.makeRequest('mounts.create', {
        body: {
          type: mount.type,
          mountPath: mount.mountPath,
          volumeName: mount.volumeName || null,
          hostPath: mount.hostPath || null,
          content: mount.content || null,
          filePath: mount.filePath || null,
          serviceId: applicationId,
          serviceType: 'application',
        }
      });
    } catch (error) {
      console.error(`Error creating mount for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Create a MariaDB service
   */
  async createMariadbService(environmentId: string, config: {
    serviceName: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
    rootPassword: string;
    dockerImage?: string;
    description?: string;
  }): Promise<{ serviceId: string }> {
    try {
      const data = await this.makeRequest('mariadb.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          databaseRootPassword: config.rootPassword,
          environmentId,
          databaseName: config.databaseName,
          databaseUser: config.databaseUser,
          databasePassword: config.databasePassword,
          dockerImage: config.dockerImage || null,
          description: config.description || null,
          serverId: null,
        }
      });

      const serviceId = data?.mariadbId || data?.serviceId || data?.id || config.serviceName;
      return { serviceId: String(serviceId) };
    } catch (error) {
      console.error(`Error creating MariaDB service ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Create a MySQL service
   */
  async createMysqlService(environmentId: string, config: {
    serviceName: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
    rootPassword: string;
    dockerImage?: string;
    description?: string;
  }): Promise<{ serviceId: string }> {
    try {
      const data = await this.makeRequest('mysql.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          environmentId,
          databaseName: config.databaseName,
          databaseUser: config.databaseUser,
          databasePassword: config.databasePassword,
          databaseRootPassword: config.rootPassword,
          dockerImage: config.dockerImage || null,
          description: config.description || null,
          serverId: null,
        }
      });

      const serviceId = data?.mysqlId || data?.serviceId || data?.id || config.serviceName;
      return { serviceId: String(serviceId) };
    } catch (error) {
      console.error(`Error creating MySQL service ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Create a Postgres service
   */
  async createPostgresService(environmentId: string, config: {
    serviceName: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
    dockerImage?: string;
    description?: string;
  }): Promise<{ serviceId: string }> {
    try {
      const data = await this.makeRequest('postgres.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          databaseName: config.databaseName,
          databaseUser: config.databaseUser,
          databasePassword: config.databasePassword,
          dockerImage: config.dockerImage || null,
          environmentId,
          description: config.description || null,
          serverId: null,
        }
      });

      const serviceId = data?.postgresId || data?.serviceId || data?.id || config.serviceName;
      return { serviceId: String(serviceId) };
    } catch (error) {
      console.error(`Error creating Postgres service ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Create a Mongo service
   */
  async createMongoService(environmentId: string, config: {
    serviceName: string;
    password: string;
    database?: string;
    user?: string;
    dockerImage?: string;
    description?: string;
  }): Promise<{ serviceId: string }> {
    try {
      const data = await this.makeRequest('mongo.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          password: config.password,
          database: config.database || config.serviceName,
          user: config.user || 'mongo',
          environmentId,
          dockerImage: config.dockerImage || null,
          description: config.description || null,
          serverId: null,
        }
      });

      const serviceId = data?.mongoId || data?.serviceId || data?.id || config.serviceName;
      return { serviceId: String(serviceId) };
    } catch (error) {
      console.error(`Error creating Mongo service ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Create a Redis service
   */
  async createRedisService(environmentId: string, config: {
    serviceName: string;
    password?: string;
    dockerImage?: string;
    description?: string;
  }): Promise<{ serviceId: string }> {
    try {
      const data = await this.makeRequest('redis.create', {
        body: {
          name: config.serviceName,
          appName: config.serviceName,
          password: config.password || '',
          environmentId,
          dockerImage: config.dockerImage || null,
          description: config.description || null,
          serverId: null,
        }
      });

      const serviceId = data?.redisId || data?.serviceId || data?.id || config.serviceName;
      return { serviceId: String(serviceId) };
    } catch (error) {
      console.error(`Error creating Redis service ${config.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get application details
   */
  async inspectApplication(applicationId: string): Promise<AppServiceDetail> {
    try {
      const data = await this.makeRequest('application.one', {
        method: 'GET',
        queryParams: { applicationId }
      });

      return {
        name: data.name || '',
        type: 'application',
        status: data.applicationStatus || 'unknown',
        env: {}, // Extract from data if available
        resources: {},
        configuration: data,
      };
    } catch (error) {
      console.error(`Error inspecting application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy an application
   */
  async deployApplication(applicationId: string): Promise<void> {
    try {
      await this.makeRequest('application.redeploy', {
        body: { 
          applicationId,
          title: 'Manual deployment',
          description: 'Deployed via SkyPanel'
        }
      });
    } catch (error) {
      console.error(`Error deploying application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Start an application
   */
  async startApplication(applicationId: string): Promise<void> {
    try {
      await this.makeRequest('application.start', {
        body: { applicationId }
      });
    } catch (error) {
      console.error(`Error starting application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Stop an application
   */
  async stopApplication(applicationId: string): Promise<void> {
    try {
      await this.makeRequest('application.stop', {
        body: { applicationId }
      });
    } catch (error) {
      console.error(`Error stopping application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an application
   */
  async destroyApplication(applicationId: string): Promise<void> {
    try {
      await this.makeRequest('application.delete', {
        body: { applicationId }
      });
    } catch (error) {
      console.error(`Error destroying application ${applicationId}:`, error);
      throw error;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Reset configuration cache (useful after config updates)
   */
  resetConfigCache(): void {
    this.configLoaded = false;
    this.config = null;
  }

  /**
   * Check if Dokploy is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      return config !== null;
    } catch {
      return false;
    }
  }

  /**
   * Expose the active configuration without sensitive fields
   */
  async getConfigSummary(): Promise<{
    apiUrl: string;
    hasApiKey: boolean;
    lastConnectionTest: string | null;
    connectionStatus: string | null;
    source: 'db' | 'env';
  } | null> {
    const config = await this.loadConfig();

    if (!config) {
      return null;
    }

    return {
      apiUrl: config.apiUrl,
      hasApiKey: config.source === 'env'
        ? Boolean(config.apiKeyPlain)
        : Boolean(config.apiKeyEncrypted),
      lastConnectionTest: config.lastConnectionTest ?? null,
      connectionStatus: config.connectionStatus ?? (config.source === 'env' ? 'env-config' : null),
      source: config.source,
    };
  }

  /**
   * Get the full active configuration for internal use
   */
  async getActiveConfig(): Promise<Readonly<DokployConfig> | null> {
    const config = await this.loadConfig();
    return config ? { ...config } : null;
  }
}

export { DokployService };
export const dokployService = new DokployService();
