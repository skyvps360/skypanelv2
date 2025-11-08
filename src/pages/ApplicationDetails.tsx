import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Server,
  Activity,
  Terminal,
  Settings,
  Database,
  GitBranch,
  TrendingUp,
} from 'lucide-react'
import { EnvironmentVariablesTab } from '@/components/paas/EnvironmentVariablesTab'
import { BuildHistoryTab } from '@/components/paas/BuildHistoryTab'
import { LogsTab } from '@/components/paas/LogsTab'
import { MetricsTab } from '@/components/paas/MetricsTab'
import { DatabasesTab } from '@/components/paas/DatabasesTab'
import { SettingsTab } from '@/components/paas/SettingsTab'

interface Application {
  id: string
  name: string
  slug: string
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed' | 'suspended'
  system_domain?: string
  custom_domains?: any[]
  instance_count: number
  region: string
  git_repo_url?: string
  git_branch?: string
  auto_deploy: boolean
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

const ApplicationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadApplication = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}`), {
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setApplication(data.data)
      } else {
        setError(data.error || 'Failed to load application')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load application')
    } finally {
      setLoading(false)
    }
  }, [id, authHeaders])

  useEffect(() => {
    void loadApplication()
    // Auto-refresh every 10 seconds for status updates
    const interval = setInterval(() => {
      void loadApplication()
    }, 10000)
    return () => clearInterval(interval)
  }, [loadApplication])

  const handleAction = useCallback(
    async (action: 'deploy' | 'restart' | 'stop' | 'start' | 'delete') => {
      if (!id || !application) return
      setActionLoading(action)

      try {
        let endpoint = ''
        let method = 'POST'

        switch (action) {
          case 'deploy':
            endpoint = `/paas/applications/${id}/deploy`
            break
          case 'restart':
            endpoint = `/paas/applications/${id}/restart`
            break
          case 'stop':
            endpoint = `/paas/applications/${id}/stop`
            break
          case 'start':
            endpoint = `/paas/applications/${id}/start`
            break
          case 'delete':
            endpoint = `/paas/applications/${id}`
            method = 'DELETE'
            break
        }

        const res = await fetch(buildApiUrl(endpoint), {
          method,
          headers: authHeaders(),
        })
        const data = await res.json()

        if (data.success) {
          if (action === 'delete') {
            navigate('/applications')
          } else {
            void loadApplication()
          }
        } else {
          alert(data.error || `Failed to ${action} application`)
        }
      } catch (err: any) {
        alert(err?.message || `Failed to ${action} application`)
      } finally {
        setActionLoading(null)
      }
    },
    [id, application, authHeaders, loadApplication, navigate]
  )

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading && !application) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="inline h-4 w-4 mr-2" />
          {error || 'Application not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/applications')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{application.name}</h1>
              <Badge variant="secondary" className={`${statusColors[application.status]} text-white`}>
                <span className="mr-1">{statusIcons[application.status]}</span>
                {application.status}
              </Badge>
            </div>
            {application.system_domain && (
              <p className="text-muted-foreground mt-2">
                <a
                  href={`https://${application.system_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {application.system_domain}
                </a>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {application.status === 'stopped' ? (
            <Button
              onClick={() => handleAction('start')}
              disabled={!!actionLoading}
              variant="default"
            >
              {actionLoading === 'start' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          ) : application.status === 'running' ? (
            <>
              <Button
                onClick={() => handleAction('deploy')}
                disabled={!!actionLoading}
                variant="default"
              >
                {actionLoading === 'deploy' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="mr-2 h-4 w-4" />
                )}
                Deploy
              </Button>
              <Button
                onClick={() => handleAction('restart')}
                disabled={!!actionLoading}
                variant="outline"
              >
                {actionLoading === 'restart' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="mr-2 h-4 w-4" />
                )}
                Restart
              </Button>
              <Button
                onClick={() => handleAction('stop')}
                disabled={!!actionLoading}
                variant="outline"
              >
                {actionLoading === 'stop' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Stop
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Region</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{application.region}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{application.instance_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatDate(application.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">
            <Terminal className="mr-2 h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <TrendingUp className="mr-2 h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="builds">
            <Activity className="mr-2 h-4 w-4" />
            Builds
          </TabsTrigger>
          <TabsTrigger value="env">
            <Settings className="mr-2 h-4 w-4" />
            Environment
          </TabsTrigger>
          <TabsTrigger value="databases">
            <Database className="mr-2 h-4 w-4" />
            Databases
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <LogsTab applicationId={id!} />
        </TabsContent>

        <TabsContent value="metrics">
          <MetricsTab applicationId={id!} />
        </TabsContent>

        <TabsContent value="builds">
          <BuildHistoryTab applicationId={id!} />
        </TabsContent>

        <TabsContent value="env">
          <EnvironmentVariablesTab applicationId={id!} />
        </TabsContent>

        <TabsContent value="databases">
          <DatabasesTab applicationId={id!} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab applicationId={id!} application={application} onUpdate={loadApplication} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ApplicationDetails
