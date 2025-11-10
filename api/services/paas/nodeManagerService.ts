/**
 * PaaS Node Manager Service
 * Handles worker node provisioning, health monitoring, and Swarm management
 */

import { pool, PaasWorkerNode } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'ssh2';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logActivity } from '../activityLogger.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETUP_SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/setup-worker.sh');

let cachedSetupScript: string | null = null;

const NANOS_IN_CPU = 1_000_000_000;
const BYTES_IN_MB = 1024 * 1024;
const WORKER_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const workerAlertHistory = new Map<string, number>();
let cachedAdminRecipients: { ids: string[]; fetchedAt: number } = { ids: [], fetchedAt: 0 };
type WorkerAlertType = 'down' | 'unreachable' | 'resource';

async function getSetupScriptContent(): Promise<string> {
  if (cachedSetupScript) {
    return cachedSetupScript;
  }

  try {
    const script = await fs.readFile(SETUP_SCRIPT_PATH, 'utf-8');
    cachedSetupScript = script;
    return script;
  } catch (error: any) {
    throw new Error(`Setup script not found at ${SETUP_SCRIPT_PATH}: ${error?.message || error}`);
  }
}

export interface NodeProvisionOptions {
  name: string;
  ipAddress: string;
  sshPort?: number;
  sshUser?: string;
  sshKey?: string;
  autoProvision?: boolean;
}

export interface NodeStatus {
  id: string;
  name: string;
  status: string;
  availability?: string | null;
  ipAddress?: string;
  hostname?: string | null;
  cpu: {
    total: number;
    used: number;
    available: number;
  };
  ram: {
    total: number;
    used: number;
    available: number;
  };
  containers: number;
  warnings?: string[];
  lastHeartbeat?: string;
}

export class NodeManagerService {
  /**
   * Initialize Docker Swarm on the manager node
   */
  static async initializeSwarm(): Promise<{
    managerIp: string;
    workerToken: string;
    managerToken: string;
  }> {
    try {
      // Check if Swarm is already initialized
      const swarmConfig = await PaasSettingsService.getSwarmConfig();

      if (swarmConfig.initialized) {
        return {
          managerIp: swarmConfig.managerIp!,
          workerToken: swarmConfig.workerToken!,
          managerToken: swarmConfig.managerToken!,
        };
      }

      // Get local IP address
      const { stdout: ipOutput } = await execAsync("hostname -I | awk '{print $1}'");
      const managerIp = ipOutput.trim();

      // Initialize Swarm
      await execAsync(`docker swarm init --advertise-addr ${managerIp}`);

      // Get join tokens
      const { stdout: workerToken } = await execAsync('docker swarm join-token worker -q');
      const { stdout: managerToken } = await execAsync('docker swarm join-token manager -q');

      // Save to settings
      await PaasSettingsService.set('swarm_initialized', true);
      await PaasSettingsService.set('swarm_manager_ip', managerIp);
      await PaasSettingsService.set('swarm_join_token_worker', workerToken.trim(), { is_sensitive: true });
      await PaasSettingsService.set('swarm_join_token_manager', managerToken.trim(), { is_sensitive: true });

      // Create public network for Traefik
      await execAsync('docker network create --driver overlay --attachable paas-public').catch(() => {
        // Network might already exist
      });

      return {
        managerIp,
        workerToken: workerToken.trim(),
        managerToken: managerToken.trim(),
      };
    } catch (error: any) {
      throw new Error(`Failed to initialize Swarm: ${error.message}`);
    }
  }

