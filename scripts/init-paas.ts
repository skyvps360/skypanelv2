#!/usr/bin/env tsx

/**
 * Initialize Docker Swarm and PaaS Infrastructure
 * This script initializes the Docker Swarm cluster and deploys core infrastructure services
 */

import { NodeManagerService } from '../api/services/paas/nodeManagerService.js';
import { PaasSettingsService } from '../api/services/paas/settingsService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeSwarm() {
  console.log('🚀 Initializing Docker Swarm for PaaS...\n');

  try {
    // 1. Initialize Swarm
    console.log('📦 Step 1: Initializing Docker Swarm...');
    const swarmConfig = await NodeManagerService.initializeSwarm();
    console.log(`✅ Swarm initialized successfully!`);
    console.log(`   Manager IP: ${swarmConfig.managerIp}`);
    console.log(`   Worker Token: ${swarmConfig.workerToken.substring(0, 20)}...`);
    console.log('');

    // 2. Deploy infrastructure stack
    console.log('📦 Step 2: Deploying infrastructure services (Loki, Grafana, Traefik)...');
    const dockerDir = path.join(__dirname, '../docker/paas');

    await execAsync(`docker-compose -f ${dockerDir}/docker-compose.yaml up -d`);
    console.log('✅ Infrastructure services deployed!');
    console.log('');

    // 3. Configure settings
    console.log('📦 Step 3: Configuring PaaS settings...');

    // Set Loki endpoint
    await PaasSettingsService.set('loki_endpoint', 'http://localhost:3100', {
      description: 'Grafana Loki endpoint URL',
      category: 'logging',
      skipValidation: true,
    });

    // Set default domain (user should update this)
    await PaasSettingsService.set('default_domain', 'apps.example.com', {
      description: 'Default domain for app subdomains',
      category: 'general',
    });

    // Set storage type (default to local)
    await PaasSettingsService.set('storage_type', 'local', {
      description: 'Storage backend: s3 or local',
      category: 'storage',
    });

    await PaasSettingsService.set('local_storage_path', '/var/paas/storage', {
      description: 'Local filesystem path for builds',
      category: 'storage',
    });

    console.log('✅ Settings configured!');
    console.log('');

    // 4. Print next steps
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 PaaS Infrastructure Initialized Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('1. Access Grafana for logs:');
    console.log('   URL: http://localhost:3001');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('');
    console.log('2. Access Traefik dashboard:');
    console.log('   URL: http://localhost:8080');
    console.log('');
    console.log('3. Configure PaaS settings in Admin Dashboard:');
    console.log('   - Set your default domain for apps');
    console.log('   - Configure S3 storage (optional)');
    console.log('   - Add worker nodes (optional)');
    console.log('');
    console.log('4. Create your first PaaS application:');
    console.log('   - Go to /paas in the client dashboard');
    console.log('   - Click "New Application"');
    console.log('   - Connect your Git repository');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error: any) {
    console.error('');
    console.error('❌ Failed to initialize PaaS infrastructure:');
    console.error(error.message);
    console.error('');
    console.error('Please check the logs above for details.');
    process.exit(1);
  }
}

// Run initialization
initializeSwarm();
