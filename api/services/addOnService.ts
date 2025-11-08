/**
 * Add-on Service for SkyPanelV2 PaaS
 * Manages managed services (PostgreSQL, Redis, etc.) for PaaS applications
 */

import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';
import crypto from 'crypto';

export interface AddOnPlan {
  id: string;
  name: string;
  serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
  description?: string;
  specifications: Record<string, any>;
  priceHourly: number;
  priceMonthly: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddOnSubscription {
  id: string;
  organizationId: string;
  addonPlanId: string;
  appId?: string;
  name: string;
  status: 'provisioning' | 'active' | 'suspended' | 'error' | 'terminated';
  connectionString?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  providerInstanceId?: string;
  configuration: Record<string, any>;
  lastBilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  planName?: string;
  serviceType?: string;
  priceHourly?: number;
  appName?: string;
  priceMonthly?: number;
}

export interface AppAddOnSummary {
  id: string;
  name: string;
  status: string;
  serviceType: string;
  planName: string;
  priceHourly: number;
  priceMonthly: number;
  connectionString?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddOnSubscriptionRequest {
  organizationId: string;
  addonPlanId: string;
  appId?: string;
  name: string;
  configuration?: Record<string, any>;
}

export interface UpdateAddOnSubscriptionRequest {
  name?: string;
  configuration?: Record<string, any>;
}

export class AddOnService {
  private static mapPlanRow(row: any): AddOnPlan {
    return {
      id: row.id,
      name: row.name,
      serviceType: row.service_type,
      description: row.description,
      specifications: row.specifications || {},
      priceHourly: parseFloat(row.price_hourly),
      priceMonthly: parseFloat(row.price_monthly),
      active: Boolean(row.active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get all available add-on plans
   */
  static async getAvailablePlans(serviceType?: string): Promise<AddOnPlan[]> {
    try {
      let queryStr = `
        SELECT
          id,
          name,
          service_type,
          description,
          specifications,
          price_hourly,
          price_monthly,
          active,
          created_at,
          updated_at
        FROM paas_addon_plans
        WHERE active = true
      `;

      const params: any[] = [];

      if (serviceType) {
        queryStr += ` AND service_type = $1`;
        params.push(serviceType);
      }

      queryStr += ` ORDER BY service_type, price_monthly ASC`;

      const result = await query(queryStr, params);

      return result.rows.map(this.mapPlanRow);
    } catch (error) {
      console.error('Error getting add-on plans:', error);
      throw new Error('Failed to fetch add-on plans');
    }
  }

  /**
   * Get a specific add-on plan by ID
   */
  static async getPlanById(planId: string): Promise<AddOnPlan | null> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          service_type,
          description,
          specifications,
          price_hourly,
          price_monthly,
          active,
          created_at,
          updated_at
        FROM paas_addon_plans
        WHERE id = $1 AND active = true
      `, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapPlanRow(result.rows[0]);
    } catch (error) {
      console.error('Error getting add-on plan:', error);
      throw new Error('Failed to fetch add-on plan');
    }
  }

  /**
   * Create a new add-on plan (admin action)
   */
  static async createPlan(data: {
    name: string;
    serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
    description?: string;
    specifications?: Record<string, any>;
    priceHourly: number;
    priceMonthly: number;
    active?: boolean;
  }): Promise<AddOnPlan> {
    try {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) throw new Error('Invalid plan data: name is required');

      const allowedTypes = ['postgresql', 'redis', 'mysql', 'mongodb'];
      if (!allowedTypes.includes(data.serviceType)) {
        throw new Error('Invalid plan data: serviceType must be one of postgresql, redis, mysql, mongodb');
      }

      const priceHourly = Number(data.priceHourly);
      const priceMonthly = Number(data.priceMonthly);
      if (!Number.isFinite(priceHourly) || priceHourly < 0) {
        throw new Error('Invalid plan data: priceHourly must be >= 0');
      }
      if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
        throw new Error('Invalid plan data: priceMonthly must be >= 0');
      }

      const specifications = data.specifications || {};
      const description = data.description || null;
      const active = data.active !== undefined ? Boolean(data.active) : true;

      const result = await query(`
        INSERT INTO paas_addon_plans (
          name, service_type, description, specifications, price_hourly, price_monthly, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        name,
        data.serviceType,
        description,
        JSON.stringify(specifications),
        priceHourly,
        priceMonthly,
        active
      ]);

      return this.mapPlanRow(result.rows[0]);
    } catch (error) {
      console.error('Error creating add-on plan:', error);
      throw new Error(error instanceof Error ? `Invalid plan data: ${error.message}` : 'Failed to create add-on plan');
    }
  }

