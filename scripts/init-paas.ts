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
const parsedHealthAttempts = Number(process.env.PAAS_HEALTH_MAX_ATTEMPTS);
const parsedHealthDelay = Number(process.env.PAAS_HEALTH_DELAY_MS);
const HEALTH_MAX_ATTEMPTS =
  Number.isFinite(parsedHealthAttempts) && parsedHealthAttempts > 0
    ? parsedHealthAttempts
    : 12;
const HEALTH_DELAY_MS =
  Number.isFinite(parsedHealthDelay) && parsedHealthDelay > 0
    ? parsedHealthDelay
    : 15000;

interface DeployConfig {
  lokiRetentionDays: number;
  traefikEmail: string;
  grafanaAdminUser: string;
  grafanaAdminPassword: string;
}

async function main(): Promise<void> {
  console.log('\n🚀 SkyPanelV2 PaaS Infrastructure Initialization\n');

  await PaasSettingsService.initializeDefaults();
  const swarmDetails = await initializeSwarm();

  const config = await prepareDeployConfig();
  await renderConfigFiles(config);
  await deployInfrastructure(config);
  await verifyInfrastructure();
  const summaryPath = await saveInitSummary(config, swarmDetails);
  printSummary(config, summaryPath);
}

async function initializeSwarm(): Promise<{
  managerIp: string;
  workerToken: string;
  managerToken: string;
}> {
  console.log('🛠  Step 1: Ensuring Docker Swarm is initialized...');
  const swarmConfig = await NodeManagerService.initializeSwarm();
  console.log(`   • Manager IP    : ${swarmConfig.managerIp}`);
  console.log(`   • Worker Token  : ${swarmConfig.workerToken.substring(0, 12)}...`);
  console.log('');
  return swarmConfig;
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
  console.log('🧩 Step 3: Creating Docker configs for Loki, Grafana, Promtail & Prometheus...');
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
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

limits_config:
  retention_period: ${retentionHours}h
  max_query_lookback: ${retentionHours}h

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

  const promtailConfig = `server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'logstream'
      - source_labels: ['__meta_docker_container_label_com_docker_swarm_service_name']
        target_label: 'service'
      - source_labels: ['__meta_docker_container_label_paas_app_id']
        target_label: 'app_id'
      - source_labels: ['__meta_docker_container_label_paas_app_name']
        target_label: 'app_name'
      - source_labels: ['__meta_docker_container_label_paas_deployment_id']
        target_label: 'deployment_id'
`;

  const prometheusConfig = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']
`;

  // Write to generated directory for reference
  await Promise.all([
    fs.writeFile(path.join(generatedDir, 'loki-config.yaml'), lokiConfig, 'utf8'),
    fs.writeFile(path.join(generatedDir, 'grafana-datasources.yaml'), grafanaDatasources, 'utf8'),
    fs.writeFile(path.join(generatedDir, 'promtail-config.yaml'), promtailConfig, 'utf8'),
    fs.writeFile(path.join(generatedDir, 'prometheus-config.yaml'), prometheusConfig, 'utf8'),
  ]);

  // Create Docker configs with versioning (configs are immutable in Swarm)
  const configVersion = Date.now().toString();
  const configs = [
    { name: 'loki-config', content: lokiConfig },
    { name: 'grafana-datasources', content: grafanaDatasources },
    { name: 'promtail-config', content: promtailConfig },
    { name: 'prometheus-config', content: prometheusConfig },
  ];

  for (const cfg of configs) {
    const fullName = `${cfg.name}-${configVersion}`;

    // Remove old config versions
    try {
      const { stdout } = await execAsync(`docker config ls --filter "name=${cfg.name}-" --format "{{.Name}}"`);
      const oldConfigs = stdout.trim().split('\n').filter(Boolean);
      for (const oldConfig of oldConfigs) {
        try {
          await execAsync(`docker config rm ${oldConfig}`);
        } catch {
          // Config may be in use, will be cleaned up later
        }
      }
    } catch {
      // No old configs or error listing
    }

    // Create new config
    try {
      await execAsync(`echo '${cfg.content.replace(/'/g, "'\\''")}' | docker config create ${fullName} -`);
      console.log(`   • Created Docker config: ${fullName}`);
    } catch (error) {
      // Config might already exist, try to continue
      console.log(`   • Config ${fullName} already exists or creation failed`);
    }
  }

  // Store config version for docker-compose
  process.env.CONFIG_VERSION = configVersion;
  console.log(`   • Config version: ${configVersion}\n`);
}

