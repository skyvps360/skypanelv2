import crypto from 'node:crypto'
import express from 'express'
import { query } from '../lib/database.js'
import { optionalAuth, authenticateToken, requireOrganization } from '../middleware/auth.js'
import { decryptSecret } from '../lib/crypto.js'
import { ApplicationService } from '../services/paas/ApplicationService.js'
import { DatabaseService } from '../services/paas/DatabaseService.js'
import { PaasBillingService } from '../services/paas/BillingService.js'
import { PaasLogService } from '../services/paas/LogService.js'
import { PaasMetricsService } from '../services/paas/MetricsService.js'
import { PaasBackupService } from '../services/paas/BackupService.js'
import { PaasGithubService, GithubServiceError } from '../services/paas/GitHubService.js'
import { subscribe, runtimeChannel, buildChannel } from '../services/paas/LogStreamBroker.js'

const router = express.Router()

router.post('/github/webhooks/:appId', async (req: any, res) => {
  const rawBody: Buffer | undefined = (req as any).rawBody
  const app = await ApplicationService.getById(req.params.appId)
  if (!app || !app.git_webhook_secret) {
    return res.status(404).json({ success: false, error: 'Application not found' })
  }
  if (!app.auto_deploy) {
    return res.status(202).json({ success: true, ignored: true })
  }
  const secret = decryptSecret(app.git_webhook_secret)
  const verified = verifyGithubSignature(rawBody, secret, req.get('x-hub-signature-256'))
  if (!verified) {
    return res.status(401).json({ success: false, error: 'Invalid signature' })
  }
  const event = req.get('x-github-event')
  if (event === 'ping') {
    return res.json({ success: true })
  }
  if (event !== 'push') {
    return res.status(202).json({ success: true, ignored: true })
  }
  const repoFullName = req.body?.repository?.full_name
  if (app.git_repo_full_name && repoFullName && repoFullName.toLowerCase() !== app.git_repo_full_name.toLowerCase()) {
    return res.status(202).json({ success: true, ignored: true })
  }
  const branchRef = typeof req.body?.ref === 'string' ? req.body.ref : ''
  const branch = branchRef.split('/').pop()
  if (app.git_branch && branch && branch !== app.git_branch) {
    return res.status(202).json({ success: true, ignored: true })
  }
  const created = await ApplicationService.createBuildAndMarkBuilding(app.id, app.organization_id)
  if (!created) {
    return res.status(404).json({ success: false, error: 'Application not found' })
  }
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const dispatched = await DeploymentDispatcher.triggerDeploy(app.id, app.organization_id)
  if (!dispatched.ok) {
    console.error('GitHub webhook dispatch failed', dispatched.error)
    return res.status(503).json({ success: false, error: dispatched.error || 'Dispatch failed' })
  }
  res.json({ success: true })
})

// Optional auth for basic read-only endpoints
router.use(optionalAuth)

router.get('/plans', async (_req, res) => {
  const result = await query('SELECT * FROM paas_plans WHERE active = TRUE ORDER BY price_hourly ASC')
  res.json({ success: true, data: result.rows })
})

router.get('/runtimes', async (_req, res) => {
  const result = await query('SELECT * FROM paas_runtimes WHERE active = TRUE ORDER BY runtime_type, version DESC')
  res.json({ success: true, data: result.rows })
})

router.get('/regions', async (_req, res) => {
  const result = await query(`
    SELECT region, COUNT(*) AS node_count
    FROM paas_nodes
    WHERE status NOT IN ('disabled')
    GROUP BY region
    ORDER BY region ASC`)
  res.json({ success: true, data: result.rows })
})

export default router

// Authenticated application routes
const authed = express.Router()
authed.use(authenticateToken, requireOrganization)

function requireGithubConfigured(res: express.Response) {
  if (!PaasGithubService.isConfigured()) {
    res.status(503).json({ success: false, error: 'GitHub integration is not configured' })
    return false
  }
  return true
}

