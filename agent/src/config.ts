import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export interface AgentConfig {
  controlPlaneUrl: string
  registrationToken?: string
  nodeId?: string
  jwtSecret?: string
  region?: string
  maxContainers?: number
  maxCpuPercent?: number
  maxMemoryPercent?: number
  ingressType?: 'nginx' | 'traefik'
  sslProvider?: 'letsencrypt' | 'none'
  logLevel?: 'info' | 'debug' | 'warn' | 'error'
  dataDir?: string
  ingressConfigPath?: string
  nginxReloadCommand?: string
  certEmail?: string
  challengeDir?: string
  letsencryptDirectory?: 'production' | 'staging'
  backupProvider?: 'local' | 's3'
  backupS3Bucket?: string
  backupS3Region?: string
  backupS3AccessKey?: string
  backupS3SecretKey?: string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '../config.json')

async function readConfigFile(): Promise<AgentConfig> {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8')
  return JSON.parse(raw) as AgentConfig
}

async function saveConfigFile(cfg: AgentConfig) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

async function registerNode(cfg: AgentConfig): Promise<AgentConfig> {
  if (!cfg.registrationToken) return cfg
  if (cfg.nodeId && cfg.jwtSecret) return cfg
  if (!cfg.controlPlaneUrl) throw new Error('controlPlaneUrl is required')
  const body = {
    registrationToken: cfg.registrationToken,
    hostAddress: os.hostname(),
  }
  const res = await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/nodes/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Node registration failed (${res.status})`)
  }
  const data = await res.json()
  if (!data?.success || !data?.data?.id || !data?.data?.jwtSecret) {
    throw new Error('Node registration response missing fields')
  }
  const next: AgentConfig = {
    ...cfg,
    nodeId: data.data.id,
    jwtSecret: data.data.jwtSecret,
    region: data.data.region ?? cfg.region,
  }
  delete next.registrationToken
  await saveConfigFile(next)
  return next
}

export async function loadConfig(): Promise<AgentConfig> {
  try {
    const cfg = await readConfigFile()
    if (!cfg.controlPlaneUrl) throw new Error('controlPlaneUrl missing')
    const hydrated = await registerNode(cfg)
    if (!hydrated.nodeId || !hydrated.jwtSecret) {
      throw new Error('nodeId/jwtSecret missing in config')
    }
    const dataDir = hydrated.dataDir || path.resolve(process.cwd(), '.skypanel-agent')
    await fs.mkdir(dataDir, { recursive: true })
    hydrated.dataDir = dataDir
    hydrated.challengeDir = hydrated.challengeDir || path.join(dataDir, 'acme-challenges')
    await fs.mkdir(hydrated.challengeDir, { recursive: true })
    hydrated.ingressConfigPath = hydrated.ingressConfigPath || '/etc/skypanel/nginx/conf.d'
    hydrated.nginxReloadCommand = hydrated.nginxReloadCommand || 'nginx -s reload'
    hydrated.sslProvider = hydrated.sslProvider || 'none'
    hydrated.letsencryptDirectory = hydrated.letsencryptDirectory || 'production'
    hydrated.backupProvider = hydrated.backupProvider || 'local'
    return hydrated
  } catch (err) {
    console.error('Failed to load config.json', err)
    process.exit(1)
  }
}
