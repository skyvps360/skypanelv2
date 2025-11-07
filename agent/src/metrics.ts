import { run } from './utils'

interface ContainerMetric {
  applicationId: string
  cpuMillicores: number
  memoryMb: number
}

function parseMemory(val: string): number {
  const match = val.trim().split(' ')[0]
  const unit = match.slice(-2).toLowerCase()
  const num = parseFloat(match)
  if (unit.includes('gi')) return Math.round(num * 1024)
  if (unit.includes('mi')) return Math.round(num)
  if (unit.includes('ki')) return Math.round(num / 1024)
  return Math.round(num)
}

export async function collectAppMetrics(): Promise<ContainerMetric[]> {
  const stats = await run('docker', ['stats', '--no-stream', '--format', '{{.Name}}||{{.CPUPerc}}||{{.MemUsage}}'])
  if (stats.code !== 0) return []
  const metrics: ContainerMetric[] = []
  for (const line of stats.stdout.trim().split('\n')) {
    if (!line || !line.includes('||')) continue
    const [name, cpu, memUsage] = line.split('||')
    if (!name.startsWith('skp-')) continue
    const [, appId] = name.match(/^skp-([a-f0-9-]+)/i) || []
    if (!appId) continue
    const cpuPercent = parseFloat(cpu.replace('%', '').trim())
    const [used] = memUsage.split('/').map((s) => s.trim())
    metrics.push({
      applicationId: appId,
      cpuMillicores: Math.round((cpuPercent / 100) * 1000),
      memoryMb: parseMemory(used),
    })
  }
  return metrics
}
