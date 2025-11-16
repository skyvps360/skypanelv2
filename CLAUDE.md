# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Development
```bash
# Install dependencies
npm install

# Start development servers (both frontend and backend)
npm run dev

# Start all three components (Client + API + Worker for PaaS)
npm run dev:all

# Kill ports before restarting
npm run kill-ports

# Start individual components
npm run client:dev    # Frontend only (Vite on :5173)
npm run server:dev    # Backend only (Nodemon on :3001)
npm run dev:worker    # PaaS Worker only
```

### Building and Testing
```bash
# Build for production (TypeScript check + Vite build)
npm run build

# Run tests
npm run test          # Run once
npm run test:watch    # Watch mode

# Code quality
npm run lint          # ESLint
npm run check         # TypeScript type checking
npm run preview       # Preview production build
```

### Production Deployment
```bash
# Start production servers
npm run start

# PM2 process management
npm run pm2:start     # Start with PM2
npm run pm2:reload    # Reload PM2 processes
npm run pm2:stop      # Stop and delete PM2 processes
npm run pm2:list      # List PM2 processes
```

### Database Management
```bash
# Reset database (with confirmation)
npm run db:reset

# Reset database without prompt
npm run db:reset:confirm

# Reset database and apply all migrations
npm run db:fresh

# Create admin user
npm run seed:admin
```

### PaaS Infrastructure
```bash
# Initialize PaaS infrastructure with Docker Swarm
npm run paas:init

# Get Grafana admin password
npm run paas:grafana-password
```

### Utility Scripts
```bash
# Generate encryption secret for provider API tokens
node scripts/generate-ssh-secret.js

# Test database connection
node scripts/test-connection.js

# Test SMTP configuration
node scripts/test-smtp.js

# Apply migrations
node scripts/run-migration.js

# Create test admin
node scripts/create-test-admin.js --email you@example.com --password changeme

# Promote user to admin
node scripts/promote-to-admin.js --email user@example.com

# Update admin password
node scripts/update-admin-password.js --email admin@example.com --password newpass
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query v5, Zustand, shadcn/ui
- **Backend**: Node.js 20+, Express.js (ESM), TypeScript, PostgreSQL, Redis, Bull queues
- **Integrations**: PayPal REST SDK, Linode/Akamai API, SMTP2GO, optional InfluxDB

### Directory Structure
```
api/                    # Express backend application
├── app.ts             # Express app configuration
├── server.ts          # Server entry point (includes SSH bridge init)
├── middleware/        # Express middleware (auth, rate limiting, security)
├── routes/            # API route handlers
├── services/          # Business logic and external integrations
├── lib/               # Utility functions and database helpers
└── worker/            # Background job processor (PaaS)

src/                   # React frontend application
├── main.tsx          # Frontend entry point
├── App.tsx           # Main app component with routing
├── pages/            # Page components
├── components/       # Reusable UI components
│   ├── admin/        # Admin-specific components
│   └── ui/           # shadcn/ui components
├── lib/              # Frontend utilities and API client
└── hooks/            # Custom React hooks

