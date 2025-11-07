import path from 'node:path'
import fs from 'node:fs/promises'
import { AgentConfig } from './config'
import { run } from './utils'
import { dockerBuild, dockerPull, dockerRunContainer, dockerStop, dockerRemove, dockerEnsureNetwork } from './docker'
import { followContainerLogs, stopLogStreaming } from './logStream'
import { syncIngress, removeIngressConfig } from './ingress'
import { saveAppState, loadAppState, saveDatabaseState, loadDatabaseState, removeDatabaseState } from './state'
import { planBuildpack } from './buildpacks'
import { ensureCertificate, CertificateInfo } from './ssl'
import { uploadBackup } from './backupUploader'

export type Task =
  | DeployTask
  | ControlTask
  | DatabaseTask

interface DeployTask {
  taskId: string
  type: 'deploy'
  applicationId: string
  buildId: string
  gitRepoUrl?: string
  gitBranch?: string
  gitAuthToken?: string
  runtimeType?: string
  runtimeVersion?: string
  baseImage?: string
  buildCommand?: string
  startCommand?: string
  cpuLimit?: number
  memoryLimit?: number
  storageLimit?: number
  instanceCount?: number
  environmentVars?: Record<string, string>
  systemDomain?: string
  customDomains?: string[]
  port?: number
  forceNonRoot?: boolean
  runUser?: string | null
}

interface ControlTask {
  taskId: string
  type: 'restart' | 'stop' | 'start' | 'scale'
  applicationId: string
  instanceCount?: number
}

interface DatabaseTask {
  taskId: string
  type: 'db_create' | 'db_delete' | 'db_backup' | 'db_restore'
  db?: {
    id: string
    type: 'mysql' | 'postgresql'
    version: string
    username: string
    password: string
    database: string
    port: number
  }
  databaseId?: string
  retentionDays?: number
  backupPath?: string
  dbType?: 'mysql' | 'postgresql'
  username?: string
  password?: string
  database?: string
}

const BUILD_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_NON_ROOT_USER = '1000:1000'

async function postStatus(cfg: AgentConfig, taskId: string, nodeToken: string, body: any) {
  const res = await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`status post failed: ${res.status}`)
}

async function postLogs(cfg: AgentConfig, taskId: string, nodeToken: string, chunk: string) {
  const payload = chunk.length > 64000 ? chunk.slice(-64000) : chunk
  const res = await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/tasks/${taskId}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify({ chunk: payload }),
  })
  if (!res.ok) throw new Error(`logs post failed: ${res.status}`)
}

export async function handleTask(cfg: AgentConfig, nodeToken: string, task: Task) {
  try {
    switch (task.type) {
      case 'deploy':
        await handleDeploy(cfg, nodeToken, task)
        break
      case 'restart':
        await handleRestart(cfg, nodeToken, task)
        break
      case 'stop':
        await handleStop(cfg, nodeToken, task.applicationId)
        break
      case 'start':
        await handleStart(cfg, nodeToken, task.applicationId)
        break
      case 'scale':
        if (typeof task.instanceCount === 'number') {
          await handleScale(cfg, nodeToken, task.applicationId, task.instanceCount)
        }
        break
      case 'db_create':
        if (task.db) await handleDatabaseCreate(cfg, task.db)
        break
      case 'db_delete':
        if (task.db) await handleDatabaseDelete(cfg, task.db.id)
        break
      case 'db_backup':
        if (task.databaseId) await handleDatabaseBackup(cfg, nodeToken, task.databaseId, task.retentionDays || 7)
        break
      case 'db_restore':
        if (task.databaseId && task.backupPath && task.dbType && task.username && task.password && task.database) {
          await handleDatabaseRestore(cfg, task)
        }
        break
      default:
        break
    }
  } catch (err: any) {
    console.error('Task error', task.type, err)
    if (task.type === 'deploy' && task.buildId) {
      try {
        await postStatus(cfg, task.buildId, nodeToken, { status: 'failed', error: err?.message || 'task failed' })
      } catch {}
    }
  }
}