  /**
   * Update an existing add-on plan (admin action)
   */
  static async updatePlan(
    planId: string,
    data: Partial<{
      name: string;
      serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
      description: string;
      specifications: Record<string, any>;
      priceHourly: number;
      priceMonthly: number;
      active: boolean;
    }>
  ): Promise<AddOnPlan> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      const toNumberMin = (min: number) => (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= min ? n : undefined;
      };

      const fieldMap: Record<string, { column: string; transform?: (v: any) => any; validate?: (v: any) => void }> = {
        name: { column: 'name' },
        serviceType: {
          column: 'service_type',
          validate: (v: any) => {
            const allowed = ['postgresql', 'redis', 'mysql', 'mongodb'];
            if (!allowed.includes(v)) throw new Error('Invalid plan data: serviceType');
          }
        },
        description: { column: 'description' },
        specifications: { column: 'specifications', transform: (v: any) => JSON.stringify(v || {}) },
        priceHourly: { column: 'price_hourly', transform: toNumberMin(0) },
        priceMonthly: { column: 'price_monthly', transform: toNumberMin(0) },
        active: { column: 'active', transform: (v: any) => Boolean(v) }
      };

      for (const [key, value] of Object.entries(data)) {
        const map = fieldMap[key];
        if (!map) continue;

        if (map.validate) map.validate(value);
        const transformed = map.transform ? map.transform(value) : value;
        if (transformed === undefined) continue;

        updateFields.push(`${map.column} = $${paramIndex++}`);
        updateValues.push(transformed);
      }

      if (updateFields.length === 0) {
        throw new Error('No valid plan fields provided for update');
      }