function buildWebhookCallbackUrl(req: express.Request, appId: string) {
  const host = req.get('host')
  if (!host) return null
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https'
  const base = `${protocol}://${host}`.replace(/\/$/, '')
  return `${base}/api/paas/github/webhooks/${appId}`
}

function parseRepoFullName(fullName?: string | null) {
  if (!fullName) return null
  const [owner, ...rest] = fullName.split('/')
  if (!owner || !rest.length) return null
  return { owner, repo: rest.join('/') }
}

function resolveRepoTarget(app: any) {
  const parsed = parseRepoFullName(app?.git_repo_full_name)
  if (parsed) return parsed
  if (typeof app?.git_repo_url === 'string') {
    try {
      const url = new URL(app.git_repo_url)
      const parts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts.slice(1).join('/') }
      }
    } catch {}
  }
  return null
}

function verifyGithubSignature(rawBody: Buffer | undefined, secret: string, signatureHeader?: string | string[]) {
  if (!rawBody || !secret || !signatureHeader) return false
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
  if (!signature || !signature.startsWith('sha256=')) return false
  const digest = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const expected = Buffer.from(digest)
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return false
  try {
    return crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

authed.get('/github/authorize', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const state = PaasGithubService.createStateToken({
    userId: req.user!.id,
    organizationId: req.user!.organizationId!,
  })
  const url = PaasGithubService.buildAuthorizeUrl(state)
  res.json({ success: true, data: { url } })
})

authed.get('/github/status', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const connection = await PaasGithubService.getConnection(req.user!.organizationId!, req.user!.id)
  if (!connection) {
    return res.json({ success: true, data: { connected: false } })
  }
  res.json({
    success: true,
    data: {
      connected: true,
      login: connection.github_login,
      avatar_url: connection.github_avatar_url,
      scope: connection.scope,
      expires_at: connection.expires_at,
    },
  })
})

authed.delete('/github/connection', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  await PaasGithubService.deleteConnection(req.user!.organizationId!, req.user!.id)
  res.json({ success: true })
})

authed.get('/github/repos', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const connection = await PaasGithubService.getConnection(req.user!.organizationId!, req.user!.id)
  if (!connection) return res.status(404).json({ success: false, error: 'Not connected to GitHub' })
  try {
    const repos = await PaasGithubService.listRepositories(connection)
    res.json({ success: true, data: repos })
  } catch (err: any) {
    const message = err instanceof GithubServiceError ? err.message : 'Failed to fetch repositories'
    res.status(502).json({ success: false, error: message })
  }
})

authed.get('/github/repos/:owner/:repo/branches', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const connection = await PaasGithubService.getConnection(req.user!.organizationId!, req.user!.id)
  if (!connection) return res.status(404).json({ success: false, error: 'Not connected to GitHub' })
  try {
    const branches = await PaasGithubService.listBranches(connection, req.params.owner, req.params.repo)
    res.json({ success: true, data: branches })
  } catch (err: any) {
    const message = err instanceof GithubServiceError ? err.message : 'Failed to fetch branches'
    res.status(502).json({ success: false, error: message })
  }
})

authed.get('/applications', async (req: any, res) => {
  const apps = await ApplicationService.listByOrganization(req.user!.organizationId!)
  res.json({ success: true, data: apps })
})

authed.post('/applications', async (req: any, res) => {
  try {
    const created = await ApplicationService.create(
      req.user!.organizationId!,
      req.user!.id,
      req.body || {}
    )
    res.json({ success: true, data: created })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Create failed' })
  }
})

authed.get('/applications/:id', async (req: any, res) => {
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: app })
})

authed.put('/applications/:id', async (req: any, res) => {
  const updated = await ApplicationService.updateForOrg(req.params.id, req.user!.organizationId!, req.body || {})
  if (!updated) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: updated })
})

authed.delete('/applications/:id', async (req: any, res) => {
  const ok = await ApplicationService.removeForOrg(req.params.id, req.user!.organizationId!)
  res.json({ success: ok })
})

