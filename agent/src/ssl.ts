import fs from 'node:fs/promises'
import path from 'node:path'
import { Client, directory, forge } from 'acme-client'
import { AgentConfig } from './config'

export interface CertificateInfo {
  certPath: string
  keyPath: string
  domains: string[]
  expiresAt: number
}

const RENEW_BUFFER_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const DEFAULT_CERT_TTL_MS = 80 * 24 * 60 * 60 * 1000 // assume 80 days validity

export async function ensureCertificate(cfg: AgentConfig, domains: string[]): Promise<CertificateInfo | null> {
  if (cfg.sslProvider !== 'letsencrypt') return null
  if (!cfg.certEmail || !cfg.dataDir) return null
  const sanitized = sanitizeDomains(domains)
  if (!sanitized.length) return null

  const certDir = path.join(cfg.dataDir, 'certs')
  await fs.mkdir(certDir, { recursive: true })
  const slug = sanitized.join('_').replace(/[^a-z0-9_-]/g, '')
  const certPath = path.join(certDir, `${slug}.crt`)
  const keyPath = path.join(certDir, `${slug}.key`)
  const metaPath = path.join(certDir, `${slug}.json`)

  const existing = await readMeta(metaPath)
  if (existing && existing.expiresAt - RENEW_BUFFER_MS > Date.now() && await fileExists(existing.certPath) && await fileExists(existing.keyPath)) {
    return existing
  }

  const challengeDir = cfg.challengeDir || path.join(cfg.dataDir, 'acme-challenges')
  await fs.mkdir(challengeDir, { recursive: true })

  const accountKeyPath = path.join(certDir, 'account.key')
  const accountKey = await loadOrCreateAccountKey(accountKeyPath)

  const client = new Client({
    directoryUrl: cfg.letsencryptDirectory === 'staging' ? directory.letsencrypt.staging : directory.letsencrypt.production,
    accountKey,
  })

  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${cfg.certEmail}`],
  })

  const [privateKey, csr] = await forge.createCsr({
    commonName: sanitized[0],
    altNames: sanitized,
  })

  const certificate = await client.auto({
    csr,
    email: cfg.certEmail,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
      const filePath = path.join(challengeDir, challenge.token)
      await fs.writeFile(filePath, keyAuthorization, 'utf8')
    },
    challengeRemoveFn: async (_authz, challenge) => {
      const filePath = path.join(challengeDir, challenge.token)
      await fs.unlink(filePath).catch(() => {})
    },
  })

  await fs.writeFile(certPath, certificate)
  await fs.writeFile(keyPath, privateKey)
  const meta: CertificateInfo = {
    certPath,
    keyPath,
    domains: sanitized,
    expiresAt: Date.now() + DEFAULT_CERT_TTL_MS,
  }
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2))
  return meta
}

function sanitizeDomains(domains: string[]): string[] {
  const set = new Set<string>()
  for (const domain of domains) {
    if (!domain) continue
    const trimmed = domain.trim().toLowerCase()
    if (!trimmed) continue
    if (!/^[a-z0-9.-]+$/.test(trimmed)) continue
    set.add(trimmed)
  }
  return Array.from(set)
}

async function loadOrCreateAccountKey(accountKeyPath: string): Promise<string> {
  if (await fileExists(accountKeyPath)) {
    return fs.readFile(accountKeyPath, 'utf8')
  }
  const key = await forge.createPrivateKey()
  await fs.writeFile(accountKeyPath, key)
  return key.toString()
}

async function readMeta(metaPath: string): Promise<CertificateInfo | null> {
  try {
    const raw = await fs.readFile(metaPath, 'utf8')
    return JSON.parse(raw) as CertificateInfo
  } catch {
    return null
  }
}

async function fileExists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
