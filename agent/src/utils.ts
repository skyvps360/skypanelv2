import { spawn } from 'node:child_process'

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  log?: (s: string) => void
  timeoutMs?: number
}

export interface RunResult {
  code: number
  stdout: string
  stderr: string
  timedOut?: boolean
}

export async function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) } })
    let out = ''
    let err = ''
    let timedOut = false
    let timer: NodeJS.Timeout | null = null

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true
        try {
          child.kill('SIGTERM')
        } catch {}
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {}
        }, 2000)
      }, opts.timeoutMs)
    }

    child.stdout.on('data', (d) => {
      const s = d.toString()
      out += s
      opts.log?.(s)
    })
    child.stderr.on('data', (d) => {
      const s = d.toString()
      err += s
      opts.log?.(s)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      if (timedOut) {
        err += '\nProcess timed out and was terminated.\n'
      }
      resolve({ code: timedOut ? 124 : code ?? 0, stdout: out, stderr: err, timedOut })
    })
  })
}
