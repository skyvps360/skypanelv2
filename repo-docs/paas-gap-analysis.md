# SkyPanelV2 PaaS Gap Analysis

_Updated: 2025-11-07_

This document summarizes the outstanding implementation work required to satisfy `.kiro/specs/paas-integration/requirements.md`, `.kiro/specs/paas-integration/design.md`, and `.kiro/specs/paas-integration/tasks.md`. It focuses on the highest-risk or fully missing capabilities that block production readiness.

> Legend  
> ✅ Complete or in good shape  
> ⚠️ Partially implemented—needs additional work  
> ⛔ Missing

## 1. Core Security & Networking

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Container privilege hardening | Requirement 14, Tasks §12 & §14 | ⚠️ | Buildpack-based deployments now run as non-root with dropped capabilities and per-app networks, but custom Docker images can still opt-out, and we have not enabled seccomp/apparmor profiles or filesystem sandboxing yet. |
| Resource limit enforcement | Requirement 14.2 | ⚠️ | CPU/mem values are passed to Docker, but storage I/O limits and cgroup monitoring are missing; there is no feedback loop to update capacity state on the control plane. |
| Network isolation, ingress TLS | Requirement 13 & 14.4 | ⚠️ | Automated Let’s Encrypt issuance now feeds nginx HTTPS configs and each app gets its own Docker network, but we still need multi-node routing, certificate rotation alerts, and east/west network policies. |

## 2. Node Health & Monitoring

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Heartbeat-driven alerts | Requirements 3-4, Tasks §3.3, §4.3 | ⚠️ | Heartbeats update metrics (`NodeService.heartbeat`), but there is no automated 90‑second offline detection surface, capacity alerts UI, or admin dashboards per §21. |
| Metrics visualization | Requirement 12.2, Task §20.3 | ⛔ | Metrics are stored in `paas_application_metrics`, but the UI only shows a placeholder area chart without live aggregation, time range filters, or request rate graphs. |
| Log streaming | Requirement 8, Task §8 | ⚠️ | Build and runtime logs now stream over SSE with history buffers, but we still need retention policies, filtering, and alert hooks for noisy streams. |

## 3. Deployment Workflow Gaps

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Env var redeploy enforcement | Requirement 10.3, Task §6.3 | ✅ | Environment updates are now flagged in the database, UI surfaces the warning, and redeployments clear the flag. |
| Buildpack presets & detection | Requirement 2.3, Task §2.2 | ⚠️ | Buildpack scaffolding exists, but runtime presets cannot be configured per plan/runtime (no admin UI for presets, no validation). |
| Multi-instance scaling | Requirement 17, Task §7 | ⚠️ | The agent spawns multiple containers on a single node; there is no multi-node placement, load balancing, or coordination, nor control-plane UX for scale events beyond manual count entry. |
| Plan upgrades/downgrades | Requirement 18, Task §18 | ⛔ | Endpoint simply updates `plan_id` without validating limits, adjusting billing rates, or handling downgrade constraints and customer confirmation flows. |

## 4. Database & Backup Management

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Database linking UX | Requirements 10-11, Task §20.2 | ⚠️ | Linking injects one `DATABASE_URL`; UI lacks multi-database management, discovery, or prefix customization. No automatic redeploy enforcement when links change. |
| Backup storage providers | Requirement 11, Task §10.4 & §19 | ⚠️ | Agents can now stream SQL dumps to local disk or S3, but we still need retention pruning, restore verification, and alternative providers (GCS/Azure). |
| Restore workflows | Requirement 11.4, Task §11.2 | ⚠️ | Control plane triggers restore tasks but lacks confirmation UI, progress reporting, or validation that restored instances get re-linked and redeployed. |

## 5. Billing, Usage, & Reporting

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Usage dashboards | Requirement 16, Task §20.1 | ⛔ | Customers cannot view per-app hourly costs, trends, or cumulative spend despite `PaasBillingService` capturing data. No API/UX for `paas_billing_records`. |
| Spending alerts UI | Requirement 16.4 | ⛔ | Backend allows thresholds (`paas_spending_alerts`), but there is no customer surface to configure/view alerts. |
| Wallet enforcement & suspension/resume UX | Requirement 15, Task §15.4 | ⚠️ | Billing service suspends resources on insufficient funds, yet the dashboard does not warn users or provide resume guidance. |

## 6. GitHub Integration Completeness

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Token refresh handling | Requirement 9.4 | ⚠️ | Tokens are refreshed on-demand when linking repos, toggling auto-deploy, and during deployments, but there is still no background watcher to rotate stale tokens or alert when user connections lapse. |
| Webhook lifecycle | Requirement 9.5 | ⛔ | No background job to register/delete repo webhooks automatically; spec requires auto-deploy webhooks per app. |
| Auto-deploy enforcement | Task §9.3 | ⚠️ | The toggle exists, but there’s no validation that branch filters or token scopes remain valid, nor UI feedback when webhooks fail. |

## 7. Agent Packaging & Operations

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Installer script & systemd | Requirement 3.2, Task §19 | ⛔ | `/agent/install.sh` only installs Docker/Node and hits the registration endpoint; it does not download agent builds, configure `config.json`, or set up `systemd` for auto-restart. |
| Versioned agent bundles | Task §19.3 | ⛔ | No packaging pipeline to publish `agent/dist` tarballs via `/agent/download` with version metadata or checksum verification. |
| Monitoring of agent health | Requirement 4, Task §5.2 | ⚠️ | The agent reconnects over WebSockets, but there’s no backoff configuration, telemetry, or alerting when nodes churn frequently. |

## 8. QA & Documentation

| Area | Spec References | Status | Notes |
| --- | --- | --- | --- |
| Automated tests | Task §22 | ⛔ | There are no Vitest/Jest suites for the new services, routers, or React components; no integration tests for deployment flows. |
| Security testing | Task §22.4 | ⛔ | No coverage for container isolation, auth, or encryption validations. |
| Admin/customer docs | Task §23 | ⛔ | `repo-docs/` lacks operator or customer guides for PaaS plans, node setup, deployments, backups, SSL, or troubleshooting. |
| Deployment guide | Task §23.3 | ⛔ | No documentation for control-plane configuration, agent installation, or TLS/domain prerequisites. |

---

### Next Steps

1. **Security & TLS Foundation**: Implement container hardening, dedicated Docker networks per tenant, automated Let’s Encrypt provisioning, and certificate distribution to ingress templates.  
2. **Observability & UX**: Build node dashboards, metrics APIs, log streaming, and customer-facing usage/billing reports.  
3. **Operational Maturity**: Finish env-var redeploy enforcement, database backup storage, plan upgrade validation, GitHub webhook management, agent packaging, and the required documentation/testing suite.

These deliverables map directly to the remaining unchecked boxes in `.kiro/specs/paas-integration/tasks.md` and the acceptance criteria highlighted above.
