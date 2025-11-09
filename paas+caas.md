# PaaS + CaaS Integration Plan (SkyPanelV2)

Purpose: Deliver a multi‑tenant PaaS (Heroku‑like) and a secure CaaS offering inside SkyPanelV2, aligned with the existing stack (Node/TS + Express API, PostgreSQL, React/Vite). Emphasis on strong tenant isolation for both PaaS apps and CaaS containers.

## Architecture Overview
- API: Node/TS (`api/`), Postgres (`migrations/`), auth + org scoping via existing middleware.
- Orchestrator: Docker Swarm with mTLS to manager, per‑org overlay networks, userns‑remap on workers.
- Build: Cloud Native Buildpacks (CNB) with `pack` on a build/manager node; private Docker registry with per‑org namespaces.
- Networking: Traefik v2 as global Swarm service for routing + ACME TLS.
- Observability: Promtail + Loki (logs), optional Prometheus/Grafana later.
- Frontend: New React pages for client/admin PaaS flows integrated into `src/App.tsx` and navigation.

## Isolation Model (PaaS and CaaS)
- DB and API: All PaaS/CaaS entities include `organization_id`. API enforces scoping via `authenticateToken` + `requireOrganization`.
- Network: One Swarm overlay network per org (`org_<uuid>`). Services connect only to their org network.
- Secrets: Docker Swarm secrets per org/env; never expose credentials in env vars; secrets mounted files only.
- User namespaces: Configure `userns-remap` on workers; allocate distinct UID/GID ranges per org.
- Container hardening: `cap-drop=ALL`, `no-new-privileges=true`, avoid privileged, read‑only rootfs when possible, seccomp/default, no hostPath mounts, deny `/var/run/docker.sock`.
- Storage: Named volumes only; per‑org encryption keys (driver‑level or application‑level). S3/MinIO backups.
- Optional SKU: Dedicated worker pools per org (hard isolation) for high‑security customers.

## Phased Implementation

### Phase 0 – Foundations
- Add environment config: `PAAS_BASE_DOMAIN`, `TRAEFIK_ACME_EMAIL`, `PRIVATE_REGISTRY_URL`, `REGISTRY_AUTH`, `DOCKER_MANAGER_HOST/PORT`, `DOCKER_TLS_CA/CERT/KEY`, `REDIS_URL`.
- Files:
  - `api/config/paas.ts` (load/validate env; sensible defaults for dev)
  - `api/server.ts` hook to start PaaS hourly usage billing alongside VPS billing
  - `api/app.ts` to mount new PaaS/CaaS routes

### Phase 1 – Database Foundation (Migration 003)
Add `migrations/003_paas_caas_schema.sql` (updated_at triggers + indexes) with:
- `paas_nodes` (id, role manager/worker, ipv4, region, capacity, status, labels, tls meta)
- `paas_plans` (name, quotas: cpu/mem/storage/bw, price_hourly, price_monthly, autoscaling flag)
- `paas_apps` (organization_id, name, repo_url, buildpack, created_by)
- `paas_environments`
  - Core: (app_id, name, region, instances, cpu/mem limits, env_vars jsonb)
  - CaaS alignment (per Claude): add `deploy_mode` (enum: `buildpack` | `image`), `image_ref`, `entrypoint`, `cmd`, `ports` (jsonb), `volumes` (jsonb), `healthcheck` (jsonb)
- `paas_deployments` (env_id, git_sha, image_ref, status, logs_ref, started/completed)
- `paas_containers` (env_id, node_id, status, health, started_at)
- `paas_domains` (env_id, hostname, dns_verify_status, tls_status)
- `paas_volumes` (org_id, env_id, name, driver, size_gb, encrypted, backup_policy, created_at)
- `paas_addon_plans` (type, tier, quotas, price)
- `paas_addons` (env_id, type, plan_id, status, backup_policy)
- `paas_webhooks` (provider, repo, branch, secret, app_id)
- `paas_usage` (org/app/env hourly aggregates for cpu‑hours, mem‑hours, storage GB‑mo, egress GB)

 CaaS tables (part of the same migration 003):
 - `caas_image_policies` (organization_id UNIQUE; allowed_registries text[], allowed_patterns text[], blocked_patterns text[], require_digest bool, require_signed bool)
 - `caas_registry_credentials` (organization_id, registry UNIQUE per org; username; secret_ref; created_by)
 - `caas_volume_snapshots` (volume_id, snapshot_id, storage_url, size_bytes, status, retained_until)
 - `caas_network_policies` (organization_id UNIQUE; egress_allow jsonb, ingress_allow jsonb, default_deny bool)
 - `caas_exec_audit` (env_id, user_id, command, started_at, duration_ms, status)

