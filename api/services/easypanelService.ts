/**
 * Easypanel API Service for SkyPanelV2
 * Handles integration with Easypanel API for container management
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

export interface EasypanelUser {
  id: string;
  email: string;
  name: string;
}

export interface EasypanelProject {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface EasypanelServiceInfo {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EasypanelProjectWithServices extends EasypanelProject {
  services: EasypanelServiceInfo[];
}

export interface EasypanelProjectDetail extends EasypanelProject {
  env: Record<string, string>;
  services: EasypanelServiceInfo[];
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
    type: 'image' | 'github' | 'git' | 'upload' | 'dockerfile';
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
  cpuLimit?: number;
  memoryLimit?: number;
  memoryReservation?: number;
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

export interface MysqlServiceConfig {
  serviceName: string;
  password: string;
  database?: string;
  user?: string;
  resources?: ResourceConfig;
}

export interface MariadbServiceConfig {
  serviceName: string;
  password: string;
  database?: string;
  user?: string;
  resources?: ResourceConfig;
}

export interface MongoServiceConfig {
  serviceName: string;
  password: string;
  database?: string;
  user?: string;
  resources?: ResourceConfig;
}

export interface RedisServiceConfig {
  serviceName: string;
  password?: string;
  resources?: ResourceConfig;
}

export interface TemplateSchema {
  services: TemplateService[];
}

export interface TemplateService {
  name: string;
  type: string;
  configuration: Record<string, any>;
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

export interface EasypanelConfig {
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
// Easypanel Service Class
// ============================================================

class EasypanelService {
  private config: EasypanelConfig | null = null;
  private configLoaded = false;

  /**
   * Load Easypanel configuration from database
   */
  private async loadConfig(): Promise<EasypanelConfig | null> {
    if (this.configLoaded) {
      return this.config;
    }

    try {
      const result = await query(
        'SELECT id, api_url, api_key_encrypted, active, last_connection_test, connection_status FROM easypanel_config WHERE active = true ORDER BY created_at DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        const envUrl = appConfig.EASYPANEL_API_URL?.trim();
        const envKey = appConfig.EASYPANEL_API_KEY?.trim();

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
      console.error('Error loading Easypanel configuration:', error);
      throw new ContainerServiceError(
        ERROR_CODES.CONFIG_NOT_FOUND,
        'Failed to load Easypanel configuration',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get decrypted API key
   */
  private async getApiKey(): Promise<string> {
    const config = await this.loadConfig();
    if (!config) {
      throw createConfigError('Easypanel not configured');
    }

    try {
      if (config.source === 'env') {
        if (!config.apiKeyPlain) {
          throw createConfigError('Easypanel API key missing in environment configuration');
        }
        return config.apiKeyPlain;
      }

      if (!config.apiKeyEncrypted) {
        throw createConfigError('Easypanel API key not set');
      }

      return decryptSecret(config.apiKeyEncrypted);
    } catch (error) {
      console.error('Error decrypting Easypanel API key:', error);
      throw createConfigError('Failed to decrypt Easypanel API key', {
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
      throw createConfigError('Easypanel not configured');
    }

    // Remove trailing slashes and ensure we have the base URL
    let baseUrl = config.apiUrl.replace(/\/+$/, '');
    
    // Remove /api/trpc if it's already in the URL
    baseUrl = baseUrl.replace(/\/api\/trpc$/, '');
    
    return baseUrl;
  }

  /**
   * Make authenticated request to Easypanel API
   */
  private async makeRequest(endpoint: string, options: {
    method?: string;
    body?: any;
  } = {}): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const apiKey = await this.getApiKey();

    const { method = 'POST', body } = options;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    let url = `${baseUrl}/api/trpc/${endpoint}`;
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // For GET requests with parameters, add to query string
    if (method === 'GET' && body) {
      const params = new URLSearchParams();
      params.append('input', JSON.stringify({ json: body }));
      url += `?${params.toString()}`;
    }
    // For POST requests, wrap body in json property
    else if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify({ json: body });
    }

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const errorMessage = `Easypanel API error: ${response.status} ${response.statusText} ${errorText}`;
        throw new Error(errorMessage);
      }

  const data = await response.json();
      
  // tRPC responses from Easypanel are typically nested like:
  // { result: { data: { json: <payload> } } }
  // Prefer the inner json payload when present, fall back progressively.
  const unwrapped = data?.result?.data?.json ?? data?.result?.data ?? data;
  return unwrapped;
    } catch (error: any) {
      console.error(`Easypanel API request failed for ${endpoint}:`, error);
      
      // Transform and throw standardized error
      throw transformEasypanelError(error);
    }
  }

  // ============================================================
  // Authentication Methods
  // ============================================================

  /**
   * Test connection to Easypanel API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use listProjects as a simple test endpoint
      await this.makeRequest('projects.listProjects', { method: 'GET' });
      return true;
    } catch (error) {
      console.error('Easypanel connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current user information (deprecated - not available in Easypanel API)
   */
  async getUser(): Promise<EasypanelUser> {
    // This endpoint doesn't exist in Easypanel API
    // Return a placeholder for compatibility
    return {
      id: 'easypanel-user',
      email: 'admin@easypanel',
      name: 'Easypanel Admin',
    };
  }

  // ============================================================
  // Project Management Methods
  // ============================================================

  /**
   * List all projects
   */
  async listProjects(): Promise<EasypanelProject[]> {
    try {
      const data = await this.makeRequest('projects.listProjects', { method: 'GET' });
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((project: any) => ({
        name: project.name || '',
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error listing Easypanel projects:', error);
      throw error;
    }
  }

  /**
   * List projects with their services
   */
  async listProjectsAndServices(): Promise<EasypanelProjectWithServices[]> {
    try {
      const data = await this.makeRequest('projects.listProjectsAndServices', { method: 'GET' });
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((project: any) => ({
        name: project.name || '',
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
        services: Array.isArray(project.services) ? project.services.map((service: any) => ({
          name: service.name || '',
          type: service.type || '',
          status: service.status || 'unknown',
          createdAt: service.createdAt || new Date().toISOString(),
          updatedAt: service.updatedAt || new Date().toISOString(),
        })) : [],
      }));
    } catch (error) {
      console.error('Error listing Easypanel projects and services:', error);
      throw error;
    }
  }

  /**
   * Get detailed project information
   */
  async inspectProject(projectName: string): Promise<EasypanelProjectDetail> {
    try {
      const data = await this.makeRequest('projects.inspectProject', {
        method: 'GET',
        body: { projectName }
      });

      return {
        name: data.name || projectName,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        env: data.env || {},
        services: Array.isArray(data.services) ? data.services.map((service: any) => ({
          name: service.name || '',
          type: service.type || '',
          status: service.status || 'unknown',
          createdAt: service.createdAt || new Date().toISOString(),
          updatedAt: service.updatedAt || new Date().toISOString(),
        })) : [],
      };
    } catch (error) {
      console.error(`Error inspecting Easypanel project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(projectName: string): Promise<EasypanelProject> {
    try {
      const data = await this.makeRequest('projects.createProject', {
        body: { name: projectName }
      });

      return {
        name: data.name || projectName,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error creating Easypanel project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async destroyProject(projectName: string): Promise<void> {
    try {
      await this.makeRequest('projects.destroyProject', {
        body: { name: projectName }
      });
    } catch (error) {
      console.error(`Error destroying Easypanel project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Update project environment variables
   */
  async updateProjectEnv(projectName: string, env: Record<string, string>): Promise<void> {
    try {
      await this.makeRequest('projects.updateProjectEnv', {
        body: { 
          projectName: projectName,
          env: JSON.stringify(env)
        }
      });
    } catch (error) {
      console.error(`Error updating Easypanel project ${projectName} environment:`, error);
      throw error;
    }
  }

  /**
   * Update project access for a user
   */
  async updateProjectAccess(projectName: string, userId: string, active: boolean): Promise<void> {
    try {
      await this.makeRequest('projects.updateAccess', {
        body: { 
          projectName,
          userId,
          active
        }
      });
    } catch (error) {
      console.error(`Error updating access for user ${userId} on project ${projectName}:`, error);
      throw error;
    }
  }

  // ============================================================
  // User Management Methods
  // ============================================================

  /**
   * Create a new Easypanel user
   */
  async createUser(email: string, password: string, admin: boolean = false): Promise<{ id: string; email: string }> {
    try {
      const data = await this.makeRequest('users.createUser', {
        body: { 
          email,
          password,
          admin
        }
      });

      // Ensure we have a stable user id. Some Easypanel versions may not
      // return the id in the create response. If missing, fetch from list.
      let id = data?.id as string | undefined;
      const resolvedEmail = (data?.email as string) || email;

      if (!id) {
        try {
          const existing = await this.findUserByEmail(resolvedEmail);
          if (existing?.id) id = existing.id;
        } catch {
          // ignore secondary error, we will fall back to email as id
        }
      }

      return {
        id: id || resolvedEmail,
        email: resolvedEmail
      };
    } catch (error) {
      console.error(`Error creating Easypanel user ${email}:`, error);
      throw error;
    }
  }

  /**
   * List all Easypanel users
   */
  async listUsers(): Promise<Array<{ id: string; email: string; admin: boolean }>> {
    try {
      const data = await this.makeRequest('users.listUsers', {
        method: 'GET'
      });
      // Easypanel returns { users: [...], meta: {...} }
      const users = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.users)
          ? (data as any).users
          : [];

      if (!Array.isArray(users)) return [];

      return users.map((user: any) => ({
        id: user.id || user.email,
        email: user.email || '',
        admin: user.admin || false
      }));
    } catch (error) {
      console.error('Error listing Easypanel users:', error);
      throw error;
    }
  }

  /**
   * Find an Easypanel user by email
   */
  async findUserByEmail(email: string): Promise<{ id: string; email: string; admin: boolean } | null> {
    try {
      const users = await this.listUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      return user || null;
    } catch (error) {
      console.error(`Error finding Easypanel user by email ${email}:`, error);
      throw error;
    }
  }

  // ============================================================
  // App Service Management Methods
  // ============================================================

  /**
   * Create an app service
   */
  async createAppService(projectName: string, config: AppServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.app.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          source: config.source,
          env: config.env || {},
          domains: config.domains || [],
          mounts: config.mounts || [],
          deploy: config.deploy || {},
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating app service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed app service information
   */
  async inspectAppService(projectName: string, serviceName: string): Promise<AppServiceDetail> {
    try {
      const data = await this.makeRequest('services.app.inspectService', {
        method: 'GET',
        body: { 
          projectName,
          serviceName 
        }
      });

      return {
        name: data.name || serviceName,
        type: data.type || 'app',
        status: data.status || 'unknown',
        env: data.env || {},
        resources: data.resources || {},
        configuration: data.configuration || {},
      };
    } catch (error) {
      console.error(`Error inspecting app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Deploy an app service
   */
  async deployAppService(projectName: string, serviceName: string): Promise<void> {
    try {
      await this.makeRequest('services.app.deployService', {
        body: { 
          projectName,
          serviceName 
        }
      });
    } catch (error) {
      console.error(`Error deploying app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Start an app service
   */
  async startAppService(projectName: string, serviceName: string): Promise<void> {
    try {
      await this.makeRequest('services.app.startService', {
        body: { 
          projectName,
          serviceName 
        }
      });
    } catch (error) {
      console.error(`Error starting app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Stop an app service
   */
  async stopAppService(projectName: string, serviceName: string): Promise<void> {
    try {
      await this.makeRequest('services.app.stopService', {
        body: { 
          projectName,
          serviceName 
        }
      });
    } catch (error) {
      console.error(`Error stopping app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Restart an app service
   */
  async restartAppService(projectName: string, serviceName: string): Promise<void> {
    try {
      await this.makeRequest('services.app.restartService', {
        body: { 
          projectName,
          serviceName 
        }
      });
    } catch (error) {
      console.error(`Error restarting app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an app service
   */
  async destroyAppService(projectName: string, serviceName: string): Promise<void> {
    try {
      await this.makeRequest('services.app.destroyService', {
        body: { 
          projectName,
          serviceName 
        }
      });
    } catch (error) {
      console.error(`Error destroying app service ${serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Update app service environment variables
   */
  async updateAppEnv(projectName: string, serviceName: string, env: Record<string, string>): Promise<void> {
    try {
      await this.makeRequest('services.app.updateEnv', {
        body: { 
          projectName,
          serviceName,
          env
        }
      });
    } catch (error) {
      console.error(`Error updating app service ${serviceName} environment in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Update app service resource limits
   */
  async updateAppResources(projectName: string, serviceName: string, resources: ResourceConfig): Promise<void> {
    try {
      await this.makeRequest('services.app.updateResources', {
        body: { 
          projectName,
          serviceName,
          resources
        }
      });
    } catch (error) {
      console.error(`Error updating app service ${serviceName} resources in project ${projectName}:`, error);
      throw error;
    }
  }

  // ============================================================
  // Database Service Creation Methods
  // ============================================================

  /**
   * Create a PostgreSQL service
   */
  async createPostgresService(projectName: string, config: PostgresServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.postgres.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          password: config.password,
          database: config.database || 'postgres',
          user: config.user || 'postgres',
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating PostgreSQL service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Create a MySQL service
   */
  async createMysqlService(projectName: string, config: MysqlServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.mysql.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          password: config.password,
          database: config.database || 'mysql',
          user: config.user || 'mysql',
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating MySQL service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Create a MariaDB service
   */
  async createMariadbService(projectName: string, config: MariadbServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.mariadb.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          password: config.password,
          database: config.database || 'mariadb',
          user: config.user || 'mariadb',
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating MariaDB service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Create a MongoDB service
   */
  async createMongoService(projectName: string, config: MongoServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.mongo.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          password: config.password,
          database: config.database || 'mongo',
          user: config.user || 'mongo',
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating MongoDB service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Create a Redis service
   */
  async createRedisService(projectName: string, config: RedisServiceConfig): Promise<void> {
    try {
      await this.makeRequest('services.redis.createService', {
        body: {
          projectName,
          serviceName: config.serviceName,
          password: config.password || '',
          resources: config.resources || {},
        }
      });
    } catch (error) {
      console.error(`Error creating Redis service ${config.serviceName} in project ${projectName}:`, error);
      throw error;
    }
  }

  // ============================================================
  // Template and Monitoring Methods
  // ============================================================

  /**
   * Create service from template
   */
  async createFromTemplate(projectName: string, templateName: string, schema: TemplateSchema): Promise<void> {
    try {
      // Generate random password for database services
      const randomPassword = this.generateRandomPassword();

      // Transform our schema format to Easypanel's expected format
      // Our format: { services: [{ name, type, configuration }] }
      // Easypanel format: { services: [{ type, data: { serviceName, ... } }] }
      const transformedSchema = {
        services: schema.services.map(service => {
          const config = { ...service.configuration };
          
          // Replace password placeholders
          if (config.password && typeof config.password === 'string') {
            config.password = config.password.replace(/\{\{RANDOM_PASSWORD\}\}/g, randomPassword);
          }
          
          // Replace environment variable placeholders
          if (config.env && typeof config.env === 'string') {
            config.env = config.env.replace(/\{\{RANDOM_PASSWORD\}\}/g, randomPassword);
          }
          
          return {
            type: service.type,
            data: {
              serviceName: service.name,
              ...config
            }
          };
        })
      };

      console.log('Deploying template to Easypanel:', {
        projectName,
        templateName,
        transformedSchema: JSON.stringify(transformedSchema, null, 2)
      });

      await this.makeRequest('templates.createFromSchema', {
        body: {
          name: templateName,
          projectName,
          schema: transformedSchema
        }
      });
    } catch (error) {
      console.error(`Error creating service from template ${templateName} in project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Generate a random password for database services
   */
  private generateRandomPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Get Docker containers for monitoring
   */
  async getDockerContainers(serviceName: string): Promise<DockerContainer[]> {
    try {
      const data = await this.makeRequest('projects.getDockerContainers', {
        method: 'GET',
        body: { service: serviceName }
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((container: any) => ({
        id: container.id || '',
        name: container.name || '',
        status: container.status || 'unknown',
        image: container.image || '',
        ports: Array.isArray(container.ports) ? container.ports : [],
        created: container.created || new Date().toISOString(),
      }));
    } catch (error) {
      console.error(`Error getting Docker containers for service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get service error information
   */
  async getServiceError(projectName: string, serviceName: string): Promise<ServiceError | null> {
    try {
      const data = await this.makeRequest('services.common.getServiceError', {
        method: 'GET',
        body: { 
          projectName,
          serviceName 
        }
      });

      if (!data || !data.message) {
        return null;
      }

      return {
        message: data.message,
        code: data.code || undefined,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error getting service error for ${serviceName} in project ${projectName}:`, error);
      // Return null instead of throwing, as this is used for monitoring
      return null;
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
   * Check if Easypanel is configured
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
  async getActiveConfig(): Promise<Readonly<EasypanelConfig> | null> {
    const config = await this.loadConfig();
    return config ? { ...config } : null;
  }
}

export { EasypanelService };
export const easypanelService = new EasypanelService();