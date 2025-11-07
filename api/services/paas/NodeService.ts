import { query } from '../../lib/database.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

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

export interface HeartbeatData {
  nodeId: number;
  timestamp: string;
  status: 'online' | 'degraded';
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskUsedMB: number;
  diskTotalMB: number;
  containerCount: number;
  containers?: Array<{
    containerId: string;
    applicationId: number;
    status: 'running' | 'stopped' | 'failed';
    cpuUsagePercent: number;
    memoryUsedMB: number;
    restartCount: number;
  }>;
}

export class NodeService {
  async getAll(): Promise<PaaSNode[]> {
    const result = await query(
      'SELECT * FROM paas_nodes ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async getById(id: number): Promise<PaaSNode | null> {
    const result = await query(
      'SELECT * FROM paas_nodes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getByRegion(region: string, onlineOnly = false): Promise<PaaSNode[]> {
    const sql = onlineOnly
      ? 'SELECT * FROM paas_nodes WHERE region = $1 AND status = $2 ORDER BY cpu_used ASC'
      : 'SELECT * FROM paas_nodes WHERE region = $1 ORDER BY status, cpu_used ASC';
    
    const params = onlineOnly ? [region, 'online'] : [region];
    const result = await query(sql, params);
    return result.rows;
  }

  async generateRegistrationToken(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }

  async generateJWTSecret(): Promise<string> {
    return crypto.randomBytes(64).toString('hex');
  }

  async create(node: { name: string; region: string; host_address?: string }): Promise<{ node: PaaSNode; token: string }> {
    const registrationToken = await this.generateRegistrationToken();
    
    const result = await query(
      `INSERT INTO paas_nodes (name, region, host_address, registration_token, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [node.name, node.region, node.host_address || '', registrationToken, 'pending']
    );
    
    return { node: result.rows[0], token: registrationToken };
  }

  async completeRegistration(token: string, nodeData: {
    cpu_total: number;
    memory_total: number;
    disk_total: number;
  }): Promise<{ node: PaaSNode; jwtSecret: string } | null> {
    const node = await query(
      'SELECT * FROM paas_nodes WHERE registration_token = $1 AND status = $2',
      [token, 'pending']
    );

    if (node.rows.length === 0) {
      return null;
    }

    const jwtSecret = await this.generateJWTSecret();
    
    const result = await query(
      `UPDATE paas_nodes 
       SET jwt_secret = $1, status = $2, cpu_total = $3, memory_total = $4, disk_total = $5, last_heartbeat = NOW()
       WHERE id = $6
       RETURNING *`,
      [jwtSecret, 'online', nodeData.cpu_total, nodeData.memory_total, nodeData.disk_total, node.rows[0].id]
    );

    return { node: result.rows[0], jwtSecret };
  }

  async updateStatus(id: number, status: PaaSNode['status']): Promise<PaaSNode | null> {
    const result = await query(
      'UPDATE paas_nodes SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  }

  async processHeartbeat(id: number, heartbeat: HeartbeatData): Promise<void> {
    await query(
      `UPDATE paas_nodes 
       SET last_heartbeat = NOW(),
           status = $2,
           cpu_used = $3,
           memory_used = $4,
           memory_total = $5,
           disk_used = $6,
           disk_total = $7,
           container_count = $8
       WHERE id = $1`,
      [
        id,
        heartbeat.status,
        Math.round(heartbeat.cpuUsagePercent),
        heartbeat.memoryUsedMB,
        heartbeat.memoryTotalMB,
        heartbeat.diskUsedMB,
        heartbeat.diskTotalMB,
        heartbeat.containerCount
      ]
    );

    const cpuPercent = (heartbeat.memoryUsedMB / heartbeat.memoryTotalMB) * 100;
    const memoryPercent = (heartbeat.memoryUsedMB / heartbeat.memoryTotalMB) * 100;
    
    if (cpuPercent >= 90 || memoryPercent >= 90) {
      console.warn(`[PaaS] Node ${id} capacity warning: CPU ${cpuPercent.toFixed(1)}%, Memory ${memoryPercent.toFixed(1)}%`);
    }
  }

  async checkOfflineNodes(): Promise<PaaSNode[]> {
    const offlineThreshold = new Date(Date.now() - 90000);
    
    const result = await query(
      `UPDATE paas_nodes 
       SET status = 'offline'
       WHERE status = 'online' 
         AND last_heartbeat < $1
       RETURNING *`,
      [offlineThreshold]
    );

    return result.rows;
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_nodes WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getCapacityForScheduling(region?: string): Promise<Array<PaaSNode & { availableCapacity: number }>> {
    let sql = `
      SELECT *, 
        CASE 
          WHEN cpu_total > 0 AND memory_total > 0 
          THEN ((cpu_total - cpu_used)::float / cpu_total * 100 + (memory_total - memory_used)::float / memory_total * 100) / 2
          ELSE 0
        END as available_capacity
      FROM paas_nodes 
      WHERE status = 'online'
    `;
    
    const params: any[] = [];
    if (region) {
      sql += ' AND region = $1';
      params.push(region);
    }
    
    sql += ' ORDER BY available_capacity DESC';
    
    const result = await query(sql, params);
    return result.rows;
  }

  verifyNodeJWT(token: string, jwtSecret: string): { valid: boolean; nodeId?: number } {
    try {
      const decoded = jwt.verify(token, jwtSecret) as { nodeId: number };
      return { valid: true, nodeId: decoded.nodeId };
    } catch (error) {
      return { valid: false };
    }
  }

  generateNodeJWT(nodeId: number, jwtSecret: string): string {
    return jwt.sign({ nodeId }, jwtSecret, { expiresIn: '24h' });
  }
}

export const nodeService = new NodeService();
