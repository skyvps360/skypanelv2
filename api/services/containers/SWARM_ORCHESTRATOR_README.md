# Docker Swarm Orchestrator Implementation

## Overview

The SwarmOrchestrator service provides complete Docker Swarm integration for the SkyPanelV2 container platform. It handles container orchestration, network isolation, and zero-downtime deployments with automatic rollback capabilities.

## Features Implemented

### 1. Swarm Initialization (Task 4.1)

**Key Methods:**
- `initializeSwarm()`: Initializes Docker Swarm manager node with auto-detection of advertise address
- `isSwarmInitialized()`: Checks if Swarm is already initialized
- `deployContainer()`: Deploys containers to Swarm with resource limits and health checks
- `scaleService()`: Scales service replicas up or down
- `removeService()`: Removes services from Swarm with cleanup
- `getServiceStatus()`: Gets real-time service status and health information
- `getServiceLogs()`: Retrieves service logs with filtering options

**Features:**
- Automatic Swarm initialization on first use
- Auto-detection of primary IP address for advertise address
- Support for custom advertise address via `DOCKER_SWARM_ADVERTISE_ADDR` environment variable
- Resource limits enforcement (CPU, memory)
- Automatic restart policies with exponential backoff
- Service labeling for tracking and management

### 2. Network Isolation (Task 4.2)

**Key Methods:**
- `createOrganizationNetwork()`: Creates isolated overlay networks per organization
- `ensureOrganizationNetwork()`: Ensures network exists before deployment
- `attachContainerToNetwork()`: Attaches containers to organization networks
- `configureServiceDiscovery()`: Configures internal DNS for service discovery
- `verifyCrossOrganizationIsolation()`: Verifies network isolation between organizations
- `listOrganizationServices()`: Lists all services in an organization network
- `removeOrganizationNetwork()`: Removes organization networks when no longer needed

**Features:**
- **Organization-Specific Networks**: Each organization gets its own isolated overlay network (`org-{organizationId}-network`)
- **Encrypted Traffic**: All overlay network traffic is encrypted by default
- **Service Discovery**: Automatic DNS resolution for services within the same organization
  - Services can be accessed via: `{service-slug}` or `{service-slug}.internal`
  - Example: `postgres://my-database:5432` for database connections
- **Cross-Organization Isolation**: Containers in different organizations cannot communicate by default
- **Subnet Isolation**: Each organization network gets its own subnet from Docker's default pool
- **Network Verification**: Built-in verification to ensure proper isolation

**Security:**
- Network namespace isolation prevents cross-organization communication
- Encrypted overlay network traffic
- Internal-only networks with controlled external access
- Automatic firewall rules at Docker network level

### 3. Service Update and Rollback (Task 4.3)

**Key Methods:**
- `updateService()`: Updates service configuration with zero-downtime rolling updates
- `rollbackService()`: Rolls back to previous deployment using Docker Swarm's built-in rollback
- `rollbackToDeployment()`: Rolls back to any specific previous deployment by image tag
- `getUpdateStatus()`: Monitors rolling update and rollback progress
- `preserveImageForRollback()`: Preserves container images for rollback capability
- `getDeploymentHistory()`: Retrieves deployment history for rollback options
- `performHealthCheck()`: Performs health checks after updates with automatic rollback on failure

**Features:**
- **Zero-Downtime Deployments**: 
  - Uses `start-first` strategy: new containers start before old ones stop
  - Rolling updates with configurable parallelism (default: 1 task at a time)
  - 10-second delay between updates to ensure stability
  - 15-second monitoring period for each update
- **Automatic Rollback**:
  - Automatic rollback if 30% or more tasks fail
  - Manual rollback to previous deployment
  - Rollback to any specific deployment by image tag
  - Preserves last 10 deployments for rollback
- **Health Checks**:
  - Configurable health check timeout (default: 60 seconds)
  - Checks every 2 seconds during deployment
  - Automatic rollback if health check fails
  - Monitors replica count and task states
- **Update Monitoring**:
  - Real-time update status tracking
  - States: updating, completed, paused, rollback_started, rollback_paused, rollback_completed
  - Detailed error messages for failed updates

