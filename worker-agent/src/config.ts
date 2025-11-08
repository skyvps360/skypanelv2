/**
 * Worker Agent Configuration
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface WorkerConfig {
  // SkyPanel connection
  skypanelUrl: string;
  nodeId?: string;
  authToken?: string;

  // Worker identification
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;

  // Build configuration
  workspaceDir: string;
  maxConcurrentBuilds: number;
  buildTimeoutMinutes: number;
  cleanupIntervalMinutes: number;

  // Docker configuration
  dockerHost?: string;
  dockerPort?: number;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const baseConfig: Omit<WorkerConfig, 'nodeId' | 'authToken' | 'dockerHost' | 'dockerPort'> = {
  skypanelUrl: process.env.SKYPANEL_URL || 'http://localhost:3001',

  name: process.env.WORKER_NAME || `worker-${process.env.HOSTNAME || 'unknown'}`,
  hostname: process.env.WORKER_HOSTNAME || require('os').hostname(),
  ipAddress: process.env.WORKER_IP_ADDRESS || '127.0.0.1',
  port: parseInt(process.env.WORKER_PORT || '3001'),

  workspaceDir: process.env.WORKSPACE_DIR || '/tmp/skypanel-builds',
  maxConcurrentBuilds: parseInt(process.env.MAX_CONCURRENT_BUILDS || '3'),
  buildTimeoutMinutes: parseInt(process.env.BUILD_TIMEOUT_MINUTES || '15'),
  cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '30'),

  logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
};

// Add optional properties only if they exist
export const config: WorkerConfig = baseConfig;

if (process.env.WORKER_NODE_ID) {
  config.nodeId = process.env.WORKER_NODE_ID;
}

if (process.env.WORKER_AUTH_TOKEN) {
  config.authToken = process.env.WORKER_AUTH_TOKEN;
}

if (process.env.DOCKER_HOST) {
  config.dockerHost = process.env.DOCKER_HOST;
}

if (process.env.DOCKER_PORT) {
  config.dockerPort = parseInt(process.env.DOCKER_PORT);
}

// Validate required configuration
export function validateConfig(): void {
  const required = ['skypanelUrl', 'name', 'hostname', 'ipAddress'];
  const missing = required.filter(key => !config[key as keyof WorkerConfig]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  // Validate port numbers
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port number: ${config.port}`);
  }

  if (config.maxConcurrentBuilds < 1 || config.maxConcurrentBuilds > 10) {
    throw new Error(`Invalid maxConcurrentBuilds: must be between 1 and 10`);
  }

  if (config.buildTimeoutMinutes < 1 || config.buildTimeoutMinutes > 120) {
    throw new Error(`Invalid buildTimeoutMinutes: must be between 1 and 120`);
  }
}

export default config;