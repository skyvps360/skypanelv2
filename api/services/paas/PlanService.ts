import { query, transaction } from '../../lib/database.js';

export interface PaaSPlan {
  id: number;
  name: string;
  cpu_limit: number;
  memory_limit: number;
  storage_limit: number;
  monthly_price: number;
  hourly_rate: number;
  supported_runtimes: number[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PlanService {
  async getAll(includeInactive = false): Promise<PaaSPlan[]> {
    const sql = includeInactive
      ? 'SELECT * FROM paas_plans ORDER BY monthly_price ASC'
      : 'SELECT * FROM paas_plans WHERE is_active = true ORDER BY monthly_price ASC';
    
    const result = await query(sql);
    return result.rows;
  }

  async getById(id: number): Promise<PaaSPlan | null> {
    const result = await query(
      'SELECT * FROM paas_plans WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(plan: Omit<PaaSPlan, 'id' | 'created_at' | 'updated_at'>): Promise<PaaSPlan> {
    const result = await query(
      `INSERT INTO paas_plans 
       (name, cpu_limit, memory_limit, storage_limit, monthly_price, hourly_rate, supported_runtimes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        plan.name,
        plan.cpu_limit,
        plan.memory_limit,
        plan.storage_limit,
        plan.monthly_price,
        plan.hourly_rate,
        JSON.stringify(plan.supported_runtimes),
        plan.is_active
      ]
    );
    return result.rows[0];
  }

  async update(id: number, plan: Partial<Omit<PaaSPlan, 'id' | 'created_at' | 'updated_at'>>): Promise<PaaSPlan | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (plan.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(plan.name);
    }
    if (plan.cpu_limit !== undefined) {
      fields.push(`cpu_limit = $${paramCount++}`);
      values.push(plan.cpu_limit);
    }
    if (plan.memory_limit !== undefined) {
      fields.push(`memory_limit = $${paramCount++}`);
      values.push(plan.memory_limit);
    }
    if (plan.storage_limit !== undefined) {
      fields.push(`storage_limit = $${paramCount++}`);
      values.push(plan.storage_limit);
    }
    if (plan.monthly_price !== undefined) {
      fields.push(`monthly_price = $${paramCount++}`);
      values.push(plan.monthly_price);
    }
    if (plan.hourly_rate !== undefined) {
      fields.push(`hourly_rate = $${paramCount++}`);
      values.push(plan.hourly_rate);
    }
    if (plan.supported_runtimes !== undefined) {
      fields.push(`supported_runtimes = $${paramCount++}`);
      values.push(JSON.stringify(plan.supported_runtimes));
    }
    if (plan.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(plan.is_active);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_plans WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async calculateHourlyRate(monthlyPrice: number): Promise<number> {
    const hoursPerMonth = 730;
    return Math.round((monthlyPrice / hoursPerMonth) * 10000) / 10000;
  }

  async validatePlan(planId: number): Promise<{ valid: boolean; plan?: PaaSPlan }> {
    const plan = await this.getById(planId);
    if (!plan) {
      return { valid: false };
    }
    if (!plan.is_active) {
      return { valid: false };
    }
    return { valid: true, plan };
  }
}

export const planService = new PlanService();
