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

    // Remove trailing slashes
    let baseUrl = config.apiUrl.replace(/\/+$/, '');
    
    // Remove /api if it's already in the URL
    baseUrl = baseUrl.replace(/\/api$/, '');
    
    return baseUrl;
  }

  /**
   * Make authenticated request to Dokploy API
   */
  private async makeRequest(endpoint: string, options: {
    method?: string;
    body?: any;
    queryParams?: Record<string, string>;
  } = {}): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const apiKey = await this.getApiKey();

    const { method = 'POST', body, queryParams } = options;

    const headers: Record<string, string> = {
      'Authorization': apiKey,
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

      const data = await response.json();
      return data;
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
  async testConnection(): Promise<boolean> {
    try {
      // Use project.all as a simple test endpoint
      await this.makeRequest('project.all', { method: 'GET' });
      return true;
    } catch (error) {
      console.error('Dokploy connection test failed:', error);
      return false;
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
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((project: any) => ({
        projectId: project.projectId || '',
        name: project.name || '',
        description: project.description || '',
        createdAt: project.createdAt || new Date().toISOString(),
      }));
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

      return {
        projectId: data.projectId || projectId,
        name: data.name || '',
        description: data.description || '',
        createdAt: data.createdAt || new Date().toISOString(),
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

      return {
        projectId: data.projectId || '',
        name: data.name || projectName,
        description: data.description || '',
        createdAt: data.createdAt || new Date().toISOString(),
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
