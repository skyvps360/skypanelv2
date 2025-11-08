/**
 * SkyPanelV2 Worker Agent Entry Point
 */

import { WorkerAgent } from './worker.js';
import { validateConfig } from './config.js';
import logger from './logger.js';

async function main() {
  let agent: WorkerAgent | null = null;

  try {
    // Validate configuration
    validateConfig();

    // Create and start worker agent
    agent = new WorkerAgent();
    await agent.start();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      if (agent) {
        await agent.stop();
      }

      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Keep the process running
    logger.info('Worker agent is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Failed to start worker agent:', error);
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});