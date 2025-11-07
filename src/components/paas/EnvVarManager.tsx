import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildApiUrl } from '@/lib/api'
import type { EnvVarSummary, PaasApplication } from '@/types/paas'
import { Badge } from '@/components/ui/badge'
import { Loader2, Trash2 } from 'lucide-react'

interface Props {
  application: PaasApplication | null
  token?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EnvVarManager: React.FC<Props> = ({ application, token, open, onOpenChange }) => {
  const [variables, setVariables] = useState<EnvVarSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ key: '', value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token])

  const loadVariables = useCallback(async () => {
    if (!application || !token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${application.id}/env`), {
        headers: authHeader,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load environment variables')
      setVariables(Array.isArray(data.data) ? data.data : [])
    } catch (err: any) {
      setError(err?.message || 'Unable to load environment variables')
    } finally {
      setLoading(false)
    }
  }, [application, token, authHeader])

  useEffect(() => {
    if (open) {
      void loadVariables()
    } else {
      setForm({ key: '', value: '' })
      setError(null)
    }
  }, [open, loadVariables])

  const addVariable = async () => {
    if (!application || !token || !form.key.trim() || !form.value.length) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${application.id}/env`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ key: form.key.trim().toUpperCase(), value: form.value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save variable')
      setForm({ key: '', value: '' })
      await loadVariables()
    } catch (err: any) {
      setError(err?.message || 'Unable to save variable')
    } finally {
      setSaving(false)
    }
  }

  const deleteVariable = async (key: string) => {
    if (!application || !token) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${application.id}/env/${encodeURIComponent(key)}`), {
        method: 'DELETE',
        headers: authHeader,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to delete variable')
      }
      await loadVariables()
    } catch (err: any) {
      setError(err?.message || 'Unable to delete variable')
    } finally {
      setSaving(false)
    }
  }

  const disabled = !token || !application

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Environment variables</DialogTitle>
          <DialogDescription>
            Values are encrypted at rest. You can update a variable by re-saving it with the same key.
          </DialogDescription>
        </DialogHeader>

        {!token && (
          <Alert variant="destructive">
            <AlertDescription>Sign in again to manage environment variables.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">Add variable</Label>
            <div className="grid gap-2 md:grid-cols-[1fr,1fr]">
              <Input
                placeholder="KEY"
                value={form.key}
                onChange={e => setForm(prev => ({ ...prev, key: e.target.value }))}
                disabled={disabled}
              />
              <Input
                placeholder="Secret value"
                value={form.value}
                onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
                disabled={disabled}
              />
            </div>
            <Button onClick={() => void addVariable()} disabled={disabled || saving || !form.key.trim() || !form.value}>
              {saving ? 'Saving…' : 'Save variable'}
            </Button>
            <p className="text-xs text-muted-foreground">Values are hidden after saving. Re-enter to update.</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Current variables</Label>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <ScrollArea className="max-h-64 rounded-md border">
              <div className="divide-y">
                {variables.length === 0 && !loading && (
                  <p className="p-3 text-sm text-muted-foreground">No environment variables yet.</p>
                )}
                {variables.map(variable => (
                  <div key={variable.key} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Badge variant="outline" className="font-mono text-xs">{variable.key}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteVariable(variable.key)}
                      disabled={disabled || saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
