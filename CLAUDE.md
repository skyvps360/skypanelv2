# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start full development environment (Vite frontend on port 5173 + Express backend on port 3001)
- `npm run dev-up` - Kill ports 3001/5173 then start development servers
- `npm run client:dev` - Frontend only (Vite dev server)
- `npm run server:dev` - Backend only (Nodemon on Express)
- `npm run kill-ports` - Free ports 3001 and 5173

### Building & Quality Assurance
- `npm run build` - TypeScript check + Vite production build
- `npm run test` - Run Vitest test suite once
- `npm run test:watch` - Continuous testing during development
- `npm run lint` - ESLint validation
- `npm run check` - TypeScript type checking without compilation
- `npm run preview` - Preview production build locally

### Production Deployment
- `npm run start` - Production Express server + Vite preview
- `npm run pm2:start` - Deploy with PM2 process manager (recommended)
- `npm run pm2:reload` - Reload PM2 processes
- `npm run pm2:stop` - Stop and delete PM2 processes

### Database Management
- `npm run db:reset` - Reset database with confirmation prompt
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run db:fresh` - Reset database and apply all migrations
- `npm run seed:admin` - Create admin user via script

### Essential Scripts
- `node scripts/run-migration.js` - Apply pending database migrations
- `node scripts/generate-ssh-secret.js` - Generate SSH_CRED_SECRET for provider token encryption
- `node scripts/test-connection.js` - Verify database connectivity
- `node scripts/test-smtp.js` - Test SMTP configuration
- `node scripts/promote-to-admin.js --email user@example.com` - Promote user to admin

## Architecture Overview

### Backend (api/)
- **Server**: Express.js (ESM) starting from `api/server.ts`
- **Database**: PostgreSQL with connection pooling via `api/lib/database.ts`
- **Authentication**: JWT-based with middleware in `api/middleware/auth.ts`
- **Real-time Features**: WebSocket SSH bridge, SSE notifications via PostgreSQL LISTEN/NOTIFY
- **Background Services**: Hourly billing scheduler, PaaS node monitoring
- **Provider Abstraction**: Unified interface for Linode/DigitalOcean with factory pattern in `api/services/providers/`

### Frontend (src/)
- **Framework**: React 18 with Vite, TypeScript, and hot reload
- **Routing**: React Router v7 with protected routes and role-based access
- **State Management**: TanStack Query v5 for server state, Zustand for client state
- **UI Library**: shadcn/ui components with Tailwind CSS
- **Form Validation**: Comprehensive validation system in `src/lib/validation.ts`

### Database Schema
- **Migrations**: Versioned SQL migrations in `migrations/` directory
- **Core Tables**: users, organizations, vps_instances, billing_records, support_tickets
- **PaaS Integration**: New tables for platform-as-a-service functionality (nodes, runtimes, applications)

## Key Development Patterns

### Database Operations
Always use `api/lib/database.ts` helpers (`query`, `transaction`) for atomic operations, especially billing. The database helper ensures proper connection handling and transaction management.

### API Development
- Routes organized by feature in `api/routes/`
- Services layer in `api/services/` for business logic
- Comprehensive validation using Zod schemas
- Rate limiting configured in `api/middleware/rateLimiting.ts`

### Frontend API Communication
Route all API calls through `src/lib/api.ts` for consistent authentication headers, error handling, and base URL configuration.

### Authentication & Authorization
- JWT tokens stored in localStorage with auto-logout on expiration
- Role-based access control (admin/user)
- Admin impersonation capabilities with confirmation dialogs
- Protected routes wrap components requiring authentication

### Form Validation
Use the comprehensive validation system in `src/lib/validation.ts` featuring:
- Real-time validation feedback
- Pattern matching for emails, UUIDs, slugs
- SSH key format validation (RSA, Ed25519, ECDSA, DSS)
- Admin form validation with custom rules

### Component Development
- Use shadcn/ui components from `src/components/ui/` for consistency
- Follow React 18 patterns with hooks and functional components
- Implement proper error boundaries and loading states
- Mobile-first responsive design with Tailwind CSS

### Provider Integration
- Provider abstraction via `api/services/providers/BaseProviderService.ts`
- Factory pattern for provider selection in `ProviderFactory.ts`
- Error normalization for consistent API responses across providers
- Encrypted provider API token storage

### Real-time Features
- SSH console access via WebSocket bridge at `/api/vps/:id/ssh`
- Live notifications via Server-Sent Events at `/api/notifications/stream`
- Activity logging through `api/services/activityLogger.ts`

## Environment Configuration

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (32+ characters)
- `SSH_CRED_SECRET` - Encryption secret for provider API tokens
- `LINODE_API_TOKEN` - Linode API access token
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - PayPal REST credentials

### Optional Variables
- `DIGITALOCEAN_API_TOKEN` - DigitalOcean API access token
- `REDIS_URL` - Redis connection for caching
- `SMTP2GO_*` - Email configuration
- `COMPANY_NAME` / `VITE_COMPANY_NAME` - White-label branding

### Development Setup
1. Copy `.env.example` to `.env`
2. Generate SSH secret: `node scripts/generate-ssh-secret.js`
3. Configure database and provider tokens
4. Run migrations: `node scripts/run-migration.js`
5. Start development: `npm run dev`

## Testing Strategy

### Test Structure
- **Unit Tests**: Vitest for utilities and services
- **Component Tests**: React Testing Library for UI components
- **API Tests**: Supertest for backend endpoints
- **Admin Components**: Comprehensive test coverage for modal-based admin interfaces

### Running Tests
- `npm run test` - Full test suite
- `npm run test:watch` - Continuous testing during development
- Tests located in `src/components/**/__tests__/` and `api/middleware/__tests__/`

### Test Coverage Areas
- Form validation scenarios and error states
- API integration with mocking
- User interactions and modal state management
- Authentication flows and role-based access
- Admin operations (CRUD, member management, impersonation)

## Project Structure Notes

### Important Directories
- `api/routes/paas/` - Platform-as-a-service API endpoints
- `api/services/paas/` - PaaS business logic services
- `src/components/admin/` - Enhanced admin interface components
- `src/lib/validation.ts` - Comprehensive form validation schemas
- `scripts/` - Database utilities, admin tools, and operational scripts

### Recent Additions
- PaaS (Platform-as-a-Service) integration with nodes, runtimes, and applications
- Enhanced organization management with modal-based CRUD operations
- Comprehensive admin user management with improved error handling
- Advanced member management with role assignments and ownership transfers
- Real-time user search with organization filtering

### Development Workflow
- Hot reload: Vite for frontend, Nodemon for backend
- Type safety: Full TypeScript coverage shared between frontend and backend
- API proxy: Vite proxies `/api/*` to Express backend
- Error handling: Comprehensive error boundaries and validation feedback