async function handleDeploy(cfg: AgentConfig, nodeToken: string, task: DeployTask) {
  await postStatus(cfg, task.buildId, nodeToken, { status: 'building' })
  const workdir = `/tmp/skp-build-${task.buildId}`
  await run('rm', ['-rf', workdir])
  await run('mkdir', ['-p', workdir])
  const cloneSource = task.gitRepoUrl || ''
  if (!cloneSource) {
    await postStatus(cfg, task.buildId, nodeToken, { status: 'failed', error: 'No repository configured for application' })
    return
  }
  const authUrl = buildGitCloneUrl(cloneSource, task.gitAuthToken)
  await postLogs(cfg, task.buildId, nodeToken, `Cloning ${cloneSource}#${task.gitBranch || 'main'}\n`)
  const clone = await run(
    'git',
    ['clone', '--depth=1', '--branch', task.gitBranch || 'main', authUrl, workdir],
    {
      log: (s) => void postLogs(cfg, task.buildId, nodeToken, s),
      env: { GIT_TERMINAL_PROMPT: '0' },
    }
  )
  if (clone.code !== 0) {
    await postStatus(cfg, task.buildId, nodeToken, { status: 'failed', error: 'git clone failed' })
    return
  }

  const buildPlan = await planBuildpack(workdir, {
    runtimeHint: task.runtimeType,
    runtimeVersion: task.runtimeVersion,
    baseImage: task.baseImage,
    buildCommand: task.buildCommand,
    startCommand: task.startCommand,
    port: task.port || 3000,
  })

  if (buildPlan.kind === 'custom') {
    await postLogs(cfg, task.buildId, nodeToken, `Using repository Dockerfile (${buildPlan.dockerfilePath})\n`)
  } else {
    await fs.writeFile(path.join(workdir, 'Dockerfile'), buildPlan.dockerfile)
    await postLogs(cfg, task.buildId, nodeToken, `Buildpack selected: ${buildPlan.kind}\n`)
  }

  const imageTag = `skpapp:${task.buildId}`
  await postLogs(cfg, task.buildId, nodeToken, `Building image ${imageTag}\n`)
  const build = await dockerBuild(
    imageTag,
    workdir,
    (s) => void postLogs(cfg, task.buildId, nodeToken, s),
    { timeoutMs: BUILD_TIMEOUT_MS }
  )
  if (build.code !== 0) {
    const errorMessage = build.timedOut ? 'image build timed out after 15 minutes' : 'image build failed'
    await postStatus(cfg, task.buildId, nodeToken, { status: 'failed', error: errorMessage })
    return
  }

  await stopAppContainers(task.applicationId)
  const instanceCount = task.instanceCount ?? 1
  const hostPorts: number[] = []
  const env: Record<string, string> = { ...(task.environmentVars || {}) }
  if (!env.PORT) {
    env.PORT = String(task.port || 3000)
  }
  if (!env.NODE_ENV) {
    env.NODE_ENV = 'production'
  }

  const runUser = task.forceNonRoot === false ? undefined : (task.runUser || DEFAULT_NON_ROOT_USER)
  const networkName = await ensureAppNetwork(task.applicationId)
  const domainList = collectDomains(task.systemDomain, task.customDomains)

  for (let i = 0; i < instanceCount; i++) {
    const containerName = containerNameFor(task.applicationId, i + 1)
    const hostPort = computeHostPort(task.applicationId, task.port || 3000, i)
    hostPorts.push(hostPort)
    const runRes = await dockerRunContainer(
      {
        name: containerName,
        image: imageTag,
        env,
        ports: [{ host: hostPort, container: task.port || 3000 }],
        memoryMb: task.memoryLimit,
        cpuMillicores: task.cpuLimit,
        detach: true,
        network: networkName,
        user: runUser,
        capDrop: ['ALL'],
        securityOpts: ['no-new-privileges=true'],
        pidsLimit: 512,
      },
      (s) => void postLogs(cfg, task.buildId, nodeToken, s)
    )
    if (runRes.code !== 0) {
      await postStatus(cfg, task.buildId, nodeToken, { status: 'failed', error: `container ${containerName} start failed` })
      return
    }
    followContainerLogs(cfg, task.applicationId, containerName, nodeToken)
  }

  await syncIngress(cfg, {
    applicationId: task.applicationId,
    systemDomain: task.systemDomain,
    customDomains: task.customDomains || [],
    upstreamPorts: hostPorts,
    targetPort: task.port || 3000,
    challengeDir: cfg.challengeDir,
    tls: null,
  })

  let tlsInfo: CertificateInfo | null = null
  if (cfg.sslProvider === 'letsencrypt' && domainList.length) {
    tlsInfo = await issueCertificateWithRetry(cfg, domainList)
    if (tlsInfo) {
      await syncIngress(cfg, {
        applicationId: task.applicationId,
        systemDomain: task.systemDomain,
        customDomains: task.customDomains || [],
        upstreamPorts: hostPorts,
        targetPort: task.port || 3000,
        challengeDir: cfg.challengeDir,
        tls: { certPath: tlsInfo.certPath, keyPath: tlsInfo.keyPath },
      })
      await notifyDomainsActive(cfg, nodeToken, task.applicationId, domainList).catch(() => {})
    }
  }

  await saveAppState(cfg.dataDir!, task.applicationId, {
    imageTag,
    env,
    port: task.port || 3000,
    hostPorts,
    instanceCount,
    lastDeployedAt: Date.now(),
    systemDomain: task.systemDomain,
    customDomains: task.customDomains || [],
    networkName,
    runUser: runUser || null,
    tlsCertPath: tlsInfo?.certPath ?? null,
    tlsKeyPath: tlsInfo?.keyPath ?? null,
  })

  await postStatus(cfg, task.buildId, nodeToken, { status: 'success', image_tag: imageTag })
}

