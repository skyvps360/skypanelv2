/**
 * Nix Build Service for SkyPanelV2
 * Handles Nix-based application builds and container image creation
 */

import { query, transaction } from '../../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface BuildFromNixExpressionParams {
  serviceId: string;
  nixExpression: string;
  environmentVars?: Record<string, string>;
  buildTimeout?: number; // in seconds, default 1800 (30 minutes)
}

export interface BuildFromGitRepositoryParams {
  serviceId: string;
  repoUrl: string;
  branch: string;
  commitSha?: string;
  sshKey?: string;
  accessToken?: string;
  buildTimeout?: number;
}

export interface BuildFromTemplateParams {
  serviceId: string;
  templateId: string;
  customizations?: {
    environmentVars?: Record<string, string>;
    nixExpression?: string;
  };
  buildTimeout?: number;
}

export interface BuildStatus {
  buildId: string;
  serviceId: string;
  status: 'pending' | 'building' | 'success' | 'failed' | 'cancelled';
  buildLogs?: string;
  imageTag?: string;
  gitCommitSha?: string;
  buildDurationSeconds?: number;
  artifactSizeMb?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface BuildArtifacts {
  imageTag: string;
  imageName: string;
  artifactSizeMb: number;
  buildOutputPath?: string;
}

export class NixBuildService {
  private static readonly DEFAULT_BUILD_TIMEOUT = 1800; // 30 minutes
  private static readonly MAX_BUILD_TIMEOUT = 3600; // 1 hour
  private static readonly BUILD_WORKSPACE_DIR = process.env.NIX_BUILD_WORKSPACE || '/tmp/skypanel-builds';
  private static readonly DOCKER_REGISTRY = process.env.DOCKER_REGISTRY_URL || 'localhost:5000';
  private static readonly NIX_CACHE_URL = process.env.NIX_CACHE_URL;

