/**
 * PaaS (Platform as a Service) Service for SkyPanelV2
 * Handles application lifecycle, deployment management, and resource orchestration
 */

import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';

export interface PaasPlan {
  id: string;
  name: string;
  description?: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  bandwidthGb: number;
  priceHourly: number;
  priceMonthly: number;
  maxDeployments: number;
  maxEnvironmentVars: number;
  supportsCustomDomains: boolean;
  supportsAutoDeployments: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  bandwidthGb: number;
  priceHourly: number;
  priceMonthly: number;
  maxDeployments: number;
  maxEnvironmentVars: number;
  supportsCustomDomains: boolean;
  supportsAutoDeployments: boolean;
  active: boolean;
  displayOrder: number;
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {}

export interface PaasApp {
  id: string;
  organizationId: string;
  planId: string;
  name: string;
  slug: string;
  description?: string;
  githubRepoUrl?: string;
  githubBranch: string;
  githubCommitSha?: string;
  status: 'created' | 'building' | 'deployed' | 'stopped' | 'error' | 'building_failed' | 'deployment_failed';
  dockerfilePath: string;
  buildCommand: string;
  startCommand: string;
  environmentVariables: Record<string, string>;
  autoDeployments: boolean;
  lastDeployedAt?: Date;
  lastBuiltAt?: Date;
  assignedWorkerId?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  healthCheckUrl?: string;
  healthCheckInterval: number;
  customDomains: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaasDeployment {
  id: string;
  appId: string;
  version: string;
  githubCommitSha?: string;
  githubCommitMessage?: string;
  githubCommitAuthor?: string;
  status: 'pending' | 'building' | 'building_success' | 'building_failed' | 'deploying' | 'deployed' | 'deployment_failed' | 'rollback' | 'rollback_success' | 'rollback_failed';
  buildStartedAt?: Date;
  buildCompletedAt?: Date;
  deploymentStartedAt?: Date;
  deploymentCompletedAt?: Date;
  workerNodeId?: string;
  buildLogs?: string;
  deploymentLogs?: string;
  errorMessage?: string;
  dockerImageName?: string;
  containerId?: string;
  rollbackFromDeploymentId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppRequest {
  organizationId: string;
  planId: string;
  name: string;
  description?: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  dockerfilePath?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
  autoDeployments?: boolean;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
}

export interface UpdateAppRequest {
  name?: string;
  description?: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  dockerfilePath?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
  autoDeployments?: boolean;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
}

export class PaaSService {
  private static mapPlanRow(row: any): PaasPlan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cpuCores: parseFloat(row.cpu_cores),
      memoryMb: row.memory_mb,
      storageGb: row.storage_gb,
      bandwidthGb: row.bandwidth_gb,
      priceHourly: parseFloat(row.price_hourly),
      priceMonthly: parseFloat(row.price_monthly),
      maxDeployments: row.max_deployments,
      maxEnvironmentVars: row.max_environment_vars,
      supportsCustomDomains: row.supports_custom_domains,
      supportsAutoDeployments: row.supports_auto_deployments,
      active: row.active,
      displayOrder: row.display_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get all available PaaS plans
   */
  static async getAvailablePlans(): Promise<PaasPlan[]> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          description,
          cpu_cores,
          memory_mb,
          storage_gb,
          bandwidth_gb,
          price_hourly,
          price_monthly,
          max_deployments,
          max_environment_vars,
          supports_custom_domains,
          supports_auto_deployments,
          active,
          display_order,
          created_at,
          updated_at
        FROM paas_plans
        WHERE active = true
        ORDER BY display_order ASC, price_monthly ASC
      `);

      return result.rows.map(row => this.mapPlanRow(row));
    } catch (error) {
      console.error('Error getting PaaS plans:', error);
      throw new Error('Failed to fetch PaaS plans');
    }
  }

  /**
   * Get a specific PaaS plan by ID
   */
  static async getPlanById(planId: string): Promise<PaasPlan | null> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          description,
          cpu_cores,
          memory_mb,
          storage_gb,
          bandwidth_gb,
          price_hourly,
          price_monthly,
          max_deployments,
          max_environment_vars,
          supports_custom_domains,
          supports_auto_deployments,
          active,
          display_order,
          created_at,
          updated_at
        FROM paas_plans
        WHERE id = $1 AND active = true
      `, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapPlanRow(row);
    } catch (error) {
      console.error('Error getting PaaS plan:', error);
      throw new Error('Failed to fetch PaaS plan');
    }
  }

