import React, { useEffect, useState, useCallback } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Activity, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'

interface Build {
  id: string
  build_number: number
  status: 'pending' | 'building' | 'success' | 'failed'
  git_commit_sha?: string
  git_commit_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

interface Props {
  applicationId: string
}

const statusColors: Record<Build['status'], string> = {
  pending: 'bg-gray-500',
  building: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
}

const statusIcons: Record<Build['status'], React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  building: <Loader2 className="h-3 w-3 animate-spin" />,
  success: <CheckCircle className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
}

export const BuildHistoryTab: React.FC<Props> = ({ applicationId }) => {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingLogs, setViewingLogs] = useState<string | null>(null)
  const [buildLogs, setBuildLogs] = useState<string>('')

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadBuilds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/builds`), {
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setBuilds(data.data || [])
      }
    } catch (err) {
      console.error('Failed to load builds:', err)
    } finally {
      setLoading(false)
    }
  }, [applicationId, authHeaders])

  useEffect(() => {
    void loadBuilds()
  }, [loadBuilds])

  const handleViewLogs = useCallback(
    async (buildId: string) => {
      setViewingLogs(buildId)
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/builds/${buildId}/logs`), {
          headers: authHeaders(),
        })
        const data = await res.json()
        if (data.success) {
          setBuildLogs(data.data?.build_log || 'No logs available')
        }
      } catch (err) {
        console.error('Failed to load build logs:', err)
        setBuildLogs('Failed to load logs')
      }
    },
    [applicationId, authHeaders]
  )

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (viewingLogs) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Build Logs #{builds.find((b) => b.id === viewingLogs)?.build_number}</CardTitle>
            <Button variant="outline" onClick={() => setViewingLogs(null)}>
              Back to Builds
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-black text-green-400 p-4 rounded-md overflow-auto max-h-[600px] font-mono text-sm">
            {buildLogs}
          </pre>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Build History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {builds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No builds yet. Deploy your application to create a build.
          </div>
        ) : (
          <div className="space-y-3">
            {builds.map((build) => (
              <div key={build.id} className="border rounded-md p-4 hover:bg-accent/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">Build #{build.build_number}</span>
                      <Badge variant="secondary" className={`${statusColors[build.status]} text-white`}>
                        <span className="mr-1">{statusIcons[build.status]}</span>
                        {build.status}
                      </Badge>
                    </div>
                    {build.git_commit_message && (
                      <p className="text-sm text-muted-foreground mt-1">{build.git_commit_message}</p>
                    )}
                    {build.git_commit_sha && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {build.git_commit_sha.substring(0, 7)}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      Started: {formatDate(build.started_at)} •{' '}
                      {build.completed_at ? `Completed: ${formatDate(build.completed_at)}` : 'In progress'}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleViewLogs(build.id)}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Logs
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
