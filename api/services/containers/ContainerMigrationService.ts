/**
 * Container Migration Service
 * Handles automatic container migration on worker failure
 */

import { query, transaction } from '../../lib/database.js';
import { WorkerService } from './WorkerService.js';
import { v4 as uuidv4 } from 'uuid';

export type MigrationPolicy = 'automatic' | 'manual' | 'none';

export interface MigrationResult {
  success: boolean;
  migratedContainers: number;
  failedContainers: number;
  errors: string[];
}

export class ContainerMigrationService {
  /**
   * Handle worker failure and migrate containers
   */
  static async handleWorkerFailure(
    workerId: string,
    policy: MigrationPolicy = 'automatic'
  ): Promise<MigrationResult> {
    try {
      console.log(`🔄 Handling worker failure: ${workerId} (policy: ${policy})`);

      // Check migration policy
      if (policy === 'none') {
        console.log('Migration policy is "none" - skipping migration');
        return {
          success: true,
          migratedContainers: 0,
          failedContainers: 0,
          errors: []
        };
      }

      if (policy === 'manual') {
        console.log('Migration policy is "manual" - awaiting administrator approval');
        // Send notification to administrators
        await this.notifyAdministratorsForManualMigration(workerId);
        return {
          success: true,
          migratedContainers: 0,
          failedContainers: 0,
          errors: ['Manual migration required - awaiting administrator approval']
        };
      }

      // Automatic migration
      return await this.migrateContainersFromWorker(workerId);
    } catch (error) {
      console.error('Error handling worker failure:', error);
      return {
        success: false,
        migratedContainers: 0,
        failedContainers: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Migrate all containers from a failed worker
   */
  static async migrateContainersFromWorker(workerId: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedContainers: 0,
      failedContainers: 0,
      errors: []
    };

    try {
      // Get all running containers on the failed worker
      const containersResult = await query(
        `SELECT cd.id, cd.service_id, cd.image_tag, cs.organization_id, cs.name as service_name,
                cs.resource_limits, cs.environment_vars, cs.build_config
         FROM container_deployments cd
         JOIN container_services cs ON cd.service_id = cs.id
         WHERE cd.worker_id = $1 AND cd.status = 'running'`,
        [workerId]
      );

      const containers = containersResult.rows;

      if (containers.length === 0) {
        console.log(`No running containers found on worker ${workerId}`);
        return result;
      }

      console.log(`Found ${containers.length} containers to migrate from worker ${workerId}`);

      // Migrate each container
      for (const container of containers) {
        try {
          await this.migrateContainer(container, workerId);
          result.migratedContainers++;
          
          // Notify user of successful migration
          await this.notifyUserOfMigration(
            container.service_id,
            container.organization_id,
            'success',
            { serviceName: container.service_name }
          );
        } catch (error) {
          result.failedContainers++;
          result.success = false;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to migrate container ${container.id}: ${errorMsg}`);
          
          console.error(`Failed to migrate container ${container.id}:`, error);
          
          // Notify user of failed migration
          await this.notifyUserOfMigration(
            container.service_id,
            container.organization_id,
            'failed',
            { serviceName: container.service_name, error: errorMsg }
          );
        }
      }

      // Send summary notification to administrators
      await this.notifyAdministratorsOfMigrationSummary(workerId, result);

      console.log(
        `Migration complete: ${result.migratedContainers} succeeded, ` +
        `${result.failedContainers} failed`
      );

      return result;
    } catch (error) {
      console.error('Error migrating containers from worker:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Migrate a single container to a healthy worker
   */
  private static async migrateContainer(container: any, failedWorkerId: string): Promise<void> {
    try {
      // Parse resource limits
      const resourceLimits = typeof container.resource_limits === 'string'
        ? JSON.parse(container.resource_limits)
        : container.resource_limits;

      // Select target worker with available capacity
      const targetWorker = await this.selectTargetWorker(resourceLimits);

      if (!targetWorker) {
        throw new Error('No healthy worker with sufficient capacity available');
      }

      console.log(
        `Migrating container ${container.id} from worker ${failedWorkerId} ` +
        `to worker ${targetWorker.id}`
      );

      await transaction(async (client) => {
        // Mark old deployment as stopped
        await client.query(
          `UPDATE container_deployments 
           SET status = $1, stopped_at = $2, updated_at = $2,
               deployment_logs = $3
           WHERE id = $4`,
          [
            'stopped',
            new Date(),
            `Container migrated from failed worker ${failedWorkerId} to worker ${targetWorker.id}`,
            container.id
          ]
        );

        // Create new deployment on target worker
        const newDeploymentId = uuidv4();
        await client.query(
          `INSERT INTO container_deployments (
            id, service_id, worker_id, image_tag, status,
            deployment_logs, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newDeploymentId,
            container.service_id,
            targetWorker.id,
            container.image_tag,
            'deploying',
            `Migrated from failed worker ${failedWorkerId}`,
            new Date(),
            new Date()
          ]
        );

        // Update service to point to new deployment
        await client.query(
          `UPDATE container_services 
           SET current_deployment_id = $1, status = $2, updated_at = $3
           WHERE id = $4`,
          [newDeploymentId, 'deploying', new Date(), container.service_id]
        );

        console.log(
          `✅ Container ${container.id} migration initiated - ` +
          `New deployment: ${newDeploymentId} on worker ${targetWorker.id}`
        );
      });

      // Note: Actual Docker Swarm service update would be handled by SwarmOrchestrator
      // For now, we just update the database records
    } catch (error) {
      console.error('Error migrating container:', error);
      throw error;
    }
  }

  /**
   * Select target worker with available capacity
   */
  private static async selectTargetWorker(
    requiredResources: { cpuCores: number; memoryMb: number; diskGb: number }
  ): Promise<any | null> {
    try {
      // Get all active workers with sufficient capacity
      const result = await query(
        `SELECT id, name, capacity, current_load
         FROM container_workers
         WHERE status = 'active'
         AND (capacity->>'cpuCores')::numeric >= $1
         AND (capacity->>'memoryMb')::numeric >= $2
         AND (capacity->>'diskGb')::numeric >= $3
         ORDER BY 
           ((current_load->>'cpuPercent')::numeric + 
            (current_load->>'memoryPercent')::numeric + 
            (current_load->>'diskPercent')::numeric) / 3 ASC
         LIMIT 1`,
        [
          requiredResources.cpuCores,
          requiredResources.memoryMb,
          requiredResources.diskGb
        ]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const worker = result.rows[0];

      // Check if worker has enough available resources
      const capacity = typeof worker.capacity === 'string'
        ? JSON.parse(worker.capacity)
        : worker.capacity;
      
      const currentLoad = typeof worker.current_load === 'string'
        ? JSON.parse(worker.current_load)
        : worker.current_load;

      // Calculate available resources
      const availableCpu = capacity.cpuCores * (1 - currentLoad.cpuPercent / 100);
      const availableMemory = capacity.memoryMb * (1 - currentLoad.memoryPercent / 100);
      const availableDisk = capacity.diskGb * (1 - currentLoad.diskPercent / 100);

      if (
        availableCpu >= requiredResources.cpuCores &&
        availableMemory >= requiredResources.memoryMb &&
        availableDisk >= requiredResources.diskGb
      ) {
        return worker;
      }

      return null;
    } catch (error) {
      console.error('Error selecting target worker:', error);
      throw error;
    }
  }

  /**
   * Notify user of container migration
   */
  private static async notifyUserOfMigration(
    serviceId: string,
    organizationId: string,
    status: 'success' | 'failed',
    metadata: any
  ): Promise<void> {
    try {
      // Get organization owner and members
      const usersResult = await query(
        `SELECT DISTINCT u.id
         FROM users u
         JOIN organization_members om ON u.id = om.user_id
         WHERE om.organization_id = $1`,
        [organizationId]
      );

      const userIds = usersResult.rows.map(row => row.id);

      if (userIds.length === 0) {
        console.warn('No users found for organization to send migration notification');
        return;
      }

      // Prepare notification message
      const message = status === 'success'
        ? `Container service "${metadata.serviceName}" was automatically migrated to a healthy worker due to worker failure.`
        : `Failed to migrate container service "${metadata.serviceName}": ${metadata.error}`;

      const notificationType = status === 'success'
        ? 'container_migrated'
        : 'container_migration_failed';

      // Insert notifications for all users
      for (const userId of userIds) {
        await query(
          `INSERT INTO notifications (id, user_id, type, message, metadata, read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            userId,
            notificationType,
            message,
            JSON.stringify({ serviceId, ...metadata }),
            false,
            new Date()
          ]
        );
      }

      console.log(`📢 Migration notification sent to users: ${status} - ${metadata.serviceName}`);
    } catch (error) {
      console.error('Error sending migration notification:', error);
      // Don't throw - notification failure shouldn't break migration
    }
  }

  /**
   * Notify administrators for manual migration approval
   */
  private static async notifyAdministratorsForManualMigration(workerId: string): Promise<void> {
    try {
      const adminsResult = await query(
        "SELECT id FROM users WHERE role = 'admin'",
        []
      );

      const adminIds = adminsResult.rows.map(row => row.id);

      if (adminIds.length === 0) {
        console.warn('No admin users found to send manual migration notification');
        return;
      }

      // Get worker info
      const worker = await WorkerService.getWorkerStatus(workerId);
      const workerName = worker?.name || workerId;

      const message = `Worker ${workerName} has failed. Manual migration approval required for affected containers.`;

      // Insert notifications for all admins
      for (const adminId of adminIds) {
        await query(
          `INSERT INTO notifications (id, user_id, type, message, metadata, read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            adminId,
            'manual_migration_required',
            message,
            JSON.stringify({ workerId, workerName }),
            false,
            new Date()
          ]
        );
      }

      console.log(`📢 Manual migration notification sent to administrators for worker ${workerName}`);
    } catch (error) {
      console.error('Error sending manual migration notification:', error);
    }
  }

  /**
   * Notify administrators of migration summary
   */
  private static async notifyAdministratorsOfMigrationSummary(
    workerId: string,
    result: MigrationResult
  ): Promise<void> {
    try {
      const adminsResult = await query(
        "SELECT id FROM users WHERE role = 'admin'",
        []
      );

      const adminIds = adminsResult.rows.map(row => row.id);

      if (adminIds.length === 0) {
        console.warn('No admin users found to send migration summary');
        return;
      }

      // Get worker info
      const worker = await WorkerService.getWorkerStatus(workerId);
      const workerName = worker?.name || workerId;

      const message = `Container migration from worker ${workerName} completed: ` +
        `${result.migratedContainers} succeeded, ${result.failedContainers} failed.`;

      // Insert notifications for all admins
      for (const adminId of adminIds) {
        await query(
          `INSERT INTO notifications (id, user_id, type, message, metadata, read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            adminId,
            'migration_summary',
            message,
            JSON.stringify({ workerId, workerName, ...result }),
            false,
            new Date()
          ]
        );
      }

      console.log(`📢 Migration summary sent to administrators for worker ${workerName}`);
    } catch (error) {
      console.error('Error sending migration summary:', error);
    }
  }

  /**
   * Get migration policy for organization
   * For now, returns default policy. In full implementation, this would be configurable per organization.
   */
  static async getMigrationPolicy(organizationId: string): Promise<MigrationPolicy> {
    try {
      // Check if organization has custom migration policy
      const result = await query(
        `SELECT settings FROM organizations WHERE id = $1`,
        [organizationId]
      );

      if (result.rows.length === 0) {
        return 'automatic'; // Default policy
      }

      const settings = typeof result.rows[0].settings === 'string'
        ? JSON.parse(result.rows[0].settings)
        : result.rows[0].settings;

      return settings?.containerMigrationPolicy || 'automatic';
    } catch (error) {
      console.error('Error getting migration policy:', error);
      return 'automatic'; // Default to automatic on error
    }
  }
}