  /**
   * Add a new worker node
   */
  static async addWorkerNode(options: NodeProvisionOptions): Promise<string> {
    try {
      const trimmedKey = options.sshKey?.trim();

      if (options.autoProvision && !trimmedKey) {
        throw new Error('SSH private key is required for auto-provisioning');
      }

      // Encrypt SSH key if provided
      const sshKeyEncrypted = trimmedKey ? encrypt(trimmedKey) : null;

      // Insert node into database
      const result = await pool.query<PaasWorkerNode>(
        `INSERT INTO paas_worker_nodes (
          name, ip_address, ssh_port, ssh_user, ssh_key_encrypted, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          options.name,
          options.ipAddress,
          options.sshPort || 22,
          options.sshUser || 'root',
          sshKeyEncrypted,
          'provisioning',
        ]
      );

      const node = result.rows[0];

      // Auto-provision if requested
      if (options.autoProvision) {
        try {
          await this.provisionNode(node.id);
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error('Auto-provisioning failed. Check worker logs for details.');
        }
      }

      return node.id;
    } catch (error: any) {
      throw new Error(`Failed to add worker node: ${error.message}`);
    }
  }

  /**
   * Auto-provision a worker node (install Docker, join Swarm)
   */
  static async provisionNode(nodeId: string): Promise<void> {
    const nodeResult = await pool.query<PaasWorkerNode>(
      'SELECT * FROM paas_worker_nodes WHERE id = $1',
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      throw new Error('Node not found');
    }

    const node = nodeResult.rows[0];

    try {
      const swarmConfig = await PaasSettingsService.getSwarmConfig();

      if (!swarmConfig.initialized) {
        throw new Error('Swarm not initialized. Please initialize Swarm first.');
      }

      const sshKey = node.ssh_key_encrypted ? decrypt(node.ssh_key_encrypted) : null;

      if (!sshKey) {
        throw new Error('SSH key required for auto-provisioning');
      }

      const setupScript = await getSetupScriptContent();
      const scriptBase64 = Buffer.from(setupScript, 'utf-8').toString('base64');
      const remoteScriptPath = `/tmp/skypanel-worker-${node.id}.sh`;

      // Reconfirm provisioning state
      await pool.query('UPDATE paas_worker_nodes SET status = $1 WHERE id = $2', ['provisioning', nodeId]);

      await this.runSSHCommands(node, sshKey, [
        `echo '${scriptBase64}' | base64 -d > ${remoteScriptPath}`,
        `chmod +x ${remoteScriptPath}`,
        `${remoteScriptPath} ${swarmConfig.workerToken} ${swarmConfig.managerIp}`,
        `rm -f ${remoteScriptPath}`,
      ]);

      await this.syncNodeMetadata(node, { retries: 6 });
    } catch (error: any) {
      await pool.query(
        'UPDATE paas_worker_nodes SET status = $1 WHERE id = $2',
        ['down', nodeId]
      );

      throw new Error(`Failed to provision node: ${error.message}`);
    }
  }

  /**
   * Run SSH commands on a remote node
   */
  private static async runSSHCommands(
    node: PaasWorkerNode,
    privateKey: string,
    commands: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        const commandStr = commands.join(' && ');

        conn.exec(commandStr, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
            console.log(`[${node.name}] ${data.toString()}`);
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            console.error(`[${node.name}] ERROR: ${data.toString()}`);
          });

          stream.on('close', (code: number) => {
            conn.end();

            if (code !== 0) {
              reject(new Error(`Commands failed with code ${code}: ${stderr}`));
            } else {
              resolve();
            }
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      conn.connect({
        host: node.ip_address,
        port: node.ssh_port,
        username: node.ssh_user,
        privateKey,
      });
    });
  }

  /**
   * Match Swarm metadata with database record and persist capacities/status
   */
  private static async syncNodeMetadata(
    node: PaasWorkerNode,
    options: { retries?: number } = {}
  ): Promise<void> {
    const retries = Math.max(options.retries ?? 3, 1);

    for (let attempt = 0; attempt < retries; attempt++) {
      const match = await this.findSwarmNode(node.ip_address, node.name);

      if (match) {
        const nanoCpus = Number(match.info?.Description?.Resources?.NanoCPUs || 0);
        const memoryBytes = Number(match.info?.Description?.Resources?.MemoryBytes || 0);

        const capacityCpu = Number((nanoCpus / NANOS_IN_CPU).toFixed(2));
        const capacityRamMb = Math.round(memoryBytes / BYTES_IN_MB);
        const hostname = match.info?.Description?.Hostname || null;

        await pool.query(
          `UPDATE paas_worker_nodes SET
            swarm_node_id = $1,
            status = 'active',
            capacity_cpu = $2,
            capacity_ram_mb = $3,
            last_heartbeat_at = NOW(),
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{hostname}',
              CASE WHEN $4 IS NULL THEN 'null'::jsonb ELSE to_jsonb($4::text) END,
              true
            )
          WHERE id = $5`,
          [match.id, capacityCpu, capacityRamMb, hostname, node.id]
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error(
      `Node "${node.name}" (${node.ip_address}) joined but couldn't be matched in Swarm. Verify networking and try again.`
    );
  }

