# CRUSH.md - SkyPanelV2 Development Guide

## Essential Commands

### Development
- `npm run dev` - Start both frontend (Vite on 5173) and backend (Express on 3001) concurrently
- `npm run dev:all` - Start frontend, backend, and PaaS worker together
- `npm run client:dev` - Frontend only with hot reload
- `npm run server:dev` - Backend only with nodemon auto-restart
- `npm run dev:worker` - PaaS background worker only
- `npm run kill-ports` - Free ports 3001/5173 before starting dev servers

### Building & Quality
- `npm run build` - TypeScript check + Vite production build
- `npm run check` - TypeScript type checking without emitting files
- `npm run lint` - ESLint validation with auto-fix available
- `npm test` - Run Vitest test suite once
- `npm run test:watch` - Continuous testing during development
- `npm run preview` - Preview production build locally

### Production & Deployment
- `npm run start` - Production mode: Express server + Vite preview
- `npm run pm2:start` - Deploy with PM2 process manager (recommended)
- `npm run pm2:reload` - Reload PM2 processes
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

### Database Operations
- `npm run db:fresh` - Reset database and apply all migrations
- `npm run db:reset` - Reset database with confirmation prompt
- `npm run db:reset:confirm` - Reset database without prompts
- `node scripts/run-migration.js` - Apply pending migrations
- `npm run seed:admin` - Create admin user via script
- `npm run paas:init` - Initialize PaaS infrastructure

### Utility Scripts
- `node scripts/test-connection.js` - Verify database connectivity
- `node scripts/generate-ssh-secret.js` - Generate encryption secret for provider tokens
- `node scripts/test-smtp.js` - Test email configuration
- `node scripts/test-hourly-billing.js` - Dry-run billing workflow

## Project Architecture

### Directory Structure
```
src/                    # React frontend
├── components/         # UI components (shadcn/ui + custom)
│   ├── admin/         # Admin-specific components
│   ├── ui/            # Base UI components
│   └── hooks/         # Component-specific hooks
├── pages/             # Route components
├── lib/               # Utilities, API client, validation
├── hooks/             # Global React hooks
├── contexts/          # React contexts (Auth, Theme, Impersonation)
├── services/          # Frontend services
├── types/             # TypeScript type definitions
└── theme/             # Theme configuration

api/                   # Express backend
├── routes/            # API endpoints
├── services/          # Business logic
├── middleware/        # Express middleware
├── lib/               # Backend utilities
├── config/            # Configuration management
├── worker/            # Background job processing
└── types/             # Backend types

migrations/            # SQL migrations
scripts/               # Database and utility scripts
public/                # Static assets
repo-docs/             # Documentation
docker/                # Docker configurations
```

### Technology Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, Zustand, shadcn/ui
- **Backend**: Node.js 20+, Express.js (ESM), TypeScript, PostgreSQL, Redis, Bull queues
- **Database**: PostgreSQL with migrations, LISTEN/NOTIFY for real-time features
- **Infrastructure**: Redis (caching/queues), optional InfluxDB (metrics), Docker Swarm (PaaS)

## Code Conventions & Patterns

### General Patterns
- **TypeScript everywhere** with shared types between frontend/backend
- **ESM modules** - imports must use explicit `.js` extensions in backend files
- **2-space indentation** throughout the codebase
- **PascalCase** for components, **camelCase** for functions/variables, **kebab-case** for files
- **Path alias** `@/*` resolves to `./src/*`

### Frontend Patterns
- **API calls** through `src/lib/api.ts` for consistent auth headers and error handling
- **State management**: TanStack Query for server state, Zustand for client state
- **Form validation**: Comprehensive system in `src/lib/validation.ts` with real-time feedback
- **Routing**: React Router v7 with `ProtectedRoute`, `AdminRoute`, and `PublicRoute` helpers
- **Components**: Pages in `src/pages/`, reusable in `src/components/`, admin-specific in `src/components/admin/`

### Backend Patterns
- **Database access**: Use `api/lib/database.ts` (`query`, `transaction`) helpers
- **Configuration**: Read via `api/config/index.ts` proxy instead of `process.env`
- **Authentication**: JWT via `authenticateToken` middleware, with `requireOrganization` and `requireAdmin` layers
- **Activity logging**: Use `logActivity` in `api/services/activityLogger.ts` for audit trails
- **Provider abstraction**: Multi-cloud VPS through `ProviderFactory` in `api/services/providers/`

