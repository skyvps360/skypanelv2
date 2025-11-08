import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Server, Activity, AlertCircle, CheckCircle, Loader2, Trash2 } from 'lucide-react'
import { CreateApplicationModal } from '@/components/paas/CreateApplicationModal'
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

interface Application {
  id: string
  name: string
  slug: string
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed' | 'suspended'
  system_domain?: string
  instance_count: number
  region: string
  created_at: string
  updated_at: string
}

const statusColors: Record<Application['status'], string> = {
  pending: 'bg-gray-500',
  building: 'bg-blue-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  failed: 'bg-red-500',
  suspended: 'bg-orange-500',
}

const statusIcons: Record<Application['status'], React.ReactNode> = {
  pending: <Loader2 className="h-4 w-4 animate-spin" />,
  building: <Loader2 className="h-4 w-4 animate-spin" />,
  running: <CheckCircle className="h-4 w-4" />,
  stopped: <Server className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
  suspended: <AlertCircle className="h-4 w-4" />,
}

const Applications: React.FC = () => {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [runtimes, setRuntimes] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appToDelete, setAppToDelete] = useState<Application | null>(null)
  const [deleting, setDeleting] = useState(false)

  const authToken = localStorage.getItem('auth_token')

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadApplications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [appsRes, plansRes, runtimesRes, regionsRes] = await Promise.all([
        fetch(buildApiUrl('/paas/applications'), { headers: authHeaders() }),
        fetch(buildApiUrl('/paas/plans')),
        fetch(buildApiUrl('/paas/runtimes')),
        fetch(buildApiUrl('/paas/regions')),
      ])
      const [appsData, plansData, runtimesData, regionsData] = await Promise.all([
        appsRes.json(),
        plansRes.json(),
        runtimesRes.json(),
        regionsRes.json(),
      ])
      if (appsData.success) {
        setApplications(appsData.data || [])
      } else {
        setError(appsData.error || 'Failed to load applications')
      }
      setPlans(plansData.data || [])
      setRuntimes(runtimesData.data || [])
      setRegions(regionsData.data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  const handleCreateSuccess = useCallback(() => {
    setCreateModalOpen(false)
    void loadApplications()
  }, [loadApplications])

  const handleDeleteClick = useCallback((app: Application) => {
    setAppToDelete(app)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!appToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${appToDelete.id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        void loadApplications()
        setDeleteDialogOpen(false)
      } else {
        alert(data.error || 'Failed to delete application')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete application')
    } finally {
      setDeleting(false)
      setAppToDelete(null)
    }
  }, [appToDelete, authHeaders, loadApplications])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-2">
            Deploy and manage your containerized applications
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create Application
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="inline h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`skeleton-${idx}`}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card className="p-12 text-center">
          <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first application
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Application
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <Card
              key={app.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/applications/${app.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{app.name}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`${statusColors[app.status]} text-white`}
                      >
                        <span className="mr-1">{statusIcons[app.status]}</span>
                        {app.status}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(app)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {app.system_domain && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Domain:</span>{' '}
                    <a
                      href={`https://${app.system_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {app.system_domain}
                    </a>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Region:</span> {app.region}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Instances:</span>{' '}
                  {app.instance_count}
                </div>
                <div className="text-sm text-muted-foreground">
                  Created {formatDate(app.created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateApplicationModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        token={authToken}
        plans={plans}
        runtimes={runtimes}
        regions={regions}
        onCreated={handleCreateSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{appToDelete?.name}</strong>? This action
              cannot be undone. All data, containers, and configurations will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Applications
