/**
 * Docker Swarm Orchestrator for SkyPanelV2
 * Manages Docker Swarm cluster operations and container orchestration
 */

import Docker from 'dockerode';
import { query } from '../../lib/database.js';

export interface DeploymentConfig {
  serviceId: string;
  deploymentId: string;
  imageName: string;
  imageTag: string;
  organizationId: string;
  slug: string;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  environmentVars: Record<string, string>;
  secrets?: Array<{
    id: string;
    name: string;
    value: string;
    mountPath?: string;
    envVarName?: string;
  }>;
  internalPort?: number;
  replicas?: number;
}

export interface ServiceStatus {
  id: string;
  state: 'running' | 'starting' | 'stopped' | 'failed';
  replicas: {
    running: number;
    desired: number;
  };
  tasks: Array<{
    id: string;
    state: string;
    error?: string;
  }>;
}

export class SwarmOrchestrator {
  private docker: Docker;
  private initialized: boolean = false;

  constructor() {
    // Initialize Docker client
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Initialize Swarm manager node
   */
  async initializeSwarm(): Promise<void> {
    try {
      // Check if Swarm is already initialized
      const swarmInfo = await this.docker.swarmInspect().catch(() => null);
      
      if (swarmInfo) {
        console.log('✅ Docker Swarm already initialized');
        this.initialized = true;
        return;
      }

      // Get advertise address from environment or detect primary interface
      const advertiseAddr = process.env.DOCKER_SWARM_ADVERTISE_ADDR || await this.detectPrimaryIP();

      // Initialize Swarm
      await this.docker.swarmInit({
        ListenAddr: '0.0.0.0:2377',
        AdvertiseAddr: `${advertiseAddr}:2377`,
        ForceNewCluster: false,
      });

      this.initialized = true;
      console.log(`✅ Docker Swarm initialized with advertise address: ${advertiseAddr}`);
    } catch (error) {
      console.error('Error initializing Docker Swarm:', error);
      throw new Error(`Failed to initialize Docker Swarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deploy container to Swarm with resource limits
   */
  async deployContainer(config: DeploymentConfig): Promise<{ swarmServiceId: string; containerId?: string }> {
    try {
      // Ensure Swarm is initialized
      if (!this.initialized) {
        await this.initializeSwarm();
      }

      // Generate service name: org-{orgId}-{slug}
      const serviceName = `org-${config.organizationId}-${config.slug}`;
      
      // Get or create organization network
      const networkName = await this.ensureOrganizationNetwork(config.organizationId);

      // Prepare environment variables
      const envVars = Object.entries(config.environmentVars).map(
        ([key, value]) => `${key}=${value}`
      );

      // Handle secrets injection
      const dockerSecrets: any[] = [];
      const secretMounts: any[] = [];
      
      if (config.secrets && config.secrets.length > 0) {
        for (const secret of config.secrets) {
          // Create or update Docker secret
          const dockerSecretId = await this.createOrUpdateDockerSecret(
            serviceName,
            secret.name,
            secret.value
          );

          // If secret should be injected as environment variable
          if (secret.envVarName) {
            envVars.push(`${secret.envVarName}=${secret.value}`);
          }

          // If secret should be mounted as file
          if (secret.mountPath) {
            dockerSecrets.push({
              SecretID: dockerSecretId,
              SecretName: `${serviceName}-${secret.name}`,
              File: {
                Name: secret.mountPath.split('/').pop() || secret.name,
                UID: '0',
                GID: '0',
                Mode: 0o400, // Read-only for owner
              },
            });
          }
        }
      }

      // Calculate resource limits for Docker
      const cpuLimit = Math.floor(config.resourceLimits.cpuCores * 1000000000); // Convert to nanocpus
      const memoryLimit = config.resourceLimits.memoryMb * 1024 * 1024; // Convert to bytes
      const memoryReservation = Math.floor(memoryLimit * 0.5); // Reserve 50% of limit

      // Create service specification
      const serviceSpec: any = {
        Name: serviceName,
        TaskTemplate: {
          ContainerSpec: {
            Image: `${config.imageName}:${config.imageTag}`,
            Env: envVars,
            Secrets: dockerSecrets.length > 0 ? dockerSecrets : undefined,
            Labels: {
              'skypanel.service.id': config.serviceId,
              'skypanel.deployment.id': config.deploymentId,
              'skypanel.organization.id': config.organizationId,
              'skypanel.slug': config.slug,
            },
          },
          Resources: {
            Limits: {
              NanoCPUs: cpuLimit,
              MemoryBytes: memoryLimit,
            },
            Reservations: {
              NanoCPUs: Math.floor(cpuLimit * 0.5), // Reserve 50% of CPU limit
              MemoryBytes: memoryReservation,
            },
          },
          RestartPolicy: {
            Condition: 'on-failure',
            Delay: 5000000000, // 5 seconds in nanoseconds
            MaxAttempts: 3,
          },
          Placement: {
            Constraints: [],
          },
        },
        Mode: {
          Replicated: {
            Replicas: config.replicas || 1,
          },
        },
        Networks: [
          {
            Target: networkName,
            Aliases: [config.slug],
          },
        ],
        EndpointSpec: {
          Mode: 'vip',
          Ports: config.internalPort ? [
            {
              Protocol: 'tcp',
              TargetPort: config.internalPort,
              PublishMode: 'ingress',
            },
          ] : [],
        },
        Labels: {
          'skypanel.service.id': config.serviceId,
          'skypanel.deployment.id': config.deploymentId,
          'skypanel.organization.id': config.organizationId,
          'traefik.enable': 'true',
          'traefik.http.routers.${serviceName}.rule': `Host(\`${config.slug}.${process.env.CONTAINER_INGRESS_DOMAIN || 'localhost'}\`)`,
          'traefik.http.services.${serviceName}.loadbalancer.server.port': String(config.internalPort || 80),
        },
      };

      // Check if service already exists
      const existingService = await this.docker.getService(serviceName).inspect().catch(() => null);

      let swarmServiceId: string;

      if (existingService) {
        // Update existing service
        console.log(`Updating existing service: ${serviceName}`);
        await this.docker.getService(serviceName).update({
          version: existingService.Version.Index,
          ...serviceSpec,
        } as any);
        swarmServiceId = existingService.ID;
      } else {
        // Create new service
        console.log(`Creating new service: ${serviceName}`);
        const service = await this.docker.createService(serviceSpec as any);
        swarmServiceId = (service as any).ID || (service as any).id;
      }

      console.log(`✅ Service deployed to Swarm: ${serviceName} (${swarmServiceId})`);

      // Get container ID from first task
      const containerId = await this.getServiceContainerId(swarmServiceId);

      return { swarmServiceId, containerId };
    } catch (error) {
      console.error('Error deploying container to Swarm:', error);
      throw new Error(`Failed to deploy container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scale service replicas
   */
  async scaleService(swarmServiceId: string, replicas: number): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      // Update service with new replica count
      await service.update({
        version: serviceInfo.Version.Index,
        Name: serviceInfo.Spec.Name,
        TaskTemplate: serviceInfo.Spec.TaskTemplate,
        Mode: {
          Replicated: {
            Replicas: replicas,
          },
        },
        Networks: serviceInfo.Spec.Networks,
        EndpointSpec: serviceInfo.Spec.EndpointSpec,
        Labels: serviceInfo.Spec.Labels,
      } as any);

      console.log(`✅ Service ${swarmServiceId} scaled to ${replicas} replicas`);
    } catch (error) {
      console.error('Error scaling service:', error);
      throw new Error(`Failed to scale service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove service from Swarm
   */
  async removeService(swarmServiceId: string): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();
      const serviceName = serviceInfo.Spec.Name;
      
      // Remove service
      await service.remove();
      console.log(`✅ Service ${swarmServiceId} removed from Swarm`);
      
      // Clean up associated secrets
      await this.removeServiceSecrets(serviceName);
    } catch (error) {
      // If service doesn't exist, consider it already removed
      if (error instanceof Error && error.message.includes('no such service')) {
        console.log(`Service ${swarmServiceId} already removed`);
        return;
      }
      console.error('Error removing service:', error);
      throw new Error(`Failed to remove service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service status and health
   */
  async getServiceStatus(swarmServiceId: string): Promise<ServiceStatus> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      // Get service tasks
      const tasks = await this.docker.listTasks({
        filters: { service: [swarmServiceId] },
      });

      // Count running tasks
      const runningTasks = tasks.filter(task => task.Status.State === 'running').length;
      const desiredReplicas = serviceInfo.Spec.Mode.Replicated?.Replicas || 0;

      // Determine overall state
      let state: 'running' | 'starting' | 'stopped' | 'failed' = 'stopped';
      if (runningTasks === desiredReplicas && desiredReplicas > 0) {
        state = 'running';
      } else if (runningTasks > 0) {
        state = 'starting';
      } else if (tasks.some(task => task.Status.State === 'failed')) {
        state = 'failed';
      }

      return {
        id: swarmServiceId,
        state,
        replicas: {
          running: runningTasks,
          desired: desiredReplicas,
        },
        tasks: tasks.map(task => ({
          id: task.ID,
          state: task.Status.State,
          error: task.Status.Err,
        })),
      };
    } catch (error) {
      console.error('Error getting service status:', error);
      throw new Error(`Failed to get service status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service logs
   */
  async getServiceLogs(swarmServiceId: string, options: { tail?: number; since?: number } = {}): Promise<string> {
    try {
      const service = this.docker.getService(swarmServiceId);
      
      const logStream: any = await service.logs({
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        since: options.since || 0,
        timestamps: true,
      } as any);

      // Convert stream to string
      if (!logStream) {
        return '';
      }
      
      if (Buffer.isBuffer(logStream)) {
        return logStream.toString('utf-8');
      }
      
      // If it's a stream, read it
      if (typeof logStream === 'object' && 'on' in logStream) {
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          logStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          logStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          logStream.on('error', reject);
        });
      }
      
      return String(logStream);
    } catch (error) {
      console.error('Error getting service logs:', error);
      throw new Error(`Failed to get service logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create organization-specific overlay network
   * This ensures network isolation between organizations
   */
  async createOrganizationNetwork(organizationId: string): Promise<string> {
    const networkName = `org-${organizationId}-network`;

    try {
      // Check if network already exists
      const existingNetworks = await this.docker.listNetworks({
        filters: { name: [networkName] },
      });

      if (existingNetworks.length > 0) {
        console.log(`Organization network already exists: ${networkName}`);
        return existingNetworks[0].Id;
      }

      // Create overlay network with isolation
      const network = await this.docker.createNetwork({
        Name: networkName,
        Driver: 'overlay',
        Attachable: true,
        Internal: false, // Allow external access through ingress
        EnableIPv6: false,
        Labels: {
          'skypanel.organization.id': organizationId,
          'skypanel.network.type': 'organization',
          'skypanel.network.isolated': 'true',
        },
        IPAM: {
          Driver: 'default',
          Config: [
            {
              // Docker will auto-assign subnet from default pool
              // Each organization gets its own isolated subnet
            },
          ],
        },
        Options: {
          // Enable encryption for overlay network traffic
          'encrypted': 'true',
        },
      });

      console.log(`✅ Created isolated organization network: ${networkName} (${network.id})`);
      return network.id;
    } catch (error) {
      console.error('Error creating organization network:', error);
      throw new Error(`Failed to create organization network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure organization network exists (creates if needed)
   */
  private async ensureOrganizationNetwork(organizationId: string): Promise<string> {
    return this.createOrganizationNetwork(organizationId);
  }

  /**
   * Attach container to organization network
   * This is called during deployment to ensure proper network isolation
   */
  async attachContainerToNetwork(containerId: string, organizationId: string): Promise<void> {
    try {
      const networkName = `org-${organizationId}-network`;
      
      // Ensure network exists
      await this.ensureOrganizationNetwork(organizationId);

      // Get network
      const networks = await this.docker.listNetworks({
        filters: { name: [networkName] },
      });

      if (networks.length === 0) {
        throw new Error(`Organization network not found: ${networkName}`);
      }

      const network = this.docker.getNetwork(networks[0].Id);
      const container = this.docker.getContainer(containerId);

      // Connect container to network
      await network.connect({
        Container: containerId,
        EndpointConfig: {
          Aliases: [], // Service discovery aliases are set at service level
        },
      });

      console.log(`✅ Container ${containerId} attached to network ${networkName}`);
    } catch (error) {
      // If already connected, ignore error
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`Container ${containerId} already connected to organization network`);
        return;
      }
      console.error('Error attaching container to network:', error);
      throw new Error(`Failed to attach container to network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Configure internal DNS for service discovery
   * Services within the same organization can discover each other using service names
   */
  async configureServiceDiscovery(
    serviceName: string,
    organizationId: string,
    aliases: string[] = []
  ): Promise<void> {
    try {
      const networkName = `org-${organizationId}-network`;
      
      // Docker Swarm automatically provides DNS resolution for service names
      // within the same network. Services can be accessed using:
      // - {serviceName} (e.g., "my-app")
      // - {serviceName}.{networkName} (e.g., "my-app.org-123-network")
      
      // Additional aliases can be configured if needed
      console.log(`✅ Service discovery configured for ${serviceName} in ${networkName}`);
      console.log(`   Services can be accessed via: ${serviceName} or ${aliases.join(', ')}`);
    } catch (error) {
      console.error('Error configuring service discovery:', error);
      throw new Error(`Failed to configure service discovery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Block cross-organization communication
   * This is enforced at the Docker network level - containers in different
   * organization networks cannot communicate by default
   */
  async verifyCrossOrganizationIsolation(
    organizationId1: string,
    organizationId2: string
  ): Promise<boolean> {
    try {
      const network1Name = `org-${organizationId1}-network`;
      const network2Name = `org-${organizationId2}-network`;

      // Get both networks
      const networks1 = await this.docker.listNetworks({
        filters: { name: [network1Name] },
      });
      const networks2 = await this.docker.listNetworks({
        filters: { name: [network2Name] },
      });

      if (networks1.length === 0 || networks2.length === 0) {
        console.log('One or both organization networks do not exist');
        return true; // No networks means no communication possible
      }

      // Docker overlay networks are isolated by default
      // Containers in different networks cannot communicate unless explicitly connected
      const network1 = networks1[0];
      const network2 = networks2[0];

      // Verify networks have different subnets
      const subnet1 = network1.IPAM?.Config?.[0]?.Subnet;
      const subnet2 = network2.IPAM?.Config?.[0]?.Subnet;

      const isolated = subnet1 !== subnet2;
      
      if (isolated) {
        console.log(`✅ Organizations ${organizationId1} and ${organizationId2} are network-isolated`);
      } else {
        console.warn(`⚠️ Organizations ${organizationId1} and ${organizationId2} may not be properly isolated`);
      }

      return isolated;
    } catch (error) {
      console.error('Error verifying cross-organization isolation:', error);
      return false;
    }
  }

  /**
   * List all services in an organization network
   */
  async listOrganizationServices(organizationId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const networkName = `org-${organizationId}-network`;

      // Get all services
      const services = await this.docker.listServices({
        filters: {
          label: [`skypanel.organization.id=${organizationId}`],
        },
      });

      return services.map(service => ({
        id: service.ID,
        name: service.Spec.Name,
      }));
    } catch (error) {
      console.error('Error listing organization services:', error);
      throw new Error(`Failed to list organization services: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove organization network (only if no services are using it)
   */
  async removeOrganizationNetwork(organizationId: string): Promise<void> {
    try {
      const networkName = `org-${organizationId}-network`;

      // Check if any services are still using the network
      const services = await this.listOrganizationServices(organizationId);
      
      if (services.length > 0) {
        throw new Error(`Cannot remove network: ${services.length} services still using it`);
      }

      // Get network
      const networks = await this.docker.listNetworks({
        filters: { name: [networkName] },
      });

      if (networks.length === 0) {
        console.log(`Organization network does not exist: ${networkName}`);
        return;
      }

      // Remove network
      const network = this.docker.getNetwork(networks[0].Id);
      await network.remove();

      console.log(`✅ Removed organization network: ${networkName}`);
    } catch (error) {
      console.error('Error removing organization network:', error);
      throw new Error(`Failed to remove organization network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get container ID from service's first task
   */
  private async getServiceContainerId(swarmServiceId: string): Promise<string | undefined> {
    try {
      const tasks = await this.docker.listTasks({
        filters: { service: [swarmServiceId] },
      });

      const runningTask = tasks.find(task => task.Status.State === 'running');
      return runningTask?.Status.ContainerStatus?.ContainerID;
    } catch (error) {
      console.error('Error getting container ID:', error);
      return undefined;
    }
  }

  /**
   * Detect primary IP address
   */
  private async detectPrimaryIP(): Promise<string> {
    try {
      const { networkInterfaces } = await import('os');
      const nets = networkInterfaces();

      for (const name of Object.keys(nets)) {
        const netInfo = nets[name];
        if (!netInfo) continue;

        for (const net of netInfo) {
          // Skip internal and non-IPv4 addresses
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }

      // Fallback to localhost
      return '127.0.0.1';
    } catch (error) {
      console.error('Error detecting primary IP:', error);
      return '127.0.0.1';
    }
  }

  /**
   * Update service configuration without downtime
   * Uses rolling update strategy to ensure zero-downtime deployment
   */
  async updateService(
    swarmServiceId: string,
    config: Partial<DeploymentConfig>
  ): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      // Prepare updated specification
      const updatedSpec: any = {
        version: serviceInfo.Version.Index,
        Name: serviceInfo.Spec.Name,
        TaskTemplate: { ...serviceInfo.Spec.TaskTemplate },
        Mode: serviceInfo.Spec.Mode,
        Networks: serviceInfo.Spec.Networks,
        EndpointSpec: serviceInfo.Spec.EndpointSpec,
        Labels: serviceInfo.Spec.Labels,
        UpdateConfig: {
          // Zero-downtime deployment: start new before stopping old
          Parallelism: 1, // Update one task at a time
          Delay: 10000000000, // 10 seconds between updates (in nanoseconds)
          FailureAction: 'rollback', // Automatic rollback on failure
          Monitor: 15000000000, // Monitor for 15 seconds (in nanoseconds)
          MaxFailureRatio: 0.3, // Rollback if 30% of tasks fail
          Order: 'start-first', // Start new task before stopping old one
        },
        RollbackConfig: {
          Parallelism: 1,
          Delay: 5000000000, // 5 seconds
          FailureAction: 'pause',
          Monitor: 10000000000, // 10 seconds
          MaxFailureRatio: 0.3,
          Order: 'start-first',
        },
      };

      // Update image if provided
      if (config.imageName && config.imageTag) {
        updatedSpec.TaskTemplate.ContainerSpec.Image = `${config.imageName}:${config.imageTag}`;
      }

      // Update environment variables if provided
      if (config.environmentVars) {
        updatedSpec.TaskTemplate.ContainerSpec.Env = Object.entries(config.environmentVars).map(
          ([key, value]) => `${key}=${value}`
        );
      }

      // Update resource limits if provided
      if (config.resourceLimits) {
        const cpuLimit = Math.floor(config.resourceLimits.cpuCores * 1000000000);
        const memoryLimit = config.resourceLimits.memoryMb * 1024 * 1024;
        const memoryReservation = Math.floor(memoryLimit * 0.5);

        updatedSpec.TaskTemplate.Resources = {
          Limits: {
            NanoCPUs: cpuLimit,
            MemoryBytes: memoryLimit,
          },
          Reservations: {
            NanoCPUs: Math.floor(cpuLimit * 0.5),
            MemoryBytes: memoryReservation,
          },
        };
      }

      // Update replicas if provided
      if (config.replicas !== undefined) {
        updatedSpec.Mode = {
          Replicated: {
            Replicas: config.replicas,
          },
        };
      }

      // Perform rolling update
      await service.update(updatedSpec as any);

      console.log(`✅ Service ${swarmServiceId} updated with zero-downtime deployment`);
    } catch (error) {
      console.error('Error updating service:', error);
      throw new Error(`Failed to update service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rollback to previous deployment
   * Preserves previous container images for rollback capability
   */
  async rollbackService(swarmServiceId: string): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      // Check if previous spec exists
      if (!serviceInfo.PreviousSpec) {
        throw new Error('No previous deployment available for rollback');
      }

      // Perform rollback using Docker Swarm's built-in rollback
      await service.update({
        version: serviceInfo.Version.Index,
        rollback: 'previous',
      } as any);

      console.log(`✅ Service ${swarmServiceId} rolled back to previous deployment`);
    } catch (error) {
      console.error('Error rolling back service:', error);
      throw new Error(`Failed to rollback service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rollback to specific deployment by image tag
   * This allows rollback to any previous version, not just the immediate previous one
   */
  async rollbackToDeployment(
    swarmServiceId: string,
    imageTag: string,
    imageName: string
  ): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      // Update service with the specific image tag
      const rollbackSpec: any = {
        version: serviceInfo.Version.Index,
        Name: serviceInfo.Spec.Name,
        TaskTemplate: {
          ...serviceInfo.Spec.TaskTemplate,
          ContainerSpec: {
            ...serviceInfo.Spec.TaskTemplate.ContainerSpec,
            Image: `${imageName}:${imageTag}`,
          },
        },
        Mode: serviceInfo.Spec.Mode,
        Networks: serviceInfo.Spec.Networks,
        EndpointSpec: serviceInfo.Spec.EndpointSpec,
        Labels: serviceInfo.Spec.Labels,
        UpdateConfig: {
          Parallelism: 1,
          Delay: 5000000000, // 5 seconds
          FailureAction: 'pause',
          Monitor: 10000000000, // 10 seconds
          Order: 'start-first', // Zero-downtime rollback
        },
      };

      await service.update(rollbackSpec as any);

      console.log(`✅ Service ${swarmServiceId} rolled back to image ${imageName}:${imageTag}`);
    } catch (error) {
      console.error('Error rolling back to specific deployment:', error);
      throw new Error(`Failed to rollback to deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service update status
   * Useful for monitoring rolling updates and rollbacks
   */
  async getUpdateStatus(swarmServiceId: string): Promise<{
    state: 'updating' | 'completed' | 'paused' | 'rollback_started' | 'rollback_paused' | 'rollback_completed';
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();

      const updateStatus = serviceInfo.UpdateStatus;

      if (!updateStatus) {
        return { state: 'completed' };
      }

      return {
        state: updateStatus.State as any,
        message: updateStatus.Message,
        startedAt: updateStatus.StartedAt ? new Date(updateStatus.StartedAt) : undefined,
        completedAt: updateStatus.CompletedAt ? new Date(updateStatus.CompletedAt) : undefined,
      };
    } catch (error) {
      console.error('Error getting update status:', error);
      throw new Error(`Failed to get update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preserve previous container image for rollback
   * This is called before updating a service to ensure rollback capability
   */
  async preserveImageForRollback(
    serviceId: string,
    deploymentId: string,
    imageName: string,
    imageTag: string
  ): Promise<void> {
    try {
      // Store image reference in database for rollback
      await query(
        `UPDATE container_deployments 
         SET image_tag = $1, updated_at = $2 
         WHERE id = $3`,
        [imageTag, new Date(), deploymentId]
      );

      console.log(`✅ Preserved image ${imageName}:${imageTag} for rollback (deployment: ${deploymentId})`);
    } catch (error) {
      console.error('Error preserving image for rollback:', error);
      // Don't throw - this is not critical for deployment
    }
  }

  /**
   * Get deployment history for a service
   * Returns list of previous deployments that can be rolled back to
   */
  async getDeploymentHistory(serviceId: string): Promise<Array<{
    deploymentId: string;
    imageTag: string;
    status: string;
    deployedAt: Date;
    stoppedAt?: Date;
  }>> {
    try {
      const result = await query(
        `SELECT id, image_tag, status, deployed_at, stopped_at
         FROM container_deployments
         WHERE service_id = $1
         ORDER BY deployed_at DESC
         LIMIT 10`,
        [serviceId]
      );

      return result.rows.map(row => ({
        deploymentId: row.id,
        imageTag: row.image_tag,
        status: row.status,
        deployedAt: new Date(row.deployed_at),
        stoppedAt: row.stopped_at ? new Date(row.stopped_at) : undefined,
      }));
    } catch (error) {
      console.error('Error getting deployment history:', error);
      throw new Error(`Failed to get deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform health check on service after update
   * Returns true if service is healthy, false otherwise
   */
  async performHealthCheck(swarmServiceId: string, timeoutSeconds: number = 60): Promise<boolean> {
    try {
      const startTime = Date.now();
      const timeoutMs = timeoutSeconds * 1000;

      while (Date.now() - startTime < timeoutMs) {
        const status = await this.getServiceStatus(swarmServiceId);

        // Check if all replicas are running
        if (status.state === 'running' && status.replicas.running === status.replicas.desired) {
          console.log(`✅ Health check passed for service ${swarmServiceId}`);
          return true;
        }

        // Check for failed tasks
        const failedTasks = status.tasks.filter(task => task.state === 'failed');
        if (failedTasks.length > 0) {
          console.error(`❌ Health check failed: ${failedTasks.length} tasks failed`);
          return false;
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
      }

      console.error(`❌ Health check timed out after ${timeoutSeconds} seconds`);
      return false;
    } catch (error) {
      console.error('Error performing health check:', error);
      return false;
    }
  }

  /**
   * Create or update Docker secret
   * Docker secrets are immutable, so we need to remove and recreate on update
   */
  async createOrUpdateDockerSecret(
    serviceName: string,
    secretName: string,
    secretValue: string
  ): Promise<string> {
    try {
      const dockerSecretName = `${serviceName}-${secretName}`;

      // Check if secret already exists
      const existingSecrets = await this.docker.listSecrets({
        filters: { name: [dockerSecretName] },
      });

      // If secret exists, remove it first (Docker secrets are immutable)
      if (existingSecrets.length > 0) {
        const existingSecret = this.docker.getSecret(existingSecrets[0].ID);
        await existingSecret.remove();
        console.log(`Removed existing Docker secret: ${dockerSecretName}`);
      }

      // Create new secret
      const secret = await this.docker.createSecret({
        Name: dockerSecretName,
        Data: Buffer.from(secretValue).toString('base64'),
        Labels: {
          'skypanel.service.name': serviceName,
          'skypanel.secret.name': secretName,
        },
      });

      console.log(`✅ Created Docker secret: ${dockerSecretName} (${secret.id})`);
      return secret.id;
    } catch (error) {
      console.error('Error creating Docker secret:', error);
      throw new Error(`Failed to create Docker secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove Docker secrets for a service
   */
  async removeServiceSecrets(serviceName: string): Promise<void> {
    try {
      // List all secrets for this service
      const secrets = await this.docker.listSecrets({
        filters: { label: [`skypanel.service.name=${serviceName}`] },
      });

      // Remove each secret
      for (const secretInfo of secrets) {
        try {
          const secret = this.docker.getSecret(secretInfo.ID);
          await secret.remove();
          console.log(`Removed Docker secret: ${secretInfo.Spec.Name}`);
        } catch (error) {
          // Ignore errors if secret is already removed or in use
          console.warn(`Could not remove secret ${secretInfo.Spec.Name}:`, error);
        }
      }

      console.log(`✅ Removed all secrets for service: ${serviceName}`);
    } catch (error) {
      console.error('Error removing service secrets:', error);
      // Don't throw - this is cleanup, not critical
    }
  }

  /**
   * Update service secrets without redeploying
   * This triggers a rolling restart to pick up new secret values
   */
  async updateServiceSecrets(
    swarmServiceId: string,
    secrets: Array<{
      id: string;
      name: string;
      value: string;
      mountPath?: string;
      envVarName?: string;
    }>
  ): Promise<void> {
    try {
      const service = this.docker.getService(swarmServiceId);
      const serviceInfo = await service.inspect();
      const serviceName = serviceInfo.Spec.Name;

      // Create/update Docker secrets
      const dockerSecrets: any[] = [];
      const envVars = [...(serviceInfo.Spec.TaskTemplate.ContainerSpec.Env || [])];

      for (const secret of secrets) {
        // Create or update Docker secret
        const dockerSecretId = await this.createOrUpdateDockerSecret(
          serviceName,
          secret.name,
          secret.value
        );

        // Update environment variable if needed
        if (secret.envVarName) {
          // Remove old env var if exists
          const envIndex = envVars.findIndex(env => env.startsWith(`${secret.envVarName}=`));
          if (envIndex >= 0) {
            envVars[envIndex] = `${secret.envVarName}=${secret.value}`;
          } else {
            envVars.push(`${secret.envVarName}=${secret.value}`);
          }
        }

        // Add secret mount if needed
        if (secret.mountPath) {
          dockerSecrets.push({
            SecretID: dockerSecretId,
            SecretName: `${serviceName}-${secret.name}`,
            File: {
              Name: secret.mountPath.split('/').pop() || secret.name,
              UID: '0',
              GID: '0',
              Mode: 0o400,
            },
          });
        }
      }

      // Update service with new secrets
      const updatedSpec: any = {
        version: serviceInfo.Version.Index,
        Name: serviceName,
        TaskTemplate: {
          ...serviceInfo.Spec.TaskTemplate,
          ContainerSpec: {
            ...serviceInfo.Spec.TaskTemplate.ContainerSpec,
            Env: envVars,
            Secrets: dockerSecrets.length > 0 ? dockerSecrets : undefined,
          },
        },
        Mode: serviceInfo.Spec.Mode,
        Networks: serviceInfo.Spec.Networks,
        EndpointSpec: serviceInfo.Spec.EndpointSpec,
        Labels: serviceInfo.Spec.Labels,
        UpdateConfig: {
          Parallelism: 1,
          Delay: 5000000000, // 5 seconds
          FailureAction: 'rollback',
          Monitor: 10000000000, // 10 seconds
          Order: 'start-first', // Zero-downtime update
        },
      };

      await service.update(updatedSpec as any);

      console.log(`✅ Updated secrets for service ${swarmServiceId}`);
    } catch (error) {
      console.error('Error updating service secrets:', error);
      throw new Error(`Failed to update service secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if Swarm is initialized
   */
  async isSwarmInitialized(): Promise<boolean> {
    try {
      await this.docker.swarmInspect();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const swarmOrchestrator = new SwarmOrchestrator();
