import { run } from './utils'

export async function dockerInfo() {
  const { code, stdout } = await run('docker', ['info', '--format', '{{json .}}'])
  return code === 0 ? stdout : null
}

export async function dockerBuild(
  imageTag: string,
  contextDir: string,
  log: (s: string) => void,
  opts: { timeoutMs?: number } = {}
) {
  return run('docker', ['build', '-t', imageTag, contextDir], { log, timeoutMs: opts.timeoutMs })
}

export async function dockerPull(image: string, log: (s: string) => void) {
  return run('docker', ['pull', image], { log })
}

export async function dockerRunContainer(opts: {
  name: string
  image: string
  env?: Record<string, string>
  ports?: Array<{ host: number; container: number }>
  memoryMb?: number
  cpuMillicores?: number
  volumes?: Array<{ host: string; container: string }>
  detach?: boolean
  args?: string[]
  network?: string
  user?: string
  capDrop?: string[]
  securityOpts?: string[]
  readOnlyRoot?: boolean
  pidsLimit?: number
}, log: (s: string) => void) {
  const args = ['run', '--rm']
  if (opts.detach) args.push('-d')
  args.push('--name', opts.name)
  if (opts.readOnlyRoot) {
    args.push('--read-only')
  }
  if (opts.memoryMb && opts.memoryMb > 0) args.push('--memory', `${opts.memoryMb}m`)
  if (opts.cpuMillicores && opts.cpuMillicores > 0) args.push('--cpus', `${opts.cpuMillicores / 1000}`)
  if (opts.pidsLimit && opts.pidsLimit > 0) {
    args.push('--pids-limit', `${opts.pidsLimit}`)
  }
  if (opts.capDrop?.length) {
    for (const cap of opts.capDrop) {
      args.push('--cap-drop', cap)
    }
  }
  if (opts.securityOpts?.length) {
    for (const opt of opts.securityOpts) {
      args.push('--security-opt', opt)
    }
  }
  if (opts.user) {
    args.push('--user', opts.user)
  }
  for (const [k, v] of Object.entries(opts.env || {})) args.push('-e', `${k}=${v}`)
  for (const p of opts.ports || []) args.push('-p', `${p.host}:${p.container}`)
  for (const v of opts.volumes || []) args.push('-v', `${v.host}:${v.container}`)
  if (opts.network) {
    args.push('--network', opts.network)
  }
  args.push(opts.image)
  if (opts.args?.length) args.push(...opts.args)
  return run('docker', args, { log })
}

export async function dockerEnsureNetwork(name: string, subnet?: string) {
  const inspect = await run('docker', ['network', 'inspect', name])
  if (inspect.code === 0) return
  const args = ['network', 'create', name]
  if (subnet) {
    args.push('--subnet', subnet)
  }
  await run('docker', args)
}

export async function dockerRemoveNetwork(name: string) {
  await run('docker', ['network', 'rm', name])
}

export async function dockerStop(name: string) {
  return run('docker', ['stop', name])
}

export async function dockerRemove(name: string) {
  return run('docker', ['rm', '-f', name])
}
