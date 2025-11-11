# Repository Guidelines

## Project Structure & Module Organization
- Frontend: `src/` (React 18, Vite, TypeScript). Key areas: `src/components/`, `src/pages/`, `src/lib/`, `src/services/`, `src/hooks/`, `src/types/`. Static assets in `public/`.
- Backend: `api/` (Express + TS). Key areas: `api/routes/`, `api/services/`, `api/middleware/`, `api/config/`, `api/lib/`.
- Database & Ops: `migrations/` for SQL, `scripts/` for migrations, admin utilities, billing tests, SMTP checks.
- Config: `.env` / `.env.example`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.json`.

## Build, Test, and Development Commands
- Dev: `npm run dev` (Vite UI + Nodemon API). Individually: `npm run client:dev`, `npm run server:dev`.
- Build: `npm run build` (tsc project build + Vite bundle). Preview: `npm run preview`.
- Start (prod): `npm run start` or `npm run pm2:start` (build + PM2). Kill busy ports: `npm run kill-ports`.
- Quality: `npm run lint` (ESLint), `npm run check` (TypeScript).
- Tests: `npm run test` (Vitest) or `npm run test:watch`.
- Database: `node scripts/run-migration.js`, `npm run db:fresh`, `node scripts/seed-admin.js`.

## Coding Style & Naming Conventions
- TypeScript (ESM). Indentation: 2 spaces. Prefer named exports.
- React: components `PascalCase.tsx`; hooks start with `use*`; colocate small components with feature folders.
- Utilities: `kebab-case.ts` in `src/lib/` or feature dirs. Use `@/` alias for `src` imports.
- Linting: rules in `eslint.config.js` (TS + React Hooks). Address warnings; avoid disabling rules globally without discussion.

## Testing Guidelines
- Framework: Vitest (`jsdom` configured). UI via React Testing Library; API via Supertest where applicable.
- Location/Names: `*.test.tsx/ts` near source or in `__tests__/`.
- Practices: deterministic tests, mock network/IO, cover critical flows (auth, billing, migrations).

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat(admin): add user roles`, `docs(readme): clarify setup`, `refactor(api): simplify config`).
- PRs: clear description, linked issues, test plan, screenshots for UI, call out DB migrations and new env vars. Keep scope focused.

## Security & Configuration Tips
- Never commit secrets. Update `.env.example` when adding env keys. Generate `SSH_CRED_SECRET` via `node scripts/generate-ssh-secret.js`.
- Default ports: UI `5173`, API `3001`. Ensure `VITE_API_URL` points to the API. Run migrations before starting dev.