async function handleRestart(cfg: AgentConfig, nodeToken: string, task: ControlTask) {
  await stopAppContainers(task.applicationId)
  await handleStart(cfg, nodeToken, task.applicationId)
}

async function handleStop(cfg: AgentConfig, nodeToken: string, applicationId: string) {
  await stopAppContainers(applicationId)
  stopLogStreaming(applicationId)
  await removeIngressConfig(cfg, applicationId)
}

async function handleStart(cfg: AgentConfig, nodeToken: string, applicationId: string) {
  const state = await loadAppState(cfg.dataDir!, applicationId)
  if (!state) return
  await stopAppContainers(applicationId)
  const hostPorts: number[] = []
  const networkName = state.networkName || (await ensureAppNetwork(applicationId))
  const runUser = state.runUser ?? undefined
  for (let i = 0; i < state.instanceCount; i++) {
    const containerName = containerNameFor(applicationId, i + 1)
    const hostPort = computeHostPort(applicationId, state.port, i)
    hostPorts.push(hostPort)
    await dockerRunContainer(
      {
        name: containerName,
        image: state.imageTag,
        env: state.env,
        ports: [{ host: hostPort, container: state.port }],
        memoryMb: undefined,
        cpuMillicores: undefined,
        detach: true,
        network: networkName,
        user: runUser,
        capDrop: ['ALL'],
        securityOpts: ['no-new-privileges=true'],
        pidsLimit: 512,
      },
      () => {}
    )
    followContainerLogs(cfg, applicationId, containerName, nodeToken)
  }
  await syncIngress(cfg, {
    applicationId,
    systemDomain: state.systemDomain,
    customDomains: state.customDomains || [],
    upstreamPorts: hostPorts,
    targetPort: state.port,
    challengeDir: cfg.challengeDir,
    tls: null,
  })

  const domainList = collectDomains(state.systemDomain, state.customDomains)
  let tlsInfo: CertificateInfo | null = null
  if (cfg.sslProvider === 'letsencrypt' && domainList.length) {
    tlsInfo = await issueCertificateWithRetry(cfg, domainList)
    if (tlsInfo) {
      await syncIngress(cfg, {
        applicationId,
        systemDomain: state.systemDomain,
        customDomains: state.customDomains || [],
        upstreamPorts: hostPorts,
        targetPort: state.port,
        challengeDir: cfg.challengeDir,
        tls: { certPath: tlsInfo.certPath, keyPath: tlsInfo.keyPath },
      })
      await notifyDomainsActive(cfg, nodeToken, applicationId, domainList).catch(() => {})
    }
  } else if (state.tlsCertPath && state.tlsKeyPath) {
    await syncIngress(cfg, {
      applicationId,
      systemDomain: state.systemDomain,
      customDomains: state.customDomains || [],
      upstreamPorts: hostPorts,
      targetPort: state.port,
      challengeDir: cfg.challengeDir,
      tls: { certPath: state.tlsCertPath, keyPath: state.tlsKeyPath },
    })
    tlsInfo = { certPath: state.tlsCertPath, keyPath: state.tlsKeyPath, domains: domainList, expiresAt: Date.now() }
  }

  state.tlsCertPath = tlsInfo?.certPath ?? state.tlsCertPath ?? null
  state.tlsKeyPath = tlsInfo?.keyPath ?? state.tlsKeyPath ?? null
  state.hostPorts = hostPorts
  await saveAppState(cfg.dataDir!, applicationId, state)
}

