import { loadConfig } from './config'
import { connectWs } from './wsClient'
import { handleTask, Task } from './tasks'
import { sendHeartbeat } from './heartbeat'

async function main() {
  const cfg = await loadConfig()
  if (!cfg.nodeId || !cfg.jwtSecret || !cfg.controlPlaneUrl) {
    console.error('Missing nodeId/jwtSecret/controlPlaneUrl in config.json')
    process.exit(1)
  }

  // Create node JWT for HTTP endpoints
  const { createHmac } = await import('node:crypto')
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url')
  function sign(payloadObj: any): string {
    const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url')
    const data = `${header}.${payload}`
    const sig = createHmac('sha256', cfg.jwtSecret!).update(data).digest('base64url')
    return `${data}.${sig}`
  }
  let nodeToken = sign({ nodeId: cfg.nodeId, iat: Math.floor(Date.now() / 1000) })

  // WS connection for tasks
  const ws = await connectWs(cfg, async (msg) => {
    if (msg?.type === 'task' && msg.task) {
      const task = msg.task as Task
      await handleTask(cfg, nodeToken, task)
    }
  }, () => {
    // on close
  })

  // Heartbeats
  setInterval(async () => {
    try {
      await sendHeartbeat(cfg, nodeToken)
    } catch (err: any) {
      console.error('heartbeat error', err)
      // Re-issue token if control plane rejected due to expiry
      nodeToken = sign({ nodeId: cfg.nodeId!, iat: Math.floor(Date.now() / 1000) })
    }
  }, 30000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
