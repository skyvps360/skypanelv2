/**
 * Container Service for SkyPanelV2
 * Handles container service lifecycle operations, CRUD, and status management
 */

import { query, transaction } from '../../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateServiceParams {
  organizationId: string;
  name: string;
  slug?: string;
  templateId?: string;
  gitRepository?: string;
  gitBranch?: string;
  buildConfig?: {
    nixExpression?: string;
    buildCommand?: string;
    outputPath?: string;
    environmentType?: 'nix' | 'docker' | 'buildpack';
  };
  environmentVars?: Record<string, string>;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
}

export interface UpdateServiceParams {
  name?: string;
  gitRepository?: string;
  gitBranch?: string;
  buildConfig?: {
    nixExpression?: string;
    buildCommand?: string;
    outputPath?: string;
    environmentType?: 'nix' | 'docker' | 'buildpack';
  };
  environmentVars?: Record<string, string>;
  resourceLimits?: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
}

export interface ContainerService {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  templateId?: string;
  gitRepository?: string;
  gitBranch: string;
  buildConfig: {
    nixExpression?: string;
    buildCommand?: string;
    outputPath?: string;
    environmentType: 'nix' | 'docker' | 'buildpack';
  };
  environmentVars: Record<string, string>;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'deleted';
  currentDeploymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListServicesFilters {
  status?: string;
  templateId?: string;
  search?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export class ContainerServiceManager {
  /**
   * Create a new container service
   */
  static async createService(params: CreateServiceParams): Promise<ContainerService> {
    try {
      // Validate resource limits
      this.validateResourceLimits(params.resourceLimits);

      // Check organization quota before creating service
      await this.checkOrganizationQuota(params.organizationId, params.resourceLimits);

      // Generate slug if not provided
      const slug = params.slug || this.generateSlug(params.name);

      // Check if slug is unique within organization
      const existingService = await query(
        'SELECT id FROM container_services WHERE organization_id = $1 AND slug = $2',
        [params.organizationId, slug]
      );

      if (existingService.rows.length > 0) {
        throw new Error(`Service with slug '${slug}' already exists in this organization`);
      }

      return await transaction(async (client) => {
        const serviceId = uuidv4();
        const now = new Date();

        // Create service record
        const result = await client.query(
          `INSERT INTO container_services (
            id, organization_id, name, slug, template_id, git_repository, git_branch,
            build_config, environment_vars, resource_limits, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            serviceId,
            params.organizationId,
            params.name,
            slug,
            params.templateId || null,
            params.gitRepository || null,
            params.gitBranch || 'main',
            JSON.stringify(params.buildConfig || { environmentType: 'nix' }),
            JSON.stringify(params.environmentVars || {}),
            JSON.stringify(params.resourceLimits),
            'pending',
            now,
            now
          ]
        );

        return this.mapRowToService(result.rows[0]);
      });
    } catch (error) {
      console.error('Error creating container service:', error);
      throw error;
    }
  }

  /**
   * Get service details with current deployment
   */
  static async getService(serviceId: string, organizationId: string): Promise<ContainerService | null> {
    try {
      const result = await query(
        `SELECT * FROM container_services 
         WHERE id = $1 AND organization_id = $2 AND status != 'deleted'`,
        [serviceId, organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToService(result.rows[0]);
    } catch (error) {
      console.error('Error getting container service:', error);
      throw error;
    }
  }

  /**
   * List services with filtering and pagination
   */
  static async listServices(
    organizationId: string,
    filters: ListServicesFilters = {},
    pagination: PaginationParams = {}
  ): Promise<{ services: ContainerService[]; total: number }> {
    try {
      const { limit = 50, offset = 0 } = pagination;
      const conditions: string[] = ['organization_id = $1', "status != 'deleted'"];
      const params: any[] = [organizationId];
      let paramIndex = 2;

      // Apply filters
      if (filters.status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.templateId) {
        conditions.push(`template_id = $${paramIndex}`);
        params.push(filters.templateId);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR slug ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM container_services WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get services
      const servicesResult = await query(
        `SELECT * FROM container_services 
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const services = servicesResult.rows.map(row => this.mapRowToService(row));

      return { services, total };
    } catch (error) {
      console.error('Error listing container services:', error);
      throw error;
    }
  }

  /**
   * Update service configuration
   */
  static async updateService(
    serviceId: string,
    organizationId: string,
    updates: UpdateServiceParams
  ): Promise<ContainerService> {
    try {
      // Validate resource limits if provided
      if (updates.resourceLimits) {
        this.validateResourceLimits(updates.resourceLimits);
        
        // Check quota for updated resource limits
        const currentService = await this.getService(serviceId, organizationId);
        if (!currentService) {
          throw new Error('Service not found');
        }

        // Calculate resource delta
        const resourceDelta = {
          cpuCores: updates.resourceLimits.cpuCores - currentService.resourceLimits.cpuCores,
          memoryMb: updates.resourceLimits.memoryMb - currentService.resourceLimits.memoryMb,
          diskGb: updates.resourceLimits.diskGb - currentService.resourceLimits.diskGb
        };

        // Only check quota if resources are increasing
        if (resourceDelta.cpuCores > 0 || resourceDelta.memoryMb > 0 || resourceDelta.diskGb > 0) {
          await this.checkOrganizationQuota(organizationId, {
            cpuCores: Math.max(0, resourceDelta.cpuCores),
            memoryMb: Math.max(0, resourceDelta.memoryMb),
            diskGb: Math.max(0, resourceDelta.diskGb)
          });
        }
      }

      return await transaction(async (client) => {
        const updateFields: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
          updateFields.push(`name = $${paramIndex}`);
          params.push(updates.name);
          paramIndex++;
        }

        if (updates.gitRepository !== undefined) {
          updateFields.push(`git_repository = $${paramIndex}`);
          params.push(updates.gitRepository);
          paramIndex++;
        }

        if (updates.gitBranch !== undefined) {
          updateFields.push(`git_branch = $${paramIndex}`);
          params.push(updates.gitBranch);
          paramIndex++;
        }

        if (updates.buildConfig !== undefined) {
          updateFields.push(`build_config = $${paramIndex}`);
          params.push(JSON.stringify(updates.buildConfig));
          paramIndex++;
        }

        if (updates.environmentVars !== undefined) {
          updateFields.push(`environment_vars = $${paramIndex}`);
          params.push(JSON.stringify(updates.environmentVars));
          paramIndex++;
        }

        if (updates.resourceLimits !== undefined) {
          updateFields.push(`resource_limits = $${paramIndex}`);
          params.push(JSON.stringify(updates.resourceLimits));
          paramIndex++;
        }

        updateFields.push(`updated_at = $${paramIndex}`);
        params.push(new Date());
        paramIndex++;

        params.push(serviceId);
        params.push(organizationId);

        const result = await client.query(
          `UPDATE container_services 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1} AND status != 'deleted'
           RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          throw new Error('Service not found or already deleted');
        }

        return this.mapRowToService(result.rows[0]);
      });
    } catch (error) {
      console.error('Error updating container service:', error);
      throw error;
    }
  }

  /**
   * Delete service with cleanup
   */
  static async deleteService(serviceId: string, organizationId: string): Promise<void> {
    try {
      await transaction(async (client) => {
        // Check if service exists and belongs to organization
        const serviceResult = await client.query(
          'SELECT id, status FROM container_services WHERE id = $1 AND organization_id = $2',
          [serviceId, organizationId]
        );

        if (serviceResult.rows.length === 0) {
          throw new Error('Service not found');
        }

        const service = serviceResult.rows[0];

        // Mark service as deleted (soft delete)
        await client.query(
          `UPDATE container_services 
           SET status = 'deleted', updated_at = $1 
           WHERE id = $2`,
          [new Date(), serviceId]
        );

        // Mark all deployments as stopped
        await client.query(
          `UPDATE container_deployments 
           SET status = 'stopped', stopped_at = $1, updated_at = $1
           WHERE service_id = $2 AND status IN ('running', 'deploying')`,
          [new Date(), serviceId]
        );

        console.log(`✅ Service ${serviceId} marked as deleted`);
      });
    } catch (error) {
      console.error('Error deleting container service:', error);
      throw error;
    }
  }

  /**
   * Validate resource limits
   */
  private static validateResourceLimits(limits: { cpuCores: number; memoryMb: number; diskGb: number }): void {
    if (limits.cpuCores < 0.5 || limits.cpuCores > 16) {
      throw new Error('CPU cores must be between 0.5 and 16');
    }

    if (limits.memoryMb < 256 || limits.memoryMb > 32768) {
      throw new Error('Memory must be between 256 MB and 32 GB');
    }

    if (limits.diskGb < 1 || limits.diskGb > 500) {
      throw new Error('Disk must be between 1 GB and 500 GB');
    }
  }

  /**
   * Check organization quota before creating/updating service
   */
  private static async checkOrganizationQuota(
    organizationId: string,
    resourceLimits: { cpuCores: number; memoryMb: number; diskGb: number }
  ): Promise<void> {
    // Import QuotaService dynamically to avoid circular dependency
    const { QuotaService } = await import('./QuotaService.js');
    
    // Check quota using the new QuotaService
    const quotaCheck = await QuotaService.checkQuotaBeforeDeployment(
      organizationId,
      {
        cpu_cores: resourceLimits.cpuCores,
        memory_mb: resourceLimits.memoryMb,
        disk_gb: resourceLimits.diskGb
      }
    );

    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason);
    }
  }

  /**
   * Generate slug from service name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 63); // DNS label max length
  }

  /**
   * Start service (create deployment if needed)
   */
  static async startService(serviceId: string, organizationId: string): Promise<{ success: boolean; message: string; async?: boolean }> {
    try {
      const service = await this.getService(serviceId, organizationId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Check current status
      if (service.status === 'running') {
        return { success: true, message: 'Service is already running' };
      }

      if (service.status === 'building' || service.status === 'deploying') {
        return { success: true, message: 'Service is already starting', async: true };
      }

      // Update status to deploying
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['deploying', new Date(), serviceId]
      );

      // If no current deployment exists, we need to trigger a build first
      if (!service.currentDeploymentId) {
        await query(
          'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
          ['pending', new Date(), serviceId]
        );
        return { 
          success: true, 
          message: 'Service requires initial deployment. Please deploy the service first.',
          async: true 
        };
      }

      // Return async status - actual start will be handled by orchestrator
      return { 
        success: true, 
        message: 'Service start initiated',
        async: true 
      };
    } catch (error) {
      console.error('Error starting service:', error);
      throw error;
    }
  }

  /**
   * Stop service (preserve data and configuration)
   */
  static async stopService(serviceId: string, organizationId: string): Promise<{ success: boolean; message: string; async?: boolean }> {
    try {
      const service = await this.getService(serviceId, organizationId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Check current status
      if (service.status === 'stopped') {
        return { success: true, message: 'Service is already stopped' };
      }

      if (service.status === 'pending' || service.status === 'failed') {
        // Just update status, no orchestration needed
        await query(
          'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
          ['stopped', new Date(), serviceId]
        );
        return { success: true, message: 'Service stopped' };
      }

      // Update status to stopped
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['stopped', new Date(), serviceId]
      );

      // Mark current deployment as stopped if exists
      if (service.currentDeploymentId) {
        await query(
          'UPDATE container_deployments SET status = $1, stopped_at = $2, updated_at = $2 WHERE id = $3',
          ['stopped', new Date(), service.currentDeploymentId]
        );
      }

      // Return async status - actual stop will be handled by orchestrator
      return { 
        success: true, 
        message: 'Service stop initiated',
        async: true 
      };
    } catch (error) {
      console.error('Error stopping service:', error);
      throw error;
    }
  }

  /**
   * Restart service (without rebuilding)
   */
  static async restartService(serviceId: string, organizationId: string): Promise<{ success: boolean; message: string; async?: boolean }> {
    try {
      const service = await this.getService(serviceId, organizationId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Check if service has a deployment
      if (!service.currentDeploymentId) {
        return { 
          success: false, 
          message: 'Service has no deployment. Please deploy the service first.' 
        };
      }

      // Stop then start
      await this.stopService(serviceId, organizationId);
      
      // Small delay to ensure stop is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.startService(serviceId, organizationId);

      return { 
        success: true, 
        message: 'Service restart initiated',
        async: true 
      };
    } catch (error) {
      console.error('Error restarting service:', error);
      throw error;
    }
  }

  /**
   * Rebuild service (trigger new build and deploy)
   */
  static async rebuildService(serviceId: string, organizationId: string): Promise<{ success: boolean; message: string; async?: boolean }> {
    try {
      const service = await this.getService(serviceId, organizationId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Check if service has build configuration
      if (!service.gitRepository && !service.buildConfig?.nixExpression) {
        return { 
          success: false, 
          message: 'Service has no build configuration (Git repository or Nix expression)' 
        };
      }

      // Update status to building
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['building', new Date(), serviceId]
      );

      // Create a new build record
      const buildId = uuidv4();
      await query(
        `INSERT INTO container_builds (
          id, service_id, build_status, started_at, created_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [buildId, serviceId, 'pending', new Date(), new Date()]
      );

      // Return async status - actual build will be handled by build service
      return { 
        success: true, 
        message: 'Service rebuild initiated',
        async: true 
      };
    } catch (error) {
      console.error('Error rebuilding service:', error);
      throw error;
    }
  }

  /**
   * Perform lifecycle action on service
   */
  static async performAction(
    serviceId: string, 
    organizationId: string, 
    action: 'start' | 'stop' | 'restart' | 'rebuild'
  ): Promise<{ success: boolean; message: string; async?: boolean }> {
    switch (action) {
      case 'start':
        return this.startService(serviceId, organizationId);
      case 'stop':
        return this.stopService(serviceId, organizationId);
      case 'restart':
        return this.restartService(serviceId, organizationId);
      case 'rebuild':
        return this.rebuildService(serviceId, organizationId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Update service status with validation
   */
  static async updateServiceStatus(
    serviceId: string,
    newStatus: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'deleted',
    metadata?: { error?: string; deploymentId?: string }
  ): Promise<void> {
    try {
      // Get current service state
      const result = await query(
        'SELECT status, current_deployment_id FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (result.rows.length === 0) {
        throw new Error('Service not found');
      }

      const currentStatus = result.rows[0].status;

      // Validate status transition
      if (!this.isValidStatusTransition(currentStatus, newStatus)) {
        console.warn(
          `Invalid status transition for service ${serviceId}: ${currentStatus} -> ${newStatus}`
        );
        // Allow the transition but log the warning
      }

      // Update service status
      const updateParams: any[] = [newStatus, new Date(), serviceId];
      let updateQuery = 'UPDATE container_services SET status = $1, updated_at = $2';

      // Update current_deployment_id if provided
      if (metadata?.deploymentId) {
        updateQuery += ', current_deployment_id = $4';
        updateParams.push(metadata.deploymentId);
      }

      updateQuery += ' WHERE id = $3';

      await query(updateQuery, updateParams);

      console.log(`✅ Service ${serviceId} status updated: ${currentStatus} -> ${newStatus}`);
    } catch (error) {
      console.error('Error updating service status:', error);
      throw error;
    }
  }

  /**
   * Handle deployment success
   */
  static async handleDeploymentSuccess(
    serviceId: string,
    deploymentId: string
  ): Promise<void> {
    try {
      await transaction(async (client) => {
        // Update service status to running and set current deployment
        await client.query(
          `UPDATE container_services 
           SET status = $1, current_deployment_id = $2, updated_at = $3 
           WHERE id = $4`,
          ['running', deploymentId, new Date(), serviceId]
        );

        // Update deployment status to running
        await client.query(
          `UPDATE container_deployments 
           SET status = $1, deployed_at = $2, updated_at = $2 
           WHERE id = $3`,
          ['running', new Date(), deploymentId]
        );

        console.log(`✅ Deployment ${deploymentId} for service ${serviceId} succeeded`);
      });
    } catch (error) {
      console.error('Error handling deployment success:', error);
      throw error;
    }
  }

  /**
   * Handle deployment failure
   */
  static async handleDeploymentFailure(
    serviceId: string,
    deploymentId: string,
    error: string
  ): Promise<void> {
    try {
      await transaction(async (client) => {
        // Get current service state
        const serviceResult = await client.query(
          'SELECT current_deployment_id FROM container_services WHERE id = $1',
          [serviceId]
        );

        const currentDeploymentId = serviceResult.rows[0]?.current_deployment_id;

        // If this was the current deployment, mark service as failed
        // Otherwise, keep the service running with the previous deployment
        if (currentDeploymentId === deploymentId || !currentDeploymentId) {
          await client.query(
            `UPDATE container_services 
             SET status = $1, updated_at = $2 
             WHERE id = $3`,
            ['failed', new Date(), serviceId]
          );
        }

        // Update deployment status to failed
        await client.query(
          `UPDATE container_deployments 
           SET status = $1, deployment_logs = $2, updated_at = $3 
           WHERE id = $4`,
          ['failed', error, new Date(), deploymentId]
        );

        console.log(`❌ Deployment ${deploymentId} for service ${serviceId} failed: ${error}`);
      });
    } catch (err) {
      console.error('Error handling deployment failure:', err);
      throw err;
    }
  }

  /**
   * Handle build failure
   */
  static async handleBuildFailure(
    serviceId: string,
    buildId: string,
    error: string
  ): Promise<void> {
    try {
      await transaction(async (client) => {
        // Update service status to failed
        await client.query(
          `UPDATE container_services 
           SET status = $1, updated_at = $2 
           WHERE id = $3`,
          ['failed', new Date(), serviceId]
        );

        // Update build status to failed
        await client.query(
          `UPDATE container_builds 
           SET build_status = $1, build_logs = $2, completed_at = $3 
           WHERE id = $4`,
          ['failed', error, new Date(), buildId]
        );

        console.log(`❌ Build ${buildId} for service ${serviceId} failed: ${error}`);
      });
    } catch (err) {
      console.error('Error handling build failure:', err);
      throw err;
    }
  }

  /**
   * Validate status transition
   */
  private static isValidStatusTransition(
    currentStatus: string,
    newStatus: string
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      'pending': ['building', 'deploying', 'failed', 'deleted'],
      'building': ['deploying', 'failed', 'stopped', 'deleted'],
      'deploying': ['running', 'failed', 'stopped', 'deleted'],
      'running': ['stopped', 'deploying', 'building', 'failed', 'deleted'],
      'stopped': ['deploying', 'building', 'deleted'],
      'failed': ['building', 'deploying', 'stopped', 'deleted'],
      'deleted': [] // No transitions from deleted state
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Deploy service from template
   * Pre-populates service configuration from template
   */
  static async deployFromTemplate(
    organizationId: string,
    templateId: string,
    customizations?: {
      name?: string;
      environmentVars?: Record<string, string>;
      resourceLimits?: {
        cpuCores: number;
        memoryMb: number;
        diskGb: number;
      };
    }
  ): Promise<ContainerService> {
    try {
      // Import TemplateService dynamically to avoid circular dependency
      const { TemplateService } = await import('./TemplateService.js');
      
      // Get template details
      const template = await TemplateService.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isActive) {
        throw new Error('Template is not active');
      }

      // Merge template defaults with customizations
      const serviceName = customizations?.name || template.name;
      const environmentVars = {
        ...template.defaultEnvVars,
        ...(customizations?.environmentVars || {})
      };
      const resourceLimits = customizations?.resourceLimits || template.defaultResourceLimits;

      // Create service with template configuration
      const serviceParams: CreateServiceParams = {
        organizationId,
        name: serviceName,
        templateId: template.id,
        buildConfig: {
          nixExpression: template.nixExpression,
          environmentType: 'nix'
        },
        environmentVars,
        resourceLimits
      };

      const service = await this.createService(serviceParams);

      console.log(`✅ Service created from template: ${template.name} -> ${service.name}`);
      return service;
    } catch (error) {
      console.error('Error deploying from template:', error);
      throw error;
    }
  }

  /**
   * Map database row to ContainerService object
   */
  private static mapRowToService(row: any): ContainerService {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      templateId: row.template_id || undefined,
      gitRepository: row.git_repository || undefined,
      gitBranch: row.git_branch,
      buildConfig: typeof row.build_config === 'string' 
        ? JSON.parse(row.build_config) 
        : row.build_config,
      environmentVars: typeof row.environment_vars === 'string'
        ? JSON.parse(row.environment_vars)
        : row.environment_vars,
      resourceLimits: typeof row.resource_limits === 'string'
        ? JSON.parse(row.resource_limits)
        : row.resource_limits,
      status: row.status,
      currentDeploymentId: row.current_deployment_id || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
