# Worker Service Implementation

This document describes the implementation of the Worker Node Management system for the SkyPanelV2 Container Platform.

## Overview

The Worker Service provides comprehensive worker node management including:
- Worker registration and authentication
- Health monitoring with automatic failure detection
- Resource tracking and capacity management
- Automatic container migration on worker failure

## Components

### 1. WorkerService (`WorkerService.ts`)

Core service for worker node operations.

**Key Features:**
- **Worker Registration**: Generates installation scripts with auth tokens and handles worker registration
- **Heartbeat Processing**: Processes worker heartbeats every 30 seconds with resource metrics
- **Health Monitoring**: Detects unhealthy workers (missed heartbeats > 2 minutes)
- **Resource Tracking**: Monitors CPU, memory, disk usage and container count
- **Worker Management**: List, drain, and remove workers
- **Cluster Statistics**: Provides cluster-wide resource utilization metrics

**Key Methods:**
- `generateWorkerScript(adminUserId)`: Generates installation script with auth token
- `registerWorker(authToken, workerInfo)`: Registers new worker node
- `updateWorkerHeartbeat(workerId, metrics)`: Updates worker health and metrics
- `checkWorkerHealth()`: Checks for unhealthy workers (called periodically)
- `checkWorkerRecovery(workerId)`: Checks if worker has recovered
- `listWorkers(filters, pagination)`: Lists workers with filtering
- `removeWorker(workerId)`: Removes worker node
- `drainWorker(workerId)`: Marks worker for draining
- `getClusterStats()`: Returns cluster-wide statistics

**Health Detection:**
- Workers marked as `offline` after 2 minutes without heartbeat
- Workers marked as `unhealthy` when resource exhaustion detected:
  - CPU > 90%
  - Memory > 95%
  - Disk > 90%
- Automatic recovery detection when heartbeat resumes

**Alerts:**
- Worker offline notifications sent to administrators
- Worker unhealthy warnings sent to administrators
- Worker recovery notifications sent to administrators
- Resource exhaustion alerts with detailed metrics

### 2. WorkerHealthMonitor (`WorkerHealthMonitor.ts`)

Background service that periodically checks worker health.

**Features:**
- Runs health checks every 30 seconds (configurable)
- Singleton pattern for easy integration
- Graceful start/stop functionality

**Usage:**
```typescript
import { workerHealthMonitor } from './WorkerHealthMonitor.js';

// Start monitoring
workerHealthMonitor.start(30); // Check every 30 seconds

// Stop monitoring
workerHealthMonitor.stop();
```

### 3. ContainerMigrationService (`ContainerMigrationService.ts`)

Handles automatic container migration when workers fail.

**Migration Policies:**
- **Automatic**: Migrates containers immediately on worker failure (default)
- **Manual**: Requires administrator approval before migration
- **None**: No automatic migration

**Migration Process:**
1. Detects worker failure
2. Identifies all running containers on failed worker
3. For each container:
   - Calculates required resources
   - Selects healthy worker with available capacity (lowest load)
   - Creates new deployment on target worker
   - Updates service routing
   - Marks old deployment as stopped
4. Sends notifications to affected users
5. Sends summary to administrators

**Key Methods:**
- `handleWorkerFailure(workerId, policy)`: Handles worker failure and triggers migration
- `migrateContainersFromWorker(workerId)`: Migrates all containers from a worker
- `getMigrationPolicy(organizationId)`: Gets migration policy for organization

**Worker Selection:**
- Selects workers with sufficient capacity for required resources
- Prioritizes workers with lowest average load (CPU + Memory + Disk / 3)
- Validates available resources before migration

## Database Schema

### container_workers Table

```sql
CREATE TABLE container_workers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  swarm_node_id VARCHAR(255) UNIQUE,
  auth_token_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  capacity JSONB NOT NULL,
  current_load JSONB NOT NULL,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Status Values:**
- `pending`: Worker registered but not yet active
- `active`: Worker is healthy and accepting workloads
- `unhealthy`: Worker has resource exhaustion
- `draining`: Worker is being drained of containers
- `offline`: Worker has missed heartbeats for > 2 minutes

## Installation Script

The generated installation script:
1. Checks for root privileges
2. Installs Docker if not present
3. Installs Node.js if not present
4. Optionally installs Nix package manager
5. Creates worker configuration file
6. Creates worker agent script (Node.js)
7. Creates systemd service for automatic startup
8. Provides instructions for joining Docker Swarm

**Worker Agent Features:**
- Collects system metrics (CPU, memory, disk, container count)
- Sends heartbeat every 30 seconds to manager
- Handles graceful shutdown on SIGTERM/SIGINT
- Automatic retry on connection failures

## Integration Points

### With Existing Services

- **Database**: Uses existing `query()` and `transaction()` helpers
- **Notifications**: Integrates with notification system for real-time alerts
- **Authentication**: Uses JWT tokens for worker authentication
- **Activity Logging**: Logs all worker operations for audit trail

### With Container Platform

- **SwarmOrchestrator**: Coordinates with Docker Swarm for container deployment
- **ContainerService**: Provides worker information for deployment decisions
- **Billing**: Worker metrics used for capacity planning and cost allocation

## Monitoring & Alerts

### Administrator Notifications

- **Worker Offline**: Sent when worker misses heartbeats for > 2 minutes
- **Worker Unhealthy**: Sent when resource exhaustion detected
- **Worker Recovered**: Sent when offline/unhealthy worker recovers
- **Migration Summary**: Sent after container migration completes
- **Manual Migration Required**: Sent when manual migration policy is active

### User Notifications

- **Container Migrated**: Sent when container successfully migrated
- **Migration Failed**: Sent when container migration fails

## Configuration

### Environment Variables

```bash
# Worker heartbeat interval (seconds)
WORKER_HEARTBEAT_INTERVAL=30

