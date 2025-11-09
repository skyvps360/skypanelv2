 SkyPanelV2 PaaS + CaaS Complete Implementation Plan

 Overview

 Full-featured PaaS (Heroku-like) + CaaS (Secure Containers) platform integrated into SkyPanelV2 with:
 - ✅ Buildpack deployments, custom domains, managed addons, auto-scaling
 - ✅ Multi-tier CaaS isolation (standard/enhanced/dedicated)
 - ✅ Complete client & admin UI workflows
 - ✅ Seamless integration with existing billing, auth, and activity logging
 - ✅ Both PaaS & CaaS implemented simultaneously

 ---
 Phase 1: Database Foundation (Migration 003)

 Create: migrations/003_paas_caas_schema.sql

 Tables to implement:
 1. PaaS Core: paas_nodes, paas_plans, paas_apps, paas_environments, paas_deployments, paas_containers
 2. Buildpack System: paas_stacks, paas_buildpacks, paas_stack_buildpacks, paas_templates, paas_releases, paas_processes, paas_runs
 3. Networking: paas_domains, paas_webhooks
 4. Addons: paas_addon_plans, paas_addons
 5. Storage: paas_volumes, caas_volume_snapshots
 6. CaaS Security: caas_image_policies, caas_registry_credentials, caas_network_policies, caas_exec_audit, caas_isolation_tiers
 7. Billing: paas_usage, paas_autoscaling_rules

 All tables include organization_id, proper indexes, and updated_at triggers.

 ---
 Phase 2: Backend Services Layer

 Directory: api/services/paas/

 Core Services:
 1. OrchestrationService.ts - Docker Swarm management with multi-tier isolation
 2. BuildService.ts - CNB buildpack pipeline with webhook integration
 3. DomainService.ts - Traefik routing + Let's Encrypt automation
 4. AddonService.ts - Managed PostgreSQL/MySQL/Redis provisioning
 5. SecretService.ts - Swarm secrets management per org
 6. BillingService.ts - Usage tracking & hourly billing integration
 7. AutoscalingService.ts - CPU/memory-based container scaling
 8. LogService.ts - Loki integration for log streaming
 9. WorkerNodeService.ts - Node registration & script generation
 10. CaaSPolicyService.ts - Image/network policy enforcement

 Directory: api/config/
 - paas.ts - Environment config validation & typed exports

 ---
 Phase 3: API Routes

 Client Routes:
 - api/routes/paas.ts - Apps, envs, deployments, releases, processes, runs, domains, addons, config
 - api/routes/caas.ts - Containers, volumes, exec, policies, registry creds

 Admin Routes:
 - api/routes/admin/paas.ts - Nodes, plans, stacks, buildpacks, templates, builds, metrics
 - api/routes/admin/caas.ts - Isolation tiers, global policies, registry management

 Webhook:
 - api/routes/webhooks.ts - GitHub/GitLab webhook handler

 ---
 Phase 4: Client UI (Complete Workflows)

 PaaS Pages (src/pages/paas/):
 1. Dashboard.tsx - Org usage, apps overview, quick actions
 2. Apps.tsx - Apps list with filters, search, status indicators
 3. NewAppWizard.tsx - 5-step wizard (Template → Repo → Plan → Region → Review)
 4. AppDetail.tsx - Tabbed interface:
   - Overview (status, endpoints, quick actions)
   - Deployments & Releases (history, rollback)
   - Logs (live streaming with filters)
   - Metrics (CPU/mem/bandwidth charts)
   - Processes (web/worker scaling, Procfile management)
   - Env Vars & Secrets (masked editor)
   - Domains (default + custom with TXT verification)
   - Addons (attach DB/Redis, credentials, backups)
   - Auto-scaling (rules, thresholds, history)
   - Activity (audit log)
   - Settings (rename, danger zone)

 CaaS Pages (src/pages/caas/):
 1. Containers.tsx - Container list with status, resources, actions
 2. NewContainerWizard.tsx - Image selection, resources, networking, volumes, security tier
 3. ContainerDetail.tsx - Tabbed interface:
   - Overview (status, endpoints, replica count)
   - Logs (live streaming)
   - Metrics (resource usage)
   - Env & Secrets (editor)
   - Volumes & Snapshots (backup/restore)
   - Domains (custom domain mapping)
   - Console (web-based exec with audit)
   - Security (isolation tier, policies)
   - Activity (audit log)

 ---
 Phase 5: Admin UI (Complete Management)

 Admin Pages (src/pages/admin/):
 1. PaaSNodes.tsx - Add node (script generator), list, capacity, drain/remove
 2. PaaSNodeDetail.tsx - Resource graphs, containers, health, logs
 3. PaaSPlans.tsx - CRUD plans with quotas, pricing, auto-scaling flag
 4. PaaSStacks.tsx - CNB builder management (heroku-22, etc.)
 5. PaaSBuildpacks.tsx - Buildpack catalog, ordering, enable/disable
 6. PaaSTemplates.tsx - Quick-start templates (Next.js, Django, Laravel, etc.)
 7. PaaSBuilds.tsx - Build queue, logs, success rate
 8. PaaSMetrics.tsx - Platform usage, revenue, node capacity
 9. CaaSIsolationTiers.tsx - Manage tiers (standard/enhanced/dedicated)
 10. CaaSPolicies.tsx - Global image/network policies, registry allowlists

 ---
 Phase 6: Integration Points

 Billing Integration:
 - Extend api/services/billingService.ts to include PaaS/CaaS usage
 - Hourly job for CPU/mem/storage/egress metering
 - Wallet deduction with low-balance alerts
 - Invoice generation for org admins

 Activity Logging:
 - Extend api/services/activityLogger.ts with PaaS/CaaS events
 - Real-time notifications for deployments, scaling, failures
 - Exec audit trail for CaaS console access

 Navigation:
 - Update src/components/AppLayout.tsx:
   - Add PaaS menu group (Dashboard, Apps, Templates)
   - Add CaaS menu group (Containers)
   - Admin additions (Nodes, Plans, Stacks, Buildpacks, Builds, Policies)
 - Command palette integration for quick PaaS/CaaS actions

 Routing:
 - Update src/App.tsx with protected routes for all PaaS/CaaS pages
 - Role-based access (admin-only routes, org member access)

 ---
 Phase 7: Infrastructure Setup

 Services to Deploy:
 1. Docker Swarm (manager + workers with mTLS)
 2. Traefik v2 (ingress, ACME, routing)
 3. Private Docker Registry (per-org namespaces)
 4. Redis (build queue + caching)
 5. Loki + Promtail (log aggregation)
 6. MinIO or S3 (backups, build cache)

 Worker Node Security:
 - User namespace remapping (per-org UID/GID ranges)
 - Cap-drop ALL, no-new-privileges
 - Seccomp/AppArmor profiles
 - No host mounts, no docker socket access
 - Encrypted volumes with per-org keys

 ---
 Phase 8: Features Implementation Order

 MVP (Weeks 1-3)

 1. Migration 003 + config setup
 2. Orchestration layer (OrchestrationService + mTLS)
 3. Basic PaaS: App/env CRUD, manual image deploy
 4. Client UI: Apps list, detail (overview/logs)
 5. Admin UI: Nodes, plans management

 Core PaaS (Weeks 4-6)

 6. BuildService + CNB pipeline
 7. Webhook integration (GitHub/GitLab)
 8. Releases + Procfile parsing
 9. Default domains (sslip.io)
 10. Client UI: Deployment history, rollback, processes

 Networking & Addons (Weeks 7-8)

 11. DomainService + Let's Encrypt
 12. AddonService (PostgreSQL, MySQL, Redis)
 13. Client UI: Domain management, addon attachment
 14. Admin UI: Templates, buildpacks catalog

 CaaS (Weeks 9-10)

 15. CaaS policy enforcement (image/network)
 16. Registry credentials management
 17. Exec/console with audit trail
 18. Client UI: Container wizard, detail, console
 19. Admin UI: Isolation tiers, policies

 Billing & Auto-scaling (Weeks 11-12)

 20. Usage metering + billing integration
 21. AutoscalingService implementation
 22. Client UI: Metrics, auto-scaling rules
 23. Admin UI: Platform metrics, revenue dashboard

 ---
 Critical Implementation Notes

 Multi-Tier CaaS Isolation:
 - Standard (shared nodes): Per-org networks + userns
 - Enhanced: Standard + image scanning + exec audit + egress policies
 - Dedicated: Exclusive worker nodes per org
 - Plans reference caas_isolation_tiers table

 Complete UI Workflows:
 - Every action has confirmation modals for destructive ops
 - Real-time status updates via SSE/WebSockets
 - Empty states with onboarding guides
 - Mobile-responsive design
 - Accessibility (ARIA, keyboard nav)

 Architecture Alignment:
 - Reuse existing middleware (auth.ts, rate limiting)
 - Follow current API response format conventions
 - Use existing UI components (shadcn/ui)
 - Extend billing service pattern (hourly cycles)
 - Activity logger integration for all PaaS/CaaS events

 Feature Completeness:
 - All buildpack features (auto-detect, multi-stack)
 - Custom domains with TXT verification + auto-TLS
 - Managed addons with backup/restore
 - Auto-scaling with cooldown + thresholds
 - One-off runs (Heroku-style dyno tasks)
 - Release management with rollback
 - Process scaling (web/worker separation)

 ---
 Deliverables Checklist

 - Migration 003 with all 20+ tables
 - 10 backend services in api/services/paas/
 - Client API routes (40+ endpoints)
 - Admin API routes (30+ endpoints)
 - 8 client PaaS pages with full workflows
 - 3 client CaaS pages with console
 - 10 admin management pages
 - Billing integration with usage tracking
 - Activity logging for all operations
 - Navigation + routing updates
 - Infrastructure deployment scripts
 - Documentation (setup, API, user guides)

 This plan addresses all missing features, ensures proper SkyPanelV2 integration, and provides complete client/admin UI workflows for both PaaS and CaaS.