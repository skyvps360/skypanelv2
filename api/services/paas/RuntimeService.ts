import { query } from '../../lib/database.js';

export interface PaaSRuntime {
  id: number;
  name: string;
  runtime_type: 'node' | 'python' | 'php' | 'docker';
  version: string;
  base_image: string;
  default_build_cmd: string | null;
  default_start_cmd: string | null;
  is_active: boolean;
  created_at: Date;
}

export class RuntimeService {
  async getAll(includeInactive = false): Promise<PaaSRuntime[]> {
    const sql = includeInactive
      ? 'SELECT * FROM paas_runtimes ORDER BY runtime_type, version DESC'
      : 'SELECT * FROM paas_runtimes WHERE is_active = true ORDER BY runtime_type, version DESC';
    
    const result = await query(sql);
    return result.rows;
  }

  async getById(id: number): Promise<PaaSRuntime | null> {
    const result = await query(
      'SELECT * FROM paas_runtimes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getByType(type: string): Promise<PaaSRuntime[]> {
    const result = await query(
      'SELECT * FROM paas_runtimes WHERE runtime_type = $1 AND is_active = true ORDER BY version DESC',
      [type]
    );
    return result.rows;
  }

  async create(runtime: Omit<PaaSRuntime, 'id' | 'created_at'>): Promise<PaaSRuntime> {
    const result = await query(
      `INSERT INTO paas_runtimes 
       (name, runtime_type, version, base_image, default_build_cmd, default_start_cmd, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        runtime.name,
        runtime.runtime_type,
        runtime.version,
        runtime.base_image,
        runtime.default_build_cmd,
        runtime.default_start_cmd,
        runtime.is_active
      ]
    );
    return result.rows[0];
  }

  async update(id: number, runtime: Partial<Omit<PaaSRuntime, 'id' | 'created_at'>>): Promise<PaaSRuntime | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (runtime.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(runtime.name);
    }
    if (runtime.runtime_type !== undefined) {
      fields.push(`runtime_type = $${paramCount++}`);
      values.push(runtime.runtime_type);
    }
    if (runtime.version !== undefined) {
      fields.push(`version = $${paramCount++}`);
      values.push(runtime.version);
    }
    if (runtime.base_image !== undefined) {
      fields.push(`base_image = $${paramCount++}`);
      values.push(runtime.base_image);
    }
    if (runtime.default_build_cmd !== undefined) {
      fields.push(`default_build_cmd = $${paramCount++}`);
      values.push(runtime.default_build_cmd);
    }
    if (runtime.default_start_cmd !== undefined) {
      fields.push(`default_start_cmd = $${paramCount++}`);
      values.push(runtime.default_start_cmd);
    }
    if (runtime.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(runtime.is_active);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_runtimes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_runtimes WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async validateRuntime(runtimeId: number): Promise<{ valid: boolean; runtime?: PaaSRuntime }> {
    const runtime = await this.getById(runtimeId);
    if (!runtime) {
      return { valid: false };
    }
    if (!runtime.is_active) {
      return { valid: false };
    }
    return { valid: true, runtime };
  }

  async validateDockerImage(image: string): Promise<{ valid: boolean; error?: string }> {
    const dockerImageRegex = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/i;
    
    if (!dockerImageRegex.test(image)) {
      return { valid: false, error: 'Invalid Docker image format' };
    }

    return { valid: true };
  }
}

export const runtimeService = new RuntimeService();
