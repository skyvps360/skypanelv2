import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, MoreHorizontal, GitBranch, Globe, Layers, Database, Settings2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { buildApiUrl } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CreateApplicationModal } from '@/components/paas/CreateApplicationModal'
import { EnvVarManager } from '@/components/paas/EnvVarManager'
import type { PaasApplication, PaasPlan, PaasRegion, PaasRuntime, PaasStatus, PaasBillingSummary, PaasBillingRecord, PaasSpendingAlert } from '@/types/paas'
import { formatHourlyRate } from '@/lib/currency'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

const STATUS_META: Record<PaasStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
  building: { label: 'Building', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  running: { label: 'Running', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  stopped: { label: 'Stopped', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  suspended: { label: 'Suspended', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—')
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(value) ? value : 0)

const ensureNumber = (value: any, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function Apps() {
  const { token } = useAuth()
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token])
  const [apps, setApps] = useState<PaasApplication[]>([])
  const [plans, setPlans] = useState<PaasPlan[]>([])
  const [runtimes, setRuntimes] = useState<PaasRuntime[]>([])
  const [regions, setRegions] = useState<PaasRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [envApp, setEnvApp] = useState<PaasApplication | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [usageSummary, setUsageSummary] = useState<PaasBillingSummary | null>(null)
  const [billingRecords, setBillingRecords] = useState<PaasBillingRecord[]>([])
  const [spendingAlert, setSpendingAlert] = useState<PaasSpendingAlert | null>(null)
  const [alertInput, setAlertInput] = useState('')
  const [alertSaving, setAlertSaving] = useState(false)
  const usageSeries = useMemo(
    () =>
      billingRecords
        .slice()
        .reverse()
        .map(record => ({
          date: new Date(record.billing_period_end).toLocaleString(),
          cost: Number(record.total_cost ?? 0),
        })),
    [billingRecords]
  )
  const usageBreakdown = useMemo(() => Object.entries(usageSummary?.totals ?? {}), [usageSummary])

  const fetchData = useCallback(async () => {
    if (!token || !authHeaders) return
    setLoading(true)
    setError(null)
    try {
      const [appsRes, plansRes, runtimesRes, regionsRes, usageRes, recordsRes, alertsRes] = await Promise.all([
        fetch(buildApiUrl('/paas/applications'), { headers: authHeaders }),
        fetch(buildApiUrl('/paas/plans')),
        fetch(buildApiUrl('/paas/runtimes')),
        fetch(buildApiUrl('/paas/regions')),
        fetch(buildApiUrl('/paas/billing/summary'), { headers: authHeaders }),
        fetch(buildApiUrl('/paas/billing/records?limit=12'), { headers: authHeaders }),
        fetch(buildApiUrl('/paas/billing/alerts'), { headers: authHeaders }),
      ])

      const appsJson: ApiResponse<any[]> = await appsRes.json()
      if (!appsRes.ok) throw new Error(appsJson?.error || 'Unable to load applications')
      const planJson: ApiResponse<any[]> = await plansRes.json()
      const runtimeJson: ApiResponse<any[]> = await runtimesRes.json()
      const regionJson: ApiResponse<any[]> = await regionsRes.json()
      const usageJson = await usageRes.json().catch(() => ({}))
      const recordsJson = await recordsRes.json().catch(() => ({}))
      const alertJson = await alertsRes.json().catch(() => ({}))

      setApps(
        (appsJson.data || []).map(app => ({
          ...app,
          instance_count: ensureNumber(app.instance_count, 1),
        }))
      )
      setPlans(
        (planJson.data || []).map(plan => ({
          ...plan,
          cpu_millicores: ensureNumber(plan.cpu_millicores),
          memory_mb: ensureNumber(plan.memory_mb),
          storage_gb: ensureNumber(plan.storage_gb),
          price_hourly: ensureNumber(plan.price_hourly, 0),
          price_monthly: ensureNumber(plan.price_monthly, 0),
        }))
      )
      setRuntimes(runtimeJson.data || [])
      setRegions((regionJson.data || []).map((region: any) => ({ region: region.region, node_count: ensureNumber(region.node_count, 0) })))
      if (usageRes.ok) setUsageSummary(usageJson.data || null)
      if (recordsRes.ok) {
        setBillingRecords(
          Array.isArray(recordsJson.data)
            ? recordsJson.data.map((record: any) => ({ ...record, total_cost: Number(record.total_cost ?? 0) }))
            : []
        )
      }
      if (alertsRes.ok) {
        setSpendingAlert(alertJson.data || null)
        if (alertJson.data?.threshold_amount) {
          setAlertInput(String(alertJson.data.threshold_amount))
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  const handleAlertSave = useCallback(async () => {
    if (!token || !authHeaders) return
    const threshold = Number(alertInput)
    if (!Number.isFinite(threshold) || threshold <= 0) {
      toast.error('Enter a positive alert amount')
      return
    }
    setAlertSaving(true)
    try {
      const res = await fetch(buildApiUrl('/paas/billing/alerts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ threshold }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to save threshold')
      setSpendingAlert(data.data || null)
      toast.success('Spending alert saved')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save spending alert')
    } finally {
      setAlertSaving(false)
    }
  }, [token, authHeaders, alertInput])

  useEffect(() => {
    if (token) {
      void fetchData()
    }
  }, [token, fetchData])

  const planMap = useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const runtimeMap = useMemo(() => new Map(runtimes.map(runtime => [runtime.id, runtime])), [runtimes])

  const handleAction = async (app: PaasApplication, action: 'deploy' | 'restart' | 'start' | 'stop') => {
    if (!token) return
    setActioningId(app.id)
    const endpoint = action === 'deploy'
      ? `/paas/applications/${app.id}/deploy`
      : `/paas/applications/${app.id}/${action}`
    try {
      const res = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      toast.success(action === 'deploy' ? 'Deployment queued' : `Action '${action}' sent`)
      await fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Action failed')
    } finally {
      setActioningId(null)
    }
  }

  const emptyState = (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>No applications yet</CardTitle>
        <CardDescription>Create your first app to deploy containers on SkyPanel.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Launch application
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="text-sm text-muted-foreground">Deploy containerized apps with Git-based builds and managed TLS.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New application
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {usageSummary && !loading && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Usage this month</CardTitle>
              <CardDescription>Combined PaaS spending for the current billing cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-semibold">{formatCurrency(usageSummary.grand)}</div>
                <div className="text-xs text-muted-foreground">Month-to-date total</div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {usageBreakdown.length === 0 && <p>No charges yet for this month.</p>}
                {usageBreakdown.map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="capitalize">{type}</span>
                    <span>{formatCurrency(data.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent charges</CardTitle>
              <CardDescription>Last 12 billing events across apps and databases.</CardDescription>
            </CardHeader>
            <CardContent className="h-48">
              {usageSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageSeries}>
                    <defs>
                      <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Area type="monotone" dataKey="cost" stroke="#0ea5e9" fillOpacity={1} fill="url(#usageFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Charges will appear after your first deployment.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending alert</CardTitle>
              <CardDescription>Get notified when monthly usage exceeds a threshold.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="number"
                min="0"
                step="1"
                value={alertInput}
                placeholder="Enter amount in USD"
                onChange={e => setAlertInput(e.target.value)}
              />
              <Button onClick={() => void handleAlertSave()} disabled={alertSaving || !alertInput}>
                {alertSaving ? 'Saving...' : 'Save alert'}
              </Button>
              {spendingAlert?.threshold_amount && (
                <p className="text-xs text-muted-foreground">
                  Current threshold: {formatCurrency(spendingAlert.threshold_amount)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Billing activity</CardTitle>
            <CardDescription>Latest line items across all resources.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {billingRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No billing activity yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2">When</th>
                    <th className="pb-2">Resource</th>
                    <th className="pb-2">Hours</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billingRecords.map(record => (
                    <tr key={record.id} className="border-t text-muted-foreground">
                      <td className="py-2">{new Date(record.billing_period_end).toLocaleString()}</td>
                      <td className="py-2 capitalize">
                        {record.resource_type} • {record.resource_id.slice(0, 6)}
                      </td>
                      <td className="py-2">{record.hours_used}</td>
                      <td className="py-2">{formatCurrency(record.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(key => (
            <Card key={key}>
              <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : apps.length === 0 ? (
        emptyState
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map(app => {
            const plan = app.plan_id ? planMap.get(app.plan_id) : undefined
            const runtime = app.runtime_id ? runtimeMap.get(app.runtime_id) : undefined
            const statusMeta = STATUS_META[app.status] || STATUS_META.pending
            return (
              <Card key={app.id} className="flex h-full flex-col">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {app.name}
                      <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                      {app.needs_redeploy && (
                        <Badge variant="destructive" className="uppercase tracking-wide">
                          Redeploy required
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Region: {app.region.toUpperCase()}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleAction(app, 'deploy')} disabled={actioningId === app.id}>
                        Deploy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction(app, 'restart')} disabled={actioningId === app.id}>
                        Restart
                      </DropdownMenuItem>
                      {app.status === 'running' ? (
                        <DropdownMenuItem onClick={() => handleAction(app, 'stop')} disabled={actioningId === app.id}>
                          Stop
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleAction(app, 'start')} disabled={actioningId === app.id}>
                          Start
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEnvApp(app)}>
                        Manage env vars
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      Plan: {plan ? `${plan.name} • ${plan.cpu_millicores}m / ${plan.memory_mb}MB` : '—'}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      {app.git_repo_url ? (
                        <a href={app.git_repo_url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                          {app.git_repo_full_name || app.git_repo_url}
                        </a>
                      ) : (
                        'Git repo not configured'
                      )}
                      {app.git_branch && <span className="text-xs">({app.git_branch})</span>}
                    </div>
                    {runtime && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Settings2 className="h-4 w-4" /> Runtime: {runtime.runtime_type}@{runtime.version}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Database className="h-4 w-4" /> Instances: {app.instance_count}
                    </div>
                    {plan && (
                      <div className="text-xs text-muted-foreground">
                        {formatHourlyRate(plan.price_hourly)} per instance per hour
                      </div>
                    )}
                    {app.system_domain && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <a href={`https://${app.system_domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {app.system_domain}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleAction(app, 'deploy')} disabled={actioningId === app.id}>
                      Deploy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEnvApp(app)}>
                      Env vars
                    </Button>
                    {app.status === 'running' ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(app, 'stop')} disabled={actioningId === app.id}>
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(app, 'start')} disabled={actioningId === app.id}>
                        Start
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/apps/${app.id}`}>Details</Link>
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(app.updated_at)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateApplicationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        token={token}
        plans={plans}
        runtimes={runtimes}
        regions={regions}
        onCreated={() => fetchData()}
      />

      <EnvVarManager application={envApp} token={token} open={Boolean(envApp)} onOpenChange={open => !open && setEnvApp(null)} />
    </div>
  )
}
