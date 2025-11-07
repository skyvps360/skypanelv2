import { WebSocket, type RawData } from 'ws'
import { createHmac } from 'node:crypto'
import { AgentConfig } from './config'

export async function createAgentToken(nodeId: string, jwtSecret: string): Promise<string> {
  // Minimal JWT: header.payload.signature built manually to avoid deps.
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url')
  const payload = Buffer.from(JSON.stringify({ nodeId, iat: Math.floor(Date.now() / 1000) }), 'utf8').toString('base64url')
  const data = `${header}.${payload}`
  const sig = createHmac('sha256', jwtSecret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export async function connectWs(cfg: AgentConfig, onMessage: (msg: any) => void, onClose: () => void) {
  if (!cfg.nodeId || !cfg.jwtSecret) throw new Error('Missing nodeId/jwtSecret')
  const token = await createAgentToken(cfg.nodeId, cfg.jwtSecret)
  const url = new URL(`${cfg.controlPlaneUrl}/api/internal/paas/nodes/${cfg.nodeId}/connect`)
  url.searchParams.set('token', token)

  let ws: WebSocket | null = null
  let closed = false

  function open() {
    ws = new WebSocket(url.toString())
    ws.on('open', () => {
      if (cfg.logLevel === 'debug') console.log('WS connected')
    })
    ws.on('message', (data: RawData) => {
      try {
        const msg = JSON.parse(String(data))
        onMessage(msg)
      } catch {}
    })
    ws.on('close', () => {
      if (closed) return
      if (cfg.logLevel !== 'error') console.log('WS closed; reconnecting...')
      setTimeout(open, 3000)
      onClose()
    })
    ws.on('error', () => {
      // handled by close
    })
  }

  open()
  return {
    send(obj: any) {
      try { ws?.send(JSON.stringify(obj)) } catch {}
    },
    close() { closed = true; try { ws?.close() } catch {} }
  }
}
