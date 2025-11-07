import type { Request, Response } from 'express'

type Subscriber = { res: Response; req: Request }

const channels = new Map<string, Set<Subscriber>>()

export function runtimeChannel(appId: string) {
  return `runtime:${appId}`
}

export function buildChannel(buildId: string) {
  return `build:${buildId}`
}

export function subscribe(channel: string, req: Request, res: Response) {
  if (!channels.has(channel)) {
    channels.set(channel, new Set())
  }
  const subs = channels.get(channel)!
  const subscriber: Subscriber = { req, res }
  subs.add(subscriber)

  const cleanup = () => {
    subs.delete(subscriber)
    if (subs.size === 0) {
      channels.delete(channel)
    }
  }

  req.on('close', cleanup)
  req.on('end', cleanup)
  req.on('error', cleanup)
}

export function publish(channel: string, event: string, payload: any) {
  const subs = channels.get(channel)
  if (!subs || subs.size === 0) return
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const { res } of subs) {
    try {
      res.write(data)
    } catch {
      // swallow write errors
    }
  }
}
