import { query } from '../../lib/database.js'
import { sendTaskToNode, isNodeOnline } from './AgentWs.js'

export interface BackupPolicyInput {
  organizationId: string
  databaseId?: string
  frequencyMinutes: number
  retentionDays: number
}

export const PaasBackupService = {
  async listPolicies(organizationId?: string) {
    const res = await query(
      `SELECT * FROM paas_backup_policies
       WHERE ($1::uuid IS NULL OR organization_id = $1)
       ORDER BY created_at DESC`,
      [organizationId ?? null]
    )
    return res.rows
  },

  async upsertPolicy(input: BackupPolicyInput) {
    const res = await query(
      `INSERT INTO paas_backup_policies (organization_id, database_id, frequency_minutes, retention_days, next_run_at)
       VALUES ($1,$2,$3,$4, NOW() + ($3::int * INTERVAL '1 minute'))
       ON CONFLICT (organization_id, database_id)
       DO UPDATE SET frequency_minutes = EXCLUDED.frequency_minutes,
                     retention_days = EXCLUDED.retention_days
       RETURNING *`,
      [input.organizationId, input.databaseId ?? null, input.frequencyMinutes, input.retentionDays]
    )
    return res.rows[0]
  },

  async dueBackups() {
    const res = await query(
      `SELECT bp.*, d.node_id, d.id AS database_id
       FROM paas_backup_policies bp
       JOIN paas_databases d
         ON ((bp.database_id IS NOT NULL AND bp.database_id = d.id)
         OR (bp.database_id IS NULL AND bp.organization_id = d.organization_id))
       WHERE bp.active = TRUE AND bp.next_run_at <= NOW()`
    )
    return res.rows
  },

  async tickScheduler() {
    const due = await this.dueBackups()
    for (const row of due) {
      if (!row.node_id) continue
      if (!isNodeOnline(row.node_id)) continue
      sendTaskToNode(row.node_id, {
        taskId: `backup:${row.database_id}:${Date.now()}`,
        type: 'db_backup',
        databaseId: row.database_id,
        retentionDays: row.retention_days,
      })
      await query('UPDATE paas_backup_policies SET next_run_at = NOW() + ($1::int * INTERVAL \'1 minute\') WHERE id = $2', [
        row.frequency_minutes,
        row.id,
      ])
    }
  },

  async recordBackup(databaseId: string, payload: { path: string; size: number }) {
    const res = await query(
      `INSERT INTO paas_database_backups (database_id, storage_path, size_bytes)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [databaseId, payload.path, payload.size ?? null]
    )
    return res.rows[0]
  },

  async listBackups(databaseId: string) {
    const res = await query(
      `SELECT * FROM paas_database_backups
       WHERE database_id = $1
       ORDER BY created_at DESC`,
      [databaseId]
    )
    return res.rows
  },
}
