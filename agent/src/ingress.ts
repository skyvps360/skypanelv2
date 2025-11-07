import fs from 'node:fs/promises'
import path from 'node:path'
import { AgentConfig } from './config'
import { run } from './utils'

interface IngressOptions {
  applicationId: string
  systemDomain?: string | null
  customDomains?: string[]
  upstreamPorts: number[]
  targetPort: number
  tls?: {
    certPath: string
    keyPath: string
  } | null
  challengeDir?: string
}

const HEADER = `proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;`

export async function syncIngress(cfg: AgentConfig, opts: IngressOptions) {
  const configDir = cfg.ingressConfigPath || '/etc/skypanel/nginx/conf.d'
  await fs.mkdir(configDir, { recursive: true })
  const challengeDir = opts.challengeDir || path.join(cfg.dataDir || process.cwd(), 'acme-challenges')
  await fs.mkdir(challengeDir, { recursive: true })
  const domains = [
    ...(opts.systemDomain ? [opts.systemDomain] : []),
    ...(opts.customDomains || []),
  ].filter(Boolean)
  if (!domains.length || !opts.upstreamPorts.length) {
    await removeIngressConfig(cfg, opts.applicationId)
    return
  }
  const upstreamName = `skp_up_${opts.applicationId.replace(/[^a-z0-9]/gi, '')}`
  const upstream = `
upstream ${upstreamName} {
${opts.upstreamPorts.map((port) => `    server 127.0.0.1:${port} max_fails=3 fail_timeout=10s;`).join('\n')}
}
`
  const serverBlocks = domains
    .map((domain) => {
      const httpBlock = `
server {
    listen 80;
    server_name ${domain};
    location /.well-known/acme-challenge/ {
        alias ${challengeDir}/;
        try_files $uri =404;
    }
    ${opts.tls ? 'location / { return 301 https://$host$request_uri; }' : `location / {
        proxy_pass http://${upstreamName};
        ${HEADER}
    }`}
}
`
      const httpsBlock = opts.tls
        ? `
server {
    listen 443 ssl http2;
    server_name ${domain};
    ssl_certificate ${opts.tls.certPath};
    ssl_certificate_key ${opts.tls.keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    location /.well-known/acme-challenge/ {
        alias ${challengeDir}/;
        try_files $uri =404;
    }
    location / {
        proxy_pass http://${upstreamName};
        ${HEADER}
    }
}
`
        : ''
      return `${httpBlock}\n${httpsBlock}`
    })
    .join('\n')

  await fs.writeFile(path.join(configDir, `${opts.applicationId}.conf`), `${upstream}\n${serverBlocks}`)
  await reloadNginx(cfg)
}

export async function removeIngressConfig(cfg: AgentConfig, appId: string) {
  const configDir = cfg.ingressConfigPath || '/etc/skypanel/nginx/conf.d'
  try {
    await fs.unlink(path.join(configDir, `${appId}.conf`))
    await reloadNginx(cfg)
  } catch {}
}

async function reloadNginx(cfg: Partial<AgentConfig>) {
  const command = cfg.nginxReloadCommand || 'nginx -s reload'
  const [cmd, ...args] = command.split(' ')
  try {
    await run(cmd, args)
  } catch (err) {
    console.warn('Failed to reload nginx', err)
  }
}