Additional tables for Deployment Packs (Heroku‑like) and Releases:
- `paas_stacks` (id, name, builder_image, run_image, description, enabled)
- `paas_buildpacks` (id, name, source_uri, version, enabled)
- `paas_stack_buildpacks` (stack_id, buildpack_id, order_index)
- `paas_templates` (id, name, description, deploy_mode, repo_url OR image_ref, default_env jsonb, recommended_stack_id, recommended_plan_id)
- `paas_releases` (id, env_id, version INT, image_ref, processes jsonb, config_snapshot jsonb, created_by, created_at)
- `paas_processes` (id, env_id, type TEXT CHECK (type IN ('web','worker','cron','task')), command TEXT, instances INT DEFAULT 1)
- `paas_runs` (id, env_id, command TEXT, status, logs_ref, started_at, finished_at, triggered_by)

### Phase 2 – Admin Worker Node Management
- Route: `api/routes/admin/paas.ts`
  - POST `/api/admin/paas/nodes` create node, return install/join script
  - GET list/details, DELETE remove, POST `/:id/drain` drain
- Service: `api/services/paas/WorkerNodeService.ts`
  - Generates Ubuntu 22.04 script: installs Docker, enables `userns-remap`, joins Swarm with encryption, installs Traefik agent (labels), Promtail, CNB `pack` on manager/build nodes, configures Docker mTLS (2376).
  - Persists node metadata and TLS cert material (encrypted) in `paas_nodes`/`platform_settings`.

### Phase 3 – Orchestration Layer
- Service: `api/services/paas/OrchestrationService.ts`
  - Connects to Swarm manager via `dockerode` mTLS.
  - Ensures per‑org overlay network; creates/updates services; rolling updates; healthchecks.
  - Placement constraints by region/labels from `paas_nodes`.
  - Enforces security opts and resource quotas from `paas_plans` + env overrides.
- Service: `api/services/paas/SecretService.ts` (Swarm secrets lifecycle per org/env).

### Phase 4 – Build & Registry
- Service: `api/services/paas/BuildService.ts`
  - Webhook/build queue → CNB `pack build` → tag as `registry/org-<uuid>/<app>:<sha>` → push to private registry.
  - Streams build logs via SSE/WebSocket.
- Jobs: `api/jobs/paas/buildQueue.ts` using `bull` + `REDIS_URL`.
- Start with GitHub/GitLab webhooks (built‑in SSH Git server can be added later).

Deployment Packs (Heroku‑like):
- Support selecting a `stack` for buildpack apps (e.g., heroku‑22 equivalent): uses `paas_stacks.builder_image` as the CNB builder and `run_image` for runtime.
- Buildpack catalog from `paas_buildpacks`; allow org/app override of buildpack order or auto‑detection.
- Templates bootstrap: `paas_templates` provide pre‑filled repo/image + envs per language/framework.
- Procfile/process detection captured into `paas_releases.processes`.

### Phase 5 – Networking & Domains
- Traefik v2 global Swarm service, ACME HTTP‑01.
- Default domain: `app-env.paas.<worker-ip>.sslip.io` or `app-env.${PAAS_BASE_DOMAIN}` if configured.
- Service: `api/services/paas/DomainService.ts` for custom domain add/verify (TXT) + TLS provisioning.

### Phase 6 – Client PaaS API
- Route: `api/routes/paas.ts` (enforce org scoping)
  - Apps: create/list/get
  - Environments: create/update/delete (supports `deploy_mode=buildpack|image`)
  - Deployments: trigger/list/rollback (supports both git SHA and image ref)
  - Operations: logs (SSE), scale, restart
  - Domains: add/list/verify/delete
  - Addons: provision/list/delete/backup
  - Catalog: plans, locations
- Integrate `activityLogger` for `paas.*` events.