migrations/           # Database schema migrations
scripts/              # Utility scripts and admin tools
public/               # Static assets
```

### Key Architecture Patterns

#### Backend (ESM + TypeScript)
- **Entry Point**: `api/server.ts` initializes Express app, SSH WebSocket bridge, and schedules hourly billing
- **Configuration**: Centralized in `api/config/index.ts` - use this instead of `process.env`
- **Database**: Use helpers in `api/lib/database.ts` (`query`, `transaction`) for atomic operations
- **Provider Abstraction**: Multi-cloud VPS through `ProviderFactory` in `api/services/providers/`
- **Authentication**: JWT-based with middleware in `api/middleware/auth.ts`
- **Real-time Features**: PostgreSQL LISTEN/NOTIFY with Server-Sent Events via `notificationService`

#### Frontend (React + TypeScript)
- **Routing**: React Router v7 with protected routes (`ProtectedRoute`, `AdminRoute`)
- **State Management**: TanStack Query for server state, Zustand for client state
- **API Client**: Centralized in `src/lib/api.ts` with consistent auth headers
- **Styling**: Tailwind CSS + shadcn/ui components with theme support
- **Forms**: Comprehensive validation system in `src/lib/validation.ts`

## Development Guidelines

### Database Operations
- Always use `api/lib/database.ts` helpers for database operations
- Use transactions for billing and wallet operations to ensure atomicity
- Activity logging via `logActivity` in `api/services/activityLogger.ts` triggers notifications automatically

### Provider Integration
- All provider operations go through `ProviderFactory.createProvider(type, token)`
- Implementations extend `BaseProviderService` and implement `IProviderService`
- Provider API tokens are encrypted with `SSH_CRED_SECRET` environment variable
- Resource caching handled by `ProviderResourceCache` with TTL

### Authentication & Authorization
- JWT tokens stored in `localStorage` on frontend
- Backend middleware: `authenticateToken` → `requireOrganization` → `requireAdmin`
- Admin impersonation handled via `ImpersonationContext` on frontend

### Form Validation
- Comprehensive validation system in `src/lib/validation.ts`
- Real-time validation with pattern matching for emails/UUIDs/slugs
- SSH key format validation supporting RSA, Ed25519, ECDSA, and DSS keys
- Custom validation rules for admin forms

### Error Handling
- All API endpoints return `{ success: false, error }` on failures
- Global error handler in `api/app.ts` normalizes responses
- Frontend error boundaries in `src/components/admin/ErrorBoundary.tsx`

## Environment Configuration

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (32+ characters)
- `SSH_CRED_SECRET` - Encryption secret for provider tokens (generate via script)
- `REDIS_URL` - Redis connection for caching and queues
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - PayPal REST credentials
- `LINODE_API_TOKEN` - Linode API token for VPS management

### Branding/White-Label
- `COMPANY_NAME`, `COMPANY_BRAND_NAME`, `VITE_COMPANY_NAME` - Control brand display
- `COMPANY_LOGO_URL` - Custom logo URL
- Theme customization via admin panel or CSS variables

### Development vs Production
- Use `.env.example` as template for required variables
- Generate `SSH_CRED_SECRET` via `node scripts/generate-ssh-secret.js`
- Set `NODE_ENV=production` for deployments
- Configure `TRUST_PROXY` for reverse proxy setups

## Testing

### Test Structure
- **Unit Tests**: Vitest for components and utilities
- **Component Tests**: React Testing Library for UI components
- **API Tests**: Supertest for backend endpoints
- **Admin Components**: Complete test coverage for organization management modals

### Running Tests
```bash
npm run test          # Run all tests once
npm run test:watch    # Watch mode for development
```

### Test Coverage Areas
- Form validation and error states
- API integration and error handling
- User interactions and modal management
- Authentication and authorization flows

## Deployment Notes

### PM2 Configuration
- Uses `ecosystem.config.cjs` for process management
- Runs three processes: API server, UI preview, and background worker
- Configure environment variables in PM2 ecosystem file

### Database Migrations
- Run `node scripts/run-migration.js` before deployment
- All migrations in `migrations/` directory
- Single consolidated schema file: `migrations/001_initial_schema.sql`

### Security Checklist
- Strong `JWT_SECRET` (32+ characters)
- Secure `ENCRYPTION_KEY` for provider tokens
- PayPal live credentials (not sandbox)
- `TRUST_PROXY` configured for infrastructure
- Redis password and TLS enabled
- PostgreSQL SSL for managed databases

## Common Issues and Solutions

### Port Conflicts
- Run `npm run kill-ports` to free ports 3001 and 5173
- Check for other processes using these ports

### Database Connection
- Use `node scripts/test-connection.js` to verify connectivity
- Check `DATABASE_URL` format and credentials
- Ensure PostgreSQL is running and accessible

### Provider API Issues
- Verify `LINODE_API_TOKEN` has correct permissions
- Check token encryption/decryption with `SSH_CRED_SECRET`
- Validate provider credentials via admin panel

### Rate Limiting
- Redis-backed rate limiting state
- Clear with `redis-cli FLUSHDB` if limits seem stuck
- Configure tiered limits in environment variables

### Real-time Features
- Check Redis connection for notifications
- Verify SSE endpoints in browser devtools
- Ensure `activity_logs` triggers are working

### Form Validation
- Check validation schemas in `src/lib/validation.ts`
- Verify real-time validation feedback
- Ensure proper error state management in modals

### Admin Operations
- Verify admin role and authentication
- Check organization management API endpoints
- Ensure proper user search functionality
- Validate member management permissions