import { Upload } from '@aws-sdk/lib-storage';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import os from 'os';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { pool, PaasBuildCache } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';

export interface BuildCacheConfig {
  enabled: boolean;
  maxSizeMb: number;
  ttlHours: number;
}

interface CacheDownloadResult {
  archivePath: string;
  cleanup: boolean;
}

const TEMP_ARCHIVE_DIR = path.join(os.tmpdir(), 'paas-build-cache');

export class BuildCacheService {
  private static readonly CACHE_PREFIX = 'paas-build-cache';

  /**
   * Fetch cache configuration
   */
  static async getConfig(): Promise<BuildCacheConfig> {
    return PaasSettingsService.getBuildpackCacheConfig();
  }

  /**
   * Fetch an existing cache if it is still within TTL
   */
  static async getValidCache(
    applicationId: string,
    cacheKey: string,
    ttlHours: number
  ): Promise<PaasBuildCache | null> {
    const result = await pool.query<PaasBuildCache>(
      'SELECT * FROM paas_build_cache WHERE application_id = $1 AND cache_key = $2',
      [applicationId, cacheKey]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const cache = result.rows[0];
    if (ttlHours > 0) {
      const lastUsed = cache.last_used_at ? new Date(cache.last_used_at) : new Date(cache.created_at);
      const expiresAt = lastUsed.getTime() + ttlHours * 60 * 60 * 1000;
      if (Date.now() > expiresAt) {
        await this.deleteCacheRecords([cache]);
        return null;
      }
    }

    return cache;
  }

  /**
   * Update last_used_at for cache entry
   */
  static async touchCache(cacheId: string): Promise<void> {
    await pool.query('UPDATE paas_build_cache SET last_used_at = NOW() WHERE id = $1', [cacheId]);
  }

  /**
   * Store compressed cache archive to configured storage and upsert DB record
   */
  static async saveCacheArchive(options: {
    applicationId: string;
    cacheKey: string;
    archivePath: string;
    sizeBytes: number;
  }): Promise<PaasBuildCache> {
    const storage = await PaasSettingsService.getStorageConfig();
    const fileName = `${options.cacheKey}.tgz`;
    let cacheUrl: string;

    if (storage.type === 's3' && storage.s3) {
      const s3Key = `${this.CACHE_PREFIX}/${options.applicationId}/${fileName}`;
      const client = this.createS3Client(storage.s3);

      const upload = new Upload({
        client,
        params: {
          Bucket: storage.s3.bucket,
          Key: s3Key,
          Body: createReadStream(options.archivePath),
          ContentType: 'application/gzip',
        },
      });

      await upload.done();
      cacheUrl = `s3://${storage.s3.bucket}/${s3Key}`;
    } else {
      const basePath = storage.local?.path || '/var/paas/storage';
      const destDir = path.join(basePath, this.CACHE_PREFIX);
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, `${options.applicationId}-${fileName}`);
      await fs.copyFile(options.archivePath, destPath);
      cacheUrl = destPath;
    }

    const upsert = await pool.query<PaasBuildCache>(
      `INSERT INTO paas_build_cache (
        application_id, cache_key, cache_url, size_bytes, last_used_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (application_id, cache_key) DO UPDATE
      SET cache_url = EXCLUDED.cache_url,
          size_bytes = EXCLUDED.size_bytes,
          last_used_at = NOW(),
          created_at = COALESCE(paas_build_cache.created_at, NOW())
      RETURNING *`,
      [options.applicationId, options.cacheKey, cacheUrl, options.sizeBytes ?? null]
    );

    return upsert.rows[0];
  }

  /**
   * Download cache archive to local temp path (if needed)
   */
  static async downloadCacheArchive(cache: PaasBuildCache): Promise<CacheDownloadResult> {
    if (cache.cache_url.startsWith('s3://')) {
      await fs.mkdir(TEMP_ARCHIVE_DIR, { recursive: true });
      const tempPath = path.join(TEMP_ARCHIVE_DIR, `${crypto.randomUUID()}.tgz`);
      await this.downloadS3Object(cache.cache_url, tempPath);
      return { archivePath: tempPath, cleanup: true };
    }

    return { archivePath: cache.cache_url, cleanup: false };
  }

