import React, { useState, useCallback } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, GitBranch, Scale, Package, Loader2, AlertCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface Props {
  applicationId: string
  application: any
  onUpdate: () => void
}

export const SettingsTab: React.FC<Props> = ({ applicationId, application, onUpdate }) => {
  const [gitRepoUrl, setGitRepoUrl] = useState(application.git_repo_url || '')
  const [gitBranch, setGitBranch] = useState(application.git_branch || 'main')
  const [autoDeploy, setAutoDeploy] = useState(application.auto_deploy || false)
  const [instanceCount, setInstanceCount] = useState(application.instance_count || 1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const handleSaveGit = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}`), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          git_repo_url: gitRepoUrl,
          git_branch: gitBranch,
          auto_deploy: autoDeploy,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate()
      } else {
        setError(data.error || 'Failed to update Git settings')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update Git settings')
    } finally {
      setSaving(false)
    }
  }, [applicationId, gitRepoUrl, gitBranch, autoDeploy, authHeaders, onUpdate])

  const handleScale = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/scale`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ instance_count: instanceCount }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate()
      } else {
        setError(data.error || 'Failed to scale application')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to scale application')
    } finally {
      setSaving(false)
    }
  }, [applicationId, instanceCount, authHeaders, onUpdate])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/applications'
      } else {
        alert(data.error || 'Failed to delete application')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete application')
    } finally {
      setDeleting(false)
    }
  }, [applicationId, authHeaders])

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="inline h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git Configuration
          </CardTitle>
          <CardDescription>
            Configure your Git repository and automatic deployment settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="git_repo_url">Repository URL</Label>
            <Input
              id="git_repo_url"
              placeholder="https://github.com/username/repo.git"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="git_branch">Branch</Label>
            <Input
              id="git_branch"
              placeholder="main"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_deploy">Auto-deploy on push</Label>
              <p className="text-sm text-muted-foreground">
                Automatically deploy when changes are pushed to the branch
              </p>
            </div>
            <Switch
              id="auto_deploy"
              checked={autoDeploy}
              onCheckedChange={setAutoDeploy}
              disabled={saving}
            />
          </div>
          <Button onClick={handleSaveGit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Git Settings'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Scaling
          </CardTitle>
          <CardDescription>
            Adjust the number of instances running for this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance_count">Instance Count</Label>
            <Select
              value={instanceCount.toString()}
              onValueChange={(value) => setInstanceCount(Number(value))}
            >
              <SelectTrigger id="instance_count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} {count === 1 ? 'instance' : 'instances'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Higher instance counts increase redundancy and capacity (billing scales accordingly)
            </p>
          </div>
          <Button onClick={handleScale} disabled={saving || instanceCount === application.instance_count}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scaling...
              </>
            ) : (
              'Update Scaling'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Package className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Application
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{application.name}</strong>? This action
              cannot be undone. All containers, data, and configurations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