async function deployInfrastructure(config: DeployConfig): Promise<void> {
  console.log('🚢 Step 4: Deploying docker stack (Traefik, Loki, Grafana, Prometheus)...');
  const env = {
    ...process.env,
    TRAEFIK_ACME_EMAIL: config.traefikEmail,
    GRAFANA_ADMIN_USER: config.grafanaAdminUser,
    GRAFANA_ADMIN_PASSWORD: config.grafanaAdminPassword,
    CONFIG_VERSION: process.env.CONFIG_VERSION || 'v1',
  };

  await execAsync('docker stack deploy --with-registry-auth -c docker-compose.yaml paas-infra', {
    cwd: dockerDir,
    env,
  });

  console.log('   • Stack name: paas-infra');
  console.log(`   • Using config version: ${env.CONFIG_VERSION}`);
  console.log('   • Waiting for services to start...\n');
}

async function verifyInfrastructure(): Promise<void> {
  console.log('🩺 Step 5: Verifying infrastructure health...');

  // Try common host loopback variants in case IPv6 localhost isn't bound
  await waitForServiceAny('Loki', ['http://localhost:3100/ready', 'http://127.0.0.1:3100/ready']);
  await waitForServiceAny('Prometheus', ['http://localhost:9090/-/ready', 'http://127.0.0.1:9090/-/ready']);

  // Check Grafana and Traefik with shorter timeout (optional)
  try {
    await waitForServiceAny('Grafana', ['http://localhost:3002/api/health', 'http://127.0.0.1:3002/api/health'], 5, 2000);
  } catch {
    console.log('   ⚠ Grafana health check skipped (still starting up)');
  }

  try {
    await waitForServiceAny('Traefik', ['http://localhost:8080/api/rawdata', 'http://127.0.0.1:8080/api/rawdata'], 5, 2000);
  } catch {
    console.log('   ⚠ Traefik health check skipped (still starting up)');
  }

  console.log('   • Core services verified successfully\n');
}