Detailed endpoints (PaaS):
- Apps
  - `POST /api/paas/apps` { name, planId, stackId? }
  - `GET /api/paas/apps`
  - `GET /api/paas/apps/:appId`
  - `DELETE /api/paas/apps/:appId`
- Environments
  - `POST /api/paas/apps/:appId/environments` { name, region, deploy_mode, limits, envVars, image_ref? }
  - `PATCH /api/paas/environments/:envId`
  - `DELETE /api/paas/environments/:envId`
- Deployments/Releases
  - `POST /api/paas/environments/:envId/deploy` { gitSha? image_ref? buildParams? }
  - `GET /api/paas/environments/:envId/deployments`
  - `POST /api/paas/environments/:envId/rollback/:deploymentId`
  - `GET /api/paas/environments/:envId/releases`
  - `POST /api/paas/environments/:envId/releases/:version/rollback`
- Processes (Heroku‑style formation)
  - `GET /api/paas/environments/:envId/processes`
  - `POST /api/paas/environments/:envId/processes` { type, command, instances }
  - `PATCH /api/paas/processes/:id` (scale/update)
  - `DELETE /api/paas/processes/:id`
- One‑off runs (dyno tasks)
  - `POST /api/paas/environments/:envId/runs` { command }
  - `GET /api/paas/runs/:runId/logs`
- Logs & Metrics
  - `GET /api/paas/environments/:envId/logs` (SSE)
  - `GET /api/paas/environments/:envId/metrics` (basic usage)
- Config Vars & Secrets
  - `GET /api/paas/environments/:envId/config`
  - `PATCH /api/paas/environments/:envId/config` (manages env vars; secrets via Swarm secrets API only)
- Domains
  - `POST /api/paas/environments/:envId/domains`
  - `GET /api/paas/environments/:envId/domains`
  - `DELETE /api/paas/domains/:domainId`
  - `POST /api/paas/domains/:domainId/verify`
- Addons
  - `POST /api/paas/environments/:envId/addons`
  - `GET /api/paas/environments/:envId/addons`
  - `DELETE /api/paas/addons/:addonId`
  - `POST /api/paas/addons/:addonId/backup`
- Catalog & Templates
  - `GET /api/paas/plans`
  - `GET /api/paas/locations`
  - `GET /api/paas/stacks`
  - `GET /api/paas/buildpacks`
  - `GET /api/paas/templates`

### CaaS (Aligned With Claude Plan)
- CaaS is implemented as image‑based environments inside the same Swarm orchestration and isolation model:
  - Use `paas_environments.deploy_mode = 'image'` with `image_ref`, `entrypoint`, `cmd`, `ports`, `volumes`, `healthcheck`.
  - Shares isolation controls (userns‑remap, per‑org overlay networks, secrets, quotas) and Traefik routing.
  - Manual Docker image deploy is a first‑class flow (Implementation Order step 4 in Claude plan).
- API alias for clarity (maps to PaaS handlers):
  - `POST /api/caas/containers` → create env with `deploy_mode=image`
  - `GET /api/caas/containers` → list image‑mode envs
  - `GET /api/caas/containers/:id` → env details
  - `POST /api/caas/containers/:id/deploy` → pull new tag and rolling update
  - `POST /api/caas/containers/:id/scale` | `:id/restart`
  - `GET /api/caas/containers/:id/logs` (SSE)
  - `POST /api/caas/domains[...]` | `POST /api/caas/volumes[...]`
- Optional future (not in initial scope): multi‑container compositions; keep single‑service per env initially to match Claude’s manual image deploy scope.
- Policy enforcement to prevent cross‑tenant visibility and Portainer‑style escalation:
  - No docker socket mounts, no hostPath mounts, cap‑drop ALL, `no-new-privileges`.
  - Org overlay network only; deny joining foreign networks.
  - Per‑org Swarm secrets only; never inject credentials as env values.

### Phase 7 – Managed Addons
- Service: `api/services/paas/AddonService.ts`
  - Provision Postgres/MySQL/Redis on dedicated nodes/networks; credentials as Swarm secrets.
- Automated backups to S3/MinIO; retention per plan.

### Phase 8 – Logging & Health
- Deploy Promtail on nodes, Loki for central logs.
- Service: `api/services/paas/LogService.ts` with org/app scoping; SSE endpoint for tail.
- Health checks: HTTP, Docker HEALTHCHECK; auto‑restart, alerting via existing `notificationService`.

