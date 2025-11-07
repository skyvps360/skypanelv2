/**
 * PaaS Plan Service
 * Manages App Hosting Plans with resource limits and pricing
 */

import { query } from '../../lib/database.js';

export interface PaaSPlan {
  id: number;
  name: string;
  cpu_limit: number;        // CPU millicores
  memory_limit: number;     // RAM in MB
  storage_limit: number;    // Disk in MB
  monthly_price: number;
  hourly_rate: number;
  supported_runtimes: number[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePlanData {
  name: string;
  cpu_limit: number;
  memory_limit: number;
  storage_limit: number;
  monthly_price: number;
  hourly_rate: number;
  supported_runtimes?: number[];
}

export interface UpdatePlanData {
  name?: string;
  cpu_limit?: number;
  memory_limit?: number;
  storage_limit?: number;
  monthly_price?: number;
  hourly_rate?: number;
  supported_runtimes?: number[];
  is_active?: boolean;
}

export class PlanService {
  /**
   * Get all PaaS plans
   */
  static async getAllPlans(activeOnly = false): Promise<PaaSPlan[]> {
    const sql = activeOnly
      ? 'SELECT * FROM paas_plans WHERE is_active = true ORDER BY monthly_price ASC'
      : 'SELECT * FROM paas_plans ORDER BY monthly_price ASC';
    
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Get a single plan by ID
   */
  static async getPlanById(id: number): Promise<PaaSPlan | null> {
    const result = await query(
      'SELECT * FROM paas_plans WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new plan
   */
  static async createPlan(data: CreatePlanData): Promise<PaaSPlan> {
    const result = await query(
      `INSERT INTO paas_plans 
       (name, cpu_limit, memory_limit, storage_limit, monthly_price, hourly_rate, supported_runtimes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name,
        data.cpu_limit,
        data.memory_limit,
        data.storage_limit,
        data.monthly_price,
        data.hourly_rate,
        JSON.stringify(data.supported_runtimes || [])
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a plan
   */
  static async updatePlan(id: number, data: UpdatePlanData): Promise<PaaSPlan | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.cpu_limit !== undefined) {
      updates.push(`cpu_limit = $${paramCount++}`);
      values.push(data.cpu_limit);
    }
    if (data.memory_limit !== undefined) {
      updates.push(`memory_limit = $${paramCount++}`);
      values.push(data.memory_limit);
    }
    if (data.storage_limit !== undefined) {
      updates.push(`storage_limit = $${paramCount++}`);
      values.push(data.storage_limit);
    }
    if (data.monthly_price !== undefined) {
      updates.push(`monthly_price = $${paramCount++}`);
      values.push(data.monthly_price);
    }
    if (data.hourly_rate !== undefined) {
      updates.push(`hourly_rate = $${paramCount++}`);
      values.push(data.hourly_rate);
    }
    if (data.supported_runtimes !== undefined) {
      updates.push(`supported_runtimes = $${paramCount++}`);
      values.push(JSON.stringify(data.supported_runtimes));
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return this.getPlanById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_plans SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a plan
   */
  static async deletePlan(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_plans WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if a plan is in use
   */
  static async isPlanInUse(id: number): Promise<boolean> {
    const appResult = await query(
      'SELECT COUNT(*) as count FROM paas_applications WHERE plan_id = $1',
      [id]
    );
    const dbResult = await query(
      'SELECT COUNT(*) as count FROM paas_databases WHERE plan_id = $1',
      [id]
    );
    
    const appCount = parseInt(appResult.rows[0]?.count || '0');
    const dbCount = parseInt(dbResult.rows[0]?.count || '0');
    
    return (appCount + dbCount) > 0;
  }
}