## Testing Approach

### Test Framework
- **Vitest** for unit and integration tests
- **React Testing Library** for component tests
- **Supertest** for API endpoint tests

### Test Structure
- Co-locate tests as `*.test.ts`/`*.test.tsx` next to source files
- Use `src/test-utils.tsx` for provider wrappers
- Global test setup in `src/test-setup.ts`
- Mock external providers, Redis, and database connections

### Key Testing Areas
- **Form validation**: Real-time validation, error states, user feedback
- **API integration**: Mock responses, error handling, loading states
- **Admin components**: Comprehensive modal testing (OrganizationCreateModal, MemberAddModal, etc.)
- **Authentication**: Mock auth contexts and role-based access

### Running Tests
- `npm run test` - Single run for CI
- `npm run test:watch` - Development with file watching
- Tests run in jsdom environment with Vitest globals enabled

## Critical Gotchas & Common Issues

### Backend ESM Issues
- **Missing .js extensions**: Backend imports MUST use explicit `.js` extensions (e.g., `./services/foo.js`)
- Runtime will fail even if TypeScript compiles without them

### Database & Encryption
- **SSH_CRED_SECRET**: Must be 32+ characters for provider token encryption
- Generate via `node scripts/generate-ssh-secret.js`
- Reset database if encryption key changes

### Organization Context
- **organizationId required**: Many endpoints need `req.user.organizationId`
- Use `requireOrganization` middleware to ensure context

### Rate Limiting
- **Redis-backed**: Clear with `redis-cli FLUSHDB` if limits seem stuck
- Different tiers: anonymous, authenticated, admin users
- Per-user overrides in `rate_limit_overrides` table

### Development Workflow
- **Port conflicts**: Use `npm run kill-ports` before starting servers
- **Environment variables**: Update `.env` and restart dev servers to refresh
- **Hot reload**: Vite for frontend, Nodemon for backend

### Provider Integration
- **API tokens**: Configure in admin panel at `/admin#providers`
- Validate credentials with `validateProviderCredentials`
- Provider names hidden from clients via white-labeling

## Environment & Security

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing (32+ chars)
- `SSH_CRED_SECRET` - Token encryption (32+ chars)
- `REDIS_URL` - Redis connection
- `LINODE_API_TOKEN` - Required provider API
- `DIGITALOCEAN_API_TOKEN` - Optional provider API
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - Payments

### Security Practices
- **Never commit** `.env*` files
- **Encrypted storage** for provider API tokens
- **Helmet CSP** configured in `api/app.ts`
- **Rate limiting** with smart tiered limits
- **Audit logging** for admin operations

### White-Label Configuration
- `COMPANY_NAME`, `COMPANY_BRAND_NAME`, `VITE_COMPANY_NAME`
- `COMPANY_LOGO_URL` for custom branding
- Theme system via `/admin#theme-manager`

## Database Migrations

### Migration Structure
- Single consolidated migration: `migrations/001_initial_schema.sql`
- Versioned migrations for PaaS features: `003_paas_integration.sql`, etc.
- PostgreSQL extensions: `uuid-ossp`, `pgcrypto`

### Migration Workflow
```bash
# Apply all pending migrations
node scripts/run-migration.js

# Apply specific migration
node scripts/apply-single-migration.js migrations/001_initial_schema.sql

# Fresh start
npm run db:fresh
```

### Schema Highlights
- **Users** with role-based access (admin/user)
- **Organizations** with member management and ownership
- **Wallets** with prepaid billing system
- **VPS instances** with multi-provider support
- **Activity logs** with real-time notifications

## Real-Time Features

### SSE (Server-Sent Events)
- **Endpoint**: `/api/notifications/stream`
- **Authentication**: Via `token` query param
- **Client**: Use `EventSource` in frontend

### WebSocket Features
- **SSH console**: Browser-based terminal via `/api/vps/:id/ssh`
- **Live updates**: Activity feeds, status changes

### Background Jobs
- **Bull queues** with Redis backend
- **Worker process**: `api/worker/index.ts`
- **Hourly billing** automated via scheduled jobs

## Admin Interface

### Enhanced User Management
- **AdminUserDetail**: Robust error handling, retry mechanisms, resource impact warnings
- **Impersonation**: Admin-to-admin with confirmation dialogs
- **Comprehensive modals**: OrganizationCreateModal, MemberAddModal, etc.

