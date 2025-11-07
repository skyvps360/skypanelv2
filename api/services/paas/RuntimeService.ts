import { query } from '../../lib/database.js'

export interface CreateRuntimeInput {
  runtime_type: string
  version: string
  base_image: string
  default_build_command?: string
  default_start_command?: string
  allow_custom_docker?: boolean
  active?: boolean
  enforce_non_root?: boolean
  default_run_user?: string
}

export type UpdateRuntimeInput = Partial<CreateRuntimeInput>

export const RuntimeService = {
  async list() {
    const res = await query('SELECT * FROM paas_runtimes ORDER BY runtime_type ASC, version DESC')
    return res.rows
  },

  async get(id: string) {
    const res = await query('SELECT * FROM paas_runtimes WHERE id = $1', [id])
    return res.rows[0] || null
  },

  async create(input: CreateRuntimeInput) {
    const res = await query(
      `INSERT INTO paas_runtimes (
        runtime_type, version, base_image, default_build_command,
        default_start_command, allow_custom_docker, enforce_non_root,
        default_run_user, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, TRUE),$9,$10)
      RETURNING *`,
      [
        input.runtime_type,
        input.version,
        input.base_image,
        input.default_build_command ?? null,
        input.default_start_command ?? null,
        input.allow_custom_docker ?? false,
        input.enforce_non_root ?? true,
        input.default_run_user ?? null,
        input.active ?? true,
      ]
    )
    return res.rows[0]
  },

  async update(id: string, input: UpdateRuntimeInput) {
    const existing = await this.get(id)
    if (!existing) return null

    const res = await query(
      `UPDATE paas_runtimes SET
        runtime_type = COALESCE($2, runtime_type),
        version = COALESCE($3, version),
        base_image = COALESCE($4, base_image),
        default_build_command = COALESCE($5, default_build_command),
        default_start_command = COALESCE($6, default_start_command),
        allow_custom_docker = COALESCE($7, allow_custom_docker),
        enforce_non_root = COALESCE($8, enforce_non_root),
        default_run_user = COALESCE($9, default_run_user),
        active = COALESCE($10, active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        input.runtime_type ?? null,
        input.version ?? null,
        input.base_image ?? null,
        input.default_build_command ?? null,
        input.default_start_command ?? null,
        typeof input.allow_custom_docker === 'boolean' ? input.allow_custom_docker : null,
        typeof input.enforce_non_root === 'boolean' ? input.enforce_non_root : null,
        input.default_run_user ?? null,
        typeof input.active === 'boolean' ? input.active : null,
      ]
    )
    return res.rows[0]
  },

  async remove(id: string) {
    const res = await query('DELETE FROM paas_runtimes WHERE id = $1', [id])
    return res.rowCount > 0
  },
}
