import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import { pool } from '../../lib/database.js';
import { PaasSettingsService } from './settingsService.js';

export class SlugService {
  /**
   * Remove all slug artifacts for a given application
   */
  static async deleteAppSlugs(appId: string): Promise<void> {
    const slugs = await pool.query(
      'SELECT slug_url FROM paas_deployments WHERE application_id = $1 AND slug_url IS NOT NULL',
      [appId]
    );

    for (const row of slugs.rows) {
      if (row.slug_url) {
        await this.deleteSlug(row.slug_url).catch((error) => {
          console.warn(`[Slugs] Failed to delete ${row.slug_url}:`, error?.message || error);
        });
      }
    }
  }

  /**
   * Delete a single slug from storage (S3 or local filesystem)
   */
  static async deleteSlug(slugUrl: string): Promise<void> {
    if (!slugUrl) return;

    const storage = await PaasSettingsService.getStorageConfig();

    if (storage.type === 's3' && storage.s3) {
      const key = this.extractS3Key(slugUrl, storage.s3.bucket);
      if (!key) {
        console.warn(`[Slugs] Unable to determine S3 key for ${slugUrl}`);
        return;
      }

      const client = new S3Client({
        region: storage.s3.region || 'us-east-1',
        credentials: {
          accessKeyId: storage.s3.accessKey || '',
          secretAccessKey: storage.s3.secretKey || '',
        },
        ...(storage.s3.endpoint ? { endpoint: storage.s3.endpoint, forcePathStyle: true } : {}),
      });

      await client.send(
        new DeleteObjectCommand({
          Bucket: storage.s3.bucket,
          Key: key,
        })
      );
      return;
    }

    // Local storage
    await fs.rm(slugUrl, { force: true }).catch(() => {});
  }

  private static extractS3Key(slugUrl: string, bucket: string): string | null {
    const normalized = slugUrl.replace(/^https?:\/\//i, '');

    const bucketPrefix = `${bucket}.`;
    if (normalized.startsWith(bucketPrefix)) {
      const firstSlash = normalized.indexOf('/');
      if (firstSlash !== -1) {
        return normalized.substring(firstSlash + 1);
      }
    }

    const bucketWithSlash = `${bucket}/`;
    const idx = normalized.indexOf(bucketWithSlash);
    if (idx !== -1) {
      return normalized.substring(idx + bucketWithSlash.length);
    }

    if (normalized.startsWith(`${bucket}/`)) {
      return normalized.substring(bucket.length + 1);
    }

    return null;
  }
}
