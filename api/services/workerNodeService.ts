/**
 * Worker Node Service for SkyPanelV2 PaaS
 * Manages build/deployment worker nodes that execute application builds and deployments
 */

import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';
import crypto from 'crypto';

export interface WorkerNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  status: 'online' | 'offline' | 'busy' | 'maintenance' | 'error';
  capabilities: {
    nodejs: boolean;
    docker: boolean;
    [key: string]: any;
  };
  maxConcurrentBuilds: number;
  currentBuilds: number;
  resourceLimits: Record<string, any>;
  lastHeartbeat?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkerNodeRequest {
  name: string;
  hostname: string;
  ipAddress: string;
  port?: number;
  capabilities?: Record<string, any>;
  maxConcurrentBuilds?: number;
  resourceLimits?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RegisterWorkerNodeRequest {
  name: string;
  hostname: string;
  ipAddress: string;
  port?: number;
  capabilities?: Record<string, any>;
  maxConcurrentBuilds?: number;
  resourceLimits?: Record<string, any>;
  systemInfo?: Record<string, any>;
}

export class WorkerNodeService {
  /**
   * Generate a secure authentication token for worker nodes
   */
  static generateAuthToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Update worker node configuration (admin action)
   */
  static async updateWorkerNodeConfig(
    nodeId: string,
    changes: Partial<{
      name: string;
      hostname: string;
      ipAddress: string;
      port: number;
      capabilities: Record<string, any>;
      maxConcurrentBuilds: number;
      resourceLimits: Record<string, any>;
      metadata: Record<string, any>;
    }>,
    updatedBy?: string
  ): Promise<boolean> {
    try {
      // Build dynamic update query
      const setClauses: string[] = [];
      const values: any[] = [];

      const pushSet = (clause: string, value: any) => {
        setClauses.push(clause);
        values.push(value);
      };

      if (typeof changes.name === 'string') pushSet('name = $' + (values.length + 1), changes.name);
      if (typeof changes.hostname === 'string') pushSet('hostname = $' + (values.length + 1), changes.hostname);
      if (typeof changes.ipAddress === 'string') pushSet('ip_address = $' + (values.length + 1), changes.ipAddress);
      if (typeof changes.port === 'number') pushSet('port = $' + (values.length + 1), changes.port);
      if (typeof changes.maxConcurrentBuilds === 'number') pushSet('max_concurrent_builds = $' + (values.length + 1), changes.maxConcurrentBuilds);
      if (changes.capabilities) pushSet('capabilities = $' + (values.length + 1), JSON.stringify(changes.capabilities));
      if (changes.resourceLimits) pushSet('resource_limits = $' + (values.length + 1), JSON.stringify(changes.resourceLimits));
      if (changes.metadata) pushSet("metadata = COALESCE(metadata, '{}')::jsonb || $" + (values.length + 1) + "::jsonb", JSON.stringify(changes.metadata));

      // Always update timestamp
      setClauses.push('updated_at = NOW()');

      if (setClauses.length === 1) {
        // Only updated_at present → no actual changes provided
        return true;
      }

      const queryText = `
        UPDATE paas_worker_nodes
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length + 1}
        RETURNING id, name
      `;

      values.push(nodeId);

      const result = await query(queryText, values);

      if (result.rows.length > 0) {
        const nodeName = result.rows[0].name;
        if (updatedBy) {
          await logActivity({
            userId: updatedBy,
            eventType: 'paas.worker.config_update',
            entityType: 'paas_worker_node',
            entityId: nodeId,
            message: `Updated worker node configuration: ${nodeName}`,
            metadata: changes
          });
        }
        console.log(`🛠️ Worker node config updated: ${nodeName}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating worker node configuration:', error);
      return false;
    }
  }

  /**
   * Encrypt authentication token for database storage
   * Note: In production, use proper encryption like AES-256-GCM
   */
  static encryptToken(token: string): string {
    // For now, using base64 encoding - implement proper encryption in production
    return Buffer.from(token).toString('base64');
  }

  /**
   * Decrypt authentication token from database storage
   */
  static decryptToken(encryptedToken: string): string {
    // For now, using base64 decoding - implement proper decryption in production
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }

  /**
   * Register a new worker node (self-registration by worker nodes)
   */
  static async registerWorkerNode(data: RegisterWorkerNodeRequest): Promise<{ nodeId: string; authToken: string }> {
    try {
      return await transaction(async (client) => {
        // Check if worker node with same hostname/IP already exists
        const existingResult = await client.query(
          'SELECT id FROM paas_worker_nodes WHERE hostname = $1 OR ip_address = $2',
          [data.hostname, data.ipAddress]
        );

        if (existingResult.rows.length > 0) {
          // Update existing node
          const nodeId = existingResult.rows[0].id;
          const authToken = this.generateAuthToken();
          const encryptedToken = this.encryptToken(authToken);

          await client.query(`
            UPDATE paas_worker_nodes
            SET
              name = $1,
              port = $2,
              auth_token_encrypted = $3,
              status = 'online',
              capabilities = $4,
              max_concurrent_builds = $5,
              resource_limits = $6,
              last_heartbeat = NOW(),
              metadata = $7,
              updated_at = NOW()
            WHERE id = $8
          `, [
            data.name,
            data.port || 3001,
            encryptedToken,
            JSON.stringify(data.capabilities || { nodejs: true, docker: true }),
            data.maxConcurrentBuilds || 3,
            JSON.stringify(data.resourceLimits || {}),
            JSON.stringify({ ...data.systemInfo, registered_at: new Date().toISOString() }),
            nodeId
          ]);

          console.log(`✅ Worker node re-registered: ${data.name} (${data.hostname})`);

          return { nodeId, authToken };
        } else {
          // Create new node
          const nodeId = crypto.randomUUID();
          const authToken = this.generateAuthToken();
          const encryptedToken = this.encryptToken(authToken);

          await client.query(`
            INSERT INTO paas_worker_nodes (
              id,
              name,
              hostname,
              ip_address,
              port,
              auth_token_encrypted,
              status,
              capabilities,
              max_concurrent_builds,
              current_builds,
              resource_limits,
              last_heartbeat,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            nodeId,
            data.name,
            data.hostname,
            data.ipAddress,
            data.port || 3001,
            encryptedToken,
            'online',
            JSON.stringify(data.capabilities || { nodejs: true, docker: true }),
            data.maxConcurrentBuilds || 3,
            0,
            JSON.stringify(data.resourceLimits || {}),
            new Date(),
            JSON.stringify({ ...data.systemInfo, registered_at: new Date().toISOString() })
          ]);

          // Log the activity
          await logActivity({
            userId: null, // System action
            eventType: 'paas.worker.register',
            entityType: 'paas_worker_node',
            entityId: nodeId,
            message: `New worker node registered: ${data.name}`,
            metadata: {
              nodeName: data.name,
              hostname: data.hostname,
              ipAddress: data.ipAddress,
              capabilities: data.capabilities
            }
          });

          console.log(`✅ New worker node registered: ${data.name} (${data.hostname})`);

          return { nodeId, authToken };
        }
      });
    } catch (error) {
      console.error('Error registering worker node:', error);
      throw new Error(`Failed to register worker node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a worker node (admin action)
   */
  static async createWorkerNode(data: CreateWorkerNodeRequest, createdBy: string): Promise<WorkerNode> {
    try {
      const authToken = this.generateAuthToken();
      const encryptedToken = this.encryptToken(authToken);

      const result = await query(`
        INSERT INTO paas_worker_nodes (
          name,
          hostname,
          ip_address,
          port,
          auth_token_encrypted,
          status,
          capabilities,
          max_concurrent_builds,
          current_builds,
          resource_limits,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        data.name,
        data.hostname,
        data.ipAddress,
        data.port || 3001,
        encryptedToken,
        'offline', // New nodes start offline until they connect
        JSON.stringify(data.capabilities || { nodejs: true, docker: true }),
        data.maxConcurrentBuilds || 3,
        0,
        JSON.stringify(data.resourceLimits || {}),
        JSON.stringify({ ...data.metadata, created_by: createdBy, created_at: new Date().toISOString() })
      ]);

      const nodeRow = result.rows[0];

      // Log the activity
      await logActivity({
        userId: createdBy,
        eventType: 'paas.worker.create',
        entityType: 'paas_worker_node',
        entityId: nodeRow.id,
        message: `Created worker node: ${data.name}`,
        metadata: {
          nodeName: data.name,
          hostname: data.hostname,
          ipAddress: data.ipAddress
        }
      });

      console.log(`✅ Worker node created: ${data.name} (${data.hostname}) - Auth token: ${authToken}`);

      return {
        id: nodeRow.id,
        name: nodeRow.name,
        hostname: nodeRow.hostname,
        ipAddress: nodeRow.ip_address,
        port: nodeRow.port,
        status: nodeRow.status,
        capabilities: nodeRow.capabilities || {},
        maxConcurrentBuilds: nodeRow.max_concurrent_builds,
        currentBuilds: nodeRow.current_builds,
        resourceLimits: nodeRow.resource_limits || {},
        lastHeartbeat: nodeRow.last_heartbeat ? new Date(nodeRow.last_heartbeat) : undefined,
        metadata: nodeRow.metadata || {},
        createdAt: new Date(nodeRow.created_at),
        updatedAt: new Date(nodeRow.updated_at)
      };
    } catch (error) {
      console.error('Error creating worker node:', error);
      throw new Error(`Failed to create worker node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all worker nodes
   */
  static async getAllWorkerNodes(): Promise<WorkerNode[]> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          hostname,
          ip_address,
          port,
          status,
          capabilities,
          max_concurrent_builds,
          current_builds,
          resource_limits,
          last_heartbeat,
          metadata,
          created_at,
          updated_at
        FROM paas_worker_nodes
        ORDER BY
          CASE status
            WHEN 'online' THEN 1
            WHEN 'busy' THEN 2
            WHEN 'maintenance' THEN 3
            WHEN 'error' THEN 4
            WHEN 'offline' THEN 5
          END,
          created_at DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        hostname: row.hostname,
        ipAddress: row.ip_address,
        port: row.port,
        status: row.status,
        capabilities: row.capabilities || {},
        maxConcurrentBuilds: row.max_concurrent_builds,
        currentBuilds: row.current_builds,
        resourceLimits: row.resource_limits || {},
        lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting worker nodes:', error);
      throw new Error('Failed to fetch worker nodes');
    }
  }

  /**
   * Get a specific worker node by ID
   */
  static async getWorkerNodeById(nodeId: string): Promise<WorkerNode | null> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          hostname,
          ip_address,
          port,
          status,
          capabilities,
          max_concurrent_builds,
          current_builds,
          resource_limits,
          last_heartbeat,
          metadata,
          created_at,
          updated_at
        FROM paas_worker_nodes
        WHERE id = $1
      `, [nodeId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        hostname: row.hostname,
        ipAddress: row.ip_address,
        port: row.port,
        status: row.status,
        capabilities: row.capabilities || {},
        maxConcurrentBuilds: row.max_concurrent_builds,
        currentBuilds: row.current_builds,
        resourceLimits: row.resource_limits || {},
        lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting worker node by ID:', error);
      throw new Error('Failed to fetch worker node');
    }
  }

  /**
   * Update worker node heartbeat
   */
  static async updateHeartbeat(nodeId: string, systemInfo?: Record<string, any>): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE paas_worker_nodes
        SET
          last_heartbeat = NOW(),
          status = CASE WHEN status = 'offline' THEN 'online' ELSE status END,
          metadata = COALESCE(metadata, '{}')::jsonb || $2::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `, [nodeId, JSON.stringify({ ...systemInfo, last_heartbeat: new Date().toISOString() })]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error updating worker node heartbeat:', error);
      return false;
    }
  }

  /**
   * Find available worker node for a new build
   */
  static async findAvailableWorkerNode(capabilities?: Record<string, any>): Promise<WorkerNode | null> {
    try {
      const capabilityFilter = capabilities ?
        `AND capabilities @> $2` : '';

      const params = capabilities ? [capabilities] : [];

      const result = await query(`
        SELECT
          id,
          name,
          hostname,
          ip_address,
          port,
          status,
          capabilities,
          max_concurrent_builds,
          current_builds,
          resource_limits,
          last_heartbeat,
          metadata,
          created_at,
          updated_at
        FROM paas_worker_nodes
        WHERE status = 'online'
          AND current_builds < max_concurrent_builds
          ${capabilityFilter}
        ORDER BY
          current_builds ASC,
          last_heartbeat DESC
        LIMIT 1
      `, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        hostname: row.hostname,
        ipAddress: row.ip_address,
        port: row.port,
        status: row.status,
        capabilities: row.capabilities || {},
        maxConcurrentBuilds: row.max_concurrent_builds,
        currentBuilds: row.current_builds,
        resourceLimits: row.resource_limits || {},
        lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error finding available worker node:', error);
      return null;
    }
  }

  /**
   * Increment current build count for a worker node
   */
  static async incrementBuildCount(nodeId: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE paas_worker_nodes
        SET
          current_builds = current_builds + 1,
          status = CASE
            WHEN current_builds + 1 >= max_concurrent_builds THEN 'busy'
            ELSE 'online'
          END,
          updated_at = NOW()
        WHERE id = $1 AND status IN ('online', 'busy')
        RETURNING current_builds
      `, [nodeId]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error incrementing build count:', error);
      return false;
    }
  }

  /**
   * Decrement current build count for a worker node
   */
  static async decrementBuildCount(nodeId: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE paas_worker_nodes
        SET
          current_builds = GREATEST(0, current_builds - 1),
          status = CASE
            WHEN current_builds <= 1 THEN 'online'
            ELSE 'busy'
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING current_builds
      `, [nodeId]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error decrementing build count:', error);
      return false;
    }
  }

  /**
   * Update worker node status
   */
  static async updateWorkerNodeStatus(
    nodeId: string,
    status: WorkerNode['status'],
    updatedBy?: string
  ): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE paas_worker_nodes
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING id, name
      `, [status, nodeId]);

      if (result.rows.length > 0) {
        const nodeName = result.rows[0].name;

        // Log the activity if user-initiated
        if (updatedBy) {
          await logActivity({
            userId: updatedBy,
            eventType: 'paas.worker.status_update',
            entityType: 'paas_worker_node',
            entityId: nodeId,
            message: `Updated worker node status: ${nodeName} -> ${status}`,
            metadata: {
              nodeName,
              newStatus: status
            }
          });
        }

        console.log(`🔄 Worker node status updated: ${nodeName} -> ${status}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating worker node status:', error);
      return false;
    }
  }

  /**
   * Delete a worker node
   */
  static async deleteWorkerNode(nodeId: string, deletedBy: string): Promise<boolean> {
    try {
      return await transaction(async (client) => {
        // Get node details for logging
        const nodeResult = await client.query(
          'SELECT name, current_builds FROM paas_worker_nodes WHERE id = $1',
          [nodeId]
        );

        if (nodeResult.rows.length === 0) {
          throw new Error('Worker node not found');
        }

        const nodeName = nodeResult.rows[0].name;
        const currentBuilds = nodeResult.rows[0].current_builds;

        if (currentBuilds > 0) {
          throw new Error('Cannot delete worker node with active builds');
        }

        // Delete the worker node
        await client.query('DELETE FROM paas_worker_nodes WHERE id = $1', [nodeId]);

        // Log the activity
        await logActivity({
          userId: deletedBy,
          eventType: 'paas.worker.delete',
          entityType: 'paas_worker_node',
          entityId: nodeId,
          message: `Deleted worker node: ${nodeName}`,
          metadata: {
            nodeName,
            nodeId
          }
        });

        console.log(`🗑️ Worker node deleted: ${nodeName}`);
        return true;
      });
    } catch (error) {
      console.error('Error deleting worker node:', error);
      throw new Error(`Failed to delete worker node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark offline worker nodes (maintenance task)
   */
  static async markOfflineNodes(offlineThresholdMinutes: number = 5): Promise<number> {
    try {
      const thresholdTime = new Date(Date.now() - offlineThresholdMinutes * 60 * 1000);

      const result = await query(`
        UPDATE paas_worker_nodes
        SET
          status = 'offline',
          current_builds = 0,
          updated_at = NOW()
        WHERE status IN ('online', 'busy')
          AND (last_heartbeat IS NULL OR last_heartbeat < $1)
        RETURNING id, name
      `, [thresholdTime]);

      const markedOffline = result.rows.length;

      if (markedOffline > 0) {
        console.log(`⚠️ Marked ${markedOffline} worker nodes as offline (no heartbeat for ${offlineThresholdMinutes}+ minutes)`);

        // Log system activity
        await logActivity({
          userId: null, // System action
          eventType: 'paas.worker.maintenance',
          entityType: 'system',
          entityId: null,
          message: `Marked ${markedOffline} worker nodes as offline due to missed heartbeats`,
          metadata: {
            markedOffline,
            thresholdMinutes: offlineThresholdMinutes,
            nodes: result.rows.map(row => ({ id: row.id, name: row.name }))
          }
        });
      }

      return markedOffline;
    } catch (error) {
      console.error('Error marking offline nodes:', error);
      return 0;
    }
  }

  /**
   * Get worker node statistics
   */
  static async getWorkerNodeStats(): Promise<{
    totalNodes: number;
    onlineNodes: number;
    busyNodes: number;
    offlineNodes: number;
    maintenanceNodes: number;
    errorNodes: number;
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
  }> {
    try {
      const result = await query(`
        SELECT
          status,
          COUNT(*) as count,
          SUM(max_concurrent_builds) as total_capacity,
          SUM(current_builds) as used_capacity
        FROM paas_worker_nodes
        GROUP BY status
      `);

      let stats = {
        totalNodes: 0,
        onlineNodes: 0,
        busyNodes: 0,
        offlineNodes: 0,
        maintenanceNodes: 0,
        errorNodes: 0,
        totalCapacity: 0,
        usedCapacity: 0,
        availableCapacity: 0
      };

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const totalCapacity = parseInt(row.total_capacity) || 0;
        const usedCapacity = parseInt(row.used_capacity) || 0;

        stats.totalNodes += count;
        stats.totalCapacity += totalCapacity;
        stats.usedCapacity += usedCapacity;

        switch (row.status) {
          case 'online':
            stats.onlineNodes = count;
            break;
          case 'busy':
            stats.busyNodes = count;
            break;
          case 'offline':
            stats.offlineNodes = count;
            break;
          case 'maintenance':
            stats.maintenanceNodes = count;
            break;
          case 'error':
            stats.errorNodes = count;
            break;
        }
      });

      stats.availableCapacity = stats.totalCapacity - stats.usedCapacity;

      return stats;
    } catch (error) {
      console.error('Error getting worker node stats:', error);
      throw new Error('Failed to fetch worker node statistics');
    }
  }

  /**
   * Authenticate worker node request
   */
  static async authenticateWorkerNode(nodeId: string, authToken: string): Promise<boolean> {
    try {
      const result = await query(`
        SELECT auth_token_encrypted
        FROM paas_worker_nodes
        WHERE id = $1
      `, [nodeId]);

      if (result.rows.length === 0) {
        return false;
      }

      const storedToken = this.decryptToken(result.rows[0].auth_token_encrypted);
      return storedToken === authToken;
    } catch (error) {
      console.error('Error authenticating worker node:', error);
      return false;
    }
  }
}
