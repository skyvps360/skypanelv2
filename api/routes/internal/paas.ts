import express from 'express'
import { NodeService } from '../../services/paas/NodeService.js'
import jwt from 'jsonwebtoken'
import { query } from '../../lib/database.js'
import { PaasLogService } from '../../services/paas/LogService.js'
import { PaasMetricsService } from '../../services/paas/MetricsService.js'
import { PaasBackupService } from '../../services/paas/BackupService.js'
import { publish, runtimeChannel, buildChannel } from '../../services/paas/LogStreamBroker.js'
import { ApplicationService } from '../../services/paas/ApplicationService.js'

const router = express.Router()

// Node registration endpoint
router.post('/nodes/register', async (req, res) => {
  const { registrationToken, hostAddress } = req.body || {}
  if (!registrationToken) {
    return res.status(400).json({ success: false, error: 'registrationToken is required' })
  }
  const registered = await NodeService.registerNodeByToken(registrationToken, hostAddress)
  if (!registered) return res.status(400).json({ success: false, error: 'Invalid or expired token' })
  res.json({ success: true, data: { id: registered.id, jwtSecret: registered.jwt_secret, region: registered.region } })
})

// Heartbeat (HTTP fallback)
router.post('/nodes/:id/heartbeat', async (req, res) => {
  const id = req.params.id
  const auth = req.headers['authorization']
  let ok = false
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    const nodeRes = await query('SELECT jwt_secret FROM paas_nodes WHERE id = $1', [id])
    const secret = nodeRes.rows[0]?.jwt_secret
    if (secret) {
      try {
        const decoded = jwt.verify(token, secret) as any
        if (decoded?.nodeId === id) ok = true
      } catch {}
    }
  }
  if (!ok) return res.status(401).json({ success: false, error: 'Unauthorized' })

  const updated = await NodeService.heartbeat(id, req.body || {})
  if (Array.isArray(req.body?.application_metrics) && req.body.application_metrics.length) {
    const metricsPayload = req.body.application_metrics
      .filter((m: any) => m?.application_id)
      .map((m: any) => ({
        applicationId: m.application_id,
        cpuMillicores: Number(m.cpu_millicores || 0),
        memoryMb: Number(m.memory_mb || 0),
        requestRate: Number(m.request_rate || 0),
      }))
    if (metricsPayload.length) {
      await PaasMetricsService.recordMany(metricsPayload)
    }
  }
  if (!updated) return res.status(404).json({ success: false, error: 'Node not found' })
  res.json({ success: true })
})

export default router

