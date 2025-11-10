# SkyPanelV2 PaaS – Admin Setup Guide

> This guide explains how to bring the SkyPanelV2 PaaS stack online, configure core services, and keep the environment healthy. It reflects every backend/system feature delivered in the PaaS requirements (billing, workers, health checks, domains, logging, build caching, etc.).

## 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| OS | Ubuntu 22.04+ / Debian 12+ with systemd |
| Software | Node 20+, npm 10+, Docker 25+, Docker Buildx/Compose plugin, Git |
| Database | PostgreSQL 15+ with `uuid-ossp` extension enabled |
| Redis | Required for Bull queues (`REDIS_URL`) |
| TLS / DNS | Wildcard or delegated domain for Traefik + per-app subdomains |

Before continuing, make sure your `.env` (or secrets store) contains at least:

```ini
DATABASE_URL=postgres://user:pass@host/db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=...
ENCRYPTION_KEY=...
LOKI_ENDPOINT=http://localhost:3100
LOKI_RETENTION_DAYS=7
VITE_PROMETHEUS_URL=http://localhost:9090
VITE_PROMETHEUS_APP_LABEL=app_id
```

> `scripts/setup-worker.sh` keeps `VITE_PROMETHEUS_URL` and `VITE_PROMETHEUS_APP_LABEL` in sync whenever you provision the co-located worker.

## 2. First-Time Installation

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run migrations**
   ```bash
   node scripts/run-migration.js
   ```
3. **Seed an admin**
   ```bash
   npm run seed:admin
   ```
4. **Initialize the PaaS infrastructure**
   ```bash
   npm run paas:init
   ```
   This script:
   - Initializes Docker Swarm (idempotent).
   - Renders Loki/Grafana/Prometheus configs (`docker/paas/generated`).
   - Deploys the `paas-infra` stack (Traefik, Loki, Grafana, Promtail, Prometheus, cAdvisor).
5. **Start the platform**
   ```bash
   npm run dev:all   # API + client + worker on the same host
   ```
   The worker auto-registers the local node in `/admin#paas-workers`. For multi-node clusters you can still run `scripts/setup-worker.sh` on additional hosts.

### Architecture at a Glance

```
┌──────────────────────────────┐      ┌────────────────────────────┐
│  React Client (Dashboard)    │      │   Admin Console (/admin)  │
└──────────────┬───────────────┘      └──────────────┬─────────────┘
               │ REST / SSE                         │
        ┌──────▼─────────────────────────────────────▼──────┐
        │              Express API Server                   │
        │  /api/paas/*  /api/admin/paas/*  /api/worker/*    │
        └──────┬────────────────────┬───────────────────────┘
               │Queues (Bull)       │Postgres / Redis / Loki
        ┌──────▼──────┐             │
        │ PaaS Worker │◄────────────┘
        ├─────────────┤
        │ Build/Deploy│→ Docker Swarm (apps)
        │ Billing     │→ Traefik / Prometheus / Grafana / Loki
        │ Health/Logs │
        └─────────────┘
```

## 3. Configuration Matrix

All PaaS settings live in the `paas_settings` table and are editable under **Admin → PaaS Settings**. Key categories:

| Category | Keys | Notes |
| --- | --- | --- |
| Storage | `storage_type`, `local_storage_path`, `s3_*` | Controls build/slug/cache storage. |
| Logging | `loki_endpoint`, `loki_retention_days` | Used by `LoggerService` + worker retention job. |
| Buildpacks | `buildpack_default_stack`, `buildpack_cache_enabled`, `buildpack_cache_ttl_hours`, `buildpack_cache_max_size_mb` | Drives the BuilderService cache behavior. |
| Swarm | `swarm_initialized`, `swarm_manager_ip`, `swarm_join_token_*` | Populated automatically by `npm run paas:init`. |
| Networking | `traefik_acme_email`, `default_domain` | Domain + SSL automation. |
| Limits | `max_apps_per_org`, `max_deployments_per_hour` | Enforced in PaaS API routes. |

### Worker Nodes

* When API + worker run on the same server, `NodeManagerService.ensureLocalNodeRegistered()` automatically creates/updates a `paas_worker_nodes` row.
* Remote workers: copy `.env`, run `scripts/setup-worker.sh <SWARM_TOKEN> <MANAGER_IP>`, then approve the node inside `/admin#paas-workers` if required.
* Worker monitors run every 30s (resource updates) and 60s (health checks). Alerts are posted via the Notification Service.

## 4. Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `docker stack deploy ... network ... cannot be used` | Make sure both `paas-infrastructure` and `paas-public` are overlay networks (already fixed in repo). Re-run `docker stack rm paas-infra && npm run paas:init`. |
| `redis` errors / queues stuck | Confirm `REDIS_URL` is reachable. Worker logs show queue failures by job type. |
| Apps stuck in `building` | Inspect `BuilderService` logs via `/api/paas/apps/:id/deployments/:deploymentId/logs`. Verify build cache path `/var/paas/cache` exists and Docker can mount it. |
| Health monitor marks node unreachable | Ensure Docker daemon is running and that Swarm tokens match. Run `docker info --format '{{json .Swarm}}'` for diagnostics. |
| Billing stops apps unexpectedly | Wallet deductions occur hourly; check organization balance in Admin > Organizations. Suspended orgs cannot deploy/scale until restored. |

## 5. Operational Checklist

1. Keep Swarm manager backups (snapshot the host or replicate settings table).
2. Monitor Loki + Prometheus endpoints (Grafana dashboards included).
3. Rotate sensitive settings through the admin UI; encrypted values are stored using `ENCRYPTION_KEY`.
4. After pull/deploy:
   - `node scripts/run-migration.js` (idempotent).
   - `npm run paas:init` if any stack changes shipped.
   - Restart API + worker (`npm run dev:all` or `pm2 reload`). |
5. Document every external integration (SMTP, PayPal, providers) in `.env` and keep `.env.example` aligned (already includes Redis + Loki).

With these instructions an administrator can bootstrap a brand-new cluster, keep it patched, and understand every moving part introduced throughout the PaaS backlog.
