import { query, transaction } from '../../lib/database.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { logActivity } from '../activityLogger.js';

export interface Secret {
  id: string;
  organizationId: string;
  name: string;
  encryptedValue: string;
  createdBy: string;
  lastRotatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretWithValue extends Omit<Secret, 'encryptedValue'> {
  value: string;
}

export interface CreateSecretParams {
  organizationId: string;
  name: string;
  value: string;
  createdBy: string;
}

export interface UpdateSecretParams {
  value: string;
  updatedBy: string;
  rotationStrategy?: 'automatic' | 'manual' | 'rolling';
}

export interface SecretUsage {
  serviceId: string;
  serviceName: string;
  mountPath: string | null;
  envVarName: string | null;
}

export class SecretService {
  /**
   * Create a new secret with encryption
   */
  async createSecret(params: CreateSecretParams): Promise<Secret> {
    const { organizationId, name, value, createdBy } = params;

    // Validate secret name (alphanumeric, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Secret name must contain only alphanumeric characters, underscores, and hyphens');
    }

    // Check if secret with same name already exists in organization
    const existing = await query(
      'SELECT id FROM container_secrets WHERE organization_id = $1 AND name = $2',
      [organizationId, name]
    );

    if (existing.rows.length > 0) {
      throw new Error(`Secret with name "${name}" already exists in this organization`);
    }

    // Encrypt the secret value
    const encryptedValue = encryptSecret(value);

    // Insert secret
    const result = await query(
      `INSERT INTO container_secrets (organization_id, name, encrypted_value, created_by, last_rotated_at)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id, organization_id, name, encrypted_value, created_by, last_rotated_at, created_at, updated_at`,
      [organizationId, name, encryptedValue, createdBy]
    );

    const secret = result.rows[0];

    // Log activity
    await logActivity({
      userId: createdBy,
      organizationId,
      eventType: 'secret_created',
      entityType: 'container_secret',
      entityId: secret.id,
      message: `Secret "${name}" created`,
      status: 'success',
      metadata: { secretName: name }
    });

    return {
      id: secret.id,
      organizationId: secret.organization_id,
      name: secret.name,
      encryptedValue: secret.encrypted_value,
      createdBy: secret.created_by,
      lastRotatedAt: secret.last_rotated_at,
      createdAt: secret.created_at,
      updatedAt: secret.updated_at
    };
  }

