import { query } from '../../lib/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

export interface PaaSEnvironmentVar {
  id: number;
  application_id: number;
  key: string;
  value: string;
  created_at: Date;
}

export class EnvironmentService {
  async getByApplicationId(applicationId: number): Promise<PaaSEnvironmentVar[]> {
    const result = await query(
      'SELECT id, application_id, key, value, created_at FROM paas_environment_vars WHERE application_id = $1 ORDER BY key',
      [applicationId]
    );
    
    return result.rows.map(row => ({
      ...row,
      value: decrypt(row.value)
    }));
  }

  async getDecryptedMap(applicationId: number): Promise<Record<string, string>> {
    const vars = await this.getByApplicationId(applicationId);
    const map: Record<string, string> = {};
    
    for (const envVar of vars) {
      map[envVar.key] = envVar.value;
    }
    
    return map;
  }

  async set(applicationId: number, key: string, value: string): Promise<PaaSEnvironmentVar> {
    const encryptedValue = encrypt(value);
    
    const result = await query(
      `INSERT INTO paas_environment_vars (application_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (application_id, key) 
       DO UPDATE SET value = $3
       RETURNING id, application_id, key, value, created_at`,
      [applicationId, key, encryptedValue]
    );

    return {
      ...result.rows[0],
      value: decrypt(result.rows[0].value)
    };
  }

  async delete(applicationId: number, key: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_environment_vars WHERE application_id = $1 AND key = $2',
      [applicationId, key]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAll(applicationId: number): Promise<number> {
    const result = await query(
      'DELETE FROM paas_environment_vars WHERE application_id = $1',
      [applicationId]
    );
    return result.rowCount ?? 0;
  }

  async bulkSet(applicationId: number, vars: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(vars)) {
      await this.set(applicationId, key, value);
    }
  }

  validateKey(key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'Key cannot be empty' };
    }

    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      return { valid: false, error: 'Key must start with a letter or underscore and contain only uppercase letters, numbers, and underscores' };
    }

    if (key.length > 255) {
      return { valid: false, error: 'Key must be 255 characters or less' };
    }

    return { valid: true };
  }
}

export const environmentService = new EnvironmentService();
