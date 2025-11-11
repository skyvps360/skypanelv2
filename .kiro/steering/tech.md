# Tech Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router v7
- **State Management**: Zustand for global state, TanStack Query v5 for server state
- **UI Components**: shadcn/ui patterns with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme system
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion

## Backend
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Framework**: Express.js
- **Database**: PostgreSQL 12+ with manual migrations
- **Caching**: Redis 6+ with ioredis client
- **Queue**: Bull for background jobs
- **Authentication**: JWT with bcryptjs
- **Email**: Nodemailer with SMTP2GO
- **SSH**: ssh2 library with WebSocket bridge (ws)
- **Security**: Helmet, express-rate-limit, express-validator

## External Integrations
- **Payment**: PayPal REST SDK (@paypal/paypal-server-sdk)
- **VPS Providers**: Linode API, DigitalOcean API
- **Metrics** (optional): InfluxDB 2.x

## Development Tools
- **Linting**: ESLint 9 with TypeScript ESLint
- **Testing**: Vitest with jsdom, React Testing Library, Supertest
- **Process Management**: PM2 for production, Nodemon for dev
- **Concurrency**: concurrently for running dev servers

## Common Commands

### Development
```bash
npm run dev              # Start both frontend (5173) and backend (3001)
npm run client:dev       # Frontend only
npm run server:dev       # Backend only
npm run kill-ports       # Free ports 3001 and 5173
```

### Build & Production
```bash
npm run build            # TypeScript compile + Vite build
npm run start            # Production server (Express + Vite preview)
npm run pm2:start        # Build and start with PM2
npm run pm2:reload       # Reload PM2 processes
npm run pm2:stop         # Stop and delete PM2 processes
```

### Quality Checks
```bash
npm run lint             # ESLint
npm run check            # TypeScript type checking (no emit)
npm run test             # Run Vitest tests once
npm run test:watch       # Run tests in watch mode
```

### Database
```bash
node scripts/run-migration.js                    # Apply pending migrations
node scripts/apply-single-migration.js <file>    # Apply specific migration
npm run db:fresh                                 # Reset DB and run migrations
node scripts/test-connection.js                  # Test DB connectivity
```

### Admin & Utilities
```bash
node scripts/generate-ssh-secret.js              # Generate SSH_CRED_SECRET
node scripts/create-test-admin.js                # Create admin user
node scripts/promote-to-admin.js --email <email> # Promote user to admin
node scripts/update-admin-password.js            # Change admin password
node scripts/test-smtp.js                        # Test email configuration
node scripts/test-hourly-billing.js              # Dry-run billing cycle
```

## Key Configuration Files
- `vite.config.ts` - Vite build config with API proxy
- `tsconfig.json` - TypeScript config with `@/*` path alias
- `eslint.config.js` - ESLint flat config
- `vitest.config.ts` - Test configuration
- `ecosystem.config.cjs` - PM2 process definitions
- `nodemon.json` - Nodemon watch configuration

## Environment Setup
1. Copy `.env.example` to `.env`
2. Generate `SSH_CRED_SECRET` with `node scripts/generate-ssh-secret.js`
3. Configure `DATABASE_URL`, `REDIS_URL`, PayPal credentials, provider API tokens
4. Run migrations: `node scripts/run-migration.js`
5. Start dev: `npm run dev`

## Port Configuration
- Frontend dev: `5173` (Vite)
- Backend API: `3001` (Express)
- Frontend proxies `/api/*` requests to backend in development