### Phase 9 – Billing
- Service: `api/services/paas/BillingService.ts`
  - Hourly aggregation into `paas_usage` (cpu/mem/storage/bandwidth), per env/app/org.
  - Creates payment transactions/invoices similar to VPS.
- Hook scheduler in `api/server.ts` (coexists with VPS billing).

### Phase 10 – UI (Client & Admin)
- Client pages (`src/pages/paas/`):
  - `PaaSDashboard.tsx` (apps, usage, quick actions)
  - `NewApp.tsx` (repo/plan/region wizard)
  - `AppDetail.tsx` (envs, deployments, scale, logs, domains, addons)
- Admin pages (`src/pages/admin/`):
  - `PaaSNodes.tsx` (add/drain/remove, capacity/status)
  - `PaaSPlans.tsx`
  - `PaaSNodeDetail.tsx` (per Claude: resource graphs, running containers, logs)
  - `PaaSStacks.tsx` (builder images, enable/disable stacks)
  - `PaaSBuildpacks.tsx` (catalog, order per stack, enable/disable)
  - `PaaSTemplates.tsx` (manage templates catalog)
  - `PaaSBuilds.tsx` (build queue)
  - `PaaSPlatformMetrics.tsx` (platform usage)
- Wire routes in `src/App.tsx` and nav entries in `src/components/AppLayout.tsx`.

### Phase 11 – Autoscaling (Premium)
- Service: `api/services/paas/AutoscalingService.ts` with CPU/mem thresholds, cooldowns, plan‑gated min/max.

### Phase 12 – CaaS (Secure Container Projects)
- API under `/api/caas/*` backed by OrchestrationService with stricter policy, aligned to Claude’s “manual Docker image deploy” and multi‑tenant isolation:
  - Only approved or user‑supplied images by reference; enforce image policies and scanning (Trivy in build pipeline v1.1).
  - Named volumes only; size/quota with backups.
  - Per‑org overlay networks, secrets, and limits mirror PaaS isolation controls.
  - Domains and TLS via Traefik similar to PaaS.

## CaaS Deep Dive (Detailed Specification)

### Data Model (CaaS‑specific)
- `caas_image_policies` (organization_id, allowed_registries text[], allowed_patterns text[] (e.g., `registry/org-*`), blocked_patterns text[], require_digest boolean, require_signed boolean, created_at)
- `caas_registry_credentials` (organization_id, registry, username, secret_ref, created_by, created_at, updated_at)
- `caas_volume_snapshots` (volume_id, snapshot_id, storage_url, size_bytes, status, created_at, retained_until)
- `caas_network_policies` (organization_id, egress_allow list (CIDR/host), ingress_allow list (org‑internal/service), default_deny flags)
- `caas_exec_audit` (container_id/env_id, user_id, command, started_at, duration_ms, status)

Note: Runtime entities (containers, env, volumes) reuse `paas_environments` (image mode), `paas_containers`, and `paas_volumes` to keep orchestration unified.

### Orchestration & Scheduling
- Single service per CaaS environment (initial scope) using Swarm service with rolling updates.
- Placement constraints by region, node labels; anti‑affinity across nodes when replicas > 1.
- Healthchecks: support HTTP, TCP, or CMD; use Docker HEALTHCHECK for liveness/readiness.
- Restart policies: `on-failure`, `always`, `unless-stopped` with max attempts + delay configuration.

### Security Profiles
- Capabilities: `cap-drop=ALL`, optional minimal allowlist (e.g., `CHOWN`, `SETUID` if required by image) configurable via admin.
- `no-new-privileges=true`, `read_only` rootfs option; tmpfs for `/tmp` where needed.
- Seccomp: default docker profile or stricter profile; AppArmor profiles on supported hosts.
- User namespaces: enabled globally on workers via `userns-remap`; map per‑org UID/GID ranges.
- Deny privileged mode, host PID/IPC/NET namespaces, and any hostPath mounts.

### Networking & Ingress
- Per‑org overlay network; services attach only to their org network.
- Ingress via Traefik with per‑service routers; HTTP/HTTPS, WebSocket supported.
- Optional internal service discovery with org‑scoped DNS name (e.g., `svc-<id>.org.local`).
- Network policies: optional egress allowlist (admin‑configured); deny all external egress by default for restricted plans.

