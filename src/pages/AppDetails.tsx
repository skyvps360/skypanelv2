import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, GitBranch, RefreshCw, Play, Square, ShieldAlert, Plus, Globe, Trash2, Link2, Unlink, Database, BarChart3, Copy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { buildApiUrl } from '@/lib/api'
import type { PaasApplication, PaasPlan, PaasRuntime, PaasDatabase, PaasDatabaseLink, PaasApplicationMetric, PaasRegion, PaasApplicationBilling } from '@/types/paas'
import { formatHourlyRate, formatMonthlyPrice } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { EnvVarManager } from '@/components/paas/EnvVarManager'
import { PlanUpgradeModal } from '@/components/paas/PlanUpgradeModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

const STATUS_META: Record<
  PaasApplication['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
  building: { label: 'Building', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  running: { label: 'Running', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  stopped: { label: 'Stopped', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  suspended: { label: 'Suspended', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
}

interface BuildRecord {
  id: string
  build_number: number
  status: string
  started_at?: string
  completed_at?: string
  image_tag?: string
}

const DB_TYPE_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL', versions: ['16', '15', '14'] },
  { value: 'mysql', label: 'MySQL', versions: ['8.0', '5.7'] },
]

const METRIC_POLL_INTERVAL_MS = 60_000

const AppDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token])
  const [app, setApp] = useState<PaasApplication | null>(null)
  const [plans, setPlans] = useState<PaasPlan[]>([])
  const [runtimes, setRuntimes] = useState<PaasRuntime[]>([])
  const [builds, setBuilds] = useState<BuildRecord[]>([])
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null)
  const [buildLogs, setBuildLogs] = useState<string>('')
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [runtimeLogs, setRuntimeLogs] = useState<string>('Connecting to runtime logs...')
  const [runtimeLogStatus, setRuntimeLogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [envOpen, setEnvOpen] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [githubBusy, setGithubBusy] = useState<'toggle' | 'unlink' | null>(null)
  const [metrics, setMetrics] = useState<PaasApplicationMetric[]>([])
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [regions, setRegions] = useState<PaasRegion[]>([])
  const [databases, setDatabases] = useState<PaasDatabase[]>([])
  const [linkedDatabases, setLinkedDatabases] = useState<PaasDatabaseLink[]>([])
  const [databasesLoading, setDatabasesLoading] = useState(false)
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false)
  const [databaseForm, setDatabaseForm] = useState({
    name: '',
    db_type: 'postgresql',
    version: '16',
    plan_id: '',
    region: '',
  })
  const [databaseError, setDatabaseError] = useState<string | null>(null)
  const [createDbBusy, setCreateDbBusy] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [domainBusy, setDomainBusy] = useState(false)
  const [scaleValue, setScaleValue] = useState(1)
  const [scaleBusy, setScaleBusy] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [billingInfo, setBillingInfo] = useState<PaasApplicationBilling | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [planUpdating, setPlanUpdating] = useState(false)
  const buildLogController = useRef<AbortController | null>(null)
  const runtimeLogController = useRef<AbortController | null>(null)
  const appendRuntimeLog = useCallback((line: string) => {
    setRuntimeLogs(prev => {
      const next = prev ? `${prev}\n${line}` : line
      return next.length > 20000 ? next.slice(next.length - 20000) : next
    })
  }, [])
  const planMap = useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const runtimeMap = useMemo(() => new Map(runtimes.map(rt => [rt.id, rt])), [runtimes])
  const plan = app?.plan_id ? planMap.get(app.plan_id) : null
  const runtime = app?.runtime_id ? runtimeMap.get(app.runtime_id) : null
  const cpuCapacity = plan?.cpu_millicores || 1000
  const memoryCapacity = plan?.memory_mb || null
  const metricSeries = useMemo(
    () =>
      metrics.map(metric => ({
        created_at: metric.created_at,
        time: new Date(metric.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: metric.cpu_millicores,
        cpuPercent: cpuCapacity ? Math.min(100, Number(((metric.cpu_millicores / cpuCapacity) * 100).toFixed(2))) : metric.cpu_millicores,
        memory: metric.memory_mb,
        memoryPercent: memoryCapacity ? Math.min(100, Number(((metric.memory_mb / memoryCapacity) * 100).toFixed(2))) : null,
        requestRate: metric.request_rate ?? 0,
      })),
    [metrics, cpuCapacity, memoryCapacity]
  )
  const latestMetric = metricSeries.length ? metricSeries[metricSeries.length - 1] : null
  const linkedDatabaseIds = useMemo(() => new Set(linkedDatabases.map(db => db.id)), [linkedDatabases])
  const customDomains = useMemo(() => {
    if (!app?.custom_domains) return []
    if (Array.isArray(app.custom_domains)) {
      return app.custom_domains.map((entry: any) =>
        typeof entry === 'string' ? { domain: entry, status: 'pending_verification' } : entry
      )
    }
    return []
  }, [app?.custom_domains])
  const selectedDbType = DB_TYPE_OPTIONS.find(option => option.value === databaseForm.db_type) ?? DB_TYPE_OPTIONS[0]

  const fetchBasics = useCallback(async () => {
    if (!id || !authHeaders) return
    setLoading(true)
    setPageError(null)
    try {
      const [appRes, plansRes, runtimesRes, regionsRes] = await Promise.all([
        fetch(buildApiUrl(`/paas/applications/${id}`), { headers: authHeaders }),
        fetch(buildApiUrl('/paas/plans')),
        fetch(buildApiUrl('/paas/runtimes')),
        fetch(buildApiUrl('/paas/regions')),
      ])
      const appJson = await appRes.json().catch(() => ({}))
      if (!appRes.ok) throw new Error(appJson?.error || 'Application not found')
      const nextApp = appJson.data || null
      setApp(nextApp)
      if (nextApp?.instance_count) {
        setScaleValue(Math.max(1, Number(nextApp.instance_count) || 1))
      }

      const planJson = await plansRes.json().catch(() => ({}))
      setPlans(Array.isArray(planJson.data) ? planJson.data : [])

      const runtimeJson = await runtimesRes.json().catch(() => ({}))
      setRuntimes(Array.isArray(runtimeJson.data) ? runtimeJson.data : [])

      const regionJson = await regionsRes.json().catch(() => ({}))
      setRegions(Array.isArray(regionJson.data) ? regionJson.data : [])
    } catch (err: any) {
      setPageError(err?.message || 'Unable to load application')
    } finally {
      setLoading(false)
    }
  }, [id, authHeaders])

  const fetchBuilds = useCallback(async () => {
    if (!id || !authHeaders) return
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/builds`), { headers: authHeaders })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load builds')
      setBuilds(Array.isArray(data.data) ? data.data : [])
    } catch (err: any) {
      toast.error(err?.message || 'Unable to load builds')
    }
  }, [id, authHeaders])

  const fetchMetrics = useCallback(async () => {
    if (!id || !authHeaders) return
    setMetricsLoading(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/metrics`), { headers: authHeaders })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load metrics')
      setMetrics(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      console.warn('Unable to load metrics', err)
    } finally {
      setMetricsLoading(false)
    }
  }, [id, authHeaders])

  const fetchDatabases = useCallback(async () => {
    if (!id || !authHeaders) return
    setDatabasesLoading(true)
    try {
      const [allRes, linkedRes] = await Promise.all([
        fetch(buildApiUrl('/paas/databases'), { headers: authHeaders }),
        fetch(buildApiUrl(`/paas/applications/${id}/databases`), { headers: authHeaders }),
      ])
      const allJson = await allRes.json().catch(() => ({}))
      if (!allRes.ok) throw new Error(allJson?.error || 'Failed to load databases')
      setDatabases(Array.isArray(allJson.data) ? allJson.data : [])

      const linkedJson = await linkedRes.json().catch(() => ({}))
      if (!linkedRes.ok) throw new Error(linkedJson?.error || 'Failed to load linked databases')
      setLinkedDatabases(Array.isArray(linkedJson.data) ? linkedJson.data : [])
    } catch (err: any) {
      toast.error(err?.message || 'Unable to load databases')
    } finally {
      setDatabasesLoading(false)
    }
  }, [id, authHeaders])

  const fetchBilling = useCallback(async () => {
    if (!id || !authHeaders) return
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/billing`), { headers: authHeaders })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to load billing')
      setBillingInfo(data.data || null)
    } catch (err) {
      console.warn('Unable to load billing info', err)
    }
  }, [id, authHeaders])

  const handlePlanUpgrade = useCallback(async (planId: string) => {
    if (!id || !authHeaders) return
    setPlanUpdating(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/upgrade`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ plan_id: planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to change plan')
      if (data?.data) {
        setApp(prev => (prev ? { ...prev, ...data.data } : data.data))
        toast.success('Plan updated. Redeploy to apply resource changes.')
      }
      await fetchBilling()
      await fetchBasics()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to change plan')
    } finally {
      setPlanUpdating(false)
    }
  }, [id, authHeaders, fetchBilling, fetchBasics])

  useEffect(() => {
    if (authHeaders && id) {
      void fetchBasics()
      void fetchBuilds()
      void fetchMetrics()
      void fetchDatabases()
      void fetchBilling()
    }
  }, [authHeaders, id, fetchBasics, fetchBuilds, fetchMetrics, fetchDatabases, fetchBilling])

  useEffect(() => {
    if (!authHeaders || !id) return
    const interval = setInterval(() => {
      void fetchMetrics()
    }, METRIC_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [authHeaders, id, fetchMetrics])

  useEffect(() => {
    if (regions.length === 0) return
    setDatabaseForm(prev => (prev.region ? prev : { ...prev, region: regions[0].region }))
  }, [regions])

  useEffect(() => {
    return () => {
      buildLogController.current?.abort()
      runtimeLogController.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!id || !authHeaders) return
    runtimeLogController.current?.abort()
    const controller = new AbortController()
    runtimeLogController.current = controller
    setRuntimeLogStatus('loading')
    setRuntimeLogs('Connecting to runtime logs...')
    fetchEventSource(buildApiUrl(`/paas/applications/${id}/logs/stream`), {
      headers: authHeaders,
      signal: controller.signal,
      onopen: async response => {
        if (!response.ok) throw new Error('Failed to open runtime log stream')
      },
      onmessage: msg => {
        if (msg.event === 'history') {
          try {
            const payload = JSON.parse(msg.data)
            if (typeof payload === 'string') {
              setRuntimeLogs(payload)
            } else {
              setRuntimeLogs('')
            }
          } catch {
            setRuntimeLogs(msg.data || '')
          }
          setRuntimeLogStatus('ready')
        } else if (msg.event === 'chunk') {
          try {
            const parsed = JSON.parse(msg.data)
            if (parsed?.chunk) {
              const ts = parsed?.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()
              appendRuntimeLog(`[${ts}] ${parsed.chunk}`)
            }
          } catch {
            appendRuntimeLog(msg.data || '')
          }
          setRuntimeLogStatus('ready')
        }
      },
      onerror: err => {
        if (controller.signal.aborted) return
        setRuntimeLogStatus('error')
        setRuntimeLogs(err?.message || 'Runtime log stream disconnected.')
        controller.abort()
      },
    }).catch(err => {
      if (controller.signal.aborted) return
      setRuntimeLogStatus('error')
      setRuntimeLogs(err?.message || 'Runtime log stream disconnected.')
    })
    return () => controller.abort()
  }, [id, authHeaders, appendRuntimeLog])

  const handleAction = useCallback(
    async (action: 'deploy' | 'restart' | 'stop' | 'start') => {
      if (!id || !authHeaders) return
      setActioning(true)
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/${action === 'deploy' ? 'deploy' : action}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `Failed to ${action}`)
        toast.success(action === 'deploy' ? 'Deployment queued' : `Application ${action}ed`)
        await fetchBasics()
        if (action === 'deploy') await fetchBuilds()
      } catch (err: any) {
        toast.error(err?.message || `Unable to ${action}`)
      } finally {
        setActioning(false)
      }
    },
    [id, authHeaders, fetchBasics, fetchBuilds]
  )

  const handleToggleAutoDeploy = useCallback(
    async (enabled: boolean) => {
      if (!id || !authHeaders) return
      setGithubBusy('toggle')
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/github/auto-deploy`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ enabled }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to update auto-deploy')
        if (data?.data) {
          setApp(data.data)
        } else {
          await fetchBasics()
        }
        toast.success(`Auto deploy ${enabled ? 'enabled' : 'disabled'}`)
      } catch (err: any) {
        toast.error(err?.message || 'Unable to update auto-deploy')
      } finally {
        setGithubBusy(null)
      }
    },
    [id, authHeaders, fetchBasics]
  )

  const handleGithubDisconnect = useCallback(async () => {
    if (!id || !authHeaders) return
    setGithubBusy('unlink')
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/github`), {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to disconnect GitHub')
      toast.success('GitHub disconnected')
      await fetchBasics()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to disconnect GitHub')
    } finally {
      setGithubBusy(null)
    }
  }, [authHeaders, fetchBasics, id])

  const handleLoadLogs = useCallback((buildId: string) => {
    if (!id || !authHeaders) return
    buildLogController.current?.abort()
    const controller = new AbortController()
    buildLogController.current = controller
    setSelectedBuildId(buildId)
    setLoadingLogs(true)
    setBuildLogs('')
    fetchEventSource(buildApiUrl(`/paas/applications/${id}/builds/${buildId}/logs/stream`), {
      headers: authHeaders,
      signal: controller.signal,
      onopen: async response => {
        if (!response.ok) {
          throw new Error('Failed to open log stream')
        }
      },
      onmessage: msg => {
        if (msg.event === 'history') {
          setBuildLogs(msg.data || '')
          setLoadingLogs(false)
        } else if (msg.event === 'chunk' && msg.data) {
          setBuildLogs(prev => (prev ? `${prev}${msg.data}` : msg.data))
        } else if (msg.event === 'status' && msg.data) {
          // optionally handle status
        }
      },
      onerror: err => {
        if (controller.signal.aborted) return
        setLoadingLogs(false)
        setBuildLogs(err?.message || 'Unable to stream logs')
        controller.abort()
      },
    }).catch(err => {
      if (controller.signal.aborted) return
      setLoadingLogs(false)
      setBuildLogs(err?.message || 'Unable to stream logs')
    })
  }, [id, authHeaders])

  const handleScaleSubmit = useCallback(async () => {
    if (!id || !authHeaders) return
    setScaleBusy(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/scale`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ instance_count: scaleValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update scaling')
      toast.success(`Scaling to ${scaleValue} instance${scaleValue === 1 ? '' : 's'}`)
      await fetchBasics()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to update scaling')
    } finally {
      setScaleBusy(false)
    }
  }, [id, authHeaders, scaleValue, fetchBasics])

  const handlePlanChange = useCallback(
    async (planId: string) => {
      if (!id || !authHeaders || !planId) return
      setPlanBusy(true)
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/upgrade`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
          body: JSON.stringify({ plan_id: planId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to update plan')
        toast.success('Plan updated')
        await fetchBasics()
      } catch (err: any) {
        toast.error(err?.message || 'Unable to update plan')
      } finally {
        setPlanBusy(false)
      }
    },
    [id, authHeaders, fetchBasics]
  )

  const handleAddDomain = useCallback(async () => {
    if (!id || !authHeaders) return
    const domain = domainInput.trim()
    if (!domain) return
    setDomainBusy(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${id}/domains`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to add domain')
      toast.success('Domain added')
      setDomainInput('')
      await fetchBasics()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to add domain')
    } finally {
      setDomainBusy(false)
    }
  }, [id, authHeaders, domainInput, fetchBasics])

  const handleRemoveDomain = useCallback(
    async (domain: string) => {
      if (!id || !authHeaders) return
      setDomainBusy(true)
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/domains/${encodeURIComponent(domain)}`), {
          method: 'DELETE',
          headers: authHeaders,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Failed to remove domain')
        }
        toast.success('Domain removed')
        await fetchBasics()
      } catch (err: any) {
        toast.error(err?.message || 'Unable to remove domain')
      } finally {
        setDomainBusy(false)
      }
    },
    [id, authHeaders, fetchBasics]
  )

  const handleCreateDatabase = useCallback(async () => {
    if (!authHeaders) return
    if (!databaseForm.name.trim() || !databaseForm.region) {
      setDatabaseError('Name and region are required')
      return
    }
    setCreateDbBusy(true)
    setDatabaseError(null)
    try {
      const res = await fetch(buildApiUrl('/paas/databases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({
          name: databaseForm.name.trim(),
          db_type: databaseForm.db_type,
          version: databaseForm.version,
          plan_id: databaseForm.plan_id || undefined,
          region: databaseForm.region,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create database')
      toast.success('Database provisioning started')
      setDatabaseForm(prev => ({ ...prev, name: '' }))
      setDatabaseModalOpen(false)
      await fetchDatabases()
    } catch (err: any) {
      setDatabaseError(err?.message || 'Unable to create database')
    } finally {
      setCreateDbBusy(false)
    }
  }, [authHeaders, databaseForm, fetchDatabases])

  const handleLinkDatabase = useCallback(
    async (dbId: string) => {
      if (!authHeaders || !id) return
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/databases/${dbId}`), {
          method: 'POST',
          headers: authHeaders,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to link database')
        toast.success('Database linked')
        await fetchDatabases()
      } catch (err: any) {
        toast.error(err?.message || 'Unable to link database')
      }
    },
    [authHeaders, id, fetchDatabases]
  )

  const handleUnlinkDatabase = useCallback(
    async (dbId: string) => {
      if (!authHeaders || !id) return
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${id}/databases/${dbId}`), {
          method: 'DELETE',
          headers: authHeaders,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to unlink database')
        toast.success('Database unlinked')
        await fetchDatabases()
      } catch (err: any) {
        toast.error(err?.message || 'Unable to unlink database')
      }
    },
    [authHeaders, id, fetchDatabases]
  )

  const handleCopy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied')
    } catch {
      toast.error('Unable to copy')
    }
  }, [])

  const statusMeta = app ? STATUS_META[app.status] : null

  if (!token) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>You need to be signed in to view applications.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (pageError || !app) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Button variant="ghost" asChild>
          <Link to="/apps">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to applications
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{pageError || 'Application not found.'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" asChild className="px-0 text-muted-foreground hover:text-foreground">
            <Link to="/apps">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to applications
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold">{app.name}</h1>
          <p className="text-sm text-muted-foreground">Region {app.region.toUpperCase()} • Created {new Date(app.created_at || '').toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={actioning} onClick={() => void handleAction('deploy')}>
            <RefreshCw className="mr-2 h-4 w-4" /> Deploy
          </Button>
          <Button variant="outline" disabled={actioning} onClick={() => void handleAction('restart')}>
            <RefreshCw className="mr-2 h-4 w-4" /> Restart
          </Button>
          {app.status === 'running' ? (
            <Button variant="destructive" disabled={actioning} onClick={() => void handleAction('stop')}>
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button variant="default" disabled={actioning} onClick={() => void handleAction('start')}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
        </div>
      </div>

      {app.needs_redeploy && (
        <Alert className="border-amber-500/30 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/30">
          <AlertDescription>
            Recent configuration or environment variable changes require a redeploy. Deploy the application to apply them.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              Status
              {statusMeta && <Badge className={statusMeta.className}>{statusMeta.label}</Badge>}
            </CardTitle>
            <CardDescription>Track resources, plan limits, and Git integration.</CardDescription>
          </div>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground">Plan</div>
              {plan ? (
                <div>
                  {plan.name} • {plan.cpu_millicores}m / {plan.memory_mb}MB / {plan.storage_gb}GB
                </div>
              ) : (
                <div>Unassigned</div>
              )}
            </div>
            <div>
              <div className="font-medium text-foreground">Runtime</div>
              {runtime ? `${runtime.runtime_type}@${runtime.version}` : 'Unassigned'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan && (
            <div className="text-sm text-muted-foreground">
              {formatHourlyRate(plan.price_hourly)} /hr • {formatMonthlyPrice(plan.price_monthly)} /mo equivalent
            </div>
          )}
          {app.git_repo_url ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="font-mono">{app.git_repo_full_name || app.git_repo_url}</span>
              <Badge variant="outline">{app.git_branch || 'main'}</Badge>
              {app.auto_deploy && <Badge variant="secondary">Auto deploy</Badge>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Git repository not configured.
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Instances: {app.instance_count || 1} • System domain: {app.system_domain || '—'}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="builds">Builds</TabsTrigger>
          <TabsTrigger value="databases">Databases</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Plan & billing</CardTitle>
                <CardDescription>Resource limits and month-to-date usage.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setUpgradeOpen(true)} disabled={planUpdating || !plans.length}>
                {planUpdating ? 'Updating...' : 'Change plan'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
                  {plan ? (
                    <>
                      <div className="text-base font-semibold text-foreground">{plan.name}</div>
                      <div>
                        {plan.cpu_millicores}m CPU • {plan.memory_mb}MB RAM • {plan.storage_gb}GB SSD
                      </div>
                      <div>{formatHourlyRate(plan.price_hourly)} / hr</div>
                    </>
                  ) : (
                    <div>Unassigned</div>
                  )}
                </div>
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Month-to-date</div>
                  <div className="text-2xl font-semibold text-foreground">
                    {formatMonthlyPrice(billingInfo?.currentMonthTotal ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Charges for this application</div>
                </div>
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Runtime</div>
                  <div className="text-base font-semibold text-foreground">
                    {runtime ? `${runtime.runtime_type}@${runtime.version}` : 'Unassigned'}
                  </div>
                  <div>Instances: {app.instance_count || 1}</div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent months</div>
                {billingInfo?.history?.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {billingInfo.history.map(entry => (
                      <div key={entry.month} className="rounded-md border p-3 text-sm text-muted-foreground">
                        <div className="font-semibold text-foreground">
                          {new Date(entry.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </div>
                        <div>{formatMonthlyPrice(entry.total)}</div>
                        <div className="text-xs">{entry.hours} hours billed</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Billing data will appear after the first hourly charge.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance
              </CardTitle>
              <CardDescription>CPU, memory, and request metrics from the last 24 hours.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metricsLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="rounded-md border p-4">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="mt-2 h-8 w-2/3" />
                      <Skeleton className="mt-1 h-3 w-1/2" />
                    </div>
                  ))}
                  <Skeleton className="h-64 w-full md:col-span-3" />
                </div>
              ) : metricSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Metrics will appear once the application sends heartbeats.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground">CPU</div>
                      <div className="text-2xl font-semibold">
                        {plan
                          ? `${(latestMetric?.cpuPercent ?? 0).toFixed(1)}%`
                          : `${latestMetric?.cpu ?? 0}m`}
                      </div>
                      {plan && (
                        <div className="text-xs text-muted-foreground">
                          {(latestMetric?.cpu ?? 0)}m / {plan.cpu_millicores}m
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground">Memory</div>
                      <div className="text-2xl font-semibold">
                        {latestMetric ? `${latestMetric.memory} MB` : '—'}
                      </div>
                      {plan?.memory_mb && (
                        <div className="text-xs text-muted-foreground">
                          {(latestMetric?.memory ?? 0)} MB / {plan.memory_mb} MB
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground">Requests / min</div>
                      <div className="text-2xl font-semibold">{latestMetric?.requestRate ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Reported by agent</div>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metricSeries}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="time" minTickGap={32} />
                        <YAxis
                          yAxisId="cpu"
                          orientation="left"
                          tickFormatter={value => (plan ? `${value}%` : `${value}m`)}
                          domain={plan ? [0, 100] : ['auto', 'auto']}
                          allowDecimals={false}
                        />
                        <YAxis
                          yAxisId="memory"
                          orientation="right"
                          tickFormatter={value => `${value}MB`}
                          allowDecimals={false}
                        />
                        <Tooltip />
                        <Area
                          yAxisId="cpu"
                          type="monotone"
                          dataKey={plan ? 'cpuPercent' : 'cpu'}
                          name={plan ? 'CPU %' : 'CPU (m)'}
                          stroke="#0f172a"
                          fill="#0f172a"
                          fillOpacity={0.2}
                        />
                        <Area
                          yAxisId="memory"
                          type="monotone"
                          dataKey="memory"
                          name="Memory (MB)"
                          stroke="#0ea5e9"
                          fill="#0ea5e9"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Runtime logs</CardTitle>
              <CardDescription>Live tail streamed from worker nodes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted p-3">
                {runtimeLogStatus === 'loading' ? (
                  <div className="text-sm text-muted-foreground">{runtimeLogs}</div>
                ) : (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                    {runtimeLogs || 'No runtime logs yet.'}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
          
          
        
        </TabsContent>

        <TabsContent value="builds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Build history</CardTitle>
              <CardDescription>Latest deployments for this application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {builds.length === 0 && <p className="text-sm text-muted-foreground">No builds yet.</p>}
              {builds.map(build => (
                <div
                  key={build.id}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{build.build_number}</Badge>
                      <span className="capitalize">{build.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {build.started_at ? new Date(build.started_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant={selectedBuildId === build.id ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => void handleLoadLogs(build.id)}
                    >
                      View logs
                    </Button>
                    {build.image_tag && <Badge variant="outline">{build.image_tag}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {selectedBuildId && (
            <Card>
              <CardHeader>
                <CardTitle>Logs</CardTitle>
                <CardDescription>Build output for #{builds.find(b => b.id === selectedBuildId)?.build_number}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted p-3">
                  {loadingLogs ? (
                    <div className="text-sm text-muted-foreground">Loading logs…</div>
                  ) : (
                    <pre className="max-h-96 overflow-auto text-xs">{buildLogs || 'No logs collected.'}</pre>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        
        </TabsContent>

        <TabsContent value="databases" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Linked databases</CardTitle>
                <CardDescription>Attach managed databases to inject credentials as environment variables.</CardDescription>
              </div>
              <Button onClick={() => setDatabaseModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create database
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {databasesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-20 w-full" />
                  ))}
                </div>
              ) : linkedDatabases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No databases linked yet.</p>
              ) : (
                <div className="space-y-3">
                  {linkedDatabases.map(db => (
                    <div key={db.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          {db.name}
                          <Badge variant="outline">{db.db_type}</Badge>
                          <Badge variant="secondary">{db.status}</Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void handleUnlinkDatabase(db.id)}>
                          <Unlink className="mr-2 h-4 w-4" />
                          Unlink
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {[
                          { label: 'Host', value: db.host },
                          { label: 'Port', value: db.port?.toString() },
                          { label: 'Username', value: db.username },
                          { label: 'Password', value: db.password },
                          { label: 'Database', value: db.database_name },
                        ].map(
                          field =>
                            field.value && (
                              <div key={`${db.id}-${field.label}`}>
                                <div className="text-xs text-muted-foreground">{field.label}</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">{field.value}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleCopy(field.value!)}
                                    aria-label={`Copy ${field.label}`}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available databases</CardTitle>
              <CardDescription>Reuse existing databases across multiple applications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {databasesLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : databases.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven&apos;t provisioned any databases yet.</p>
              ) : (
                <div className="space-y-3">
                  {databases.map(db => {
                    const isLinked = linkedDatabaseIds.has(db.id)
                    return (
                      <div key={db.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            {db.name}
                            <Badge variant="outline">{db.db_type}</Badge>
                            <Badge variant={db.status === 'running' ? 'secondary' : 'outline'}>{db.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {db.host ? `${db.host}:${db.port}` : 'Provisioning...'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isLinked ? (
                            <Button variant="outline" size="sm" onClick={() => void handleUnlinkDatabase(db.id)}>
                              <Unlink className="mr-2 h-4 w-4" />
                              Unlink
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => void handleLinkDatabase(db.id)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              Link
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan & pricing</CardTitle>
              <CardDescription>Select the compute profile for this application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan-select">Hosting plan</Label>
                  <Select
                    value={app.plan_id ?? ''}
                    onValueChange={value => {
                      if (!value || value === app.plan_id) return
                      void handlePlanChange(value)
                    }}
                    disabled={planBusy || plans.length === 0}
                  >
                    <SelectTrigger id="plan-select">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(option => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} • {option.cpu_millicores}m / {option.memory_mb}MB
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {plan ? (
                    <>
                      <div className="font-medium text-foreground">{plan.name}</div>
                      <div>{plan.cpu_millicores}m CPU • {plan.memory_mb}MB RAM • {plan.storage_gb}GB SSD</div>
                      <div className="mt-1 text-xs">{formatHourlyRate(plan.price_hourly)} /hr • {formatMonthlyPrice(plan.price_monthly)} /mo</div>
                    </>
                  ) : (
                    <div>No plan selected. Select a plan to enable deployments.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scaling</CardTitle>
              <CardDescription>Adjust the number of running instances.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-[200px,auto] md:items-center">
                <div className="space-y-2">
                  <Label htmlFor="instance-count">Instances</Label>
                  <Input
                    id="instance-count"
                    type="number"
                    min={1}
                    max={20}
                    value={scaleValue}
                    onChange={e => setScaleValue(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full md:w-auto"
                    onClick={() => void handleScaleSubmit()}
                    disabled={scaleBusy || scaleValue === (app.instance_count || 1)}
                  >
                    {scaleBusy ? 'Updating…' : 'Apply scaling'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Instances are billed hourly. Current: {app.instance_count || 1}.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domains & TLS</CardTitle>
              <CardDescription>Manage the default system domain and custom domains.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">System domain</Label>
                {app.system_domain ? (
                  <div className="mt-1 flex items-center gap-2">
                    <a href={`https://${app.system_domain}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-primary hover:underline">
                      {app.system_domain}
                    </a>
                    <Button variant="outline" size="icon" onClick={() => void handleCopy(app.system_domain!)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">System domain will be assigned after the first deployment.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom domains</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="app.example.com"
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value)}
                    disabled={domainBusy}
                  />
                  <Button onClick={() => void handleAddDomain()} disabled={domainBusy || !domainInput.trim()}>
                    {domainBusy ? 'Adding…' : 'Add domain'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Updating domains requires a redeploy to apply in Nginx.</p>

                <div className="space-y-2">
                  {customDomains.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custom domains configured.</p>
                  ) : (
                    customDomains.map(domain => (
                      <div key={domain.domain} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{domain.domain}</span>
                          {domain.status && <Badge variant="outline">{domain.status}</Badge>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => void handleRemoveDomain(domain.domain)} disabled={domainBusy}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>GitHub deployment</CardTitle>
                <CardDescription>Manage repository linkage and auto-deploy webhooks.</CardDescription>
              </div>
              {app?.git_repo_url && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={githubBusy === 'unlink'}
                  onClick={() => void handleGithubDisconnect()}
                >
                  {githubBusy === 'unlink' ? 'Disconnecting…' : 'Unlink GitHub'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {app?.git_repo_url ? (
                <>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-mono text-foreground">{app.git_repo_full_name || app.git_repo_url}</div>
                    <div className="text-xs text-muted-foreground">Branch {app.git_branch || 'main'}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Auto deploy</p>
                      <p className="text-xs text-muted-foreground">
                        Trigger deployments automatically when {app.git_branch || 'main'} receives new commits.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(app.auto_deploy)}
                      onCheckedChange={checked => {
                        if (githubBusy === 'toggle') return
                        void handleToggleAutoDeploy(Boolean(checked))
                      }}
                      disabled={githubBusy === 'toggle'}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Link a GitHub repository during application creation to enable automated deployments.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Environment variables</CardTitle>
                <CardDescription>Securely manage application secrets.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setEnvOpen(true)}>
                Manage variables
              </Button>
            </CardHeader>
          </Card>
        
        </TabsContent>
      </Tabs>

      <Dialog
        open={databaseModalOpen}
        onOpenChange={open => {
          setDatabaseModalOpen(open)
          if (!open) {
            setDatabaseError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provision database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="db-name">Name</Label>
              <Input
                id="db-name"
                placeholder="production-db"
                value={databaseForm.name}
                onChange={e => setDatabaseForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={databaseForm.db_type}
                  onValueChange={value => {
                    const typeDef = DB_TYPE_OPTIONS.find(option => option.value === value)
                    setDatabaseForm(prev => ({
                      ...prev,
                      db_type: value as (typeof prev)['db_type'],
                      version: typeDef?.versions[0] ?? prev.version,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DB_TYPE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={databaseForm.version}
                  onValueChange={value => setDatabaseForm(prev => ({ ...prev, version: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDbType.versions.map(version => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={databaseForm.region}
                  onValueChange={value => setDatabaseForm(prev => ({ ...prev, region: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.region} value={region.region}>
                        {region.region.toUpperCase()} • {region.node_count} nodes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan (optional)</Label>
                <Select
                  value={databaseForm.plan_id || ''}
                  onValueChange={value => setDatabaseForm(prev => ({ ...prev, plan_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Shared resources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Shared resources</SelectItem>
                    {plans.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {databaseError && (
              <Alert variant="destructive">
                <AlertDescription>{databaseError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDatabaseModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateDatabase()} disabled={createDbBusy}>
              {createDbBusy ? 'Creating…' : 'Create database'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <EnvVarManager application={app} token={token} open={envOpen} onOpenChange={setEnvOpen} />
      </div>
      <PlanUpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        plans={plans}
        currentPlanId={app?.plan_id}
        onSelect={handlePlanUpgrade}
      />
    </>
  )
}

export default AppDetails
