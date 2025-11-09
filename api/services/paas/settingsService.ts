/**
 * PaaS Settings Service
 * Manages all PaaS configuration settings stored in database (zero .env approach)
 */

import { pool, PaasSettings } from '../../lib/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

export class PaasSettingsService {
  /**
   * Get a setting value by key
   */
  static async get(key: string): Promise<string | number | boolean | object | null> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const setting = result.rows[0];
    let value = setting.value_encrypted;

    // Decrypt if sensitive
    if (setting.is_sensitive && value) {
      value = decrypt(value);
    }

    // Parse based on type
    if (!value) return null;

    switch (setting.value_type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * Set a setting value
   */
  static async set(
    key: string,
    value: string | number | boolean | object,
    options?: {
      description?: string;
      category?: string;
      is_sensitive?: boolean;
    }
  ): Promise<void> {
    // Determine value type
    let valueType: 'string' | 'number' | 'boolean' | 'json' = 'string';
    let valueStr: string;

    if (typeof value === 'number') {
      valueType = 'number';
      valueStr = value.toString();
    } else if (typeof value === 'boolean') {
      valueType = 'boolean';
      valueStr = value.toString();
    } else if (typeof value === 'object') {
      valueType = 'json';
      valueStr = JSON.stringify(value);
    } else {
      valueStr = value;
    }

    // Encrypt if sensitive
    if (options?.is_sensitive) {
      valueStr = encrypt(valueStr);
    }

    await pool.query(
      `INSERT INTO paas_settings (key, value_encrypted, value_type, description, is_sensitive, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET
         value_encrypted = EXCLUDED.value_encrypted,
         value_type = EXCLUDED.value_type,
         description = EXCLUDED.description,
         is_sensitive = EXCLUDED.is_sensitive,
         category = EXCLUDED.category,
         updated_at = NOW()`,
      [
        key,
        valueStr,
        valueType,
        options?.description || null,
        options?.is_sensitive || false,
        options?.category || 'general',
      ]
    );
  }

  /**
   * Get all settings in a category
   */
  static async getByCategory(category: string): Promise<Record<string, any>> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings WHERE category = $1',
      [category]
    );

    const settings: Record<string, any> = {};

    for (const row of result.rows) {
      let value = row.value_encrypted;

      if (row.is_sensitive && value) {
        value = decrypt(value);
      }

      if (!value) {
        settings[row.key] = null;
        continue;
      }

      switch (row.value_type) {
        case 'number':
          settings[row.key] = parseFloat(value);
          break;
        case 'boolean':
          settings[row.key] = value.toLowerCase() === 'true';
          break;
        case 'json':
          settings[row.key] = JSON.parse(value);
          break;
        default:
          settings[row.key] = value;
      }
    }

    return settings;
  }

  /**
   * Get all settings (for admin UI)
   */
  static async getAll(includeSensitive: boolean = false): Promise<PaasSettings[]> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings ORDER BY category, key'
    );

    if (!includeSensitive) {
      // Mask sensitive values
      return result.rows.map((row) => ({
        ...row,
        value_encrypted: row.is_sensitive ? '***REDACTED***' : row.value_encrypted,
      }));
    }

    // Decrypt sensitive values if requested
    return result.rows.map((row) => {
      if (row.is_sensitive && row.value_encrypted) {
        return {
          ...row,
          value_encrypted: decrypt(row.value_encrypted),
        };
      }
      return row;
    });
  }

  /**
   * Delete a setting
   */
  static async delete(key: string): Promise<void> {
    await pool.query('DELETE FROM paas_settings WHERE key = $1', [key]);
  }

  /**
   * Check if PaaS is configured
   */
  static async isConfigured(): Promise<boolean> {
    const storageType = await this.get('storage_type');
    const swarmInitialized = await this.get('swarm_initialized');

    return !!storageType && !!swarmInitialized;
  }

  /**
   * Get storage configuration
   */
  static async getStorageConfig(): Promise<{
    type: 's3' | 'local';
    s3?: {
      bucket: string;
      region: string;
      accessKey: string;
      secretKey: string;
      endpoint?: string;
    };
    local?: {
      path: string;
    };
  }> {
    const storageType = (await this.get('storage_type')) as 's3' | 'local';

    if (storageType === 's3') {
      return {
        type: 's3',
        s3: {
          bucket: (await this.get('s3_bucket')) as string,
          region: (await this.get('s3_region')) as string,
          accessKey: (await this.get('s3_access_key')) as string,
          secretKey: (await this.get('s3_secret_key')) as string,
          endpoint: (await this.get('s3_endpoint')) as string | undefined,
        },
      };
    }

    return {
      type: 'local',
      local: {
        path: ((await this.get('local_storage_path')) as string) || '/var/paas/storage',
      },
    };
  }

  /**
   * Get Swarm configuration
   */
  static async getSwarmConfig(): Promise<{
    initialized: boolean;
    managerIp?: string;
    workerToken?: string;
    managerToken?: string;
  }> {
    return {
      initialized: (await this.get('swarm_initialized')) as boolean,
      managerIp: (await this.get('swarm_manager_ip')) as string,
      workerToken: (await this.get('swarm_join_token_worker')) as string,
      managerToken: (await this.get('swarm_join_token_manager')) as string,
    };
  }

  /**
   * Get Loki configuration
   */
  static async getLokiConfig(): Promise<{
    endpoint?: string;
    retentionDays?: number;
  }> {
    return {
      endpoint: (await this.get('loki_endpoint')) as string,
      retentionDays: (await this.get('loki_retention_days')) as number,
    };
  }
}