### Storage & Volumes
- Named volumes only; size/quota metadata tracked in `paas_volumes`.
- Encryption at rest (driver or application level); keys scoped per org.
- Snapshot/backup jobs to S3/MinIO recorded in `caas_volume_snapshots`; restore flow supported via new deployment.

### Registry & Image Scanning
- Image pulls require: allowed registry, allowed name pattern, optional digest requirement.
- Credentials resolved via `caas_registry_credentials` or per‑env secret.
- Optional image scanning (Trivy) on deploy; block deploy on critical CVEs (admin policy).

### Logs, Metrics, Events
- Logs streamed via Promtail→Loki; tails exposed over SSE/WS with org/app filters.
- Metrics via Docker stats API; aggregate to usage for billing; display on UI.
- Container events captured; surface create/update/scale/restart timeline on detail page.

### Console & Exec
- Web console (TTY) via WS proxy to Docker attach/exec; audit entries in `caas_exec_audit`.
- Optional read‑only shells for restricted roles; server‑side timeouts + idle disconnects.

### Domains & Ports
- Port mapping UI maps container ports to Traefik routers with TLS; supports HTTP, TCP where applicable.
- Default random subdomain on base or sslip.io; custom domains with TXT verification.

### Billing & Quotas
- Bill CPU‑hours, memory‑hours, storage GB‑mo, egress GB; include logs storage if applicable.
- Enforce plan quotas at create/update (CPU/mem limits, replica max, volume size, domain count, bandwidth cap).

### API (CaaS)
- Containers (alias to image‑mode envs):
  - `POST /api/caas/containers` { name, region, image_ref, entrypoint?, cmd?, env_vars, secrets, ports[], volumes[], healthcheck?, resources, restart_policy }
  - `GET /api/caas/containers`, `GET /api/caas/containers/:id`, `DELETE /api/caas/containers/:id`
  - `POST /api/caas/containers/:id/deploy` { image_ref }
  - `POST /api/caas/containers/:id/scale` { replicas }
  - `POST /api/caas/containers/:id/restart`
  - `GET /api/caas/containers/:id/logs` (SSE)
  - `GET /api/caas/containers/:id/metrics`
- Exec & Console:
  - `POST /api/caas/containers/:id/exec` { command, tty? } → returns sessionId; logs at `caas_exec_audit`
  - `GET /api/caas/containers/:id/console` (WS upgrade)
- Domains & Volumes:
  - `POST/GET/DELETE /api/caas/containers/:id/domains`
  - `POST /api/caas/volumes` { name, size_gb, encrypted?, backup_policy? } ; `GET/DELETE /api/caas/volumes/:id`
  - `POST /api/caas/volumes/:id/snapshots` ; `GET /api/caas/volumes/:id/snapshots`
- Policies & Registries (admin/org):
  - `GET/PUT /api/caas/policies/images` (org‑level allow/deny patterns, require_digest/signed)
  - `GET/POST/DELETE /api/caas/registries` (store creds as secrets)
  - `GET/PUT /api/caas/policies/network` (egress/ingress allowlists)

### Client UI (CaaS)
- Containers List: filters by status/region/image; quick actions (start/stop/restart/scale).
- New Container Wizard: image selection (with live validation vs policy), registry creds picker, command/entrypoint, ports→domains mapping, env/secrets editor, volumes (quota), healthchecks, resources, restart policy, review.
- Container Detail: overview (status, image digest, replicas, endpoints), logs tail, metrics charts, env/secrets editor, volumes with snapshot/restore, domains, health status, events, console/exec tab with audit note.

### Admin UI (CaaS)
- Policies: allowed registries/patterns, digest/signature requirements, default security profile, egress policy.
- Registry Credentials: org‑scoped creds management.
- Volume Snapshots: usage and retention overview.
- Node/Capacity: view CaaS load by region/node; drain/evict buttons integrated.

### Implementation Order (CaaS)
1) Schema additions (policies, registry creds, volume snapshots, exec audit).
2) Orchestration support: image validation + secure service deploy with constraints and labels.
3) Core endpoints: container CRUD, deploy, scale, restart; logs + metrics; domains.
4) UI skeleton: list, wizard, detail (overview/logs/metrics); policies (admin).
5) Console/exec WS channel with audit.
6) Volume snapshots + restore flows.
7) Network/egress policies & enforcement hooks.
8) Image scanning toggle and enforcement.