### Organization Management
- **CRUD operations**: Complete organization lifecycle management
- **Member management**: Role assignments, ownership transfers, safe removal
- **Advanced search**: Real-time user search with membership filtering
- **Validation**: Server-side validation with proper error responses

### System Administration
- **Provider configuration**: Linode/DigitalOcean API management
- **Rate limiting**: Tiered limits with per-user overrides
- **Theme management**: Custom color schemes and presets
- **FAQ management**: Help documentation and user guides

## Performance & Optimization

### Frontend Optimization
- **Code splitting**: Lazy loading with React.lazy
- **Image optimization**: Responsive images with proper sizing
- **Bundle analysis**: Vite built-in analyzer
- **Caching**: TanStack Query with 30s staleTime

### Backend Optimization
- **Database pooling**: PostgreSQL connection pooling
- **Redis caching**: Provider resource caching with TTL
- **Rate limiting**: Smart limits with Redis backend
- **Query optimization**: Use transaction helpers for atomic operations

### Production Deployment
- **PM2 process management**: Recommended for production
- **Health checks**: `/api/health/rate-limit` for monitoring
- **Error tracking**: Comprehensive logging and error handling
- **SSL/TLS**: Configure proper certificates

## Troubleshooting Quick Reference

### Common Development Issues
- **Ports in use**: `npm run kill-ports`
- **API unreachable**: Check backend on correct PORT, run migrations
- **Build failures**: `npm run check` for TS errors, `npm run lint` for ESLint
- **Database issues**: `node scripts/test-connection.js`

### Provider Issues
- **Linode regions empty**: Validate `LINODE_API_TOKEN`, configure in admin
- **DigitalOcean errors**: Check `DIGITALOCEAN_API_TOKEN`, rate limits
- **Token decryption**: Verify `SSH_CRED_SECRET` is set (32+ chars)

### Feature Issues
- **Notifications not working**: Check Redis connection, migration success
- **PayPal problems**: Verify SDK credentials match sandbox/live mode
- **SSH console fails**: Check JWT permissions, SSH bridge at `/api/vps/:id/ssh`

### Production Issues
- **Memory issues**: Monitor heap usage, use PM2 for process management
- **Slow responses**: Check database performance, Redis caching
- **Rate limits**: Adjust based on infrastructure capacity

## Development Workflow Best Practices

### Before Starting Work
1. Run `npm run kill-ports` to clear any existing processes
2. Pull latest changes and run `npm install`
3. Check if database needs migrations: `node scripts/run-migration.js`
4. Start development: `npm run dev` or `npm run dev:all` for PaaS

### During Development
1. Make frontend changes - Vite hot reloads automatically
2. Make backend changes - Nodemon restarts automatically  
3. Run `npm run test:watch` for continuous testing
4. Use `npm run lint -- --fix` to auto-fix code style issues

### Before Committing
1. Run `npm run lint` - Fix any ESLint issues
2. Run `npm run check` - Ensure no TypeScript errors
3. Run `npm test` - All tests must pass
4. Test your changes manually in the browser

### Quality Gates
All PRs must pass:
- `npm run lint` - Code style and linting
- `npm run check` - TypeScript type checking  
- `npm test` - Complete test suite
- Manual testing of UI changes

## Repository-Specific Patterns

### Admin Component Patterns
- **Modal-based UI**: Comprehensive modals for all admin operations
- **Real-time validation**: Form validation with immediate feedback
- **Error boundaries**: Robust error handling with fallbacks
- **Loading states**: Proper loading indicators and skeleton screens

### API Response Patterns
- **Standardized errors**: All endpoints return `{ success: false, error }` on failures
- **Pagination**: Consistent pagination across list endpoints
- **Authentication**: JWT required for most endpoints, admin role for admin routes
- **Rate limiting**: Smart limits based on user type and authentication status

### Database Patterns
- **UUID primary keys**: All tables use UUID for primary keys
- **Soft deletes**: Important data uses deleted_at rather than hard deletes
- **Audit trails**: Activity logging for all important operations
- **Transactions**: Use database transactions for billing and wallet operations

This guide covers the essential patterns, commands, and conventions needed to work effectively in SkyPanelV2. Follow these guidelines to maintain code quality and ensure smooth development workflow.