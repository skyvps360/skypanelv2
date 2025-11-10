/**
 * PaaS Environment Variable Service
 * Handles validation, encryption, import/export, and runtime retrieval.
 */

import crypto from 'crypto';
import { pool, PaasApplication } from '../../lib/database.js';
import { config } from '../../config/index.js';

const RESERVED_KEYS = ['PORT', 'DYNO', 'PS'];
const SYSTEM_KEYS = RESERVED_KEYS;
const MAX_VALUE_LENGTH = 16 * 1024; // 16KB per variable

const ENC_PREFIX = 'ENC::';

export class PaasEnvironmentService {
  /**
   * List environment variables (metadata only)
   */
  static async list(appId: string): Promise<Array<{ id: string; key: string; is_system: boolean; created_at: string }>> {
    const result = await pool.query(
      `SELECT id, key, is_system, created_at
         FROM paas_environment_vars
        WHERE application_id = $1
        ORDER BY key`,
      [appId]
    );
    return result.rows;
  }

  /**
   * Upsert variables (encrypting values per org)
   */
  static async upsertMany(appId: string, orgId: string, vars: Record<string, string>): Promise<string[]> {
    if (!vars || Object.keys(vars).length === 0) {
      return [];
    }

    const updatedKeys: string[] = [];

    for (const [rawKey, rawValue] of Object.entries(vars)) {
      const key = this.normalizeKey(rawKey);
      this.assertKeyAllowed(key);
      const ciphertext = this.prepareValue(orgId, rawValue);

      await pool.query(
        `INSERT INTO paas_environment_vars (application_id, key, value_encrypted, is_system)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (application_id, key) DO UPDATE SET
           value_encrypted = EXCLUDED.value_encrypted,
           updated_at = NOW()`,
        [appId, key, ciphertext]
      );
      updatedKeys.push(key);
    }

    return updatedKeys;
  }

  /**
   * Delete an environment variable (non-system)
   */
  static async delete(appId: string, key: string): Promise<boolean> {
    const normalized = this.normalizeKey(key);
    if (SYSTEM_KEYS.includes(normalized)) {
      throw new Error('System variables cannot be deleted');
    }

    const result = await pool.query(
      `DELETE FROM paas_environment_vars
        WHERE application_id = $1 AND key = $2 AND is_system = FALSE`,
      [appId, normalized]
    );

    return result.rowCount > 0;
  }

  /**
   * Retrieve decrypted env vars for runtime injection
   */
  static async getRuntimeEnv(appId: string): Promise<Record<string, string>> {
    const { orgId } = await this.getApplicationOrg(appId);
    const result = await pool.query(
      `SELECT key, value_encrypted
         FROM paas_environment_vars
        WHERE application_id = $1`,
      [appId]
    );

    const env: Record<string, string> = {};
    for (const row of result.rows) {
      env[row.key] = this.decryptValue(orgId, row.value_encrypted);
    }
    return env;
  }

  /**
   * Export environment variables (encrypted payloads)
   */
  static async export(appId: string): Promise<string> {
    const rows = await pool.query(
      `SELECT key, value_encrypted
         FROM paas_environment_vars
        WHERE application_id = $1 AND is_system = FALSE
        ORDER BY key`,
      [appId]
    );

    return rows.rows
      .map((row) => `${row.key}=${ENC_PREFIX}${row.value_encrypted}`)
      .join('\n');
  }

  /**
   * Parse .env style input
   */
  static parseEnv(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!content) return result;

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1);

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
    return result;
  }

  /**
   * Normalize key
   */
  private static normalizeKey(key: string): string {
    if (!key) {
      throw new Error('Environment variable key is required');
    }
    const normalized = key.trim().toUpperCase();
    if (!/^[A-Z0-9_]+$/.test(normalized)) {
      throw new Error('Environment variable keys must match [A-Z0-9_]+');
    }
    if (normalized.length > 64) {
      throw new Error('Environment variable keys must be 64 characters or fewer');
    }
    return normalized;
  }

  private static assertKeyAllowed(key: string): void {
    if (SYSTEM_KEYS.includes(key)) {
      throw new Error(`"${key}" is reserved and cannot be modified`);
    }
  }

  private static prepareValue(orgId: string, raw: string): string {
    if (typeof raw !== 'string') {
      throw new Error('Environment variable value must be a string');
    }
    if (raw.length === 0) {
      throw new Error('Environment variable value cannot be empty');
    }
    if (raw.length > MAX_VALUE_LENGTH) {
      throw new Error(`Environment variable value exceeds ${MAX_VALUE_LENGTH} characters`);
    }

    if (raw.startsWith(ENC_PREFIX)) {
      const payload = raw.slice(ENC_PREFIX.length).trim();
      if (!payload) {
        throw new Error('Encrypted environment variable payload missing');
      }
      return payload;
    }

    return this.encryptValue(orgId, raw);
  }

  private static encryptValue(orgId: string, value: string): string {
    const key = this.deriveKey(orgId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.from(
      JSON.stringify({
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      }),
      'utf8'
    ).toString('base64');
  }

  private static decryptValue(orgId: string, payloadB64: string): string {
    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const key = this.deriveKey(orgId);
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private static deriveKey(orgId: string): Buffer {
    const master = config.SSH_CRED_SECRET;
    if (!master || master.length < 32) {
      throw new Error('Encryption master key (SSH_CRED_SECRET) is not configured');
    }
    return crypto.createHmac('sha256', master).update(orgId).digest();
  }

  private static async getApplicationOrg(appId: string): Promise<{ app: PaasApplication; orgId: string }> {
    const result = await pool.query<PaasApplication>(
      'SELECT id, organization_id FROM paas_applications WHERE id = $1',
      [appId]
    );

    if (result.rows.length === 0) {
      throw new Error('Application not found');
    }

    return { app: result.rows[0], orgId: result.rows[0].organization_id as unknown as string };
  }
}
