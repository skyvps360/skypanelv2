import { query } from '../../lib/database.js'

export const PaasLogService = {
  async append(applicationId: string, chunk: string) {
    if (!chunk) return
    const payload = chunk.length > 8000 ? chunk.slice(-8000) : chunk
    await query(
      `INSERT INTO paas_application_logs (application_id, chunk)
       VALUES ($1, $2)`,
      [applicationId, payload]
    )
    await query(
      `DELETE FROM paas_application_logs
       WHERE application_id = $1
         AND created_at < NOW() - INTERVAL '7 days'`,
      [applicationId]
    )
  },

  async tail(applicationId: string, limit = 200) {
    const res = await query(
      `SELECT chunk, created_at
       FROM paas_application_logs
       WHERE application_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [applicationId, limit]
    )
    return res.rows.reverse()
  },
}
