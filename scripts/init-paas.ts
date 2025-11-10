#!/usr/bin/env tsx

/**
 * Initialize Docker Swarm and deploy the SkyPanelV2 PaaS infrastructure stack.
 * - Initializes Swarm (idempotent)
 * - Renders Loki/Grafana config from current settings
 * - Deploys the docker stack (Traefik, Loki, Grafana, Prometheus, Promtail, cAdvisor)
 * - Waits for core services to report healthy
 */

import { NodeManagerService } from '../api/services/paas/nodeManagerService.js';
import { PaasSettingsService } from '../api/services/paas/settingsService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';
import crypto from 'crypto';
import http from 'http';
import https from 'https';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dockerDir = path.join(__dirname, '../docker/paas');
const generatedDir = path.join(dockerDir, 'generated');

interface DeployConfig {
  lokiRetentionDays: number;
  traefikEmail: string;
  grafanaAdminUser: string;
  grafanaAdminPassword: string;
}

async function main(): Promise<void> {
  console.log('\n🚀 SkyPanelV2 PaaS Infrastructure Initialization\n');

  await PaasSettingsService.initializeDefaults();
  await initializeSwarm();

  const config = await prepareDeployConfig();
  await renderConfigFiles(config);
  await deployInfrastructure(config);
  await verifyInfrastructure();
  printSummary(config);
}

async function initializeSwarm(): Promise<void> {
  console.log('🛠  Step 1: Ensuring Docker Swarm is initialized...');
  const swarmConfig = await NodeManagerService.initializeSwarm();
  console.log(`   • Manager IP    : ${swarmConfig.managerIp}`);
  console.log(`   • Worker Token  : ${swarmConfig.workerToken.substring(0, 12)}...`);
  console.log('');
}

async function prepareDeployConfig(): Promise<DeployConfig> {
  console.log('⚙️  Step 2: Preparing deployment configuration...');

  const [
    rawRetention,
    rawTraefikEmail,
    rawGrafanaUser,
    rawGrafanaPassword,
  ] = await Promise.all([
    PaasSettingsService.get('loki_retention_days'),
    PaasSettingsService.get('traefik_acme_email'),
    PaasSettingsService.get('grafana_admin_user'),
    PaasSettingsService.get('grafana_admin_password'),
  ]);

  const lokiRetentionDays = Number(rawRetention ?? 7) || 7;
  const traefikEmail = (rawTraefikEmail as string) || 'admin@example.com';
  const grafanaAdminUser = (rawGrafanaUser as string) || 'admin';

  let grafanaAdminPassword = (rawGrafanaPassword as string) || '';
  if (!grafanaAdminPassword) {
    grafanaAdminPassword = crypto.randomBytes(16).toString('base64url');
    await PaasSettingsService.set('grafana_admin_password', grafanaAdminPassword, {
      description: 'Grafana admin password (auto-generated)',
      category: 'monitoring',
      is_sensitive: true,
    });
    console.log(`   • Generated Grafana admin password: ${grafanaAdminPassword}`);
  }

  // Ensure Loki endpoint setting exists for downstream services
  await PaasSettingsService.set(
    'loki_endpoint',
    'http://localhost:3100',
    {
      description: 'Grafana Loki endpoint URL',
      category: 'logging',
      skipValidation: true,
    }
  );

  console.log(`   • Traefik ACME email     : ${traefikEmail}`);
  console.log(`   • Grafana admin username : ${grafanaAdminUser}`);
  console.log(`   • Loki retention (days)  : ${lokiRetentionDays}`);
  console.log('');

  return {
    lokiRetentionDays,
    traefikEmail,
    grafanaAdminUser,
    grafanaAdminPassword,
  };
}

async function renderConfigFiles(config: DeployConfig): Promise<void> {
  console.log('🧩 Step 3: Rendering Loki & Grafana configuration files...');
  await fs.mkdir(generatedDir, { recursive: true });

  const retentionHours = Math.max(1, Math.floor(config.lokiRetentionDays * 24));
  const lokiConfig = `auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

limits_config:
  retention_period: ${retentionHours}h

compactor:
  working_directory: /loki/retention
  shared_store: filesystem
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
`;

  const grafanaDatasources = `apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
    jsonData:
      maxLines: 1000
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    basicAuth: false
    editable: false
`;

  await Promise.all([
    fs.writeFile(path.join(generatedDir, 'loki-config.yaml'), lokiConfig, 'utf8'),
    fs.writeFile(path.join(generatedDir, 'grafana-datasources.yaml'), grafanaDatasources, 'utf8'),
  ]);

  console.log('   • Updated generated/loki-config.yaml');
  console.log('   • Updated generated/grafana-datasources.yaml\n');
}

async function deployInfrastructure(config: DeployConfig): Promise<void> {
  console.log('🚢 Step 4: Deploying docker stack (Traefik, Loki, Grafana, Prometheus)...');
  const env = {
    ...process.env,
    TRAEFIK_ACME_EMAIL: config.traefikEmail,
    GRAFANA_ADMIN_USER: config.grafanaAdminUser,
    GRAFANA_ADMIN_PASSWORD: config.grafanaAdminPassword,
  };

  await execAsync('docker stack deploy --with-registry-auth -c docker-compose.yaml paas-infra', {
    cwd: dockerDir,
    env,
  });

  console.log('   • Stack name: paas-infra');
  console.log('   • Waiting for services to start...\n');
}

async function verifyInfrastructure(): Promise<void> {
  console.log('🩺 Step 5: Verifying infrastructure health...');

  await waitForService('Loki', 'http://localhost:3100/ready');
  await waitForService('Grafana', 'http://localhost:3001/api/health');
  await waitForService('Traefik', 'http://localhost:8080/api/rawdata');
  await waitForService('Prometheus', 'http://localhost:9090/-/ready');

  console.log('   • All core services responded successfully\n');
}

async function waitForService(name: string, url: string, attempts = 30, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await httpCheck(url);
      return;
    } catch {
      // swallow and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`${name} did not become healthy at ${url}`);
}

function httpCheck(urlStr: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = new URL(urlStr);
    const lib = target.protocol === 'https:' ? https : http;

    const request = lib.request(
      {
        method: 'GET',
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });
    request.end();
  });
}

function printSummary(config: DeployConfig): void {
  console.log('✅ SkyPanelV2 PaaS infrastructure is ready.');
  console.log('');
  console.log('Access points:');
  console.log('   • Grafana : http://localhost:3001 (admin user/password from settings)');
  console.log('   • Traefik : http://localhost:8080 (dashboard)');
  console.log('   • Prometheus : http://localhost:9090');
  console.log('');
  console.log('Stored settings:');
  console.log(`   • traefik_acme_email     : ${config.traefikEmail}`);
  console.log(`   • grafana_admin_user     : ${config.grafanaAdminUser}`);
  console.log('   • grafana_admin_password : stored securely in paas_settings');
  console.log('');
  console.log('You can rerun this script anytime to update infrastructure settings or redeploy the stack.\n');
}

main().catch((error) => {
  console.error('\n❌ Failed to initialize infrastructure:');
  console.error(error?.message || error);
  process.exit(1);
});
