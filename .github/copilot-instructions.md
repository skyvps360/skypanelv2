# SkyPanelV2 Copilot Instructions

## Architecture & Entry Points
- **Backend:** Starts in `api/server.ts`; wraps Express app from `api/app.ts`, wires `initSSHBridge`, and schedules hourly `BillingService` and `ContainerBillingService`—preserve those hooks when touching server startup.
- **App Bootstrap:** `api/app.ts` loads `dotenv` first, validates config via `validateConfig()`, boots notification service, then mounts middleware (helmet, smart rate limiting, CORS) before `/api` routes; new routers register after middleware.
- **Frontend:** Bootstraps through `src/main.tsx` → `src/App.tsx`, where React Router, Auth/Theme/Impersonation providers, and shared `QueryClient` (staleTime 30s) live; wrap protected pages with `ProtectedRoute` or `AdminRoute` helpers.
- **Real-time:** SSE endpoint in `api/routes/notifications.ts` authenticates via `token` query param and relays `notificationService` events; clients use `EventSource` for live updates.

## Backend Conventions
- **ESM + TypeScript:** Runtime compilation via `tsx`; ESM imports must use explicit `.js` extensions (e.g., `./services/foo.js`) or they break.
- **Configuration:** Read via `config` proxy (`api/config/index.ts`) instead of `process.env` for hot-reload support and centralized validation.
- **Database:** Use helpers in `api/lib/database.ts` (`query`, `transaction`); transactions ensure atomic wallet/billing mutations. Activity logging via `logActivity` in `activityLogger.ts` triggers notifications automatically.
- **Provider Abstraction:** Multi-cloud VPS work goes through `ProviderFactory` (`api/services/providers/`); implementations extend `BaseProviderService` and implement `IProviderService` for normalized responses and error handling.
- **Authentication:** `authenticateToken` middleware decodes JWT, fetches user from DB, attaches `req.user` (includes `organizationId`); `requireOrganization` and `requireAdmin` middleware layer on top for authorization.
- **Rate Limiting:** `smartRateLimit` middleware differentiates anonymous/authenticated/admin users; custom limiters via `createCustomRateLimiter`; per-user overrides in `rate_limit_overrides` table.

## Frontend Patterns
- **API Client:** Networking through `src/lib/api.ts` centralizes `API_BASE_URL`, auth headers, PayPal helpers—extend rather than hand-rolling fetch logic.
- **Auth & State:** Global auth in `AuthContext.tsx` (JWT in `localStorage`); `ImpersonationContext` overlays admin impersonation; `ThemeContext` manages light/dark/system with white-label palette support.
- **Routing:** `App.tsx` defines routes with `ProtectedRoute` (requires auth), `AdminRoute` (requires admin role), and `PublicRoute` (redirects if authenticated); layout via `AppLayout` with breadcrumb context.
- **Styling:** Tailwind + shadcn components (`src/components/ui`); path alias `@/*` for imports; theming via CSS variables driven by `ThemeContext`.
- **Data Fetching:** TanStack Query for server state (default staleTime 30s, refetchOnWindowFocus true); `useQuery`/`useMutation` patterns; optimistic updates where appropriate.
- **Components:** Pages in `src/pages/`, reusable components in `src/components/`, admin-specific in `src/components/admin/`; container features in `src/pages/admin/Container*`.

## Database & Migrations
- **Schema:** Single consolidated migration `migrations/001_initial_schema.sql` includes all tables (users, organizations, wallets, vps_instances, support_tickets, activity_logs, container plans/subscriptions, etc.).
- **Running Migrations:** `node scripts/run-migration.js` applies pending; `npm run db:fresh` resets and migrates from scratch (development only).
- **Encryption:** Provider tokens and SSH keys encrypted with `SSH_CRED_SECRET` (32+ chars); generate via `node scripts/generate-ssh-secret.js`.
- **Activity & Notifications:** `activity_logs` table with PostgreSQL LISTEN/NOTIFY triggers; `notificationService` emits events consumed by SSE clients.

## Development Workflow
- **Concurrent Dev:** `npm run dev` launches Vite (`:5173`) + API (`:3001`); `npm run kill-ports` clears stray listeners.
- **Backend-only:** `npm run server:dev` (nodemon watches `api/`).
- **Frontend-only:** `npm run client:dev` (Vite HMR; mock API or run backend separately).
- **Quality Checks:** `npm run build` (tsc + Vite), `npm run lint` (ESLint), `npm run test` (Vitest); run before major refactors.
- **Database Scripts:** `scripts/` folder has utilities for reset (`db:reset`), migrations, admin creation (`create-test-admin.js`), billing tests, SMTP checks; see `scripts/README.md`.
- **Debugging:** Console logs show rate limit warnings, SSE auth issues, provider API errors; `api/routes/health.ts` exposes `/api/health/rate-limit` for monitoring.

