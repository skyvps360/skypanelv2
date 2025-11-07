import { query, transaction } from '../../lib/database.js'
import crypto from 'crypto'
import dns from 'node:dns/promises'
import { encryptSecret } from '../../lib/crypto.js'
import { PaasAlertService } from './AlertService.js'

export interface CreateApplicationInput {
  name: string
  runtime_id?: string
  plan_id?: string
  region: string
  git_repo_url?: string
  git_branch?: string
  auto_deploy?: boolean
}

export interface UpdateApplicationInput extends Partial<CreateApplicationInput> {
  status?: 'pending' | 'building' | 'running' | 'stopped' | 'failed' | 'suspended'
  instance_count?: number
  port?: number
}

export interface CustomDomain {
  domain: string
  status: 'pending_verification' | 'pending_ssl' | 'active' | 'error'
  added_at: string
  verified_at?: string | null
  last_error?: string | null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 100)
}

function systemDomainFor(slug: string): string | null {
  const base = process.env.PAAS_SYSTEM_DOMAIN || ''
  if (!base) return null
  return `${slug}.${base}`
}

function normalizeDomains(domains: any): CustomDomain[] {
  if (!domains) return []
  if (Array.isArray(domains)) {
    return domains.map((domain: any) => ({
      domain: String(domain.domain || domain).toLowerCase(),
      status: (domain.status as CustomDomain['status']) || 'pending_verification',
      added_at: domain.added_at || new Date().toISOString(),
      verified_at: domain.verified_at || null,
      last_error: domain.last_error || null,
    }))
  }
  return []
}

async function validateDomainOwnership(domain: string, nodeId?: string | null) {
  if (!nodeId) return
  const nodeRes = await query('SELECT host_address FROM paas_nodes WHERE id = $1', [nodeId])
  const host = nodeRes.rows[0]?.host_address
  if (!host) return
  try {
    const domainIps = await dns.resolve4(domain)
    const hostLookup = await dns.lookup(host).catch(() => ({ address: host }))
    if (!domainIps.includes(hostLookup.address)) {
      throw new Error(`Domain must resolve to ${hostLookup.address}`)
    }
  } catch (err: any) {
    throw new Error(err?.message || 'Domain verification failed')
  }
}

