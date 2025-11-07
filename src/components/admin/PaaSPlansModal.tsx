import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { buildApiUrl } from '@/lib/api'
import { formatHourlyRate, formatMonthlyPrice } from '@/lib/currency'

interface PaaSPlan {
  id: string
  name: string
  description?: string | null
  cpu_millicores: number
  memory_mb: number
  storage_gb: number
  price_monthly: number
  price_hourly: number
  supported_runtimes: string[]
  active: boolean
}

interface RuntimeOption {
  id: string
  runtime_type: string
  version: string
  base_image: string
}

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export const PaaSPlansModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<PaaSPlan[]>([])
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOption[]>([])
  const [runtimesLoaded, setRuntimesLoaded] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const emptyForm = () => ({
    name: '',
    description: '',
    cpu_millicores: 500,
    memory_mb: 512,
    storage_gb: 5,
    price_monthly: 5,
    price_hourly: 0.007,
    supported_runtimes: [] as string[],
    active: true,
  })

  const [form, setForm] = useState(emptyForm())

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }
  }, [])

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl('/admin/paas/plans'), { headers: authHeaders() })
      const data = await res.json()
      setPlans(data.data || [])
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const loadRuntimes = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/admin/paas/runtimes'), { headers: authHeaders() })
      const data = await res.json()
      setRuntimeOptions(data.data || [])
      setRuntimesLoaded(true)
    } catch (err) {
      console.error('Failed to load runtimes', err)
    }
  }, [authHeaders])

  useEffect(() => {
    if (open) {
      void loadPlans()
      if (!runtimesLoaded) void loadRuntimes()
    }
  }, [open, runtimesLoaded, loadPlans, loadRuntimes])

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
    setFormError(null)
  }

  const persist = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const payload = { ...form }
      const url = editingId ? buildApiUrl(`/admin/paas/plans/${editingId}`) : buildApiUrl('/admin/paas/plans')
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Unable to save plan')
      }
      await loadPlans()
      resetForm()
    } catch (err: any) {
      setFormError(err?.message || 'Unable to save plan')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      await fetch(buildApiUrl(`/admin/paas/plans/${id}`), { method: 'DELETE', headers: authHeaders() })
      await loadPlans()
      if (editingId === id) resetForm()
    } finally {
      setSaving(false)
    }
  }

  const runtimeLookup = useMemo(() => {
    const map = new Map<string, string>()
    runtimeOptions.forEach(rt => {
      map.set(rt.id, `${rt.runtime_type}@${rt.version}`)
    })
    return map
  }, [runtimeOptions])

  const toggleRuntime = (runtimeId: string, checked: boolean | 'indeterminate') => {
    setForm(prev => {
      const current = prev.supported_runtimes ?? []
      const exists = current.includes(runtimeId)
      const isChecked = checked === true
      if (isChecked && !exists) {
        return { ...prev, supported_runtimes: [...current, runtimeId] }
      }
      if (!isChecked && exists) {
        return { ...prev, supported_runtimes: current.filter(id => id !== runtimeId) }
      }
      return prev
    })
  }

  const startEdit = (plan: PaaSPlan) => {
    setEditingId(plan.id)
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      cpu_millicores: plan.cpu_millicores,
      memory_mb: plan.memory_mb,
      storage_gb: plan.storage_gb,
      price_monthly: plan.price_monthly,
      price_hourly: plan.price_hourly,
      supported_runtimes: Array.isArray(plan.supported_runtimes) ? plan.supported_runtimes : [],
      active: plan.active,
    })
  }

  const planRuntimeLabels = (plan: PaaSPlan) => {
    const values = Array.isArray(plan.supported_runtimes) ? plan.supported_runtimes : []
    if (!values.length) return ['All runtimes']
    return values.map(val => runtimeLookup.get(val) ?? val)
  }

  const formValid =
    form.name.trim().length > 1 &&
    form.cpu_millicores > 0 &&
    form.memory_mb > 0 &&
    form.storage_gb > 0 &&
    form.price_hourly > 0 &&
    form.price_monthly >= form.price_hourly

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>PaaS Plans</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="active">Status</Label>
            <div className="flex h-10 items-center gap-2 rounded-md border px-3">
              <Switch id="active" checked={form.active}
                onCheckedChange={checked => setForm({ ...form, active: Boolean(checked) })} />
              <span className="text-sm text-muted-foreground">{form.active ? 'Visible to customers' : 'Hidden'}</span>
            </div>
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Short summary shown on pricing cards" rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU (millicores)</Label>
            <Input id="cpu" type="number" value={form.cpu_millicores}
              onChange={e => setForm({ ...form, cpu_millicores: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mem">Memory (MB)</Label>
            <Input id="mem" type="number" value={form.memory_mb}
              onChange={e => setForm({ ...form, memory_mb: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storage">Storage (GB)</Label>
            <Input id="storage" type="number" value={form.storage_gb}
              onChange={e => setForm({ ...form, storage_gb: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Hourly Price</Label>
            <Input id="ph" type="number" step="0.0001" value={form.price_hourly}
              onChange={e => setForm({ ...form, price_hourly: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm">Monthly Price</Label>
            <Input id="pm" type="number" step="0.01" value={form.price_monthly}
              onChange={e => setForm({ ...form, price_monthly: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Supported Runtimes</Label>
            <div className="max-h-48 space-y-2 overflow-auto rounded-md border p-3 text-sm">
              {runtimeOptions.map(rt => (
                <label key={rt.id} className="flex items-center gap-2">
                  <Checkbox checked={form.supported_runtimes.includes(rt.id)}
                    onCheckedChange={checked => toggleRuntime(rt.id, checked)} />
                  <span>{rt.runtime_type}@{rt.version}</span>
                </label>
              ))}
              {!runtimeOptions.length && (
                <div className="text-xs text-muted-foreground">No runtimes configured yet.</div>
              )}
            </div>
          </div>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button onClick={() => void persist()} disabled={!formValid || saving}>{editingId ? 'Save plan' : 'Create plan'}</Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm} disabled={saving}>Cancel edit</Button>
          )}
        </div>

        <div className="mt-6">
          <div className="text-sm text-muted-foreground mb-2">Existing Plans</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {plans.map(p => (
              <div key={p.id} className="rounded-md border px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{p.name}</div>
                      <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Active' : 'Hidden'}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CPU {p.cpu_millicores}m • RAM {p.memory_mb}MB • Disk {p.storage_gb}GB
                    </div>
                    {p.description && <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                  <div className="text-right text-sm font-semibold">
                    <div>{formatHourlyRate(p.price_hourly)}/hr</div>
                    <div className="text-xs font-normal text-muted-foreground">{formatMonthlyPrice(p.price_monthly)}/mo</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {planRuntimeLabels(p).map(label => (
                    <Badge key={`${p.id}-${label}`} variant="outline">{label}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)} disabled={saving || loading}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(p.id)} disabled={saving}>Delete</Button>
                </div>
              </div>
            ))}
            {!plans.length && <div className="text-sm text-muted-foreground">No plans yet.</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
