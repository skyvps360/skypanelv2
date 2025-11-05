/**
 * Container Plan Service for SkyPanelV2
 * Handles container plan management and subscription operations
 */

import { query, transaction } from '../lib/database.js';
import { PayPalService } from './paypalService.js';
import { dokployService } from './dokployService.js';
import { encryptSecret } from '../lib/crypto.js';
import crypto from 'crypto';

export interface ContainerPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxContainers: number;
  maxProjects: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerSubscription {
  id: string;
  organizationId: string;
  planId: string;
  plan?: ContainerPlan;
  status: 'active' | 'suspended' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContainerPlanInput {
  name: string;
  description?: string;
  priceMonthly: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxContainers: number;
  maxProjects: number;
}

export interface UpdateContainerPlanInput {
  name?: string;
  description?: string;
  priceMonthly?: number;
  maxCpuCores?: number;
  maxMemoryGb?: number;
  maxStorageGb?: number;
  maxContainers?: number;
  maxProjects?: number;
}

export class ContainerPlanService {
  /**
   * List all container plans with optional active filter
   */
  static async listPlans(activeOnly: boolean = false): Promise<ContainerPlan[]> {
    try {
      const whereClause = activeOnly ? 'WHERE active = true' : '';
      const result = await query(`
        SELECT 
          id,
          name,
          description,
          price_monthly,
          max_cpu_cores,
          max_memory_gb,
          max_storage_gb,
          max_containers,
          max_projects,
          active,
          created_at,
          updated_at
        FROM container_plans
        ${whereClause}
        ORDER BY price_monthly ASC, name ASC
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        maxCpuCores: parseFloat(row.max_cpu_cores),
        maxMemoryGb: parseFloat(row.max_memory_gb),
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
        maxProjects: row.max_projects,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing container plans:', error);
      throw new Error('Failed to list container plans');
    }
  }

  /**
   * Get a specific container plan by ID
   */
  static async getPlan(planId: string): Promise<ContainerPlan | null> {
    try {
      const result = await query(`
        SELECT 
          id,
          name,
          description,
          price_monthly,
          max_cpu_cores,
          max_memory_gb,
          max_storage_gb,
          max_containers,
          max_projects,
          active,
          created_at,
          updated_at
        FROM container_plans
        WHERE id = $1
      `, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        maxCpuCores: parseFloat(row.max_cpu_cores),
        maxMemoryGb: parseFloat(row.max_memory_gb),
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
        maxProjects: row.max_projects,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error getting container plan:', error);
      throw new Error('Failed to get container plan');
    }
  }

  /**
   * Create a new container plan
   */
  static async createPlan(planData: CreateContainerPlanInput): Promise<ContainerPlan> {
    try {
      // Validate input
      if (!planData.name || planData.name.trim().length === 0) {
        throw new Error('Plan name is required');
      }
      if (planData.priceMonthly < 0) {
        throw new Error('Price must be non-negative');
      }
      if (planData.maxCpuCores <= 0 || planData.maxMemoryGb <= 0 || 
          planData.maxStorageGb <= 0 || planData.maxContainers <= 0 || planData.maxProjects <= 0) {
        throw new Error('Resource limits must be positive numbers');
      }

      const result = await query(`
        INSERT INTO container_plans (
          name, description, price_monthly, max_cpu_cores, 
          max_memory_gb, max_storage_gb, max_containers, max_projects
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          id, name, description, price_monthly, max_cpu_cores,
          max_memory_gb, max_storage_gb, max_containers, max_projects, active,
          created_at, updated_at
      `, [
        planData.name.trim(),
        planData.description?.trim() || null,
        planData.priceMonthly,
        planData.maxCpuCores,
        planData.maxMemoryGb,
        planData.maxStorageGb,
        planData.maxContainers,
        planData.maxProjects
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        maxCpuCores: parseFloat(row.max_cpu_cores),
        maxMemoryGb: parseFloat(row.max_memory_gb),
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
        maxProjects: row.max_projects,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error creating container plan:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error('A plan with this name already exists');
      }
      throw error instanceof Error ? error : new Error('Failed to create container plan');
    }
  }

  /**
   * Update an existing container plan
   */
  static async updatePlan(planId: string, updates: UpdateContainerPlanInput): Promise<ContainerPlan> {
    try {
      // Validate input
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        throw new Error('Plan name cannot be empty');
      }
      if (updates.priceMonthly !== undefined && updates.priceMonthly < 0) {
        throw new Error('Price must be non-negative');
      }
      if ((updates.maxCpuCores !== undefined && updates.maxCpuCores <= 0) ||
          (updates.maxMemoryGb !== undefined && updates.maxMemoryGb <= 0) ||
          (updates.maxStorageGb !== undefined && updates.maxStorageGb <= 0) ||
          (updates.maxContainers !== undefined && updates.maxContainers <= 0) ||
          (updates.maxProjects !== undefined && updates.maxProjects <= 0)) {
        throw new Error('Resource limits must be positive numbers');
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name.trim());
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description?.trim() || null);
      }
      if (updates.priceMonthly !== undefined) {
        updateFields.push(`price_monthly = $${paramIndex++}`);
        values.push(updates.priceMonthly);
      }
      if (updates.maxCpuCores !== undefined) {
        updateFields.push(`max_cpu_cores = $${paramIndex++}`);
        values.push(updates.maxCpuCores);
      }
      if (updates.maxMemoryGb !== undefined) {
        updateFields.push(`max_memory_gb = $${paramIndex++}`);
        values.push(updates.maxMemoryGb);
      }
      if (updates.maxStorageGb !== undefined) {
        updateFields.push(`max_storage_gb = $${paramIndex++}`);
        values.push(updates.maxStorageGb);
      }
      if (updates.maxContainers !== undefined) {
        updateFields.push(`max_containers = $${paramIndex++}`);
        values.push(updates.maxContainers);
      }
      if (updates.maxProjects !== undefined) {
        updateFields.push(`max_projects = $${paramIndex++}`);
        values.push(updates.maxProjects);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(planId);

      const result = await query(`
        UPDATE container_plans 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING 
          id, name, description, price_monthly, max_cpu_cores,
          max_memory_gb, max_storage_gb, max_containers, max_projects, active,
          created_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Container plan not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        maxCpuCores: parseFloat(row.max_cpu_cores),
        maxMemoryGb: parseFloat(row.max_memory_gb),
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
        maxProjects: row.max_projects,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error updating container plan:', error);
      throw error instanceof Error ? error : new Error('Failed to update container plan');
    }
  }

  /**
   * Activate a container plan
   */
  static async activatePlan(planId: string): Promise<void> {
    try {
      const result = await query(`
        UPDATE container_plans 
        SET active = true
        WHERE id = $1
      `, [planId]);

      if (result.rowCount === 0) {
        throw new Error('Container plan not found');
      }
    } catch (error) {
      console.error('Error activating container plan:', error);
      throw error instanceof Error ? error : new Error('Failed to activate container plan');
    }
  }

  /**
   * Deactivate a container plan
   */
  static async deactivatePlan(planId: string): Promise<void> {
    try {
      const result = await query(`
        UPDATE container_plans 
        SET active = false
        WHERE id = $1
      `, [planId]);

      if (result.rowCount === 0) {
        throw new Error('Container plan not found');
      }
    } catch (error) {
      console.error('Error deactivating container plan:', error);
      throw error instanceof Error ? error : new Error('Failed to deactivate container plan');
    }
  }

  /**
   * Delete a container plan
   * Only allows deletion if there are no active subscriptions
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      // Check for active subscriptions
      const subscriptionCheck = await query(`
        SELECT COUNT(*) as count
        FROM container_subscriptions
        WHERE plan_id = $1 AND status = 'active'
      `, [planId]);

      const activeSubscriptions = parseInt(subscriptionCheck.rows[0].count);
      if (activeSubscriptions > 0) {
        throw new Error(`Cannot delete plan with ${activeSubscriptions} active subscription(s). Please deactivate the plan instead.`);
      }

      // Delete the plan
      const result = await query(`
        DELETE FROM container_plans 
        WHERE id = $1
      `, [planId]);

      if (result.rowCount === 0) {
        throw new Error('Container plan not found');
      }
    } catch (error) {
      console.error('Error deleting container plan:', error);
      throw error instanceof Error ? error : new Error('Failed to delete container plan');
    }
  }

  /**
   * Subscribe an organization to a container plan
   */
  static async subscribe(organizationId: string, planId: string): Promise<ContainerSubscription> {
    try {
      return await transaction(async (client) => {
        // Check if organization already has an active subscription
        const existingResult = await client.query(`
          SELECT id FROM container_subscriptions 
          WHERE organization_id = $1 AND status = 'active'
        `, [organizationId]);

        if (existingResult.rows.length > 0) {
          throw new Error('Organization already has an active container subscription');
        }

        // Get plan details
        const planResult = await client.query(`
          SELECT id, name, price_monthly, active
          FROM container_plans 
          WHERE id = $1
        `, [planId]);

        if (planResult.rows.length === 0) {
          throw new Error('Container plan not found');
        }

        const plan = planResult.rows[0];
        if (!plan.active) {
          throw new Error('Container plan is not active');
        }

        // Check wallet balance
        const walletResult = await client.query(`
          SELECT balance FROM wallets WHERE organization_id = $1
        `, [organizationId]);

        if (walletResult.rows.length === 0) {
          throw new Error('Organization wallet not found');
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);
        const monthlyPrice = parseFloat(plan.price_monthly);

        if (currentBalance < monthlyPrice) {
          throw new Error(`Insufficient wallet balance. Required: $${monthlyPrice.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
        }

        // Deduct monthly fee from wallet
        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          organizationId,
          monthlyPrice,
          `Container Plan Subscription - ${plan.name}`
        );

        if (!deductionSuccess) {
          throw new Error('Failed to deduct subscription fee from wallet');
        }

        // Get organization and owner user details
        const orgUserResult = await client.query(`
          SELECT u.id, u.email, o.name as org_name
          FROM organizations o
          JOIN users u ON u.id = o.owner_id
          WHERE o.id = $1
          LIMIT 1
        `, [organizationId]);

        if (orgUserResult.rows.length === 0) {
          throw new Error('Organization owner not found');
        }

        const orgOwner = orgUserResult.rows[0];
        
        // NOTE: Dokploy doesn't support user creation like Easypanel did
        // We only create projects directly for the organization
        
        // Create subscription
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const subscriptionResult = await client.query(`
          INSERT INTO container_subscriptions (
            organization_id, plan_id, status, current_period_start, current_period_end
          )
          VALUES ($1, $2, 'active', $3, $4)
          RETURNING 
            id, organization_id, plan_id, status, 
            current_period_start, current_period_end, created_at, updated_at
        `, [organizationId, planId, now, periodEnd]);

        const subscription = subscriptionResult.rows[0];

        // Create an initial project for the organization using Dokploy
        const initialProjectName = `${orgOwner.org_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-project`.substring(0, 50);
        
        let projectCreated = false;
        let dokployProjectId: string | null = null;
        try {
          console.log(`Creating initial project "${initialProjectName}" for organization ${organizationId}`);
          
          // Create project in Dokploy (no user creation needed)
          const dokployProject = await dokployService.createProject(
            initialProjectName, 
            `Project for ${orgOwner.org_name}`
          );
          projectCreated = true;
          dokployProjectId = dokployProject.projectId;
          console.log(`Successfully created Dokploy project "${initialProjectName}" with ID: ${dokployProjectId}`);
        } catch (error: any) {
          console.error('Failed to create initial Dokploy project:', error);
        }

        // Store the project in our database if creation succeeded
        if (projectCreated && dokployProjectId) {
          try {
            await client.query(`
              INSERT INTO container_projects (
                organization_id, subscription_id, project_name, dokploy_project_id, status
              )
              VALUES ($1, $2, $3, $4, 'active')
            `, [organizationId, subscription.id, initialProjectName, dokployProjectId]);
            console.log(`Successfully stored project in database for organization ${organizationId}`);
          } catch (dbErr) {
            console.error('Failed to store project in database:', dbErr);
          }
        }

        // Create initial billing cycle
        await client.query(`
          INSERT INTO container_billing_cycles (
            subscription_id, organization_id, billing_period_start, 
            billing_period_end, monthly_rate, status
          )
          VALUES ($1, $2, $3, $4, $5, 'billed')
        `, [subscription.id, organizationId, now, periodEnd, monthlyPrice]);

        return {
          id: subscription.id,
          organizationId: subscription.organization_id,
          planId: subscription.plan_id,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          createdAt: subscription.created_at,
          updatedAt: subscription.updated_at
        };
      });
    } catch (error) {
      console.error('Error creating container subscription:', error);
      throw error instanceof Error ? error : new Error('Failed to create container subscription');
    }
  }

  /**
   * Cancel a container subscription with prorated refund and cleanup
   */
  static async cancelSubscription(subscriptionId: string): Promise<{ refundAmount: number; projectsDeleted: number }> {
    try {
      return await transaction(async (client) => {
        // Get subscription details with plan pricing
        const subscriptionResult = await client.query(`
          SELECT cs.*, cp.price_monthly
          FROM container_subscriptions cs
          JOIN container_plans cp ON cs.plan_id = cp.id
          WHERE cs.id = $1
        `, [subscriptionId]);

        if (subscriptionResult.rows.length === 0) {
          throw new Error('Container subscription not found');
        }

        const subscription = subscriptionResult.rows[0];
        if (subscription.status !== 'active') {
          throw new Error('Subscription is not active');
        }

        // Calculate prorated refund
        const now = new Date();
        const periodStart = new Date(subscription.current_period_start);
        
        const totalDays = 30; // Monthly subscription
        const daysElapsed = Math.floor((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, totalDays - daysElapsed);
        
        const monthlyPrice = parseFloat(subscription.price_monthly);
        const refundAmount = Number(((daysRemaining / totalDays) * monthlyPrice).toFixed(2));

        // Get all Easypanel projects for this organization
        const projectsResult = await client.query(`
          SELECT project_name, easypanel_project_name
          FROM container_projects
          WHERE organization_id = $1
        `, [subscription.organization_id]);

        const projects = projectsResult.rows;
        let projectsDeleted = 0;

        // Delete all Easypanel projects via API
        if (projects.length > 0) {
          for (const project of projects) {
            try {
              await easypanelService.destroyProject(project.easypanel_project_name);
              
              // Remove from database
              await client.query(`
                DELETE FROM container_projects
                WHERE easypanel_project_name = $1 AND organization_id = $2
              `, [project.easypanel_project_name, subscription.organization_id]);
              
              projectsDeleted++;
            } catch (error) {
              console.error(`Failed to delete project ${project.easypanel_project_name}:`, error);
              // Continue with other projects even if one fails
            }
          }
        }

        // Credit wallet with refund if amount > 0
        if (refundAmount > 0) {
          const PayPalService = (await import('./paypalService.js')).PayPalService;
          const refundSuccess = await PayPalService.addFundsToWallet(
            subscription.organization_id,
            refundAmount,
            `Prorated refund for cancelled container subscription (${daysRemaining} days remaining)`,
            undefined,
            undefined,
            {
              subscription_id: subscriptionId,
              days_remaining: daysRemaining,
              monthly_price: monthlyPrice,
              refund_type: 'prorated_cancellation'
            }
          );

          if (!refundSuccess) {
            console.error('Failed to credit wallet with refund, but continuing with cancellation');
          }
        }

        // Update subscription status to cancelled
        await client.query(`
          UPDATE container_subscriptions 
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1
        `, [subscriptionId]);

        return { refundAmount, projectsDeleted };
      });
    } catch (error) {
      console.error('Error cancelling container subscription:', error);
      throw error instanceof Error ? error : new Error('Failed to cancel container subscription');
    }
  }

  /**
   * Get current subscription for an organization
   */
  static async getSubscription(organizationId: string): Promise<ContainerSubscription | null> {
    try {
      const result = await query(`
        SELECT 
          cs.id,
          cs.organization_id,
          cs.plan_id,
          cs.status,
          cs.current_period_start,
          cs.current_period_end,
          cs.created_at,
          cs.updated_at,
          cp.name as plan_name,
          cp.description as plan_description,
          cp.price_monthly,
          cp.max_cpu_cores,
          cp.max_memory_gb,
          cp.max_storage_gb,
          cp.max_containers,
          cp.max_projects,
          cp.active as plan_active
        FROM container_subscriptions cs
        LEFT JOIN container_plans cp ON cs.plan_id = cp.id
        WHERE cs.organization_id = $1 AND cs.status = 'active'
        ORDER BY cs.created_at DESC
        LIMIT 1
      `, [organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        planId: row.plan_id,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        plan: row.plan_name ? {
          id: row.plan_id,
          name: row.plan_name,
          description: row.plan_description,
          priceMonthly: parseFloat(row.price_monthly),
          maxCpuCores: parseFloat(row.max_cpu_cores),
          maxMemoryGb: parseFloat(row.max_memory_gb),
          maxStorageGb: row.max_storage_gb,
          maxContainers: row.max_containers,
          maxProjects: row.max_projects,
          active: row.plan_active,
          createdAt: '', // Not needed for joined data
          updatedAt: ''
        } : undefined
      };
    } catch (error) {
      console.error('Error getting container subscription:', error);
      throw new Error('Failed to get container subscription');
    }
  }

  /**
   * List all subscriptions (admin only)
   */
  static async listSubscriptions(): Promise<ContainerSubscription[]> {
    try {
      const result = await query(`
        SELECT 
          cs.id,
          cs.organization_id,
          cs.plan_id,
          cs.status,
          cs.current_period_start,
          cs.current_period_end,
          cs.created_at,
          cs.updated_at,
          cp.name as plan_name,
          cp.description as plan_description,
          cp.price_monthly,
          cp.max_cpu_cores,
          cp.max_memory_gb,
          cp.max_storage_gb,
          cp.max_containers,
          cp.active as plan_active,
          o.name as organization_name
        FROM container_subscriptions cs
        LEFT JOIN container_plans cp ON cs.plan_id = cp.id
        LEFT JOIN organizations o ON cs.organization_id = o.id
        ORDER BY cs.created_at DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        planId: row.plan_id,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        plan: row.plan_name ? {
          id: row.plan_id,
          name: row.plan_name,
          description: row.plan_description,
          priceMonthly: parseFloat(row.price_monthly),
          maxCpuCores: parseFloat(row.max_cpu_cores),
          maxMemoryGb: parseFloat(row.max_memory_gb),
          maxStorageGb: row.max_storage_gb,
          maxContainers: row.max_containers,
          active: row.plan_active,
          createdAt: '',
          updatedAt: ''
        } : undefined
      }));
    } catch (error) {
      console.error('Error listing container subscriptions:', error);
      throw new Error('Failed to list container subscriptions');
    }
  }
}