## API Surface (Initial)
Client (PaaS + CaaS):
- `POST /api/paas/apps`, `GET /api/paas/apps`, `GET /api/paas/apps/:id`
- `POST /api/paas/apps/:id/environments`, `PATCH /api/paas/environments/:id`, `DELETE /api/paas/environments/:id`
- `POST /api/paas/apps/:id/deploy`, `GET /api/paas/apps/:id/deployments`, `POST /api/paas/apps/:id/rollback/:depId`
- `GET /api/paas/apps/:id/logs` (SSE), `POST /api/paas/apps/:id/scale`, `POST /api/paas/apps/:id/restart`
- `POST/GET/DELETE /api/paas/domains[...]`, `POST /api/paas/domains/:id/verify`
- `POST/GET/DELETE /api/paas/addons[...]`, `POST /api/paas/addons/:id/backup`
- `GET /api/paas/plans`, `GET /api/paas/locations`

- CaaS aliases (map to PaaS image‑mode envs):
  - `POST /api/caas/containers`, `GET /api/caas/containers`, `GET /api/caas/containers/:id`
  - `POST /api/caas/containers/:id/deploy`, `POST /api/caas/containers/:id/scale`, `POST /api/caas/containers/:id/restart`
  - `GET /api/caas/containers/:id/logs`
  - `POST/GET/DELETE /api/caas/domains[...]`, `POST /api/caas/volumes[...]`

Admin:
- `POST/GET/GET/DELETE/POST /api/admin/paas/nodes[...]`
- `POST/PATCH/DELETE /api/admin/paas/plans[...]`
- `GET /api/admin/paas/apps`, `GET /api/admin/paas/metrics`, `GET /api/admin/paas/builds`
 - Stacks & Buildpacks:
   - `GET/POST/PATCH/DELETE /api/admin/paas/stacks[...]`
   - `GET/POST/PATCH/DELETE /api/admin/paas/buildpacks[...]`
   - `POST /api/admin/paas/stacks/:id/buildpacks/reorder`
 - Templates:
   - `GET/POST/PATCH/DELETE /api/admin/paas/templates[...]`

Webhooks:
- `POST /api/paas/webhooks/:secret`

## Infrastructure Services
- Traefik v2 (Swarm), private Docker registry, Redis (queue/cache), Loki + Promtail (logs), optional MinIO (object storage) if not using external S3.

## Security Controls
1) Container isolation (userns, caps drop, read‑only fs), 2) Network segmentation per org, 3) Swarm secrets only, 4) Image scanning with Trivy in build pipeline (v1.1), 5) Rate limiting build/deploy per org, 6) Audit logs for all PaaS/CaaS actions, 7) DNS/domain verification, 8) Per‑org SSH keys (when built‑in Git is added), 9) Encrypted volumes/backups.

## Billing Model
- Hourly charges based on plan quotas + measured usage (cpu/mem/storage/bandwidth) from `paas_usage`.
- Addon billing per tier; storage and egress tracked daily/hourly.
- Integrated with existing payment/invoice flow.

## Rollout & Feature Flags
- Feature gates via `platform_settings` and env to enable/disable PaaS, CaaS, Addons, Custom Domains, Autoscaling per environment.
- Safe defaults: start with webhook builds, default domains via sslip.io, no custom domains until Traefik/ACME verified.

## Open Decisions to Confirm
- Orchestrator: Proceed with Docker Swarm (as planned) vs Kubernetes?
- Registry: Use a single private registry with per‑org namespaces; any existing registry to reuse?
- Logging: Prefer Loki+Promtail vs Elasticsearch?
- Object storage: External S3/R2/Backblaze vs self‑host MinIO?
- Git: Start with GitHub/GitLab webhooks; add built‑in SSH Git later?
- Worker baseline OS: Ubuntu 22.04 acceptable?
- Custom domains: Start with ACME HTTP‑01; add DNS‑01 later for edge cases?
- CaaS scope: Initial “Container Projects” with strict policy acceptable?

