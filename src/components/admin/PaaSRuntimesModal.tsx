import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildApiUrl } from '@/lib/api'
import { Switch } from '@/components/ui/switch'

interface Runtime {
  id: string
  runtime_type: string
  version: string
  base_image: string
  default_build_command?: string | null
  default_start_command?: string | null
  allow_custom_docker: boolean
  active: boolean
  enforce_non_root?: boolean
  default_run_user?: string | null
}

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export const PaaSRuntimesModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Runtime[]>([])
  const [form, setForm] = useState({
    runtime_type: 'nodejs',
    version: '20',
    base_image: 'node:20-alpine',
    default_build_command: 'npm ci && npm run build',
    default_start_command: 'npm start',
    enforce_non_root: true,
    default_run_user: '',
  })

  const authHeaders = () => {
    const token = localStorage.getItem('auth_token')
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl('/admin/paas/runtimes'), { headers: authHeaders() })
      const data = await res.json()
      setItems(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) { void load() } }, [open])

  const create = async () => {
    setLoading(true)
    try {
      const payload = {
        ...form,
        default_run_user: form.default_run_user.trim() ? form.default_run_user.trim() : undefined,
      }
      const res = await fetch(buildApiUrl('/admin/paas/runtimes'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await load()
      }
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    setLoading(true)
    try {
      await fetch(buildApiUrl(`/admin/paas/runtimes/${id}`), { method: 'DELETE', headers: authHeaders() })
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>PaaS Runtimes</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input id="type" value={form.runtime_type} onChange={e => setForm({ ...form, runtime_type: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="image">Base Image</Label>
            <Input id="image" value={form.base_image} onChange={e => setForm({ ...form, base_image: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="build">Default Build Command</Label>
            <Input id="build" value={form.default_build_command}
              onChange={e => setForm({ ...form, default_build_command: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="start">Default Start Command</Label>
            <Input id="start" value={form.default_start_command}
              onChange={e => setForm({ ...form, default_start_command: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enforce-non-root">Enforce Non-root Execution</Label>
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Switch
                id="enforce-non-root"
                checked={form.enforce_non_root}
                onCheckedChange={value => setForm({ ...form, enforce_non_root: Boolean(value) })}
              />
              <span className="text-sm text-muted-foreground">Drop root privileges for containers built with this runtime.</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="run-user">Default Container User</Label>
            <Input
              id="run-user"
              placeholder="e.g. node or 1000:1000"
              value={form.default_run_user}
              onChange={e => setForm({ ...form, default_run_user: e.target.value })}
              disabled={!form.enforce_non_root}
            />
            <p className="text-xs text-muted-foreground">Optional override. Leave blank to use agent default.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button onClick={() => void create()} disabled={loading || !form.runtime_type || !form.version}>Add Runtime</Button>
        </div>

        <div className="mt-6">
          <div className="text-sm text-muted-foreground mb-2">Available Runtimes</div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {items.map(it => (
              <div key={it.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium">{it.runtime_type}@{it.version}</div>
                  <div className="text-xs text-muted-foreground flex flex-col">
                    <span>{it.base_image}</span>
                    <span>{it.enforce_non_root === false ? 'Allows root execution' : `Non-root enforced${it.default_run_user ? ` (${it.default_run_user})` : ''}`}</span>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => void remove(it.id)} disabled={loading}>Delete</Button>
              </div>
            ))}
            {!items.length && <div className="text-sm text-muted-foreground">No runtimes configured.</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