// Deploy skeleton: creates build and marks app as building
authed.post('/applications/:id/deploy', async (req: any, res) => {
  const created = await ApplicationService.createBuildAndMarkBuilding(req.params.id, req.user!.organizationId!)
  if (!created) return res.status(404).json({ success: false, error: 'Not found' })
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const dispatched = await DeploymentDispatcher.triggerDeploy(req.params.id, req.user!.organizationId!)
  if (!dispatched.ok) {
    return res.status(503).json({ success: false, error: dispatched.error || 'Dispatch failed', data: { build: created.build } })
  }
  res.json({ success: true, data: { build: created.build, nodeId: dispatched.nodeId } })
})

// Environment variables (encrypted at rest, list only keys)
authed.get('/applications/:id/env', async (req: any, res) => {
  const items = await ApplicationService.listEnvKeys(req.params.id, req.user!.organizationId!)
  res.json({ success: true, data: items })
})

authed.post('/applications/:id/env', async (req: any, res) => {
  const { key, value } = req.body || {}
  if (!key || typeof value !== 'string') return res.status(400).json({ success: false, error: 'key and value required' })
  const ok = await ApplicationService.setEnv(req.params.id, req.user!.organizationId!, key, value)
  if (!ok) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true })
})

authed.delete('/applications/:id/env/:key', async (req: any, res) => {
  const ok = await ApplicationService.deleteEnv(req.params.id, req.user!.organizationId!, req.params.key)
  res.json({ success: ok })
})

authed.get('/billing/summary', async (req: any, res) => {
  const data = await PaasBillingService.getUsageSummary(req.user!.organizationId!)
  res.json({ success: true, data })
})

authed.get('/billing/records', async (req: any, res) => {
  const limit = Number(req.query.limit) || 25
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : undefined
  const resourceType =
    req.query.resourceType === 'application' || req.query.resourceType === 'database'
      ? req.query.resourceType
      : undefined
  const records = await PaasBillingService.listRecords(req.user!.organizationId!, {
    limit,
    resourceId,
    resourceType,
  })
  res.json({ success: true, data: records })
})

authed.get('/billing/alerts', async (req: any, res) => {
  const alert = await PaasBillingService.getSpendingAlert(req.user!.organizationId!)
  res.json({ success: true, data: alert })
})

authed.post('/billing/alerts', async (req: any, res) => {
  const threshold = Number(req.body?.threshold)
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return res.status(400).json({ success: false, error: 'threshold must be positive' })
  }
  const alert = await PaasBillingService.upsertSpendingAlert(req.user!.organizationId!, threshold)
  res.json({ success: true, data: alert })
})

authed.get('/applications/:id/billing', async (req: any, res) => {
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Application not found' })
  const data = await PaasBillingService.getApplicationCharges(req.params.id)
  res.json({ success: true, data })
})

authed.get('/applications/:id/databases', async (req: any, res) => {
  try {
    const items = await DatabaseService.listForApplication(req.params.id, req.user!.organizationId!)
    res.json({ success: true, data: items })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to load databases' })
  }
})