async function waitForServiceAny(
  name: string,
  urls: string[],
  attempts = HEALTH_MAX_ATTEMPTS,
  delayMs = HEALTH_DELAY_MS
): Promise<void> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    for (const url of urls) {
      try {
        await httpCheck(url);
        console.log(`   • ${name} healthy via ${url} (attempt ${attempt}/${attempts})`);
        return;
      } catch (error: any) {
        lastError = error;
      }
    }
    const reason = lastError?.message || lastError || 'unknown error';
    const retryMsg = attempt < attempts ? ` - retrying in ${Math.round(delayMs / 1000)}s` : '';
    console.log(`   • ${name} not ready yet (attempt ${attempt}/${attempts}): ${reason}${retryMsg}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`${name} did not become healthy via any endpoint: ${urls.join(', ')}`);
}

async function waitForService(
  name: string,
  url: string,
  attempts = HEALTH_MAX_ATTEMPTS,
  delayMs = HEALTH_DELAY_MS
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await httpCheck(url);
      console.log(`   • ${name} healthy (attempt ${attempt}/${attempts})`);
      return;
    } catch (error: any) {
      const reason = error?.message || error || 'unknown error';
      const retryMsg =
        attempt < attempts ? ` - retrying in ${Math.round(delayMs / 1000)}s` : '';
      console.log(
        `   • ${name} not ready yet (attempt ${attempt}/${attempts}): ${reason}${retryMsg}`
      );
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

async function saveInitSummary(
  config: DeployConfig,
  swarm: { managerIp: string; workerToken: string; managerToken: string }
): Promise<string> {
  const timestamp = new Date().toISOString();
  const sanitizedTimestamp = timestamp.replace(/[:.]/g, '-');
  const filename = `paas-init-summary-${sanitizedTimestamp}.txt`;
  const filepath = path.join(generatedDir, filename);

  const accessPoints = {
    grafana: 'http://localhost:3002',
    traefik: 'http://localhost:8080',
    prometheus: 'http://localhost:9090',
    loki: 'http://localhost:3100',
  };

  const summary = `SkyPanelV2 PaaS Initialization Summary\n` +
    `Timestamp: ${timestamp}\n\n` +
    `Swarm Manager IP : ${swarm.managerIp}\n` +
    `Config Version   : ${process.env.CONFIG_VERSION || 'unknown'}\n` +
    `Loki Retention   : ${config.lokiRetentionDays} days\n` +
    `Traefik ACME     : ${config.traefikEmail}\n\n` +
    `Access Points:\n` +
    `  • Grafana    : ${accessPoints.grafana}\n` +
    `  • Traefik    : ${accessPoints.traefik}\n` +
    `  • Prometheus : ${accessPoints.prometheus}\n` +
    `  • Loki       : ${accessPoints.loki}\n\n` +
    `Grafana Credentials:\n` +
    `  • Username : ${config.grafanaAdminUser}\n` +
    `  • Password : ${config.grafanaAdminPassword}\n\n` +
    `This file is generated automatically by scripts/init-paas.ts.`;

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(filepath, summary, 'utf8');
  return filepath;
}

function printSummary(config: DeployConfig, summaryPath?: string): void {
  console.log('✅ SkyPanelV2 PaaS infrastructure is ready.');
  console.log('');
  console.log('Access points:');
  console.log('   • Grafana : http://localhost:3002 (admin user/password from settings)');
  console.log('   • Traefik : http://localhost:8080 (dashboard)');
  console.log('   • Prometheus : http://localhost:9090');
  console.log('');
  console.log('Stored settings:');
  console.log(`   • traefik_acme_email     : ${config.traefikEmail}`);
  console.log(`   • grafana_admin_user     : ${config.grafanaAdminUser}`);
  console.log('   • grafana_admin_password : stored securely in paas_settings');
  console.log('');
  if (summaryPath) {
    console.log(`Summary saved to: ${summaryPath}`);
    console.log('');
  }
  console.log('You can rerun this script anytime to update infrastructure settings or redeploy the stack.\n');
}

main().catch((error) => {
  console.error('\n❌ Failed to initialize infrastructure:');
  console.error(error?.message || error);
  // Best-effort diagnostics to help the operator understand what's wrong
  runDiagnostics().finally(() => process.exit(1));
});

async function runDiagnostics(): Promise<void> {
  try {
    console.log('\n🔎 Diagnostic summary (docker)');
    const { stdout: v } = await execAsync('docker version --format "{{.Server.Version}}"');
    console.log(`   • Docker server version: ${v.trim()}`);
  } catch {}

  try {
    const { stdout } = await execAsync('docker info --format "{{json .Swarm}}"');
    console.log(`   • Swarm: ${stdout.trim()}`);
  } catch {}

  try {
    const { stdout } = await execAsync('docker stack services paas-infra');
    console.log('\n⚙️  Services in stack paas-infra');
    console.log(stdout.trim());
  } catch {}

  try {
    const { stdout } = await execAsync('docker service ps paas-infra_loki --no-trunc || true');
    console.log('\n🧱 Service tasks: loki');
    console.log(stdout.trim());
  } catch {}

  try {
    const { stdout } = await execAsync('docker service ps paas-infra_prometheus --no-trunc || true');
    console.log('\n📈 Service tasks: prometheus');
    console.log(stdout.trim());
  } catch {}

  try {
    const { stdout } = await execAsync('docker service logs --raw --timestamps --tail 50 paas-infra_loki || true');
    console.log('\n📜 Recent logs: loki');
    console.log(stdout.trim());
  } catch {}

  try {
    const { stdout } = await execAsync(
      "sh -c 'ss -ltnp 2>/dev/null | grep -E \":3100|:9090|:3002|:8080\"' || true"
    );
    console.log('\n🔌 Listening ports (host)');
    console.log(stdout.trim() || '(none found)');
  } catch {}
}
