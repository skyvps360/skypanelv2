# Project Structure

## Root Organization

```
skypanelv2/
├── src/              # React frontend application
├── api/              # Express backend application
├── migrations/       # PostgreSQL schema migrations
├── scripts/          # Operational utilities and helpers
├── public/           # Static assets (favicon, logo)
└── node_modules/     # Dependencies
```

## Frontend Structure (`src/`)

```
src/
├── components/       # React components
│   ├── ui/          # Reusable UI primitives (shadcn-style)
│   ├── admin/       # Admin-specific components
│   ├── VPS/         # VPS management components
│   ├── SSHKeys/     # SSH key management
│   ├── billing/     # Billing and payment components
│   ├── support/     # Support ticket components
│   └── Dashboard/   # Dashboard widgets
├── pages/           # Route-level page components
│   └── admin/       # Admin-specific pages
├── contexts/        # React contexts (Auth, Theme, Impersonation, Breadcrumb)
├── hooks/           # Custom React hooks
├── lib/             # Utility functions and helpers
├── services/        # Frontend API service wrappers
├── types/           # TypeScript type definitions
├── theme/           # Theme presets and configuration
├── App.tsx          # Root app component
├── main.tsx         # Application entry point
└── index.css        # Global styles and Tailwind imports
```

### Frontend Conventions
- Components: `PascalCase.tsx` (e.g., `VpsTable.tsx`)
- Hooks: `use-kebab-case.tsx` or `useHook.ts` (e.g., `use-mobile.tsx`, `useTheme.ts`)
- Utilities: `kebab-case.ts` in `lib/` (e.g., `billing-utils.ts`)
- Import alias: `@/*` maps to `src/*` (e.g., `import { api } from '@/lib/api'`)
- Prefer named exports over default exports
- Colocate feature-specific components in feature folders

## Backend Structure (`api/`)

```
api/
├── routes/          # Express route handlers
│   └── admin/       # Admin-specific routes
├── services/        # Business logic layer
│   └── providers/   # VPS provider service implementations
├── middleware/      # Express middleware (auth, rate limiting, security)
├── lib/             # Backend utilities (database, crypto, security)
├── config/          # Configuration management
├── app.ts           # Express app setup and middleware
├── server.ts        # Server entry point with SSH bridge
└── index.ts         # Vercel serverless entry point
```

### Backend Conventions
- Routes: Define endpoints, validate input, call services
- Services: Contain business logic, interact with database/external APIs
- Middleware: Reusable request processing (auth, rate limiting)
- Use `api/lib/database.ts` helpers: `query()`, `transaction()`, `getDbClient()`
- All modules use ESM syntax (`import`/`export`)
- Activity logging via `logActivity()` from `api/services/activityLogger.ts`

## Database (`migrations/`)

- Sequential SQL files: `001_initial_schema.sql`, `002_feature.sql`, etc.
- Applied via `node scripts/run-migration.js`
- Tracks applied migrations in `schema_migrations` table
- Use transactions for data migrations
- PostgreSQL LISTEN/NOTIFY for real-time notifications

## Scripts (`scripts/`)

Operational utilities organized by purpose:
- **Database**: `run-migration.js`, `reset-database.js`, `test-connection.js`
- **Admin**: `create-test-admin.js`, `promote-to-admin.js`, `update-admin-password.js`
- **Billing**: `test-hourly-billing.js`, `migrate-backup-pricing-data.js`
- **Communication**: `test-smtp.js`
- **Security**: `generate-ssh-secret.js`
- **Provider**: `fix-provider-encryption.js`, `test-ssh-key-sync.js`

## Configuration Files

- `.env` / `.env.example` - Environment variables
- `vite.config.ts` - Vite bundler configuration
- `tsconfig.json` - TypeScript compiler options
- `eslint.config.js` - Linting rules
- `vitest.config.ts` - Test runner configuration
- `tailwind.config.js` - Tailwind CSS customization
- `ecosystem.config.cjs` - PM2 process management
- `nodemon.json` - Development server watch config
- `vercel.json` - Vercel deployment configuration

## Key Architectural Patterns

### Provider Abstraction
- `api/services/providers/IProviderService.ts` - Interface definition
- `api/services/providers/BaseProviderService.ts` - Shared functionality
- `api/services/providers/LinodeProviderService.ts` - Linode implementation
- `api/services/providers/DigitalOceanProviderService.ts` - DigitalOcean implementation
- `api/services/providers/ProviderFactory.ts` - Factory for provider instances

### Service Layer Pattern
Backend services encapsulate business logic:
- `authService.ts` - Authentication and JWT management
- `billingService.ts` - Hourly billing reconciliation
- `invoiceService.ts` - Invoice generation
- `notificationService.ts` - Real-time notification streaming
- `emailService.ts` - Email delivery
- `activityLogger.ts` - Audit logging

### Component Organization
- UI primitives in `src/components/ui/` (Button, Dialog, Table, etc.)
- Feature components in feature folders (VPS, admin, billing)
- Page components in `src/pages/` map to routes
- Shared layouts in `src/components/` (AppLayout, PublicLayout)

## Import Path Examples

Frontend:
```typescript
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
```

Backend:
```typescript
import { query, transaction } from './lib/database.js'
import { config } from './config/index.js'
import { logActivity } from './services/activityLogger.js'
```

## Testing Structure
- Test files: `*.test.ts` or `*.test.tsx` colocated with source
- Backend tests may use `__tests__/` folders
- Use Vitest for both frontend and backend tests
- React Testing Library for component tests
- Supertest for API endpoint tests
