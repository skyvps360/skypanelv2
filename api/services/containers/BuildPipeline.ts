/**
 * Build Pipeline Service for SkyPanelV2
 * Orchestrates the complete build-to-deployment flow
 */

import { query, transaction } from '../../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BuildPipelineConfig {
  serviceId: string;
  organizationId: string;
  slug: string;
  nixResultPath: string;
  buildId: string;
  environmentVars?: Record<string, string>;
}

export interface DockerImageInfo {
  imageName: string;
  imageTag: string;
  fullImageName: string;
  sizeBytes: number;
  sizeMb: number;
  digest?: string;
}

export interface BuildPipelineResult {
  success: boolean;
  imageInfo?: DockerImageInfo;
  logs: string;
  buildDurationSeconds: number;
  error?: string;
}

export class BuildPipeline {
  private static readonly DOCKER_REGISTRY = process.env.DOCKER_REGISTRY_URL || 'localhost:5000';
  private static readonly REGISTRY_USERNAME = process.env.DOCKER_REGISTRY_USERNAME;
  private static readonly REGISTRY_PASSWORD = process.env.DOCKER_REGISTRY_PASSWORD;

  /**
   * Execute complete build pipeline: create Docker image and push to registry
   */
  static async executePipeline(config: BuildPipelineConfig): Promise<BuildPipelineResult> {
    const startTime = Date.now();
    let logs = '';

    try {
      logs += `[${new Date().toISOString()}] ========================================\n`;
      logs += `[${new Date().toISOString()}] Starting Build Pipeline\n`;
      logs += `[${new Date().toISOString()}] ========================================\n`;
      logs += `[${new Date().toISOString()}] Build ID: ${config.buildId}\n`;
      logs += `[${new Date().toISOString()}] Service ID: ${config.serviceId}\n`;
      logs += `[${new Date().toISOString()}] Organization ID: ${config.organizationId}\n`;
      logs += `[${new Date().toISOString()}] Slug: ${config.slug}\n\n`;

      // Step 1: Create Docker image from Nix build output
      logs += `[${new Date().toISOString()}] Step 1: Creating Docker image from Nix output\n`;
      const imageInfo = await this.createDockerImage(config, logs);
      logs = imageInfo.logs;

      // Step 2: Push image to registry
      if (!this.DOCKER_REGISTRY.includes('localhost')) {
        logs += `\n[${new Date().toISOString()}] Step 2: Pushing image to registry\n`;
        const pushResult = await this.pushImageToRegistry(imageInfo.imageInfo, logs);
        logs = pushResult.logs;
      } else {
        logs += `\n[${new Date().toISOString()}] Step 2: Skipping registry push (using local registry)\n`;
      }

      // Step 3: Track build artifacts
      logs += `\n[${new Date().toISOString()}] Step 3: Recording build artifacts\n`;
      await this.trackBuildArtifacts(config.buildId, imageInfo.imageInfo);
      logs += `[${new Date().toISOString()}] ✅ Build artifacts recorded\n`;

      const buildDuration = Math.floor((Date.now() - startTime) / 1000);

      logs += `\n[${new Date().toISOString()}] ========================================\n`;
      logs += `[${new Date().toISOString()}] Build Pipeline Completed Successfully\n`;
      logs += `[${new Date().toISOString()}] ========================================\n`;
      logs += `[${new Date().toISOString()}] Total duration: ${buildDuration}s\n`;
      logs += `[${new Date().toISOString()}] Image: ${imageInfo.imageInfo.fullImageName}\n`;
      logs += `[${new Date().toISOString()}] Size: ${imageInfo.imageInfo.sizeMb} MB\n`;

      return {
        success: true,
        imageInfo: imageInfo.imageInfo,
        logs,
        buildDurationSeconds: buildDuration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logs += `\n[${new Date().toISOString()}] ❌ Build pipeline failed: ${errorMessage}\n`;

      const buildDuration = Math.floor((Date.now() - startTime) / 1000);

      return {
        success: false,
        logs,
        buildDurationSeconds: buildDuration,
        error: errorMessage,
      };
    }
  }

  /**
   * Create Docker image from Nix build output
   */
  private static async createDockerImage(
    config: BuildPipelineConfig,
    currentLogs: string
  ): Promise<{ imageInfo: DockerImageInfo; logs: string }> {
    let logs = currentLogs;

    try {
      // Generate image name and tag
      const imageName = `${this.DOCKER_REGISTRY}/org-${config.organizationId}/${config.slug}`;
      const imageTag = `build-${config.buildId.substring(0, 8)}-${Date.now()}`;
      const fullImageName = `${imageName}:${imageTag}`;

      logs += `[${new Date().toISOString()}] Image name: ${fullImageName}\n`;

      // Determine Nix result type and create appropriate Dockerfile
      const dockerfileContent = await this.generateDockerfile(config.nixResultPath, logs);
      logs = dockerfileContent.logs;

      const buildDir = path.dirname(config.nixResultPath);
      const dockerfilePath = path.join(buildDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent.dockerfile);
      logs += `[${new Date().toISOString()}] Dockerfile created\n`;

      // Build Docker image
      logs += `[${new Date().toISOString()}] Building Docker image...\n`;
      const buildStartTime = Date.now();

      const { stdout: buildOutput, stderr: buildError } = await execAsync(
        `docker build -t ${fullImageName} -f ${dockerfilePath} ${buildDir}`,
        {
          timeout: 600000, // 10 minutes
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      logs += buildOutput || '';
      if (buildError) logs += buildError;

      const buildTime = Math.floor((Date.now() - buildStartTime) / 1000);
      logs += `[${new Date().toISOString()}] ✅ Docker image built in ${buildTime}s\n`;

      // Get image size and digest
      const { stdout: inspectOutput } = await execAsync(
        `docker image inspect ${fullImageName} --format='{{.Size}}|{{.Id}}'`
      );

      const [sizeStr, digest] = inspectOutput.trim().split('|');
      const sizeBytes = parseInt(sizeStr);
      const sizeMb = Math.round((sizeBytes / 1024 / 1024) * 100) / 100;

      logs += `[${new Date().toISOString()}] Image size: ${sizeMb} MB (${sizeBytes} bytes)\n`;
      logs += `[${new Date().toISOString()}] Image digest: ${digest}\n`;

      return {
        imageInfo: {
          imageName,
          imageTag,
          fullImageName,
          sizeBytes,
          sizeMb,
          digest,
        },
        logs,
      };
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to create Docker image\n`;
      logs += error instanceof Error ? error.message : String(error);
      throw new Error(`Docker image creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Dockerfile based on Nix build output
   */
  private static async generateDockerfile(
    nixResultPath: string,
    currentLogs: string
  ): Promise<{ dockerfile: string; logs: string }> {
    let logs = currentLogs;

    try {
      // Check if result is a directory or file
      const stats = await fs.lstat(nixResultPath);
      const isSymlink = stats.isSymbolicLink();

      if (isSymlink) {
        const realPath = await fs.realpath(nixResultPath);
        const realStats = await fs.stat(realPath);

        if (realStats.isDirectory()) {
          logs += `[${new Date().toISOString()}] Nix result is a directory (typical for applications)\n`;

          // Check for common executable locations
          const binPath = path.join(realPath, 'bin');
          const hasBin = await fs.access(binPath).then(() => true).catch(() => false);

          if (hasBin) {
            logs += `[${new Date().toISOString()}] Found bin directory, creating executable-based Dockerfile\n`;

            // Create Dockerfile for executable application
            const dockerfile = `
FROM nixos/nix:latest

# Copy Nix build result
COPY result /app

# Set working directory
WORKDIR /app

# Add bin to PATH
ENV PATH="/app/bin:$PATH"

# Expose common ports (can be overridden)
EXPOSE 8080

# Default command (will be overridden by service configuration)
CMD ["/bin/sh", "-c", "if [ -f /app/bin/app ]; then /app/bin/app; elif [ -f /app/bin/server ]; then /app/bin/server; else echo 'No executable found'; exit 1; fi"]
`;
            return { dockerfile, logs };
          } else {
            logs += `[${new Date().toISOString()}] No bin directory, creating generic Dockerfile\n`;

            // Generic Dockerfile for directory result
            const dockerfile = `
FROM nixos/nix:latest

# Copy Nix build result
COPY result /app

# Set working directory
WORKDIR /app

# Expose common ports
EXPOSE 8080

# Default command
CMD ["/bin/sh"]
`;
            return { dockerfile, logs };
          }
        } else {
          logs += `[${new Date().toISOString()}] Nix result is a file (single executable)\n`;

          // Dockerfile for single executable
          const dockerfile = `
FROM nixos/nix:latest

# Copy Nix build result
COPY result /app/executable

# Make executable
RUN chmod +x /app/executable

# Set working directory
WORKDIR /app

# Expose common ports
EXPOSE 8080

# Run the executable
CMD ["/app/executable"]
`;
          return { dockerfile, logs };
        }
      } else {
        throw new Error('Nix result is not a symlink (unexpected)');
      }
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to generate Dockerfile\n`;
      logs += error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Push image to internal registry
   */
  private static async pushImageToRegistry(
    imageInfo: DockerImageInfo,
    currentLogs: string
  ): Promise<{ success: boolean; logs: string }> {
    let logs = currentLogs;

    try {
      // Login to registry if credentials provided
      if (this.REGISTRY_USERNAME && this.REGISTRY_PASSWORD) {
        logs += `[${new Date().toISOString()}] Logging in to registry...\n`;
        await execAsync(
          `echo "${this.REGISTRY_PASSWORD}" | docker login ${this.DOCKER_REGISTRY} -u ${this.REGISTRY_USERNAME} --password-stdin`,
          { timeout: 30000 }
        );
        logs += `[${new Date().toISOString()}] ✅ Registry login successful\n`;
      }

      // Push image
      logs += `[${new Date().toISOString()}] Pushing image to registry: ${imageInfo.fullImageName}\n`;
      const pushStartTime = Date.now();

      const { stdout: pushOutput, stderr: pushError } = await execAsync(
        `docker push ${imageInfo.fullImageName}`,
        {
          timeout: 600000, // 10 minutes
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      logs += pushOutput || '';
      if (pushError) logs += pushError;

      const pushTime = Math.floor((Date.now() - pushStartTime) / 1000);
      logs += `[${new Date().toISOString()}] ✅ Image pushed to registry in ${pushTime}s\n`;

      return { success: true, logs };
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to push image to registry\n`;
      logs += error instanceof Error ? error.message : String(error);
      throw new Error(`Registry push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track build duration and artifact size
   */
  private static async trackBuildArtifacts(
    buildId: string,
    imageInfo: DockerImageInfo
  ): Promise<void> {
    try {
      await query(
        `UPDATE container_builds 
         SET image_tag = $1, artifact_size_mb = $2
         WHERE id = $3`,
        [imageInfo.imageTag, imageInfo.sizeMb, buildId]
      );
    } catch (error) {
      console.error('Error tracking build artifacts:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Store build logs for debugging
   */
  static async storeBuildLogs(buildId: string, logs: string): Promise<void> {
    try {
      await query(
        `UPDATE container_builds 
         SET build_logs = $1
         WHERE id = $2`,
        [logs, buildId]
      );
    } catch (error) {
      console.error('Error storing build logs:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Handle build failures without disrupting running services
   */
  static async handleBuildFailure(
    serviceId: string,
    buildId: string,
    error: string,
    logs: string
  ): Promise<void> {
    try {
      await transaction(async (client) => {
        // Get current service state
        const serviceResult = await client.query(
          'SELECT status, current_deployment_id FROM container_services WHERE id = $1',
          [serviceId]
        );

        if (serviceResult.rows.length === 0) {
          throw new Error('Service not found');
        }

        const currentStatus = serviceResult.rows[0].status;
        const currentDeploymentId = serviceResult.rows[0].current_deployment_id;

        // If service has a running deployment, keep it running
        // Only mark service as failed if it has no running deployment
        if (!currentDeploymentId || currentStatus === 'pending') {
          await client.query(
            `UPDATE container_services 
             SET status = $1, updated_at = $2 
             WHERE id = $3`,
            ['failed', new Date(), serviceId]
          );
        } else {
          // Service has a running deployment, just log the build failure
          console.log(`Build failed for service ${serviceId}, but keeping current deployment running`);
        }

        // Update build record
        await client.query(
          `UPDATE container_builds 
           SET build_status = $1, build_logs = $2, completed_at = $3
           WHERE id = $4`,
          ['failed', logs, new Date(), buildId]
        );

        console.log(`❌ Build ${buildId} failed: ${error}`);
      });
    } catch (err) {
      console.error('Error handling build failure:', err);
      throw err;
    }
  }

  /**
   * Get build statistics for monitoring
   */
  static async getBuildStatistics(serviceId: string): Promise<{
    totalBuilds: number;
    successfulBuilds: number;
    failedBuilds: number;
    averageBuildTime: number;
    averageArtifactSize: number;
    successRate: number;
  }> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_builds,
          COUNT(*) FILTER (WHERE build_status = 'success') as successful_builds,
          COUNT(*) FILTER (WHERE build_status = 'failed') as failed_builds,
          AVG(build_duration_seconds) FILTER (WHERE build_status = 'success') as avg_build_time,
          AVG(artifact_size_mb) FILTER (WHERE build_status = 'success') as avg_artifact_size
         FROM container_builds
         WHERE service_id = $1`,
        [serviceId]
      );

      const row = result.rows[0];
      const totalBuilds = parseInt(row.total_builds) || 0;
      const successfulBuilds = parseInt(row.successful_builds) || 0;
      const failedBuilds = parseInt(row.failed_builds) || 0;
      const successRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;

      return {
        totalBuilds,
        successfulBuilds,
        failedBuilds,
        averageBuildTime: parseFloat(row.avg_build_time) || 0,
        averageArtifactSize: parseFloat(row.avg_artifact_size) || 0,
        successRate: Math.round(successRate * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting build statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old Docker images (keep last N per service)
   */
  static async cleanupOldImages(serviceId: string, keepCount: number = 10): Promise<number> {
    try {
      // Get service info
      const serviceResult = await query(
        'SELECT slug, organization_id FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        return 0;
      }

      const service = serviceResult.rows[0];
      const imageName = `${this.DOCKER_REGISTRY}/org-${service.organization_id}/${service.slug}`;

      // Get all image tags for this service
      const buildsResult = await query(
        `SELECT image_tag FROM container_builds 
         WHERE service_id = $1 AND build_status = 'success' AND image_tag IS NOT NULL
         ORDER BY created_at DESC
         OFFSET $2`,
        [serviceId, keepCount]
      );

      const tagsToDelete = buildsResult.rows.map(row => row.image_tag);

      if (tagsToDelete.length === 0) {
        return 0;
      }

      // Delete old images
      let deletedCount = 0;
      for (const tag of tagsToDelete) {
        try {
          await execAsync(`docker rmi ${imageName}:${tag}`, { timeout: 30000 });
          deletedCount++;
        } catch (error) {
          // Image might not exist locally, that's okay
          console.log(`Could not delete image ${imageName}:${tag} (might not exist locally)`);
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} old images for service ${serviceId}`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old images:', error);
      return 0;
    }
  }
}
