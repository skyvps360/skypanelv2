/**
 * Webhook Service for SkyPanelV2 Container Platform
 * Handles Git repository webhooks for automatic deployments
 */

import { query, transaction } from '../../lib/database.js';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import { NixBuildService } from './NixBuildService.js';
import { logActivity } from '../activityLogger.js';
import { swarmOrchestrator } from './SwarmOrchestrator.js';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookPayload {
  provider: 'github' | 'gitlab' | 'bitbucket';
  serviceId: string;
  commitSha: string;
  branch: string;
  author: string;
  message: string;
  timestamp: Date;
  repository: string;
}

export interface GitHubWebhookPayload {
  ref: string;
  after: string;
  repository: {
    full_name: string;
    clone_url: string;
  };
  head_commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
  };
}

export interface GitLabWebhookPayload {
  ref: string;
  after: string;
  project: {
    path_with_namespace: string;
    http_url: string;
  };
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
  }>;
}

export interface BitbucketWebhookPayload {
  push: {
    changes: Array<{
      new: {
        name: string;
        target: {
          hash: string;
          message: string;
          author: {
            user: {
              display_name: string;
            };
          };
          date: string;
        };
      };
    }>;
  };
  repository: {
    full_name: string;
    links: {
      html: {
        href: string;
      };
    };
  };
}

export class WebhookService {
  /**
   * Generate unique webhook URL for a service
   */
  static generateWebhookUrl(serviceId: string, provider: 'github' | 'gitlab' | 'bitbucket'): string {
    const baseUrl = config.CLIENT_URL || process.env.CLIENT_URL || 'http://localhost:3001';
    return `${baseUrl}/api/containers/webhooks/${provider}/${serviceId}`;
  }

