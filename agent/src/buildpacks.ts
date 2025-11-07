import fs from 'node:fs/promises'
import path from 'node:path'

export type SupportedRuntime = 'node' | 'python' | 'php'

export interface BuildpackOptions {
  runtimeHint?: string | null
  runtimeVersion?: string | null
  baseImage?: string | null
  buildCommand?: string | null
  startCommand?: string | null
  port: number
}

export type BuildPlan =
  | { kind: 'custom'; dockerfilePath: string; summary: string }
  | { kind: SupportedRuntime; dockerfile: string; summary: string }

export async function planBuildpack(workdir: string, opts: BuildpackOptions): Promise<BuildPlan> {
  if (await hasCustomDockerfile(workdir)) {
    return { kind: 'custom', dockerfilePath: await resolveDockerfilePath(workdir), summary: 'Using repository Dockerfile' }
  }

  const repoRuntime = await detectRepoRuntime(workdir)
  const runtime = repoRuntime ?? normalizeRuntime(opts.runtimeHint) ?? 'node'

  switch (runtime) {
    case 'python':
      return {
        kind: 'python',
        dockerfile: await createPythonDockerfile(workdir, opts),
        summary: repoRuntime ? 'Detected Python project' : 'Using Python runtime configuration',
      }
    case 'php':
      return {
        kind: 'php',
        dockerfile: await createPhpDockerfile(workdir, opts),
        summary: repoRuntime ? 'Detected PHP project' : 'Using PHP runtime configuration',
      }
    default:
      return {
        kind: 'node',
        dockerfile: await createNodeDockerfile(workdir, opts),
        summary: repoRuntime ? 'Detected Node.js project' : 'Using Node.js runtime configuration',
      }
  }
}

async function hasCustomDockerfile(workdir: string) {
  return (
    (await fileExists(path.join(workdir, 'Dockerfile'))) ||
    (await fileExists(path.join(workdir, 'dockerfile'))) ||
    (await fileExists(path.join(workdir, 'Dockerfile.prod')))
  )
}

async function resolveDockerfilePath(workdir: string) {
  const candidates = ['Dockerfile', 'dockerfile', 'Dockerfile.prod']
  for (const file of candidates) {
    if (await fileExists(path.join(workdir, file))) {
      return file
    }
  }
  return 'Dockerfile'
}

async function detectRepoRuntime(workdir: string): Promise<SupportedRuntime | null> {
  if (await fileExists(path.join(workdir, 'package.json'))) return 'node'
  if ((await fileExists(path.join(workdir, 'requirements.txt'))) || (await fileExists(path.join(workdir, 'Pipfile')))) return 'python'
  if (await fileExists(path.join(workdir, 'composer.json'))) return 'php'
  return null
}

function normalizeRuntime(input?: string | null): SupportedRuntime | null {
  if (!input) return null
  const value = input.toLowerCase()
  if (value.includes('node')) return 'node'
  if (value.includes('python')) return 'python'
  if (value.includes('php')) return 'php'
  return null
}

