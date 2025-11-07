/**
 * PaaS Node Service
 * Manages worker nodes that execute container workloads
 */

import { query } from '../../lib/database.js';
import crypto from 'crypto';

export interface PaaSNode {
  id: number;
  name: string;
  region: string;
  host_address: string;
  registration_token: string | null;
  jwt_secret: string | null;
  status: 'pending' | 'online' | 'offline' | 'disabled';
  cpu_total: number | null;
  memory_total: number | null;
  disk_total: number | null;
  cpu_used: number;
  memory_used: number;
  disk_used: number;
  container_count: number;
  last_heartbeat: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNodeData {
  name: string;
  region: string;
  host_address: string;
}

export interface UpdateNodeData {
  name?: string;
  region?: string;
  host_address?: string;
  status?: 'pending' | 'online' | 'offline' | 'disabled';
}

export interface HeartbeatData {
  cpu_used: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  container_count: number;
}

export class NodeService {
  /**
   * Get all nodes
   */
  static async getAllNodes(): Promise<PaaSNode[]> {
    const result = await query(
      'SELECT * FROM paas_nodes ORDER BY created_at DESC'
    );
    return result.rows;
  }

  /**
   * Get a single node by ID
   */
  static async getNodeById(id: number): Promise<PaaSNode | null> {
    const result = await query(
      'SELECT * FROM paas_nodes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get nodes by region
   */
  static async getNodesByRegion(region: string, statusFilter?: string[]): Promise<PaaSNode[]> {
    let sql = 'SELECT * FROM paas_nodes WHERE region = $1';
    const params: any[] = [region];

    if (statusFilter && statusFilter.length > 0) {
      sql += ' AND status = ANY($2)';
      params.push(statusFilter);
    }

    sql += ' ORDER BY cpu_used ASC';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Generate registration token for a new node
   */
  static generateRegistrationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate JWT secret for a node
   */
  static generateJwtSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create a new node (generates registration token)
   */
  static async createNode(data: CreateNodeData): Promise<PaaSNode> {
    const registrationToken = this.generateRegistrationToken();

    const result = await query(
      `INSERT INTO paas_nodes 
       (name, region, host_address, registration_token, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [data.name, data.region, data.host_address, registrationToken]
    );
    return result.rows[0];
  }

  /**
   * Complete node registration (called by agent)
   */
  static async completeRegistration(
    registrationToken: string,
    nodeInfo: {
      cpu_total: number;
      memory_total: number;
      disk_total: number;
    }
  ): Promise<{ node: PaaSNode; jwtSecret: string } | null> {
    const jwtSecret = this.generateJwtSecret();

    const result = await query(
      `UPDATE paas_nodes 
       SET jwt_secret = $1,
           cpu_total = $2,
           memory_total = $3,
           disk_total = $4,
           status = 'online',
           last_heartbeat = NOW()
       WHERE registration_token = $5
       RETURNING *`,
      [jwtSecret, nodeInfo.cpu_total, nodeInfo.memory_total, nodeInfo.disk_total, registrationToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      node: result.rows[0],
      jwtSecret
    };
  }

  /**
   * Update a node
   */
  static async updateNode(id: number, data: UpdateNodeData): Promise<PaaSNode | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.region !== undefined) {
      updates.push(`region = $${paramCount++}`);
      values.push(data.region);
    }
    if (data.host_address !== undefined) {
      updates.push(`host_address = $${paramCount++}`);
      values.push(data.host_address);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (updates.length === 0) {
      return this.getNodeById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_nodes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Process heartbeat from agent
   */
  static async processHeartbeat(nodeId: number, data: HeartbeatData): Promise<boolean> {
    const result = await query(
      `UPDATE paas_nodes 
       SET cpu_used = $1,
           memory_used = $2,
           memory_total = $3,
           disk_used = $4,
           disk_total = $5,
           container_count = $6,
           last_heartbeat = NOW(),
           status = 'online'
       WHERE id = $7`,
      [
        data.cpu_used,
        data.memory_used,
        data.memory_total,
        data.disk_used,
        data.disk_total,
        data.container_count,
        nodeId
      ]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check for offline nodes (no heartbeat in 90 seconds)
   */
  static async markOfflineNodes(): Promise<number> {
    const result = await query(
      `UPDATE paas_nodes 
       SET status = 'offline'
       WHERE status = 'online'
         AND last_heartbeat < NOW() - INTERVAL '90 seconds'
       RETURNING id`
    );
    return result.rows.length;
  }

  /**
   * Delete a node
   */
  static async deleteNode(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_nodes WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if a node has capacity for a deployment
   */
  static async hasCapacity(nodeId: number, requiredCpu: number, requiredMemory: number): Promise<boolean> {
    const node = await this.getNodeById(nodeId);
    if (!node || node.status !== 'online') {
      return false;
    }

    if (!node.cpu_total || !node.memory_total) {
      return false;
    }

    const cpuAvailable = node.cpu_total - node.cpu_used;
    const memoryAvailable = node.memory_total - node.memory_used;

    return cpuAvailable >= requiredCpu && memoryAvailable >= requiredMemory;
  }

  /**
   * Get node utilization percentage
   */
  static getUtilizationPercentage(node: PaaSNode): number {
    if (!node.cpu_total || !node.memory_total) {
      return 0;
    }

    const cpuPercent = (node.cpu_used / node.cpu_total) * 100;
    const memoryPercent = (node.memory_used / node.memory_total) * 100;

    return Math.max(cpuPercent, memoryPercent);
  }
}
