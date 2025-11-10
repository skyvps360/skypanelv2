/**
 * PaaS Settings Service
 * Manages all PaaS configuration settings stored in database (zero .env approach)
 */

import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { pool, PaasSettings } from '../../lib/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

type SettingValueType = 'string' | 'number' | 'boolean' | 'json';

interface SettingDefinition {
  key: string;
  type: SettingValueType;
  category: string;
  description?: string;
  sensitive?: boolean;
  defaultValue?: string | number | boolean | object;
  allowedValues?: Array<string | number | boolean>;
  required?: boolean;
  allowEmpty?: boolean;
  validate?: (value: any) => Promise<void> | void;
}

interface SettingWriteOptions {
  description?: string;
  category?: string;
  is_sensitive?: boolean;
  skipValidation?: boolean;
}

const SENSITIVE_PLACEHOLDER = '***REDACTED***';
const DOMAIN_REGEX = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;
const S3_VALIDATION_KEYS = new Set([
  'storage_type',
  's3_bucket',
  's3_region',
  's3_access_key',
  's3_secret_key',
  's3_endpoint',
]);
const PRESERVE_WHITESPACE_KEYS = new Set(['git_ssh_private_key', 'git_known_hosts']);

const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  storage_type: {
    key: 'storage_type',
    type: 'string',
    category: 'storage',
    description: 'Storage backend: s3 or local',
    allowedValues: ['local', 's3'],
    defaultValue: 'local',
    required: true,
  },
  local_storage_path: {
    key: 'local_storage_path',
    type: 'string',
    category: 'storage',
    description: 'Local filesystem path for builds',
    defaultValue: '/var/paas/storage',
    required: true,
  },
  s3_bucket: {
    key: 's3_bucket',
    type: 'string',
    category: 'storage',
    description: 'S3 bucket name for build artifacts',
  },
  s3_region: {
    key: 's3_region',
    type: 'string',
    category: 'storage',
    description: 'S3 region identifier',
  },
  s3_access_key: {
    key: 's3_access_key',
    type: 'string',
    category: 'storage',
    description: 'S3 access key ID',
    sensitive: true,
  },
  s3_secret_key: {
    key: 's3_secret_key',
    type: 'string',
    category: 'storage',
    description: 'S3 secret access key',
    sensitive: true,
  },
  s3_endpoint: {
    key: 's3_endpoint',
    type: 'string',
    category: 'storage',
    description: 'Custom S3 endpoint (for MinIO/B2/etc.)',
    allowEmpty: true,
  },
  loki_endpoint: {
    key: 'loki_endpoint',
    type: 'string',
    category: 'logging',
    description: 'Grafana Loki endpoint URL',
    defaultValue: 'http://localhost:3100',
    required: true,
    validate: (value: string) => {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error();
        }
      } catch {
        throw new Error('loki_endpoint must be a valid HTTP/HTTPS URL');
      }
    },
  },
  loki_retention_days: {
    key: 'loki_retention_days',
    type: 'number',
    category: 'logging',
    description: 'Log retention period in days',
    defaultValue: 7,
    validate: (value: number) => {
      if (value !== null && value !== undefined && value <= 0) {
        throw new Error('loki_retention_days must be greater than zero');
      }
    },
  traefik_acme_email: {
    key: 'traefik_acme_email',
    type: 'string',
    category: 'networking',
    description: "Email address used for Traefik's Let's Encrypt account",
    defaultValue: 'admin@example.com',
    validate: (value: string) => {
      if (!/.+@.+\..+/.test(value)) {
        throw new Error('traefik_acme_email must be a valid email address');
      }
    },
  },
  grafana_admin_user: {
    key: 'grafana_admin_user',
    type: 'string',
    category: 'monitoring',
    description: 'Grafana admin username',
    defaultValue: 'admin',
  },
  grafana_admin_password: {
    key: 'grafana_admin_password',
    type: 'string',
    category: 'monitoring',
    description: 'Grafana admin password used for the infrastructure dashboard',
    sensitive: true,
  },
  },
  default_domain: {
    key: 'default_domain',
    type: 'string',
    category: 'general',
    description: 'Default domain for generated subdomains',
    defaultValue: 'apps.example.com',
    required: true,
    validate: (value: string) => {
      if (value && !DOMAIN_REGEX.test(value)) {
        throw new Error('default_domain must be a valid hostname (no protocol or slashes)');
      }
    },
  },
  git_auth_type: {
    key: 'git_auth_type',
    type: 'string',
    category: 'git',
    description: 'Git authentication strategy',
    defaultValue: 'none',
    allowedValues: ['none', 'https', 'ssh'],
  },
  git_access_username: {
    key: 'git_access_username',
    type: 'string',
    category: 'git',
    description: 'Git username for HTTPS token auth',
  },
  git_access_token: {
    key: 'git_access_token',
    type: 'string',
    category: 'git',
    description: 'Git personal access token',
    sensitive: true,
  },
  git_ssh_private_key: {
    key: 'git_ssh_private_key',
    type: 'string',
    category: 'git',
    description: 'SSH key for git deploys',
    sensitive: true,
  },
  git_known_hosts: {
    key: 'git_known_hosts',
    type: 'string',
    category: 'git',
    description: 'Known hosts entries for SSH git connections',
  },
  buildpack_default_stack: {
    key: 'buildpack_default_stack',
    type: 'string',
    category: 'buildpack',
    description: 'Default buildpack stack',
    defaultValue: 'heroku-22',
  },
  buildpack_cache_enabled: {
    key: 'buildpack_cache_enabled',
    type: 'boolean',
    category: 'buildpack',
    description: 'Enable buildpack layer caching',
    defaultValue: false,
  },
  max_apps_per_org: {
    key: 'max_apps_per_org',
    type: 'number',
    category: 'limits',
    description: 'Maximum applications per organization (0 = unlimited)',
    defaultValue: 0,
  },
  max_deployments_per_hour: {
    key: 'max_deployments_per_hour',
    type: 'number',
    category: 'limits',
    description: 'Rate limit for deployments per app',
    defaultValue: 5,
  },
  swarm_initialized: {
    key: 'swarm_initialized',
    type: 'boolean',
    category: 'swarm',
    description: 'Whether the Docker Swarm cluster has been initialized',
    defaultValue: false,
  },
  swarm_manager_ip: {
    key: 'swarm_manager_ip',
    type: 'string',
    category: 'swarm',
    description: 'Docker Swarm manager IP address',
  },
  swarm_join_token_worker: {
    key: 'swarm_join_token_worker',
    type: 'string',
    category: 'swarm',
    description: 'Swarm worker join token',
    sensitive: true,
  },
  swarm_join_token_manager: {
    key: 'swarm_join_token_manager',
    type: 'string',
    category: 'swarm',
    description: 'Swarm manager join token',
    sensitive: true,
  },
  registry_url: {
    key: 'registry_url',
    type: 'string',
    category: 'registry',
    description: 'Docker registry URL for images',
  },
  registry_username: {
    key: 'registry_username',
    type: 'string',
    category: 'registry',
    description: 'Registry username',
  },
  registry_password: {
    key: 'registry_password',
    type: 'string',
    category: 'registry',
    description: 'Registry password',
    sensitive: true,
  },
};