  private static async findSwarmNode(
    ipAddress?: string,
    preferredHostname?: string
  ): Promise<{ id: string; info: any } | null> {
    const { stdout } = await execAsync('docker node ls -q');
    const ids = stdout
      .trim()
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    for (const id of ids) {
      const { stdout: inspectJson } = await execAsync(`docker node inspect ${id} --format "{{json .}}"`);
      const info = JSON.parse(inspectJson || '{}');
      const addr = info?.Status?.Addr;
      const hostname = info?.Description?.Hostname;

      if ((ipAddress && addr && addr.toString().startsWith(ipAddress)) || (preferredHostname && hostname === preferredHostname)) {
        return { id, info };
      }
    }

    return null;
  }

  private static async collectNodeMetrics(
    swarmNodeId: string,
    resourceCache: Map<string, { cpu: number; ramMb: number }>
  ): Promise<{
    status: string;
    availability: string | null;
    hostname: string | null;
    address: string | null;
    cpuTotal: number;
    ramTotalMb: number;
    usedCpu: number;
    usedRamMb: number;
    containers: number;
  }> {
    const { stdout } = await execAsync(`docker node inspect ${swarmNodeId} --format "{{json .}}"`);
    const info = JSON.parse(stdout || '{}');

    const nanoCpus = Number(info?.Description?.Resources?.NanoCPUs || 0);
    const memoryBytes = Number(info?.Description?.Resources?.MemoryBytes || 0);

    const usage = await this.computeTaskUsage(swarmNodeId, resourceCache);

    return {
      status: info?.Status?.State || 'unknown',
      availability: info?.Spec?.Availability || info?.Status?.Availability || null,
      hostname: info?.Description?.Hostname || null,
      address: info?.Status?.Addr || null,
      cpuTotal: Number((nanoCpus / NANOS_IN_CPU).toFixed(2)),
      ramTotalMb: Math.round(memoryBytes / BYTES_IN_MB),
      usedCpu: Number(usage.usedCpu.toFixed(2)),
      usedRamMb: usage.usedRamMb,
      containers: usage.containers,
    };
  }

  private static async computeTaskUsage(
    swarmNodeId: string,
    resourceCache: Map<string, { cpu: number; ramMb: number }>
  ): Promise<{ usedCpu: number; usedRamMb: number; containers: number }> {
    const { stdout } = await execAsync(
      `docker node ps ${swarmNodeId} --filter "desired-state=running" --format "{{json .}}"`
    );

    const lines = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let usedCpu = 0;
    let usedRamMb = 0;
    let containers = 0;

    for (const line of lines) {
      const task = JSON.parse(line);
      if ((task?.CurrentState || '').toLowerCase().startsWith('running')) {
        containers += 1;
      }

      const serviceName = task?.ServiceName;
      if (!serviceName) continue;

      const resources = await this.getServiceResourceUsage(serviceName, resourceCache);
      usedCpu += resources.cpu;
      usedRamMb += resources.ramMb;
    }

    return { usedCpu, usedRamMb, containers };
  }

  private static async getServiceResourceUsage(
    serviceName: string,
    resourceCache: Map<string, { cpu: number; ramMb: number }>
  ): Promise<{ cpu: number; ramMb: number }> {
    if (resourceCache.has(serviceName)) {
      return resourceCache.get(serviceName)!;
    }

    try {
      const { stdout } = await execAsync(
        `docker service inspect ${serviceName} --format "{{json .Spec.TaskTemplate.Resources}}"`
      );
      const resources = JSON.parse(stdout || '{}');
      const limits = resources?.Limits || {};
      const reservations = resources?.Reservations || {};

      const nanoCpus = Number(limits.NanoCPUs || reservations.NanoCPUs || 0);
      const memoryBytes = Number(limits.MemoryBytes || reservations.MemoryBytes || 0);

      const usage = {
        cpu: Number((nanoCpus / NANOS_IN_CPU).toFixed(2)),
        ramMb: Math.round(memoryBytes / BYTES_IN_MB),
      };

      resourceCache.set(serviceName, usage);
      return usage;
    } catch (error) {
      console.warn(`Unable to inspect service ${serviceName} for resource usage:`, error);
      const fallback = { cpu: 0, ramMb: 0 };
      resourceCache.set(serviceName, fallback);
      return fallback;
    }
  }

