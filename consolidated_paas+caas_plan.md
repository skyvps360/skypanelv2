# SkyPanelV2 PaaS + CaaS Consolidated Plan

This document merges the user-approved Claude plan (`paas-and-caas-addition.md`) with the repository-aligned plan (`paas+caas.md`) and validates every requirement against the existing SkyPanelV2 codebase (Node/TS Express API under `api/`, PostgreSQL migrations in `migrations/`, and React/Vite frontend under `src/`). All implementation notes reference actual directories/services to ensure immediate applicability.

## 1. Codebase Alignment Summary
- **Backend stack**: Express + TypeScript (`api/app.ts`, `api/routes/*`, `api/services/*`). PaaS/CaaS logic plugs into this structure via new route modules (`api/routes/paas.ts`, `api/routes/caas.ts`, `api/routes/admin/paas.ts`) and service classes under `api/services/paas/`.
- **Database**: PostgreSQL via `api/lib/database.ts`; migrations reside in `migrations/`. Migration `003_paas_caas_schema.sql` (added) introduces all PaaS/CaaS tables.
- **Auth & org context**: `api/middleware/auth.ts` provides JWT auth + org resolution; reused for multi-tenant isolation.
- **Billing**: `api/services/billingService.ts` currently handles VPS billing. PaaS billing extends this pattern with `PaaSBillingService` and scheduler hook in `api/server.ts`.
- **Frontend**: React/Vite (`src/App.tsx`, `src/components/AppLayout.tsx`). New PaaS/CaaS pages live under `src/pages/paas/` and `src/pages/caas/`, with admin pages under `src/pages/admin/`.
- **Environment**: `.env.example` updated with all new secrets (Traefik, Swarm mTLS, registry, CNB defaults, logging, S3, CaaS policies). `api/config/paas.ts` will read/validate them.

## 2. Architecture Overview
- **PaaS**: Heroku-like buildpack platform using Docker Swarm, CNB buildpacks (“stacks”), releases, processes (web/worker), managed addons, custom domains, build webhooks, hourly billing, real-time logs.
- **CaaS**: Secure container projects for user-supplied images (single service per environment). Shares orchestration layer but enforces stricter policies (image allowlists, digest/signature requirements, network/egress controls, exec auditing).
- **Isolation**: User namespaces (`userns-remap`), per-org overlay networks, per-org secrets, cap-drop ALL, no host mounts, Traefik routing per org/app, optional dedicated node pools.
- **Supporting services**: Traefik (ingress+ACME), private registry, Redis (queues/cache), Loki/Promtail (logs), optional Prometheus/Grafana, S3/MinIO for backups.

## 3. Database Schema (Migration `003_paas_caas_schema.sql`)
- **PaaS tables**: `paas_stacks`, `paas_buildpacks`, `paas_stack_buildpacks`, `paas_nodes`, `paas_plans`, `paas_apps`, `paas_environments` (with buildpack/image fields), `paas_deployments`, `paas_containers`, `paas_domains`, `paas_volumes`, `paas_addon_plans`, `paas_addons`, `paas_webhooks`, `paas_usage`, `paas_templates`, `paas_releases`, `paas_processes`, `paas_runs`.
- **CaaS tables** (same migration): `caas_image_policies`, `caas_registry_credentials`, `caas_volume_snapshots`, `caas_network_policies`, `caas_exec_audit`.
- All tables include appropriate indexes and updated_at triggers using the existing `update_updated_at_column()` helper from migration 001.

## 4. Configuration & Secrets (`.env.example` alignment)
- Feature toggles: `PAAS_ENABLED`, `CAAS_ENABLED`.
- Traefik/TLS: `PAAS_BASE_DOMAIN`, `TRAEFIK_ACME_EMAIL`, optional `TRAEFIK_ACME_CA_SERVER`.
- Swarm manager API (mTLS): `DOCKER_MANAGER_HOST/PORT`, either `DOCKER_TLS_*_FILE` paths or `DOCKER_TLS_*_B64` contents.
- Registry: `PRIVATE_REGISTRY_URL`, `REGISTRY_USERNAME/PASSWORD` (or `REGISTRY_AUTH_TOKEN`).
- CNB defaults: `DEFAULT_CNB_BUILDER_IMAGE`, `DEFAULT_CNB_RUN_IMAGE`.
- Webhooks: `GITHUB_WEBHOOK_SECRET`, `GITLAB_WEBHOOK_SECRET`.
- Logging/Metrics: `LOKI_URL`, optional `PROMETHEUS_URL`.
- Object storage: `OBJECT_STORAGE_PROVIDER`, `S3_ENDPOINT/REGION/ACCESS_KEY/SECRET/B UCKET`.
- CaaS defaults: `CAAS_REQUIRE_IMAGE_DIGEST`, `CAAS_ALLOWED_REGISTRIES`, `CAAS_BLOCKED_PATTERNS`, `CAAS_EGRESS_DEFAULT_DENY`.

