/**
 * Worker Service for SkyPanelV2 Container Platform
 * Handles worker node registration, health monitoring, and capacity tracking
 */

import { query, transaction } from '../../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

export interface WorkerNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  swarmNodeId?: string;
  authTokenHash: string;
  status: 'pending' | 'active' | 'unhealthy' | 'draining' | 'offline';
  capacity: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  currentLoad: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    containerCount: number;
  };
  lastHeartbeatAt?: Date;
  metadata: {
    osVersion?: string;
    dockerVersion?: string;
    nixVersion?: string;
    region?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerRegistrationInfo {
  hostname: string;
  ipAddress: string;
  capacity: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  metadata?: {
    osVersion?: string;
    dockerVersion?: string;
    nixVersion?: string;
    region?: string;
  };
}

export interface WorkerHeartbeatMetrics {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  containerCount: number;
}

export interface ListWorkersFilters {
  status?: string;
  search?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export class WorkerService {
  /**
   * Generate installation script with auth token
   */
  static async generateWorkerScript(adminUserId: string): Promise<{ script: string; token: string }> {
    try {
      // Generate unique auth token for worker
      const workerId = uuidv4();
      const token = jwt.sign(
        { 
          workerId,
          type: 'worker',
          generatedBy: adminUserId,
          generatedAt: new Date().toISOString()
        },
        config.JWT_SECRET,
        { expiresIn: '10y' } // Long-lived token for worker authentication
      );

      // Get API URL from environment (use VITE_API_URL or construct from CLIENT_URL)
      const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';
      const swarmAdvertiseAddr = process.env.DOCKER_SWARM_ADVERTISE_ADDR || 'auto';
      const heartbeatInterval = process.env.WORKER_HEARTBEAT_INTERVAL || '30';

      // Generate installation script
      const script = `#!/bin/bash
# SkyPanelV2 Container Platform Worker Installation Script
# Generated: ${new Date().toISOString()}

set -e

echo "🚀 Installing SkyPanelV2 Container Platform Worker..."

# Configuration
API_URL="${apiUrl}"
AUTH_TOKEN="${token}"
WORKER_ID="${workerId}"
HEARTBEAT_INTERVAL=${heartbeatInterval}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo "❌ Cannot detect OS"
  exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "✅ Docker already installed"
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs || yum install -y nodejs
else
  echo "✅ Node.js already installed"
fi

# Install Nix package manager (optional but recommended)
if ! command -v nix &> /dev/null; then
  echo "❄️  Installing Nix package manager..."
  sh <(curl -L https://nixos.org/nix/install) --daemon || echo "⚠️  Nix installation failed (optional)"
else
  echo "✅ Nix already installed"
fi

# Create worker directory
mkdir -p /opt/skypanel-worker
cd /opt/skypanel-worker

# Create worker configuration
cat > /opt/skypanel-worker/config.json <<EOF
{
  "apiUrl": "$API_URL",
  "authToken": "$AUTH_TOKEN",
  "workerId": "$WORKER_ID",
  "heartbeatInterval": $HEARTBEAT_INTERVAL
}
EOF

# Create worker agent script
cat > /opt/skypanel-worker/worker-agent.js <<'WORKER_SCRIPT'
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load configuration
const config = JSON.parse(fs.readFileSync('/opt/skypanel-worker/config.json', 'utf8'));

let isShuttingDown = false;

// Get system metrics
async function getSystemMetrics() {
  try {
    // Get CPU usage
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    
    // Get memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryPercent = ((totalMem - freeMem) / totalMem) * 100;
    
    // Get disk usage
    let diskPercent = 0;
    try {
      const { stdout } = await execPromise("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
      diskPercent = parseFloat(stdout.trim()) || 0;
    } catch (err) {
      console.error('Error getting disk usage:', err.message);
    }
    
    // Get container count
    let containerCount = 0;
    try {
      const { stdout } = await execPromise('docker ps -q | wc -l');
      containerCount = parseInt(stdout.trim()) || 0;
    } catch (err) {
      console.error('Error getting container count:', err.message);
    }
    
    return {
      cpuPercent: Math.min(100, Math.max(0, cpuUsage)),
      memoryPercent: Math.min(100, Math.max(0, memoryPercent)),
      diskPercent: Math.min(100, Math.max(0, diskPercent)),
      containerCount
    };
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return {
      cpuPercent: 0,
      memoryPercent: 0,
      diskPercent: 0,
      containerCount: 0
    };
  }
}

// Send heartbeat to manager
async function sendHeartbeat() {
  if (isShuttingDown) return;
  
  try {
    const metrics = await getSystemMetrics();
    
    const url = new URL(\`\${config.apiUrl}/api/workers/\${config.workerId}/heartbeat\`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const postData = JSON.stringify(metrics);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': \`Bearer \${config.authToken}\`
      }
    };
    
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(\`✅ Heartbeat sent - CPU: \${metrics.cpuPercent.toFixed(1)}%, Memory: \${metrics.memoryPercent.toFixed(1)}%, Disk: \${metrics.diskPercent.toFixed(1)}%, Containers: \${metrics.containerCount}\`);
        } else {
          console.error(\`❌ Heartbeat failed: \${res.statusCode} - \${data}\`);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Heartbeat error:', error.message);
    });
    
    req.write(postData);
    req.end();
  } catch (error) {
    console.error('❌ Error sending heartbeat:', error);
  }
}

// Graceful shutdown
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\\n🛑 Shutting down worker agent...');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start heartbeat loop
console.log(\`🚀 Worker agent started (ID: \${config.workerId})\`);
console.log(\`📡 API URL: \${config.apiUrl}\`);
console.log(\`⏱️  Heartbeat interval: \${config.heartbeatInterval}s\`);

// Send initial heartbeat
sendHeartbeat();

// Schedule periodic heartbeats
setInterval(sendHeartbeat, config.heartbeatInterval * 1000);
WORKER_SCRIPT

# Create systemd service
cat > /etc/systemd/system/skypanel-worker.service <<EOF
[Unit]
Description=SkyPanelV2 Container Platform Worker
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skypanel-worker
ExecStart=/usr/bin/node /opt/skypanel-worker/worker-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Join Docker Swarm
echo "🐝 Joining Docker Swarm..."
# Note: The actual swarm join command will be provided by the manager
# For now, we'll just ensure Docker is ready
docker info > /dev/null 2>&1 || (echo "❌ Docker is not running" && exit 1)

# Enable and start worker service
systemctl daemon-reload
systemctl enable skypanel-worker
systemctl start skypanel-worker

echo ""
echo "✅ Worker installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Join this worker to the Docker Swarm cluster:"
echo "   docker swarm join --token <SWARM_TOKEN> ${swarmAdvertiseAddr}:2377"
echo ""
echo "2. Check worker status:"
echo "   systemctl status skypanel-worker"
echo ""
echo "3. View worker logs:"
echo "   journalctl -u skypanel-worker -f"
echo ""
echo "Worker ID: ${workerId}"
`;

      return { script, token };
    } catch (error) {
      console.error('Error generating worker script:', error);
      throw error;
    }
  }

  /**
   * Register worker node with validation
   */
  static async registerWorker(
    authToken: string,
    workerInfo: WorkerRegistrationInfo
  ): Promise<WorkerNode> {
    try {
      // Verify auth token
      let decoded: any;
      try {
        decoded = jwt.verify(authToken, config.JWT_SECRET);
      } catch (error) {
        throw new Error('Invalid worker authentication token');
      }

      if (decoded.type !== 'worker') {
        throw new Error('Invalid token type');
      }

      const workerId = decoded.workerId;

      // Check if worker already exists
      const existingWorker = await query(
        'SELECT id, status FROM container_workers WHERE id = $1',
        [workerId]
      );

      if (existingWorker.rows.length > 0) {
        // Worker already registered, update it
        return await this.updateWorkerRegistration(workerId, workerInfo, authToken);
      }

      // Validate worker info
      this.validateWorkerInfo(workerInfo);

      // Generate worker name if not provided
      const workerName = `worker-${workerInfo.hostname}`;

      // Hash the auth token for storage
      const authTokenHash = crypto
        .createHash('sha256')
        .update(authToken)
        .digest('hex');

      return await transaction(async (client) => {
        const now = new Date();

        // Create worker record
        const result = await client.query(
          `INSERT INTO container_workers (
            id, name, hostname, ip_address, auth_token_hash, status,
            capacity, current_load, metadata, last_heartbeat_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            workerId,
            workerName,
            workerInfo.hostname,
            workerInfo.ipAddress,
            authTokenHash,
            'active',
            JSON.stringify(workerInfo.capacity),
            JSON.stringify({
              cpuPercent: 0,
              memoryPercent: 0,
              diskPercent: 0,
              containerCount: 0
            }),
            JSON.stringify(workerInfo.metadata || {}),
            now,
            now,
            now
          ]
        );

        console.log(`✅ Worker registered: ${workerName} (${workerId})`);

        return this.mapRowToWorker(result.rows[0]);
      });
    } catch (error) {
      console.error('Error registering worker:', error);
      throw error;
    }
  }

  /**
   * Update worker registration (for re-registration)
   */
  private static async updateWorkerRegistration(
    workerId: string,
    workerInfo: WorkerRegistrationInfo,
    authToken: string
  ): Promise<WorkerNode> {
    try {
      const authTokenHash = crypto
        .createHash('sha256')
        .update(authToken)
        .digest('hex');

      const result = await query(
        `UPDATE container_workers 
         SET hostname = $1, ip_address = $2, capacity = $3, metadata = $4,
             auth_token_hash = $5, status = $6, last_heartbeat_at = $7, updated_at = $8
         WHERE id = $9
         RETURNING *`,
        [
          workerInfo.hostname,
          workerInfo.ipAddress,
          JSON.stringify(workerInfo.capacity),
          JSON.stringify(workerInfo.metadata || {}),
          authTokenHash,
          'active',
          new Date(),
          new Date(),
          workerId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Worker not found');
      }

      console.log(`✅ Worker re-registered: ${workerId}`);

      return this.mapRowToWorker(result.rows[0]);
    } catch (error) {
      console.error('Error updating worker registration:', error);
      throw error;
    }
  }

  /**
   * Update worker heartbeat with metrics
   */
  static async updateWorkerHeartbeat(
    workerId: string,
    metrics: WorkerHeartbeatMetrics
  ): Promise<void> {
    try {
      // Validate metrics
      this.validateMetrics(metrics);

      const now = new Date();

      // Determine worker status based on metrics
      let status: 'active' | 'unhealthy' = 'active';
      
      // Check for resource exhaustion
      if (
        metrics.cpuPercent > 90 ||
        metrics.memoryPercent > 95 ||
        metrics.diskPercent > 90
      ) {
        status = 'unhealthy';
      }

      await query(
        `UPDATE container_workers 
         SET current_load = $1, last_heartbeat_at = $2, status = $3, updated_at = $4
         WHERE id = $5`,
        [
          JSON.stringify(metrics),
          now,
          status,
          now,
          workerId
        ]
      );

      // Log resource exhaustion warnings
      if (status === 'unhealthy') {
        console.warn(
          `⚠️  Worker ${workerId} resource exhaustion detected - ` +
          `CPU: ${metrics.cpuPercent.toFixed(1)}%, ` +
          `Memory: ${metrics.memoryPercent.toFixed(1)}%, ` +
          `Disk: ${metrics.diskPercent.toFixed(1)}%`
        );
      }
    } catch (error) {
      console.error('Error updating worker heartbeat:', error);
      throw error;
    }
  }

  /**
   * Get worker status and capacity
   */
  static async getWorkerStatus(workerId: string): Promise<WorkerNode | null> {
    try {
      const result = await query(
        'SELECT * FROM container_workers WHERE id = $1',
        [workerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToWorker(result.rows[0]);
    } catch (error) {
      console.error('Error getting worker status:', error);
      throw error;
    }
  }

  /**
   * List workers with filtering
   */
  static async listWorkers(
    filters: ListWorkersFilters = {},
    pagination: PaginationParams = {}
  ): Promise<{ workers: WorkerNode[]; total: number }> {
    try {
      const { limit = 50, offset = 0 } = pagination;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR hostname ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM container_workers ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get workers
      const workersResult = await query(
        `SELECT * FROM container_workers 
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const workers = workersResult.rows.map(row => this.mapRowToWorker(row));

      return { workers, total };
    } catch (error) {
      console.error('Error listing workers:', error);
      throw error;
    }
  }

  /**
   * Remove worker node
   */
  static async removeWorker(workerId: string): Promise<void> {
    try {
      await transaction(async (client) => {
        // Check if worker has running containers
        const containersResult = await client.query(
          `SELECT COUNT(*) as count FROM container_deployments 
           WHERE worker_id = $1 AND status = 'running'`,
          [workerId]
        );

        const runningContainers = parseInt(containersResult.rows[0].count);

        if (runningContainers > 0) {
          throw new Error(
            `Cannot remove worker: ${runningContainers} containers still running. ` +
            `Please drain the worker first.`
          );
        }

        // Delete worker
        await client.query(
          'DELETE FROM container_workers WHERE id = $1',
          [workerId]
        );

        console.log(`✅ Worker ${workerId} removed`);
      });
    } catch (error) {
      console.error('Error removing worker:', error);
      throw error;
    }
  }

  /**
   * Drain worker (gracefully move containers)
   */
  static async drainWorker(workerId: string): Promise<void> {
    try {
      // Update worker status to draining
      await query(
        `UPDATE container_workers 
         SET status = $1, updated_at = $2 
         WHERE id = $3`,
        ['draining', new Date(), workerId]
      );

      console.log(`✅ Worker ${workerId} marked for draining`);

      // Note: Actual container migration will be handled by the migration service
      // This just marks the worker as draining so no new containers are scheduled
    } catch (error) {
      console.error('Error draining worker:', error);
      throw error;
    }
  }

  /**
   * Validate worker info
   */
  private static validateWorkerInfo(info: WorkerRegistrationInfo): void {
    if (!info.hostname || info.hostname.length === 0) {
      throw new Error('Hostname is required');
    }

    if (!info.ipAddress || !this.isValidIpAddress(info.ipAddress)) {
      throw new Error('Valid IP address is required');
    }

    if (!info.capacity) {
      throw new Error('Capacity information is required');
    }

    if (info.capacity.cpuCores <= 0 || info.capacity.cpuCores > 256) {
      throw new Error('CPU cores must be between 1 and 256');
    }

    if (info.capacity.memoryMb <= 0 || info.capacity.memoryMb > 1048576) {
      throw new Error('Memory must be between 1 MB and 1 TB');
    }

    if (info.capacity.diskGb <= 0 || info.capacity.diskGb > 10240) {
      throw new Error('Disk must be between 1 GB and 10 TB');
    }
  }

  /**
   * Validate metrics
   */
  private static validateMetrics(metrics: WorkerHeartbeatMetrics): void {
    if (
      typeof metrics.cpuPercent !== 'number' ||
      metrics.cpuPercent < 0 ||
      metrics.cpuPercent > 100
    ) {
      throw new Error('CPU percent must be between 0 and 100');
    }

    if (
      typeof metrics.memoryPercent !== 'number' ||
      metrics.memoryPercent < 0 ||
      metrics.memoryPercent > 100
    ) {
      throw new Error('Memory percent must be between 0 and 100');
    }

    if (
      typeof metrics.diskPercent !== 'number' ||
      metrics.diskPercent < 0 ||
      metrics.diskPercent > 100
    ) {
      throw new Error('Disk percent must be between 0 and 100');
    }

    if (
      typeof metrics.containerCount !== 'number' ||
      metrics.containerCount < 0
    ) {
      throw new Error('Container count must be a non-negative number');
    }
  }

  /**
   * Validate IP address
   */
  private static isValidIpAddress(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Regex.test(ip);
  }

  /**
   * Map database row to WorkerNode object
   */
  private static mapRowToWorker(row: any): WorkerNode {
    return {
      id: row.id,
      name: row.name,
      hostname: row.hostname,
      ipAddress: row.ip_address,
      swarmNodeId: row.swarm_node_id || undefined,
      authTokenHash: row.auth_token_hash,
      status: row.status,
      capacity: typeof row.capacity === 'string' 
        ? JSON.parse(row.capacity) 
        : row.capacity,
      currentLoad: typeof row.current_load === 'string'
        ? JSON.parse(row.current_load)
        : row.current_load,
      lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at) : undefined,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Check for unhealthy workers (missed heartbeats > 2 minutes)
   * This should be called periodically (e.g., every 30 seconds)
   */
  static async checkWorkerHealth(): Promise<void> {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      // Find workers that haven't sent heartbeat in 2 minutes
      const result = await query(
        `SELECT id, name, status, last_heartbeat_at 
         FROM container_workers 
         WHERE status IN ('active', 'unhealthy') 
         AND (last_heartbeat_at IS NULL OR last_heartbeat_at < $1)`,
        [twoMinutesAgo]
      );

      for (const row of result.rows) {
        const workerId = row.id;
        const workerName = row.name;
        const currentStatus = row.status;

        // Mark worker as offline
        await query(
          `UPDATE container_workers 
           SET status = $1, updated_at = $2 
           WHERE id = $3`,
          ['offline', new Date(), workerId]
        );

        console.warn(
          `⚠️  Worker ${workerName} (${workerId}) marked as offline - ` +
          `Last heartbeat: ${row.last_heartbeat_at || 'never'}`
        );

        // Send alert to administrators
        await this.sendWorkerAlert(workerId, 'offline', {
          workerName,
          lastHeartbeat: row.last_heartbeat_at,
          previousStatus: currentStatus
        });

        // Trigger container migration
        // Import dynamically to avoid circular dependency
        const { ContainerMigrationService } = await import('./ContainerMigrationService.js');
        
        // Get migration policy (default to automatic)
        const policy = 'automatic'; // In full implementation, get from organization settings
        
        // Handle worker failure asynchronously
        ContainerMigrationService.handleWorkerFailure(workerId, policy)
          .then(result => {
            console.log(
              `Migration result for worker ${workerId}: ` +
              `${result.migratedContainers} succeeded, ${result.failedContainers} failed`
            );
          })
          .catch(err => {
            console.error(`Error in migration for worker ${workerId}:`, err);
          });
      }
    } catch (error) {
      console.error('Error checking worker health:', error);
    }
  }

  /**
   * Check for recovered workers
   * This should be called after a successful heartbeat
   */
  static async checkWorkerRecovery(workerId: string): Promise<void> {
    try {
      const result = await query(
        'SELECT status, name FROM container_workers WHERE id = $1',
        [workerId]
      );

      if (result.rows.length === 0) {
        return;
      }

      const currentStatus = result.rows[0].status;
      const workerName = result.rows[0].name;

      // If worker was offline or unhealthy and is now active, send recovery notification
      if (currentStatus === 'offline' || currentStatus === 'unhealthy') {
        await query(
          `UPDATE container_workers 
           SET status = $1, updated_at = $2 
           WHERE id = $3`,
          ['active', new Date(), workerId]
        );

        console.log(`✅ Worker ${workerName} (${workerId}) recovered`);

        // Send recovery notification to administrators
        await this.sendWorkerAlert(workerId, 'recovered', {
          workerName,
          previousStatus: currentStatus
        });
      }
    } catch (error) {
      console.error('Error checking worker recovery:', error);
    }
  }

  /**
   * Send worker alert to administrators
   */
  private static async sendWorkerAlert(
    workerId: string,
    alertType: 'offline' | 'unhealthy' | 'recovered' | 'resource_exhaustion',
    metadata: any
  ): Promise<void> {
    try {
      // Get all admin users
      const adminsResult = await query(
        "SELECT id FROM users WHERE role = 'admin'",
        []
      );

      const adminIds = adminsResult.rows.map(row => row.id);

      if (adminIds.length === 0) {
        console.warn('No admin users found to send worker alert');
        return;
      }

      // Prepare notification message
      let message = '';
      let notificationType = 'worker_alert';

      switch (alertType) {
        case 'offline':
          message = `Worker ${metadata.workerName} is offline. Last heartbeat: ${metadata.lastHeartbeat || 'never'}`;
          notificationType = 'worker_offline';
          break;
        case 'unhealthy':
          message = `Worker ${metadata.workerName} is unhealthy. Resource exhaustion detected.`;
          notificationType = 'worker_unhealthy';
          break;
        case 'recovered':
          message = `Worker ${metadata.workerName} has recovered and is now active.`;
          notificationType = 'worker_recovered';
          break;
        case 'resource_exhaustion':
          message = `Worker ${metadata.workerName} resource exhaustion: CPU ${metadata.cpuPercent}%, Memory ${metadata.memoryPercent}%, Disk ${metadata.diskPercent}%`;
          notificationType = 'worker_resource_exhaustion';
          break;
      }

      // Insert notifications for all admins
      for (const adminId of adminIds) {
        await query(
          `INSERT INTO notifications (id, user_id, type, message, metadata, read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            adminId,
            notificationType,
            message,
            JSON.stringify({ workerId, ...metadata }),
            false,
            new Date()
          ]
        );
      }

      // Trigger PostgreSQL NOTIFY for real-time updates
      await query(
        `NOTIFY worker_alerts, '${JSON.stringify({ workerId, alertType, metadata })}'`,
        []
      );

      console.log(`📢 Worker alert sent: ${alertType} - ${metadata.workerName}`);
    } catch (error) {
      console.error('Error sending worker alert:', error);
      // Don't throw - alerting failure shouldn't break the main flow
    }
  }

  /**
   * Get worker metrics for a time range
   */
  static async getWorkerMetrics(
    workerId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any[]> {
    try {
      // For now, return current metrics
      // In a full implementation, this would query a time-series database
      const worker = await this.getWorkerStatus(workerId);
      
      if (!worker) {
        return [];
      }

      return [{
        timestamp: worker.lastHeartbeatAt || worker.updatedAt,
        cpuPercent: worker.currentLoad.cpuPercent,
        memoryPercent: worker.currentLoad.memoryPercent,
        diskPercent: worker.currentLoad.diskPercent,
        containerCount: worker.currentLoad.containerCount
      }];
    } catch (error) {
      console.error('Error getting worker metrics:', error);
      throw error;
    }
  }

  /**
   * Get cluster-wide statistics
   */
  static async getClusterStats(): Promise<{
    totalWorkers: number;
    activeWorkers: number;
    unhealthyWorkers: number;
    offlineWorkers: number;
    totalCapacity: { cpuCores: number; memoryMb: number; diskGb: number };
    totalLoad: { cpuPercent: number; memoryPercent: number; diskPercent: number };
    totalContainers: number;
  }> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_workers,
          COUNT(*) FILTER (WHERE status = 'active') as active_workers,
          COUNT(*) FILTER (WHERE status = 'unhealthy') as unhealthy_workers,
          COUNT(*) FILTER (WHERE status = 'offline') as offline_workers,
          COALESCE(SUM((capacity->>'cpuCores')::numeric), 0) as total_cpu,
          COALESCE(SUM((capacity->>'memoryMb')::numeric), 0) as total_memory,
          COALESCE(SUM((capacity->>'diskGb')::numeric), 0) as total_disk,
          COALESCE(AVG((current_load->>'cpuPercent')::numeric), 0) as avg_cpu_percent,
          COALESCE(AVG((current_load->>'memoryPercent')::numeric), 0) as avg_memory_percent,
          COALESCE(AVG((current_load->>'diskPercent')::numeric), 0) as avg_disk_percent,
          COALESCE(SUM((current_load->>'containerCount')::numeric), 0) as total_containers
         FROM container_workers
         WHERE status != 'offline'`,
        []
      );

      const row = result.rows[0];

      return {
        totalWorkers: parseInt(row.total_workers) || 0,
        activeWorkers: parseInt(row.active_workers) || 0,
        unhealthyWorkers: parseInt(row.unhealthy_workers) || 0,
        offlineWorkers: parseInt(row.offline_workers) || 0,
        totalCapacity: {
          cpuCores: parseFloat(row.total_cpu) || 0,
          memoryMb: parseFloat(row.total_memory) || 0,
          diskGb: parseFloat(row.total_disk) || 0
        },
        totalLoad: {
          cpuPercent: parseFloat(row.avg_cpu_percent) || 0,
          memoryPercent: parseFloat(row.avg_memory_percent) || 0,
          diskPercent: parseFloat(row.avg_disk_percent) || 0
        },
        totalContainers: parseInt(row.total_containers) || 0
      };
    } catch (error) {
      console.error('Error getting cluster stats:', error);
      throw error;
    }
  }
}
