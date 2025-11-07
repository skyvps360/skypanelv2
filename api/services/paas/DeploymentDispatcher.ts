import { query } from '../../lib/database.js'
import { decryptSecret, encryptSecret } from '../../lib/crypto.js'
import { SchedulerService } from './SchedulerService.js'
import { sendTaskToNode, isNodeOnline } from './AgentWs.js'
import { PaasGithubService } from './GitHubService.js'

export const DeploymentDispatcher = {
  async triggerDeploy(applicationId: string, organizationId: string) {
    // Load app
    const appRes = await query('SELECT * FROM paas_applications WHERE id = $1 AND organization_id = $2', [applicationId, organizationId])
    if (appRes.rows.length === 0) return { ok: false, error: 'not_found' }
    const app = appRes.rows[0]

    // Pick node if not assigned
    let nodeId = app.node_id as string | null
    let plan: any = null
    if (app.plan_id) {
      const planRes = await query('SELECT * FROM paas_plans WHERE id = $1', [app.plan_id])
      plan = planRes.rows[0] || null
    }

    if (!nodeId) {
      const requirements = plan ? {
        cpuMillicores: Number(plan.cpu_millicores) || undefined,
        memoryMb: Number(plan.memory_mb) || undefined,
        diskMb: plan.storage_gb ? Number(plan.storage_gb) * 1024 : undefined,
      } : undefined
      const node = await SchedulerService.selectNodeForRegion(app.region, requirements)
      if (!node) return { ok: false, error: 'no_capacity' }
      nodeId = node.id
      await query('UPDATE paas_applications SET node_id = $2 WHERE id = $1', [applicationId, nodeId])
    }

    if (!isNodeOnline(nodeId)) {
      return { ok: false, error: 'node_offline' }
    }

    // Runtime & plan
    const rtRes = await query('SELECT * FROM paas_runtimes WHERE id = $1', [app.runtime_id])
    const runtime = rtRes.rows[0]
    // Build
    const buildRes = await query('SELECT * FROM paas_builds WHERE id = $1', [app.current_build_id])
    const build = buildRes.rows[0]

    // Env vars (decrypt)
    const envRes = await query('SELECT key, value FROM paas_environment_vars WHERE application_id = $1', [applicationId])
    const env: Record<string, string> = {}
    for (const row of envRes.rows) {
      try { env[row.key] = decryptSecret(String(row.value)) } catch { env[row.key] = '' }
    }

    let gitToken = app.git_oauth_token ? decryptSecret(app.git_oauth_token) : null
    if (app.owner_user_id) {
      const connection = await PaasGithubService.getConnection(app.organization_id, app.owner_user_id)
      if (connection) {
        const ensured = await PaasGithubService.ensureValidAccessToken(connection)
        if (ensured?.access_token_plain) {
          gitToken = ensured.access_token_plain
          await query('UPDATE paas_applications SET git_oauth_token = $2 WHERE id = $1', [
            app.id,
            encryptSecret(gitToken),
          ])
        }
      }
    }

    const customDomains = extractCustomDomains(app.custom_domains)
    const task = {
      taskId: build.id,
      type: 'deploy',
      applicationId: app.id,
      buildId: build.id,
      gitRepoUrl: app.git_repo_url,
      gitBranch: app.git_branch,
      gitAuthToken: gitToken || undefined,
      runtimeType: runtime?.runtime_type,
      runtimeVersion: runtime?.version,
      baseImage: runtime?.base_image,
      buildCommand: runtime?.default_build_command,
      startCommand: runtime?.default_start_command,
      cpuLimit: plan?.cpu_millicores,
      memoryLimit: plan?.memory_mb,
      storageLimit: plan?.storage_gb,
      instanceCount: app.instance_count || 1,
      environmentVars: env,
      systemDomain: app.system_domain,
      customDomains,
      port: app.port || 3000,
      forceNonRoot: runtime?.enforce_non_root !== false,
      runUser: runtime?.default_run_user || null,
    }

    const sent = sendTaskToNode(nodeId, task)
    return sent ? { ok: true, nodeId, buildId: build.id } : { ok: false, error: 'send_failed' }
  },
  async control(appId: string, organizationId: string, action: 'restart'|'stop'|'start'|'scale', payload?: any) {
    const appRes = await query('SELECT * FROM paas_applications WHERE id = $1 AND organization_id = $2', [appId, organizationId])
    if (appRes.rows.length === 0) return { ok: false, error: 'not_found' }
    const app = appRes.rows[0]
    if (!app.node_id) return { ok: false, error: 'no_node' }
    if (!isNodeOnline(app.node_id)) return { ok: false, error: 'node_offline' }
    const task = { taskId: `${app.id}:${Date.now()}`, type: action, applicationId: app.id, ...payload }
    const sent = sendTaskToNode(app.node_id, task)
    return sent ? { ok: true } : { ok: false, error: 'send_failed' }
  }
}

function extractCustomDomains(raw: any): string[] {
  if (!Array.isArray(raw)) return []
  const domains: string[] = []
  for (const entry of raw) {
    if (!entry) continue
    if (typeof entry === 'string') {
      domains.push(entry)
    } else if (typeof entry.domain === 'string') {
      domains.push(entry.domain)
    }
  }
  return Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)))
}