  /**
   * Get all PaaS plans, optionally including inactive ones
   */
  static async getAllPlans(includeInactive: boolean = true): Promise<PaasPlan[]> {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          description,
          cpu_cores,
          memory_mb,
          storage_gb,
          bandwidth_gb,
          price_hourly,
          price_monthly,
          max_deployments,
          max_environment_vars,
          supports_custom_domains,
          supports_auto_deployments,
          active,
          display_order,
          created_at,
          updated_at
        FROM paas_plans
        ${includeInactive ? '' : 'WHERE active = true'}
        ORDER BY display_order ASC, price_monthly ASC
      `);

      return result.rows.map(row => this.mapPlanRow(row));
    } catch (error) {
      console.error('Error getting PaaS plans:', error);
      throw new Error('Failed to fetch PaaS plans');
    }
  }

  /**
   * Create a new PaaS plan
   */
  static async createPlan(data: CreatePlanInput): Promise<PaasPlan> {
    try {
      // Validate inputs early to return a clear error rather than a DB failure
      const requiredString = (v: any, field: string) => {
        const s = typeof v === 'string' ? v.trim() : '';
        if (!s) throw new Error(`Invalid plan data: ${field} is required`);
        return s;
      };
      const numberMin = (v: any, min: number, field: string) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < min) {
          throw new Error(`Invalid plan data: ${field} must be ${min > 0 ? '>' : '>='} ${min}`);
        }
        return n;
      };

      const name = requiredString(data.name, 'name');
      const cpuCores = numberMin(data.cpuCores, 0.01, 'cpuCores');
      const memoryMb = numberMin(data.memoryMb, 1, 'memoryMb');
      const storageGb = numberMin(data.storageGb, 1, 'storageGb');
      const bandwidthGb = numberMin(data.bandwidthGb ?? 0, 0, 'bandwidthGb');
      const priceHourly = numberMin(data.priceHourly, 0, 'priceHourly');
      const priceMonthly = numberMin(data.priceMonthly, 0, 'priceMonthly');
      const maxDeployments = numberMin(data.maxDeployments ?? 1, 1, 'maxDeployments');
      const maxEnvironmentVars = numberMin(data.maxEnvironmentVars ?? 1, 1, 'maxEnvironmentVars');
      const supportsCustomDomains = Boolean(data.supportsCustomDomains);
      const supportsAutoDeployments = Boolean(data.supportsAutoDeployments);
      const active = Boolean(data.active);
      const displayOrder = Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 0;

      const result = await query(`
        INSERT INTO paas_plans (
          name,
          description,
          cpu_cores,
          memory_mb,
          storage_gb,
          bandwidth_gb,
          price_hourly,
          price_monthly,
          max_deployments,
          max_environment_vars,
          supports_custom_domains,
          supports_auto_deployments,
          active,
          display_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `, [
        name,
        data.description || null,
        cpuCores,
        memoryMb,
        storageGb,
        bandwidthGb,
        priceHourly,
        priceMonthly,
        maxDeployments,
        maxEnvironmentVars,
        supportsCustomDomains,
        supportsAutoDeployments,
        active,
        displayOrder
      ]);

      return this.mapPlanRow(result.rows[0]);
    } catch (error) {
      console.error('Error creating PaaS plan:', error);
      throw new Error('Failed to create PaaS plan');
    }
  }

  /**
   * Update an existing PaaS plan
   */
  static async updatePlan(planId: string, data: UpdatePlanInput): Promise<PaasPlan> {
    // Coercion helpers that skip invalid values during partial updates
    const toNumberMin = (min: number) => (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min ? n : undefined;
    };

    const fieldMapping: Record<string, { column: string; transform?: (value: any) => any }> = {
      name: { column: 'name' },
      description: { column: 'description' },
      cpuCores: { column: 'cpu_cores', transform: toNumberMin(0.01) },
      memoryMb: { column: 'memory_mb', transform: toNumberMin(1) },
      storageGb: { column: 'storage_gb', transform: toNumberMin(1) },
      bandwidthGb: { column: 'bandwidth_gb', transform: toNumberMin(0) },
      priceHourly: { column: 'price_hourly', transform: toNumberMin(0) },
      priceMonthly: { column: 'price_monthly', transform: toNumberMin(0) },
      maxDeployments: { column: 'max_deployments', transform: toNumberMin(1) },
      maxEnvironmentVars: { column: 'max_environment_vars', transform: toNumberMin(1) },
      supportsCustomDomains: { column: 'supports_custom_domains' },
      supportsAutoDeployments: { column: 'supports_auto_deployments' },
      active: { column: 'active' },
      displayOrder: { column: 'display_order', transform: toNumberMin(0) }
    };

    const updates: string[] = [];
    const values: any[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(data)) {
      if (!(key in fieldMapping)) continue;
      const transform = fieldMapping[key].transform;
      const transformed = transform ? transform(value) : value;
      if (transformed === undefined) continue; // skip invalid/empty values
      updates.push(`${fieldMapping[key].column} = $${index++}`);
      values.push(transformed);
    }

    if (updates.length === 0) {
      throw new Error('No valid plan fields provided for update');
    }

    try {
      const result = await query(`
        UPDATE paas_plans
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *
      `, [...values, planId]);

      if (result.rows.length === 0) {
        throw new Error('Plan not found');
      }

      return this.mapPlanRow(result.rows[0]);
    } catch (error) {
      console.error('Error updating PaaS plan:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update PaaS plan');
    }
  }

  /**
   * Delete a PaaS plan
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      const usageResult = await query(
        'SELECT COUNT(*) as count FROM paas_apps WHERE plan_id = $1',
        [planId]
      );

      const appCount = parseInt(usageResult.rows[0]?.count || '0', 10);
      if (appCount > 0) {
        throw new Error('Cannot delete plan while applications are still assigned to it');
      }

      try {
        const deleteResult = await query('DELETE FROM paas_plans WHERE id = $1', [planId]);
        if (deleteResult.rowCount === 0) {
          throw new Error('Plan not found');
        }
      } catch (err: any) {
        // Handle FK violations or bad UUIDs explicitly for better UX
        if (err && typeof err === 'object') {
          const code = (err as any).code;
          if (code === '23503') {
            // foreign_key_violation
            throw new Error('Cannot delete plan because it is referenced by other records');
          }
          if (code === '22P02') {
            // invalid_text_representation (e.g., bad UUID)
            throw new Error('Invalid plan id format');
          }
        }
        throw err;
      }
    } catch (error) {
      console.error('Error deleting PaaS plan:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete PaaS plan');
    }
  }

  /**
   * Create a new PaaS application
   */
  static async createApp(data: CreateAppRequest, createdBy: string): Promise<PaasApp> {
    try {
      return await transaction(async (client) => {
        // Validate plan exists and is active
        const planResult = await client.query(
          'SELECT id, name FROM paas_plans WHERE id = $1 AND active = true',
          [data.planId]
        );

        if (planResult.rows.length === 0) {
          throw new Error('Invalid or inactive plan');
        }

        // Check organization app limits
        const appCountResult = await client.query(
          'SELECT COUNT(*) as count FROM paas_apps WHERE organization_id = $1',
          [data.organizationId]
        );

        const currentAppCount = parseInt(appCountResult.rows[0].count);
        const plan = planResult.rows[0];

        // Get plan limits from platform settings or use defaults
        const maxAppsPerOrg = 10; // Default limit

        if (currentAppCount >= maxAppsPerOrg) {
          throw new Error(`Organization has reached maximum app limit (${maxAppsPerOrg})`);
        }

        // Create the application
        const insertResult = await client.query(`
          INSERT INTO paas_apps (
            organization_id,
            plan_id,
            name,
            slug,
            description,
            github_repo_url,
            github_branch,
            dockerfile_path,
            build_command,
            start_command,
            environment_variables,
            auto_deployments,
            health_check_url,
            health_check_interval,
            status,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `, [
          data.organizationId,
          data.planId,
          data.name,
          '', // Slug will be auto-generated
          data.description || null,
          data.githubRepoUrl || null,
          data.githubBranch || 'main',
          data.dockerfilePath || 'Dockerfile',
          data.buildCommand || 'npm run build',
          data.startCommand || 'npm start',
          JSON.stringify(data.environmentVariables || {}),
          data.autoDeployments !== undefined ? data.autoDeployments : true,
          data.healthCheckUrl || null,
          data.healthCheckInterval || 60,
          'created',
          JSON.stringify({})
        ]);

        const appRow = insertResult.rows[0];

        // Log the activity
        await logActivity({
          userId: createdBy,
          organizationId: data.organizationId,
          eventType: 'paas.app.create',
          entityType: 'paas_app',
          entityId: appRow.id,
          message: `Created PaaS application: ${appRow.name}`,
          metadata: {
            appName: appRow.name,
            planId: data.planId,
            planName: plan.name
          }
        });

        return {
          id: appRow.id,
          organizationId: appRow.organization_id,
          planId: appRow.plan_id,
          name: appRow.name,
          slug: appRow.slug,
          description: appRow.description,
          githubRepoUrl: appRow.github_repo_url,
          githubBranch: appRow.github_branch,
          githubCommitSha: appRow.github_commit_sha,
          status: appRow.status,
          dockerfilePath: appRow.dockerfile_path,
          buildCommand: appRow.build_command,
          startCommand: appRow.start_command,
          environmentVariables: appRow.environment_variables || {},
          autoDeployments: appRow.auto_deployments,
          lastDeployedAt: appRow.last_deployed_at ? new Date(appRow.last_deployed_at) : undefined,
          lastBuiltAt: appRow.last_built_at ? new Date(appRow.last_built_at) : undefined,
          assignedWorkerId: appRow.assigned_worker_id,
          resourceUsage: appRow.resource_usage || { cpu: 0, memory: 0, storage: 0 },
          healthCheckUrl: appRow.health_check_url,
          healthCheckInterval: appRow.health_check_interval,
          customDomains: appRow.custom_domains || [],
          metadata: appRow.metadata || {},
          createdAt: new Date(appRow.created_at),
          updatedAt: new Date(appRow.updated_at)
        };
      });
    } catch (error) {
      console.error('Error creating PaaS app:', error);
      throw new Error(`Failed to create PaaS application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get applications for an organization
   */
  static async getOrganizationApps(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaasApp[]> {
    try {
      const result = await query(`
        SELECT
          a.id,
          a.organization_id,
          a.plan_id,
          a.name,
          a.slug,
          a.description,
          a.github_repo_url,
          a.github_branch,
          a.github_commit_sha,
          a.status,
          a.dockerfile_path,
          a.build_command,
          a.start_command,
          a.environment_variables,
          a.auto_deployments,
          a.last_deployed_at,
          a.last_built_at,
          a.assigned_worker_id,
          a.resource_usage,
          a.health_check_url,
          a.health_check_interval,
          a.custom_domains,
          a.metadata,
          a.created_at,
          a.updated_at,
          p.name as plan_name,
          p.price_hourly as plan_hourly_rate
        FROM paas_apps a
        LEFT JOIN paas_plans p ON a.plan_id = p.id
        WHERE a.organization_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        planId: row.plan_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        githubRepoUrl: row.github_repo_url,
        githubBranch: row.github_branch,
        githubCommitSha: row.github_commit_sha,
        status: row.status,
        dockerfilePath: row.dockerfile_path,
        buildCommand: row.build_command,
        startCommand: row.start_command,
        environmentVariables: row.environment_variables || {},
        autoDeployments: row.auto_deployments,
        lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at) : undefined,
        lastBuiltAt: row.last_built_at ? new Date(row.last_built_at) : undefined,
        assignedWorkerId: row.assigned_worker_id,
        resourceUsage: row.resource_usage || { cpu: 0, memory: 0, storage: 0 },
        healthCheckUrl: row.health_check_url,
        healthCheckInterval: row.health_check_interval,
        customDomains: row.custom_domains || [],
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting organization apps:', error);
      throw new Error('Failed to fetch applications');
    }
  }

  /**
   * Get a specific application by ID
   */
  static async getAppById(appId: string, organizationId?: string): Promise<PaasApp | null> {
    try {
      const queryStr = organizationId
        ? `
          SELECT
            a.*,
            p.name as plan_name,
            p.price_hourly as plan_hourly_rate
          FROM paas_apps a
          LEFT JOIN paas_plans p ON a.plan_id = p.id
          WHERE a.id = $1 AND a.organization_id = $2
        `
        : `
          SELECT
            a.*,
            p.name as plan_name,
            p.price_hourly as plan_hourly_rate
          FROM paas_apps a
          LEFT JOIN paas_plans p ON a.plan_id = p.id
          WHERE a.id = $1
        `;

      const params = organizationId ? [appId, organizationId] : [appId];
      const result = await query(queryStr, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        planId: row.plan_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        githubRepoUrl: row.github_repo_url,
        githubBranch: row.github_branch,
        githubCommitSha: row.github_commit_sha,
        status: row.status,
        dockerfilePath: row.dockerfile_path,
        buildCommand: row.build_command,
        startCommand: row.start_command,
        environmentVariables: row.environment_variables || {},
        autoDeployments: row.auto_deployments,
        lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at) : undefined,
        lastBuiltAt: row.last_built_at ? new Date(row.last_built_at) : undefined,
        assignedWorkerId: row.assigned_worker_id,
        resourceUsage: row.resource_usage || { cpu: 0, memory: 0, storage: 0 },
        healthCheckUrl: row.health_check_url,
        healthCheckInterval: row.health_check_interval,
        customDomains: row.custom_domains || [],
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting app by ID:', error);
      throw new Error('Failed to fetch application');
    }
  }

  /**
   * Update an existing application
   */
  static async updateApp(
    appId: string,
    organizationId: string,
    data: UpdateAppRequest,
    updatedBy: string
  ): Promise<PaasApp> {
    try {
      return await transaction(async (client) => {
        // Get current app for comparison
        const currentAppResult = await client.query(
          'SELECT * FROM paas_apps WHERE id = $1 AND organization_id = $2',
          [appId, organizationId]
        );

        if (currentAppResult.rows.length === 0) {
          throw new Error('Application not found');
        }

        const currentApp = currentAppResult.rows[0];

        // Build dynamic update query
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
          updateFields.push(`name = $${paramIndex++}, slug = ''`); // Slug will be regenerated
          updateValues.push(data.name);
        }
        if (data.description !== undefined) {
          updateFields.push(`description = $${paramIndex++}`);
          updateValues.push(data.description);
        }
        if (data.githubRepoUrl !== undefined) {
          updateFields.push(`github_repo_url = $${paramIndex++}`);
          updateValues.push(data.githubRepoUrl);
        }
        if (data.githubBranch !== undefined) {
          updateFields.push(`github_branch = $${paramIndex++}`);
          updateValues.push(data.githubBranch);
        }
        if (data.dockerfilePath !== undefined) {
          updateFields.push(`dockerfile_path = $${paramIndex++}`);
          updateValues.push(data.dockerfilePath);
        }
        if (data.buildCommand !== undefined) {
          updateFields.push(`build_command = $${paramIndex++}`);
          updateValues.push(data.buildCommand);
        }
        if (data.startCommand !== undefined) {
          updateFields.push(`start_command = $${paramIndex++}`);
          updateValues.push(data.startCommand);
        }
        if (data.environmentVariables !== undefined) {
          updateFields.push(`environment_variables = $${paramIndex++}`);
          updateValues.push(JSON.stringify(data.environmentVariables));
        }
        if (data.autoDeployments !== undefined) {
          updateFields.push(`auto_deployments = $${paramIndex++}`);
          updateValues.push(data.autoDeployments);
        }
        if (data.healthCheckUrl !== undefined) {
          updateFields.push(`health_check_url = $${paramIndex++}`);
          updateValues.push(data.healthCheckUrl);
        }
        if (data.healthCheckInterval !== undefined) {
          updateFields.push(`health_check_interval = $${paramIndex++}`);
          updateValues.push(data.healthCheckInterval);
        }

        if (updateFields.length === 0) {
          throw new Error('No fields to update');
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(appId, organizationId);

        const updateResult = await client.query(`
          UPDATE paas_apps
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
          RETURNING *
        `, updateValues);

        const updatedApp = updateResult.rows[0];

        // Log the activity
        await logActivity({
          userId: updatedBy,
          organizationId,
          eventType: 'paas.app.update',
          entityType: 'paas_app',
          entityId: appId,
          message: `Updated PaaS application: ${updatedApp.name}`,
          metadata: {
            appName: updatedApp.name,
            previousName: currentApp.name,
            changes: Object.keys(data)
          }
        });

        return {
          id: updatedApp.id,
          organizationId: updatedApp.organization_id,
          planId: updatedApp.plan_id,
          name: updatedApp.name,
          slug: updatedApp.slug,
          description: updatedApp.description,
          githubRepoUrl: updatedApp.github_repo_url,
          githubBranch: updatedApp.github_branch,
          githubCommitSha: updatedApp.github_commit_sha,
          status: updatedApp.status,
          dockerfilePath: updatedApp.dockerfile_path,
          buildCommand: updatedApp.build_command,
          startCommand: updatedApp.start_command,
          environmentVariables: updatedApp.environment_variables || {},
          autoDeployments: updatedApp.auto_deployments,
          lastDeployedAt: updatedApp.last_deployed_at ? new Date(updatedApp.last_deployed_at) : undefined,
          lastBuiltAt: updatedApp.last_built_at ? new Date(updatedApp.last_built_at) : undefined,
          assignedWorkerId: updatedApp.assigned_worker_id,
          resourceUsage: updatedApp.resource_usage || { cpu: 0, memory: 0, storage: 0 },
          healthCheckUrl: updatedApp.health_check_url,
          healthCheckInterval: updatedApp.health_check_interval,
          customDomains: updatedApp.custom_domains || [],
          metadata: updatedApp.metadata || {},
          createdAt: new Date(updatedApp.created_at),
          updatedAt: new Date(updatedApp.updated_at)
        };
      });
    } catch (error) {
      console.error('Error updating PaaS app:', error);
      throw new Error(`Failed to update PaaS application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an application
   */
  static async deleteApp(appId: string, organizationId: string, deletedBy: string): Promise<boolean> {
    try {
      return await transaction(async (client) => {
        // Get app details for logging
        const appResult = await client.query(
          'SELECT name FROM paas_apps WHERE id = $1 AND organization_id = $2',
          [appId, organizationId]
        );

        if (appResult.rows.length === 0) {
          throw new Error('Application not found');
        }

        const appName = appResult.rows[0].name;

        // Delete related records (cascading deletes should handle most of this)
        await client.query('DELETE FROM paas_deployments WHERE app_id = $1', [appId]);
        await client.query('DELETE FROM paas_environment_vars WHERE app_id = $1', [appId]);
        await client.query('DELETE FROM paas_domains WHERE app_id = $1', [appId]);

        // Delete the app
        await client.query('DELETE FROM paas_apps WHERE id = $1 AND organization_id = $2', [appId, organizationId]);

        // Log the activity
        await logActivity({
          userId: deletedBy,
          organizationId,
          eventType: 'paas.app.delete',
          entityType: 'paas_app',
          entityId: appId,
          message: `Deleted PaaS application: ${appName}`,
          metadata: {
            appName,
            appId
          }
        });

        return true;
      });
    } catch (error) {
      console.error('Error deleting PaaS app:', error);
      throw new Error(`Failed to delete PaaS application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get application statistics for an organization
   */
  static async getOrganizationStats(organizationId: string): Promise<{
    totalApps: number;
    deployedApps: number;
    buildingApps: number;
    errorApps: number;
    totalDeployments: number;
    monthlySpend: number;
    resourceUsage: {
      totalCpu: number;
      totalMemory: number;
      totalStorage: number;
    };
  }> {
    try {
      // Get app counts by status
      const statusResult = await query(`
        SELECT
          status,
          COUNT(*) as count
        FROM paas_apps
        WHERE organization_id = $1
        GROUP BY status
      `, [organizationId]);

      const statusCounts = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get total deployments
      const deploymentResult = await query(`
        SELECT COUNT(*) as count
        FROM paas_deployments d
        JOIN paas_apps a ON d.app_id = a.id
        WHERE a.organization_id = $1
      `, [organizationId]);

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
      `, [organizationId, startOfMonth]);

      // Get resource usage
      const resourceResult = await query(`
        SELECT
          COALESCE(SUM((resource_usage->>'cpu')::decimal), 0) as total_cpu,
          COALESCE(SUM((resource_usage->>'memory')::decimal), 0) as total_memory,
          COALESCE(SUM((resource_usage->>'storage')::decimal), 0) as total_storage
        FROM paas_apps
        WHERE organization_id = $1 AND status = 'deployed'
      `, [organizationId]);

      const resourceRow = resourceResult.rows[0];

      return {
        totalApps: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        deployedApps: statusCounts.deployed || 0,
        buildingApps: (statusCounts.building || 0) + (statusCounts.building_failed || 0),
        errorApps: (statusCounts.error || 0) + (statusCounts.deployment_failed || 0),
        totalDeployments: parseInt(deploymentResult.rows[0].count),
        monthlySpend: parseFloat(billingResult.rows[0].total),
        resourceUsage: {
          totalCpu: parseFloat(resourceRow.total_cpu),
          totalMemory: parseFloat(resourceRow.total_memory),
          totalStorage: parseFloat(resourceRow.total_storage)
        }
      };
    } catch (error) {
      console.error('Error getting organization stats:', error);
      throw new Error('Failed to fetch organization statistics');
    }
  }

  /**
   * Change application plan
   */
  static async changeAppPlan(
    appId: string,
    organizationId: string,
    newPlanId: string,
    changedBy: string
  ): Promise<PaasApp> {
    try {
      return await transaction(async (client) => {
        // Validate app exists
        const appResult = await client.query(
          'SELECT * FROM paas_apps WHERE id = $1 AND organization_id = $2',
          [appId, organizationId]
        );

        if (appResult.rows.length === 0) {
          throw new Error('Application not found');
        }

        // Validate new plan exists and is active
        const planResult = await client.query(
          'SELECT name FROM paas_plans WHERE id = $1 AND active = true',
          [newPlanId]
        );

        if (planResult.rows.length === 0) {
          throw new Error('Invalid or inactive plan');
        }

        // Update the app plan
        const updateResult = await client.query(`
          UPDATE paas_apps
          SET plan_id = $1, updated_at = NOW()
          WHERE id = $2 AND organization_id = $3
          RETURNING *
        `, [newPlanId, appId, organizationId]);

        const updatedApp = updateResult.rows[0];
        const planName = planResult.rows[0].name;

        // Log the activity
        await logActivity({
          userId: changedBy,
          organizationId,
          eventType: 'paas.app.plan_change',
          entityType: 'paas_app',
          entityId: appId,
          message: `Changed plan for application: ${updatedApp.name}`,
          metadata: {
            appName: updatedApp.name,
            newPlanId,
            newPlanName: planName
          }
        });

        return {
          id: updatedApp.id,
          organizationId: updatedApp.organization_id,
          planId: updatedApp.plan_id,
          name: updatedApp.name,
          slug: updatedApp.slug,
          description: updatedApp.description,
          githubRepoUrl: updatedApp.github_repo_url,
          githubBranch: updatedApp.github_branch,
          githubCommitSha: updatedApp.github_commit_sha,
          status: updatedApp.status,
          dockerfilePath: updatedApp.dockerfile_path,
          buildCommand: updatedApp.build_command,
          startCommand: updatedApp.start_command,
          environmentVariables: updatedApp.environment_variables || {},
          autoDeployments: updatedApp.auto_deployments,
          lastDeployedAt: updatedApp.last_deployed_at ? new Date(updatedApp.last_deployed_at) : undefined,
          lastBuiltAt: updatedApp.last_built_at ? new Date(updatedApp.last_built_at) : undefined,
          assignedWorkerId: updatedApp.assigned_worker_id,
          resourceUsage: updatedApp.resource_usage || { cpu: 0, memory: 0, storage: 0 },
          healthCheckUrl: updatedApp.health_check_url,
          healthCheckInterval: updatedApp.health_check_interval,
          customDomains: updatedApp.custom_domains || [],
          metadata: updatedApp.metadata || {},
          createdAt: new Date(updatedApp.created_at),
          updatedAt: new Date(updatedApp.updated_at)
        };
      });
    } catch (error) {
      console.error('Error changing app plan:', error);
      throw new Error(`Failed to change application plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get runtime statistics for a specific application
   */
  static async getAppStats(appId: string, organizationId: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    bandwidthUsage: number;
    uptime: number;
    requestCount: number;
    errorRate: number;
  } | null> {
    const clampPercentage = (value: any) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return 0;
      }
      return Math.min(100, Math.max(0, Number(numeric)));
    };

    try {
      const result = await query(`
        SELECT
          resource_usage,
          metadata,
          created_at,
          last_deployed_at
        FROM paas_apps
        WHERE id = $1 AND organization_id = $2
      `, [appId, organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const usage = row.resource_usage || {};
      const metadata = row.metadata || {};

      const uptimeSource =
        metadata.uptime ??
        metadata.uptime_percent ??
        metadata.uptimePercent;
      const uptimeBaseline = row.last_deployed_at || row.created_at;
      const elapsedMs = uptimeBaseline ? Date.now() - new Date(uptimeBaseline).getTime() : 0;
      // Approximate uptime percentage relative to a 24h window if no telemetry provided
      const derivedUptime = elapsedMs > 0 ? Math.min(100, Math.round((elapsedMs / (1000 * 60 * 60 * 24)) * 100)) : 0;

      return {
        cpuUsage: clampPercentage(usage.cpu ?? usage.cpu_usage ?? usage.cpuUsage ?? 0),
        memoryUsage: clampPercentage(usage.memory ?? usage.memory_usage ?? usage.memoryUsage ?? 0),
        diskUsage: clampPercentage(usage.storage ?? usage.disk_usage ?? usage.storageUsage ?? 0),
        bandwidthUsage: clampPercentage(usage.bandwidth ?? usage.bandwidth_usage ?? usage.bandwidthUsage ?? 0),
        uptime: clampPercentage(uptimeSource ?? derivedUptime),
        requestCount: Number(metadata.request_count ?? metadata.requestCount ?? 0) || 0,
        errorRate: clampPercentage(metadata.error_rate ?? metadata.errorRate ?? 0)
      };
    } catch (error) {
      console.error('Error getting application stats:', error);
      throw new Error('Failed to fetch application stats');
    }
  }
}
