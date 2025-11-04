/**
 * Container Plan Service for SkyPanelV2
 * Handles container plan management and subscription operations
 */

import { query, transaction } from '../lib/database.js';
import { PayPalService } from './paypalService.js';
import { easypanelService } from './easypanelService.js';
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
}

export interface UpdateContainerPlanInput {
  name?: string;
  description?: string;
  priceMonthly?: number;
  maxCpuCores?: number;
  maxMemoryGb?: number;
  maxStorageGb?: number;
  maxContainers?: number;
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
        maxCpuCores: row.max_cpu_cores,
        maxMemoryGb: row.max_memory_gb,
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
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
        maxCpuCores: row.max_cpu_cores,
        maxMemoryGb: row.max_memory_gb,
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
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
          planData.maxStorageGb <= 0 || planData.maxContainers <= 0) {
        throw new Error('Resource limits must be positive numbers');
      }

      const result = await query(`
        INSERT INTO container_plans (
          name, description, price_monthly, max_cpu_cores, 
          max_memory_gb, max_storage_gb, max_containers
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          id, name, description, price_monthly, max_cpu_cores,
          max_memory_gb, max_storage_gb, max_containers, active,
          created_at, updated_at
      `, [
        planData.name.trim(),
        planData.description?.trim() || null,
        planData.priceMonthly,
        planData.maxCpuCores,
        planData.maxMemoryGb,
        planData.maxStorageGb,
        planData.maxContainers
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        maxCpuCores: row.max_cpu_cores,
        maxMemoryGb: row.max_memory_gb,
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
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
          (updates.maxContainers !== undefined && updates.maxContainers <= 0)) {
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
          max_memory_gb, max_storage_gb, max_containers, active,
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
        maxCpuCores: row.max_cpu_cores,
        maxMemoryGb: row.max_memory_gb,
        maxStorageGb: row.max_storage_gb,
        maxContainers: row.max_containers,
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

        // Get organization and user details for Easypanel account
        const orgUserResult = await client.query(`
          SELECT u.id, u.email, o.name as org_name
          FROM users u
          JOIN organizations o ON o.id = u.organization_id
          WHERE u.organization_id = $1 AND u.role = 'owner'
          LIMIT 1
        `, [organizationId]);

        if (orgUserResult.rows.length === 0) {
          throw new Error('Organization owner not found');
        }

        const orgOwner = orgUserResult.rows[0];
        const easypanelUserEmail = orgOwner.email;
        
        // Generate a secure random password for the Easypanel user
        const easypanelPassword = crypto.randomBytes(32).toString('base64');
        const encryptedPassword = encryptSecret(easypanelPassword);

        // Create Easypanel user (non-admin)
        let easypanelUser;
        try {
          easypanelUser = await easypanelService.createUser(easypanelUserEmail, easypanelPassword, false);
        } catch (error: any) {
          console.error('Failed to create Easypanel user:', error);
          throw new Error(`Failed to create Easypanel user account: ${error.message || 'Unknown error'}`);
        }

        // Create subscription
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const subscriptionResult = await client.query(`
          INSERT INTO container_subscriptions (
            organization_id, plan_id, status, current_period_start, current_period_end,
            easypanel_user_id, easypanel_user_email, easypanel_password_encrypted
          )
          VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
          RETURNING 
            id, organization_id, plan_id, status, 
            current_period_start, current_period_end, created_at, updated_at,
            easypanel_user_id, easypanel_user_email
        `, [organizationId, planId, now, periodEnd, easypanelUser.id, easypanelUserEmail, encryptedPassword]);

        const subscription = subscriptionResult.rows[0];

        // Create an initial project for the user
        const initialProjectName = `${orgOwner.org_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-project`.substring(0, 50);
        
        try {
          // Create project in Easypanel
          await easypanelService.createProject(initialProjectName);
          
          // Grant the user access to the project
          await easypanelService.updateProjectAccess(initialProjectName, easypanelUser.id, true);

          // Store the project in our database
          await client.query(`
            INSERT INTO container_projects (
              organization_id, subscription_id, project_name, easypanel_project_name, status
            )
            VALUES ($1, $2, $3, $4, 'active')
          `, [organizationId, subscription.id, initialProjectName, initialProjectName]);
        } catch (error: any) {
          console.error('Failed to create initial Easypanel project:', error);
          // Don't fail the entire subscription if project creation fails
          // The user can create projects later
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
   * Cancel a container subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      return await transaction(async (client) => {
        // Check if subscription exists and is active
        const subscriptionResult = await client.query(`
          SELECT id, organization_id, status FROM container_subscriptions 
          WHERE id = $1
        `, [subscriptionId]);

        if (subscriptionResult.rows.length === 0) {
          throw new Error('Container subscription not found');
        }

        const subscription = subscriptionResult.rows[0];
        if (subscription.status !== 'active') {
          throw new Error('Subscription is not active');
        }

        // Check if organization has any active projects
        const projectsResult = await client.query(`
          SELECT COUNT(*) as count FROM container_projects 
          WHERE subscription_id = $1 AND status = 'active'
        `, [subscriptionId]);

        const activeProjectCount = parseInt(projectsResult.rows[0].count);
        if (activeProjectCount > 0) {
          throw new Error(`Cannot cancel subscription with ${activeProjectCount} active project(s). Please delete all projects first.`);
        }

        // Cancel the subscription
        await client.query(`
          UPDATE container_subscriptions 
          SET status = 'cancelled'
          WHERE id = $1
        `, [subscriptionId]);
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
          maxCpuCores: row.max_cpu_cores,
          maxMemoryGb: row.max_memory_gb,
          maxStorageGb: row.max_storage_gb,
          maxContainers: row.max_containers,
          active: row.plan_active,
          createdAt: '', // Not needed for joined data
          updatedAt: ''  // Not needed for joined data
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
          maxCpuCores: row.max_cpu_cores,
          maxMemoryGb: row.max_memory_gb,
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