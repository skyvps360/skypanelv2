# Repository Guidelines

## Project Structure & Module Organization
SkyPanelV2 splits a Vite/React client (`src/`) and an Express + Bull backend (`api/`). UI atoms sit in `src/components`, hooks in `src/hooks`, routing screens in `src/pages`, and domain helpers in `src/lib` and `src/services`. Styling lives in `src/index.css`, `src/theme`, and Tailwind config files. API code mirrors the client structure with `api/routes`, `api/services`, `api/lib`, and middleware in `api/middleware`. Background queues reside in `api/worker`. Database and maintenance helpers live in `migrations/` and `scripts/`, deploy scaffolding in `docker/`, static artifacts in `public/`, and generated bundles in `dist/` with supporting docs under `repo-docs/`.

## Build, Test & Development Commands
- Local dev: `npm run dev-up` frees ports 5173/3001, `npm run dev` starts client+API, and `npm run dev:all` adds the worker. Use `npm run client:dev` or `npm run server:dev` for focused debugging.
- Background jobs: `npm run dev:worker` hot-reloads queue processors; `npm run worker` runs the worker in production mode.
- Quality gates: `npm run lint` (ESLint + TS rules), `npm run check` (type-only), `npm test` (Vitest CI run), `npm run test:watch` (interactive), and `npm run preview` (serves the built client for QA).
- Build & deploy: `npm run build` (`tsc -b` + Vite build), `npm run start` (API via `tsx` + `vite preview`), and the PM2 helpers (`npm run pm2:start`, `pm2:reload`, `pm2:stop`, `pm2:list`) for multi-process orchestration.
- Database/bootstrap: `npm run seed:admin` creates a local admin, `npm run db:reset`/`db:reset:confirm` wipe state, `npm run db:fresh` resets and migrates, `npm run paas:init` provisions local PaaS nodes, and `npm run kill-ports` clears straggler processes.

## Coding Style & Naming Conventions
TypeScript everywhere with ES module imports that leverage the `tsconfig` paths. Default to 2-space indentation, PascalCase components, camelCase hooks/utilities, and kebab-case filenames for routes and scripts. Keep Tailwind class order readable (layout → spacing → color) and push shared tokens into `src/theme`. Run `npm run lint` before every PR; do not bypass ESLint or Prettier settings baked into Vite and the project configs.

## Testing Guidelines
Vitest powers both client and API suites. Co-locate specs as `*.test.ts`/`*.test.tsx` (see `src/lib/vpsStepConfiguration.test.ts` and `api/routes/admin/paas.overview.test.ts`). Use `src/test-utils.tsx` for provider wrappers and `src/test-setup.ts` for global mocks. Write high-signal tests around API contracts, queue jobs, and React state machines; mock external providers and Redis. Maintain descriptive test names mirroring the feature flag or route they cover.

## Commit & Pull Request Guidelines
Follow the existing conventional-commit format (`feat(paas): ...`, `fix(api): ...`). Keep scopes aligned with directories or domains, limit subjects to 72 chars, and squash only when preserving context. Every PR should include: summary + motivation, linked ticket, screenshots or JSON payloads for UI/API changes, and confirmation that `npm run lint`, `npm run check`, and `npm test` pass. Avoid bundling unrelated migrations, scripts, or UI tweaks together unless the change would break without them.

## Environment & Security Tips
Never commit `.env*` files—sample keys live in the README and `repo-docs`. Use `scripts/seed-admin.js` for safe local logins and `scripts/reset-database.js` helpers instead of manual SQL. When adding providers or env vars, update `repo-docs/` and `docker/` templates plus `ecosystem.config.cjs`. Run `npm run kill-ports` before switching branches to prevent orphaned servers, and prefer `pm2` scripts for long-running staging nodes so logs stay centralized.
