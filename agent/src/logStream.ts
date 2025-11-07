import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { AgentConfig } from './config'

const followers = new Map<string, ChildProcessWithoutNullStreams>()

async function postLog(cfg: AgentConfig, applicationId: string, nodeToken: string, chunk: string) {
  if (!chunk.trim()) return
  await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/applications/${applicationId}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify({ chunk }),
  })
}

export function followContainerLogs(cfg: AgentConfig, applicationId: string, containerName: string, nodeToken: string) {
  const key = `${applicationId}:${containerName}`
  if (followers.has(key)) return
  const proc = spawn('docker', ['logs', '-f', containerName])
  const handler = (data: Buffer) => {
    void postLog(cfg, applicationId, nodeToken, data.toString())
  }
  proc.stdout.on('data', handler)
  proc.stderr.on('data', handler)
  proc.on('close', () => {
    followers.delete(key)
  })
  followers.set(key, proc)
}

export function stopLogStreaming(applicationId: string) {
  for (const [key, proc] of followers.entries()) {
    if (key.startsWith(`${applicationId}:`)) {
      proc.kill('SIGINT')
      followers.delete(key)
    }
  }
}