export class PaasSettingsService {
  /**
   * Ensure all defaults exist in the database
   */
  static async initializeDefaults(): Promise<void> {
    const defaults = Object.values(SETTING_DEFINITIONS).filter(
      (definition) => definition.defaultValue !== undefined
    );

    if (defaults.length === 0) {
      return;
    }

    const keys = defaults.map((d) => d.key);
    const existing = await pool.query<{ key: string }>(
      'SELECT key FROM paas_settings WHERE key = ANY($1)',
      [keys]
    );
    const existingKeys = new Set(existing.rows.map((row) => row.key));

    for (const definition of defaults) {
      if (existingKeys.has(definition.key)) {
        continue;
      }

      await this.set(
        definition.key,
        definition.defaultValue as any,
        {
          category: definition.category,
          description: definition.description,
          skipValidation: true,
        }
      );
    }
  }

  /**
   * Get a setting value by key
   */
  static async get(key: string): Promise<string | number | boolean | object | null> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      const definition = SETTING_DEFINITIONS[key];
      return definition?.defaultValue ?? null;
    }

    return this.parseSettingRow(result.rows[0]);
  }

  /**
   * Set a setting value
   */
  static async set(
    key: string,
    value: string | number | boolean | object,
    options?: SettingWriteOptions
  ): Promise<void> {
    await this.updateSettings({ [key]: value }, options ? { [key]: options } : undefined);
  }

  /**
   * Update multiple settings in one validation pass
   */
  static async updateSettings(
    updates: Record<string, any>,
    optionsMap: Record<string, SettingWriteOptions> = {}
  ): Promise<void> {
    const sanitizedEntries = Object.entries(updates).filter(
      ([, value]) => value !== undefined
    );

    if (sanitizedEntries.length === 0) {
      return;
    }

    const currentState = await this.getSettingsMap();
    const normalizedUpdates: Record<string, any> = {};
    const validatedKeys: string[] = [];

    for (const [key, rawValue] of sanitizedEntries) {
      const definition = SETTING_DEFINITIONS[key];
      const normalized = this.normalizeValue(rawValue, definition);
      const skipValidation = Boolean(optionsMap[key]?.skipValidation);

      if (!skipValidation) {
        await this.validateSettingValue(key, normalized, definition);
      }

      normalizedUpdates[key] = normalized;
      currentState[key] = normalized;

      if (!skipValidation) {
        validatedKeys.push(key);
      }
    }

    if (validatedKeys.length > 0) {
      await this.validateCompositeSettings(currentState, validatedKeys);
    }

    for (const [key, value] of Object.entries(normalizedUpdates)) {
      await this.persistSetting(key, value, optionsMap[key]);
    }
  }

  /**
   * Run connectivity diagnostics for critical services
   */
  static async runDiagnostics(): Promise<{
    storage: { ok: boolean; details?: string };
    logging: { ok: boolean; details?: string };
  }> {
    const state = await this.getSettingsMap();
    const result = {
      storage: { ok: true, details: '' },
      logging: { ok: true, details: '' },
    };

    if (state.storage_type === 's3') {
      try {
        await this.validateS3Configuration(state);
        result.storage.details = 'S3 credentials verified';
      } catch (error: any) {
        result.storage.ok = false;
        result.storage.details = error?.message || 'Failed to validate S3 configuration';
      }
    } else {
      result.storage.details = 'Local storage backend configured';
    }

    try {
      await this.validateLokiConnectivity(state.loki_endpoint);
      result.logging.details = 'Loki endpoint responded successfully';
    } catch (error: any) {
      result.logging.ok = false;
      result.logging.details = error?.message || 'Failed to reach Loki endpoint';
    }

    return result;
  }

  /**
   * Get all settings in a category (parsed)
   */
  static async getByCategory(category: string): Promise<Record<string, any>> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings WHERE category = $1',
      [category]
    );

    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      settings[row.key] = this.parseSettingRow(row);
    }
    return settings;
  }

  /**
   * Get all settings (raw rows for admin API)
   */
  static async getAll(includeSensitive: boolean = false): Promise<PaasSettings[]> {
    const result = await pool.query<PaasSettings>(
      'SELECT * FROM paas_settings ORDER BY category ASC, key ASC'
    );

    if (!includeSensitive) {
      return result.rows.map((row) => ({
        ...row,
        value_encrypted: row.is_sensitive ? SENSITIVE_PLACEHOLDER : row.value_encrypted,
      }));
    }

    return result.rows.map((row) => {
      if (row.is_sensitive && row.value_encrypted) {
        try {
          return {
            ...row,
            value_encrypted: decrypt(row.value_encrypted),
          };
        } catch (error) {
          console.error(`Failed to decrypt sensitive setting ${row.key}:`, error);
          return {
            ...row,
            value_encrypted: null,
          };
        }
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
    const storageType = ((await this.get('storage_type')) as 's3' | 'local') || 'local';

    if (storageType === 's3') {
      return {
        type: 's3',
        s3: {
          bucket: ((await this.get('s3_bucket')) as string) || '',
          region: ((await this.get('s3_region')) as string) || '',
          accessKey: ((await this.get('s3_access_key')) as string) || '',
          secretKey: ((await this.get('s3_secret_key')) as string) || '',
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
      initialized: Boolean(await this.get('swarm_initialized')),
      managerIp: (await this.get('swarm_manager_ip')) as string,
      workerToken: (await this.get('swarm_join_token_worker')) as string,
      managerToken: (await this.get('swarm_join_token_manager')) as string,
    };
  }

  /**
   * Get git authentication configuration
   */
  static async getGitConfig(): Promise<{
    authType: 'none' | 'https' | 'ssh';
    token?: string;
    username?: string;
    sshPrivateKey?: string;
    knownHosts?: string;
  }> {
    const authTypeRaw = ((await this.get('git_auth_type')) as string) || 'none';
    const authType: 'none' | 'https' | 'ssh' =
      authTypeRaw === 'https' || authTypeRaw === 'ssh' ? authTypeRaw : 'none';

    return {
      authType,
      token: (await this.get('git_access_token')) as string | undefined,
      username: (await this.get('git_access_username')) as string | undefined,
      sshPrivateKey: (await this.get('git_ssh_private_key')) as string | undefined,
      knownHosts: (await this.get('git_known_hosts')) as string | undefined,
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

  /**
   * Build an in-memory map of current settings
   */
  private static async getSettingsMap(): Promise<Record<string, any>> {
    const result = await pool.query<PaasSettings>('SELECT * FROM paas_settings');
    const map: Record<string, any> = {};

    for (const row of result.rows) {
      map[row.key] = this.parseSettingRow(row);
    }

    for (const definition of Object.values(SETTING_DEFINITIONS)) {
      if (!(definition.key in map) && definition.defaultValue !== undefined) {
        map[definition.key] = definition.defaultValue;
      }
    }

    return map;
  }

  /**
   * Parse a row value (handles decryption + JSON parsing)
   */
  private static parseSettingRow(row: PaasSettings): any {
    if (row.value_encrypted === null || row.value_encrypted === undefined) {
      return null;
    }

    let value: string = row.value_encrypted;
    if (row.is_sensitive && value) {
      try {
        value = decrypt(value);
      } catch (error) {
        console.error(`Failed to decrypt setting ${row.key}:`, error);
        throw new Error(`Failed to decrypt setting "${row.key}"`);
      }
    }

    switch (row.value_type) {
      case 'number':
        return value === '' ? null : parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        return value ? JSON.parse(value) : null;
      default:
        return value;
    }
  }

  /**
   * Normalize a value according to the definition
   */
  private static normalizeValue(value: any, definition?: SettingDefinition): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' && definition?.allowEmpty !== true) {
        return null;
      }
      const preserveWhitespace = definition?.key && PRESERVE_WHITESPACE_KEYS.has(definition.key);
      value = preserveWhitespace || definition?.type === 'json' ? value : trimmed;
    }

    const targetType = definition?.type;

    switch (targetType) {
      case 'number': {
        if (value === null || value === '') return null;
        if (typeof value === 'number') return value;
        const asNumber = Number(value);
        if (Number.isNaN(asNumber)) {
          throw new Error(`Setting "${definition?.key ?? 'unknown'}" must be a numeric value`);
        }
        return asNumber;
      }
      case 'boolean': {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
          if (['false', '0', 'no', 'off'].includes(lowered)) return false;
        }
        throw new Error(`Setting "${definition?.key ?? 'unknown'}" must be a boolean value`);
      }
      case 'json': {
        if (typeof value === 'object') {
          return value;
        }
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            throw new Error(`Setting "${definition?.key ?? 'unknown'}" must be valid JSON`);
          }
        }
        return value;
      }
      default:
        return value;
    }
  }

  /**
   * Validate individual setting value
   */
  private static async validateSettingValue(
    key: string,
    value: any,
    definition?: SettingDefinition
  ): Promise<void> {
    if (!definition) {
      return;
    }

    if ((value === null || value === undefined) && definition.required) {
      throw new Error(`Setting "${key}" is required`);
    }

    if (
      value !== null &&
      value !== undefined &&
      definition.allowedValues &&
      !definition.allowedValues.includes(value)
    ) {
      throw new Error(
        `Setting "${key}" must be one of: ${definition.allowedValues.join(', ')}`
      );
    }

    if (definition.validate && value !== null && value !== undefined) {
      await definition.validate(value);
    }
  }

  /**
   * Validate cross-setting constraints (S3/Loki/local storage)
   */
  private static async validateCompositeSettings(
    state: Record<string, any>,
    changedKeys: string[]
  ): Promise<void> {
    const changedKeySet = new Set(changedKeys);

    if (
      state.storage_type === 's3' &&
      Array.from(S3_VALIDATION_KEYS).some((key) => changedKeySet.has(key))
    ) {
      await this.validateS3Configuration(state);
    }

    if (state.storage_type === 'local' && changedKeySet.has('local_storage_path')) {
      if (!state.local_storage_path) {
        throw new Error('Local storage requires local_storage_path to be set');
      }
    }

    if (changedKeySet.has('storage_type') && state.storage_type === 'local') {
      if (!state.local_storage_path) {
        throw new Error('Local storage requires local_storage_path to be set');
      }
    }

    if (changedKeySet.has('loki_endpoint')) {
      await this.validateLokiConnectivity(state.loki_endpoint);
    }
  }

  /**
   * Persist a single setting (handles encryption + metadata)
   */
  private static async persistSetting(
    key: string,
    value: any,
    options?: SettingWriteOptions
  ): Promise<void> {
    const definition = SETTING_DEFINITIONS[key];
    const resolvedType: SettingValueType =
      definition?.type ?? this.detectValueType(value);
    const resolvedCategory = options?.category ?? definition?.category ?? 'general';
    const resolvedDescription = options?.description ?? definition?.description ?? null;
    const isSensitive =
      options?.is_sensitive ??
      definition?.sensitive ??
      this.isSensitiveKey(key);

    const valueString = this.serializeValue(value, resolvedType);
    let toStore = valueString;

    if (isSensitive && valueString) {
      try {
        toStore = encrypt(valueString);
      } catch (error) {
        console.error(`Failed to encrypt setting ${key}:`, error);
        throw new Error(`Failed to encrypt setting "${key}"`);
      }
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
        toStore,
        resolvedType,
        resolvedDescription,
        isSensitive,
        resolvedCategory,
      ]
    );
  }

  /**
   * Serialize value to string for persistence
   */
  private static serializeValue(value: any, type: SettingValueType): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'number':
        return value.toString();
      case 'boolean':
        return value ? 'true' : 'false';
      case 'json':
        return JSON.stringify(value);
      default:
        return value;
    }
  }

  /**
   * Guess value type when no definition exists
   */
  private static detectValueType(value: any): SettingValueType {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object' && value !== null) return 'json';
    return 'string';
  }

  /**
   * Determine if key should be treated as sensitive automatically
   */
  private static isSensitiveKey(key: string): boolean {
    const lowered = key.toLowerCase();
    return (
      lowered.includes('secret') ||
      lowered.includes('token') ||
      lowered.includes('password') ||
      lowered.includes('key')
    );
  }

  /**
   * Validate that full S3 configuration is usable
   */
  private static async validateS3Configuration(state: Record<string, any>): Promise<void> {
    const bucket = state.s3_bucket;
    const region = state.s3_region;
    const accessKeyId = state.s3_access_key;
    const secretAccessKey = state.s3_secret_key;

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 storage requires bucket, region, access key, and secret key to be configured'
      );
    }

    await this.validateS3Connectivity({
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint: state.s3_endpoint,
    });
  }

  /**
   * Attempt to connect to S3 using provided credentials
   */
  private static async validateS3Connectivity(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }): Promise<void> {
    try {
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint || undefined,
        forcePathStyle: Boolean(config.endpoint && !config.endpoint.includes('amazonaws.com')),
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch (error: any) {
      throw new Error(
        `Failed to validate S3 credentials (${error?.name || 'Unknown'}: ${
          error?.message || error
        })`
      );
    }
  }

  /**
   * Validate Loki endpoint connectivity
   */
  private static async validateLokiConnectivity(endpoint: string): Promise<void> {
    if (!endpoint) {
      throw new Error('loki_endpoint is required');
    }

    try {
      const baseUrl = new URL(endpoint);
      const healthUrl = new URL('/ready', baseUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`received HTTP ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(
        `Failed to reach Loki at ${endpoint}: ${error?.message || error}`
      );
    }
  }
}