## Next Steps
1) Implement Phase 1 migration (`migrations/003_paas_caas_schema.sql`).
2) Scaffold admin node routes and WorkerNodeService; generate join script.
3) Add OrchestrationService skeleton and secure mTLS connection to manager.
4) Add client routes for basic app/env CRUD; wire activity logs.
5) Prepare Traefik stack manifest and default labels; verify routing with default domains.

Once decisions above are confirmed, we’ll proceed to implement phases in order.

## Deliverables Checklist & Acceptance Criteria
- Migration 003 present: `migrations/003_paas_caas_schema.sql` with PaaS and CaaS tables, indexes, and triggers.
- Config ready: `.env.example` contains all PaaS/CaaS variables (Traefik, Swarm mTLS, Registry, CNB, Webhooks, Loki, S3, Policies).
- Admin API: nodes, plans, stacks, buildpacks, templates, builds, metrics routes scaffolded.
- Client API: PaaS (apps/envs/deployments/releases/processes/runs/config/domains/addons) and CaaS (containers/volumes/domains/snapshots/policies/registries) routes defined.
- Orchestration services: mTLS Docker client, network/secret enforcement, secure service creation.
- Build service: CNB webhook pipeline + registry push; logs streaming.
- UI scaffolding: routes/pages for PaaS and CaaS client; admin sections for nodes/plans/stacks/buildpacks/templates/builds/metrics.
- Security controls: enforced policies (no docker socket/host mounts; caps drop; userns; secrets only).

## Client UI Scope & Deliverables

### PaaS – Client UI
- Global PaaS Dashboard (`/paas`)
  - Org‑level summary: total apps, running containers, incidents.
  - Usage/billing summary: current month CPU/mem/storage/egress with cost estimate.
  - Quick actions: New App, View Nodes (admin only), Docs/CLI link.
- Apps List (`/paas/apps`)
  - Table: App, Environments, Region, Status, Last Deploy, Owner, Actions.
  - Filters: status, region, tag; search by name.
  - Actions: View, Deploy, Scale, Delete (with confirm modal).
- New App Wizard (`/paas/apps/new`)
  - Steps: Repo → Plan → Region → Name & Domain → Review.
  - Repo: Connect GitHub/GitLab (or paste repo URL + webhook secret); branch selection.
  - Plan: show quotas/prices; estimate hourly/monthly.
  - Region: pick from `paas_nodes` regions; placement hints.
  - Name/Domain: app/env slug, default domain preview (sslip.io or base domain), optional custom domain add later.
  - Create: creates app+env, stores webhook, queues first build if chosen.
- App Detail (`/paas/apps/:appId`)
  - Tabs:
    - Overview: current image, status, endpoints, instances, region, quick actions.
    - Deployments: history (git SHA, author, time, status), diff, rollback.
    - Logs: live tail via SSE/WebSocket; filters by env/container.
    - Metrics: CPU/mem/egress charts (interval selector) per env.
    - Env Vars & Secrets: key/value editor (masked secrets), import/export, version history.
    - Scaling & Processes: replicas slider (per process), CPU/mem limits; Procfile processes (web/worker), scale per process type; apply with rolling update.
    - Domains: default domain, add custom domain (TXT verify), status badges, cert status.
    - Addons: attach/detach Postgres/MySQL/Redis; credentials view (redacted), backups.
    - Health Checks: HTTP path, interval, timeout, threshold; test now; status history.
    - Releases: release history (version, image, processes), rollback; compare config.
    - Runs: one‑off commands with log viewer, status.
    - Activity: `paas.*` events for audit trail.
    - Settings: rename app, delete app (type‑to‑confirm), danger zone.
- Environments dropdown/switcher within tabs.

Note on CaaS alignment: In App Detail, creating an environment with `Deploy Mode: Image` exposes CaaS fields (`image_ref`, `entrypoint`, `cmd`, ports, volumes, healthcheck). This mirrors Claude’s “Manual Docker image deploy” within the same isolation/orchestration layer.
- Empty States & Onboarding
  - First‑run onboarding banner with link to New App and templates.
  - Templates catalog (Next.js, Django, Laravel, Spring) → one‑click prefilled wizard.

### CaaS – Client UI (Secure Container Projects)
- Containers List (`/caas/containers`)
  - Table: Name, Image, Status, Node/Region, CPU/Mem limits, Created, Actions.
  - Filters: status, region; search by name/image.