**Rollback Strategies:**
1. **Immediate Rollback**: Use `rollbackService()` to rollback to the previous deployment
2. **Specific Version Rollback**: Use `rollbackToDeployment()` to rollback to any previous version
3. **Automatic Rollback**: Configured via `UpdateConfig.FailureAction = 'rollback'`

## Architecture

### Service Deployment Flow

```
1. User requests deployment
   ↓
2. SwarmOrchestrator.deployContainer()
   ↓
3. Ensure organization network exists
   ↓
4. Create/update Docker Swarm service
   ↓
5. Apply resource limits and labels
   ↓
6. Attach to organization network
   ↓
7. Configure service discovery
   ↓
8. Monitor deployment status
   ↓
9. Return service ID and container ID
```

### Network Isolation Architecture

```
Organization A                    Organization B
┌─────────────────────┐          ┌─────────────────────┐
│ org-123-network     │          │ org-456-network     │
│ (Overlay, Encrypted)│          │ (Overlay, Encrypted)│
│                     │          │                     │
│ ┌─────┐  ┌─────┐  │          │ ┌─────┐  ┌─────┐  │
│ │App1 │  │DB1  │  │          │ │App2 │  │DB2  │  │
│ └─────┘  └─────┘  │          │ └─────┘  └─────┘  │
│    ↕        ↕      │          │    ↕        ↕      │
│ Internal DNS       │          │ Internal DNS       │
│ app1, db1          │          │ app2, db2          │
└─────────────────────┘          └─────────────────────┘
         ↓                                ↓
    Isolated                         Isolated
    (No cross-org communication)
```

### Rolling Update Flow

```
Current State: v1 (2 replicas)
   ↓
Update to v2 initiated
   ↓
Start v2 replica 1 (3 total replicas)
   ↓
Wait 10 seconds + health check (15s)
   ↓
Stop v1 replica 1 (2 total replicas)
   ↓
Start v2 replica 2 (3 total replicas)
   ↓
Wait 10 seconds + health check (15s)
   ↓
Stop v1 replica 2 (2 total replicas)
   ↓
Update complete: v2 (2 replicas)

If any step fails:
   ↓
Automatic rollback to v1
```

## Configuration

### Environment Variables

```bash
# Docker Swarm Configuration
DOCKER_SWARM_ADVERTISE_ADDR=192.168.1.100  # Optional: Manager node IP
```

### Resource Limits

The orchestrator enforces the following resource limits per container:

- **CPU**: 0.5 - 16 cores (converted to nanocpus for Docker)
- **Memory**: 256 MB - 32 GB (with 50% reservation)
- **Disk**: 1 GB - 500 GB (enforced at service level)

### Update Configuration

Default rolling update settings:

```typescript
UpdateConfig: {
  Parallelism: 1,              // Update 1 task at a time
  Delay: 10000000000,          // 10 seconds between updates
  FailureAction: 'rollback',   // Auto-rollback on failure
  Monitor: 15000000000,        // Monitor for 15 seconds
  MaxFailureRatio: 0.3,        // Rollback if 30% fail
  Order: 'start-first'         // Zero-downtime
}
```

## Usage Examples

### Initialize Swarm

```typescript
import { swarmOrchestrator } from './services/containers/SwarmOrchestrator.js';

// Initialize Swarm (automatic on first deployment)
await swarmOrchestrator.initializeSwarm();
```

### Deploy a Container

```typescript
const deployment = await swarmOrchestrator.deployContainer({
  serviceId: 'service-123',
  deploymentId: 'deploy-456',
  imageName: 'myapp',
  imageTag: 'v1.0.0',
  organizationId: 'org-789',
  slug: 'my-app',
  resourceLimits: {
    cpuCores: 2,
    memoryMb: 2048,
    diskGb: 20
  },
  environmentVars: {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://db:5432/myapp'
  },
  internalPort: 3000,
  replicas: 2
});

console.log(`Deployed: ${deployment.swarmServiceId}`);
```

### Update a Service (Zero-Downtime)

