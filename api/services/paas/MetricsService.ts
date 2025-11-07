import { query } from '../../lib/database.js'

export interface ApplicationMetric {
  applicationId: string
  cpuMillicores: number
  memoryMb: number
  requestRate?: number
}

export const PaasMetricsService = {
  async recordMany(metrics: ApplicationMetric[]) {
    if (!metrics.length) return
    const values: string[] = []
    const params: any[] = []
    metrics.forEach((metric, idx) => {
      const base = idx * 4
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`)
      params.push(metric.applicationId, metric.cpuMillicores, metric.memoryMb, metric.requestRate ?? 0)
    })
    await query(
      `INSERT INTO paas_application_metrics (application_id, cpu_millicores, memory_mb, request_rate)
       VALUES ${values.join(',')}`,
      params
    )
  },

  async list(applicationId: string, rangeHours = 24) {
    const res = await query(
      `SELECT created_at, cpu_millicores, memory_mb, request_rate
       FROM paas_application_metrics
       WHERE application_id = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 hour')
       ORDER BY created_at ASC`,
      [applicationId, rangeHours]
    )
    return res.rows
  },
}
