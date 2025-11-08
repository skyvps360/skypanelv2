/**
 * SkyPanel API Client for Worker Agent
 */

import axios, { AxiosInstance } from 'axios';
import logger from './logger.js';

export interface BuildStatusUpdate {
  deploymentId: string;
  status: 'building_success' | 'building_failed' | 'deploying' | 'deployed' | 'deployment_failed';
  logs?: string;
  errorMessage?: string;
  result?: Record<string, any>;
}

export interface WorkerRegistration {
  name: string;
  hostname: string;
  ipAddress: string;
  port?: number;
  capabilities?: Record<string, any>;
  maxConcurrentBuilds?: number;
  resourceLimits?: Record<string, any>;
  systemInfo?: Record<string, any>;
}

export interface QueuedBuild {
  deploymentId: string;
  appId: string;
  version: string;
  appName: string;
  organizationId: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  dockerfilePath?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
  metadata?: Record<string, any>;
}

export class SkyPanelClient {
  private axios: AxiosInstance;
  private nodeId?: string;
  private authToken?: string;

  constructor(baseUrl: string) {
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SkyPanel-Worker-Agent/1.0.0'
      }
    });

    // Add request interceptor for debugging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`API Response Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Register worker node with SkyPanel
   */
  async registerWorker(registration: WorkerRegistration): Promise<{ nodeId: string; authToken: string }> {
    try {
      logger.info(`Registering worker node: ${registration.name}`);

      // Get system information
      const systemInfo = await this.getSystemInfo();
      registration.systemInfo = systemInfo;

      const response = await this.axios.post('/api/paas/worker/register', registration);
      const payload = response.data?.data || response.data || {};
      const nodeId = payload.nodeId;
      const authToken = payload.authToken;

      if (!nodeId || !authToken) {
        throw new Error('Worker registration response missing credentials');
      }

      this.nodeId = nodeId;
      this.authToken = authToken;

      // Set authorization header for future requests
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;

      logger.info(`Worker registered successfully: ${nodeId}`);
      return { nodeId, authToken };

    } catch (error) {
      logger.error('Failed to register worker:', error);
      throw new Error(`Worker registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send heartbeat to SkyPanel
   */
  async sendHeartbeat(systemInfo?: Record<string, any>): Promise<void> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      const heartbeatData = {
        nodeId: this.nodeId,
        timestamp: new Date().toISOString(),
        ...systemInfo
      };

      await this.axios.post('/api/paas/worker/heartbeat', heartbeatData);
      logger.debug('Heartbeat sent successfully');

    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
      throw error;
    }
  }

  /**
   * Get queued builds
   */
  async getQueuedBuilds(): Promise<QueuedBuild[]> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      const response = await this.axios.get('/api/paas/worker/builds/queued');
      return response.data.builds || [];

    } catch (error) {
      logger.error('Failed to get queued builds:', error);
      throw error;
    }
  }

  /**
   * Accept a build job
   */
  async acceptBuild(deploymentId: string): Promise<void> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      await this.axios.post(`/api/paas/worker/builds/${deploymentId}/accept`, {
        nodeId: this.nodeId
      });

      logger.info(`Accepted build job: ${deploymentId}`);

    } catch (error) {
      logger.error(`Failed to accept build ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Update build status
   */
  async updateBuildStatus(
    deploymentId: string,
    status: BuildStatusUpdate['status'],
    logs?: string,
    errorMessage?: string,
    result?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      const updateData: any = {
        nodeId: this.nodeId,
        status,
        logs,
        errorMessage,
        result
      };

      await this.axios.post(`/api/paas/worker/builds/${deploymentId}/status`, updateData);

      logger.debug(`Updated build status for ${deploymentId}: ${status}`);

    } catch (error) {
      logger.error(`Failed to update build status for ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Add build log entry
   */
  async addBuildLog(
    deploymentId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      await this.axios.post(`/api/paas/worker/builds/${deploymentId}/logs`, {
        nodeId: this.nodeId,
        level,
        message,
        timestamp: new Date().toISOString(),
        metadata
      });

    } catch (error) {
      logger.error(`Failed to add build log for ${deploymentId}:`, error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<Record<string, any>> {
    try {
      const os = await import('os');
      const process = await import('process');

      return {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        loadAverage: os.loadavg(),
        hostname: os.hostname(),
        networkInterfaces: os.networkInterfaces()
      };

    } catch (error) {
      logger.error('Failed to get system info:', error);
      return {};
    }
  }

  /**
   * Test connection to SkyPanel
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.axios.get('/api/health');
      return response.status === 200;
    } catch (error) {
      logger.error('Failed to connect to SkyPanel:', error);
      return false;
    }
  }

  /**
   * Get worker status
   */
  async getWorkerStatus(): Promise<any> {
    try {
      if (!this.nodeId) {
        throw new Error('Worker not registered');
      }

      const response = await this.axios.get(`/api/paas/worker/${this.nodeId}/status`);
      return response.data;

    } catch (error) {
      logger.error('Failed to get worker status:', error);
      throw error;
    }
  }
}