async function createNodeDockerfile(workdir: string, opts: BuildpackOptions) {
  const pkg = await readJson(path.join(workdir, 'package.json'))
  const port = opts.port || 3000
  const packageManager = await detectPackageManager(workdir)
  const baseImage = opts.baseImage || resolveNodeBaseImage(opts.runtimeVersion, pkg?.engines?.node)
  const hasBuildScript = Boolean(pkg?.scripts?.build)
  const hasStartScript = Boolean(pkg?.scripts?.start)
  const installCommand = resolveInstallCommand(packageManager)
  const runner = packageManager === 'npm' ? 'npm' : packageManager
  const buildCommand = opts.buildCommand || (hasBuildScript ? `${runner} run build` : '')
  const startCommand = opts.startCommand || (hasStartScript ? `${runner} run start` : 'node server.js')
  const setupPackageManager = resolvePackageManagerSetup(packageManager)

  const copyStatements = await buildCopyStatements(workdir, ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])

  return [
    `FROM ${baseImage}`,
    'WORKDIR /app',
    ...copyStatements,
    setupPackageManager,
    installCommand,
    'COPY . .',
    'RUN chown -R node:node /app || true',
    'ENV NODE_ENV=production',
    `ENV PORT=${port}`,
    buildCommand ? `RUN ${buildCommand}` : '',
    'USER node',
    `EXPOSE ${port}`,
    `CMD ["sh","-c","${escapeCmd(startCommand)}"]`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function createPythonDockerfile(workdir: string, opts: BuildpackOptions) {
  const port = opts.port || 8000
  const baseImage = opts.baseImage || resolvePythonBaseImage(opts.runtimeVersion)
  const usesPipenv = await fileExists(path.join(workdir, 'Pipfile'))
  const hasRequirements = await fileExists(path.join(workdir, 'requirements.txt'))
  const startCommand = wrapPythonStartCommand(
    opts.startCommand || `gunicorn app:app --bind 0.0.0.0:${port}`,
    usesPipenv
  )

  const pipStatements: string[] = []
  if (usesPipenv) {
    pipStatements.push(await buildCopyStatement(workdir, 'Pipfile'))
    const pipfileLock = await buildCopyStatement(workdir, 'Pipfile.lock')
    if (pipfileLock) pipStatements.push(pipfileLock)
    pipStatements.push('RUN pip install pipenv && pipenv install --deploy --ignore-pipfile')
  } else if (hasRequirements) {
    pipStatements.push('COPY requirements.txt ./')
    pipStatements.push('RUN pip install --no-cache-dir -r requirements.txt')
  }

  return [
    `FROM ${baseImage}`,
    'WORKDIR /app',
    'ENV PYTHONDONTWRITEBYTECODE=1',
    'ENV PYTHONUNBUFFERED=1',
    ...pipStatements.filter(Boolean),
    'COPY . .',
    'RUN useradd --system --create-home appuser || true',
    'RUN chown -R appuser /app || true',
    'USER appuser',
    `ENV PORT=${port}`,
    `EXPOSE ${port}`,
    `CMD ["sh","-c","${escapeCmd(startCommand)}"]`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function createPhpDockerfile(workdir: string, opts: BuildpackOptions) {
  const port = opts.port || 8080
  const baseImage = opts.baseImage || resolvePhpBaseImage(opts.runtimeVersion)
  const hasComposer = await fileExists(path.join(workdir, 'composer.json'))
  const startCommand = opts.startCommand || 'apache2-foreground'

  const composerSteps = hasComposer
    ? [
        'RUN apt-get update && apt-get install -y git unzip && rm -rf /var/lib/apt/lists/*',
        'RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer',
        'COPY composer.json ./',
        (await fileExists(path.join(workdir, 'composer.lock'))) ? 'COPY composer.lock ./' : '',
        'RUN composer install --no-dev --optimize-autoloader',
      ].filter(Boolean)
    : []

  return [
    `FROM ${baseImage}`,
    'WORKDIR /var/www/html',
    ...composerSteps,
    'COPY . .',
    'RUN chown -R www-data:www-data /var/www/html || true',
    'USER www-data',
    `ENV PORT=${port}`,
    `EXPOSE ${port}`,
    `CMD ["sh","-c","${escapeCmd(startCommand)}"]`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function detectPackageManager(workdir: string): Promise<'npm' | 'yarn' | 'pnpm'> {
  if (await fileExists(path.join(workdir, 'yarn.lock'))) return 'yarn'
  if (await fileExists(path.join(workdir, 'pnpm-lock.yaml'))) return 'pnpm'
  return 'npm'
}

function resolveInstallCommand(pm: 'npm' | 'yarn' | 'pnpm') {
  if (pm === 'yarn') return 'RUN yarn install --frozen-lockfile --production=true'
  if (pm === 'pnpm') return 'RUN pnpm install --frozen-lockfile --prod'
  return 'RUN npm ci --omit=dev'
}

function resolvePackageManagerSetup(pm: 'npm' | 'yarn' | 'pnpm') {
  if (pm === 'npm') return ''
  const tool = pm === 'yarn' ? 'yarn@stable' : 'pnpm@latest'
  return `RUN corepack enable && corepack prepare ${tool} --activate`
}

function resolveNodeBaseImage(runtimeVersion?: string | null, engines?: string) {
  const version = pickVersion(runtimeVersion) || pickVersion(engines) || '20'
  return `node:${version}-alpine`
}

function resolvePythonBaseImage(runtimeVersion?: string | null) {
  const version = pickVersion(runtimeVersion) || '3.11'
  return `python:${version}-slim`
}

function resolvePhpBaseImage(runtimeVersion?: string | null) {
  const version = pickVersion(runtimeVersion) || '8.2'
  return `php:${version}-apache`
}

function pickVersion(input?: string | null) {
  if (!input) return null
  const match = input.match(/\d+(\.\d+)?/)
  return match ? match[0] : null
}

function escapeCmd(cmd: string) {
  return cmd.replace(/"/g, '\\"')
}

function wrapPythonStartCommand(cmd: string, usesPipenv: boolean) {
  if (!usesPipenv) return cmd
  if (cmd.startsWith('pipenv run')) return cmd
  return `pipenv run ${cmd}`
}

async function readJson(file: string) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function buildCopyStatements(workdir: string, files: string[]) {
  const statements: string[] = []
  for (const file of files) {
    const statement = await buildCopyStatement(workdir, file)
    if (statement) statements.push(statement)
  }
  return statements
}

async function buildCopyStatement(workdir: string, file: string) {
  if (await fileExists(path.join(workdir, file))) {
    return `COPY ${file} ./`
  }
  return ''
}
