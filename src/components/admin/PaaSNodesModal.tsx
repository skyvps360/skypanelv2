import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { buildApiUrl, API_BASE_URL } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

interface NodeRecord {
  id: string
  name: string
  region: string
  host_address?: string | null
  status: string
  cpu_total?: number | null
  memory_total_mb?: number | null
  disk_total_mb?: number | null
  cpu_used?: number | null
  memory_used_mb?: number | null
  disk_used_mb?: number | null
  container_count?: number | null
  last_heartbeat?: string | null
}

interface RegistrationToken {
  id: string
  registration_token: string
  registration_token_expires_at: string
}

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export const PaaSNodesModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<NodeRecord[]>([])
  const [token, setToken] = useState<RegistrationToken | null>(null)
  const [form, setForm] = useState({ name: 'node-1', region: 'us-east' })

  const authHeaders = () => {
    const token = localStorage.getItem('auth_token')
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl('/admin/paas/nodes'), { headers: authHeaders() })
      const data = await res.json()
      setItems(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) { void load() } }, [open])

  const generateToken = async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl('/admin/paas/nodes/register'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) setToken(data.data)
    } finally {
      setLoading(false)
    }
  }

  const installScript = useMemo(() => {
    if (!token) return ''
    const control = API_BASE_URL.replace(/\/api$/, '')
    return `bash -c "curl -fsSL ${control}/agent/install.sh | bash -s -- ${control} ${token.registration_token}"`
  }, [token])

  const usagePercent = (used?: number | null, total?: number | null) => {
    if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return null
    return Math.min(100, Math.max(0, (used / total) * 100))
  }

  const formatPercent = (value: number | null) => (value === null ? '—' : `${value.toFixed(0)}%`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>PaaS Nodes</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 col-span-1">
            <Label htmlFor="name">Node Name</Label>
            <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-1">
            <Label htmlFor="region">Region</Label>
            <Input id="region" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="col-span-1 flex items-end">
            <Button onClick={() => void generateToken()} disabled={loading || !form.name || !form.region}>Generate Token</Button>
          </div>
        </div>

        {token && (
          <div className="mt-4 p-3 rounded-md border bg-muted/30">
            <div className="text-sm">Registration token:</div>
            <div className="font-mono text-xs break-all">{token.registration_token}</div>
            <div className="text-xs text-muted-foreground">Expires: {new Date(token.registration_token_expires_at).toLocaleString()}</div>
            <div className="mt-2 text-sm">Install script:</div>
            <pre className="text-xs overflow-auto p-2 bg-background border rounded">{installScript}</pre>
          </div>
        )}

        <div className="mt-6">
          <div className="text-sm text-muted-foreground mb-2">Worker Nodes</div>
          <div className="space-y-3 max-h-96 overflow-auto">
            {items.map(node => {
              const cpu = usagePercent(node.cpu_used, node.cpu_total)
              const mem = usagePercent(node.memory_used_mb, node.memory_total_mb)
              const disk = usagePercent(node.disk_used_mb, node.disk_total_mb)
              const statusVariant =
                node.status === 'online' ? 'secondary' : node.status === 'degraded' ? 'destructive' : 'outline'
              return (
                <div key={node.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {node.name} <span className="text-xs text-muted-foreground">({node.region})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Containers {node.container_count ?? 0} � Last heartbeat{' '}
                        {node.last_heartbeat ? new Date(node.last_heartbeat).toLocaleString() : ''}
                      </div>
                    </div>
                    <Badge variant={statusVariant as any} className="uppercase tracking-wide">
                      {node.status}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <MetricCard
                      label="CPU"
                      value={cpu}
                      formatted={formatPercent(cpu)}
                      detail={`${node.cpu_used ?? 0}/${node.cpu_total ?? 0} millicores`}
                    />
                    <MetricCard
                      label="Memory"
                      value={mem}
                      formatted={formatPercent(mem)}
                      detail={`${node.memory_used_mb ?? 0}/${node.memory_total_mb ?? 0} MB`}
                    />
                    <MetricCard
                      label="Disk"
                      value={disk}
                      formatted={formatPercent(disk)}
                      detail={`${node.disk_used_mb ?? 0}/${node.disk_total_mb ?? 0} MB`}
                    />
                  </div>
                </div>
              )
            })}
            {!items.length && <div className="text-sm text-muted-foreground">No nodes registered.</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface MetricProps {
  label: string
  value: number | null
  formatted: string
  detail: string
}

const MetricCard: React.FC<MetricProps> = ({ label, value, formatted, detail }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
    <div className="space-y-1">
      <Progress value={value ?? 0} />
      <div className="text-xs text-muted-foreground">
        {detail} • {formatted}
      </div>
    </div>
  </div>
)

