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

const execAsync = promisify(exec);

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
      // Encrypt SSH key if provided
      const sshKeyEncrypted = options.sshKey ? encrypt(options.sshKey) : null;

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
        await this.provisionNode(node.id);
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
      // Get Swarm join token
      const swarmConfig = await PaasSettingsService.getSwarmConfig();

      if (!swarmConfig.initialized) {
        throw new Error('Swarm not initialized. Please initialize Swarm first.');
      }

      // SSH into node and run setup script
      const sshKey = node.ssh_key_encrypted ? decrypt(node.ssh_key_encrypted) : null;

      if (!sshKey) {
        throw new Error('SSH key required for auto-provisioning');
      }

      // Run setup commands via SSH
      await this.runSSHCommands(node, sshKey, [
        // Install Docker
        'apt-get update',
        'apt-get install -y apt-transport-https ca-certificates curl software-properties-common',
        'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -',
        'add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"',
        'apt-get update',
        'apt-get install -y docker-ce docker-ce-cli containerd.io',
        'systemctl enable docker',
        'systemctl start docker',

        // Configure firewall
        'ufw allow 2377/tcp',  // Swarm cluster management
        'ufw allow 7946/tcp',  // Container network discovery
        'ufw allow 7946/udp',
        'ufw allow 4789/udp',  // Overlay network traffic

        // Join Swarm
        `docker swarm join --token ${swarmConfig.workerToken} ${swarmConfig.managerIp}:2377`,
      ]);

      // Get Swarm node ID
      const { stdout: nodeIdOutput } = await execAsync(
        `docker node ls --filter "name=${node.name}" --format "{{.ID}}"`
      );

      const swarmNodeId = nodeIdOutput.trim();

      // Update node status
      await pool.query(
        `UPDATE paas_worker_nodes SET
          status = $1,
          swarm_node_id = $2,
          last_heartbeat_at = NOW()
        WHERE id = $3`,
        ['active', swarmNodeId, nodeId]
      );
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

    const statuses: NodeStatus[] = [];

    for (const node of nodes.rows) {
      if (node.swarm_node_id) {
        try {
          // Get node stats from Docker
          const { stdout } = await execAsync(
            `docker node inspect ${node.swarm_node_id} --format "{{json .}}"`
          );

          const nodeInfo = JSON.parse(stdout);

          // Count containers on this node
          let containerCount = 0;
          try {
            const { stdout: tasksOutput } = await execAsync(
              `docker node ps ${node.swarm_node_id} --filter "desired-state=running" --format "{{.ID}}"`
            );
            containerCount = tasksOutput.trim().split('\n').filter(line => line.length > 0).length;
          } catch (countError) {
            console.warn(`Failed to count containers for node ${node.name}:`, countError);
          }

          // Get resource usage (simplified - in production would use Prometheus)
          statuses.push({
            id: node.id,
            name: node.name,
            status: nodeInfo.Status.State,
            cpu: {
              total: node.capacity_cpu || 0,
              used: node.used_cpu,
              available: (node.capacity_cpu || 0) - node.used_cpu,
            },
            ram: {
              total: node.capacity_ram_mb || 0,
              used: node.used_ram_mb,
              available: (node.capacity_ram_mb || 0) - node.used_ram_mb,
            },
            containers: containerCount,
            lastHeartbeat: node.last_heartbeat_at,
          });
        } catch (error) {
          // Node might be down
          statuses.push({
            id: node.id,
            name: node.name,
            status: 'unreachable',
            cpu: { total: 0, used: 0, available: 0 },
            ram: { total: 0, used: 0, available: 0 },
            containers: 0,
            lastHeartbeat: node.last_heartbeat_at,
          });
        }
      } else {
        statuses.push({
          id: node.id,
          name: node.name,
          status: node.status,
          cpu: { total: 0, used: 0, available: 0 },
          ram: { total: 0, used: 0, available: 0 },
          containers: 0,
          lastHeartbeat: node.last_heartbeat_at,
        });
      }
    }

    return statuses;
  }

  /**
   * Update node resource usage (called periodically)
   */
  static async updateNodeResources(): Promise<void> {
    const nodes = await pool.query<PaasWorkerNode>(
      'SELECT * FROM paas_worker_nodes WHERE swarm_node_id IS NOT NULL'
    );

    for (const node of nodes.rows) {
      try {
        // Get running tasks on this node
        const { stdout } = await execAsync(
          `docker node ps ${node.swarm_node_id} --filter "desired-state=running" --format "{{json .}}"`
        );

        // Parse resource usage (simplified)
        // In production, integrate with Prometheus/cAdvisor for accurate metrics

        await pool.query(
          `UPDATE paas_worker_nodes SET
            last_heartbeat_at = NOW()
          WHERE id = $1`,
          [node.id]
        );
      } catch (error) {
        console.error(`Failed to update node ${node.name}:`, error);
      }
    }
  }
}
