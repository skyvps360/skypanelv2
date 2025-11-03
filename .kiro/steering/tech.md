# Technology Stack

## Frontend
- **React 18** with TypeScript and Vite for fast development and builds
- **Tailwind CSS** for styling with shadcn/ui component library
- **TanStack Query v5** for server state management and caching
- **Zustand** for client-side state management
- **React Router v7** for navigation and routing
- **Framer Motion** for animations and transitions

## Backend
- **Node.js 20+** with Express.js in ESM mode
- **TypeScript** for type safety across the entire stack
- **PostgreSQL** for primary database with migrations in `migrations/`
- **Redis** for caching and session management
- **Bull** queues for background job processing

## Key Libraries & Integrations
- **PayPal REST SDK** for payment processing
- **Linode/Akamai API** and **DigitalOcean API** for VPS provisioning
- **Easypanel API** for optional container services
- **ssh2** for WebSocket-based SSH console access
- **Nodemailer** with SMTP2GO for email notifications
- **jsonwebtoken** for JWT authentication
- **bcryptjs** for password hashing

## Build System & Development

### Common Commands
```bash
# Development
npm run dev              # Start both frontend and backend
npm run client:dev       # Frontend only (Vite dev server)
npm run server:dev       # Backend only (Nodemon)
npm run kill-ports       # Free ports 3001 and 5173

# Building & Testing
npm run build           # TypeScript check + Vite build
npm run test            # Run Vitest test suite
npm run test:watch      # Watch mode for tests
npm run lint            # ESLint validation
npm run check           # TypeScript type checking

# Production
npm run start           # Production server + preview
npm run pm2:start       # PM2 process management
npm run pm2:reload      # Reload PM2 processes
npm run pm2:stop        # Stop PM2 processes

# Database & Utilities
node scripts/run-migration.js                    # Apply pending migrations
node scripts/generate-ssh-secret.js              # Generate encryption keys
node scripts/create-test-admin.js                # Create admin user
node scripts/test-connection.js                  # Test database connection
```

### Development Setup
1. **Prerequisites**: Node.js 20+, PostgreSQL 12+, Redis 6+
2. **Environment**: Copy `.env.example` to `.env` and configure
3. **Database**: Run migrations with `node scripts/run-migration.js`
4. **Development**: Use `npm run dev` for concurrent frontend/backend

### Architecture Patterns
- **Service Layer**: Business logic in `api/services/`
- **Route Handlers**: Express routes in `api/routes/`
- **Database Access**: Centralized through `api/lib/database.ts`
- **Configuration**: Environment-based config in `api/config/`
- **Middleware**: Rate limiting, auth, and CORS in `api/middleware/`

### Code Style & Conventions
- **ESM modules** throughout (`.js` extensions in imports)
- **TypeScript strict mode** disabled for flexibility
- **Functional components** with hooks in React
- **Async/await** preferred over promises
- **Error handling** with try/catch and proper HTTP status codes