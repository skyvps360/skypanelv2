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
import { createReadStream } from 'fs';
import * as tar from 'tar';
import * as crypto from 'crypto';
import { constants as zlibConstants } from 'zlib';
import { GitService } from './gitService.js';
import { BuildCacheService, BuildCacheConfig } from './buildCacheService.js';

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
  private static directories: Record<'build' | 'slug' | 'cache', string> = {
    build: '/var/paas/builds',
    slug: '/var/paas/slugs',
    cache: '/var/paas/cache',
  };

  /**
   * Initialize builder directories
   */
  static async initialize(): Promise<void> {
    const storageConfig = await PaasSettingsService.getStorageConfig();

    if (storageConfig.type === 'local') {
      const basePath = storageConfig.local?.path || '/var/paas/storage';
      this.directories = {
        build: path.join(basePath, 'builds'),
        slug: path.join(basePath, 'slugs'),
        cache: path.join(basePath, 'cache'),
      };
    } else {
      this.directories = {
        build: '/var/paas/builds',
        slug: '/var/paas/slugs',
        cache: '/var/paas/cache',
      };
    }

    await Promise.all(
      Object.values(this.directories).map((dir) => fs.mkdir(dir, { recursive: true }))
    );
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
      const buildResult = await this.executeBuild(deployment.id, options, app);

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
    options: BuildOptions,
    app: PaasApplication
  ): Promise<{ slugUrl: string; slugSize: number; buildpack: string }> {
    const buildId = crypto.randomUUID();
    const workDir = path.join(this.directories.build, buildId);
    const slugPath = path.join(this.directories.slug, `${deploymentId}.tar.gz`);
    const cacheDir = await this.prepareCacheDirectory(deploymentId);

    try {
      // 1. Validate repo + branch and clone
      await this.logBuild(deploymentId, '-----> Validating repository access...');
      await this.validateRepository(options.gitUrl, options.gitBranch);

      await this.logBuild(deploymentId, '-----> Cloning repository...');
      await this.cloneRepository(options.gitUrl, options.gitBranch, workDir);

      // 2. Detect buildpack
      await this.logBuild(deploymentId, '-----> Detecting buildpack...');
      const buildpack = options.buildpack || (await this.detectBuildpack(workDir));
      await this.logBuild(deploymentId, `-----> Using buildpack: ${buildpack}`);
      const cacheConfig = await BuildCacheService.getConfig();
      let cacheKey: string | undefined;

      if (cacheConfig.enabled) {
        cacheKey = await this.restoreBuildCache({
          app,
          buildpack,
          cacheDir,
          deploymentId,
          config: cacheConfig,
        });
      } else {
        await this.logBuild(deploymentId, '-----> Build cache disabled');
      }

      // 3. Run buildpack compile
      await this.logBuild(deploymentId, '-----> Compiling application...');
      await this.runBuildpack(workDir, buildpack, deploymentId, cacheDir);

      // 4. Create slug (compressed artifact)
      await this.logBuild(deploymentId, '-----> Creating slug...');
      const slugSize = await this.createSlug(workDir, slugPath);

      // 5. Upload to storage
      await this.logBuild(deploymentId, '-----> Uploading slug...');
      const slugUrl = await this.uploadSlug(slugPath, deploymentId);

      // 6. Persist build cache if applicable
      if (cacheKey) {
        await this.persistBuildCache({
          app,
          cacheDir,
          cacheKey,
          config: cacheConfig,
          deploymentId,
        });
      }

      // Cleanup
      await fs.rm(workDir, { recursive: true, force: true });
      await fs.rm(cacheDir, { recursive: true, force: true });

      await this.logBuild(deploymentId, `-----> Build complete! Slug size: ${(slugSize / 1024 / 1024).toFixed(2)}MB`);

      return { slugUrl, slugSize, buildpack };
    } catch (error: any) {
      await this.logBuild(deploymentId, `!     Build failed: ${error.message}`, true);
      // Cleanup on error
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Validate git repository access before cloning
   */
  private static async validateRepository(gitUrl: string, branch: string): Promise<void> {
    try {
      await GitService.validateRepository(gitUrl, branch);
    } catch (error: any) {
      throw new Error(
        error?.message?.includes('not found')
          ? `Git branch "${branch}" not found`
          : 'Unable to access repository. Verify URL, credentials, and branch name.'
      );
    }
  }

  /**
   * Clone git repository (HTTPS or SSH with auth)
   */
  private static async cloneRepository(gitUrl: string, branch: string, targetDir: string): Promise<void> {
    try {
      await GitService.cloneRepository(gitUrl, branch, targetDir);
    } catch (error: any) {
      throw new Error(`Git clone failed: ${error?.message || error}`);
    }
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
  private static async runBuildpack(
    projectDir: string,
    buildpack: string,
    deploymentId: string,
    cacheDir: string
  ): Promise<void> {
    // Use herokuish Docker image to run buildpack
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
    await (tar.create as any)(
      {
        gzip: true,
        gzipOptions: { level: zlibConstants.Z_BEST_SPEED },
        file: slugPath,
        cwd: projectDir,
      },
      ['.']
    );

    const stats = await fs.stat(slugPath);
    return stats.size;
  }

  /**
   * Prepare cache directory for build
   */
  private static async prepareCacheDirectory(deploymentId: string): Promise<string> {
    const cacheDir = path.join(this.directories.cache, deploymentId);
    await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  }

  /**
   * Build deterministic cache key based on app/buildpack/stack
   */
  private static buildCacheKey(app: PaasApplication, buildpack: string): string {
    const stack = app.stack || 'unknown';
    const normalizedBuildpack = buildpack || 'auto';
    return crypto.createHash('sha1').update(`${app.id}:${normalizedBuildpack}:${stack}`).digest('hex');
  }

  /**
   * Restore build cache if available
   */
  private static async restoreBuildCache(options: {
    app: PaasApplication;
    buildpack: string;
    cacheDir: string;
    deploymentId: string;
    config: BuildCacheConfig;
  }): Promise<string> {
    const { app, buildpack, cacheDir, deploymentId, config } = options;
    const cacheKey = this.buildCacheKey(app, buildpack);

    try {
      await this.logBuild(
        deploymentId,
        `-----> Checking build cache (stack=${app.stack || 'default'}, buildpack=${buildpack})`
      );
      const cache = await BuildCacheService.getValidCache(app.id, cacheKey, config.ttlHours);
      if (!cache) {
        await this.logBuild(deploymentId, '-----> Build cache miss');
        return cacheKey;
      }

      await this.logBuild(
        deploymentId,
        `-----> Build cache hit (${((cache.size_bytes || 0) / (1024 * 1024)).toFixed(2)}MB)`
      );
      const archive = await BuildCacheService.downloadCacheArchive(cache);
      await tar.extract({
        file: archive.archivePath,
        cwd: cacheDir,
      });
      if (archive.cleanup) {
        await fs.rm(archive.archivePath, { force: true }).catch(() => {});
      }
      await BuildCacheService.touchCache(cache.id);
      await this.logBuild(deploymentId, '-----> Build cache restored');
    } catch (error: any) {
      await this.logBuild(
        deploymentId,
        `!     Unable to restore build cache (${error?.message || error}). Continuing without cache.`
      );
    }

    return cacheKey;
  }

  /**
   * Persist build cache for future builds
   */
  private static async persistBuildCache(options: {
    app: PaasApplication;
    cacheDir: string;
    cacheKey?: string;
    config: BuildCacheConfig;
    deploymentId: string;
  }): Promise<void> {
    const { app, cacheDir, cacheKey, config, deploymentId } = options;

    if (!config.enabled || !cacheKey) {
      return;
    }

    const archivePath = path.join(this.directories.cache, `${deploymentId}-cache.tgz`);

    try {
      await this.logBuild(deploymentId, '-----> Saving build cache...');
      await tar.create(
        {
          gzip: true,
          file: archivePath,
          cwd: cacheDir,
        },
        ['.']
      );

      const stats = await fs.stat(archivePath);
      const maxBytes = config.maxSizeMb > 0 ? config.maxSizeMb * 1024 * 1024 : 0;

      if (maxBytes > 0 && stats.size > maxBytes) {
        await this.logBuild(
          deploymentId,
          `-----> Skipping build cache (size ${(stats.size / (1024 * 1024)).toFixed(
            2
          )}MB exceeds limit of ${config.maxSizeMb}MB)`
        );
        return;
      }

      await BuildCacheService.saveCacheArchive({
        applicationId: app.id,
        cacheKey,
        archivePath,
        sizeBytes: stats.size,
      });
      await BuildCacheService.pruneCachesExcept(app.id, cacheKey);

      await this.logBuild(
        deploymentId,
        `-----> Build cache stored (${(stats.size / (1024 * 1024)).toFixed(2)}MB)`
      );
    } catch (error: any) {
      await this.logBuild(
        deploymentId,
        `!     Failed to persist build cache (${error?.message || error}).`
      );
    } finally {
      await fs.rm(archivePath, { force: true }).catch(() => {});
    }
  }

  /**
   * Upload slug to storage (S3 or local)
   */
  private static async uploadSlug(slugPath: string, deploymentId: string): Promise<string> {
    const storageConfig = await PaasSettingsService.getStorageConfig();

    if (storageConfig.type === 's3' && storageConfig.s3) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { Upload } = await import('@aws-sdk/lib-storage');

      const s3Client = new S3Client({
        region: storageConfig.s3.region || 'us-east-1',
        credentials: {
          accessKeyId: storageConfig.s3.accessKey || '',
          secretAccessKey: storageConfig.s3.secretKey || '',
        },
        ...(storageConfig.s3.endpoint ? { endpoint: storageConfig.s3.endpoint, forcePathStyle: true } : {}),
      });

      const fileStream = createReadStream(slugPath);
      const fileName = path.basename(slugPath);
      const s3Key = `paas-slugs/${deploymentId}/${fileName}`;

      try {
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: storageConfig.s3.bucket || '',
            Key: s3Key,
            Body: fileStream,
            ContentType: 'application/gzip',
          },
        });

        await upload.done();

        const normalizedEndpoint = storageConfig.s3.endpoint?.replace(/\/$/, '');
        const s3Url = normalizedEndpoint
          ? `${normalizedEndpoint}/${storageConfig.s3.bucket}/${s3Key}`
          : `https://${storageConfig.s3.bucket}.s3.${storageConfig.s3.region || 'us-east-1'}.amazonaws.com/${s3Key}`;

        console.log(`✅ Slug uploaded to S3: ${s3Url}`);
        await fs.rm(slugPath, { force: true }).catch(() => {});
        return s3Url;
      } catch (error) {
        console.error('Failed to upload slug to S3:', error);
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
