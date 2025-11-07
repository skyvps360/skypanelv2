import os from 'node:os'
import { AgentConfig } from './config'
import { dockerInfo } from './docker'
import { run } from './utils'
import { collectAppMetrics } from './metrics'

async function getDiskStats(): Promise<{ total: number | null; used: number | null }> {
  try {
    const res = await run('df', ['-k', '--output=size,used', '/'])
    if (res.code !== 0) return { total: null, used: null }
    const lines = res.stdout.trim().split('\n')
    const parts = lines.pop()?.trim().split(/\s+/)
    if (!parts || parts.length < 2) return { total: null, used: null }
    const totalMb = Math.round(parseInt(parts[0], 10) / 1024)
    const usedMb = Math.round(parseInt(parts[1], 10) / 1024)
    return { total: Number.isFinite(totalMb) ? totalMb : null, used: Number.isFinite(usedMb) ? usedMb : null }
  } catch {
    return { total: null, used: null }
  }
}

async function getContainerCount(): Promise<number | null> {
  try {
    const infoRaw = await dockerInfo()
    if (!infoRaw) return null
    const info = JSON.parse(infoRaw)
    const running = Number(info?.ContainersRunning ?? info?.Containers ?? 0)
    return Number.isFinite(running) ? running : null
  } catch {
    return null
  }
}

export async function sendHeartbeat(cfg: AgentConfig, nodeToken: string) {
  const memTotal = Math.round(os.totalmem() / (1024 * 1024))
  const memUsed = memTotal - Math.round(os.freemem() / (1024 * 1024))
  const cpuTotal = os.cpus().length * 1000
  const loadAvg = os.loadavg()[0] || 0
  const cpuUsed = Math.min(cpuTotal, Math.max(0, Math.round(loadAvg * 1000)))
  const disk = await getDiskStats()
  const containers = await getContainerCount()
  const appMetrics = await collectAppMetrics()
  const body = {
    cpu_total: cpuTotal,
    cpu_used: cpuUsed,
    memory_total_mb: memTotal,
    memory_used_mb: memUsed,
    disk_total_mb: disk.total,
    disk_used_mb: disk.used,
    container_count: containers,
    status: 'online',
    application_metrics: appMetrics.map((metric) => ({
      application_id: metric.applicationId,
      cpu_millicores: metric.cpuMillicores,
      memory_mb: metric.memoryMb,
      request_rate: 0,
    })),
  }
  const res = await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/nodes/${cfg.nodeId}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`heartbeat failed: ${res.status}`)
}
