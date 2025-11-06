# Repository Guidelines

## Project Structure & Module Organization

SkyPanelV2 pairs an Express/Node backend in `api/` (config, routes, services, middleware) with a React 18 frontend under `src/` (components, pages, hooks, React contexts). Shared assets sit in `public/`, migrations live in `migrations/`, infra aids sit in `docker/` and `.github/`, and higher-level references are kept in `repo-docs/`. Use `scripts/` for database/admin helpers and `api-docs/` for HTTP reference examples.

**Key directories:**

- `api/` - Express.js backend with config, routes, services, middleware, types
- `src/` - React frontend with components (including admin/), pages, contexts, hooks, lib, services, theme
- `migrations/` - Versioned SQL migrations (001_initial_schema.sql, 002_remove_legacy_container_artifacts.sql)
- `scripts/` - Node utilities for database operations, admin management, billing tests, SMTP validation
- `public/` - Static assets served by Vite
- `repo-docs/` - Feature documentation and API references
- `api-docs/` - HTTP API documentation and examples

## Build, Test & Development Commands

Run `npm run dev` for full-stack development (Vite + Nodemon concurrently) or `npm run client:dev` / `npm run server:dev` to work on one side. Use `npm run dev-up` to kill ports and start cleanly. `npm run build` performs TypeScript compilation plus Vite production bundle, while `npm run preview` hosts the built UI locally on port 5173. `npm run lint`, `npm run check`, and `npm run test` cover ESLint validation, TypeScript type-only checking, and Vitest suites; `npm run test:watch` keeps tests hot. Use `npm run kill-ports` before restarting servers that may hold ports 3001 or 5173.

**Production deployment:**

- `npm run start` - Backend only (Express server on port 3001); in production mode, serves built frontend from `dist/` at root path
- `npm run start:fullstack` - Dual-process mode (backend + Vite preview server on separate ports for development-like production testing)
- `npm run pm2:start` - PM2 process management for production with automatic restarts

**Database scripts:**

- `npm run db:reset` - Interactive database reset
- `npm run db:reset:confirm` - Non-interactive database reset
- `npm run db:fresh` - Reset and run all migrations
- `node scripts/run-migration.js` - Apply pending migrations
- `node scripts/test-connection.js` - Verify database connectivity

## Coding Style & Naming Conventions

Stick to 2-space indentation, ESM imports with explicit `.js` extensions in backend code, and TypeScript in both `api/` and `src/`. React files favor functional components, hooks, and shadcn/ui patterns; keep component filenames in `PascalCase.tsx`, hooks in `useSomething.ts`, and non-exported helpers in `camelCase`. Tailwind utility classes should remain ordered from layout->spacing->color. Run `npm run lint` before pushing; it enforces the shared ESLint + TypeScript config with relaxed rules (`@typescript-eslint/no-explicit-any: off`, unused vars as warnings).

**Critical ESM requirements:**

- Backend imports must use explicit `.js` extensions (e.g., `import { query } from './database.js'`)
- TypeScript compiles `.ts` to `.js` but runtime requires `.js` in import statements
- Missing `.js` extensions will cause runtime failures

**Component organization:**

- Pages: `src/pages/` (Dashboard.tsx, VPS.tsx, Admin.tsx, etc.)
- Admin components: `src/components/admin/` (modal-based CRUD interfaces)
- Shared UI: `src/components/ui/` (shadcn/ui components)
- Contexts: `src/contexts/` (AuthContext, ThemeContext, ImpersonationContext, BreadcrumbContext)
- Path alias: Use `@/*` for imports from `src/`

## Testing Guidelines

Vitest plus React Testing Library power UI tests (`*.test.tsx` in `__tests__/` directories), while service and HTTP layers prefer `*.spec.ts` alongside the modules they target. Favor high-value integration tests that hit Express routers with Supertest and fake provider responses. Keep coverage close to meaningful feature boundaries (provisioning, billing, auth, admin operations); add fixtures under `api/tests/fixtures` or colocated `__mocks__` directories when stubbing provider APIs.

**Test setup:**

- Vitest config: `vitest.config.ts` with jsdom environment and path alias support
- Test setup file: `src/test-setup.ts` for global test configuration
- Test utilities: `src/test-utils.tsx` for custom render functions
- Admin component tests: Comprehensive coverage in `src/components/admin/__tests__/` for modal components, form validation, API integration, error handling

**Running tests:**

- `npm run test` - Run all tests once
- `npm run test:watch` - Watch mode for TDD
- Tests use React Testing Library, userEvent for interactions, and MSW for API mocking

## Commit & Pull Request Guidelines

The history follows Conventional Commits (`feat(admin): ...`, `fix(billing): ...`, `chore(deps): ...`). Use scopes matching the touched module (`admin`, `billing`, `vps`, `auth`, `console`, `docs`). Each PR should link an issue, summarize risk, list manual/automated test output, and include UI screenshots or API examples when behavior changes. Rebase onto main before requesting review.

**Commit scopes:**

- `admin` - Admin panel features and organization management
- `billing` - Payment processing, invoices, wallet operations
- `vps` - VPS provisioning, management, SSH console
- `auth` - Authentication, authorization, user management
- `api` - Backend API endpoints and middleware
- `ui` - Frontend components and styling
- `docs` - Documentation updates
- `deps` - Dependency updates
- `test` - Test additions and fixes

## Security & Configuration Tips

Never commit `.env` or generated secrets; copy from `.env.example` and store provider/API tokens securely. Regenerate SSH material with `node scripts/generate-ssh-secret.js` when rotating keys (requires 32+ character secret). Run `node scripts/test-connection.js` or `node scripts/test-smtp.js` before deploying configuration changes. Keep rate-limit and JWT settings aligned with production defaults.

**Environment validation:**

- Config validation runs on startup via `validateConfig()` in `api/app.ts`
- Rate limiting configuration validated with `performStartupValidation()`
- Trust proxy setting must match deployment environment for proper IP detection
- Provider tokens encrypted with `SSH_CRED_SECRET` before database storage

**Admin utilities:**

- `node scripts/create-test-admin.js` - Create test admin account
- `node scripts/promote-to-admin.js --email user@example.com` - Promote user to admin
- `node scripts/update-admin-password.js --email admin@example.com --password newpass` - Reset admin password
- `node scripts/test-hourly-billing.js` - Dry-run billing workflow

