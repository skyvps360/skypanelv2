import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildApiUrl } from '@/lib/api'
import { formatHourlyRate, formatMonthlyPrice } from '@/lib/currency'
import type { PaasPlan, PaasRegion, PaasRuntime } from '@/types/paas'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  token?: string | null
  plans: PaasPlan[]
  runtimes: PaasRuntime[]
  regions: PaasRegion[]
  onCreated?: () => void
}

interface GithubStatus {
  connected: boolean
  login?: string | null
  avatar_url?: string | null
}

interface GithubRepo {
  id: number
  full_name: string
  name: string
  default_branch?: string
  owner: { login: string }
}

const initialForm = {
  name: '',
  plan_id: '',
  runtime_id: '',
  region: '',
  git_repo_url: '',
  git_branch: 'main',
  auto_deploy: false,
}

export const CreateApplicationModal: React.FC<Props> = ({ open, onOpenChange, token, plans, runtimes, regions, onCreated }) => {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authorizedHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token])
  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null)
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [githubBranches, setGithubBranches] = useState<string[]>([])
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('')
  const [selectedRepoMeta, setSelectedRepoMeta] = useState<{ owner: string; name: string } | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')

  const planLookup = useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const runtimeLookup = useMemo(() => new Map(runtimes.map(rt => [rt.id, rt])), [runtimes])

  const selectedPlan = planLookup.get(form.plan_id)
  const selectedRuntime = runtimeLookup.get(form.runtime_id)

  const resetForm = () => {
    setForm(initialForm)
    setError(null)
    setSelectedRepoFullName('')
    setSelectedRepoMeta(null)
    setSelectedBranch('')
    setGithubBranches([])
    setGithubError(null)
  }

  const loadGithubRepos = useCallback(async () => {
    if (!authorizedHeaders) return
    try {
      setGithubLoading(true)
      setGithubError(null)
      const response = await fetch(buildApiUrl('/paas/github/repos'), { headers: authorizedHeaders })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to load repositories')
      setGithubRepos(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err: any) {
      setGithubError(err?.message || 'Failed to load GitHub repositories')
      setGithubRepos([])
    } finally {
      setGithubLoading(false)
    }
  }, [authorizedHeaders])

  const loadGithubStatus = useCallback(async () => {
    if (!authorizedHeaders) return
    try {
      const response = await fetch(buildApiUrl('/paas/github/status'), { headers: authorizedHeaders })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to load GitHub status')
      const status: GithubStatus = payload?.data || { connected: false }
      setGithubStatus(status)
      if (status.connected) {
        await loadGithubRepos()
      } else {
        setGithubRepos([])
        setSelectedRepoMeta(null)
        setSelectedRepoFullName('')
        setSelectedBranch('')
        setGithubBranches([])
      }
    } catch (err) {
      console.error(err)
      setGithubStatus(null)
    }
  }, [authorizedHeaders, loadGithubRepos])

  useEffect(() => {
    if (open && authorizedHeaders) {
      void loadGithubStatus()
    }
  }, [open, authorizedHeaders, loadGithubStatus])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event?.data?.source === 'skypanel-github') {
        void loadGithubStatus()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [loadGithubStatus])

  const handleGithubConnect = useCallback(async () => {
    if (!authorizedHeaders) {
      setGithubError('You must be signed in to connect GitHub.')
      return
    }
    try {
      setGithubError(null)
      const response = await fetch(buildApiUrl('/paas/github/authorize'), { headers: authorizedHeaders })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Unable to start GitHub authorization')
      const url = payload?.data?.url
      if (!url) throw new Error('Authorization URL missing')
      window.open(url, 'github-oauth', 'width=600,height=700')
    } catch (err: any) {
      setGithubError(err?.message || 'Failed to open GitHub authorization')
    }
  }, [authorizedHeaders])

  const handleGithubDisconnect = useCallback(async () => {
    if (!authorizedHeaders) return
    try {
      setGithubError(null)
      const response = await fetch(buildApiUrl('/paas/github/connection'), {
        method: 'DELETE',
        headers: authorizedHeaders,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to disconnect GitHub')
      setGithubStatus({ connected: false })
      setGithubRepos([])
      setSelectedRepoMeta(null)
      setSelectedRepoFullName('')
      setSelectedBranch('')
      setGithubBranches([])
    } catch (err: any) {
      setGithubError(err?.message || 'Failed to disconnect GitHub')
    }
  }, [authorizedHeaders])

  const handleRepoChange = useCallback(
    async (fullName: string) => {
      if (!authorizedHeaders) return
      setSelectedRepoFullName(fullName)
      const [owner, name] = fullName.split('/')
      if (!owner || !name) return
      setSelectedRepoMeta({ owner, name })
      const repoMeta = githubRepos.find(repo => repo.full_name === fullName)
      const defaultBranch = repoMeta?.default_branch || 'main'
      setSelectedBranch(defaultBranch)
      setGithubBranches([])
      try {
        setGithubLoading(true)
        setGithubError(null)
        const response = await fetch(
          buildApiUrl(`/paas/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`),
          { headers: authorizedHeaders }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Failed to load branches')
        const branchNames = Array.isArray(payload?.data) ? payload.data.map((b: any) => b?.name).filter(Boolean) : []
        setGithubBranches(branchNames)
        if (branchNames.length) {
          setSelectedBranch(branchNames.includes(defaultBranch) ? defaultBranch : branchNames[0])
        }
      } catch (err: any) {
        setGithubError(err?.message || 'Failed to load branches')
      } finally {
        setGithubLoading(false)
      }
    },
    [authorizedHeaders, githubRepos]
  )

  const clearGithubSelection = useCallback(() => {
    setSelectedRepoFullName('')
    setSelectedRepoMeta(null)
    setSelectedBranch('')
    setGithubBranches([])
  }, [])

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const canSubmit = Boolean(form.name.trim() && form.plan_id && form.runtime_id && form.region && token)

  const githubSelectionActive = Boolean(selectedRepoMeta)

  const handleSubmit = async () => {
    if (!token) {
      setError('You need to be signed in to create an application.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        plan_id: form.plan_id,
        runtime_id: form.runtime_id,
        region: form.region,
        git_repo_url: githubSelectionActive ? undefined : form.git_repo_url.trim() || undefined,
        git_branch: githubSelectionActive ? undefined : form.git_branch.trim() || 'main',
        auto_deploy: form.auto_deploy,
      }
      const res = await fetch(buildApiUrl('/paas/applications'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create application')
      }
      const createdApp = data?.data
      if (githubSelectionActive && createdApp?.id && authorizedHeaders) {
        const branchToLink = selectedBranch || githubBranches[0] || 'main'
        const response = await fetch(buildApiUrl(`/paas/applications/${createdApp.id}/github`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authorizedHeaders,
          },
          body: JSON.stringify({
            owner: selectedRepoMeta?.owner,
            repo: selectedRepoMeta?.name,
            branch: branchToLink,
            autoDeploy: form.auto_deploy,
          }),
        })
        const linkData = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(linkData?.error || 'Failed to link GitHub repository')
        }
      }
      resetForm()
      onOpenChange(false)
      onCreated?.()
    } catch (err: any) {
      setError(err?.message || 'Failed to create application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Launch new application</DialogTitle>
          <DialogDescription>Select a runtime, plan, and region to deploy your code.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="app-name">Application name</Label>
              <Input
                id="app-name"
                value={form.name}
                placeholder="e.g. marketing-site"
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Runtime</Label>
              <Select value={form.runtime_id} onValueChange={value => setForm(prev => ({ ...prev, runtime_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select runtime" />
                </SelectTrigger>
                <SelectContent>
                  {runtimes.map(runtime => (
                    <SelectItem key={runtime.id} value={runtime.id}>
                      {runtime.runtime_type}@{runtime.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRuntime && (
                <p className="text-xs text-muted-foreground">Base image: {selectedRuntime.base_image}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={form.plan_id} onValueChange={value => setForm(prev => ({ ...prev, plan_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} • {formatHourlyRate(plan.price_hourly)}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlan && (
                <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                  {selectedPlan.cpu_millicores}m CPU • {selectedPlan.memory_mb}MB RAM • {selectedPlan.storage_gb}GB SSD
                  <br />
                  {formatMonthlyPrice(selectedPlan.price_monthly)} per month equivalent
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={form.region} onValueChange={value => setForm(prev => ({ ...prev, region: value }))}>
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
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>GitHub integration</Label>
              <div className="space-y-2 rounded-md border p-3">
                {githubStatus?.connected ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        Connected as <span className="font-medium">{githubStatus.login}</span>
                      </div>
                      <div className="flex gap-2">
                        {githubSelectionActive && (
                          <Button type="button" size="sm" variant="outline" onClick={clearGithubSelection}>
                            Clear selection
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" onClick={() => void handleGithubDisconnect()}>
                          Disconnect
                        </Button>
                      </div>
                    </div>
                    <Select value={selectedRepoFullName} onValueChange={value => { void handleRepoChange(value) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {githubRepos.map(repo => (
                          <SelectItem key={repo.id} value={repo.full_name}>
                            {repo.full_name}
                          </SelectItem>
                        ))}
                        {!githubRepos.length && (
                          <SelectItem value="__no-repo" disabled>
                            No repositories found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {githubSelectionActive && (
                      <Select value={selectedBranch} onValueChange={value => setSelectedBranch(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {githubBranches.map(branch => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                          {!githubBranches.length && (
                            <SelectItem value="__no-branch" disabled>
                              No branches available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    {githubLoading && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Syncing GitHub…
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Connect GitHub to browse repositories and enable secure auto-deploy.
                    </p>
                    <Button type="button" onClick={() => void handleGithubConnect()} disabled={!token}>
                      Connect GitHub
                    </Button>
                  </div>
                )}
                {githubError && <p className="text-xs text-destructive">{githubError}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="git-url">Git repository</Label>
              <Input
                id="git-url"
                placeholder="https://github.com/org/project.git"
                value={form.git_repo_url}
                onChange={e => setForm(prev => ({ ...prev, git_repo_url: e.target.value }))}
                disabled={githubSelectionActive}
              />
              <p className="text-xs text-muted-foreground">
                {githubSelectionActive
                  ? 'Repository selection is managed via GitHub above.'
                  : 'We\'ll clone this repo during deployments.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="git-branch">Default branch</Label>
              <Input
                id="git-branch"
                value={githubSelectionActive ? selectedBranch || '' : form.git_branch}
                onChange={e => setForm(prev => ({ ...prev, git_branch: e.target.value }))}
                disabled={githubSelectionActive}
              />
              {githubSelectionActive && (
                <p className="text-xs text-muted-foreground">Branch controlled by GitHub selection.</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Auto deploy</p>
                <p className="text-xs text-muted-foreground">Automatically rebuild when new commits land on the branch.</p>
              </div>
              <Switch checked={form.auto_deploy} onCheckedChange={checked => setForm(prev => ({ ...prev, auto_deploy: Boolean(checked) }))} />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Launching…' : 'Launch application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