authed.post('/applications/:id/github', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const { owner, repo, branch } = req.body || {}
  if (!owner || !repo) return res.status(400).json({ success: false, error: 'owner and repo are required' })
  const connection = await PaasGithubService.getConnection(req.user!.organizationId!, req.user!.id)
  if (!connection) return res.status(404).json({ success: false, error: 'GitHub account not connected' })
  const ensuredConnection = await PaasGithubService.ensureValidAccessToken(connection)
  try {
    const repoInfo = await PaasGithubService.getRepository(ensuredConnection, owner, repo)
    const branchName = branch || repoInfo?.default_branch || 'main'
    const autoDeploy = typeof req.body?.autoDeploy === 'boolean' ? req.body.autoDeploy : true
    const repoFullName = repoInfo.full_name || `${owner}/${repo}`
    let webhookId: number | null = null
    let webhookSecret: string | null = null
    if (autoDeploy) {
      const callbackUrl = buildWebhookCallbackUrl(req, req.params.id)
      if (!callbackUrl) {
        return res.status(500).json({ success: false, error: 'Unable to determine webhook callback URL' })
      }
      webhookSecret = crypto.randomBytes(32).toString('hex')
      try {
        const hook = await PaasGithubService.createWebhookWithToken(ensuredConnection.access_token_plain, owner, repo, {
          url: callbackUrl,
          secret: webhookSecret,
        })
        webhookId = hook?.id ? Number(hook.id) : null
      } catch (err: any) {
        const message = err instanceof GithubServiceError ? err.message : 'Unable to configure GitHub webhook'
        return res.status(502).json({ success: false, error: message })
      }
    }
    await ApplicationService.linkGithubRepository(req.params.id, req.user!.organizationId!, {
      repoUrl: repoInfo.clone_url || repoInfo.git_url || `https://github.com/${owner}/${repo}.git`,
      branch: branchName,
      token: ensuredConnection.access_token_plain,
      repoFullName,
      webhookId,
      webhookSecret,
      autoDeploy,
    })
    res.json({
      success: true,
      data: {
        full_name: repoFullName,
        branch: branchName,
        auto_deploy: autoDeploy,
      },
    })
  } catch (err: any) {
    const message = err instanceof GithubServiceError ? err.message : 'Unable to link repository'
    res.status(400).json({ success: false, error: message })
  }
})

authed.delete('/applications/:id/github', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Not found' })
  if (app.git_repo_full_name && app.git_webhook_id && app.git_oauth_token) {
    const target = parseRepoFullName(app.git_repo_full_name)
    const token = decryptSecret(app.git_oauth_token)
    if (target && token) {
      try {
        await PaasGithubService.deleteWebhookWithToken(token, target.owner, target.repo, Number(app.git_webhook_id))
      } catch (err) {
        console.warn('Failed to delete GitHub webhook', err)
      }
    }
  }
  await ApplicationService.unlinkGithubRepository(req.params.id, req.user!.organizationId!)
  res.json({ success: true })
})

authed.patch('/applications/:id/github/auto-deploy', async (req: any, res) => {
  if (!requireGithubConfigured(res)) return
  const { enabled } = req.body || {}
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'enabled is required' })
  }
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Application not found' })
  if (!app.git_oauth_token || !app.git_repo_url) {
    return res.status(400).json({ success: false, error: 'Application is not linked to GitHub' })
  }
  const ghConnection = await PaasGithubService.getConnection(req.user!.organizationId!, req.user!.id)
  if (!ghConnection) {
    return res.status(403).json({ success: false, error: 'Connect GitHub to manage auto deploy' })
  }
  const ensuredConnection = await PaasGithubService.ensureValidAccessToken(ghConnection)
  const repoTarget = resolveRepoTarget(app)
  if (!repoTarget) {
    return res.status(400).json({ success: false, error: 'Unable to determine repository coordinates' })
  }
  const token = ensuredConnection.access_token_plain
  await ApplicationService.updateGithubToken(req.params.id, req.user!.organizationId!, token)
  let webhookId: number | null = null
  let webhookSecret: string | null = null
  if (enabled) {
    const callbackUrl = buildWebhookCallbackUrl(req, req.params.id)
    if (!callbackUrl) return res.status(500).json({ success: false, error: 'Unable to determine webhook callback URL' })
    webhookSecret = crypto.randomBytes(32).toString('hex')
    try {
      const hook = await PaasGithubService.createWebhookWithToken(token, repoTarget.owner, repoTarget.repo, {
        url: callbackUrl,
        secret: webhookSecret,
      })
      webhookId = hook?.id ? Number(hook.id) : null
    } catch (err: any) {
      const message = err instanceof GithubServiceError ? err.message : 'Unable to configure GitHub webhook'
      return res.status(502).json({ success: false, error: message })
    }
  } else if (app.git_webhook_id) {
    try {
      await PaasGithubService.deleteWebhookWithToken(token, repoTarget.owner, repoTarget.repo, Number(app.git_webhook_id))
    } catch (err) {
      console.warn('GitHub webhook delete failed during disable', err)
    }
  }
  const updated = await ApplicationService.setAutoDeploy(req.params.id, req.user!.organizationId!, {
    enabled,
    webhookId,
    webhookSecret,
  })
  if (!updated) return res.status(404).json({ success: false, error: 'Application not found' })
  res.json({ success: true, data: updated })
})

