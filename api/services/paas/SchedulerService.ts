import { query } from '../../lib/database.js'

export interface NodeRecord {
  id: string
  region: string
  status: string
  host_address: string | null
  cpu_total: number | null
  cpu_used: number | null
  memory_total_mb: number | null
  memory_used_mb: number | null
  disk_total_mb: number | null
  disk_used_mb: number | null
  container_count: number | null
}

interface CapacityRequirement {
  cpuMillicores?: number
  memoryMb?: number
  diskMb?: number
}

export const SchedulerService = {
  async selectNodeForRegion(region: string, requirement?: CapacityRequirement): Promise<NodeRecord | null> {
    const res = await query(
      `SELECT id, region, status, host_address, cpu_total, cpu_used, memory_total_mb, memory_used_mb, disk_total_mb, disk_used_mb, container_count
       FROM paas_nodes
       WHERE region = $1 AND status IN ('online','degraded')
       ORDER BY created_at ASC`,
      [region]
    )
    if (res.rows.length === 0) return null
    const candidates: NodeRecord[] = []
    for (const n of res.rows as NodeRecord[]) {
      if (hasCapacity(n, requirement)) {
        candidates.push(n)
      }
    }
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
      const statusA = a.status === 'online' ? 0 : 1
      const statusB = b.status === 'online' ? 0 : 1
      if (statusA !== statusB) return statusA - statusB
      return memoryUtil(a) - memoryUtil(b)
    })
    return candidates[0]
  },
}

function hasCapacity(node: NodeRecord, requirement?: CapacityRequirement): boolean {
  if (!requirement) return true
  if (requirement.cpuMillicores && !hasHeadroom(node.cpu_total, node.cpu_used, requirement.cpuMillicores)) {
    return false
  }
  if (requirement.memoryMb && !hasHeadroom(node.memory_total_mb, node.memory_used_mb, requirement.memoryMb)) {
    return false
  }
  if (requirement.diskMb && !hasHeadroom(node.disk_total_mb, node.disk_used_mb, requirement.diskMb)) {
    return false
  }
  return true
}

function hasHeadroom(total?: number | null, used?: number | null, needed?: number): boolean {
  if (typeof needed !== 'number' || needed <= 0) return true
  if (typeof total !== 'number' || total <= 0) return false
  const available = total - (used ?? 0)
  return available >= needed
}

function memoryUtil(node: NodeRecord): number {
  if (!node.memory_total_mb || node.memory_total_mb <= 0) return 1
  return (node.memory_used_mb ?? 0) / node.memory_total_mb
}
