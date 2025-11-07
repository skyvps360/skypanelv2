import { query } from '../../lib/database.js'

export interface CreatePlanInput {
  name: string
  description?: string
  cpu_millicores: number
  memory_mb: number
  storage_gb: number
  price_monthly: number
  price_hourly: number
  supported_runtimes?: string[]
  active?: boolean
}

export type UpdatePlanInput = Partial<CreatePlanInput>

export const PlanService = {
  async list() {
    const res = await query('SELECT * FROM paas_plans ORDER BY created_at DESC')
    return res.rows
  },

  async get(id: string) {
    const res = await query('SELECT * FROM paas_plans WHERE id = $1', [id])
    return res.rows[0] || null
  },

  async create(input: CreatePlanInput) {
    const res = await query(
      `INSERT INTO paas_plans (
        name, description, cpu_millicores, memory_mb, storage_gb,
        price_monthly, price_hourly, supported_runtimes, active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      ) RETURNING *`,
      [
        input.name,
        input.description ?? null,
        input.cpu_millicores,
        input.memory_mb,
        input.storage_gb,
        input.price_monthly,
        input.price_hourly,
        JSON.stringify(input.supported_runtimes ?? []),
        input.active ?? true,
      ]
    )
    return res.rows[0]
  },

  async update(id: string, input: UpdatePlanInput) {
    const existing = await this.get(id)
    if (!existing) return null

    const res = await query(
      `UPDATE paas_plans SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        cpu_millicores = COALESCE($4, cpu_millicores),
        memory_mb = COALESCE($5, memory_mb),
        storage_gb = COALESCE($6, storage_gb),
        price_monthly = COALESCE($7, price_monthly),
        price_hourly = COALESCE($8, price_hourly),
        supported_runtimes = COALESCE($9, supported_runtimes),
        active = COALESCE($10, active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        input.name ?? null,
        input.description ?? null,
        input.cpu_millicores ?? null,
        input.memory_mb ?? null,
        input.storage_gb ?? null,
        input.price_monthly ?? null,
        input.price_hourly ?? null,
        input.supported_runtimes ? JSON.stringify(input.supported_runtimes) : null,
        typeof input.active === 'boolean' ? input.active : null,
      ]
    )
    return res.rows[0]
  },

  async remove(id: string) {
    const res = await query('DELETE FROM paas_plans WHERE id = $1', [id])
    return res.rowCount > 0
  },
}
