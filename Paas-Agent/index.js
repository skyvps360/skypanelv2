import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './src/logger.js';
import { registerNode } from './src/connection.js';
import { startHeartbeat } from './src/heartbeat.js';
import { startTaskPolling } from './src/executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, 'config.json');

async function main() {
  logger.info('🚀 SkyPanel PaaS Agent starting...');

  // Load or create config
  let config;
  if (existsSync(CONFIG_PATH)) {
    const configData = readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(configData);
    logger.info('✅ Configuration loaded');
  } else {
    // Create default config
    config = {
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://localhost:3001',
      registrationToken: process.env.REGISTRATION_TOKEN || null,
      nodeId: null,
      jwtSecret: null,
      region: process.env.PAAS_REGION || 'local',
      nodeName: process.env.PAAS_NODE_NAME || 'local-worker-1',
      maxContainers: parseInt(process.env.MAX_CONTAINERS || '50'),
      maxCpuPercent: parseInt(process.env.MAX_CPU_PERCENT || '90'),
      maxMemoryPercent: parseInt(process.env.MAX_MEMORY_PERCENT || '90'),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
      taskPollInterval: parseInt(process.env.TASK_POLL_INTERVAL || '10000'),
      logLevel: process.env.LOG_LEVEL || 'info',
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    logger.warn('⚠️  No config file found. Created default config.json');
  }

  // Validate required config
  if (!config.controlPlaneUrl) {
    logger.error('❌ CONTROL_PLANE_URL is required');
    process.exit(1);
  }

  // Register with control plane if not already registered
  if (!config.nodeId || !config.jwtSecret) {
    if (!config.registrationToken) {
      logger.error('❌ REGISTRATION_TOKEN is required for first-time setup');
      logger.info('💡 Get a registration token by creating a node in the admin panel');
      process.exit(1);
    }

    logger.info('📝 Registering with control plane...');
    try {
      const registration = await registerNode(config);
      config.nodeId = registration.nodeId;
      config.jwtSecret = registration.jwtSecret;
      config.registrationToken = null; // Clear one-time token
      
      // Save updated config
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      logger.info(`✅ Registered as Node #${config.nodeId}`);
    } catch (error) {
      logger.error('❌ Registration failed:', error.message);
      process.exit(1);
    }
  }

  logger.info(`📡 Control Plane: ${config.controlPlaneUrl}`);
  logger.info(`🏷️  Node ID: ${config.nodeId}`);
  logger.info(`🌍 Region: ${config.region}`);

  // Ensure workspace directory exists
  const workspaceDir = process.env.WORKSPACE_DIR || join(__dirname, 'workspaces');
  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
  }

  // Start heartbeat
  logger.info('💓 Starting heartbeat...');
  startHeartbeat(config);

  // Start task polling
  logger.info('📥 Starting task polling...');
  startTaskPolling(config);

  logger.info('✨ PaaS Agent is running!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the agent
main().catch(error => {
  logger.error('💥 Fatal error:', error);
  process.exit(1);
});