  private static mapDockerStatus(state?: string, fallback?: string): PaasWorkerNode['status'] {
    const normalized = (state || '').toLowerCase();
    switch (normalized) {
      case 'ready':
      case 'active':
        return 'active';
      case 'drain':
      case 'draining':
        return 'draining';
      case 'down':
      case 'disconnected':
        return 'down';
      default:
        return (fallback as PaasWorkerNode['status']) || 'unreachable';
    }
  }

  private static async evaluateAlertConditions(
    node: PaasWorkerNode,
    status: PaasWorkerNode['status'],
    metrics: { cpuTotal: number; usedCpu: number; ramTotalMb: number; usedRamMb: number }
  ): Promise<void> {
    if ((status === 'down' || status === 'unreachable') && status !== node.status) {
      await this.emitWorkerAlert(
        node,
        status,
        `Worker node ${node.name} is now ${status}`,
        {
          previous_status: node.status,
          current_status: status,
        }
      );
    }

    if (status !== 'active') {
      return;
    }

    const cpuExceeded = metrics.cpuTotal > 0 && metrics.usedCpu / metrics.cpuTotal >= 0.9;
    const ramExceeded = metrics.ramTotalMb > 0 && metrics.usedRamMb / metrics.ramTotalMb >= 0.9;

    if (cpuExceeded || ramExceeded) {
      await this.emitWorkerAlert(node, 'resource', `Worker node ${node.name} resources are constrained`, {
        cpu_used: metrics.usedCpu,
        cpu_total: metrics.cpuTotal,
        ram_used_mb: metrics.usedRamMb,
        ram_total_mb: metrics.ramTotalMb,
      });
    }
  }

  private static async emitWorkerAlert(
    node: PaasWorkerNode,
    type: WorkerAlertType,
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const cooldownKey = `${node.id}:${type}`;
    const now = Date.now();
    const lastAlert = workerAlertHistory.get(cooldownKey);
    if (lastAlert && now - lastAlert < WORKER_ALERT_COOLDOWN_MS) {
      return;
    }
    workerAlertHistory.set(cooldownKey, now);

    const adminIds = await this.getAdminUserIds();
    if (adminIds.length === 0) {
      return;
    }

    await Promise.all(
      adminIds.map((adminId) =>
        logActivity({
          userId: adminId,
          eventType: `admin.paas.worker.${type}`,
          entityType: 'paas_worker',
          entityId: node.id,
          message,
          status: type === 'resource' ? 'warning' : 'error',
          metadata: {
            node_id: node.id,
            node_name: node.name,
            ip_address: node.ip_address,
            ...metadata,
          },
        }).catch((error) => console.warn('Worker alert logging failed:', error))
      )
    );
  }

  private static async getAdminUserIds(): Promise<string[]> {
    const now = Date.now();
    if (cachedAdminRecipients.ids.length > 0 && now - cachedAdminRecipients.fetchedAt < 5 * 60 * 1000) {
      return cachedAdminRecipients.ids;
    }

    try {
      const result = await pool.query<{ id: string }>('SELECT id FROM users WHERE role = $1', ['admin']);
      cachedAdminRecipients = {
        ids: result.rows.map((row) => row.id),
        fetchedAt: now,
      };
    } catch (error) {
      console.error('Failed to fetch admin recipients for worker alerts:', error);
    }

    return cachedAdminRecipients.ids;
  }

  /**
   * Remove a worker node from Swarm
   */
  static async removeNode(nodeId: string): Promise<void> {
    const nodeResult = await pool.query<PaasWorkerNode>(
      'SELECT * FROM paas_worker_nodes WHERE id = $1',
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      throw new Error('Node not found');
    }

    const node = nodeResult.rows[0];

    try {
      await pool.query('UPDATE paas_worker_nodes SET status = $1 WHERE id = $2', ['draining', nodeId]);
      if (node.swarm_node_id) {
        // Drain node
        await execAsync(`docker node update --availability drain ${node.swarm_node_id}`);

        // Wait a bit for tasks to migrate
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Remove from Swarm
        await execAsync(`docker node rm ${node.swarm_node_id}`);
      }

      // Delete from database
      await pool.query('DELETE FROM paas_worker_nodes WHERE id = $1', [nodeId]);
    } catch (error: any) {
      throw new Error(`Failed to remove node: ${error.message}`);
    }
  }