## Security & Compliance
- **Error Shapes:** All API endpoints return `{ success: false, error }` on failures; global error handler in `api/app.ts` normalizes responses.
- **Helmet CSP:** Preserve `helmet` config in `api/app.ts`; update both backend and Vite dev settings if relaxing.
- **Trust Proxy:** `config.rateLimiting.trustProxy` must match deployment proxies or IP-based features (rate limiting, geolocation) will misbehave.
- **Provider Security:** Provider API tokens encrypted before DB storage; decryption helpers in `api/lib/crypto.ts`; validation via `validateProviderCredentials`.
- **Audit Logging:** Admin operations logged via `auditLogger` middleware; security headers via `adminSecurityHeaders`; request size limits (`requestSizeLimit`) on sensitive endpoints.

## Container Platform (Easypanel)
- **Integration:** Optional CaaS via Easypanel; config stored encrypted in `platform_settings`; services under `api/services/containerPlanService.ts`, `resourceQuotaService.ts`, `containerTemplateService.ts`.
- **Routes:** Container endpoints in `api/routes/containers.ts` with validation middleware from `api/middleware/containerValidation.ts`; admin routes require `requireAdmin`.
- **Billing:** Monthly subscription cycles managed by `ContainerBillingService`; processes due cycles hourly, deducts from wallets, handles suspensions.
- **Frontend:** User-facing pages in `src/pages/ContainerDashboard.tsx`, `ContainerPlansPage.tsx`, `ContainerTemplatesPage.tsx`, `ProjectDetail.tsx`, `ServiceDetail.tsx`; admin pages in `src/pages/admin/Container*`.

## Provider Architecture
- **Factory Pattern:** `ProviderFactory.createProvider(type, token)` returns `IProviderService` implementation (Linode or DigitalOcean).
- **Interface Contract:** `IProviderService` defines `createInstance`, `listInstances`, `performAction`, `getPlans`, `getImages`, `getRegions`, `validateCredentials`.
- **Error Normalization:** `errorNormalizer.ts` standardizes API errors; `getUserFriendlyMessage()` converts codes to readable messages.
- **Caching:** `ProviderResourceCache` (`api/services/providerResourceCache.ts`) caches plans/images/regions with TTL; invalidate on provider changes.
- **Documentation:** Provider-specific docs in `api/services/providers/` (ARCHITECTURE.md, API_DOCUMENTATION.md, DIGITALOCEAN_CONFIGURATION.md, CACHING.md).

## White-Label & Branding
- **Environment Variables:** `COMPANY_NAME`, `COMPANY_BRAND_NAME`, `VITE_COMPANY_NAME`, `COMPANY_LOGO_URL` control branding; `src/lib/brand.ts` exports resolved values.
- **Theme System:** Admin can configure themes via `/admin#theme-manager`; stored in `theme_presets` table; `themeService.ts` manages CRUD; CSS variables applied via `ThemeContext`.
- **Provider Hiding:** Mentions of "Linode", "DigitalOcean", "Dokploy" not exposed to clients; admins define labels via `/admin#providers` and `/admin#dokploy-config`.

## Common Pitfalls
- **Missing .js Extensions:** ESM requires explicit `.js` in imports; TypeScript will compile without them but runtime will fail.
- **Forgot Organization Context:** Many endpoints require `organizationId`; use `requireOrganization` middleware and check `req.user.organizationId`.
- **Encryption Key Not Set:** `SSH_CRED_SECRET` must be 32+ chars; generate via script or provider token decryption will fail.
- **Stale Rate Limit State:** Redis-backed; clear with `redis-cli FLUSHDB` or restart Redis if limits seem stuck.
- **Notification Not Appearing:** Ensure `activity_logs` insert succeeds and `notificationService.emit()` called; check SSE connection in browser devtools.

## Testing & Quality
- **Vitest:** Tests in `__tests__/` directories; `npm run test:watch` for TDD; mock `database.ts` and `auth.ts` in route tests.
- **Supertest:** API route testing via `supertest` (see `api/routes/__tests__/` for examples).
- **Type Safety:** `tsc --noEmit` (`npm run check`) catches type errors; fix before pushing.
- **Linting:** ESLint config in `eslint.config.js`; auto-fix with `npm run lint -- --fix`.
