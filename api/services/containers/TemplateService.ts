/**
 * Template Service for SkyPanelV2 Container Platform
 * Handles application template CRUD operations and validation
 */

import { query, transaction } from '../../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateTemplateParams {
  name: string;
  description: string;
  category: 'web' | 'api' | 'worker' | 'database' | 'static' | 'custom';
  iconUrl?: string;
  nixExpression: string;
  defaultEnvVars?: Record<string, string>;
  defaultResourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  isActive?: boolean;
  displayOrder?: number;
  isMultiService?: boolean;
  services?: {
    name: string;
    nixExpression: string;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
    };
    dependencies: string[];
    environmentVars: Record<string, string>;
  }[];
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  category?: 'web' | 'api' | 'worker' | 'database' | 'static' | 'custom';
  iconUrl?: string;
  nixExpression?: string;
  defaultEnvVars?: Record<string, string>;
  defaultResourceLimits?: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  isActive?: boolean;
  displayOrder?: number;
  isMultiService?: boolean;
  services?: {
    name: string;
    nixExpression: string;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
    };
    dependencies: string[];
    environmentVars: Record<string, string>;
  }[];
}

export interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'api' | 'worker' | 'database' | 'static' | 'custom';
  iconUrl?: string;
  nixExpression: string;
  defaultEnvVars: Record<string, string>;
  defaultResourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  isActive: boolean;
  displayOrder: number;
  isMultiService: boolean;
  services?: {
    name: string;
    nixExpression: string;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
    };
    dependencies: string[];
    environmentVars: Record<string, string>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ListTemplatesFilters {
  category?: string;
  isActive?: boolean;
  search?: string;
}