      updateValues.push(planId);
      const updateResult = await query(`
        UPDATE paas_addon_plans
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, updateValues);

      if (updateResult.rows.length === 0) {
        throw new Error('Add-on plan not found');
      }

      return this.mapPlanRow(updateResult.rows[0]);
    } catch (error) {
      console.error('Error updating add-on plan:', error);
      const msg = error instanceof Error ? error.message : 'Failed to update add-on plan';
      throw new Error(msg);
    }
  }

  /**
   * Delete an add-on plan (admin action)
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      const usageResult = await query(
        'SELECT COUNT(*) as count FROM paas_addon_subscriptions WHERE addon_plan_id = $1',
        [planId]
      );

      const subCount = parseInt(usageResult.rows[0]?.count || '0', 10);
      if (subCount > 0) {
        throw new Error('Cannot delete add-on plan while subscriptions exist');
      }

      const deleteResult = await query('DELETE FROM paas_addon_plans WHERE id = $1', [planId]);
      if (deleteResult.rowCount === 0) {
        throw new Error('Add-on plan not found');
      }
    } catch (err: any) {
      if (err && typeof err === 'object') {
        const code = (err as any).code;
        if (code === '22P02') {
          // invalid_text_representation (bad UUID format)
          throw new Error('Invalid plan id format');
        }
        if (code === '23503') {
          // foreign_key_violation
          throw new Error('Cannot delete add-on plan because it is referenced by other records');
        }
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to delete add-on plan');
    }
  }

  /**
   * Create a new add-on subscription
   */
  static async createSubscription(
    data: CreateAddOnSubscriptionRequest,
    createdBy: string
  ): Promise<AddOnSubscription> {
    try {
      return await transaction(async (client) => {
        // Validate plan exists and is active
        const planResult = await client.query(
          'SELECT * FROM paas_addon_plans WHERE id = $1 AND active = true',
          [data.addonPlanId]
        );

        if (planResult.rows.length === 0) {
          throw new Error('Invalid or inactive add-on plan');
        }

        const plan = planResult.rows[0];

        // Validate app exists if provided
        if (data.appId) {
          const appResult = await client.query(
            'SELECT id, name FROM paas_apps WHERE id = $1 AND organization_id = $2',
            [data.appId, data.organizationId]
          );

          if (appResult.rows.length === 0) {
            throw new Error('Application not found');
          }
        }

        // Generate connection details
        const connectionDetails = this.generateConnectionDetails(plan.service_type, data.name);

        // Create the subscription
        const insertResult = await client.query(`
          INSERT INTO paas_addon_subscriptions (
            organization_id,
            addon_plan_id,
            app_id,
            name,
            status,
            connection_string_encrypted,
            host,
            port,
            database_name,
            username,
            password_encrypted,
            provider_instance_id,
            configuration,
            last_billed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `, [
          data.organizationId,
          data.addonPlanId,
          data.appId || null,
          data.name,
          'provisioning',
          connectionDetails.connectionString,
          connectionDetails.host,
          connectionDetails.port,
          connectionDetails.databaseName,
          connectionDetails.username,
          connectionDetails.password,
          connectionDetails.instanceId,
          JSON.stringify(data.configuration || {}),
          new Date()
        ]);

        const subscriptionRow = insertResult.rows[0];

        // Log the activity
        await logActivity({
          userId: createdBy,
          organizationId: data.organizationId,
          eventType: 'paas.addon.create',
          entityType: 'paas_addon_subscription',
          entityId: subscriptionRow.id,
          message: `Created ${plan.service_type} add-on: ${data.name}`,
          metadata: {
            addonName: data.name,
            serviceType: plan.service_type,
            planName: plan.name,
            appId: data.appId
          }
        });

        // In a real implementation, this would trigger actual provisioning
        // For now, we'll simulate successful provisioning
        await this.provisionAddOn(subscriptionRow.id, client);

        console.log(`✅ Created ${plan.service_type} add-on subscription: ${data.name}`);

        return {
          id: subscriptionRow.id,
          organizationId: subscriptionRow.organization_id,
          addonPlanId: subscriptionRow.addon_plan_id,
          appId: subscriptionRow.app_id,
          name: subscriptionRow.name,
          status: subscriptionRow.status,
          connectionString: connectionDetails.connectionString,
          host: connectionDetails.host,
          port: connectionDetails.port,
          databaseName: connectionDetails.databaseName,
          username: connectionDetails.username,
          providerInstanceId: connectionDetails.instanceId,
          configuration: subscriptionRow.configuration || {},
          lastBilledAt: subscriptionRow.last_billed_at ? new Date(subscriptionRow.last_billed_at) : undefined,
          createdAt: new Date(subscriptionRow.created_at),
          updatedAt: new Date(subscriptionRow.updated_at)
        };
      });
    } catch (error) {
      console.error('Error creating add-on subscription:', error);
      throw new Error(`Failed to create add-on subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get add-on subscriptions for an organization
   */
  static async getOrganizationSubscriptions(
    organizationId: string,
    serviceType?: string,
    appId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AddOnSubscription[]> {
    try {
      let queryStr = `
        SELECT
          s.*,
          p.name as plan_name,
          p.service_type,
          p.price_hourly,
          p.price_monthly,
          a.name as app_name
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans p ON s.addon_plan_id = p.id
        LEFT JOIN paas_apps a ON s.app_id = a.id
        WHERE s.organization_id = $1
      `;

      const params: any[] = [organizationId];

      if (serviceType) {
        queryStr += ` AND p.service_type = $${params.length + 1}`;
        params.push(serviceType);
      }

      if (appId) {
        queryStr += ` AND s.app_id = $${params.length + 1}`;
        params.push(appId);
      }

      queryStr += `
        ORDER BY s.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(queryStr, params);

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        addonPlanId: row.addon_plan_id,
        appId: row.app_id,
        name: row.name,
        status: row.status,
        connectionString: this.decryptConnectionString(row.connection_string_encrypted),
        host: row.host,
        port: row.port,
        databaseName: row.database_name,
        username: row.username,
        providerInstanceId: row.provider_instance_id,
        configuration: row.configuration || {},
        lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        planName: row.plan_name,
        serviceType: row.service_type,
        priceHourly: parseFloat(row.price_hourly),
        priceMonthly: parseFloat(row.price_monthly),
        appName: row.app_name
      }));
    } catch (error) {
      console.error('Error getting organization subscriptions:', error);
      throw new Error('Failed to fetch add-on subscriptions');
    }
  }

  /**
   * Get add-on subscriptions scoped to a specific application
   */
  static async getAppAddOns(appId: string, organizationId: string): Promise<AppAddOnSummary[]> {
    try {
      const result = await query(`
        SELECT
          s.id,
          s.name,
          s.status,
          s.connection_string_encrypted,
          s.created_at,
          s.updated_at,
          p.name as plan_name,
          p.service_type,
          p.price_hourly,
          p.price_monthly
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans p ON s.addon_plan_id = p.id
        WHERE s.app_id = $1 AND s.organization_id = $2
        ORDER BY s.created_at DESC
      `, [appId, organizationId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        serviceType: row.service_type,
        planName: row.plan_name,
        priceHourly: parseFloat(row.price_hourly),
        priceMonthly: parseFloat(row.price_monthly),
        connectionString: this.decryptConnectionString(row.connection_string_encrypted),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting app add-ons:', error);
      throw new Error('Failed to fetch app add-ons');
    }
  }

  /**
   * Get a specific add-on subscription
   */
  static async getSubscriptionById(
    subscriptionId: string,
    organizationId?: string
  ): Promise<AddOnSubscription | null> {
    try {
      let queryStr = `
        SELECT
          s.*,
          p.name as plan_name,
          p.service_type,
          p.price_hourly,
          a.name as app_name
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans p ON s.addon_plan_id = p.id
        LEFT JOIN paas_apps a ON s.app_id = a.id
        WHERE s.id = $1
      `;

      const params = [subscriptionId];

      if (organizationId) {
        queryStr += ` AND s.organization_id = $2`;
        params.push(organizationId);
      }

      const result = await query(queryStr, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        addonPlanId: row.addon_plan_id,
        appId: row.app_id,
        name: row.name,
        status: row.status,
        connectionString: this.decryptConnectionString(row.connection_string_encrypted),
        host: row.host,
        port: row.port,
        databaseName: row.database_name,
        username: row.username,
        providerInstanceId: row.provider_instance_id,
        configuration: row.configuration || {},
        lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting subscription by ID:', error);
      throw new Error('Failed to fetch add-on subscription');
    }
  }

  /**
   * Update an add-on subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    organizationId: string,
    data: UpdateAddOnSubscriptionRequest,
    updatedBy: string
  ): Promise<AddOnSubscription> {
    try {
      return await transaction(async (client) => {
        // Get current subscription for comparison
        const currentResult = await client.query(
          'SELECT * FROM paas_addon_subscriptions WHERE id = $1 AND organization_id = $2',
          [subscriptionId, organizationId]
        );

        if (currentResult.rows.length === 0) {
          throw new Error('Add-on subscription not found');
        }

        const currentSubscription = currentResult.rows[0];

        // Build dynamic update query
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
          updateFields.push(`name = $${paramIndex++}`);
          updateValues.push(data.name);
        }

        if (data.configuration !== undefined) {
          updateFields.push(`configuration = $${paramIndex++}`);
          updateValues.push(JSON.stringify(data.configuration));
        }

        if (updateFields.length === 0) {
          throw new Error('No fields to update');
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(subscriptionId, organizationId);

        const updateResult = await client.query(`
          UPDATE paas_addon_subscriptions
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
          RETURNING *
        `, updateValues);

        const updatedSubscription = updateResult.rows[0];

        // Log the activity
        await logActivity({
          userId: updatedBy,
          organizationId,
          eventType: 'paas.addon.update',
          entityType: 'paas_addon_subscription',
          entityId: subscriptionId,
          message: `Updated add-on subscription: ${updatedSubscription.name}`,
          metadata: {
            addonName: updatedSubscription.name,
            previousName: currentSubscription.name,
            changes: Object.keys(data)
          }
        });

        return {
          id: updatedSubscription.id,
          organizationId: updatedSubscription.organization_id,
          addonPlanId: updatedSubscription.addon_plan_id,
          appId: updatedSubscription.app_id,
          name: updatedSubscription.name,
          status: updatedSubscription.status,
          connectionString: this.decryptConnectionString(updatedSubscription.connection_string_encrypted),
          host: updatedSubscription.host,
          port: updatedSubscription.port,
          databaseName: updatedSubscription.database_name,
          username: updatedSubscription.username,
          providerInstanceId: updatedSubscription.provider_instance_id,
          configuration: updatedSubscription.configuration || {},
          lastBilledAt: updatedSubscription.last_billed_at ? new Date(updatedSubscription.last_billed_at) : undefined,
          createdAt: new Date(updatedSubscription.created_at),
          updatedAt: new Date(updatedSubscription.updated_at)
        };
      });
    } catch (error) {
      console.error('Error updating add-on subscription:', error);
      throw new Error(`Failed to update add-on subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an add-on subscription
   */
  static async deleteSubscription(
    subscriptionId: string,
    organizationId: string,
    deletedBy: string
  ): Promise<boolean> {
    try {
      return await transaction(async (client) => {
        // Get subscription details for logging
        const subscriptionResult = await client.query(`
          SELECT
            s.*,
            p.service_type
          FROM paas_addon_subscriptions s
          JOIN paas_addon_plans p ON s.addon_plan_id = p.id
          WHERE s.id = $1 AND s.organization_id = $2
        `, [subscriptionId, organizationId]);

        if (subscriptionResult.rows.length === 0) {
          throw new Error('Add-on subscription not found');
        }

        const subscription = subscriptionResult.rows[0];

        // Update status to terminated (soft delete for billing purposes)
        await client.query(`
          UPDATE paas_addon_subscriptions
          SET
            status = 'terminated',
            updated_at = NOW()
          WHERE id = $1 AND organization_id = $2
        `, [subscriptionId, organizationId]);

        // Log the activity
        await logActivity({
          userId: deletedBy,
          organizationId,
          eventType: 'paas.addon.delete',
          entityType: 'paas_addon_subscription',
          entityId: subscriptionId,
          message: `Terminated ${subscription.service_type} add-on: ${subscription.name}`,
          metadata: {
            addonName: subscription.name,
            serviceType: subscription.service_type,
            subscriptionId
          }
        });

        console.log(`🗑️ Terminated add-on subscription: ${subscription.name}`);

        return true;
      });
    } catch (error) {
      console.error('Error deleting add-on subscription:', error);
      throw new Error(`Failed to delete add-on subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get add-on statistics for an organization
   */
  static async getOrganizationStats(organizationId: string): Promise<{
    totalAddOns: number;
    activeAddOns: number;
    provisioningAddOns: number;
    suspendedAddOns: number;
    terminatedAddOns: number;
    monthlySpend: number;
    addOnsByType: Record<string, number>;
  }> {
    try {
      // Get subscription counts by status
      const statusResult = await query(`
        SELECT
          s.status,
          COUNT(*) as count,
          p.service_type
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans p ON s.addon_plan_id = p.id
        WHERE s.organization_id = $1
        GROUP BY s.status, p.service_type
      `, [organizationId]);

      const stats = {
        totalAddOns: 0,
        activeAddOns: 0,
        provisioningAddOns: 0,
        suspendedAddOns: 0,
        terminatedAddOns: 0,
        monthlySpend: 0,
        addOnsByType: {} as Record<string, number>
      };

      statusResult.rows.forEach(row => {
        const count = parseInt(row.count);
        const serviceType = row.service_type;

        stats.totalAddOns += count;

        switch (row.status) {
          case 'active':
            stats.activeAddOns += count;
            break;
          case 'provisioning':
            stats.provisioningAddOns += count;
            break;
          case 'suspended':
            stats.suspendedAddOns += count;
            break;
          case 'terminated':
            stats.terminatedAddOns += count;
            break;
        }

        stats.addOnsByType[serviceType] = (stats.addOnsByType[serviceType] || 0) + count;
      });

      // Get monthly spend from billing cycles
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const billingResult = await query(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM paas_billing_cycles
        WHERE organization_id = $1
          AND status = 'billed'
          AND created_at >= $2
          AND EXISTS (
            SELECT 1 FROM paas_addon_subscriptions s
            WHERE s.id = paas_billing_cycles.app_id
              AND s.organization_id = $1
          )
      `, [organizationId, startOfMonth]);

      stats.monthlySpend = parseFloat(billingResult.rows[0].total);

      return stats;
    } catch (error) {
      console.error('Error getting organization add-on stats:', error);
      throw new Error('Failed to fetch add-on statistics');
    }
  }

  /**
   * Generate connection details for a new add-on
   */
  private static generateConnectionDetails(
    serviceType: string,
    name: string
  ): {
    connectionString: string;
    host: string;
    port: number;
    databaseName?: string;
    username: string;
    password: string;
    instanceId: string;
  } {
    const instanceId = crypto.randomUUID();
    const password = crypto.randomBytes(16).toString('hex');
    const username = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_user`;

    let host: string;
    let port: number;
    let databaseName: string | undefined;
    let connectionString: string;

    switch (serviceType) {
      case 'postgresql':
        host = `${instanceId.substring(0, 8)}.db.skypanelv2.com`;
        port = 5432;
        databaseName = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db`;
        connectionString = `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
        break;

      case 'redis':
        host = `${instanceId.substring(0, 8)}.redis.skypanelv2.com`;
        port = 6379;
        connectionString = `redis://${username}:${password}@${host}:${port}`;
        break;

      case 'mysql':
        host = `${instanceId.substring(0, 8)}.db.skypanelv2.com`;
        port = 3306;
        databaseName = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db`;
        connectionString = `mysql://${username}:${password}@${host}:${port}/${databaseName}`;
        break;

      case 'mongodb':
        host = `${instanceId.substring(0, 8)}.mongo.skypanelv2.com`;
        port = 27017;
        databaseName = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db`;
        connectionString = `mongodb://${username}:${password}@${host}:${port}/${databaseName}`;
        break;

      default:
        throw new Error(`Unsupported service type: ${serviceType}`);
    }

    return {
      connectionString,
      host,
      port,
      databaseName,
      username,
      password,
      instanceId
    };
  }

  /**
   * Provision an add-on (simulated for now)
   */
  private static async provisionAddOn(subscriptionId: string, client: any): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Create the actual database/Redis instance on the provider
      // 2. Configure networking and security
      // 3. Set up backups and monitoring
      // 4. Update the subscription status to 'active'

      // For now, simulate successful provisioning
      await client.query(`
        UPDATE paas_addon_subscriptions
        SET status = 'active', updated_at = NOW()
        WHERE id = $1
      `, [subscriptionId]);

      console.log(`🚀 Provisioned add-on subscription: ${subscriptionId}`);
    } catch (error) {
      console.error('Error provisioning add-on:', error);
      throw error;
    }
  }

  /**
   * Encrypt connection string for database storage
   * Note: In production, use proper encryption like AES-256-GCM
   */
  private static encryptConnectionString(connectionString: string): string {
    // For now, using base64 encoding - implement proper encryption in production
    return Buffer.from(connectionString).toString('base64');
  }

  /**
   * Decrypt connection string from database storage
   */
  private static decryptConnectionString(encryptedConnectionString: string): string {
    // For now, using base64 decoding - implement proper decryption in production
    return Buffer.from(encryptedConnectionString, 'base64').toString('utf-8');
  }

  /**
   * Get connection details for an add-on (secure access)
   */
  static async getConnectionDetails(
    subscriptionId: string,
    organizationId: string
  ): Promise<{
    connectionString: string;
    host: string;
    port: number;
    databaseName?: string;
    username: string;
    serviceType: string;
  } | null> {
    try {
      const result = await query(`
        SELECT
          s.connection_string_encrypted,
          s.host,
          s.port,
          s.database_name,
          s.username,
          p.service_type
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans p ON s.addon_plan_id = p.id
        WHERE s.id = $1 AND s.organization_id = $2 AND s.status = 'active'
      `, [subscriptionId, organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        connectionString: this.decryptConnectionString(row.connection_string_encrypted),
        host: row.host,
        port: row.port,
        databaseName: row.database_name,
        username: row.username,
        serviceType: row.service_type
      };
    } catch (error) {
      console.error('Error getting connection details:', error);
      throw new Error('Failed to fetch connection details');
    }
  }
}