async function handleScale(cfg: AgentConfig, nodeToken: string, applicationId: string, instanceCount: number) {
  const state = await loadAppState(cfg.dataDir!, applicationId)
  if (!state) return
  state.instanceCount = instanceCount
  const networkName = state.networkName || (await ensureAppNetwork(applicationId))
  state.networkName = networkName
  const runUser = state.runUser ?? undefined
  const currentContainers = await listContainers(applicationId)
  if (currentContainers.length > instanceCount) {
    for (let i = instanceCount; i < currentContainers.length; i++) {
      await dockerStop(currentContainers[i]).catch(() => {})
      await dockerRemove(currentContainers[i]).catch(() => {})
    }
    stopLogStreaming(applicationId)
  } else if (currentContainers.length < instanceCount) {
    for (let i = currentContainers.length; i < instanceCount; i++) {
      const containerName = containerNameFor(applicationId, i + 1)
      const hostPort = computeHostPort(applicationId, state.port, i)
      await dockerRunContainer(
        {
          name: containerName,
          image: state.imageTag,
          env: state.env,
          ports: [{ host: hostPort, container: state.port }],
          detach: true,
          network: networkName,
          user: runUser,
          capDrop: ['ALL'],
          securityOpts: ['no-new-privileges=true'],
          pidsLimit: 512,
        },
        () => {}
      )
      followContainerLogs(cfg, applicationId, containerName, nodeToken)
    }
  }
  await saveAppState(cfg.dataDir!, applicationId, state)
  const hostPorts = Array.from({ length: instanceCount }, (_, i) => computeHostPort(applicationId, state.port, i))
  await syncIngress(cfg, {
    applicationId,
    systemDomain: state.systemDomain,
    customDomains: state.customDomains || [],
    upstreamPorts: hostPorts,
    targetPort: state.port,
    challengeDir: cfg.challengeDir,
    tls: state.tlsCertPath && state.tlsKeyPath
      ? { certPath: state.tlsCertPath, keyPath: state.tlsKeyPath }
      : null,
  })
}

async function handleDatabaseCreate(cfg: AgentConfig, db: NonNullable<DatabaseTask['db']>) {
  await dockerPull(db.type === 'postgresql' ? `postgres:${db.version}` : `mysql:${db.version}`, () => {})
  const name = databaseContainerName(db.id)
  const env: Record<string, string> = {}
  if (db.type === 'postgresql') {
    env.POSTGRES_USER = db.username
    env.POSTGRES_PASSWORD = db.password
    env.POSTGRES_DB = db.database
  } else {
    env.MYSQL_USER = db.username
    env.MYSQL_PASSWORD = db.password
    env.MYSQL_ROOT_PASSWORD = db.password
    env.MYSQL_DATABASE = db.database
  }
  await dockerRunContainer(
    {
      name,
      image: db.type === 'postgresql' ? `postgres:${db.version}` : `mysql:${db.version}`,
      env,
      ports: [{ host: db.port, container: db.port }],
      detach: true,
      capDrop: ['ALL'],
      securityOpts: ['no-new-privileges=true'],
      pidsLimit: 1024,
    },
    () => {}
  )
  await saveDatabaseState(cfg.dataDir!, db.id, {
    id: db.id,
    type: db.type,
    username: db.username,
    password: db.password,
    port: db.port,
  })
}

async function handleDatabaseDelete(cfg: AgentConfig, dbId: string) {
  const name = databaseContainerName(dbId)
  await dockerStop(name).catch(() => {})
  await dockerRemove(name).catch(() => {})
  await removeDatabaseState(cfg.dataDir!, dbId)
}

async function handleDatabaseBackup(cfg: AgentConfig, nodeToken: string, databaseId: string, retentionDays: number) {
  const state = await loadDatabaseState(cfg.dataDir!, databaseId)
  if (!state) return
  const name = databaseContainerName(databaseId)
  const backupDir = path.join(cfg.dataDir!, 'backups')
  await fs.mkdir(backupDir, { recursive: true })
  const filePath = path.join(backupDir, `${databaseId}-${Date.now()}.sql`)
  if (state.type === 'postgresql') {
    await run('docker', ['exec', '-e', `PGPASSWORD=${state.password}`, name, 'pg_dump', '-U', state.username, state.id, '-f', `/tmp/${databaseId}.sql`])
    await run('docker', ['cp', `${name}:/tmp/${databaseId}.sql`, filePath])
  } else {
    await run('docker', ['exec', name, 'sh', '-c', `mysqldump -u${state.username} -p${state.password} ${state.id} > /tmp/${databaseId}.sql`])
    await run('docker', ['cp', `${name}:/tmp/${databaseId}.sql`, filePath])
  }
  const uploadResult = await uploadBackup(cfg, filePath, databaseId)
  await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/databases/${databaseId}/backups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify({ path: uploadResult.storagePath, size_bytes: uploadResult.size, retention_days: retentionDays }),
  })
}