  /**
   * Update secret value (rotation)
   */
  async updateSecret(secretId: string, params: UpdateSecretParams): Promise<Secret> {
    const { value, updatedBy, rotationStrategy = 'manual' } = params;

    // Get current secret
    const currentResult = await query(
      'SELECT * FROM container_secrets WHERE id = $1',
      [secretId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Secret not found');
    }

    const currentSecret = currentResult.rows[0];

    // Encrypt new value
    const encryptedValue = encryptSecret(value);

    // Store old value in rotation history (retain for 30 days)
    await query(
      `INSERT INTO container_secret_history (secret_id, encrypted_value, rotated_by, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [secretId, currentSecret.encrypted_value, updatedBy]
    );

    // Update secret
    const result = await query(
      `UPDATE container_secrets
       SET encrypted_value = $1, last_rotated_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING id, organization_id, name, encrypted_value, created_by, last_rotated_at, created_at, updated_at`,
      [encryptedValue, secretId]
    );

    const updatedSecret = result.rows[0];

    // Log activity
    await logActivity({
      userId: updatedBy,
      organizationId: updatedSecret.organization_id,
      eventType: 'secret_rotated',
      entityType: 'container_secret',
      entityId: secretId,
      message: `Secret "${updatedSecret.name}" rotated with ${rotationStrategy} strategy`,
      status: 'success',
      metadata: {
        secretName: updatedSecret.name,
        rotationStrategy
      }
    });

    // Get affected services
    const affectedServices = await this.getSecretUsage(secretId);

    // Send notifications to service owners
    for (const usage of affectedServices) {
      // Get service owner
      const serviceResult = await query(
        `SELECT cs.organization_id, o.name as org_name
         FROM container_services cs
         JOIN organizations o ON cs.organization_id = o.id
         WHERE cs.id = $1`,
        [usage.serviceId]
      );

      if (serviceResult.rows.length > 0) {
        const service = serviceResult.rows[0];
        
        // Get organization users
        const usersResult = await query(
          `SELECT u.id FROM users u WHERE u.organization_id = $1`,
          [service.organization_id]
        );

        // Notify each user in the organization
        for (const user of usersResult.rows) {
          await logActivity({
            userId: user.id,
            organizationId: service.organization_id,
            eventType: 'secret_rotation_notification',
            entityType: 'container_secret',
            entityId: secretId,
            message: `Secret "${updatedSecret.name}" was rotated and is used by service "${usage.serviceName}". ${
              rotationStrategy === 'automatic' 
                ? 'Service will be automatically restarted.' 
                : rotationStrategy === 'rolling'
                ? 'Service will be restarted with zero-downtime rolling update.'
                : 'Please restart the service manually to apply the new secret value.'
            }`,
            status: 'info',
            metadata: {
              secretName: updatedSecret.name,
              serviceName: usage.serviceName,
              serviceId: usage.serviceId,
              rotationStrategy
            }
          });
        }
      }
    }

    return {
      id: updatedSecret.id,
      organizationId: updatedSecret.organization_id,
      name: updatedSecret.name,
      encryptedValue: updatedSecret.encrypted_value,
      createdBy: updatedSecret.created_by,
      lastRotatedAt: updatedSecret.last_rotated_at,
      createdAt: updatedSecret.created_at,
      updatedAt: updatedSecret.updated_at
    };
  }

  /**
   * Delete a secret (prevent if in use)
   */
  async deleteSecret(secretId: string, userId: string): Promise<void> {
    // Check if secret is in use
    const usageResult = await query(
      `SELECT COUNT(*) as count
       FROM container_service_secrets
       WHERE secret_id = $1`,
      [secretId]
    );

    const usageCount = parseInt(usageResult.rows[0].count);

    if (usageCount > 0) {
      throw new Error(`Cannot delete secret: it is currently in use by ${usageCount} service(s)`);
    }

    // Get secret details for logging
    const secretResult = await query(
      'SELECT organization_id, name FROM container_secrets WHERE id = $1',
      [secretId]
    );

    if (secretResult.rows.length === 0) {
      throw new Error('Secret not found');
    }

    const secret = secretResult.rows[0];

    // Delete secret
    await query('DELETE FROM container_secrets WHERE id = $1', [secretId]);

    // Log activity
    await logActivity({
      userId,
      organizationId: secret.organization_id,
      eventType: 'secret_deleted',
      entityType: 'container_secret',
      entityId: secretId,
      message: `Secret "${secret.name}" deleted`,
      status: 'success',
      metadata: { secretName: secret.name }
    });
  }

  /**
   * List secrets for an organization (without decrypted values)
   */
  async listSecrets(organizationId: string): Promise<Omit<Secret, 'encryptedValue'>[]> {
    const result = await query(
      `SELECT id, organization_id, name, created_by, last_rotated_at, created_at, updated_at
       FROM container_secrets
       WHERE organization_id = $1
       ORDER BY name ASC`,
      [organizationId]
    );

    return result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      createdBy: row.created_by,
      lastRotatedAt: row.last_rotated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Get a single secret by ID (without decrypted value)
   */
  async getSecret(secretId: string): Promise<Omit<Secret, 'encryptedValue'> | null> {
    const result = await query(
      `SELECT id, organization_id, name, created_by, last_rotated_at, created_at, updated_at
       FROM container_secrets
       WHERE id = $1`,
      [secretId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      createdBy: row.created_by,
      lastRotatedAt: row.last_rotated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get decrypted secret value (for internal use only, audit logged)
   */
  async getSecretValue(secretId: string, accessedBy: string): Promise<string> {
    const result = await query(
      'SELECT encrypted_value, organization_id, name FROM container_secrets WHERE id = $1',
      [secretId]
    );

    if (result.rows.length === 0) {
      throw new Error('Secret not found');
    }

    const secret = result.rows[0];

    // Decrypt value
    const decryptedValue = decryptSecret(secret.encrypted_value);

    // Audit log secret access
    await logActivity({
      userId: accessedBy,
      organizationId: secret.organization_id,
      eventType: 'secret_accessed',
      entityType: 'container_secret',
      entityId: secretId,
      message: `Secret "${secret.name}" accessed`,
      status: 'info',
      metadata: { secretName: secret.name },
      suppressNotification: true // Don't notify for every access
    });

    return decryptedValue;
  }

  /**
   * Get services using a secret
   */
  async getSecretUsage(secretId: string): Promise<SecretUsage[]> {
    const result = await query(
      `SELECT 
         cs.id as service_id,
         cs.name as service_name,
         css.mount_path,
         css.env_var_name
       FROM container_service_secrets css
       JOIN container_services cs ON css.service_id = cs.id
       WHERE css.secret_id = $1
       ORDER BY cs.name ASC`,
      [secretId]
    );

    return result.rows.map(row => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      mountPath: row.mount_path,
      envVarName: row.env_var_name
    }));
  }

  /**
   * Attach secret to a service
   */
  async attachSecretToService(
    secretId: string,
    serviceId: string,
    options: { mountPath?: string; envVarName?: string }
  ): Promise<void> {
    const { mountPath, envVarName } = options;

    // Validate that at least one injection method is specified
    if (!mountPath && !envVarName) {
      throw new Error('At least one injection method (mountPath or envVarName) must be specified');
    }

    // Check if secret exists and get organization
    const secretResult = await query(
      'SELECT organization_id FROM container_secrets WHERE id = $1',
      [secretId]
    );

    if (secretResult.rows.length === 0) {
      throw new Error('Secret not found');
    }

    // Check if service exists and belongs to same organization
    const serviceResult = await query(
      'SELECT organization_id FROM container_services WHERE id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found');
    }

    if (secretResult.rows[0].organization_id !== serviceResult.rows[0].organization_id) {
      throw new Error('Secret and service must belong to the same organization');
    }

    // Check if already attached
    const existingResult = await query(
      'SELECT * FROM container_service_secrets WHERE service_id = $1 AND secret_id = $2',
      [serviceId, secretId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing attachment
      await query(
        `UPDATE container_service_secrets
         SET mount_path = $1, env_var_name = $2
         WHERE service_id = $3 AND secret_id = $4`,
        [mountPath, envVarName, serviceId, secretId]
      );
    } else {
      // Create new attachment
      await query(
        `INSERT INTO container_service_secrets (service_id, secret_id, mount_path, env_var_name)
         VALUES ($1, $2, $3, $4)`,
        [serviceId, secretId, mountPath, envVarName]
      );
    }
  }

  /**
   * Detach secret from a service
   */
  async detachSecretFromService(secretId: string, serviceId: string): Promise<void> {
    await query(
      'DELETE FROM container_service_secrets WHERE service_id = $1 AND secret_id = $2',
      [serviceId, secretId]
    );
  }

  /**
   * Get all secrets for a service (with decrypted values for injection)
   */
  async getServiceSecrets(serviceId: string): Promise<Array<{
    id: string;
    name: string;
    value: string;
    mountPath: string | null;
    envVarName: string | null;
  }>> {
    const result = await query(
      `SELECT 
         cs.id,
         cs.name,
         cs.encrypted_value,
         css.mount_path,
         css.env_var_name
       FROM container_service_secrets css
       JOIN container_secrets cs ON css.secret_id = cs.id
       WHERE css.service_id = $1`,
      [serviceId]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      value: decryptSecret(row.encrypted_value),
      mountPath: row.mount_path,
      envVarName: row.env_var_name
    }));
  }

  /**
   * Rotate secret and apply to services based on strategy
   */
  async rotateSecretWithStrategy(
    secretId: string,
    newValue: string,
    updatedBy: string,
    strategy: 'automatic' | 'manual' | 'rolling'
  ): Promise<{ secret: Secret; affectedServices: string[] }> {
    // Update the secret
    const secret = await this.updateSecret(secretId, {
      value: newValue,
      updatedBy,
      rotationStrategy: strategy
    });

    // Get affected services
    const affectedServices = await this.getSecretUsage(secretId);
    const serviceIds = affectedServices.map(s => s.serviceId);

    // Apply rotation strategy
    if (strategy === 'automatic' || strategy === 'rolling') {
      // Import SwarmOrchestrator dynamically to avoid circular dependency
      const { swarmOrchestrator } = await import('./SwarmOrchestrator.js');

      for (const usage of affectedServices) {
        try {
          // Get service details
          const serviceResult = await query(
            `SELECT swarm_service_id FROM container_deployments 
             WHERE service_id = $1 AND status = 'running'
             ORDER BY deployed_at DESC LIMIT 1`,
            [usage.serviceId]
          );

          if (serviceResult.rows.length === 0) {
            console.warn(`No running deployment found for service ${usage.serviceId}`);
            continue;
          }

          const swarmServiceId = serviceResult.rows[0].swarm_service_id;

          if (!swarmServiceId) {
            console.warn(`No Swarm service ID for service ${usage.serviceId}`);
            continue;
          }

          // Get all secrets for this service
          const serviceSecrets = await this.getServiceSecrets(usage.serviceId);

          // Update service with new secrets
          await swarmOrchestrator.updateServiceSecrets(swarmServiceId, serviceSecrets);

          // Log successful rotation application
          await logActivity({
            userId: updatedBy,
            organizationId: secret.organizationId,
            eventType: 'secret_rotation_applied',
            entityType: 'container_service',
            entityId: usage.serviceId,
            message: `Secret rotation applied to service "${usage.serviceName}" using ${strategy} strategy`,
            status: 'success',
            metadata: {
              secretName: secret.name,
              serviceName: usage.serviceName,
              rotationStrategy: strategy
            }
          });
        } catch (error) {
          console.error(`Error applying secret rotation to service ${usage.serviceId}:`, error);
          
          // Log failure
          await logActivity({
            userId: updatedBy,
            organizationId: secret.organizationId,
            eventType: 'secret_rotation_failed',
            entityType: 'container_service',
            entityId: usage.serviceId,
            message: `Failed to apply secret rotation to service "${usage.serviceName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
            metadata: {
              secretName: secret.name,
              serviceName: usage.serviceName,
              rotationStrategy: strategy,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }
    }

    return {
      secret,
      affectedServices: serviceIds
    };
  }

  /**
   * Get secret rotation history
   */
  async getSecretRotationHistory(secretId: string): Promise<Array<{
    id: string;
    rotatedBy: string;
    rotatedAt: Date;
    expiresAt: Date;
  }>> {
    const result = await query(
      `SELECT id, rotated_by, created_at as rotated_at, expires_at
       FROM container_secret_history
       WHERE secret_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [secretId]
    );

    return result.rows.map(row => ({
      id: row.id,
      rotatedBy: row.rotated_by,
      rotatedAt: row.rotated_at,
      expiresAt: row.expires_at
    }));
  }

  /**
   * Rollback secret to a previous value
   */
  async rollbackSecret(
    secretId: string,
    historyId: string,
    rolledBackBy: string
  ): Promise<Secret> {
    // Get the historical value
    const historyResult = await query(
      'SELECT encrypted_value FROM container_secret_history WHERE id = $1 AND secret_id = $2',
      [historyId, secretId]
    );

    if (historyResult.rows.length === 0) {
      throw new Error('Secret history not found');
    }

    const historicalValue = decryptSecret(historyResult.rows[0].encrypted_value);

    // Rotate to the historical value
    const result = await this.rotateSecretWithStrategy(
      secretId,
      historicalValue,
      rolledBackBy,
      'manual' // Rollback requires manual restart for safety
    );

    // Log rollback
    await logActivity({
      userId: rolledBackBy,
      organizationId: result.secret.organizationId,
      eventType: 'secret_rolled_back',
      entityType: 'container_secret',
      entityId: secretId,
      message: `Secret "${result.secret.name}" rolled back to previous value`,
      status: 'success',
      metadata: {
        secretName: result.secret.name,
        historyId
      }
    });

    return result.secret;
  }
}

export const secretService = new SecretService();