```typescript
await swarmOrchestrator.updateService(swarmServiceId, {
  imageName: 'myapp',
  imageTag: 'v1.1.0',
  environmentVars: {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://db:5432/myapp',
    NEW_FEATURE: 'enabled'
  }
});

// Monitor update progress
const status = await swarmOrchestrator.getUpdateStatus(swarmServiceId);
console.log(`Update status: ${status.state}`);
```

### Rollback a Service

```typescript
// Rollback to previous deployment
await swarmOrchestrator.rollbackService(swarmServiceId);

// Or rollback to specific version
await swarmOrchestrator.rollbackToDeployment(
  swarmServiceId,
  'v1.0.0',
  'myapp'
);
```

### Scale a Service

```typescript
// Scale to 5 replicas
await swarmOrchestrator.scaleService(swarmServiceId, 5);

// Check status
const status = await swarmOrchestrator.getServiceStatus(swarmServiceId);
console.log(`Running: ${status.replicas.running}/${status.replicas.desired}`);
```

### Network Isolation

```typescript
// Create organization network (automatic during deployment)
const networkId = await swarmOrchestrator.createOrganizationNetwork('org-123');

// Verify isolation between organizations
const isolated = await swarmOrchestrator.verifyCrossOrganizationIsolation(
  'org-123',
  'org-456'
);
console.log(`Organizations isolated: ${isolated}`);

// List services in organization
const services = await swarmOrchestrator.listOrganizationServices('org-123');
console.log(`Services: ${services.map(s => s.name).join(', ')}`);
```

## Integration with ContainerService

The SwarmOrchestrator is designed to work seamlessly with the ContainerService:

```typescript
import { ContainerServiceManager } from './services/containers/ContainerService.js';
import { swarmOrchestrator } from './services/containers/SwarmOrchestrator.js';

// Create service
const service = await ContainerServiceManager.createService({
  organizationId: 'org-123',
  name: 'My App',
  resourceLimits: { cpuCores: 2, memoryMb: 2048, diskGb: 20 }
});

// Deploy to Swarm
const deployment = await swarmOrchestrator.deployContainer({
  serviceId: service.id,
  deploymentId: 'deploy-123',
  imageName: 'myapp',
  imageTag: 'latest',
  organizationId: service.organizationId,
  slug: service.slug,
  resourceLimits: service.resourceLimits,
  environmentVars: service.environmentVars
});

// Update service status
await ContainerServiceManager.handleDeploymentSuccess(
  service.id,
  'deploy-123'
);
```

## Error Handling

The orchestrator includes comprehensive error handling:

- **Swarm Not Initialized**: Automatically initializes Swarm on first use
- **Service Already Exists**: Updates existing service instead of creating new one
- **Network Errors**: Retries network creation with exponential backoff
- **Deployment Failures**: Automatic rollback on failure
- **Resource Exhaustion**: Clear error messages with current usage
- **Invalid Configuration**: Validation before deployment

## Testing

To test the SwarmOrchestrator:

```bash
# Ensure Docker is running
docker info

# Initialize Swarm (if not already initialized)
docker swarm init

# Run tests
npm test -- SwarmOrchestrator
```

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- **Requirement 3.3**: Docker Swarm orchestration with resource limits
- **Requirement 9.1**: Network isolation per organization
- **Requirement 9.2**: Service discovery within organization networks
- **Requirement 9.3**: Block cross-organization communication
- **Requirement 7.3**: Zero-downtime deployment with rollback

## Next Steps

The SwarmOrchestrator is now ready for integration with:

1. **Worker Management** (Task 5): Worker node registration and health monitoring
2. **Nix Build Pipeline** (Task 6): Building container images from Nix expressions
3. **API Routes** (Task 13): Exposing orchestration functionality via REST API
4. **Frontend Components** (Task 14): UI for managing deployments and rollbacks

## Notes

- The orchestrator uses Docker's native Swarm mode, which is included with Docker Engine
- No additional orchestration tools (Kubernetes, Nomad) are required
- All network traffic between containers is encrypted by default
- The implementation follows Docker best practices for production deployments
- Resource limits are enforced at the Docker cgroups level for hard limits
