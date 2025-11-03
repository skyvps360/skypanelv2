# Technology Stack & Build System

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6 with React plugin and TypeScript paths
- **Styling**: Tailwind CSS 3 with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **State Management**: Zustand for global state, TanStack Query v5 for server state
- **Routing**: React Router v7
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion, Tailwind CSS animations
- **Icons**: Lucide React
- **Notifications**: React Hot Toast, Sonner

## Backend Stack
- **Runtime**: Node.js 20+ with ESM modules
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 12+ with custom migration system
- **Caching**: Redis 6+ with ioredis client
- **Authentication**: JWT with bcryptjs for password hashing
- **File Upload**: Multer
- **Email**: Nodemailer with SMTP2GO integration
- **WebSockets**: ws library for SSH console bridge
- **Queue System**: Bull with Redis backend
- **Security**: Helmet, CORS, express-rate-limit
- **Validation**: express-validator, Zod

## Development Tools
- **Package Manager**: npm
- **TypeScript**: v5.8+ with strict mode disabled for flexibility
- **Linting**: ESLint 9 with TypeScript ESLint
- **Testing**: Vitest with jsdom, React Testing Library, Supertest
- **Process Management**: PM2 for production, Nodemon for development
- **Concurrency**: concurrently for running multiple dev processes

## Common Commands

### Development
```bash
npm run dev              # Start both frontend and backend in development
npm run client:dev       # Start only Vite frontend (port 5173)
npm run server:dev       # Start only Express backend (port 3001)
npm run kill-ports       # Kill processes on ports 3001 and 5173
```

### Building & Testing
```bash
npm run build           # TypeScript check + Vite build
npm run check           # TypeScript type checking only
npm run lint            # ESLint code quality check
npm test                # Run Vitest test suite once
npm run test:watch      # Run Vitest in watch mode
```

### Database Management
```bash
node scripts/run-migration.js                    # Apply all pending migrations
node scripts/apply-single-migration.js <file>    # Apply specific migration
node scripts/reset-database.js --confirm         # Reset database (destructive)
node scripts/db:fresh                           # Reset + migrate
```

### Production Deployment
```bash
npm run start           # Production server (build + start)
npm run pm2:start       # Start with PM2 process manager
npm run pm2:reload      # Reload PM2 processes
npm run pm2:stop        # Stop and delete PM2 processes
```

### Utility Scripts
```bash
node scripts/generate-ssh-secret.js             # Generate SSH encryption secret
node scripts/create-test-admin.js               # Create admin user
node scripts/test-connection.js                 # Test database connection
node scripts/test-smtp.js                       # Test email configuration
node scripts/test-hourly-billing.js             # Test billing workflow
```

## Architecture Patterns
- **Modular Express**: Routes, middleware, and services are separated into dedicated modules
- **Service Layer**: Business logic abstracted into service classes (BillingService, etc.)
- **Database Abstraction**: Custom query/transaction helpers in `api/lib/database.ts`
- **Provider Abstraction**: Unified interfaces for Linode/DigitalOcean APIs
- **Real-time Updates**: PostgreSQL LISTEN/NOTIFY → Server-Sent Events → React Query
- **Configuration**: Environment-driven config with validation and dynamic proxy