async function handleDatabaseRestore(cfg: AgentConfig, task: DatabaseTask) {
  if (!task.backupPath) return
  const name = databaseContainerName(task.databaseId!)
  await dockerStop(name).catch(() => {})
  await dockerRunContainer(
    {
      name,
      image: task.dbType === 'postgresql' ? `postgres:latest` : `mysql:latest`,
      env: task.dbType === 'postgresql'
        ? { POSTGRES_USER: task.username!, POSTGRES_PASSWORD: task.password!, POSTGRES_DB: task.database! }
        : {
            MYSQL_USER: task.username!,
            MYSQL_PASSWORD: task.password!,
            MYSQL_ROOT_PASSWORD: task.password!,
            MYSQL_DATABASE: task.database!,
          },
      detach: true,
      capDrop: ['ALL'],
      securityOpts: ['no-new-privileges=true'],
      pidsLimit: 1024,
    },
    () => {}
  )
  if (task.dbType === 'postgresql') {
    await run('docker', ['cp', task.backupPath, `${name}:/tmp/restore.sql`])
    await run('docker', ['exec', '-e', `PGPASSWORD=${task.password}`, name, 'psql', '-U', task.username!, '-d', task.database!, '-f', '/tmp/restore.sql'])
  } else {
    await run('docker', ['cp', task.backupPath, `${name}:/tmp/restore.sql`])
    await run('docker', ['exec', name, 'sh', '-c', `mysql -u${task.username} -p${task.password} ${task.database} < /tmp/restore.sql`])
  }
}

async function stopAppContainers(applicationId: string) {
  const containers = await listContainers(applicationId)
  for (const name of containers) {
    await dockerStop(name).catch(() => {})
    await dockerRemove(name).catch(() => {})
  }
}

async function ensureAppNetwork(applicationId: string) {
  const name = appNetworkName(applicationId)
  await dockerEnsureNetwork(name)
  return name
}

function appNetworkName(applicationId: string) {
  const cleaned = applicationId.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `skp-net-${cleaned.slice(0, 40) || 'default'}`
}

function collectDomains(systemDomain?: string | null, customDomains?: any): string[] {
  const domains: string[] = []
  if (systemDomain) domains.push(systemDomain)
  if (Array.isArray(customDomains)) {
    for (const entry of customDomains) {
      if (!entry) continue
      if (typeof entry === 'string') {
        domains.push(entry)
      } else if (typeof entry.domain === 'string') {
        domains.push(entry.domain)
      }
    }
  }
  return Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)))
}

async function issueCertificateWithRetry(cfg: AgentConfig, domains: string[]): Promise<CertificateInfo | null> {
  try {
    return await ensureCertificate(cfg, domains)
  } catch (err) {
    console.error('[agent] TLS issuance failed', err)
    return null
  }
}

async function notifyDomainsActive(cfg: AgentConfig, nodeToken: string, appId: string, domains: string[]) {
  if (!domains.length) return
  await fetch(`${cfg.controlPlaneUrl}/api/internal/paas/applications/${appId}/domains/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nodeToken}` },
    body: JSON.stringify({ domains }),
  }).catch(() => {})
}

async function listContainers(applicationId: string): Promise<string[]> {
  const res = await run('docker', ['ps', '-a', '--format', '{{.Names}}'])
  if (res.code !== 0) return []
  const prefix = containerNamePrefix(applicationId)
  return res.stdout
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name.startsWith(`${prefix}-`))
}

function containerNameFor(applicationId: string, suffix: number | string) {
  return `${containerNamePrefix(applicationId)}-${suffix}`
}

function containerNamePrefix(applicationId: string) {
  return `skp-${applicationId}`
}

function computeHostPort(appId: string, internalPort: number, index: number) {
  const hash = parseInt(appId.replace(/-/g, '').slice(0, 6), 16) || 0
  const base = 20000 + (hash % 20000)
  return base + index
}

function databaseContainerName(dbId: string) {
  return `skp-db-${dbId}`
}

function buildGitCloneUrl(baseUrl: string, token?: string) {
  if (!token || !baseUrl.startsWith('http')) return baseUrl
  try {
    const url = new URL(baseUrl)
    url.username = 'x-access-token'
    url.password = token
    return url.toString()
  } catch {
    return baseUrl
  }
}