  /**
   * Get status of all worker nodes
   */
  static async getNodeStatuses(): Promise<NodeStatus[]> {
    const nodes = await pool.query<PaasWorkerNode>(
      'SELECT * FROM paas_worker_nodes ORDER BY created_at DESC'
    );

    return nodes.rows.map((node) => {
      const totalCpu = Number(node.capacity_cpu || 0);
      const usedCpu = Number(node.used_cpu || 0);
      const totalRam = Number(node.capacity_ram_mb || 0);
      const usedRam = Number(node.used_ram_mb || 0);

      const metadata = (node.metadata ?? {}) as Record<string, any>;
      const warnings: string[] = [];
      if (node.status === 'unreachable' || node.status === 'down') {
        warnings.push('Node unreachable');
      }
      if (totalCpu > 0 && usedCpu / totalCpu > 0.9) {
        warnings.push('CPU usage above 90%');
      }
      if (totalRam > 0 && usedRam / totalRam > 0.9) {
        warnings.push('RAM usage above 90%');
      }
      if (metadata.last_error) {
        warnings.push(metadata.last_error);
      }

      return {
        id: node.id,
        name: node.name,
        status: node.status,
        availability: metadata.availability || null,
        ipAddress: node.ip_address,
        hostname: metadata.hostname || null,
        cpu: {
          total: totalCpu,
          used: usedCpu,
          available: Math.max(totalCpu - usedCpu, 0),
        },
        ram: {
          total: totalRam,
          used: usedRam,
          available: Math.max(totalRam - usedRam, 0),
        },
        containers: Number(metadata.containers || 0),
        warnings,
        lastHeartbeat: node.last_heartbeat_at,
      };
    });
  }

  /**
   * Update node resource usage (called periodically)
   */
  static async updateNodeResources(): Promise<void> {
    const nodes = await pool.query<PaasWorkerNode>('SELECT * FROM paas_worker_nodes ORDER BY created_at DESC');
    const serviceResourceCache = new Map<string, { cpu: number; ramMb: number }>();

    for (const node of nodes.rows) {
      if (!node.swarm_node_id) {
        if (node.status !== 'provisioning') {
          await this.syncNodeMetadata(node, { retries: 1 }).catch(() => {
            // Node might still be pending manual provisioning
          });
        }
        continue;
      }

      try {
        const metrics = await this.collectNodeMetrics(node.swarm_node_id, serviceResourceCache);
        const normalizedStatus = this.mapDockerStatus(metrics.status, node.status);
        await this.evaluateAlertConditions(node, normalizedStatus, metrics);

        await pool.query(
          `UPDATE paas_worker_nodes SET
            status = $1,
            capacity_cpu = $2,
            used_cpu = $3,
            capacity_ram_mb = $4,
            used_ram_mb = $5,
            last_heartbeat_at = NOW(),
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'hostname', $6,
              'address', $7,
              'availability', $8,
              'containers', $9
            )
          WHERE id = $10`,
          [
            normalizedStatus,
            metrics.cpuTotal,
            metrics.usedCpu,
            metrics.ramTotalMb,
            metrics.usedRamMb,
            metrics.hostname,
            metrics.address,
            metrics.availability,
            metrics.containers,
            node.id,
          ]
        );
      } catch (error: any) {
        console.error(`Failed to update node ${node.name}:`, error);
        await pool.query(
          `UPDATE paas_worker_nodes SET
            status = 'unreachable',
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_error', $1)
           WHERE id = $2`,
          [error?.message || 'Unknown error', node.id]
        );
      }
    }
  }

  /**
   * Validate Docker Swarm connectivity on the manager node
   */
  static async validateSwarmConnectivity(): Promise<{
    localNodeState: string;
    nodeId?: string;
    managers?: number;
    nodes?: number;
  }> {
    try {
      const { stdout } = await execAsync('docker info --format "{{json .Swarm}}"');
      const swarmInfo = JSON.parse(stdout || '{}');

      if (!swarmInfo.LocalNodeState || swarmInfo.LocalNodeState.toLowerCase() !== 'active') {
        throw new Error(
          `Swarm local node state is ${swarmInfo.LocalNodeState || 'unavailable'}`
        );
      }

      return {
        localNodeState: swarmInfo.LocalNodeState,
        nodeId: swarmInfo.NodeID,
        managers: Number(swarmInfo.Managers || 0),
        nodes: Number(swarmInfo.Nodes || 0),
      };
    } catch (error: any) {
      throw new Error(`Docker Swarm connectivity check failed: ${error?.message || error}`);
    }
  }
}