## 5. Backend Components & Services
1. **Config loader** (`api/config/paas.ts`): Validates env vars, provides typed config consumed across services.
2. **WorkerNodeService**: Generates installer/join scripts, tracks Swarm nodes (`paas_nodes`), handles drain/remove actions.
3. **OrchestrationService**: Wraps `dockerode` (mTLS) to create/update Swarm services with per-org networks, secrets, quotas, placement constraints, isolation flags.
4. **SecretService**: Manages Swarm secrets/configs per org/env; ensures secrets never exposed as plaintext env vars.
5. **BuildService**: Handles CNB builds (webhooks, build queue via `bull` + Redis, pack CLI execution, push to registry, release creation, log streaming).
6. **DomainService**: Manages Traefik labels, ACME/LetsEncrypt issuance, DNS verification.
7. **AddonService**: Provisions managed DB/cache services on dedicated nodes, handles backup schedules, stores connection data as secrets.
8. **LogService**: Streams container logs from Loki over SSE; query interfaces for UI.
9. **BillingService (PaaS)**: Aggregates `paas_usage` hourly, integrates with existing billing/invoice logic.
10. **Addon/CaaS policies**: Services for image policy enforcement, registry credentials, network/egress enforcement, exec auditing.

## 6. API Surface (Express Routes)
- **Client PaaS (`api/routes/paas.ts`)**
  - Apps CRUD, environments CRUD (buildpack/image), deployments, releases, processes, one-off runs, logs, metrics, config vars, domains, addons, plans/locations/stacks/buildpacks/templates catalog.
- **Client CaaS (`api/routes/caas.ts`)**
  - Container CRUD (image mode envs), deploy new tag, scale, restart, logs, metrics, exec/console, domains, volumes, snapshots, registry creds, policies.
- **Admin (`api/routes/admin/paas.ts`)**
  - Nodes (add/list/detail/drain/delete), plans CRUD, stacks CRUD + buildpack ordering, buildpacks CRUD, templates CRUD, build queue, platform metrics, global policies (image/network), addon plan management.
- **Webhook endpoint**: `POST /api/paas/webhooks/:secret` for GitHub/GitLab triggers.
- All routes protected with existing auth middleware; admin routes use `requireAdmin`.

## 7. Frontend (React/Vite)
- **Routing (`src/App.tsx`)**: Add protected routes for `/paas`, `/paas/apps`, `/paas/apps/new`, `/paas/apps/:appId/*`, `/caas/containers`, `/caas/containers/new`, `/caas/containers/:id`, plus admin routes for PaaS Nodes/Plans/Stacks/Buildpacks/Templates/Builds/Metrics.
- **Navigation (`src/components/AppLayout.tsx`)**: Add sidebar groups for PaaS (Dashboard, Apps, Templates) and CaaS (Containers); admin group entries for each management page.
- **Client PaaS pages** (`src/pages/paas/`):
  - `PaaSDashboard`, `PaaSApps`, `PaaSNewAppWizard`, `PaaSAppDetail` (tabs: Overview, Deployments/Releases, Logs, Metrics, Env Vars/Secrets, Processes/Scaling, Domains, Addons, Health, Runs, Activity, Settings).
- **Client CaaS pages** (`src/pages/caas/`):
  - `CaaSContainers`, `CaaSNewContainer`, `CaaSContainerDetail` (Overview, Logs, Metrics, Env/Secrets, Volumes & Snapshots, Domains, Console/Exec, Activity).