- New Container Wizard (`/caas/containers/new`)
  - Image: reference (e.g., `registry/org/app:tag`), credentials selector for private registry.
  - Command & Entrypoint; Working dir; Restart policy.
  - Ports: container → public; optional domain binding via Traefik rule (if permitted).
  - Env Vars & Secrets: key/value editor with masked secrets.
  - Volumes: named volumes only; size/quota where supported; backup policy.
  - Resources: CPU shares/limit, memory limit; labels; healthcheck config.
  - Networks: preselected org overlay; cannot join foreign networks.
  - Review & create; outputs service name and endpoint(s).
- Container Detail (`/caas/containers/:id`)
  - Overview: status, image, node, endpoints; restart/stop/start; redeploy with new tag.
  - Logs: live tail with filters.
  - Metrics: CPU/mem usage over time (basic v1).
  - Env Vars, Secrets, Volumes: edit with safe rollout.
  - Health: current/last probes; manual probe.
  - Activity: audit trail of actions.

Templates (per Claude suggestions): Provide curated presets (WordPress, Django, Next.js, Laravel) as quick‑starts that prefill image/deploy fields or use buildpack mode, with safe defaults and quotas applied.

### Admin UI Additions
- PaaS Nodes (`/admin/paas/nodes`)
  - List nodes with status, role, region, capacity; actions: add (shows generated script), drain, remove.
  - Node details: labels, versions, assigned workloads.
- PaaS Plans (`/admin/paas/plans`)
  - CRUD plans, resource quotas, autoscaling flag, pricing (hourly/monthly); publish/unpublish.
- Platform Metrics (`/admin/paas/metrics`)
  - Build queue length, deployment success rate, node capacity/pressure.
  - Optional: logs of build failures.

### Shared UI Components (to build under `src/components/paas/` and `src/components/caas/`)
- `ResourceSelector` (CPU/mem sliders with presets), `RegionSelector`, `PlanCard` grid.
- `EnvVarEditor` (with secret toggle), `SecretViewer` (masked reveal), `DomainCard`.
- `LogViewer` (virtualized list, auto‑scroll, pause, copy), `UsageChart` (area/line).
- `ConfirmDialog`, `DangerZone`, `InlineAlert`.

### Routing & Navigation
- Add routes in `src/App.tsx`:
  - `/paas`, `/paas/apps`, `/paas/apps/new`, `/paas/apps/:appId` (with nested tabs via query/segment)
  - `/caas/containers`, `/caas/containers/new`, `/caas/containers/:id`
- Update `src/components/AppLayout.tsx` navigation groups:
  - New group “PaaS”: Dashboard, Apps, (optional) Templates
  - New group “CaaS”: Containers
  - Admin group additions: PaaS Nodes, PaaS Plans, Stacks, Buildpacks, Templates, Builds, Platform Metrics

### Data Layer & Realtime
- Use React Query for data fetching/mutations with optimistic updates where safe.
- Log streaming via SSE endpoint; abstract with `useEventSource(url)` hook.
- Optional WebSocket channel for deployment/build status updates.
- Error states and retries with toasts.

### Permissions & Safety
- Guard admin routes with existing `AdminRoute`.
- Enforce org scoping in all fetchers; hide actions unavailable due to plan/role.
- Confirmations for destructive ops: delete app/env/container, detach addon, domain removal.
 - Role-based per-app access (viewer/deployer/admin) to be added post-MVP; app team invites separate from org membership.

### UX Polish (v1 targets)
- Breadcrumbs consistent with existing layout.
- Empty/loading/skeleton states for pages and tables.
- Copy/share buttons for endpoints, deploy command, webhook secret.
- Accessibility: keyboard nav, aria labels; mobile responsive cards.

### Implementation Order (UI)
1) Scaffolding routes and pages with placeholders and navigation.
2) Apps list + New App wizard (PaaS).
3) App Detail core tabs: Overview, Deployments/Releases, Logs, Scaling/Processes.
4) Domains + Env Vars & Secrets tabs.
5) Addons tab (attach/detach basic flows).
6) CaaS Containers list + New Container wizard + Detail (Overview/Logs).
7) Admin Nodes + Plans + Stacks + Buildpacks + Templates + Builds queue pages.
8) Metrics/Usage charts and billing widgets; Node Detail.
