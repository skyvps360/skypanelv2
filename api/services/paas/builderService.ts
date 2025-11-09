/**
 * PaaS Builder Service
 * Handles git cloning, buildpack detection, compilation, and slug creation
 */

import { pool, PaasApplication, PaasDeployment } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface BuildOptions {
  applicationId: string;
  gitUrl: string;
  gitBranch: string;
  gitCommit?: string;
  buildpack?: string;
  userId?: string;
}

export interface BuildResult {
  deploymentId: string;
  success: boolean;
  slugUrl?: string;
  slugSize?: number;
  buildpack?: string;
  error?: string;
}

export class BuilderService {
  private static buildDir = '/var/paas/builds';
  private static slugDir = '/var/paas/slugs';
  private static cacheDir = '/var/paas/cache';

  /**
   * Initialize builder directories
   */
  static async initialize(): Promise<void> {
    await fs.mkdir(this.buildDir, { recursive: true });
    await fs.mkdir(this.slugDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Build an application
   */
  static async build(options: BuildOptions): Promise<BuildResult> {
    await this.initialize();

    // Get application
    const appResult = await pool.query<PaasApplication>(
      'SELECT * FROM paas_applications WHERE id = $1',
      [options.applicationId]
    );

    if (appResult.rows.length === 0) {
      throw new Error('Application not found');
    }

    const app = appResult.rows[0];

    // Get next version number
    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM paas_deployments WHERE application_id = $1',
      [options.applicationId]
    );
    const version = versionResult.rows[0].next_version;

    // Create deployment record
    const deploymentResult = await pool.query<PaasDeployment>(
      `INSERT INTO paas_deployments (
        application_id, version, git_commit, status, created_by, build_started_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [options.applicationId, version, options.gitCommit, 'building', options.userId]
    );

    const deployment = deploymentResult.rows[0];

    // Update app status
    await pool.query(
      'UPDATE paas_applications SET status = $1 WHERE id = $2',
      ['building', options.applicationId]
    );

    try {
      // Build the application
      const buildResult = await this.executeBuild(deployment.id, options);

      // Update deployment with success
      await pool.query(
        `UPDATE paas_deployments SET
          status = $1,
          slug_url = $2,
          slug_size_bytes = $3,
          buildpack_used = $4,
          build_completed_at = NOW()
        WHERE id = $5`,
        ['deploying', buildResult.slugUrl, buildResult.slugSize, buildResult.buildpack, deployment.id]
      );

      return {
        deploymentId: deployment.id,
        success: true,
        ...buildResult,
      };
    } catch (error: any) {
      // Update deployment with failure
      await pool.query(
        `UPDATE paas_deployments SET
          status = $1,
          error_message = $2,
          build_completed_at = NOW()
        WHERE id = $3`,
        ['build_failed', error.message, deployment.id]
      );

      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['failed', options.applicationId]
      );

      return {
        deploymentId: deployment.id,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute the build process
   */
  private static async executeBuild(
    deploymentId: string,
    options: BuildOptions
  ): Promise<{ slugUrl: string; slugSize: number; buildpack: string }> {
    const buildId = crypto.randomUUID();
    const workDir = path.join(this.buildDir, buildId);
    const slugPath = path.join(this.slugDir, `${deploymentId}.tar.gz`);

    try {
      // 1. Clone repository
      await this.logBuild(deploymentId, '-----> Cloning repository...');
      await this.cloneRepository(options.gitUrl, options.gitBranch, workDir);

      // 2. Detect buildpack
      await this.logBuild(deploymentId, '-----> Detecting buildpack...');
      const buildpack = options.buildpack || (await this.detectBuildpack(workDir));
      await this.logBuild(deploymentId, `-----> Using buildpack: ${buildpack}`);

      // 3. Run buildpack compile
      await this.logBuild(deploymentId, '-----> Compiling application...');
      await this.runBuildpack(workDir, buildpack, deploymentId);

      // 4. Create slug (compressed artifact)
      await this.logBuild(deploymentId, '-----> Creating slug...');
      const slugSize = await this.createSlug(workDir, slugPath);

      // 5. Upload to storage
      await this.logBuild(deploymentId, '-----> Uploading slug...');
      const slugUrl = await this.uploadSlug(slugPath, deploymentId);

      // Cleanup
      await fs.rm(workDir, { recursive: true, force: true });

      await this.logBuild(deploymentId, `-----> Build complete! Slug size: ${(slugSize / 1024 / 1024).toFixed(2)}MB`);

      return { slugUrl, slugSize, buildpack };
    } catch (error: any) {
      await this.logBuild(deploymentId, `!     Build failed: ${error.message}`, true);
      // Cleanup on error
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Clone git repository
   */
  private static async cloneRepository(gitUrl: string, branch: string, targetDir: string): Promise<void> {
    // Security: Validate git URL
    if (!gitUrl.match(/^(https?:\/\/|git@)/)) {
      throw new Error('Invalid git URL');
    }

    await execAsync(`git clone --depth 1 --branch ${branch} ${gitUrl} ${targetDir}`);
  }

  /**
   * Detect buildpack based on project files
   */
  private static async detectBuildpack(projectDir: string): Promise<string> {
    const files = await fs.readdir(projectDir);

    // Node.js
    if (files.includes('package.json')) {
      return 'heroku/nodejs';
    }

    // Python
    if (files.includes('requirements.txt') || files.includes('Pipfile')) {
      return 'heroku/python';
    }

    // Ruby
    if (files.includes('Gemfile')) {
      return 'heroku/ruby';
    }

    // PHP
    if (files.includes('composer.json') || files.includes('index.php')) {
      return 'heroku/php';
    }

    // Go
    if (files.includes('go.mod')) {
      return 'heroku/go';
    }

    // Java
    if (files.includes('pom.xml') || files.includes('build.gradle')) {
      return 'heroku/java';
    }

    throw new Error('Could not detect buildpack. Please specify one explicitly.');
  }

  /**
   * Run buildpack compilation using herokuish
   */
  private static async runBuildpack(projectDir: string, buildpack: string, deploymentId: string): Promise<void> {
    // Use herokuish Docker image to run buildpack
    const cacheDir = path.join(this.cacheDir, deploymentId);
    await fs.mkdir(cacheDir, { recursive: true });

    const command = `
      docker run --rm \\
        -v ${projectDir}:/tmp/app \\
        -v ${cacheDir}:/tmp/cache \\
        -e BUILDPACK_URL=${this.getBuildpackUrl(buildpack)} \\
        gliderlabs/herokuish:latest \\
        /bin/herokuish buildpack build
    `;

    const { stdout, stderr } = await execAsync(command);

    // Log output
    if (stdout) await this.logBuild(deploymentId, stdout);
    if (stderr) await this.logBuild(deploymentId, stderr);
  }

  /**
   * Get buildpack URL from name
   */
  private static getBuildpackUrl(buildpack: string): string {
    if (buildpack.startsWith('http://') || buildpack.startsWith('https://')) {
      return buildpack;
    }

    // Convert short names to Heroku buildpack URLs
    const buildpackMap: Record<string, string> = {
      'heroku/nodejs': 'https://github.com/heroku/heroku-buildpack-nodejs',
      'heroku/python': 'https://github.com/heroku/heroku-buildpack-python',
      'heroku/ruby': 'https://github.com/heroku/heroku-buildpack-ruby',
      'heroku/php': 'https://github.com/heroku/heroku-buildpack-php',
      'heroku/go': 'https://github.com/heroku/heroku-buildpack-go',
      'heroku/java': 'https://github.com/heroku/heroku-buildpack-java',
    };

    return buildpackMap[buildpack] || buildpack;
  }

  /**
   * Create compressed slug from built application
   */
  private static async createSlug(projectDir: string, slugPath: string): Promise<number> {
    await tar.create(
      {
        gzip: true,
        file: slugPath,
        cwd: projectDir,
      },
      ['.']
    );

    const stats = await fs.stat(slugPath);
    return stats.size;
  }

  /**
   * Upload slug to storage (S3 or local)
   */
  private static async uploadSlug(slugPath: string, deploymentId: string): Promise<string> {
    const storageConfig = await PaasSettingsService.getStorageConfig();

    if (storageConfig.type === 's3') {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { Upload } = await import('@aws-sdk/lib-storage');
      const fs = await import('fs');
      const path = await import('path');

      // Configure S3 client
      const s3Client = new S3Client({
        region: storageConfig.s3_region || 'us-east-1',
        credentials: {
          accessKeyId: storageConfig.s3_access_key || '',
          secretAccessKey: storageConfig.s3_secret_key || '',
        },
        ...(storageConfig.s3_endpoint ? { endpoint: storageConfig.s3_endpoint } : {}),
      });

      // Read the slug file
      const fileStream = fs.createReadStream(slugPath);
      const fileName = path.basename(slugPath);
      const s3Key = `paas-slugs/${deploymentId}/${fileName}`;

      try {
        // Upload to S3
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: storageConfig.s3_bucket || '',
            Key: s3Key,
            Body: fileStream,
            ContentType: 'application/gzip',
          },
        });

        await upload.done();

        // Return S3 URL
        const s3Url = storageConfig.s3_endpoint
          ? `${storageConfig.s3_endpoint}/${storageConfig.s3_bucket}/${s3Key}`
          : `https://${storageConfig.s3_bucket}.s3.${storageConfig.s3_region}.amazonaws.com/${s3Key}`;

        console.log(`✅ Slug uploaded to S3: ${s3Url}`);
        return s3Url;
      } catch (error) {
        console.error('Failed to upload slug to S3:', error);
        // Fallback to local path
        return slugPath;
      }
    }

    // Local storage - slug is already in the right place
    return slugPath;
  }

  /**
   * Log build output to database
   */
  private static async logBuild(deploymentId: string, message: string, isError: boolean = false): Promise<void> {
    console.log(`[Build ${deploymentId}] ${message}`);

    await pool.query(
      `UPDATE paas_deployments SET
        build_log = COALESCE(build_log, '') || $1 || E'\\n'
      WHERE id = $2`,
      [message, deploymentId]
    );
  }

  /**
   * Get build logs for a deployment
   */
  static async getBuildLogs(deploymentId: string): Promise<string> {
    const result = await pool.query<PaasDeployment>(
      'SELECT build_log FROM paas_deployments WHERE id = $1',
      [deploymentId]
    );

    return result.rows[0]?.build_log || '';
  }
}
