import jwt from 'jsonwebtoken'
import { config } from '../../config/index.js'
import { encryptSecret, decryptSecret } from '../../lib/crypto.js'
import { query } from '../../lib/database.js'

const OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_URL = 'https://api.github.com'
const STATE_EXPIRATION_SECONDS = 10 * 60
const DEFAULT_SCOPES = ['repo', 'read:user']

interface GithubTokenResponse {
  access_token: string
  token_type?: string
  scope?: string
  refresh_token?: string
  refresh_token_expires_in?: number
  expires_in?: number
}

interface GithubStatePayload {
  userId: string
  organizationId: string
}

interface GithubConnectionRecord {
  id: string
  organization_id: string
  user_id: string
  access_token: string
  refresh_token: string | null
  token_type: string | null
  scope: string | null
  expires_at: Date | null
  github_user_id: number | null
  github_login: string | null
  github_avatar_url: string | null
}

export class GithubServiceError extends Error {}

export const PaasGithubService = {
  isConfigured() {
    return Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET && config.GITHUB_OAUTH_CALLBACK)
  },

  createStateToken(payload: GithubStatePayload) {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      iss: 'skypanel:github',
    }
    return jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn: STATE_EXPIRATION_SECONDS })
  },

  verifyStateToken(state: string): GithubStatePayload | null {
    try {
      const decoded = jwt.verify(state, config.JWT_SECRET, { issuer: 'skypanel:github' }) as any
      return { userId: decoded.userId, organizationId: decoded.organizationId }
    } catch (err) {
      console.error('GitHub OAuth state verification failed', err)
      return null
    }
  },

  buildAuthorizeUrl(state: string) {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID || '',
      redirect_uri: config.GITHUB_OAUTH_CALLBACK || '',
      scope: DEFAULT_SCOPES.join(' '),
      state,
      allow_signup: 'false',
    })
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`
  },

  async exchangeCodeForToken(code: string) {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID || '',
      client_secret: config.GITHUB_CLIENT_SECRET || '',
      code,
      redirect_uri: config.GITHUB_OAUTH_CALLBACK || '',
    })
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: params,
    })
    if (!res.ok) {
      throw new GithubServiceError(`GitHub token exchange failed (${res.status})`)
    }
    const data = (await res.json()) as GithubTokenResponse & { error?: string; error_description?: string }
    if (data.error) {
      throw new GithubServiceError(`GitHub token error: ${data.error_description || data.error}`)
    }
    return data
  },

  async refreshAccessToken(refreshToken: string) {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID || '',
      client_secret: config.GITHUB_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: params,
    })
    if (!res.ok) {
      throw new GithubServiceError(`GitHub refresh failed (${res.status})`)
    }
    const data = (await res.json()) as GithubTokenResponse & { error?: string; error_description?: string }
    if (data.error) throw new GithubServiceError(`GitHub refresh error: ${data.error_description || data.error}`)
    return data
  },

  async upsertConnection(input: {
    organizationId: string
    userId: string
    token: GithubTokenResponse
    profile?: { id?: number; login?: string; avatar_url?: string }
  }) {
    const expiresAt = input.token.expires_in ? new Date(Date.now() + input.token.expires_in * 1000) : null
    const encAccess = encryptSecret(input.token.access_token)
    const encRefresh = input.token.refresh_token ? encryptSecret(input.token.refresh_token) : null
    const res = await query(
      `INSERT INTO paas_github_connections (
        organization_id, user_id, access_token, refresh_token, token_type, scope, expires_at,
        github_user_id, github_login, github_avatar_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (organization_id, user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, paas_github_connections.refresh_token),
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expires_at = EXCLUDED.expires_at,
        github_user_id = COALESCE(EXCLUDED.github_user_id, paas_github_connections.github_user_id),
        github_login = COALESCE(EXCLUDED.github_login, paas_github_connections.github_login),
        github_avatar_url = COALESCE(EXCLUDED.github_avatar_url, paas_github_connections.github_avatar_url),
        updated_at = NOW()
      RETURNING *`,
      [
        input.organizationId,
        input.userId,
        encAccess,
        encRefresh,
        input.token.token_type || 'bearer',
        input.token.scope || DEFAULT_SCOPES.join(' '),
        expiresAt,
        input.profile?.id ?? null,
        input.profile?.login ?? null,
        input.profile?.avatar_url ?? null,
      ]
    )
    return res.rows[0]
  },

  async getConnection(organizationId: string, userId: string): Promise<(GithubConnectionRecord & { access_token_plain: string; refresh_token_plain?: string | null }) | null> {
    const res = await query('SELECT * FROM paas_github_connections WHERE organization_id = $1 AND user_id = $2', [
      organizationId,
      userId,
    ])
    if (!res.rows.length) return null
    const row = res.rows[0] as GithubConnectionRecord
    return {
      ...row,
      access_token_plain: decryptSecret(row.access_token),
      refresh_token_plain: row.refresh_token ? decryptSecret(row.refresh_token) : null,
    }
  },

  async deleteConnection(organizationId: string, userId: string) {
    await query('DELETE FROM paas_github_connections WHERE organization_id = $1 AND user_id = $2', [organizationId, userId])
  },

  async ensureValidAccessToken(connection: Awaited<ReturnType<typeof PaasGithubService.getConnection>>) {
    if (!connection) throw new GithubServiceError('GitHub connection not found')
    if (connection.expires_at && connection.refresh_token_plain) {
      const expiryBuffer = 60 * 1000
      if (new Date(connection.expires_at).getTime() < Date.now() + expiryBuffer) {
        const refreshed = await this.refreshAccessToken(connection.refresh_token_plain)
        const profile = await this.fetchGitHubUser(refreshed.access_token)
        const updated = await this.upsertConnection({
          organizationId: connection.organization_id,
          userId: connection.user_id,
          token: refreshed,
          profile,
        })
        return {
          ...updated,
          access_token_plain: refreshed.access_token,
          refresh_token_plain: refreshed.refresh_token || connection.refresh_token_plain,
        }
      }
    }
    return connection
  },

  async fetchGitHubUser(accessToken: string) {
    const res = await fetch(`${GITHUB_API_URL}/user`, {
      headers: this.buildHeaders(accessToken),
    })
    if (!res.ok) throw new GithubServiceError(`GitHub user fetch failed (${res.status})`)
    return (await res.json()) as { id: number; login: string; avatar_url?: string }
  },

  buildHeaders(token: string) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  },

  async listRepositories(connection: Awaited<ReturnType<typeof PaasGithubService.getConnection>>) {
    const ensured = await this.ensureValidAccessToken(connection)
    const res = await fetch(`${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`, {
      headers: this.buildHeaders(ensured.access_token_plain),
    })
    if (!res.ok) throw new GithubServiceError(`GitHub repositories fetch failed (${res.status})`)
    return res.json()
  },

  async listBranches(
    connection: Awaited<ReturnType<typeof PaasGithubService.getConnection>>,
    owner: string,
    repo: string
  ) {
    const ensured = await this.ensureValidAccessToken(connection)
    const res = await fetch(
      `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      {
        headers: this.buildHeaders(ensured.access_token_plain),
      }
    )
    if (!res.ok) throw new GithubServiceError(`GitHub branches fetch failed (${res.status})`)
    return res.json()
  },

  async getRepository(
    connection: Awaited<ReturnType<typeof PaasGithubService.getConnection>>,
    owner: string,
    repo: string
  ) {
    const ensured = await this.ensureValidAccessToken(connection)
    const res = await fetch(
      `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: this.buildHeaders(ensured.access_token_plain),
      }
    )
    if (!res.ok) throw new GithubServiceError(`GitHub repository fetch failed (${res.status})`)
    return res.json()
  },

  async createWebhookWithToken(
    token: string,
    owner: string,
    repo: string,
    input: { url: string; secret: string; events?: string[] }
  ) {
    const target = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`
    const payload = {
      name: 'web',
      active: true,
      events: input.events && input.events.length ? input.events : ['push'],
      config: {
        url: input.url,
        content_type: 'json',
        insecure_ssl: '0',
        secret: input.secret,
      },
    }
    const res = await fetch(target, {
      method: 'POST',
      headers: this.buildHeaders(token),
      body: JSON.stringify(payload),
    })
    if (res.ok) return res.json()
    if (res.status === 422) {
      const existing = await this.findWebhookByUrl(token, owner, repo, input.url)
      if (existing?.id) {
        await this.updateWebhookWithToken(token, owner, repo, existing.id, payload)
        return existing
      }
    }
    const body = await res.text().catch(() => '')
    throw new GithubServiceError(`GitHub webhook create failed (${res.status}): ${body || 'unknown error'}`)
  },

  async deleteWebhookWithToken(token: string, owner: string, repo: string, hookId: number) {
    const target = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}`
    const res = await fetch(target, {
      method: 'DELETE',
      headers: this.buildHeaders(token),
    })
    if (res.status === 404) return false
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new GithubServiceError(`GitHub webhook delete failed (${res.status}): ${body || 'unknown error'}`)
    }
    return true
  },

  async findWebhookByUrl(token: string, owner: string, repo: string, url: string) {
    const hooks = await this.listWebhooks(token, owner, repo)
    return hooks.find((hook: any) => hook?.config?.url === url) || null
  },

  async listWebhooks(token: string, owner: string, repo: string) {
    const target = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`
    const res = await fetch(target, {
      method: 'GET',
      headers: this.buildHeaders(token),
    })
    if (!res.ok) throw new GithubServiceError(`GitHub webhook list failed (${res.status})`)
    return res.json()
  },

  async updateWebhookWithToken(token: string, owner: string, repo: string, hookId: number, payload: any) {
    const target = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}`
    const res = await fetch(target, {
      method: 'PATCH',
      headers: this.buildHeaders(token),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new GithubServiceError(`GitHub webhook update failed (${res.status}): ${body || 'unknown error'}`)
    }
    return res.json()
  },
}