router.use(authed)

router.get('/github/callback', async (req, res) => {
  if (!PaasGithubService.isConfigured()) {
    return renderGithubResult(res, { success: false, message: 'GitHub integration not configured' })
  }
  const { code, state } = req.query
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return renderGithubResult(res, { success: false, message: 'Missing code or state' })
  }
  const payload = PaasGithubService.verifyStateToken(state)
  if (!payload) {
    return renderGithubResult(res, { success: false, message: 'Invalid OAuth state' })
  }
  try {
    const token = await PaasGithubService.exchangeCodeForToken(code)
    const profile = await PaasGithubService.fetchGitHubUser(token.access_token)
    await PaasGithubService.upsertConnection({
      organizationId: payload.organizationId,
      userId: payload.userId,
      token,
      profile,
    })
    return renderGithubResult(res, {
      success: true,
      message: `Connected as ${profile.login}`,
    })
  } catch (err: any) {
    console.error('GitHub OAuth callback failed', err)
    const message = err?.message || 'GitHub authorization failed'
    return renderGithubResult(res, { success: false, message })
  }
})

function renderGithubResult(res: express.Response, result: { success: boolean; message: string }) {
  const script = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>GitHub Authorization</title>
    <style>
      body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding: 2rem; text-align: center; }
      .status { font-size: 1.1rem; margin-bottom: 1rem; }
      button { padding: 0.5rem 1rem; border-radius: 6px; border: none; background: #0f172a; color: white; cursor: pointer; }
      button:hover { background: #1e293b; }
    </style>
  </head>
  <body>
    <div class="status">${result.message}</div>
    <button onclick="window.close()">Close window</button>
    <script>
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage({ source: 'skypanel-github', success: ${result.success ? 'true' : 'false'}, message: ${JSON.stringify(
          result.message
        )} }, '*');
      }
      setTimeout(() => window.close(), 1500);
    </script>
  </body>
</html>
`
  res.setHeader('Content-Type', 'text/html')
  res.send(script)
}

// Builds listing and logs
authed.get('/applications/:id/builds', async (req: any, res) => {
  const rows = await query('SELECT * FROM paas_builds WHERE application_id = $1 ORDER BY created_at DESC', [req.params.id])
  res.json({ success: true, data: rows.rows })
})

authed.get('/applications/:id/builds/:buildId', async (req: any, res) => {
  const row = await query('SELECT * FROM paas_builds WHERE id = $1 AND application_id = $2', [req.params.buildId, req.params.id])
  if (row.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: row.rows[0] })
})

authed.get('/applications/:id/builds/:buildId/logs', async (req: any, res) => {
  const row = await query('SELECT build_log FROM paas_builds WHERE id = $1 AND application_id = $2', [req.params.buildId, req.params.id])
  if (row.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: { log: row.rows[0].build_log || '' } })
})

authed.get('/applications/:id/logs/stream', async (req: any, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders?.()
  req.socket.setKeepAlive(true)
  const historyEntries = await PaasLogService.tail(req.params.id, 200)
  const formattedHistory = historyEntries
    .map(entry => `[${new Date(entry.created_at).toISOString()}] ${entry.chunk}`)
    .join('')
  res.write(`event: history\ndata: ${JSON.stringify(formattedHistory)}\n\n`)
  subscribe(runtimeChannel(req.params.id), req, res)
})

authed.get('/applications/:id/builds/:buildId/logs/stream', async (req: any, res) => {
  const row = await query('SELECT build_log FROM paas_builds WHERE id = $1 AND application_id = $2', [req.params.buildId, req.params.id])
  if (row.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Not found' })
    return
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders?.()
  req.socket.setKeepAlive(true)
  res.write(`event: history\ndata: ${JSON.stringify(row.rows[0].build_log || '')}\n\n`)
  subscribe(buildChannel(req.params.buildId), req, res)
})

authed.get('/applications/:id/logs', async (req: any, res) => {
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Not found' })
  const logs = await PaasLogService.tail(req.params.id, Number(req.query.limit) || 200)
  res.json({ success: true, data: logs })
})

authed.get('/applications/:id/metrics', async (req: any, res) => {
  const app = await ApplicationService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!app) return res.status(404).json({ success: false, error: 'Not found' })
  const metrics = await PaasMetricsService.list(req.params.id, Number(req.query.hours) || 24)
  res.json({ success: true, data: metrics })
})

// Control endpoints
authed.post('/applications/:id/restart', async (req: any, res) => {
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const out = await DeploymentDispatcher.control(req.params.id, req.user!.organizationId!, 'restart')
  if (!out.ok) return res.status(503).json({ success: false, error: out.error })
  res.json({ success: true })
})

authed.post('/applications/:id/stop', async (req: any, res) => {
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const out = await DeploymentDispatcher.control(req.params.id, req.user!.organizationId!, 'stop')
  if (!out.ok) return res.status(503).json({ success: false, error: out.error })
  await ApplicationService.updateForOrg(req.params.id, req.user!.organizationId!, { status: 'stopped' })
  res.json({ success: true })
})

authed.post('/applications/:id/start', async (req: any, res) => {
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const out = await DeploymentDispatcher.control(req.params.id, req.user!.organizationId!, 'start')
  if (!out.ok) return res.status(503).json({ success: false, error: out.error })
  await ApplicationService.updateForOrg(req.params.id, req.user!.organizationId!, { status: 'running' })
  res.json({ success: true })
})

authed.post('/applications/:id/scale', async (req: any, res) => {
  const count = Number(req.body?.instance_count)
  if (!Number.isFinite(count) || count < 1 || count > 20) return res.status(400).json({ success: false, error: 'invalid instance_count' })
  const updated = await ApplicationService.updateForOrg(req.params.id, req.user!.organizationId!, { instance_count: count })
  if (!updated) return res.status(404).json({ success: false, error: 'Not found' })
  const { DeploymentDispatcher } = await import('../services/paas/DeploymentDispatcher.js')
  const out = await DeploymentDispatcher.control(req.params.id, req.user!.organizationId!, 'scale', { instanceCount: count })
  if (!out.ok) return res.status(503).json({ success: false, error: out.error })
  res.json({ success: true })
})

authed.post('/applications/:id/upgrade', async (req: any, res) => {
  const { plan_id } = req.body || {}
  if (!plan_id) return res.status(400).json({ success: false, error: 'plan_id required' })
  try {
    const result = await ApplicationService.changePlan(req.params.id, req.user!.organizationId!, plan_id)
    res.json({ success: true, data: result.app, plan: result.targetPlan })
  } catch (err: any) {
    const code = err?.message === 'plan_not_found' ? 404 : 400
    res.status(code).json({ success: false, error: err?.message || 'Unable to change plan' })
  }
})

authed.post('/applications/:id/domains', async (req: any, res) => {
  const { domain } = req.body || {}
  if (!domain) return res.status(400).json({ success: false, error: 'domain required' })
  const added = await ApplicationService.addCustomDomain(req.params.id, req.user!.organizationId!, domain)
  if (!added) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: added })
})

authed.delete('/applications/:id/domains/:domain', async (req: any, res) => {
  const ok = await ApplicationService.removeCustomDomain(req.params.id, req.user!.organizationId!, req.params.domain)
  res.json({ success: ok })
})

// Databases
authed.get('/databases', async (req: any, res) => {
  const rows = await DatabaseService.listByOrg(req.user!.organizationId!)
  res.json({ success: true, data: rows })
})

authed.post('/databases', async (req: any, res) => {
  try {
    const { name, db_type, version, plan_id, region } = req.body || {}
    if (!name || !db_type || !version || !region) return res.status(400).json({ success: false, error: 'Missing fields' })
    const row = await DatabaseService.create(req.user!.organizationId!, { name, db_type, version, plan_id, region })
    res.json({ success: true, data: row })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Create failed' })
  }
})

authed.get('/databases/:id', async (req: any, res) => {
  const row = await DatabaseService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!row) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: row })
})

authed.delete('/databases/:id', async (req: any, res) => {
  const ok = await DatabaseService.removeForOrg(req.params.id, req.user!.organizationId!)
  res.json({ success: ok })
})

authed.get('/databases/:id/backups', async (req: any, res) => {
  const db = await DatabaseService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!db) return res.status(404).json({ success: false, error: 'Not found' })
  const backups = await PaasBackupService.listBackups(req.params.id)
  res.json({ success: true, data: backups })
})

authed.post('/databases/:id/restore', async (req: any, res) => {
  const { backup_id } = req.body || {}
  if (!backup_id) return res.status(400).json({ success: false, error: 'backup_id required' })
  const db = await DatabaseService.getForOrg(req.params.id, req.user!.organizationId!)
  if (!db) return res.status(404).json({ success: false, error: 'Not found' })
  const backup = await query('SELECT * FROM paas_database_backups WHERE id = $1 AND database_id = $2', [backup_id, db.id])
  if (!backup.rows.length) return res.status(404).json({ success: false, error: 'Backup not found' })
  const nodeId = db.node_id
  if (!nodeId) return res.status(503).json({ success: false, error: 'Database not assigned to node' })
  const { sendTaskToNode, isNodeOnline } = await import('../services/paas/AgentWs.js')
  if (!isNodeOnline(nodeId)) return res.status(503).json({ success: false, error: 'Node offline' })
  const decryptedPassword = db.password ? decryptSecret(db.password) : ''
  const sent = sendTaskToNode(nodeId, {
    taskId: `restore:${db.id}:${Date.now()}`,
    type: 'db_restore',
    databaseId: db.id,
    backupPath: backup.rows[0].storage_path,
    dbType: db.db_type,
    username: db.username,
    password: decryptedPassword,
    database: db.database_name,
  })
  if (!sent) return res.status(503).json({ success: false, error: 'Dispatch failed' })
  res.json({ success: true })
})

// Database linking
authed.post('/applications/:id/databases/:dbId', async (req: any, res) => {
  try { await DatabaseService.linkApp(req.params.id, req.params.dbId, req.user!.organizationId!); res.json({ success: true }) } catch (e: any) { res.status(400).json({ success: false, error: e?.message || 'link failed' }) }
})
authed.delete('/applications/:id/databases/:dbId', async (req: any, res) => {
  try { await DatabaseService.unlinkApp(req.params.id, req.params.dbId, req.user!.organizationId!); res.json({ success: true }) } catch (e: any) { res.status(400).json({ success: false, error: e?.message || 'unlink failed' }) }
})

authed.get('/usage/summary', async (req: any, res) => {
  const summary = await PaasBillingService.getUsageSummary(req.user!.organizationId!)
  res.json({ success: true, data: summary })
})

authed.get('/billing/spending-alert', async (req: any, res) => {
  const row = await query('SELECT * FROM paas_spending_alerts WHERE organization_id = $1', [req.user!.organizationId!])
  res.json({ success: true, data: row.rows[0] || null })
})

authed.post('/billing/spending-alert', async (req: any, res) => {
  const threshold = Number(req.body?.threshold_amount)
  if (!Number.isFinite(threshold) || threshold <= 0) return res.status(400).json({ success: false, error: 'Invalid threshold' })
  const alert = await PaasBillingService.upsertSpendingAlert(req.user!.organizationId!, threshold)
  res.json({ success: true, data: alert })
})
