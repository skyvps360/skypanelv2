import React, { useEffect, useState, useCallback } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Loader2, Key, AlertCircle, Info } from 'lucide-react'

interface EnvVar {
  id: string
  key: string
  value: string
}

interface Props {
  applicationId: string
}

export const EnvironmentVariablesTab: React.FC<Props> = ({ applicationId }) => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showValue, setShowValue] = useState<Record<string, boolean>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [varToDelete, setVarToDelete] = useState<EnvVar | null>(null)
  const [needsRedeploy, setNeedsRedeploy] = useState(false)

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadEnvVars = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/env`), {
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setEnvVars(data.data || [])
        setNeedsRedeploy(data.needs_redeploy || false)
      }
    } catch (err) {
      console.error('Failed to load environment variables:', err)
    } finally {
      setLoading(false)
    }
  }, [applicationId, authHeaders])

  useEffect(() => {
    void loadEnvVars()
  }, [loadEnvVars])

  const handleAdd = useCallback(async () => {
    if (!newKey || !newValue) return

    setSaving(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/env`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ key: newKey, value: newValue }),
      })
      const data = await res.json()
      if (data.success) {
        setNewKey('')
        setNewValue('')
        void loadEnvVars()
      } else {
        alert(data.error || 'Failed to add environment variable')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add environment variable')
    } finally {
      setSaving(false)
    }
  }, [newKey, newValue, applicationId, authHeaders, loadEnvVars])

  const handleDeleteClick = useCallback((envVar: EnvVar) => {
    setVarToDelete(envVar)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!varToDelete) return

    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/env/${varToDelete.key}`), {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        void loadEnvVars()
        setDeleteDialogOpen(false)
      } else {
        alert(data.error || 'Failed to delete environment variable')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete environment variable')
    } finally {
      setVarToDelete(null)
    }
  }, [varToDelete, applicationId, authHeaders, loadEnvVars])

  const toggleShowValue = useCallback((key: string) => {
    setShowValue((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <div className="space-y-4">
      {needsRedeploy && (
        <div className="rounded-md border border-orange-500/50 bg-orange-500/5 px-4 py-3 text-sm text-orange-600">
          <Info className="inline h-4 w-4 mr-2" />
          Environment variables have been updated. Redeploy your application to apply the changes.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Environment Variables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {envVars.length > 0 && (
                <div className="space-y-2">
                  {envVars.map((envVar) => (
                    <div
                      key={envVar.id}
                      className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent/50"
                    >
                      <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Key</Label>
                          <p className="font-mono font-medium">{envVar.key}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Value</Label>
                          <p className="font-mono">
                            {showValue[envVar.key] ? envVar.value : '••••••••'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowValue(envVar.key)}
                      >
                        {showValue[envVar.key] ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(envVar)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Add Environment Variable</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="env-key">Key</Label>
                    <Input
                      id="env-key"
                      placeholder="API_KEY"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="env-value">Value</Label>
                    <Input
                      id="env-value"
                      type="password"
                      placeholder="secret-value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={handleAdd}
                  disabled={!newKey || !newValue || saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Variable
                    </>
                  )}
                </Button>
              </div>

              {envVars.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No environment variables configured yet
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{varToDelete?.key}</strong>? You will need
              to redeploy your application for this change to take effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
