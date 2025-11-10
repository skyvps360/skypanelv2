# SkyPanelV2 PaaS – Developer Guide

This handbook targets contributors working on the PaaS backend/worker/UI. It catalogs services, interfaces, database schema, code examples, and contribution workflows so that future changes stay aligned with the requirements/design docs.

## 1. Repository Overview

| Path | Description |
| --- | --- |
| `api/` | Express API, services, middleware, migrations runner. |
| `api/worker/` | Bull-based worker process (`buildQueue`, `deployQueue`, `billingQueue`). |
| `src/` | React client (admin + user dashboards). |
| `docker/paas/` | Infrastructure stack definitions (Traefik, Loki, Grafana, Prometheus, Promtail, cAdvisor). |
| `scripts/` | Operational helpers (`init-paas.ts`, `setup-worker.sh`, migrations, seeding). |
| `repo-docs/` | Documentation suite (this file plus admin/user guides, troubleshooting references). |

## 2. Runtime Architecture

```
Client (React) ──REST/SSE──> Express API ──Bull──► Worker
                                     │            │
                                     ├─ Postgres   ├─ Docker CLI / Swarm
                                     ├─ Redis      ├─ Traefik / Loki / Prometheus
                                     └─ Loki       └─ File/S3 storage
```

* **API Server** handles authentication, plan enforcement, organization billing, domains, logs, and admin features.
* **Worker** executes long-running tasks (build/deploy/billing), monitors nodes & health checks, enforces log retention, and now auto-registers the local node when API + worker share a host.
* **Infrastructure** is deployed via `npm run paas:init`, creating overlay networks (`paas-infrastructure`, `paas-public`) and all observability services.

## 3. Key Services & Interfaces

| Service | Location | Responsibilities |
| --- | --- | --- |
| `BuilderService` | `api/services/paas/builderService.ts` | Clones git repos, detects buildpacks, restores build cache, runs Herokuish builds, uploads slugs, logs output. |
| `DeployerService` | `api/services/paas/deployerService.ts` | Extracts slugs, builds Docker images, configures health checks, deploys/updates Swarm services, handles rollbacks/restarts. |
| `BuildCacheService` | `api/services/paas/buildCacheService.ts` | Stores/restores compressed build caches (local or S3), handles TTL/size policies, supports manual invalidation. |
| `PaasBillingService` | `api/services/paas/billingService.ts` | Hourly usage calculation, wallet deductions, auto-suspension of orgs. |
| `LoggerService` | `api/services/paas/loggerService.ts` | Streams Loki logs, enforces log retention window, provides SSE helpers. |
| `HealthCheckService` | `api/services/paas/healthCheckService.ts` | Builds Docker health config, monitors results, restarts unhealthy apps, records telemetry. |
| `NodeManagerService` | `api/services/paas/nodeManagerService.ts` | Swarm init, worker provisioning, resource polling, alerting, *local-node auto registration*. |
| `PaasSettingsService` | `api/services/paas/settingsService.ts` | Database-backed settings registry with encryption, validation, default seeding. |
| `PaasPlanService` | `api/services/paas/planService.ts` | Default plan creation, pricing calculations, admin/user plan listings. |
| `SlugService`, `SSLService`, `PaasEnvironmentService` | Helpers for artifacts, TLS lifecycle, and app env vars. |

### Example: Enqueueing a Build + Deploy

```ts
import { buildQueue } from '../worker/queues.js';

await buildQueue.add('build', {
  applicationId: app.id,
  gitUrl: app.git_url,
  gitBranch: app.git_branch,
  gitCommit: commitSha,
  replicas: app.replicas,
  userId: req.user.id,
});
```

`api/worker/index.ts` listens for `buildQueue.process` → `BuilderService.build()`. On success it chains a job to `deployQueue` with the deployment id, replicas, and (if rollback) a cached slug path.

### Example: Restoring Build Cache

```ts
const cacheKey = crypto.createHash('sha1')
  .update(`${app.id}:${buildpack}:${app.stack}`)
  .digest('hex');

const cache = await BuildCacheService.getValidCache(app.id, cacheKey, config.ttlHours);
if (cache) {
  const archive = await BuildCacheService.downloadCacheArchive(cache);
  await tar.extract({ file: archive.archivePath, cwd: cacheDir });
  await BuildCacheService.touchCache(cache.id);
}
```

## 4. Database Schema Reference

| Table | Purpose |
| --- | --- |
| `paas_applications` | App metadata, status, plan, stack, health check fields. |
| `paas_deployments` | Deployment history (version, slug URL, build logs, rolled-back lineage). |
| `paas_build_cache` | Build cache records keyed by app + cache hash. |
| `paas_worker_nodes` | Swarm nodes (capacity, status, metadata, heartbeat). |
| `paas_domains` | Custom domains + SSL state. |
| `paas_environment_vars` | User/system env vars per app (encrypted values). |
| `paas_resource_usage` | Hourly billing entries (app/org/cost). |
| `paas_settings` | Admin-configurable settings (encrypted + typed). |
| `paas_plans` | Resource plan catalog with pricing + features. |

Every migration lives in `migrations/*.sql`. Run `node scripts/run-migration.js` locally or before deployments; files are idempotent.

## 5. Local Development Workflow

1. Copy `.env.example` → `.env` and customize.
2. `npm install`
3. `node scripts/run-migration.js`
4. `npm run paas:init` (first time to deploy infra).
5. `npm run dev:all` to launch client + API + worker together.
6. Optional: `npm run test -- <pattern>` for Vitest suites (e.g., `paas.overview`). Add new test files under `api/tests` or `src/__tests__`.

### Running the Worker Only
```
npm run dev:worker   # nodemon + tsx
```

### Logs & Monitoring
* Worker logs show queue progress plus health/billing enforcement.
* API exposes `/api/health` for readiness (includes DB + Redis checks).
* Grafana (http://localhost:3001) ships with Loki + Prometheus datasources pre-provisioned.

## 6. Contribution Guidelines

1. Follow the coding conventions already present (TypeScript + ES modules).
2. Run `npm run lint` and `npm run test` for the areas you touch.
3. Keep `.kiro/specs/paas-fixes/tasks.md` in sync—check off items when done.
4. Update documentation (`repo-docs/*.md`) whenever behavior changes.
5. Database migrations must be additive and reversible; never edit old migration files.
6. For UI work, leverage the shared UI kit under `src/components/ui`.
7. Avoid committing secrets; use `.env.example` for placeholders.
8. When introducing new services:
   - Add a section here describing the interface.
   - Update admin/user docs if behavior is user-facing.
   - Ensure worker + API are resilient (retry/backoff/logging).

## 7. Reference Commands

| Action | Command |
| --- | --- |
| Run all migrations | `node scripts/run-migration.js` |
| Reset DB (dangerous) | `npm run db:reset:confirm` |
| Deploy infra stack | `npm run paas:init` |
| Start API + client + worker | `npm run dev:all` |
| Start worker only | `npm run dev:worker` |
| Seed admin user | `npm run seed:admin` |
| Format check | `npm run lint` / `npm run test` |

Armed with this guide, contributors can confidently extend services, add migrations, and keep the documentation + specs aligned with the ever-growing SkyPanelV2 PaaS surface area.