  /**
   * Generate webhook secret for a service
   */
  static async generateWebhookSecret(serviceId: string): Promise<string> {
    // Generate a random secret
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Store the secret in the service metadata
    await query(
      `UPDATE container_services 
       SET build_config = jsonb_set(
         COALESCE(build_config, '{}'::jsonb),
         '{webhookSecret}',
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(secret), serviceId]
    );

    return secret;
  }

  /**
   * Get webhook secret for a service
   */
  static async getWebhookSecret(serviceId: string): Promise<string | null> {
    const result = await query(
      `SELECT build_config->>'webhookSecret' as secret 
       FROM container_services 
       WHERE id = $1`,
      [serviceId]
    );

    if (result.rows.length === 0 || !result.rows[0].secret) {
      return null;
    }

    return result.rows[0].secret;
  }

  /**
   * Validate webhook signature for GitHub
   * GitHub uses HMAC SHA-256 with X-Hub-Signature-256 header
   */
  static validateGitHubSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // GitHub signature format: sha256=<hash>
      if (!signature.startsWith('sha256=')) {
        return false;
      }

      const hash = signature.substring(7);
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedHash)
      );
    } catch (error) {
      console.error('Error validating GitHub signature:', error);
      return false;
    }
  }

  /**
   * Validate webhook signature for GitLab
   * GitLab uses X-Gitlab-Token header with plain secret
   */
  static validateGitLabSignature(
    token: string,
    secret: string
  ): boolean {
    try {
      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(secret)
      );
    } catch (error) {
      console.error('Error validating GitLab signature:', error);
      return false;
    }
  }

  /**
   * Validate webhook signature for Bitbucket
   * Bitbucket uses HMAC SHA-256 with X-Hub-Signature header
   */
  static validateBitbucketSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Bitbucket signature format: sha256=<hash>
      if (!signature.startsWith('sha256=')) {
        return false;
      }

      const hash = signature.substring(7);
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedHash)
      );
    } catch (error) {
      console.error('Error validating Bitbucket signature:', error);
      return false;
    }
  }

  /**
   * Extract commit information from GitHub webhook payload
   */
  static extractGitHubCommitInfo(payload: GitHubWebhookPayload): WebhookPayload | null {
    try {
      // Extract branch name from ref (refs/heads/main -> main)
      const branch = payload.ref.replace('refs/heads/', '');

      // Validate we have required data
      if (!payload.head_commit || !payload.after) {
        console.warn('GitHub webhook missing commit data');
        return null;
      }

      return {
        provider: 'github',
        serviceId: '', // Will be set by caller
        commitSha: payload.after,
        branch,
        author: payload.head_commit.author.name,
        message: payload.head_commit.message,
        timestamp: new Date(payload.head_commit.timestamp),
        repository: payload.repository.full_name,
      };
    } catch (error) {
      console.error('Error extracting GitHub commit info:', error);
      return null;
    }
  }

  /**
   * Extract commit information from GitLab webhook payload
   */
  static extractGitLabCommitInfo(payload: GitLabWebhookPayload): WebhookPayload | null {
    try {
      // Extract branch name from ref (refs/heads/main -> main)
      const branch = payload.ref.replace('refs/heads/', '');

      // Get the latest commit
      const latestCommit = payload.commits && payload.commits.length > 0 
        ? payload.commits[payload.commits.length - 1]
        : null;

      if (!latestCommit || !payload.after) {
        console.warn('GitLab webhook missing commit data');
        return null;
      }

      return {
        provider: 'gitlab',
        serviceId: '', // Will be set by caller
        commitSha: payload.after,
        branch,
        author: latestCommit.author.name,
        message: latestCommit.message,
        timestamp: new Date(latestCommit.timestamp),
        repository: payload.project.path_with_namespace,
      };
    } catch (error) {
      console.error('Error extracting GitLab commit info:', error);
      return null;
    }
  }

  /**
   * Extract commit information from Bitbucket webhook payload
   */
  static extractBitbucketCommitInfo(payload: BitbucketWebhookPayload): WebhookPayload | null {
    try {
      // Get the latest change
      const latestChange = payload.push?.changes && payload.push.changes.length > 0
        ? payload.push.changes[payload.push.changes.length - 1]
        : null;

      if (!latestChange || !latestChange.new) {
        console.warn('Bitbucket webhook missing commit data');
        return null;
      }

      const branch = latestChange.new.name;
      const commit = latestChange.new.target;

      return {
        provider: 'bitbucket',
        serviceId: '', // Will be set by caller
        commitSha: commit.hash,
        branch,
        author: commit.author.user.display_name,
        message: commit.message,
        timestamp: new Date(commit.date),
        repository: payload.repository.full_name,
      };
    } catch (error) {
      console.error('Error extracting Bitbucket commit info:', error);
      return null;
    }
  }

  /**
   * Check if branch matches service configuration
   */
  static async checkBranchMatch(serviceId: string, branch: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT git_branch FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (result.rows.length === 0) {
        console.warn(`Service ${serviceId} not found`);
        return false;
      }

      const configuredBranch = result.rows[0].git_branch || 'main';
      const matches = configuredBranch === branch;

      if (!matches) {
        console.log(
          `Branch mismatch for service ${serviceId}: configured=${configuredBranch}, webhook=${branch}`
        );
      }

      return matches;
    } catch (error) {
      console.error('Error checking branch match:', error);
      return false;
    }
  }

  /**
   * Validate webhook signature based on provider
   */
  static async validateWebhookSignature(
    provider: 'github' | 'gitlab' | 'bitbucket',
    serviceId: string,
    payload: string,
    signature: string | undefined,
    token: string | undefined
  ): Promise<boolean> {
    try {
      // Get webhook secret for service
      const secret = await this.getWebhookSecret(serviceId);

      if (!secret) {
        console.warn(`No webhook secret found for service ${serviceId}`);
        return false;
      }

      // Validate based on provider
      switch (provider) {
        case 'github':
          if (!signature) {
            console.warn('GitHub webhook missing X-Hub-Signature-256 header');
            return false;
          }
          return this.validateGitHubSignature(payload, signature, secret);

        case 'gitlab':
          if (!token) {
            console.warn('GitLab webhook missing X-Gitlab-Token header');
            return false;
          }
          return this.validateGitLabSignature(token, secret);

        case 'bitbucket':
          if (!signature) {
            console.warn('Bitbucket webhook missing X-Hub-Signature header');
            return false;
          }
          return this.validateBitbucketSignature(payload, signature, secret);

        default:
          console.warn(`Unknown provider: ${provider}`);
          return false;
      }
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Extract commit information based on provider
   */
  static extractCommitInfo(
    provider: 'github' | 'gitlab' | 'bitbucket',
    payload: any
  ): WebhookPayload | null {
    switch (provider) {
      case 'github':
        return this.extractGitHubCommitInfo(payload);
      case 'gitlab':
        return this.extractGitLabCommitInfo(payload);
      case 'bitbucket':
        return this.extractBitbucketCommitInfo(payload);
      default:
        console.warn(`Unknown provider: ${provider}`);
        return null;
    }
  }

  /**
   * Process webhook and trigger build if branch matches
   * This method processes webhooks asynchronously and returns immediately
   */
  static async processWebhook(
    provider: 'github' | 'gitlab' | 'bitbucket',
    serviceId: string,
    webhookPayload: WebhookPayload
  ): Promise<{ success: boolean; message: string; buildId?: string }> {
    try {
      // Check if branch matches service configuration
      const branchMatches = await this.checkBranchMatch(serviceId, webhookPayload.branch);

      if (!branchMatches) {
        return {
          success: false,
          message: `Branch '${webhookPayload.branch}' does not match configured branch for this service`,
        };
      }

      // Get service details
      const serviceResult = await query(
        `SELECT id, organization_id, name, git_repository, git_branch, status 
         FROM container_services 
         WHERE id = $1`,
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        return {
          success: false,
          message: 'Service not found',
        };
      }

      const service = serviceResult.rows[0];

      // Check if service is in a state that allows building
      if (service.status === 'deleted') {
        return {
          success: false,
          message: 'Service is deleted',
        };
      }

      // Get user ID for the organization (for notifications)
      const userResult = await query(
        `SELECT user_id FROM organization_members 
         WHERE organization_id = $1 
         ORDER BY created_at ASC 
         LIMIT 1`,
        [service.organization_id]
      );

      const userId = userResult.rows.length > 0 ? userResult.rows[0].user_id : null;

      // Log webhook received activity
      if (userId) {
        await logActivity({
          userId,
          organizationId: service.organization_id,
          eventType: 'webhook_received',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Webhook received from ${provider}: ${webhookPayload.message.substring(0, 100)}`,
          status: 'info',
          metadata: {
            provider,
            commitSha: webhookPayload.commitSha,
            branch: webhookPayload.branch,
            author: webhookPayload.author,
            repository: webhookPayload.repository,
          },
        });
      }

      // Trigger build asynchronously (don't await)
      this.triggerBuildAsync(serviceId, webhookPayload, userId, service.organization_id)
        .catch(error => {
          console.error('Error in async build trigger:', error);
        });

      return {
        success: true,
        message: 'Build triggered successfully',
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Trigger build asynchronously
   * This runs in the background and doesn't block the webhook response
   */
  private static async triggerBuildAsync(
    serviceId: string,
    webhookPayload: WebhookPayload,
    userId: string | null,
    organizationId: string
  ): Promise<void> {
    try {
      // Update service status to building
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['building', new Date(), serviceId]
      );

      // Send notification about build start
      if (userId) {
        await logActivity({
          userId,
          organizationId,
          eventType: 'build_started',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Build started for commit ${webhookPayload.commitSha.substring(0, 7)} by ${webhookPayload.author}`,
          status: 'info',
          metadata: {
            commitSha: webhookPayload.commitSha,
            branch: webhookPayload.branch,
            author: webhookPayload.author,
            commitMessage: webhookPayload.message,
            triggeredBy: 'webhook',
            provider: webhookPayload.provider,
          },
        });
      }

      // Get service details for build
      const serviceResult = await query(
        'SELECT git_repository, git_branch FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        throw new Error('Service not found');
      }

      const service = serviceResult.rows[0];

      // Trigger build via NixBuildService
      const buildResult = await NixBuildService.buildFromGitRepository({
        serviceId,
        repoUrl: service.git_repository,
        branch: service.git_branch,
        commitSha: webhookPayload.commitSha,
      });

      // Send notification about build completion
      if (userId) {
        if (buildResult.status === 'success') {
          await logActivity({
            userId,
            organizationId,
            eventType: 'build_completed',
            entityType: 'container_service',
            entityId: serviceId,
            message: `Build completed successfully for commit ${webhookPayload.commitSha.substring(0, 7)}`,
            status: 'success',
            metadata: {
              buildId: buildResult.buildId,
              commitSha: webhookPayload.commitSha,
              imageTag: buildResult.imageTag,
              buildDurationSeconds: buildResult.buildDurationSeconds,
              artifactSizeMb: buildResult.artifactSizeMb,
            },
          });

          // Trigger automatic deployment on build success
          await this.deployBuildAsync(
            serviceId,
            buildResult.buildId,
            buildResult.imageTag!,
            webhookPayload,
            userId,
            organizationId
          );
        } else {
          await logActivity({
            userId,
            organizationId,
            eventType: 'build_failed',
            entityType: 'container_service',
            entityId: serviceId,
            message: `Build failed for commit ${webhookPayload.commitSha.substring(0, 7)}: ${buildResult.error}`,
            status: 'error',
            metadata: {
              buildId: buildResult.buildId,
              commitSha: webhookPayload.commitSha,
              error: buildResult.error,
            },
          });
        }
      }

      console.log(`✅ Build triggered for service ${serviceId}, build ID: ${buildResult.buildId}`);
    } catch (error) {
      console.error('Error triggering build:', error);

      // Send error notification
      if (userId) {
        await logActivity({
          userId,
          organizationId,
          eventType: 'build_failed',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Failed to trigger build: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'error',
          metadata: {
            commitSha: webhookPayload.commitSha,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }

      // Update service status to failed
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['failed', new Date(), serviceId]
      );
    }
  }

  /**
   * Deploy build automatically after successful build
   * Performs health check and automatic rollback if deployment fails
   */
  private static async deployBuildAsync(
    serviceId: string,
    buildId: string,
    imageTag: string,
    webhookPayload: WebhookPayload,
    userId: string | null,
    organizationId: string
  ): Promise<void> {
    let deploymentId: string | null = null;
    let previousDeploymentId: string | null = null;

    try {
      // Get service details
      const serviceResult = await query(
        `SELECT id, name, slug, organization_id, resource_limits, environment_vars, 
                current_deployment_id, git_repository
         FROM container_services 
         WHERE id = $1`,
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        throw new Error('Service not found');
      }

      const service = serviceResult.rows[0];
      previousDeploymentId = service.current_deployment_id;

      // Update service status to deploying
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['deploying', new Date(), serviceId]
      );

      // Send notification about deployment start
      if (userId) {
        await logActivity({
          userId,
          organizationId,
          eventType: 'deployment_started',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Deploying new version from commit ${webhookPayload.commitSha.substring(0, 7)}`,
          status: 'info',
          metadata: {
            buildId,
            imageTag,
            commitSha: webhookPayload.commitSha,
            previousDeploymentId,
          },
        });
      }

      // Create deployment record
      deploymentId = await this.createDeploymentRecord(
        serviceId,
        buildId,
        imageTag,
        service.git_repository
      );

      // Get Docker registry URL
      const dockerRegistry = process.env.DOCKER_REGISTRY_URL || 'localhost:5000';
      const imageName = `${dockerRegistry}/org-${organizationId}/${service.slug}`;

      // Parse resource limits and environment vars
      const resourceLimits = typeof service.resource_limits === 'string'
        ? JSON.parse(service.resource_limits)
        : service.resource_limits;

      const environmentVars = typeof service.environment_vars === 'string'
        ? JSON.parse(service.environment_vars)
        : service.environment_vars;

      // Preserve previous deployment for rollback
      if (previousDeploymentId) {
        const prevDeploymentResult = await query(
          'SELECT image_tag FROM container_deployments WHERE id = $1',
          [previousDeploymentId]
        );

        if (prevDeploymentResult.rows.length > 0) {
          const prevImageTag = prevDeploymentResult.rows[0].image_tag;
          await swarmOrchestrator.preserveImageForRollback(
            serviceId,
            previousDeploymentId,
            imageName,
            prevImageTag
          );
        }
      }

      // Deploy to Swarm
      const deployResult = await swarmOrchestrator.deployContainer({
        serviceId,
        deploymentId,
        imageName,
        imageTag,
        organizationId,
        slug: service.slug,
        resourceLimits,
        environmentVars,
        internalPort: 80, // Default port, should be configurable
        replicas: 1,
      });

      // Update deployment with Swarm service ID
      await query(
        `UPDATE container_deployments 
         SET swarm_service_id = $1, container_id = $2, updated_at = $3
         WHERE id = $4`,
        [deployResult.swarmServiceId, deployResult.containerId, new Date(), deploymentId]
      );

      // Perform health check before routing traffic
      console.log(`Performing health check for deployment ${deploymentId}...`);
      const isHealthy = await swarmOrchestrator.performHealthCheck(
        deployResult.swarmServiceId,
        60 // 60 second timeout
      );

      if (!isHealthy) {
        throw new Error('Health check failed - new deployment is not healthy');
      }

      // Health check passed - mark deployment as successful
      await transaction(async (client) => {
        // Update deployment status to running
        await client.query(
          `UPDATE container_deployments 
           SET status = $1, deployed_at = $2, updated_at = $2
           WHERE id = $3`,
          ['running', new Date(), deploymentId]
        );

        // Update service status and current deployment
        await client.query(
          `UPDATE container_services 
           SET status = $1, current_deployment_id = $2, updated_at = $3
           WHERE id = $4`,
          ['running', deploymentId, new Date(), serviceId]
        );

        // Mark previous deployment as stopped
        if (previousDeploymentId) {
          await client.query(
            `UPDATE container_deployments 
             SET status = $1, stopped_at = $2, updated_at = $2
             WHERE id = $3`,
            ['stopped', new Date(), previousDeploymentId]
          );
        }
      });

      // Send success notification
      if (userId) {
        await logActivity({
          userId,
          organizationId,
          eventType: 'deployment_completed',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Deployment successful for commit ${webhookPayload.commitSha.substring(0, 7)}`,
          status: 'success',
          metadata: {
            deploymentId,
            buildId,
            imageTag,
            commitSha: webhookPayload.commitSha,
            swarmServiceId: deployResult.swarmServiceId,
          },
        });
      }

      console.log(`✅ Deployment ${deploymentId} completed successfully`);
    } catch (error) {
      console.error('Error deploying build:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark deployment as failed
      if (deploymentId) {
        await query(
          `UPDATE container_deployments 
           SET status = $1, deployment_logs = $2, updated_at = $3
           WHERE id = $4`,
          ['failed', errorMessage, new Date(), deploymentId]
        );
      }

      // Attempt automatic rollback if there was a previous deployment
      if (previousDeploymentId) {
        try {
          console.log(`Attempting automatic rollback to deployment ${previousDeploymentId}...`);

          // Get previous deployment details
          const prevDeploymentResult = await query(
            `SELECT swarm_service_id, image_tag 
             FROM container_deployments 
             WHERE id = $1`,
            [previousDeploymentId]
          );

          if (prevDeploymentResult.rows.length > 0) {
            const prevDeployment = prevDeploymentResult.rows[0];

            // Rollback using Swarm
            if (prevDeployment.swarm_service_id) {
              await swarmOrchestrator.rollbackService(prevDeployment.swarm_service_id);

              // Update service to point back to previous deployment
              await transaction(async (client) => {
                await client.query(
                  `UPDATE container_services 
                   SET status = $1, current_deployment_id = $2, updated_at = $3
                   WHERE id = $4`,
                  ['running', previousDeploymentId, new Date(), serviceId]
                );

                await client.query(
                  `UPDATE container_deployments 
                   SET status = $1, updated_at = $2
                   WHERE id = $3`,
                  ['running', new Date(), previousDeploymentId]
                );
              });

              // Send rollback notification
              if (userId) {
                await logActivity({
                  userId,
                  organizationId,
                  eventType: 'deployment_rollback',
                  entityType: 'container_service',
                  entityId: serviceId,
                  message: `Automatic rollback completed after deployment failure: ${errorMessage}`,
                  status: 'warning',
                  metadata: {
                    failedDeploymentId: deploymentId,
                    rolledBackToDeploymentId: previousDeploymentId,
                    error: errorMessage,
                    commitSha: webhookPayload.commitSha,
                  },
                });
              }

              console.log(`✅ Automatic rollback to deployment ${previousDeploymentId} completed`);
              return;
            }
          }
        } catch (rollbackError) {
          console.error('Error during automatic rollback:', rollbackError);
          
          // Send rollback failure notification
          if (userId) {
            await logActivity({
              userId,
              organizationId,
              eventType: 'deployment_rollback_failed',
              entityType: 'container_service',
              entityId: serviceId,
              message: `Automatic rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`,
              status: 'error',
              metadata: {
                deploymentError: errorMessage,
                rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
              },
            });
          }
        }
      }

      // Update service status to failed
      await query(
        'UPDATE container_services SET status = $1, updated_at = $2 WHERE id = $3',
        ['failed', new Date(), serviceId]
      );

      // Send deployment failure notification
      if (userId) {
        await logActivity({
          userId,
          organizationId,
          eventType: 'deployment_failed',
          entityType: 'container_service',
          entityId: serviceId,
          message: `Deployment failed for commit ${webhookPayload.commitSha.substring(0, 7)}: ${errorMessage}`,
          status: 'error',
          metadata: {
            deploymentId,
            buildId,
            error: errorMessage,
            commitSha: webhookPayload.commitSha,
          },
        });
      }
    }
  }

  /**
   * Create deployment record in database
   */
  private static async createDeploymentRecord(
    serviceId: string,
    buildId: string,
    imageTag: string,
    gitRepository: string
  ): Promise<string> {
    const deploymentId = uuidv4();

    await query(
      `INSERT INTO container_deployments (
        id, service_id, image_tag, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [deploymentId, serviceId, imageTag, 'pending', new Date(), new Date()]
    );

    // Link deployment to build
    await query(
      'UPDATE container_builds SET deployment_id = $1 WHERE id = $2',
      [deploymentId, buildId]
    );

    return deploymentId;
  }
}