- **Admin pages** (`src/pages/admin/`):
  - `PaaSNodes`, `PaaSNodeDetail`, `PaaSPlans`, `PaaSStacks`, `PaaSBuildpacks`, `PaaSTemplates`, `PaaSBuildsQueue`, `PaaSPlatformMetrics`, `CaaSPolicies`.
- **Shared components** (`src/components/paas/`, `src/components/caas/`): Resource selectors, env/secret editors, domain cards, log viewers, charts.

## 8. CaaS Deep Dive (Consolidated Requirements)
- **Policies & Enforcement**: `caas_image_policies` for allow/deny registries/patterns, digest/signature requirements; `caas_network_policies` for egress/ingress allowlists; enforced before deploy.
- **Registry Credentials**: `caas_registry_credentials` references secrets for private registries; per-org UI/API to manage them.
- **Exec Audit**: `caas_exec_audit` logs every interactive exec/console session with duration and status.
- **Volumes & Snapshots**: `paas_volumes` + `caas_volume_snapshots` support backups/restores to S3/MinIO.
- **Security Baseline**: Cap-drop ALL, no privileged, no host mounts, `no-new-privileges`, seccomp/AppArmor, read-only rootfs (with tmpfs exceptions), userns-remap per org.
- **Networking**: Per-org overlay networks; Traefik routers for HTTP/TCP; optional internal hostnames; optional default egress deny per plan.
- **Console & Logs**: WebSocket console with auditing; logs/metrics via Loki + Docker stats.

## 9. Infrastructure & Setup (Summary)
- Steps mirrored in `docs/paas-caas-setup.md`:
  1. Install Docker + enable user namespaces.
  2. Initialize Swarm & join workers.
  3. Secure Docker API with mTLS.
  4. Deploy Traefik stack (overlay network, ACME).
  5. Configure private registry (self-hosted or external).
  6. Deploy Promtail/Loki and ensure Redis availability.
  7. Populate `.env` with new vars; run API + migrations.
  8. Add nodes through Admin UI; deploy first PaaS app and CaaS container.

## 10. Security & Isolation Checklist
- Userns-remap enabled on every node; unique UID/GID ranges per org.
- Docker services created with `cap-drop=ALL`, `no-new-privileges=true`, seccomp defaults, no `/var/run/docker.sock` mounts, no hostPath volumes.
- Secrets handled via Swarm secrets; config values never stored as plaintext env vars.
- Network isolation: per-org overlay networks; optional network policies for egress.
- Image policies enforced (allowlist/digest); optional Trivy scanning before deployment.
- Audit logging: Activity logger records all PaaS/CaaS actions; exec sessions logged in `caas_exec_audit`.

## 11. Billing & Usage
- `PaaSBillingService` aggregates `paas_usage` (CPU ms, memory MB-seconds, storage GB-hours, egress bytes) hourly.
- Integrates with existing billing service to create transactions/invoices; addons and storage snapshots billed per plan.
- Scheduler hook added to `api/server.ts` alongside VPS billing.

## 12. Implementation Order
1. Apply migration `migrations/003_paas_caas_schema.sql`.
2. Implement config loader + env validation.
3. Scaffold admin routes/services (nodes, plans, stacks, buildpacks, templates, policies).
4. Implement orchestration + secret services with Swarm mTLS client.
5. Build CNB pipeline + registry push; webhook endpoint.
6. Add client APIs for apps/envs/deployments/releases/processes/runs/config/domains/addons.
7. Implement CaaS APIs (containers, volumes, domains, policies, exec audit).
8. Hook billing + usage aggregation.
9. Build React UI (PaaS pages → CaaS pages → admin consoles → metrics) following the order in the plan.
10. Harden security controls (policies, image scanning, exec audit) and add optional premium features (autoscaling, advanced monitoring).

## 13. Deliverables Checklist
- [x] Migration 003 file with PaaS + CaaS schema.
- [x] `.env.example` with all required PaaS/CaaS settings.
- [ ] Backend services/routes implemented per sections 5–7.
- [ ] Frontend pages/routes per section 7.
- [ ] Documentation (`docs/paas-caas-setup.md`) for setup (already added).
- [ ] Automated tests for core services (build orchestration, policy enforcement, billing).

This consolidated plan supersedes the individual `paas-and-caas-addition.md` and `paas+caas.md` documents while retaining every requirement from both and ensuring direct alignment with the current SkyPanelV2 codebase.