  /**
   * Build from Nix expression with dependency resolution
   */
  static async buildFromNixExpression(params: BuildFromNixExpressionParams): Promise<BuildStatus> {
    const buildId = uuidv4();
    const buildDir = path.join(this.BUILD_WORKSPACE_DIR, buildId);
    let buildLogs = '';

    try {
      // Create build record
      await this.createBuildRecord(buildId, params.serviceId, null);

      // Update build status to building
      await this.updateBuildStatus(buildId, 'building');

      buildLogs += `[${new Date().toISOString()}] Starting Nix build from expression\n`;
      buildLogs += `[${new Date().toISOString()}] Build ID: ${buildId}\n`;
      buildLogs += `[${new Date().toISOString()}] Service ID: ${params.serviceId}\n\n`;

      // Create build directory
      await fs.mkdir(buildDir, { recursive: true });
      buildLogs += `[${new Date().toISOString()}] Created build directory: ${buildDir}\n`;

      // Write Nix expression to file
      const nixFile = path.join(buildDir, 'default.nix');
      await fs.writeFile(nixFile, params.nixExpression);
      buildLogs += `[${new Date().toISOString()}] Wrote Nix expression to ${nixFile}\n\n`;

      // Validate Nix expression syntax
      buildLogs += `[${new Date().toISOString()}] Validating Nix expression...\n`;
      try {
        const { stdout: parseOutput, stderr: parseError } = await execAsync(
          `nix-instantiate --parse ${nixFile}`,
          { cwd: buildDir, timeout: 30000 }
        );
        buildLogs += parseOutput || '';
        if (parseError) buildLogs += parseError;
        buildLogs += `[${new Date().toISOString()}] ✅ Nix expression is valid\n\n`;
      } catch (error) {
        buildLogs += `[${new Date().toISOString()}] ❌ Nix expression validation failed\n`;
        buildLogs += error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid Nix expression: ${error instanceof Error ? error.message : 'Syntax error'}`);
      }

      // Build with Nix
      buildLogs += `[${new Date().toISOString()}] Building with Nix package manager...\n`;
      const buildStartTime = Date.now();

      const nixBuildCmd = this.NIX_CACHE_URL
        ? `nix-build ${nixFile} --option substituters "${this.NIX_CACHE_URL} https://cache.nixos.org" --option trusted-public-keys "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="`
        : `nix-build ${nixFile}`;

      const { stdout: buildOutput, stderr: buildError } = await execAsync(
        nixBuildCmd,
        {
          cwd: buildDir,
          timeout: (params.buildTimeout || this.DEFAULT_BUILD_TIMEOUT) * 1000,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for logs
        }
      );

      buildLogs += buildOutput || '';
      if (buildError) buildLogs += buildError;

      const buildDuration = Math.floor((Date.now() - buildStartTime) / 1000);
      buildLogs += `\n[${new Date().toISOString()}] ✅ Nix build completed in ${buildDuration}s\n\n`;

      // Get build output path (result symlink)
      const resultPath = path.join(buildDir, 'result');
      const resultExists = await fs.access(resultPath).then(() => true).catch(() => false);

      if (!resultExists) {
        throw new Error('Nix build did not produce result symlink');
      }

      buildLogs += `[${new Date().toISOString()}] Build output: ${resultPath}\n`;

      // Create Docker image from Nix build output
      const artifacts = await this.createDockerImage(buildId, params.serviceId, resultPath, buildLogs);
      buildLogs = artifacts.logs;

      // Update build record with success
      await this.completeBuildSuccess(buildId, artifacts.imageTag, buildDuration, artifacts.artifactSizeMb, buildLogs);

      return {
        buildId,
        serviceId: params.serviceId,
        status: 'success',
        buildLogs,
        imageTag: artifacts.imageTag,
        buildDurationSeconds: buildDuration,
        artifactSizeMb: artifacts.artifactSizeMb,
        completedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      buildLogs += `\n[${new Date().toISOString()}] ❌ Build failed: ${errorMessage}\n`;

      // Update build record with failure
      await this.completeBuildFailure(buildId, buildLogs);

      return {
        buildId,
        serviceId: params.serviceId,
        status: 'failed',
        buildLogs,
        error: errorMessage,
        completedAt: new Date(),
      };
    } finally {
      // Cleanup build directory
      try {
        await fs.rm(buildDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error cleaning up build directory:', cleanupError);
      }
    }
  }

  /**
   * Build from Git repository (clone, build, package)
   */
  static async buildFromGitRepository(params: BuildFromGitRepositoryParams): Promise<BuildStatus> {
    const buildId = uuidv4();
    const buildDir = path.join(this.BUILD_WORKSPACE_DIR, buildId);
    let buildLogs = '';

    try {
      // Create build record
      await this.createBuildRecord(buildId, params.serviceId, params.commitSha || null);

      // Update build status to building
      await this.updateBuildStatus(buildId, 'building');

      buildLogs += `[${new Date().toISOString()}] Starting build from Git repository\n`;
      buildLogs += `[${new Date().toISOString()}] Build ID: ${buildId}\n`;
      buildLogs += `[${new Date().toISOString()}] Repository: ${params.repoUrl}\n`;
      buildLogs += `[${new Date().toISOString()}] Branch: ${params.branch}\n\n`;

      // Create build directory
      await fs.mkdir(buildDir, { recursive: true });

      // Clone repository
      buildLogs += `[${new Date().toISOString()}] Cloning repository...\n`;
      const cloneResult = await this.cloneRepository(params.repoUrl, params.branch, buildDir, {
        sshKey: params.sshKey,
        accessToken: params.accessToken,
        shallow: true,
      });
      buildLogs += cloneResult.logs;

      // Get actual commit SHA
      const commitSha = params.commitSha || cloneResult.commitSha;
      buildLogs += `[${new Date().toISOString()}] Commit SHA: ${commitSha}\n\n`;

      // Update build record with commit SHA
      await query(
        'UPDATE container_builds SET git_commit_sha = $1 WHERE id = $2',
        [commitSha, buildId]
      );

      // Look for Nix expression files
      const nixFiles = await this.findNixFiles(buildDir);
      buildLogs += `[${new Date().toISOString()}] Found Nix files: ${nixFiles.join(', ')}\n`;

      if (nixFiles.length === 0) {
        throw new Error('No Nix expression files found in repository (looking for default.nix, shell.nix, or flake.nix)');
      }

      // Use default.nix or first found Nix file
      const nixFile = nixFiles.find(f => f.endsWith('default.nix')) || nixFiles[0];
      buildLogs += `[${new Date().toISOString()}] Using Nix file: ${nixFile}\n\n`;

      // Build with Nix
      buildLogs += `[${new Date().toISOString()}] Building with Nix package manager...\n`;
      const buildStartTime = Date.now();

      const nixBuildCmd = this.NIX_CACHE_URL
        ? `nix-build ${nixFile} --option substituters "${this.NIX_CACHE_URL} https://cache.nixos.org" --option trusted-public-keys "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="`
        : `nix-build ${nixFile}`;

      const { stdout: buildOutput, stderr: buildError } = await execAsync(
        nixBuildCmd,
        {
          cwd: buildDir,
          timeout: (params.buildTimeout || this.DEFAULT_BUILD_TIMEOUT) * 1000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      buildLogs += buildOutput || '';
      if (buildError) buildLogs += buildError;

      const buildDuration = Math.floor((Date.now() - buildStartTime) / 1000);
      buildLogs += `\n[${new Date().toISOString()}] ✅ Nix build completed in ${buildDuration}s\n\n`;

      // Get build output path
      const resultPath = path.join(buildDir, 'result');
      const resultExists = await fs.access(resultPath).then(() => true).catch(() => false);

      if (!resultExists) {
        throw new Error('Nix build did not produce result symlink');
      }

      // Create Docker image from Nix build output
      const artifacts = await this.createDockerImage(buildId, params.serviceId, resultPath, buildLogs);
      buildLogs = artifacts.logs;

      // Update build record with success
      await this.completeBuildSuccess(buildId, artifacts.imageTag, buildDuration, artifacts.artifactSizeMb, buildLogs);

      return {
        buildId,
        serviceId: params.serviceId,
        status: 'success',
        buildLogs,
        imageTag: artifacts.imageTag,
        gitCommitSha: commitSha,
        buildDurationSeconds: buildDuration,
        artifactSizeMb: artifacts.artifactSizeMb,
        completedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      buildLogs += `\n[${new Date().toISOString()}] ❌ Build failed: ${errorMessage}\n`;

      // Update build record with failure
      await this.completeBuildFailure(buildId, buildLogs);

      return {
        buildId,
        serviceId: params.serviceId,
        status: 'failed',
        buildLogs,
        error: errorMessage,
        completedAt: new Date(),
      };
    } finally {
      // Cleanup build directory
      try {
        await fs.rm(buildDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error cleaning up build directory:', cleanupError);
      }
    }
  }

  /**
   * Build from application template
   */
  static async buildFromTemplate(params: BuildFromTemplateParams): Promise<BuildStatus> {
    try {
      // Get template
      const templateResult = await query(
        'SELECT * FROM application_templates WHERE id = $1 AND is_active = true',
        [params.templateId]
      );

      if (templateResult.rows.length === 0) {
        throw new Error('Template not found or inactive');
      }

      const template = templateResult.rows[0];

      // Use custom Nix expression if provided, otherwise use template's
      const nixExpression = params.customizations?.nixExpression || template.nix_expression;

      // Merge environment variables
      const environmentVars = {
        ...(typeof template.default_env_vars === 'string' 
          ? JSON.parse(template.default_env_vars) 
          : template.default_env_vars),
        ...(params.customizations?.environmentVars || {}),
      };

      // Build from Nix expression
      return await this.buildFromNixExpression({
        serviceId: params.serviceId,
        nixExpression,
        environmentVars,
        buildTimeout: params.buildTimeout,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Create failed build record
      const buildId = uuidv4();
      await this.createBuildRecord(buildId, params.serviceId, null);
      await this.completeBuildFailure(buildId, `Template build failed: ${errorMessage}`);

      return {
        buildId,
        serviceId: params.serviceId,
        status: 'failed',
        buildLogs: `Template build failed: ${errorMessage}`,
        error: errorMessage,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Get build status and logs
   */
  static async getBuildStatus(buildId: string): Promise<BuildStatus | null> {
    try {
      const result = await query(
        `SELECT * FROM container_builds WHERE id = $1`,
        [buildId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        buildId: row.id,
        serviceId: row.service_id,
        status: row.build_status,
        buildLogs: row.build_logs,
        imageTag: row.image_tag,
        gitCommitSha: row.git_commit_sha,
        buildDurationSeconds: row.build_duration_seconds,
        artifactSizeMb: row.artifact_size_mb ? parseFloat(row.artifact_size_mb) : undefined,
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      };
    } catch (error) {
      console.error('Error getting build status:', error);
      throw error;
    }
  }

  /**
   * Cancel running build
   */
  static async cancelBuild(buildId: string): Promise<void> {
    try {
      // Update build status to cancelled
      await query(
        `UPDATE container_builds 
         SET build_status = $1, completed_at = $2, build_logs = COALESCE(build_logs, '') || $3
         WHERE id = $4 AND build_status IN ('pending', 'building')`,
        ['cancelled', new Date(), '\n[Build cancelled by user]\n', buildId]
      );

      console.log(`✅ Build ${buildId} cancelled`);
    } catch (error) {
      console.error('Error cancelling build:', error);
      throw error;
    }
  }

  /**
   * Get build artifacts
   */
  static async getBuildArtifacts(buildId: string): Promise<BuildArtifacts | null> {
    try {
      const result = await query(
        `SELECT image_tag, artifact_size_mb FROM container_builds WHERE id = $1 AND build_status = 'success'`,
        [buildId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const serviceResult = await query(
        'SELECT slug, organization_id FROM container_services WHERE id = (SELECT service_id FROM container_builds WHERE id = $1)',
        [buildId]
      );

      if (serviceResult.rows.length === 0) {
        return null;
      }

      const service = serviceResult.rows[0];
      const imageName = `${this.DOCKER_REGISTRY}/org-${service.organization_id}/${service.slug}`;

      return {
        imageTag: row.image_tag,
        imageName,
        artifactSizeMb: parseFloat(row.artifact_size_mb),
      };
    } catch (error) {
      console.error('Error getting build artifacts:', error);
      throw error;
    }
  }

  /**
   * Clean up old builds (keep last N builds per service)
   */
  static async cleanupOldBuilds(serviceId: string, keepCount: number = 10): Promise<number> {
    try {
      // Get builds to delete (older than keepCount)
      const result = await query(
        `SELECT id FROM container_builds 
         WHERE service_id = $1 
         ORDER BY created_at DESC 
         OFFSET $2`,
        [serviceId, keepCount]
      );

      const buildsToDelete = result.rows.map(row => row.id);

      if (buildsToDelete.length === 0) {
        return 0;
      }

      // Delete old builds
      await query(
        `DELETE FROM container_builds WHERE id = ANY($1)`,
        [buildsToDelete]
      );

      console.log(`✅ Cleaned up ${buildsToDelete.length} old builds for service ${serviceId}`);
      return buildsToDelete.length;
    } catch (error) {
      console.error('Error cleaning up old builds:', error);
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Create build record in database
   */
  private static async createBuildRecord(
    buildId: string,
    serviceId: string,
    gitCommitSha: string | null
  ): Promise<void> {
    await query(
      `INSERT INTO container_builds (
        id, service_id, git_commit_sha, build_status, started_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [buildId, serviceId, gitCommitSha, 'pending', new Date(), new Date()]
    );
  }

  /**
   * Update build status
   */
  private static async updateBuildStatus(buildId: string, status: string): Promise<void> {
    await query(
      'UPDATE container_builds SET build_status = $1 WHERE id = $2',
      [status, buildId]
    );
  }

  /**
   * Complete build with success
   */
  private static async completeBuildSuccess(
    buildId: string,
    imageTag: string,
    buildDurationSeconds: number,
    artifactSizeMb: number,
    buildLogs: string
  ): Promise<void> {
    await query(
      `UPDATE container_builds 
       SET build_status = $1, image_tag = $2, build_duration_seconds = $3, 
           artifact_size_mb = $4, build_logs = $5, completed_at = $6
       WHERE id = $7`,
      ['success', imageTag, buildDurationSeconds, artifactSizeMb, buildLogs, new Date(), buildId]
    );
  }

  /**
   * Complete build with failure
   */
  private static async completeBuildFailure(buildId: string, buildLogs: string): Promise<void> {
    await query(
      `UPDATE container_builds 
       SET build_status = $1, build_logs = $2, completed_at = $3
       WHERE id = $4`,
      ['failed', buildLogs, new Date(), buildId]
    );
  }

  /**
   * Clone Git repository
   */
  private static async cloneRepository(
    repoUrl: string,
    branch: string,
    targetDir: string,
    options: { sshKey?: string; accessToken?: string; shallow?: boolean }
  ): Promise<{ logs: string; commitSha: string }> {
    let logs = '';

    try {
      // Validate Git URL
      this.validateGitUrl(repoUrl);

      // Prepare clone command
      let cloneCmd = 'git clone';
      
      if (options.shallow) {
        cloneCmd += ' --depth 1';
      }

      cloneCmd += ` --branch ${branch}`;

      // Handle authentication
      let authRepoUrl = repoUrl;
      if (options.accessToken && repoUrl.startsWith('https://')) {
        // Inject access token for HTTPS URLs
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
      }

      cloneCmd += ` ${authRepoUrl} ${targetDir}`;

      // Execute clone
      const { stdout, stderr } = await execAsync(cloneCmd, {
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
        },
      });

      logs += stdout || '';
      logs += stderr || '';
      logs += `[${new Date().toISOString()}] ✅ Repository cloned successfully\n`;

      // Get commit SHA
      const { stdout: commitSha } = await execAsync('git rev-parse HEAD', { cwd: targetDir });
      const sha = commitSha.trim();
      logs += `[${new Date().toISOString()}] Commit SHA: ${sha}\n`;

      return { logs, commitSha: sha };
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to clone repository\n`;
      logs += error instanceof Error ? error.message : String(error);
      throw new Error(`Git clone failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Git URL
   */
  private static validateGitUrl(url: string): void {
    // Check for valid Git URL patterns
    const validPatterns = [
      /^https:\/\/github\.com\/.+\/.+\.git$/,
      /^https:\/\/github\.com\/.+\/.+$/,
      /^https:\/\/gitlab\.com\/.+\/.+\.git$/,
      /^https:\/\/gitlab\.com\/.+\/.+$/,
      /^https:\/\/bitbucket\.org\/.+\/.+\.git$/,
      /^https:\/\/bitbucket\.org\/.+\/.+$/,
      /^git@github\.com:.+\/.+\.git$/,
      /^git@gitlab\.com:.+\/.+\.git$/,
      /^git@bitbucket\.org:.+\/.+\.git$/,
    ];

    const isValid = validPatterns.some(pattern => pattern.test(url));

    if (!isValid) {
      throw new Error('Invalid Git repository URL. Supported: GitHub, GitLab, Bitbucket');
    }

    // Check for path traversal attempts
    if (url.includes('..') || url.includes('~')) {
      throw new Error('Invalid Git URL: path traversal detected');
    }
  }

  /**
   * Find Nix files in directory
   */
  private static async findNixFiles(dir: string): Promise<string[]> {
    const nixFiles: string[] = [];
    const commonNixFiles = ['default.nix', 'shell.nix', 'flake.nix'];

    for (const file of commonNixFiles) {
      const filePath = path.join(dir, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        nixFiles.push(file);
      }
    }

    return nixFiles;
  }

  /**
   * Create Docker image from Nix build output
   */
  private static async createDockerImage(
    buildId: string,
    serviceId: string,
    nixResultPath: string,
    currentLogs: string
  ): Promise<{ imageTag: string; artifactSizeMb: number; logs: string }> {
    let logs = currentLogs;

    try {
      // Get service info for image naming
      const serviceResult = await query(
        'SELECT slug, organization_id FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        throw new Error('Service not found');
      }

      const service = serviceResult.rows[0];
      const imageName = `${this.DOCKER_REGISTRY}/org-${service.organization_id}/${service.slug}`;
      const imageTag = `build-${buildId.substring(0, 8)}-${Date.now()}`;
      const fullImageName = `${imageName}:${imageTag}`;

      logs += `[${new Date().toISOString()}] Creating Docker image: ${fullImageName}\n`;

      // Create Dockerfile
      const dockerfileContent = `
FROM nixos/nix:latest
COPY result /app
WORKDIR /app
CMD ["/app/bin/app"]
`;

      const dockerfilePath = path.join(path.dirname(nixResultPath), 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent);

      // Build Docker image
      const { stdout: buildOutput, stderr: buildError } = await execAsync(
        `docker build -t ${fullImageName} -f ${dockerfilePath} ${path.dirname(nixResultPath)}`,
        {
          timeout: 600000, // 10 minutes
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      logs += buildOutput || '';
      if (buildError) logs += buildError;
      logs += `[${new Date().toISOString()}] ✅ Docker image created\n`;

      // Get image size
      const { stdout: sizeOutput } = await execAsync(
        `docker image inspect ${fullImageName} --format='{{.Size}}'`
      );
      const sizeBytes = parseInt(sizeOutput.trim());
      const sizeMb = Math.round((sizeBytes / 1024 / 1024) * 100) / 100;

      logs += `[${new Date().toISOString()}] Image size: ${sizeMb} MB\n`;

      // Push to registry if not localhost
      if (!this.DOCKER_REGISTRY.includes('localhost')) {
        logs += `[${new Date().toISOString()}] Pushing image to registry...\n`;
        const { stdout: pushOutput, stderr: pushError } = await execAsync(
          `docker push ${fullImageName}`,
          {
            timeout: 600000, // 10 minutes
            maxBuffer: 10 * 1024 * 1024,
          }
        );
        logs += pushOutput || '';
        if (pushError) logs += pushError;
        logs += `[${new Date().toISOString()}] ✅ Image pushed to registry\n`;
      }

      return {
        imageTag,
        artifactSizeMb: sizeMb,
        logs,
      };
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to create Docker image\n`;
      logs += error instanceof Error ? error.message : String(error);
      throw new Error(`Docker image creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
