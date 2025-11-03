/**
 * Resource Quota Service for SkyPanelV2
 * Handles resource quota calculations and validation for container deployments
 */

import { query } from '../lib/database.js';
import { ContainerServiceError, ERROR_CODES } from '../lib/containerErrors.js';
import { ContainerPlanService } from './containerPlanService.js';

// ============================================================
// Type Definitions
// ============================================================

export interface ResourceUsage {
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  containerCount: number;
}

export interface ResourceRequirement {
  cpuCores?: number;
  memoryGb?: number;
  storageGb?: number;
  containerCount?: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  exceededQuotas: string[];
  availableResources: ResourceUsage;
  requiredResources: ResourceUsage;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ServiceConfig {
  cpuLimit?: number;
  memoryLimitGb?: number;
  storageLimitGb?: number;
}

// ============================================================
// Resource Quota Service
// ============================================================

export class ResourceQuotaService {
  /**
   * Calculate current resource usage for an organization
   */
  static async calculateCurrentUsage(organizationId: string): Promise<ResourceUsage> {
    try {
      // Get the organization's active subscription
      const subscription = await ContainerPlanService.getSubscription(organizationId);
      
      if (!subscription) {
        // No subscription means no usage
        return {
          cpuCores: 0,
          memoryGb: 0,
          storageGb: 0,
          containerCount: 0
        };
      }

      // Query current resource usage from container services
      const result = await query(`
        SELECT 
          COALESCE(SUM(cs.cpu_limit), 0) as total_cpu,
          COALESCE(SUM(cs.memory_limit_gb), 0) as total_memory,
          COALESCE(SUM(cs.storage_limit_gb), 0) as total_storage,
          COUNT(cs.id) as total_containers
        FROM container_services cs
        INNER JOIN container_projects cp ON cs.project_id = cp.id
        WHERE cp.organization_id = $1 
          AND cp.status = 'active'
          AND cs.status NOT IN ('deleted', 'failed')
      `, [organizationId]);

      const row = result.rows[0];
      
      return {
        cpuCores: parseFloat(row.total_cpu) || 0,
        memoryGb: parseFloat(row.total_memory) || 0,
        storageGb: parseFloat(row.total_storage) || 0,
        containerCount: parseInt(row.total_containers) || 0
      };
    } catch (error) {
      console.error('Error calculating current resource usage:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to calculate current resource usage',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if requested resources are available within quota limits
   */
  static async checkQuotaAvailability(
    organizationId: string, 
    requiredResources: ResourceRequirement
  ): Promise<QuotaCheckResult> {
    try {
      // Get the organization's active subscription and plan
      const subscription = await ContainerPlanService.getSubscription(organizationId);
      
      if (!subscription || !subscription.plan) {
        return {
          allowed: false,
          exceededQuotas: ['No active container subscription found'],
          availableResources: { cpuCores: 0, memoryGb: 0, storageGb: 0, containerCount: 0 },
          requiredResources: {
            cpuCores: requiredResources.cpuCores || 0,
            memoryGb: requiredResources.memoryGb || 0,
            storageGb: requiredResources.storageGb || 0,
            containerCount: requiredResources.containerCount || 0
          }
        };
      }

      // Get current usage
      const currentUsage = await this.calculateCurrentUsage(organizationId);
      
      // Calculate what usage would be after adding the new resources
      const projectedUsage: ResourceUsage = {
        cpuCores: currentUsage.cpuCores + (requiredResources.cpuCores || 0),
        memoryGb: currentUsage.memoryGb + (requiredResources.memoryGb || 0),
        storageGb: currentUsage.storageGb + (requiredResources.storageGb || 0),
        containerCount: currentUsage.containerCount + (requiredResources.containerCount || 1)
      };

      // Check against plan limits
      const plan = subscription.plan;
      const exceededQuotas: string[] = [];

      if (projectedUsage.cpuCores > plan.maxCpuCores) {
        exceededQuotas.push(`CPU cores (${projectedUsage.cpuCores} > ${plan.maxCpuCores})`);
      }
      
      if (projectedUsage.memoryGb > plan.maxMemoryGb) {
        exceededQuotas.push(`Memory (${projectedUsage.memoryGb}GB > ${plan.maxMemoryGb}GB)`);
      }
      
      if (projectedUsage.storageGb > plan.maxStorageGb) {
        exceededQuotas.push(`Storage (${projectedUsage.storageGb}GB > ${plan.maxStorageGb}GB)`);
      }
      
      if (projectedUsage.containerCount > plan.maxContainers) {
        exceededQuotas.push(`Container count (${projectedUsage.containerCount} > ${plan.maxContainers})`);
      }

      // Calculate available resources
      const availableResources: ResourceUsage = {
        cpuCores: Math.max(0, plan.maxCpuCores - currentUsage.cpuCores),
        memoryGb: Math.max(0, plan.maxMemoryGb - currentUsage.memoryGb),
        storageGb: Math.max(0, plan.maxStorageGb - currentUsage.storageGb),
        containerCount: Math.max(0, plan.maxContainers - currentUsage.containerCount)
      };

      return {
        allowed: exceededQuotas.length === 0,
        exceededQuotas,
        availableResources,
        requiredResources: {
          cpuCores: requiredResources.cpuCores || 0,
          memoryGb: requiredResources.memoryGb || 0,
          storageGb: requiredResources.storageGb || 0,
          containerCount: requiredResources.containerCount || 0
        }
      };
    } catch (error) {
      console.error('Error checking quota availability:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to check quota availability',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Validate a service deployment against quota limits
   */
  static async validateDeployment(
    organizationId: string, 
    serviceConfig: ServiceConfig
  ): Promise<ValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate service configuration
      if (serviceConfig.cpuLimit !== undefined && serviceConfig.cpuLimit <= 0) {
        errors.push('CPU limit must be a positive number');
      }
      
      if (serviceConfig.memoryLimitGb !== undefined && serviceConfig.memoryLimitGb <= 0) {
        errors.push('Memory limit must be a positive number');
      }
      
      if (serviceConfig.storageLimitGb !== undefined && serviceConfig.storageLimitGb <= 0) {
        errors.push('Storage limit must be a positive number');
      }

      // If there are validation errors, return early
      if (errors.length > 0) {
        return {
          valid: false,
          errors,
          warnings
        };
      }

      // Check quota availability
      const requiredResources: ResourceRequirement = {
        cpuCores: serviceConfig.cpuLimit || 0,
        memoryGb: serviceConfig.memoryLimitGb || 0,
        storageGb: serviceConfig.storageLimitGb || 0,
        containerCount: 1 // Each service deployment counts as one container
      };

      const quotaCheck = await this.checkQuotaAvailability(organizationId, requiredResources);

      if (!quotaCheck.allowed) {
        errors.push(...quotaCheck.exceededQuotas.map(quota => `Quota exceeded: ${quota}`));
      }

      // Add warnings for high resource usage (>80% of quota)
      const subscription = await ContainerPlanService.getSubscription(organizationId);
      if (subscription && subscription.plan) {
        const currentUsage = await this.calculateCurrentUsage(organizationId);
        const plan = subscription.plan;

        const cpuUsagePercent = (currentUsage.cpuCores / plan.maxCpuCores) * 100;
        const memoryUsagePercent = (currentUsage.memoryGb / plan.maxMemoryGb) * 100;
        const storageUsagePercent = (currentUsage.storageGb / plan.maxStorageGb) * 100;
        const containerUsagePercent = (currentUsage.containerCount / plan.maxContainers) * 100;

        if (cpuUsagePercent > 80) {
          warnings.push(`High CPU usage: ${cpuUsagePercent.toFixed(1)}% of quota used`);
        }
        
        if (memoryUsagePercent > 80) {
          warnings.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}% of quota used`);
        }
        
        if (storageUsagePercent > 80) {
          warnings.push(`High storage usage: ${storageUsagePercent.toFixed(1)}% of quota used`);
        }
        
        if (containerUsagePercent > 80) {
          warnings.push(`High container usage: ${containerUsagePercent.toFixed(1)}% of quota used`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error validating deployment:', error);
      return {
        valid: false,
        errors: ['Failed to validate deployment against quotas'],
        warnings: []
      };
    }
  }

  /**
   * Get resource usage summary for an organization
   */
  static async getResourceUsageSummary(organizationId: string): Promise<{
    currentUsage: ResourceUsage;
    planLimits: ResourceUsage | null;
    usagePercentages: ResourceUsage | null;
  }> {
    try {
      const currentUsage = await this.calculateCurrentUsage(organizationId);
      const subscription = await ContainerPlanService.getSubscription(organizationId);

      if (!subscription || !subscription.plan) {
        return {
          currentUsage,
          planLimits: null,
          usagePercentages: null
        };
      }

      const plan = subscription.plan;
      const planLimits: ResourceUsage = {
        cpuCores: plan.maxCpuCores,
        memoryGb: plan.maxMemoryGb,
        storageGb: plan.maxStorageGb,
        containerCount: plan.maxContainers
      };

      const usagePercentages: ResourceUsage = {
        cpuCores: plan.maxCpuCores > 0 ? (currentUsage.cpuCores / plan.maxCpuCores) * 100 : 0,
        memoryGb: plan.maxMemoryGb > 0 ? (currentUsage.memoryGb / plan.maxMemoryGb) * 100 : 0,
        storageGb: plan.maxStorageGb > 0 ? (currentUsage.storageGb / plan.maxStorageGb) * 100 : 0,
        containerCount: plan.maxContainers > 0 ? (currentUsage.containerCount / plan.maxContainers) * 100 : 0
      };

      return {
        currentUsage,
        planLimits,
        usagePercentages
      };
    } catch (error) {
      console.error('Error getting resource usage summary:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to get resource usage summary',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if an organization can deploy a specific number of containers
   */
  static async canDeployContainers(organizationId: string, containerCount: number): Promise<boolean> {
    try {
      const quotaCheck = await this.checkQuotaAvailability(organizationId, {
        containerCount
      });
      
      return quotaCheck.allowed;
    } catch (error) {
      console.error('Error checking container deployment capacity:', error);
      return false;
    }
  }

  /**
   * Get available resources for an organization
   */
  static async getAvailableResources(organizationId: string): Promise<ResourceUsage | null> {
    try {
      const quotaCheck = await this.checkQuotaAvailability(organizationId, {});
      return quotaCheck.availableResources;
    } catch (error) {
      console.error('Error getting available resources:', error);
      return null;
    }
  }
}