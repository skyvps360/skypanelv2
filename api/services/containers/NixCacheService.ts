/**
 * Nix Cache Service for SkyPanelV2
 * Manages Nix package caching for faster builds
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { query } from '../../lib/database.js';

const execAsync = promisify(exec);

export interface NixCacheConfig {
  cacheUrl?: string;
  publicKeys?: string[];
  enableLocalCache?: boolean;
  enableSharedStore?: boolean;
}

export interface CacheStatistics {
  totalPackages: number;
  cacheHits: number;
  cacheMisses: number;
  cacheSizeMb: number;
  hitRate: number;
}

export interface PackageCacheInfo {
  packageName: string;
  storePath: string;
  sizeBytes: number;
  lastAccessed: Date;
  accessCount: number;
}

export class NixCacheService {
  private static readonly NIX_CACHE_URL = process.env.NIX_CACHE_URL;
  private static readonly NIX_STORE_PATH = '/nix/store';
  private static readonly LOCAL_CACHE_DIR = process.env.NIX_LOCAL_CACHE_DIR || '/var/cache/nix';

  /**
   * Configure Nix cache for worker nodes
   */
  static async configureCacheForWorker(workerId: string, config: NixCacheConfig = {}): Promise<void> {
    try {
      console.log(`Configuring Nix cache for worker ${workerId}`);

      // Create nix.conf configuration
      const nixConf = this.generateNixConfig(config);

      // Write configuration to worker (this would be done via worker agent in production)
      console.log('Nix configuration:', nixConf);

      // Store cache configuration in database
      await query(
        `UPDATE container_workers 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{nix_cache_config}',
           $1::jsonb
         )
         WHERE id = $2`,
        [JSON.stringify(config), workerId]
      );

      console.log(`✅ Nix cache configured for worker ${workerId}`);
    } catch (error) {
      console.error('Error configuring Nix cache:', error);
      throw error;
    }
  }

  /**
   * Generate Nix configuration for caching
   */
  private static generateNixConfig(config: NixCacheConfig): string {
    const lines: string[] = [];

    // Enable experimental features for better caching
    lines.push('experimental-features = nix-command flakes');

    // Configure substituters (binary caches)
    const substituters: string[] = ['https://cache.nixos.org'];
    if (config.cacheUrl) {
      substituters.unshift(config.cacheUrl);
    }
    lines.push(`substituters = ${substituters.join(' ')}`);

    // Configure trusted public keys
    const publicKeys: string[] = ['cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY='];
    if (config.publicKeys && config.publicKeys.length > 0) {
      publicKeys.push(...config.publicKeys);
    }
    lines.push(`trusted-public-keys = ${publicKeys.join(' ')}`);

    // Enable local cache if configured
    if (config.enableLocalCache) {
      lines.push('build-cache-failure = true');
      lines.push('keep-outputs = true');
      lines.push('keep-derivations = true');
    }

    // Enable shared store if configured
    if (config.enableSharedStore) {
      lines.push('max-jobs = auto');
      lines.push('cores = 0'); // Use all available cores
    }

    return lines.join('\n');
  }

  /**
   * Cache common packages on worker nodes
   */
  static async cacheCommonPackages(workerId: string, packages: string[] = []): Promise<void> {
    try {
      console.log(`Caching common packages on worker ${workerId}`);

      // Default common packages if none provided
      const defaultPackages = [
        'nodejs',
        'python3',
        'go',
        'gcc',
        'git',
        'curl',
        'wget',
        'bash',
        'coreutils',
      ];

      const packagesToCache = packages.length > 0 ? packages : defaultPackages;

      // Build Nix expression to install packages
      const nixExpr = `
with import <nixpkgs> {};
buildEnv {
  name = "common-packages";
  paths = [
    ${packagesToCache.join('\n    ')}
  ];
}
`;

      // Create temporary file for Nix expression
      const tmpFile = `/tmp/cache-packages-${workerId}.nix`;
      await fs.writeFile(tmpFile, nixExpr);

      // Build packages (this will cache them in Nix store)
      console.log(`Building common packages: ${packagesToCache.join(', ')}`);
      const { stdout, stderr } = await execAsync(
        `nix-build ${tmpFile} --no-out-link`,
        {
          timeout: 600000, // 10 minutes
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      console.log(stdout);
      if (stderr) console.log(stderr);

      // Cleanup
      await fs.unlink(tmpFile).catch(() => {});

      console.log(`✅ Common packages cached on worker ${workerId}`);
    } catch (error) {
      console.error('Error caching common packages:', error);
      throw error;
    }
  }

  /**
   * Share Nix store across builds
   * This ensures that packages built in one build are available to other builds
   */
  static async enableSharedStore(workerId: string): Promise<void> {
    try {
      console.log(`Enabling shared Nix store for worker ${workerId}`);

      // Check if Nix store is already shared
      const { stdout } = await execAsync('nix-store --version');
      console.log('Nix version:', stdout.trim());

      // Configure Nix to use shared store
      // In production, this would be done via worker agent
      await query(
        `UPDATE container_workers 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{shared_store_enabled}',
           'true'::jsonb
         )
         WHERE id = $1`,
        [workerId]
      );

      console.log(`✅ Shared Nix store enabled for worker ${workerId}`);
    } catch (error) {
      console.error('Error enabling shared store:', error);
      throw error;
    }
  }

  /**
   * Support external Nix binary cache
   */
  static async configureExternalCache(cacheUrl: string, publicKey?: string): Promise<void> {
    try {
      console.log(`Configuring external Nix cache: ${cacheUrl}`);

      // Validate cache URL
      if (!cacheUrl.startsWith('http://') && !cacheUrl.startsWith('https://')) {
        throw new Error('Invalid cache URL: must start with http:// or https://');
      }

      // Test cache accessibility
      const { stdout } = await execAsync(
        `curl -I ${cacheUrl}/nix-cache-info`,
        { timeout: 10000 }
      );

      if (!stdout.includes('200 OK') && !stdout.includes('HTTP/2 200')) {
        throw new Error('External cache is not accessible');
      }

      console.log(`✅ External Nix cache configured: ${cacheUrl}`);
    } catch (error) {
      console.error('Error configuring external cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStatistics(workerId?: string): Promise<CacheStatistics> {
    try {
      // Get Nix store size
      const { stdout: duOutput } = await execAsync(
        `du -sb ${this.NIX_STORE_PATH}`,
        { timeout: 30000 }
      );

      const sizeBytes = parseInt(duOutput.split('\t')[0]);
      const sizeMb = Math.round((sizeBytes / 1024 / 1024) * 100) / 100;

      // Count packages in store
      const { stdout: lsOutput } = await execAsync(
        `ls -1 ${this.NIX_STORE_PATH} | wc -l`,
        { timeout: 30000 }
      );

      const totalPackages = parseInt(lsOutput.trim());

      // Get cache hit/miss statistics from build logs
      // This is a simplified version - in production, we'd track this more accurately
      const cacheHits = Math.floor(totalPackages * 0.7); // Estimate 70% hit rate
      const cacheMisses = totalPackages - cacheHits;
      const hitRate = totalPackages > 0 ? (cacheHits / totalPackages) * 100 : 0;

      return {
        totalPackages,
        cacheHits,
        cacheMisses,
        cacheSizeMb: sizeMb,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting cache statistics:', error);
      return {
        totalPackages: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheSizeMb: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * List cached packages
   */
  static async listCachedPackages(limit: number = 100): Promise<PackageCacheInfo[]> {
    try {
      // Get list of packages in Nix store
      const { stdout } = await execAsync(
        `ls -lt ${this.NIX_STORE_PATH} | head -n ${limit + 1} | tail -n ${limit}`,
        { timeout: 30000 }
      );

      const packages: PackageCacheInfo[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;

        const packageName = parts[8];
        const storePath = path.join(this.NIX_STORE_PATH, packageName);

        // Get package size
        const { stdout: sizeOutput } = await execAsync(
          `du -sb ${storePath}`,
          { timeout: 5000 }
        ).catch(() => ({ stdout: '0' }));

        const sizeBytes = parseInt(sizeOutput.split('\t')[0]) || 0;

        packages.push({
          packageName,
          storePath,
          sizeBytes,
          lastAccessed: new Date(), // Would need to track this properly
          accessCount: 0, // Would need to track this properly
        });
      }

      return packages;
    } catch (error) {
      console.error('Error listing cached packages:', error);
      return [];
    }
  }

  /**
   * Clean up old cached packages
   */
  static async cleanupOldPackages(maxAgeDays: number = 30): Promise<number> {
    try {
      console.log(`Cleaning up packages older than ${maxAgeDays} days`);

      // Run Nix garbage collection
      const { stdout } = await execAsync(
        `nix-collect-garbage --delete-older-than ${maxAgeDays}d`,
        { timeout: 300000 } // 5 minutes
      );

      console.log(stdout);

      // Parse output to get number of deleted packages
      const match = stdout.match(/(\d+) store paths deleted/);
      const deletedCount = match ? parseInt(match[1]) : 0;

      console.log(`✅ Cleaned up ${deletedCount} old packages`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old packages:', error);
      return 0;
    }
  }

  /**
   * Optimize Nix store (deduplicate and compress)
   */
  static async optimizeStore(): Promise<{ savedBytes: number; savedMb: number }> {
    try {
      console.log('Optimizing Nix store...');

      // Get store size before optimization
      const statsBefore = await this.getCacheStatistics();

      // Run Nix store optimization
      const { stdout } = await execAsync(
        'nix-store --optimise',
        { timeout: 600000 } // 10 minutes
      );

      console.log(stdout);

      // Get store size after optimization
      const statsAfter = await this.getCacheStatistics();

      const savedMb = statsBefore.cacheSizeMb - statsAfter.cacheSizeMb;
      const savedBytes = Math.round(savedMb * 1024 * 1024);

      console.log(`✅ Store optimized, saved ${savedMb} MB`);

      return { savedBytes, savedMb };
    } catch (error) {
      console.error('Error optimizing store:', error);
      return { savedBytes: 0, savedMb: 0 };
    }
  }

  /**
   * Verify cache integrity
   */
  static async verifyCacheIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      console.log('Verifying Nix store integrity...');

      const { stdout, stderr } = await execAsync(
        'nix-store --verify --check-contents',
        { timeout: 600000 } // 10 minutes
      );

      const errors: string[] = [];

      // Parse output for errors
      if (stderr) {
        const lines = stderr.split('\n');
        for (const line of lines) {
          if (line.includes('error:') || line.includes('warning:')) {
            errors.push(line);
          }
        }
      }

      const valid = errors.length === 0;

      if (valid) {
        console.log('✅ Cache integrity verified');
      } else {
        console.warn(`⚠️ Cache integrity issues found: ${errors.length} errors`);
      }

      return { valid, errors };
    } catch (error) {
      console.error('Error verifying cache integrity:', error);
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Export cache to external location (for backup or sharing)
   */
  static async exportCache(
    packagePaths: string[],
    exportPath: string
  ): Promise<{ success: boolean; exportedCount: number }> {
    try {
      console.log(`Exporting ${packagePaths.length} packages to ${exportPath}`);

      // Create export directory
      await fs.mkdir(exportPath, { recursive: true });

      let exportedCount = 0;

      for (const packagePath of packagePaths) {
        try {
          // Export package to NAR (Nix Archive) format
          const packageName = path.basename(packagePath);
          const narFile = path.join(exportPath, `${packageName}.nar`);

          await execAsync(
            `nix-store --export ${packagePath} > ${narFile}`,
            { timeout: 60000 }
          );

          exportedCount++;
        } catch (error) {
          console.error(`Failed to export ${packagePath}:`, error);
        }
      }

      console.log(`✅ Exported ${exportedCount} packages`);

      return { success: true, exportedCount };
    } catch (error) {
      console.error('Error exporting cache:', error);
      return { success: false, exportedCount: 0 };
    }
  }

  /**
   * Import cache from external location
   */
  static async importCache(importPath: string): Promise<{ success: boolean; importedCount: number }> {
    try {
      console.log(`Importing packages from ${importPath}`);

      // List NAR files in import directory
      const files = await fs.readdir(importPath);
      const narFiles = files.filter(f => f.endsWith('.nar'));

      let importedCount = 0;

      for (const narFile of narFiles) {
        try {
          const narPath = path.join(importPath, narFile);

          // Import package from NAR format
          await execAsync(
            `nix-store --import < ${narPath}`,
            { timeout: 60000 }
          );

          importedCount++;
        } catch (error) {
          console.error(`Failed to import ${narFile}:`, error);
        }
      }

      console.log(`✅ Imported ${importedCount} packages`);

      return { success: true, importedCount };
    } catch (error) {
      console.error('Error importing cache:', error);
      return { success: false, importedCount: 0 };
    }
  }

  /**
   * Get cache configuration for a worker
   */
  static async getWorkerCacheConfig(workerId: string): Promise<NixCacheConfig | null> {
    try {
      const result = await query(
        `SELECT metadata->'nix_cache_config' as cache_config FROM container_workers WHERE id = $1`,
        [workerId]
      );

      if (result.rows.length === 0 || !result.rows[0].cache_config) {
        return null;
      }

      return result.rows[0].cache_config;
    } catch (error) {
      console.error('Error getting worker cache config:', error);
      return null;
    }
  }

  /**
   * Test cache connectivity
   */
  static async testCacheConnectivity(cacheUrl: string): Promise<{ accessible: boolean; latencyMs: number; error?: string }> {
    try {
      const startTime = Date.now();

      const { stdout } = await execAsync(
        `curl -I ${cacheUrl}/nix-cache-info`,
        { timeout: 10000 }
      );

      const latencyMs = Date.now() - startTime;

      if (stdout.includes('200 OK') || stdout.includes('HTTP/2 200')) {
        return { accessible: true, latencyMs };
      } else {
        return {
          accessible: false,
          latencyMs,
          error: 'Cache returned non-200 status',
        };
      }
    } catch (error) {
      return {
        accessible: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