export class TemplateService {
  /**
   * Create a new application template
   */
  static async createTemplate(params: CreateTemplateParams): Promise<ApplicationTemplate> {
    try {
      // Validate Nix expression
      this.validateNixExpression(params.nixExpression);

      // Validate resource limits
      this.validateResourceLimits(params.defaultResourceLimits);

      // Validate multi-service configuration if applicable
      if (params.isMultiService && params.services) {
        this.validateMultiServiceConfig(params.services);
      }

      return await transaction(async (client) => {
        const templateId = uuidv4();
        const now = new Date();

        const result = await client.query(
          `INSERT INTO application_templates (
            id, name, description, category, icon_url, nix_expression,
            default_env_vars, default_resource_limits, is_active, display_order,
            is_multi_service, services, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *`,
          [
            templateId,
            params.name,
            params.description,
            params.category,
            params.iconUrl || null,
            params.nixExpression,
            JSON.stringify(params.defaultEnvVars || {}),
            JSON.stringify(params.defaultResourceLimits),
            params.isActive !== undefined ? params.isActive : true,
            params.displayOrder || 0,
            params.isMultiService || false,
            params.services ? JSON.stringify(params.services) : null,
            now,
            now
          ]
        );

        console.log(`✅ Template created: ${params.name} (${templateId})`);
        return this.mapRowToTemplate(result.rows[0]);
      });
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Get template details
   */
  static async getTemplate(templateId: string): Promise<ApplicationTemplate | null> {
    try {
      const result = await query(
        'SELECT * FROM application_templates WHERE id = $1',
        [templateId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTemplate(result.rows[0]);
    } catch (error) {
      console.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * List templates with filtering
   */
  static async listTemplates(
    filters: ListTemplatesFilters = {}
  ): Promise<ApplicationTemplate[]> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.category) {
        conditions.push(`category = $${paramIndex}`);
        params.push(filters.category);
        paramIndex++;
      }

      if (filters.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex}`);
        params.push(filters.isActive);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await query(
        `SELECT * FROM application_templates 
         ${whereClause}
         ORDER BY display_order ASC, name ASC`,
        params
      );

      return result.rows.map(row => this.mapRowToTemplate(row));
    } catch (error) {
      console.error('Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Update template configuration
   */
  static async updateTemplate(
    templateId: string,
    updates: UpdateTemplateParams
  ): Promise<ApplicationTemplate> {
    try {
      // Validate Nix expression if provided
      if (updates.nixExpression) {
        this.validateNixExpression(updates.nixExpression);
      }

      // Validate resource limits if provided
      if (updates.defaultResourceLimits) {
        this.validateResourceLimits(updates.defaultResourceLimits);
      }

      // Validate multi-service configuration if applicable
      if (updates.isMultiService && updates.services) {
        this.validateMultiServiceConfig(updates.services);
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

        if (updates.description !== undefined) {
          updateFields.push(`description = $${paramIndex}`);
          params.push(updates.description);
          paramIndex++;
        }

        if (updates.category !== undefined) {
          updateFields.push(`category = $${paramIndex}`);
          params.push(updates.category);
          paramIndex++;
        }

        if (updates.iconUrl !== undefined) {
          updateFields.push(`icon_url = $${paramIndex}`);
          params.push(updates.iconUrl);
          paramIndex++;
        }

        if (updates.nixExpression !== undefined) {
          updateFields.push(`nix_expression = $${paramIndex}`);
          params.push(updates.nixExpression);
          paramIndex++;
        }

        if (updates.defaultEnvVars !== undefined) {
          updateFields.push(`default_env_vars = $${paramIndex}`);
          params.push(JSON.stringify(updates.defaultEnvVars));
          paramIndex++;
        }

        if (updates.defaultResourceLimits !== undefined) {
          updateFields.push(`default_resource_limits = $${paramIndex}`);
          params.push(JSON.stringify(updates.defaultResourceLimits));
          paramIndex++;
        }

        if (updates.isActive !== undefined) {
          updateFields.push(`is_active = $${paramIndex}`);
          params.push(updates.isActive);
          paramIndex++;
        }

        if (updates.displayOrder !== undefined) {
          updateFields.push(`display_order = $${paramIndex}`);
          params.push(updates.displayOrder);
          paramIndex++;
        }

        if (updates.isMultiService !== undefined) {
          updateFields.push(`is_multi_service = $${paramIndex}`);
          params.push(updates.isMultiService);
          paramIndex++;
        }

        if (updates.services !== undefined) {
          updateFields.push(`services = $${paramIndex}`);
          params.push(updates.services ? JSON.stringify(updates.services) : null);
          paramIndex++;
        }

        updateFields.push(`updated_at = $${paramIndex}`);
        params.push(new Date());
        paramIndex++;

        params.push(templateId);

        const result = await client.query(
          `UPDATE application_templates 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          throw new Error('Template not found');
        }

        console.log(`✅ Template updated: ${templateId}`);
        return this.mapRowToTemplate(result.rows[0]);
      });
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete template (prevent if in use)
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      await transaction(async (client) => {
        // Check if template is in use by any services
        const usageResult = await client.query(
          `SELECT COUNT(*) as count FROM container_services 
           WHERE template_id = $1 AND status != 'deleted'`,
          [templateId]
        );

        const usageCount = parseInt(usageResult.rows[0].count);

        if (usageCount > 0) {
          throw new Error(
            `Cannot delete template: it is currently in use by ${usageCount} service(s)`
          );
        }

        // Delete the template
        const result = await client.query(
          'DELETE FROM application_templates WHERE id = $1 RETURNING id',
          [templateId]
        );

        if (result.rows.length === 0) {
          throw new Error('Template not found');
        }

        console.log(`✅ Template deleted: ${templateId}`);
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Validate Nix expression syntax
   */
  private static validateNixExpression(nixExpression: string): void {
    if (!nixExpression || nixExpression.trim().length === 0) {
      throw new Error('Nix expression cannot be empty');
    }

    // Basic syntax validation
    const trimmed = nixExpression.trim();

    // Check for balanced braces
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      throw new Error('Nix expression has unbalanced braces');
    }

    // Check for balanced parentheses
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      throw new Error('Nix expression has unbalanced parentheses');
    }

    // Check for balanced brackets
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      throw new Error('Nix expression has unbalanced brackets');
    }

    // Check for common Nix keywords to ensure it looks like a Nix expression
    const hasNixKeywords = /\b(with|let|in|rec|inherit|import|pkgs)\b/.test(trimmed);
    if (!hasNixKeywords) {
      console.warn('Nix expression may be invalid: no common Nix keywords found');
    }
  }

  /**
   * Validate resource limits
   */
  private static validateResourceLimits(limits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  }): void {
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
   * Validate multi-service configuration
   */
  private static validateMultiServiceConfig(
    services: {
      name: string;
      nixExpression: string;
      resourceLimits: {
        cpuCores: number;
        memoryMb: number;
        diskGb: number;
      };
      dependencies: string[];
      environmentVars: Record<string, string>;
    }[]
  ): void {
    if (!services || services.length === 0) {
      throw new Error('Multi-service template must have at least one service');
    }

    const serviceNames = new Set<string>();

    for (const service of services) {
      // Check for duplicate service names
      if (serviceNames.has(service.name)) {
        throw new Error(`Duplicate service name: ${service.name}`);
      }
      serviceNames.add(service.name);

      // Validate Nix expression for each service
      this.validateNixExpression(service.nixExpression);

      // Validate resource limits for each service
      this.validateResourceLimits(service.resourceLimits);

      // Validate dependencies reference existing services
      for (const dep of service.dependencies) {
        if (!serviceNames.has(dep) && !services.some(s => s.name === dep)) {
          throw new Error(
            `Service '${service.name}' depends on '${dep}' which is not defined in the template`
          );
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(services);
  }

  /**
   * Detect circular dependencies in multi-service configuration
   */
  private static detectCircularDependencies(
    services: {
      name: string;
      dependencies: string[];
    }[]
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (serviceName: string): boolean => {
      visited.add(serviceName);
      recursionStack.add(serviceName);

      const service = services.find(s => s.name === serviceName);
      if (!service) return false;

      for (const dep of service.dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }

      recursionStack.delete(serviceName);
      return false;
    };

    for (const service of services) {
      if (!visited.has(service.name)) {
        if (hasCycle(service.name)) {
          throw new Error('Circular dependency detected in multi-service template');
        }
      }
    }
  }

  /**
   * Deploy multi-service template
   * Deploys services in dependency order with automatic networking
   */
  static async deployMultiServiceTemplate(
    organizationId: string,
    templateId: string,
    groupName: string,
    customizations?: {
      environmentVars?: Record<string, Record<string, string>>; // Per-service env vars
      resourceLimits?: Record<string, {
        cpuCores: number;
        memoryMb: number;
        diskGb: number;
      }>; // Per-service resource limits
    }
  ): Promise<{
    services: any[];
    deploymentOrder: string[];
  }> {
    try {
      // Get template
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isActive) {
        throw new Error('Template is not active');
      }

      if (!template.isMultiService || !template.services) {
        throw new Error('Template is not a multi-service template');
      }

      // Import ContainerServiceManager dynamically
      const { ContainerServiceManager } = await import('./ContainerService.js');

      // Calculate deployment order based on dependencies
      const deploymentOrder = this.calculateDeploymentOrder(template.services);

      console.log(`📦 Deploying multi-service template: ${template.name}`);
      console.log(`   Deployment order: ${deploymentOrder.join(' → ')}`);

      const createdServices: any[] = [];
      const serviceIdMap = new Map<string, string>(); // service name -> service ID

      // Deploy services in dependency order
      for (const serviceName of deploymentOrder) {
        const serviceConfig = template.services.find(s => s.name === serviceName);
        if (!serviceConfig) {
          throw new Error(`Service configuration not found: ${serviceName}`);
        }

        // Merge environment variables
        const baseEnvVars = { ...serviceConfig.environmentVars };
        const customEnvVars = customizations?.environmentVars?.[serviceName] || {};

        // Inject connection details for dependencies
        for (const depName of serviceConfig.dependencies) {
          const depServiceId = serviceIdMap.get(depName);
          if (depServiceId) {
            // Inject dependency connection info as environment variables
            const depSlug = `${groupName}-${depName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            baseEnvVars[`${depName.toUpperCase()}_HOST`] = depSlug;
            baseEnvVars[`${depName.toUpperCase()}_URL`] = `${depSlug}:${this.getDefaultPort(depName)}`;
          }
        }

        const environmentVars = { ...baseEnvVars, ...customEnvVars };

        // Get resource limits
        const resourceLimits = customizations?.resourceLimits?.[serviceName] || serviceConfig.resourceLimits;

        // Create service with group prefix
        const fullServiceName = `${groupName}-${serviceName}`;
        const service = await ContainerServiceManager.createService({
          organizationId,
          name: fullServiceName,
          slug: fullServiceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          templateId: template.id,
          buildConfig: {
            nixExpression: serviceConfig.nixExpression,
            environmentType: 'nix'
          },
          environmentVars,
          resourceLimits
        });

        serviceIdMap.set(serviceName, service.id);
        createdServices.push(service);

        console.log(`   ✅ Created service: ${fullServiceName} (${service.id})`);
      }

      console.log(`✅ Multi-service template deployed: ${template.name} (${createdServices.length} services)`);

      return {
        services: createdServices,
        deploymentOrder
      };
    } catch (error) {
      console.error('Error deploying multi-service template:', error);
      throw error;
    }
  }

  /**
   * Calculate deployment order based on dependencies
   * Uses topological sort to ensure dependencies are deployed first
   */
  private static calculateDeploymentOrder(
    services: {
      name: string;
      dependencies: string[];
    }[]
  ): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (serviceName: string): void => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving: ${serviceName}`);
      }

      visiting.add(serviceName);

      const service = services.find(s => s.name === serviceName);
      if (service) {
        // Visit dependencies first
        for (const dep of service.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // Visit all services
    for (const service of services) {
      visit(service.name);
    }

    return order;
  }

  /**
   * Get default port for common service types
   */
  private static getDefaultPort(serviceName: string): number {
    const lowerName = serviceName.toLowerCase();
    
    // Common database ports
    if (lowerName.includes('postgres')) return 5432;
    if (lowerName.includes('mysql') || lowerName.includes('mariadb')) return 3306;
    if (lowerName.includes('mongo')) return 27017;
    if (lowerName.includes('redis')) return 6379;
    
    // Common application ports
    if (lowerName.includes('web') || lowerName.includes('app')) return 3000;
    if (lowerName.includes('api')) return 8080;
    
    // Default
    return 8080;
  }

  /**
   * Delete multi-service group with cascading deletion
   */
  static async deleteMultiServiceGroup(
    organizationId: string,
    groupName: string,
    confirmed: boolean = false
  ): Promise<{
    deleted: string[];
    requiresConfirmation: boolean;
  }> {
    try {
      // Import ContainerServiceManager dynamically
      const { ContainerServiceManager } = await import('./ContainerService.js');

      // Find all services in the group
      const { services } = await ContainerServiceManager.listServices(
        organizationId,
        { search: groupName }
      );

      const groupServices = services.filter(s => 
        s.name.startsWith(`${groupName}-`) || s.slug.startsWith(`${groupName}-`)
      );

      if (groupServices.length === 0) {
        throw new Error('No services found in group');
      }

      // If not confirmed, return list of services that would be deleted
      if (!confirmed) {
        return {
          deleted: [],
          requiresConfirmation: true
        };
      }

      // Delete all services in the group
      const deletedIds: string[] = [];
      for (const service of groupServices) {
        await ContainerServiceManager.deleteService(service.id, organizationId);
        deletedIds.push(service.id);
        console.log(`   ✅ Deleted service: ${service.name} (${service.id})`);
      }

      console.log(`✅ Multi-service group deleted: ${groupName} (${deletedIds.length} services)`);

      return {
        deleted: deletedIds,
        requiresConfirmation: false
      };
    } catch (error) {
      console.error('Error deleting multi-service group:', error);
      throw error;
    }
  }

  /**
   * Map database row to ApplicationTemplate object
   */
  private static mapRowToTemplate(row: any): ApplicationTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      iconUrl: row.icon_url || undefined,
      nixExpression: row.nix_expression,
      defaultEnvVars:
        typeof row.default_env_vars === 'string'
          ? JSON.parse(row.default_env_vars)
          : row.default_env_vars,
      defaultResourceLimits:
        typeof row.default_resource_limits === 'string'
          ? JSON.parse(row.default_resource_limits)
          : row.default_resource_limits,
      isActive: row.is_active,
      displayOrder: row.display_order,
      isMultiService: row.is_multi_service || false,
      services: row.services
        ? typeof row.services === 'string'
          ? JSON.parse(row.services)
          : row.services
        : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
