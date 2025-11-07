import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import jwt from 'jsonwebtoken'
import { query } from '../../lib/database.js'
import { NodeService } from './NodeService.js'
import { PaasAlertService } from './AlertService.js'
import { PaasMetricsService } from './MetricsService.js'

interface AgentClaims { nodeId: string; iat?: number; exp?: number }

async function getNode(nodeId: string) {
  const res = await query('SELECT * FROM paas_nodes WHERE id = $1', [nodeId])
  return res.rows[0] || null
}

function parseUrl(urlStr: string | undefined) {
  try {
    const u = new URL(urlStr || '', 'http://localhost')
    const segments = u.pathname.split('/').filter(Boolean)
    // expect: /api/internal/paas/nodes/:id/connect
    if (segments.length >= 6 && segments[0] === 'api' && segments[1] === 'internal' && segments[2] === 'paas' && segments[3] === 'nodes' && segments[5] === 'connect') {
      return { nodeId: segments[4], token: u.searchParams.get('token') }
    }
  } catch {}
  return { nodeId: null, token: null }
}

function send(ws: WebSocket, payload: any) {
  try { ws.send(JSON.stringify(payload)) } catch {}
}

const nodeSockets = new Map<string, WebSocket>()
const OFFLINE_THRESHOLD_SECONDS = 90
const WATCHDOG_INTERVAL_MS = 30_000

export function isNodeOnline(nodeId: string): boolean {
  return nodeSockets.has(nodeId)
}

export function sendTaskToNode(nodeId: string, task: any): boolean {
  const ws = nodeSockets.get(nodeId)
  if (!ws) return false
  try {
    ws.send(JSON.stringify({ type: 'task', task }))
    return true
  } catch {
    return false
  }
}

export function initPaasAgentWs(server: Server) {
  const wss = new WebSocketServer({ server })
  console.log('PaaS Agent WebSocket server initialized')

  const watchdog = setInterval(async () => {
    try {
      const res = await query(
        `UPDATE paas_nodes
         SET status = 'offline'
         WHERE status NOT IN ('disabled','offline')
           AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '${OFFLINE_THRESHOLD_SECONDS} seconds')
         RETURNING id, name, region`
      )
      for (const row of res.rows) {
        const message = `Node ${row.name || row.id} in ${row.region || 'unknown'} went offline`
        await PaasAlertService.notifyAdmins('paas.node.offline', {
          entityType: 'paas_node',
          entityId: row.id,
          message,
          status: 'warning',
        })
      }
    } catch (err) {
      console.error('PaaS node watchdog error', err)
    }
  }, WATCHDOG_INTERVAL_MS)

  wss.on('connection', async (ws, req) => {
    const { nodeId, token } = parseUrl(req.url)
    if (!nodeId || !token) {
      send(ws, { type: 'error', message: 'Invalid connection path or token' })
      ws.close()
      return
    }

    const node = await getNode(nodeId)
    if (!node || !node.jwt_secret) {
      send(ws, { type: 'error', message: 'Unknown node' })
      ws.close()
      return
    }

    // verify agent JWT with per-node secret
    try {
      const decoded = jwt.verify(token, node.jwt_secret) as AgentClaims
      if (!decoded || decoded.nodeId !== nodeId) throw new Error('claims mismatch')
    } catch (err) {
      send(ws, { type: 'error', message: 'Auth failed' })
      ws.close()
      return
    }

    await NodeService.heartbeat(nodeId, { status: 'online' })
    nodeSockets.set(nodeId, ws)
    send(ws, { type: 'hello', nodeId })

    ws.on('message', async (raw: Buffer) => {
      let msg: any = null
      try { msg = JSON.parse(raw.toString('utf8')) } catch {}
      if (!msg) return
      if (msg.type === 'heartbeat') {
        await NodeService.heartbeat(nodeId, {
          cpu_total: msg.cpu_total,
          memory_total_mb: msg.memory_total_mb,
          disk_total_mb: msg.disk_total_mb,
          cpu_used: msg.cpu_used,
          memory_used_mb: msg.memory_used_mb,
          disk_used_mb: msg.disk_used_mb,
          container_count: msg.container_count,
        })
        if (Array.isArray(msg.application_metrics) && msg.application_metrics.length) {
          const metricsPayload = msg.application_metrics
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
      } else if (msg.type === 'pong') {
        // ignore
      }
    })

    const pingInterval = setInterval(() => {
      try { ws.send(JSON.stringify({ type: 'ping', ts: Date.now() })) } catch {}
    }, 30000)

    ws.on('close', async () => {
      clearInterval(pingInterval)
      await query('UPDATE paas_nodes SET status = $2 WHERE id = $1', [nodeId, 'offline'])
      nodeSockets.delete(nodeId)
    })

    ws.on('error', () => {
      // handled by close above
    })
  })

  wss.on('close', () => {
    clearInterval(watchdog)
  })
}
