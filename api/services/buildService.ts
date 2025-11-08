/**
 * Build Service for SkyPanelV2 PaaS
 * Handles application building, GitHub integration, and build orchestration
 */

import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';
import { WorkerNodeService } from './workerNodeService.js';
import crypto from 'crypto';

export interface BuildRequest {
  appId: string;
  organizationId: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  githubCommitSha?: string;
  dockerfilePath?: string;
  buildCommand?: string;
  environmentVariables?: Record<string, string>;
  triggeredBy?: string;
  isAutoDeployment?: boolean;
}

export interface BuildLog {
  id: string;
  deploymentId: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface BuildJob {
  id: string;
  deploymentId: string;
  appId: string;
  workerNodeId: string;
  status: 'queued' | 'assigned' | 'building' | 'completed' | 'failed';
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  buildConfig: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
}

export class BuildService {
  /**
   * Trigger a new build for an application
   */
  static async triggerBuild(data: BuildRequest): Promise<{ deploymentId: string; success: boolean }> {
    try {
      return await transaction(async (client) => {
        // Get application details
        const appResult = await client.query(`
          SELECT
            a.*,
            p.name as plan_name
          FROM paas_apps a
          LEFT JOIN paas_plans p ON a.plan_id = p.id
          WHERE a.id = $1 AND a.organization_id = $2
        `, [data.appId, data.organizationId]);

        if (appResult.rows.length === 0) {
          throw new Error('Application not found');
        }

        const app = appResult.rows[0];

        // Create deployment record
        const deploymentId = crypto.randomUUID();
        const version = this.generateVersion();

        const deploymentResult = await client.query(`
          INSERT INTO paas_deployments (
            id,
            app_id,
            version,
            github_commit_sha,
            github_branch,
            status,
            build_started_at,
            worker_node_id,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          deploymentId,
          data.appId,
          version,
          data.githubCommitSha || app.github_commit_sha,
          data.githubBranch || app.github_branch,
          'pending',
          new Date(),
          null, // Will be assigned when worker is found
          JSON.stringify({
            triggered_by: data.triggeredBy,
            is_auto_deployment: data.isAutoDeployment || false,
            build_config: {
              dockerfilePath: data.dockerfilePath || app.dockerfile_path,
              buildCommand: data.buildCommand || app.build_command,
              environmentVariables: {
                ...(app.environment_variables || {}),
                ...(data.environmentVariables || {})
              },
              repoUrl: data.githubRepoUrl || app.github_repo_url
            }
          })
        ]);

        const deployment = deploymentResult.rows[0];

        // Update app status
        await client.query(
          'UPDATE paas_apps SET status = $1, updated_at = NOW() WHERE id = $2',
          ['building', data.appId]
        );

        // Log the activity
        await logActivity({
          userId: data.triggeredBy || null,
          organizationId: data.organizationId,
          eventType: 'paas.build.trigger',
          entityType: 'paas_deployment',
          entityId: deploymentId,
          message: `Started build for application: ${app.name} (${version})`,
          metadata: {
            appName: app.name,
            version,
            deploymentId,
            isAutoDeployment: data.isAutoDeployment || false
          }
        });

        // Try to find an available worker node
        const workerNode = await WorkerNodeService.findAvailableWorkerNode({
          nodejs: true,
          docker: true
        });

        if (workerNode) {
          // Assign to worker node
          await this.assignBuildToWorker(deploymentId, workerNode.id, client);
          console.log(`🔨 Build ${version} assigned to worker node: ${workerNode.name}`);
        } else {
          // No available workers - keep in queued state
          console.log(`⏳ Build ${version} queued - no available worker nodes`);
        }

        return { deploymentId, success: true };
      });
    } catch (error) {
      console.error('Error triggering build:', error);
      throw new Error(`Failed to trigger build: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign a build to a worker node
   */
  private static async assignBuildToWorker(
    deploymentId: string,
    workerNodeId: string,
    client: any
  ): Promise<void> {
    try {
      // Update deployment
      await client.query(`
        UPDATE paas_deployments
        SET
          worker_node_id = $1,
          status = 'building',
          build_started_at = NOW()
        WHERE id = $2
      `, [workerNodeId, deploymentId]);

      // Increment worker build count
      await WorkerNodeService.incrementBuildCount(workerNodeId);

      // Add initial build log
      await this.addBuildLog(deploymentId, 'info', 'Build assigned to worker node', {
        workerNodeId,
        assignedAt: new Date().toISOString()
      }, client);
    } catch (error) {
      console.error('Error assigning build to worker:', error);
      throw error;
    }
  }

  /**
   * Get queued builds
   */
  static async getQueuedBuilds(): Promise<any[]> {
    try {
      const result = await query(`
        SELECT
          d.id,
          d.app_id,
          d.version,
          d.status,
          d.created_at,
          a.name as app_name,
          a.organization_id,
          a.github_repo_url,
          a.github_branch,
          a.dockerfile_path,
          a.build_command,
          a.environment_variables,
          d.metadata
        FROM paas_deployments d
        JOIN paas_apps a ON d.app_id = a.id
        WHERE d.status = 'pending'
        ORDER BY d.created_at ASC
      `);

      return result.rows.map(row => ({
        deploymentId: row.id,
        appId: row.app_id,
        version: row.version,
        status: row.status,
        createdAt: new Date(row.created_at),
        appName: row.name,
        organizationId: row.organization_id,
        githubRepoUrl: row.github_repo_url,
        githubBranch: row.github_branch,
        dockerfilePath: row.dockerfile_path,
        buildCommand: row.build_command,
        environmentVariables: row.environment_variables || {},
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Error getting queued builds:', error);
      return [];
    }
  }

  /**
   * Process queued builds (cron job)
   */
  static async processQueuedBuilds(): Promise<number> {
    try {
      const queuedBuilds = await this.getQueuedBuilds();
      let processedBuilds = 0;

      for (const build of queuedBuilds) {
        const workerNode = await WorkerNodeService.findAvailableWorkerNode({
          nodejs: true,
          docker: true
        });

        if (workerNode) {
          await transaction(async (client) => {
            await this.assignBuildToWorker(build.deploymentId, workerNode.id, client);
          });

          processedBuilds++;
          console.log(`🔨 Queued build ${build.version} assigned to worker: ${workerNode.name}`);
        } else {
          // No more available workers
          break;
        }
      }

      if (processedBuilds > 0) {
        console.log(`✅ Processed ${processedBuilds} queued builds`);
      }

      return processedBuilds;
    } catch (error) {
      console.error('Error processing queued builds:', error);
      return 0;
    }
  }

  /**
   * Update build status (called by worker nodes)
   */
  static async updateBuildStatus(
    deploymentId: string,
    status: 'building_success' | 'building_failed' | 'deploying' | 'deployed' | 'deployment_failed',
    logs?: string,
    errorMessage?: string,
    result?: Record<string, any>
  ): Promise<boolean> {
    try {
      return await transaction(async (client) => {
        // Get current deployment and worker node
        const currentResult = await client.query(`
          SELECT
            d.*,
            a.name as app_name,
            a.organization_id,
            d.worker_node_id
          FROM paas_deployments d
          JOIN paas_apps a ON d.app_id = a.id
          WHERE d.id = $1
        `, [deploymentId]);

        if (currentResult.rows.length === 0) {
          throw new Error('Deployment not found');
        }

        const deployment = currentResult.rows[0];
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // Set completion times based on status
        if (status === 'building_success' || status === 'building_failed') {
          updateFields.push(`build_completed_at = $${paramIndex++}`);
          updateValues.push(new Date());
        } else if (status === 'deployed' || status === 'deployment_failed') {
          updateFields.push(`deployment_completed_at = $${paramIndex++}`);
          updateValues.push(new Date());
        }

        if (logs) {
          updateFields.push(`build_logs = $${paramIndex++}`);
          updateValues.push(logs);
        }

        if (errorMessage) {
          updateFields.push(`error_message = $${paramIndex++}`);
          updateValues.push(errorMessage);
        }

        if (result) {
          updateFields.push(`metadata = metadata || $${paramIndex++}::jsonb`);
          updateValues.push(JSON.stringify({ build_result: result }));
        }

        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(status);

        updateValues.push(deploymentId);

        await client.query(`
          UPDATE paas_deployments
          SET ${updateFields.join(', ')}, updated_at = NOW()
          WHERE id = $${paramIndex}
        `, updateValues);

        // Update app status if build is complete
        if (status === 'building_success') {
          await client.query(
            'UPDATE paas_apps SET status = $1, updated_at = NOW() WHERE id = $2',
            ['deployed', deployment.app_id]
          );
        } else if (status === 'building_failed' || status === 'deployment_failed') {
          await client.query(
            'UPDATE paas_apps SET status = $1, updated_at = NOW() WHERE id = $2',
            [status === 'building_failed' ? 'building_failed' : 'deployment_failed', deployment.app_id]
          );
        }

        // Release worker node if build is complete (success or failure)
        if (deployment.worker_node_id &&
            ['building_success', 'building_failed', 'deployed', 'deployment_failed'].includes(status)) {
          await WorkerNodeService.decrementBuildCount(deployment.worker_node_id);
        }

        // Add final build log
        const logMessage = status.includes('success')
          ? `Build completed successfully`
          : `Build failed: ${errorMessage || 'Unknown error'}`;

        await this.addBuildLog(deploymentId, status.includes('success') ? 'info' : 'error', logMessage, {
          finalStatus: status,
          completedAt: new Date().toISOString()
        }, client);

        // Log the activity
        await logActivity({
          userId: null, // System action
          organizationId: deployment.organization_id,
          eventType: `paas.build.${status.includes('success') ? 'success' : 'failed'}`,
          entityType: 'paas_deployment',
          entityId: deploymentId,
          message: `Build ${status.includes('success') ? 'completed' : 'failed'} for application: ${deployment.app_name}`,
          metadata: {
            appName: deployment.app_name,
            deploymentId,
            status,
            version: deployment.version
          }
        });

        console.log(`📦 Build ${deployment.version} ${status.includes('success') ? 'completed' : 'failed'} for ${deployment.app_name}`);

        return true;
      });
    } catch (error) {
      console.error('Error updating build status:', error);
      return false;
    }
  }

  /**
   * Add a build log entry
   */
  static async addBuildLog(
    deploymentId: string,
    logLevel: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata: Record<string, any> = {},
    client?: any
  ): Promise<void> {
    try {
      const logQuery = `
        INSERT INTO paas_build_logs (deployment_id, log_level, message, timestamp, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `;

      const params = [deploymentId, logLevel, message, new Date(), JSON.stringify(metadata)];

      if (client) {
        await client.query(logQuery, params);
      } else {
        await query(logQuery, params);
      }
    } catch (error) {
      console.error('Error adding build log:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get build logs for a deployment
   */
  static async getBuildLogs(
    deploymentId: string,
    organizationId?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<BuildLog[]> {
    try {
      let queryStr = `
        SELECT
          id,
          deployment_id,
          log_level,
          message,
          timestamp,
          metadata
        FROM paas_build_logs
        WHERE deployment_id = $1
      `;

      const params: any[] = [deploymentId];

      if (organizationId) {
        queryStr += `
          AND EXISTS (
            SELECT 1 FROM paas_deployments d
            JOIN paas_apps a ON d.app_id = a.id
            WHERE d.id = $1 AND a.organization_id = $2
          )
        `;
        params.push(organizationId);
      }

      queryStr += `
        ORDER BY timestamp ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(queryStr, params);

      return result.rows.map(row => ({
        id: row.id,
        deploymentId: row.deployment_id,
        logLevel: row.log_level,
        message: row.message,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Error getting build logs:', error);
      throw new Error('Failed to fetch build logs');
    }
  }

  /**
   * Get deployment history for an application
   */
  static async getDeploymentHistory(
    appId: string,
    organizationId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      let queryStr = `
        SELECT
          d.id,
          d.version,
          d.github_commit_sha,
          d.github_commit_message,
          d.github_commit_author,
          d.status,
          d.build_started_at,
          d.build_completed_at,
          d.deployment_started_at,
          d.deployment_completed_at,
          d.worker_node_id,
          d.error_message,
          d.docker_image_name,
          d.container_id,
          d.created_at,
          d.updated_at,
          w.name as worker_name,
          d.metadata
        FROM paas_deployments d
        LEFT JOIN paas_worker_nodes w ON d.worker_node_id = w.id
        WHERE d.app_id = $1
      `;

      const params: any[] = [appId];

      if (organizationId) {
        queryStr += `
          AND EXISTS (
            SELECT 1 FROM paas_apps a
            WHERE a.id = $1 AND a.organization_id = $2
          )
        `;
        params.push(organizationId);
      }

      queryStr += `
        ORDER BY d.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(queryStr, params);

      return result.rows.map(row => ({
        id: row.id,
        version: row.version,
        githubCommitSha: row.github_commit_sha,
        githubCommitMessage: row.github_commit_message,
        githubCommitAuthor: row.github_commit_author,
        status: row.status,
        buildStartedAt: row.build_started_at ? new Date(row.build_started_at) : undefined,
        buildCompletedAt: row.build_completed_at ? new Date(row.build_completed_at) : undefined,
        deploymentStartedAt: row.deployment_started_at ? new Date(row.deployment_started_at) : undefined,
        deploymentCompletedAt: row.deployment_completed_at ? new Date(row.deployment_completed_at) : undefined,
        workerNodeId: row.worker_node_id,
        workerName: row.worker_name,
        errorMessage: row.error_message,
        dockerImageName: row.docker_image_name,
        containerId: row.container_id,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting deployment history:', error);
      throw new Error('Failed to fetch deployment history');
    }
  }

  /**
   * Get a specific deployment
   */
  static async getDeployment(deploymentId: string, organizationId?: string): Promise<any | null> {
    try {
      let queryStr = `
        SELECT
          d.*,
          a.name as app_name,
          a.organization_id,
          w.name as worker_name,
          w.hostname as worker_hostname
        FROM paas_deployments d
        JOIN paas_apps a ON d.app_id = a.id
        LEFT JOIN paas_worker_nodes w ON d.worker_node_id = w.id
        WHERE d.id = $1
      `;

      const params = [deploymentId];

      if (organizationId) {
        queryStr += ` AND a.organization_id = $2`;
        params.push(organizationId);
      }

      const result = await query(queryStr, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        appId: row.app_id,
        version: row.version,
        githubCommitSha: row.github_commit_sha,
        githubCommitMessage: row.github_commit_message,
        githubCommitAuthor: row.github_commit_author,
        status: row.status,
        buildStartedAt: row.build_started_at ? new Date(row.build_started_at) : undefined,
        buildCompletedAt: row.build_completed_at ? new Date(row.build_completed_at) : undefined,
        deploymentStartedAt: row.deployment_started_at ? new Date(row.deployment_started_at) : undefined,
        deploymentCompletedAt: row.deployment_completed_at ? new Date(row.deployment_completed_at) : undefined,
        workerNodeId: row.worker_node_id,
        workerName: row.worker_name,
        workerHostname: row.worker_hostname,
        buildLogs: row.build_logs,
        deploymentLogs: row.deployment_logs,
        errorMessage: row.error_message,
        dockerImageName: row.docker_image_name,
        containerId: row.container_id,
        rollbackFromDeploymentId: row.rollback_from_deployment_id,
        metadata: row.metadata || {},
        appName: row.app_name,
        organizationId: row.organization_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting deployment:', error);
      throw new Error('Failed to fetch deployment');
    }
  }

  /**
   * Rollback to a previous deployment
   */
  static async rollbackDeployment(
    deploymentId: string,
    organizationId: string,
    triggeredBy: string
  ): Promise<{ newDeploymentId: string; success: boolean }> {
    try {
      return await transaction(async (client) => {
        // Get the deployment to rollback from
        const targetDeploymentResult = await client.query(`
          SELECT
            d.*,
            a.name as app_name
          FROM paas_deployments d
          JOIN paas_apps a ON d.app_id = a.id
          WHERE d.id = $1 AND a.organization_id = $2 AND d.status = 'deployed'
        `, [deploymentId, organizationId]);

        if (targetDeploymentResult.rows.length === 0) {
          throw new Error('Target deployment not found or not successfully deployed');
        }

        const targetDeployment = targetDeploymentResult.rows[0];

        // Create rollback deployment
        const rollbackDeploymentId = crypto.randomUUID();
        const rollbackVersion = this.generateVersion();

        await client.query(`
          INSERT INTO paas_deployments (
            id,
            app_id,
            version,
            github_commit_sha,
            github_commit_message,
            github_commit_author,
            status,
            rollback_from_deployment_id,
            deployment_started_at,
            worker_node_id,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          rollbackDeploymentId,
          targetDeployment.app_id,
          rollbackVersion,
          targetDeployment.github_commit_sha,
          targetDeployment.github_commit_message,
          targetDeployment.github_commit_author,
          'rollback',
          deploymentId,
          new Date(),
          targetDeployment.worker_node_id,
          JSON.stringify({
            triggered_by: triggeredBy,
            is_rollback: true,
            rollback_from_deployment: deploymentId
          })
        ]);

        // Update app status
        await client.query(
          'UPDATE paas_apps SET status = $1, updated_at = NOW() WHERE id = $2',
          ['rollback', targetDeployment.app_id]
        );

        // Log the activity
        await logActivity({
          userId: triggeredBy,
          organizationId,
          eventType: 'paas.deployment.rollback',
          entityType: 'paas_deployment',
          entityId: rollbackDeploymentId,
          message: `Initiated rollback for application: ${targetDeployment.app_name}`,
          metadata: {
            appName: targetDeployment.app_name,
            targetDeploymentId: deploymentId,
            targetVersion: targetDeployment.version,
            rollbackVersion: rollbackVersion
          }
        });

        console.log(`🔄 Rollback initiated for ${targetDeployment.app_name}: ${targetDeployment.version} -> ${rollbackVersion}`);

        return { newDeploymentId: rollbackDeploymentId, success: true };
      });
    } catch (error) {
      console.error('Error rolling back deployment:', error);
      throw new Error(`Failed to rollback deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a version string for deployments
   */
  private static generateVersion(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 12);
    const random = Math.random().toString(36).substring(2, 8);
    return `v${timestamp}-${random}`;
  }

  /**
   * Clean up old build logs (maintenance task)
   */
  static async cleanupOldBuildLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const result = await query(`
        DELETE FROM paas_build_logs
        WHERE timestamp < $1
        RETURNING id
      `, [cutoffDate]);

      const deletedCount = result.rows.length;

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old build log entries (older than ${daysToKeep} days)`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old build logs:', error);
      return 0;
    }
  }
}