// Task status update (from agent)
router.post('/tasks/:taskId/status', async (req, res) => {
  const { taskId } = req.params
  const { status, image_tag, error } = req.body || {}
  // Identify application and node
  const buildRes = await query('SELECT application_id FROM paas_builds WHERE id = $1', [taskId])
  if (buildRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Build not found' })
  const appRes = await query('SELECT id, node_id FROM paas_applications WHERE id = $1', [buildRes.rows[0].application_id])
  const app = appRes.rows[0]
  if (!app?.node_id) return res.status(400).json({ success: false, error: 'App not assigned to a node' })
  const nodeSecretRes = await query('SELECT jwt_secret FROM paas_nodes WHERE id = $1', [app.node_id])
  const nodeSecret = nodeSecretRes.rows[0]?.jwt_secret
  if (!nodeSecret) return res.status(401).json({ success: false, error: 'Unauthorized' })

  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Unauthorized' })
  try {
    const token = auth.slice('Bearer '.length)
    const decoded = jwt.verify(token, nodeSecret) as any
    if (!decoded?.nodeId || decoded.nodeId !== app.node_id) throw new Error('bad claims')
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  // Update build and app status
  const now = new Date()
  const nextFields: any = {}
  if (typeof image_tag === 'string') nextFields.image_tag = image_tag
  if (typeof status === 'string') nextFields.status = status
  let appStatus: string | null = null
  let clearRedeploy = false
  if (status === 'success') appStatus = 'running'
  if (status === 'failed') appStatus = 'failed'
  if (status === 'success') clearRedeploy = true
  await query(
    `UPDATE paas_builds SET status = COALESCE($2, status), image_tag = COALESCE($3, image_tag), completed_at = CASE WHEN $2 IN ('success','failed') THEN $4 ELSE completed_at END, build_log = CASE WHEN $5 IS NOT NULL THEN COALESCE(build_log,'') || $5 ELSE build_log END WHERE id = $1`,
    [taskId, nextFields.status ?? null, nextFields.image_tag ?? null, now, error ? `\nERROR: ${error}\n` : null]
  )
  if (appStatus) {
    await query(
      `UPDATE paas_applications
         SET status = $2,
             updated_at = NOW(),
             needs_redeploy = CASE WHEN $3 THEN FALSE ELSE needs_redeploy END
       WHERE id = $1`,
      [app.id, appStatus, clearRedeploy]
    )
  }
  publish(buildChannel(taskId), 'status', { status: nextFields.status ?? status ?? null, timestamp: now.toISOString() })
  return res.json({ success: true })
})

// Task logs append (from agent)
router.post('/tasks/:taskId/logs', async (req, res) => {
  const { taskId } = req.params
  const { chunk } = req.body || {}
  if (typeof chunk !== 'string') return res.status(400).json({ success: false, error: 'chunk required' })
  const buildRes = await query('SELECT application_id FROM paas_builds WHERE id = $1', [taskId])
  if (buildRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Build not found' })
  const appRes = await query('SELECT id, node_id FROM paas_applications WHERE id = $1', [buildRes.rows[0].application_id])
  const app = appRes.rows[0]
  if (!app?.node_id) return res.status(400).json({ success: false, error: 'App not assigned to a node' })
  const nodeSecretRes = await query('SELECT jwt_secret FROM paas_nodes WHERE id = $1', [app.node_id])
  const nodeSecret = nodeSecretRes.rows[0]?.jwt_secret
  if (!nodeSecret) return res.status(401).json({ success: false, error: 'Unauthorized' })
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Unauthorized' })
  try {
    const token = auth.slice('Bearer '.length)
    const decoded = jwt.verify(token, nodeSecret) as any
    if (!decoded?.nodeId || decoded.nodeId !== app.node_id) throw new Error('bad claims')
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  await query('UPDATE paas_builds SET build_log = COALESCE(build_log, \'\') || $2 WHERE id = $1', [taskId, chunk])
  publish(buildChannel(taskId), 'chunk', { chunk, timestamp: new Date().toISOString() })
  res.json({ success: true })
})

// Runtime log streaming
router.post('/applications/:id/logs', async (req, res) => {
  const { id } = req.params
  const { chunk } = req.body || {}
  const { authorized, error } = await authenticateNodeForApplication(id, req.headers['authorization'])
  if (!authorized) return res.status(401).json({ success: false, error: error ?? 'Unauthorized' })
  if (typeof chunk !== 'string') return res.status(400).json({ success: false, error: 'chunk required' })
  await PaasLogService.append(id, chunk)
  publish(runtimeChannel(id), 'chunk', { chunk, timestamp: new Date().toISOString() })
  res.json({ success: true })
})

router.post('/databases/:id/backups', async (req, res) => {
  const { id } = req.params
  const { path, size_bytes } = req.body || {}
  if (!path) return res.status(400).json({ success: false, error: 'path required' })
  const dbRes = await query('SELECT node_id FROM paas_databases WHERE id = $1', [id])
  const db = dbRes.rows[0]
  if (!db) return res.status(404).json({ success: false, error: 'Database not found' })
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Unauthorized' })
  const nodeSecretRes = await query('SELECT jwt_secret FROM paas_nodes WHERE id = $1', [db.node_id])
  const secret = nodeSecretRes.rows[0]?.jwt_secret
  if (!secret) return res.status(401).json({ success: false, error: 'Unauthorized' })
  try {
    const token = auth.slice('Bearer '.length)
    const decoded = jwt.verify(token, secret) as any
    if (!decoded?.nodeId || decoded.nodeId !== db.node_id) throw new Error('bad claims')
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  await PaasBackupService.recordBackup(id, { path, size: size_bytes })
  res.json({ success: true })
})

router.post('/applications/:id/domains/activate', async (req, res) => {
  const { id } = req.params
  const domains = Array.isArray(req.body?.domains) ? req.body.domains : []
  if (!domains.length) return res.status(400).json({ success: false, error: 'domains array required' })
  const { authorized, error } = await authenticateNodeForApplication(id, req.headers['authorization'])
  if (!authorized) return res.status(401).json({ success: false, error: error ?? 'Unauthorized' })
  const updated = await ApplicationService.markDomainsActive(id, domains)
  if (!updated) return res.status(404).json({ success: false, error: 'Application not found' })
  res.json({ success: true, data: updated })
})

async function authenticateNodeForApplication(appId: string, authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing token' }
  }
  const appRes = await query('SELECT id, node_id FROM paas_applications WHERE id = $1', [appId])
  const app = appRes.rows[0]
  if (!app?.node_id) return { authorized: false, error: 'App not assigned' }
  const nodeSecretRes = await query('SELECT jwt_secret FROM paas_nodes WHERE id = $1', [app.node_id])
  const nodeSecret = nodeSecretRes.rows[0]?.jwt_secret
  if (!nodeSecret) return { authorized: false, error: 'Node missing secret' }
  try {
    const token = authHeader.slice('Bearer '.length)
    const decoded = jwt.verify(token, nodeSecret) as any
    if (!decoded?.nodeId || decoded.nodeId !== app.node_id) throw new Error('bad claims')
  } catch {
    return { authorized: false, error: 'Invalid token' }
  }
  return { authorized: true }
}
