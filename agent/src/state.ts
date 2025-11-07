import fs from 'node:fs/promises'
import path from 'node:path'

export interface AppState {
  imageTag: string
  env: Record<string, string>
  port: number
  hostPorts: number[]
  instanceCount: number
  lastDeployedAt: number
  systemDomain?: string | null
  customDomains?: string[]
  networkName?: string | null
  runUser?: string | null
  tlsCertPath?: string | null
  tlsKeyPath?: string | null
}

export interface DatabaseState {
  id: string
  type: 'mysql' | 'postgresql'
  username: string
  password: string
  port: number
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function saveAppState(dataDir: string, appId: string, state: AppState) {
  const dir = path.join(dataDir, 'apps')
  await ensureDir(dir)
  await fs.writeFile(path.join(dir, `${appId}.json`), JSON.stringify(state, null, 2))
}

export async function loadAppState(dataDir: string, appId: string): Promise<AppState | null> {
  try {
    const raw = await fs.readFile(path.join(dataDir, 'apps', `${appId}.json`), 'utf8')
    return JSON.parse(raw) as AppState
  } catch {
    return null
  }
}

export async function removeAppState(dataDir: string, appId: string) {
  try {
    await fs.unlink(path.join(dataDir, 'apps', `${appId}.json`))
  } catch {}
}

export async function saveDatabaseState(dataDir: string, dbId: string, state: DatabaseState) {
  const dir = path.join(dataDir, 'databases')
  await ensureDir(dir)
  await fs.writeFile(path.join(dir, `${dbId}.json`), JSON.stringify(state, null, 2))
}

export async function loadDatabaseState(dataDir: string, dbId: string): Promise<DatabaseState | null> {
  try {
    const raw = await fs.readFile(path.join(dataDir, 'databases', `${dbId}.json`), 'utf8')
    return JSON.parse(raw) as DatabaseState
  } catch {
    return null
  }
}

export async function removeDatabaseState(dataDir: string, dbId: string) {
  try {
    await fs.unlink(path.join(dataDir, 'databases', `${dbId}.json`))
  } catch {}
}
