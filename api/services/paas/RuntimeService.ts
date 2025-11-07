/**
 * PaaS Runtime Service
 * Manages available runtime environments and build configurations
 */

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

export interface CreateRuntimeData {
  name: string;
  runtime_type: 'node' | 'python' | 'php' | 'docker';
  version: string;
  base_image: string;
  default_build_cmd?: string;
  default_start_cmd?: string;
}

export interface UpdateRuntimeData {
  name?: string;
  version?: string;
  base_image?: string;
  default_build_cmd?: string;
  default_start_cmd?: string;
  is_active?: boolean;
}

export class RuntimeService {
  /**
   * Get all runtimes
   */
  static async getAllRuntimes(activeOnly = false): Promise<PaaSRuntime[]> {
    const sql = activeOnly
      ? 'SELECT * FROM paas_runtimes WHERE is_active = true ORDER BY runtime_type, version DESC'
      : 'SELECT * FROM paas_runtimes ORDER BY runtime_type, version DESC';
    
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Get a single runtime by ID
   */
  static async getRuntimeById(id: number): Promise<PaaSRuntime | null> {
    const result = await query(
      'SELECT * FROM paas_runtimes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get runtimes by type
   */
  static async getRuntimesByType(type: string): Promise<PaaSRuntime[]> {
    const result = await query(
      'SELECT * FROM paas_runtimes WHERE runtime_type = $1 AND is_active = true ORDER BY version DESC',
      [type]
    );
    return result.rows;
  }

  /**
   * Create a new runtime
   */
  static async createRuntime(data: CreateRuntimeData): Promise<PaaSRuntime> {
    const result = await query(
      `INSERT INTO paas_runtimes 
       (name, runtime_type, version, base_image, default_build_cmd, default_start_cmd)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.runtime_type,
        data.version,
        data.base_image,
        data.default_build_cmd || null,
        data.default_start_cmd || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a runtime
   */
  static async updateRuntime(id: number, data: UpdateRuntimeData): Promise<PaaSRuntime | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.version !== undefined) {
      updates.push(`version = $${paramCount++}`);
      values.push(data.version);
    }
    if (data.base_image !== undefined) {
      updates.push(`base_image = $${paramCount++}`);
      values.push(data.base_image);
    }
    if (data.default_build_cmd !== undefined) {
      updates.push(`default_build_cmd = $${paramCount++}`);
      values.push(data.default_build_cmd);
    }
    if (data.default_start_cmd !== undefined) {
      updates.push(`default_start_cmd = $${paramCount++}`);
      values.push(data.default_start_cmd);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return this.getRuntimeById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_runtimes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a runtime
   */
  static async deleteRuntime(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_runtimes WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if a runtime is in use
   */
  static async isRuntimeInUse(id: number): Promise<boolean> {
    const result = await query(
      'SELECT COUNT(*) as count FROM paas_applications WHERE runtime_id = $1',
      [id]
    );
    const count = parseInt(result.rows[0]?.count || '0');
    return count > 0;
  }
}