export const ApplicationService = {
  async getById(id: string) {
    const res = await query('SELECT * FROM paas_applications WHERE id = $1', [id])
    return res.rows[0] || null
  },
  async listByOrganization(organizationId: string) {
    const res = await query(
      'SELECT * FROM paas_applications WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    )
    return res.rows
  },

  async getForOrg(id: string, organizationId: string) {
    const res = await query(
      'SELECT * FROM paas_applications WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    )
    return res.rows[0] || null
  },

  async create(organizationId: string, ownerUserId: string, input: CreateApplicationInput) {
    const baseSlug = slugify(input.name)
    // ensure uniqueness by appending short random suffix if needed
    const uniqueSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`
    const sysDomain = systemDomainFor(uniqueSlug)

    const res = await query(
      `INSERT INTO paas_applications (
        organization_id, owner_user_id, name, slug, runtime_id, plan_id, node_id, region,
        git_repo_url, git_branch, auto_deploy, status, instance_count, port, system_domain
      ) VALUES (
        $1,$2,$3,$4,$5,$6,NULL,$7,
        $8,COALESCE($9,'main'),COALESCE($10,false),'pending',1,3000,$11
      ) RETURNING *`,
      [
        organizationId,
        ownerUserId,
        input.name,
        uniqueSlug,
        input.runtime_id ?? null,
        input.plan_id ?? null,
        input.region,
        input.git_repo_url ?? null,
        input.git_branch ?? 'main',
        input.auto_deploy ?? false,
        sysDomain,
      ]
    )
    return res.rows[0]
  },

  async updateForOrg(id: string, organizationId: string, input: UpdateApplicationInput) {
    const res = await query(
      `UPDATE paas_applications SET
        name = COALESCE($3, name),
        runtime_id = COALESCE($4, runtime_id),
        plan_id = COALESCE($5, plan_id),
        region = COALESCE($6, region),
        git_repo_url = COALESCE($7, git_repo_url),
        git_branch = COALESCE($8, git_branch),
        auto_deploy = COALESCE($9, auto_deploy),
        status = COALESCE($10, status),
        instance_count = COALESCE($11, instance_count),
        port = COALESCE($12, port),
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *`,
      [
        id,
        organizationId,
        input.name ?? null,
        input.runtime_id ?? null,
        input.plan_id ?? null,
        input.region ?? null,
        input.git_repo_url ?? null,
        input.git_branch ?? null,
        typeof input.auto_deploy === 'boolean' ? input.auto_deploy : null,
        input.status ?? null,
        input.instance_count ?? null,
        input.port ?? null,
      ]
    )
    return res.rows[0] || null
  },

  async removeForOrg(id: string, organizationId: string) {
    const res = await query('DELETE FROM paas_applications WHERE id = $1 AND organization_id = $2', [id, organizationId])
    return res.rowCount > 0
  },

  async createBuildAndMarkBuilding(applicationId: string, organizationId: string) {
    return await transaction(async (client) => {
      const appRes = await client.query('SELECT * FROM paas_applications WHERE id = $1 AND organization_id = $2 FOR UPDATE', [applicationId, organizationId])
      if (appRes.rows.length === 0) return null
      const app = appRes.rows[0]

      const numRes = await client.query('SELECT COALESCE(MAX(build_number),0)+1 AS next FROM paas_builds WHERE application_id = $1', [applicationId])
      const nextNum = parseInt(numRes.rows[0].next)

      const buildRes = await client.query(
        `INSERT INTO paas_builds (application_id, build_number, status, started_at)
         VALUES ($1,$2,'pending', NOW()) RETURNING *`,
        [applicationId, nextNum]
      )
      const build = buildRes.rows[0]

      await client.query(
        `UPDATE paas_applications SET status = 'building', current_build_id = $2, updated_at = NOW() WHERE id = $1`,
        [applicationId, build.id]
      )
      return { app, build }
    })
  },

  async changePlan(applicationId: string, organizationId: string, planId: string) {
    const app = await this.getForOrg(applicationId, organizationId)
    if (!app) throw new Error('app_not_found')
    const nextPlanRes = await query('SELECT * FROM paas_plans WHERE id = $1 AND active = TRUE', [planId])
    if (nextPlanRes.rows.length === 0) throw new Error('plan_not_found')
    const targetPlan = nextPlanRes.rows[0]
    if (app.plan_id === planId) throw new Error('plan_no_change')
    let currentPlan: any = null
    if (app.plan_id) {
      const currentRes = await query('SELECT * FROM paas_plans WHERE id = $1', [app.plan_id])
      currentPlan = currentRes.rows[0] || null
    }
    if (currentPlan) {
      const smallerCpu = typeof targetPlan.cpu_millicores === 'number' && typeof currentPlan.cpu_millicores === 'number'
        && targetPlan.cpu_millicores < currentPlan.cpu_millicores
      const smallerMemory = typeof targetPlan.memory_mb === 'number' && typeof currentPlan.memory_mb === 'number'
        && targetPlan.memory_mb < currentPlan.memory_mb
      const smallerStorage = typeof targetPlan.storage_gb === 'number' && typeof currentPlan.storage_gb === 'number'
        && targetPlan.storage_gb < currentPlan.storage_gb
      if (smallerCpu || smallerMemory || smallerStorage) {
        throw new Error('plan_too_small')
      }
    }
    const updated = await query(
      `UPDATE paas_applications
         SET plan_id = $3,
             needs_redeploy = TRUE,
             updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [applicationId, organizationId, planId]
    )
    return { app: updated.rows[0], targetPlan, previousPlan: currentPlan }
  },

  // Environment variables — values are stored encrypted
  async listEnvKeys(applicationId: string, organizationId: string) {
    const res = await query(
      `SELECT key FROM paas_environment_vars WHERE application_id IN (
        SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2
      ) ORDER BY key ASC`,
      [applicationId, organizationId]
    )
    return res.rows.map((r: any) => ({ key: r.key }))
  },

  async setEnv(applicationId: string, organizationId: string, key: string, value: string) {
    const enc = encryptSecret(value)
    const res = await query(
      `INSERT INTO paas_environment_vars (application_id, key, value)
       SELECT $1, $2, $3
       WHERE EXISTS (SELECT 1 FROM paas_applications WHERE id = $1 AND organization_id = $4)
       ON CONFLICT (application_id, key) DO UPDATE SET value = EXCLUDED.value
       RETURNING application_id, key`,
      [applicationId, key, enc, organizationId]
    )
    if (res.rowCount > 0) {
      await markNeedsRedeploy(applicationId)
    }
    return res.rows[0] || null
  },

  async deleteEnv(applicationId: string, organizationId: string, key: string) {
    const res = await query(
      `DELETE FROM paas_environment_vars WHERE application_id = $1 AND key = $2
       AND EXISTS (SELECT 1 FROM paas_applications WHERE id = $1 AND organization_id = $3)`,
      [applicationId, key, organizationId]
    )
    if (res.rowCount > 0) {
      await markNeedsRedeploy(applicationId)
    }
    return res.rowCount > 0
  },

  async addCustomDomain(applicationId: string, organizationId: string, domainInput: string) {
    const app = await this.getForOrg(applicationId, organizationId)
    if (!app) return null
    const domain = domainInput.trim().toLowerCase()
    if (!/^[a-z0-9.-]+$/.test(domain)) throw new Error('Invalid domain')
    await validateDomainOwnership(domain, app.node_id)
    const domains = normalizeDomains(app.custom_domains)
    if (domains.find((d) => d.domain === domain)) throw new Error('Domain already exists')
    domains.push({
      domain,
      status: 'pending_ssl',
      added_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      last_error: null,
    })
    const res = await query(
      'UPDATE paas_applications SET custom_domains = $3, updated_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING custom_domains',
      [applicationId, organizationId, JSON.stringify(domains)]
    )
    await PaasAlertService.notifyOrganization(organizationId, 'paas.domain.added', {
      entityType: 'paas_application',
      entityId: applicationId,
      message: `Custom domain ${domain} added`,
      status: 'info',
    })
    return res.rows[0]?.custom_domains ?? domains
  },

  async removeCustomDomain(applicationId: string, organizationId: string, domainInput: string) {
    const app = await this.getForOrg(applicationId, organizationId)
    if (!app) return false
    const domain = domainInput.trim().toLowerCase()
    const domains = normalizeDomains(app.custom_domains).filter((d) => d.domain !== domain)
    await query('UPDATE paas_applications SET custom_domains = $3 WHERE id = $1 AND organization_id = $2', [
      applicationId,
      organizationId,
      JSON.stringify(domains),
    ])
    return true
  },

  async markDomainsActive(applicationId: string, domains: string[]) {
    if (!Array.isArray(domains) || !domains.length) return null
    const lookup = new Set(domains.map(d => String(d).trim().toLowerCase()).filter(Boolean))
    if (!lookup.size) return null
    const res = await query('SELECT custom_domains FROM paas_applications WHERE id = $1', [applicationId])
    if (res.rows.length === 0) return null
    const current = normalizeDomains(res.rows[0].custom_domains)
    let mutated = false
    for (const domain of current) {
      if (lookup.has(domain.domain)) {
        domain.status = 'active'
        domain.verified_at = new Date().toISOString()
        domain.last_error = null
        mutated = true
      }
    }
    if (!mutated) return current
    await query('UPDATE paas_applications SET custom_domains = $2, updated_at = NOW() WHERE id = $1', [
      applicationId,
      JSON.stringify(current),
    ])
    return current
  },

  async linkGithubRepository(
    applicationId: string,
    organizationId: string,
    input: {
      repoUrl: string
      branch: string
      token: string
      repoFullName?: string | null
      webhookId?: number | null
      webhookSecret?: string | null
      autoDeploy?: boolean
    }
  ) {
    const encryptedToken = encryptSecret(input.token)
    const encryptedSecret = input.webhookSecret ? encryptSecret(input.webhookSecret) : null
    const autoDeploy = typeof input.autoDeploy === 'boolean' ? input.autoDeploy : true
    const res = await query(
      `UPDATE paas_applications SET
        git_repo_url = $3,
        git_repo_full_name = $4,
        git_branch = $5,
        git_oauth_token = $6,
        auto_deploy = $7,
        git_webhook_id = $8,
        git_webhook_secret = $9,
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *`,
      [
        applicationId,
        organizationId,
        input.repoUrl,
        input.repoFullName ?? null,
        input.branch,
        encryptedToken,
        autoDeploy,
        input.webhookId ?? null,
        encryptedSecret,
      ]
    )
    return res.rows[0] || null
  },

  async unlinkGithubRepository(applicationId: string, organizationId: string) {
    const res = await query(
      `UPDATE paas_applications SET
        git_repo_url = NULL,
        git_repo_full_name = NULL,
        git_branch = 'main',
        git_oauth_token = NULL,
        auto_deploy = FALSE,
        git_webhook_id = NULL,
        git_webhook_secret = NULL,
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *`,
      [applicationId, organizationId]
    )
    return res.rows[0] || null
  },
  async updateGithubToken(applicationId: string, organizationId: string, token: string | null) {
    await query(
      'UPDATE paas_applications SET git_oauth_token = $3 WHERE id = $1 AND organization_id = $2',
      [applicationId, organizationId, token ? encryptSecret(token) : null]
    )
  },

  async setAutoDeploy(
    applicationId: string,
    organizationId: string,
    input: { enabled: boolean; webhookId?: number | null; webhookSecret?: string | null }
  ) {
    const encryptedSecret = input.webhookSecret ? encryptSecret(input.webhookSecret) : null
    const res = await query(
      `UPDATE paas_applications SET
        auto_deploy = $3,
        git_webhook_id = $4,
        git_webhook_secret = $5,
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *`,
      [applicationId, organizationId, input.enabled, input.webhookId ?? null, encryptedSecret]
    )
    return res.rows[0] || null
  },
}

async function markNeedsRedeploy(applicationId: string) {
  await query(
    'UPDATE paas_applications SET needs_redeploy = TRUE, last_env_updated_at = NOW(), updated_at = NOW() WHERE id = $1',
    [applicationId]
  )
}