# Worker heartbeat timeout (seconds)
WORKER_HEARTBEAT_TIMEOUT=120

# Docker Swarm advertise address
DOCKER_SWARM_ADVERTISE_ADDR=192.168.1.100
```

## Usage Examples

### Generate Worker Installation Script

```typescript
import { WorkerService } from './services/containers/WorkerService.js';

const { script, token } = await WorkerService.generateWorkerScript(adminUserId);
console.log('Installation script:', script);
console.log('Auth token:', token);
```

### Register Worker

```typescript
const workerInfo = {
  hostname: 'worker-1',
  ipAddress: '192.168.1.100',
  capacity: {
    cpuCores: 8,
    memoryMb: 16384,
    diskGb: 500
  },
  metadata: {
    osVersion: 'Ubuntu 22.04',
    dockerVersion: '24.0.0',
    nixVersion: '2.18.0'
  }
};

const worker = await WorkerService.registerWorker(authToken, workerInfo);
```

### Update Heartbeat

```typescript
const metrics = {
  cpuPercent: 45.2,
  memoryPercent: 62.8,
  diskPercent: 38.5,
  containerCount: 12
};

await WorkerService.updateWorkerHeartbeat(workerId, metrics);
```

### List Workers

```typescript
const { workers, total } = await WorkerService.listWorkers(
  { status: 'active' },
  { limit: 20, offset: 0 }
);
```

### Get Cluster Statistics

```typescript
const stats = await WorkerService.getClusterStats();
console.log('Total workers:', stats.totalWorkers);
console.log('Active workers:', stats.activeWorkers);
console.log('Total capacity:', stats.totalCapacity);
console.log('Average load:', stats.totalLoad);
```

## Testing

Basic unit tests are provided in `__tests__/WorkerService.test.ts` covering:
- Worker info validation
- Metrics validation
- IP address validation

## Future Enhancements

1. **Auto-scaling**: Automatically provision new workers when capacity is low
2. **Geographic Distribution**: Support for multi-region worker deployment
3. **Worker Pools**: Group workers by capabilities (GPU, high-memory, etc.)
4. **Advanced Scheduling**: Affinity rules, anti-affinity, and custom placement constraints
5. **Metrics History**: Store historical metrics in time-series database
6. **Predictive Scaling**: Use ML to predict capacity needs and scale proactively

## Security Considerations

- Worker auth tokens are long-lived JWT tokens (10 years)
- Tokens are hashed before storage in database
- Worker-to-manager communication should use HTTPS
- Installation script should be transmitted securely
- Worker nodes should be on isolated network segments
- Regular security audits of worker nodes recommended

## Performance Considerations

- Heartbeat interval of 30 seconds balances responsiveness with network overhead
- Health checks run asynchronously to avoid blocking
- Container migration is performed in parallel where possible
- Database queries use indexes on worker_id and status fields
- Cluster statistics are cached for 30 seconds to reduce database load

## Troubleshooting

### Worker Not Appearing in Dashboard

1. Check worker agent is running: `systemctl status skypanel-worker`
2. Check worker logs: `journalctl -u skypanel-worker -f`
3. Verify network connectivity to manager
4. Verify auth token is valid

### Worker Marked as Offline

1. Check worker agent is running
2. Check network connectivity
3. Check manager logs for heartbeat processing errors
4. Verify worker clock is synchronized (NTP)

### Container Migration Failing

1. Check target worker has sufficient capacity
2. Check Docker Swarm is healthy
3. Check container images are available on target worker
4. Review migration logs in database

## Related Documentation

- [Container Platform Design](../../../.kiro/specs/container-platform/design.md)
- [Container Platform Requirements](../../../.kiro/specs/container-platform/requirements.md)
- [Swarm Orchestrator README](./SWARM_ORCHESTRATOR_README.md)
