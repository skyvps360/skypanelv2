import crypto from 'crypto'
import { query } from '../../lib/database.js'
import { PaasAlertService } from './AlertService.js'

export interface CreateNodeTokenInput {
  name: string
  region: string
  host_address?: string
}

interface HeartbeatMetrics {
  cpu_total?: number
  memory_total_mb?: number
  disk_total_mb?: number
  cpu_used?: number
  memory_used_mb?: number
  disk_used_mb?: number
  container_count?: number
  status?: 'online' | 'degraded'
}

const CAPACITY_THRESHOLD = 0.9

function evaluateStatus(metrics: HeartbeatMetrics) {
  const alerts: string[] = []

  const ratios: Array<{ label: string; ratio: number | null }> = [
    { label: 'CPU', ratio: ratio(metrics.cpu_used, metrics.cpu_total) },
    { label: 'Memory', ratio: ratio(metrics.memory_used_mb, metrics.memory_total_mb) },
    { label: 'Disk', ratio: ratio(metrics.disk_used_mb, metrics.disk_total_mb) },
  ]

  for (const r of ratios) {
    if (r.ratio !== null && r.ratio >= CAPACITY_THRESHOLD) {
      alerts.push(`${r.label} ${Math.round(r.ratio * 100)}%`)
    }
  }

  const derived = metrics.status ?? (alerts.length ? 'degraded' : 'online')
  return { status: derived, alerts }
}

function ratio(used?: number | null, total?: number | null): number | null {
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return null
  return used / total
}

const CAPACITY_ALERT_COOLDOWN_MS = 15 * 60 * 1000

export const NodeService = {
  async list() {
    const res = await query(
      'SELECT * FROM paas_nodes ORDER BY created_at DESC'
    )
    return res.rows
  },

  async generateRegistrationToken(input: CreateNodeTokenInput) {
    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30) // 30 minutes
    const res = await query(
      `INSERT INTO paas_nodes (name, region, host_address, registration_token, registration_token_expires_at, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING id, registration_token, registration_token_expires_at`,
      [input.name, input.region, input.host_address ?? null, token, expiresAt]
    )
    return res.rows[0]
  },

  async registerNodeByToken(token: string, hostAddress: string) {
    // Validate token and not expired
    const found = await query(
      `SELECT * FROM paas_nodes
       WHERE registration_token = $1 AND (registration_token_expires_at IS NULL OR registration_token_expires_at > NOW())`,
      [token]
    )
    if (found.rows.length === 0) return null

    const node = found.rows[0]
    const jwtSecret = crypto.randomBytes(32).toString('hex')
    const updated = await query(
      `UPDATE paas_nodes SET
         jwt_secret = $2,
         host_address = COALESCE($3, host_address),
         status = 'offline',
         registration_token = NULL,
         registration_token_expires_at = NULL,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [node.id, jwtSecret, hostAddress]
    )
    return updated.rows[0]
  },

  async heartbeat(id: string, metrics: HeartbeatMetrics) {
    const nodeState = await query('SELECT name, region, last_capacity_alert_at FROM paas_nodes WHERE id = $1', [id])
    const node = nodeState.rows[0]
    const lastAlert = node?.last_capacity_alert_at ? new Date(node.last_capacity_alert_at).getTime() : null
    const { status, alerts } = evaluateStatus(metrics)
    const shouldAlert = alerts.length > 0 && (!lastAlert || Date.now() - lastAlert > CAPACITY_ALERT_COOLDOWN_MS)
    const res = await query(
      `UPDATE paas_nodes SET
        cpu_total = COALESCE($2, cpu_total),
        memory_total_mb = COALESCE($3, memory_total_mb),
        disk_total_mb = COALESCE($4, disk_total_mb),
        cpu_used = COALESCE($5, cpu_used),
        memory_used_mb = COALESCE($6, memory_used_mb),
        disk_used_mb = COALESCE($7, disk_used_mb),
        container_count = COALESCE($8, container_count),
        status = $9,
        last_capacity_alert_at = CASE WHEN $10 THEN NOW() ELSE last_capacity_alert_at END,
        last_heartbeat = NOW(),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        metrics.cpu_total ?? null,
        metrics.memory_total_mb ?? null,
        metrics.disk_total_mb ?? null,
        metrics.cpu_used ?? null,
        metrics.memory_used_mb ?? null,
        metrics.disk_used_mb ?? null,
        metrics.container_count ?? null,
        status,
        shouldAlert,
      ]
    )
    if (shouldAlert && node) {
      const message = `Node ${node.name || id} (${node.region || 'region'}) is at ${alerts.join(', ')}`
      console.warn(`[PaaS] ${message}`)
      await PaasAlertService.notifyAdmins('paas.node.capacity', {
        entityType: 'paas_node',
        entityId: id,
        message,
        status: 'warning',
        metadata: { alerts, nodeId: id, region: node.region },
      })
    }
    return res.rows[0] || null
  },
}