  /**
   * Remove cache entries for an application (optionally filtered by cache key)
   */
  static async invalidateCache(applicationId: string, cacheKey?: string): Promise<number> {
    const params: Array<string> = [applicationId];
    let clause = 'application_id = $1';
    if (cacheKey) {
      params.push(cacheKey);
      clause += ' AND cache_key = $2';
    }

    const caches = await pool.query<PaasBuildCache>(
      `SELECT * FROM paas_build_cache WHERE ${clause}`,
      params
    );

    if (caches.rows.length === 0) {
      return 0;
    }

    await this.deleteCacheRecords(caches.rows);
    return caches.rows.length;
  }

  /**
   * Remove stale caches when buildpack/stack changes
   */
  static async pruneCachesExcept(applicationId: string, cacheKey: string): Promise<void> {
    const caches = await pool.query<PaasBuildCache>(
      'SELECT * FROM paas_build_cache WHERE application_id = $1 AND cache_key <> $2',
      [applicationId, cacheKey]
    );

    if (caches.rows.length === 0) {
      return;
    }

    await this.deleteCacheRecords(caches.rows);
  }

  /**
   * Cleanup task removing expired cache entries
   */
  static async cleanupExpiredCaches(): Promise<{ removed: number; reclaimedBytes: number }> {
    const config = await this.getConfig();
    if (config.ttlHours <= 0) {
      return { removed: 0, reclaimedBytes: 0 };
    }

    const threshold = Date.now() - config.ttlHours * 60 * 60 * 1000;
    const caches = await pool.query<PaasBuildCache>('SELECT * FROM paas_build_cache');
    const expired = caches.rows.filter((cache) => {
      const lastUsed = cache.last_used_at ? new Date(cache.last_used_at) : new Date(cache.created_at);
      return lastUsed.getTime() < threshold;
    });

    if (expired.length === 0) {
      return { removed: 0, reclaimedBytes: 0 };
    }

    let reclaimedBytes = 0;
    expired.forEach((cache) => {
      reclaimedBytes += cache.size_bytes || 0;
    });

    await this.deleteCacheRecords(expired);
    return { removed: expired.length, reclaimedBytes };
  }

  private static createS3Client(config: {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
    endpoint?: string;
  }): S3Client {
    return new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKey || '',
        secretAccessKey: config.secretKey || '',
      },
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  private static async downloadS3Object(source: string, destination: string): Promise<void> {
    const parsed = this.parseS3Url(source);
    if (!parsed) {
      throw new Error(`Invalid cache URL: ${source}`);
    }

    const storage = await PaasSettingsService.getStorageConfig();
    if (storage.type !== 's3' || !storage.s3) {
      throw new Error('S3 storage is not configured');
    }

    const client = this.createS3Client(storage.s3);
    const response = await client.send(
      new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key })
    );

    if (!response.Body) {
      throw new Error('Cache download returned empty body');
    }

    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destination));
  }

  private static async deleteCacheRecords(caches: PaasBuildCache[]): Promise<void> {
    if (caches.length === 0) {
      return;
    }

    await Promise.all(
      caches.map((cache) =>
        this.deleteCacheArtifact(cache).catch((error) => {
          console.warn(`[BuildCache] Failed to delete artifact for ${cache.cache_key}:`, error);
        })
      )
    );

    const ids = caches.map((cache) => cache.id);
    await pool.query('DELETE FROM paas_build_cache WHERE id = ANY($1)', [ids]);
  }

  private static async deleteCacheArtifact(cache: PaasBuildCache): Promise<void> {
    if (cache.cache_url.startsWith('s3://')) {
      const parsed = this.parseS3Url(cache.cache_url);
      if (!parsed) {
        return;
      }

      const storage = await PaasSettingsService.getStorageConfig();
      if (storage.type !== 's3' || !storage.s3) {
        return;
      }

      const client = this.createS3Client(storage.s3);
      await client.send(
        new DeleteObjectCommand({
          Bucket: parsed.bucket,
          Key: parsed.key,
        })
      );
      return;
    }

    await fs.rm(cache.cache_url, { force: true }).catch(() => {});
  }

  private static parseS3Url(url: string): { bucket: string; key: string } | null {
    if (!url.startsWith('s3://')) {
      return null;
    }

    const withoutScheme = url.slice(5);
    const firstSlash = withoutScheme.indexOf('/');
    if (firstSlash === -1) {
      return null;
    }

    const bucket = withoutScheme.slice(0, firstSlash);
    const key = withoutScheme.slice(firstSlash + 1);
    return { bucket, key };
  }
}
