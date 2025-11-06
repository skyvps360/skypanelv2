# SkyPanelV2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

SkyPanelV2 is an open-source cloud service reseller billing panel that provides a white-label control plane for cloud hosting businesses. It enables service providers to offer VPS hosting services through a unified interface with integrated billing, customer management, and comprehensive administrative tools.

## Feature Highlights

### Core VPS Management
- **Multi-provider support**: Unified interface for Linode and DigitalOcean with provider abstraction and normalized APIs
- **Flexible backup pricing**: Provider-specific backup options with admin-configurable upcharges and transparent pricing
- **SSH console access**: WebSocket-based SSH bridge for direct VPS terminal access
- **Real-time monitoring**: Live status updates and resource monitoring across all instances

### Billing & Payments
- **PayPal integration**: Prepaid wallet system with automated hourly billing reconciliation
- **Invoice management**: Automated invoice generation with downloadable PDF artifacts
- **Usage tracking**: Detailed resource usage monitoring and cost breakdown
- **Multi-currency support**: Flexible pricing with currency formatting

### Administration & Management
- **Comprehensive admin panel**: User management, provider configuration, and system monitoring
- **Role-based access**: Admin and user roles with impersonation capabilities for support
- **Rate limiting**: Configurable API rate limits with different tiers for user types
- **Activity logging**: Comprehensive audit trail for all system activities

### White-Label & Branding
- **Environment-driven branding**: Complete customization via environment variables
- **Theme system**: Multiple theme presets with custom color schemes
- **Provider abstraction**: Hide upstream provider names from end users
- **Custom domain support**: Full white-label experience for resellers

### Real-Time Features
- **Live notifications**: PostgreSQL LISTEN/NOTIFY with Server-Sent Events for instant updates
- **WebSocket support**: Real-time SSH console and system status updates
- **Activity feeds**: Live activity streams for billing, support, and system events

### Modern UI/UX
- **Responsive design**: Mobile-first approach with adaptive layouts
- **Drag & drop**: Sortable interfaces for provider management and configuration
- **Modal improvements**: Enhanced dialog sizing with proper scrolling and responsive behavior
- **Accessibility**: ARIA-compliant components with keyboard navigation support
- **Dark/Light themes**: Multiple theme presets with system preference detection

### Developer Experience
- **Modern tech stack**: React 18, TypeScript, Vite with hot reload and fast builds
- **API-first design**: RESTful APIs with comprehensive documentation and type safety
- **Database migrations**: Versioned schema management with rollback support
- **Testing suite**: Vitest for unit tests and Supertest for API integration tests
- **Development tools**: ESLint, TypeScript strict checking, and automated formatting

## Available Pages & Features

### Customer Portal
- **Dashboard**: Overview of VPS instances, billing summary, and recent activity
- **VPS Management**: Create, manage, and monitor VPS instances with real-time status
- **SSH Console**: Browser-based SSH access with full terminal functionality
- **SSH Keys**: Manage SSH public keys for secure VPS access
- **Billing**: Wallet management, PayPal top-ups, invoice history, and usage tracking
- **Support**: Ticket system with real-time messaging and file attachments
- **Settings**: Account management, preferences, and security settings
- **Activity**: Comprehensive activity log with filtering and search

### Administrative Interface
- **Admin Dashboard**: System overview with key metrics and quick actions
- **User Management**: User accounts, roles, and impersonation capabilities
- **VPS Plans**: Configure pricing, markups, and available instance types
- **Provider Management**: Configure Linode/DigitalOcean APIs and settings
- **Support Management**: Handle customer tickets and support requests
- **Platform Settings**: System configuration, themes, and branding options
- **Rate Limiting**: Configure API rate limits for different user tiers
- **FAQ Management**: Manage help documentation and frequently asked questions

### Public Pages
- **Homepage**: Marketing landing page with feature highlights
- **Pricing**: Public pricing information and plan comparisons
- **FAQ**: Customer help documentation and common questions
- **About Us**: Company information and team details
- **Contact**: Contact form and support information
- **Status**: System status and uptime monitoring
- **Terms of Service**: Legal terms and conditions
- **Privacy Policy**: Privacy policy and data handling information

### API Documentation
- **API Reference**: Interactive API documentation for developers
- **Integration Guides**: Documentation for third-party integrations
 
## Architecture Snapshot

- **Frontend (`src/`)**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, Zustand, shadcn/ui components, React Router v7.
- **Backend (`api/`)**: Express.js (ESM) with modular routes, service layer, JWT authentication, and comprehensive middleware.
- **Database**: PostgreSQL with versioned migrations in `migrations/`; real-time notifications via LISTEN/NOTIFY.
- **Infrastructure (`scripts/`)**: Migration runners, admin utilities, billing automation, SMTP testing, and operational tooling.

## Repository Layout

- `api/` – Express app, middleware, services, and database helpers.
- `src/` – React SPA with routing, contexts, services, and UI components.
- `migrations/` – Versioned SQL migrations for schema and data changes.
- `scripts/` – Node utilities for migrations, admin seeding, billing, SMTP, and diagnostics.
- `public/` – Static assets served by Vite.
- `repo-docs/` – Feature documentation and API references.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router v7, TanStack Query v5, Zustand, shadcn/ui components.
- **Backend**: Node.js 20+, Express.js (ESM), TypeScript, PostgreSQL, Redis, Bull queues, Nodemailer, WebSockets (ssh2).
- **Integrations**: PayPal REST SDK, Linode/Akamai API, DigitalOcean API, SMTP2GO, optional InfluxDB metrics.

## Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL 12+
- Redis 6+

- Optional: InfluxDB 2.x for metrics collection

## Getting Started

1. **Clone and install**

   ```bash
   git clone https://github.com/skyvps360/skypanelv2
   cd skypanelv2
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Generate encryption secret for provider API tokens:

   ```bash
   node scripts/generate-ssh-secret.js
   ```

   Update `.env` with your secrets:

   - `DATABASE_URL` – PostgreSQL connection string.
   - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` – PayPal REST credentials.
   - `LINODE_API_TOKEN` (required) and `DIGITALOCEAN_API_TOKEN` (optional) for provider APIs.

   - `COMPANY_NAME`, `COMPANY_BRAND_NAME`, or `VITE_COMPANY_NAME` to control white-label branding.
   - `SSH_CRED_SECRET` – Auto-generated by the script above for encrypting provider API tokens.
   - `REDIS_URL`, `SMTP2GO_*`, and rate limiting values to match your environment.



   For a complete reference of all environment variables, see the **[Environment Variables Documentation](./repo-docs/ENVIRONMENT_VARIABLES.md)**.

3. **Apply database migrations**

   ```bash
   node scripts/run-migration.js
   ```

   To replay a specific file:

   ```bash
   node scripts/apply-single-migration.js migrations/001_initial_schema.sql
   ```

4. **Start development servers**

   ```bash
   npm run dev
   ```

   This starts both servers concurrently:
   - **Frontend**: Vite dev server at `http://localhost:5173` with hot reload
   - **Backend**: Express API at `http://localhost:3001` with auto-restart via Nodemon
   - **Features**: SSE notifications, PayPal webhooks, SSH WebSocket bridge, API proxy

   For individual servers:
   ```bash
   npm run client:dev  # Frontend only
   npm run server:dev  # Backend only
   ```

5. **Seed admin access**

   - Default admin from migrations: `admin@skypanelv2.com` / `admin123`.
   - Or create one manually:

     ```bash
     node scripts/create-test-admin.js --email you@example.com --password changeme
     ```

   Rotate admin passwords promptly in real deployments.



## Useful npm Scripts

### Development
- `npm run dev` – Start Vite + Nodemon concurrently for full-stack development.
- `npm run dev-up` – Kill ports and start development servers (convenience script).
- `npm run client:dev` – Run frontend only (Vite dev server on port 5173).
- `npm run server:dev` – Run backend only (Nodemon on port 3001).
- `npm run kill-ports` – Free ports `3001` and `5173` before restarting dev servers.

### Building & Testing
- `npm run build` – TypeScript check + Vite build for production.
- `npm run test` – Run Vitest test suite once.
- `npm run test:watch` – Run Vitest in watch mode for development.
- `npm run lint` – Run ESLint validation.
- `npm run check` – TypeScript type checking without emitting files.
- `npm run preview` – Preview production build locally.

### Production & Deployment
- `npm run start` – Launch production Express server + Vite preview.
- `npm run pm2:start` – Start with PM2 process manager.
- `npm run pm2:reload` – Reload PM2 processes.
- `npm run pm2:stop` – Stop and delete PM2 processes.
- `npm run pm2:list` – List PM2 processes.

### Database Management
- `npm run db:reset` – Reset database (with confirmation prompt).
- `npm run db:reset:confirm` – Reset database without prompt.
- `npm run db:fresh` – Reset database and apply all migrations.
- `npm run seed:admin` – Create admin user via script.

### Script Utilities

#### Database & Migration Scripts
- `node scripts/generate-ssh-secret.js` – Generate and add `SSH_CRED_SECRET` to `.env` for provider token encryption.
- `node scripts/run-migration.js` – Apply pending migrations sequentially.
- `node scripts/apply-stackscript-migration.js <file>` – Execute stackscript-specific SQL helpers.
- `node scripts/test-connection.js` – Verify database connectivity.

#### Billing & Payment Scripts
- `node scripts/test-hourly-billing.js` – Dry-run the hourly billing workflow.


#### Communication & Admin Scripts
- `node scripts/test-smtp.js` – Send an SMTP2GO smoke test.
- `node scripts/promote-to-admin.js --email user@example.com` – Elevate an existing account.
- `node scripts/update-admin-password.js --email admin@example.com --password newpass` – Rotate admin passwords.

## Development Notes

### Backend Architecture
- **Server startup**: Express boots from `api/server.ts`, initializes SSH WebSocket bridge, and schedules hourly billing
- **Database access**: Use `api/lib/database.ts` (`query`, `transaction`) for atomic operations, especially billing
- **Activity logging**: Use `logActivity` in `api/services/activityLogger.ts` for auditable events and notifications
- **Rate limiting**: Configured in `api/middleware/rateLimiting.ts` with tiered limits for different user types

### Frontend Development
- **API communication**: Route calls through `src/lib/api.ts` for consistent auth headers and error handling
- **State management**: TanStack Query for server state, Zustand for client state, React Context for auth/theme
- **Component library**: shadcn/ui components with Tailwind CSS for consistent styling
- **Routing**: React Router v7 with protected routes and role-based access control

### Configuration & Branding
- **Environment variables**: Update `.env` branding keys and restart dev servers to refresh UI
- **Theme system**: Modify theme presets in `src/theme/` for custom color schemes
- **White-labeling**: Configure `COMPANY_NAME`, `VITE_COMPANY_NAME` for complete rebranding

### Development Workflow
- **Hot reload**: Vite provides instant frontend updates, Nodemon restarts backend on changes
- **Type safety**: Full TypeScript coverage with shared types between frontend and backend
- **Testing**: Run `npm run test:watch` during development for continuous feedback
- **Debugging**: Use browser dev tools for frontend, Node.js inspector for backend debugging

## Documentation

### API Documentation

- **[API Reference](./repo-docs/API_REFERENCE.md)** - Complete API endpoint reference

- **[Flexible Backup Pricing API](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md)** - Backup configuration and pricing endpoints
- **[Multi-Provider VPS](./repo-docs/MULTI_PROVIDER_VPS.md)** - Multi-provider VPS management

### Configuration Documentation

- **[Environment Variables](./repo-docs/ENVIRONMENT_VARIABLES.md)** - Complete environment configuration reference

Additional documentation for specific features is available in the `repo-docs/` directory.

## Testing & Quality

- Vitest powers unit and integration specs (see `api/middleware/__tests__` for examples with Supertest).
- React Testing Library covers UI flows where present.
- `npm run test:watch` keeps feedback tight during development; CI runs `npm run test` + `npm run lint` + `npm run check`.

## Deployment

### Quick Deployment
1. **Build the application**
   ```bash
   npm run build
   ```

2. **Configure production environment**
   - Copy `.env.example` to `.env` with production values
   - Set `NODE_ENV=production`
   - Configure all required secrets and API keys

3. **Deploy and start**
   ```bash
   npm run start        # Simple deployment
   npm run pm2:start    # PM2 process management (recommended)
   ```

### Production Deployment Options

#### Vercel (Recommended for Serverless)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```
Configure environment variables in Vercel dashboard.

#### VPS/Dedicated Server with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Deploy with PM2
npm run pm2:start

# Monitor processes
pm2 monit
pm2 logs
```

#### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Production Checklist

#### Security
- [ ] Strong `JWT_SECRET` (32+ characters)
- [ ] Secure `ENCRYPTION_KEY` for provider API tokens
- [ ] PayPal live credentials (not sandbox)
- [ ] `TRUST_PROXY` configured for your infrastructure
- [ ] Redis password and TLS enabled
- [ ] PostgreSQL SSL for managed database providers

#### Performance
- [ ] Redis caching configured and connected
- [ ] Database connection pooling optimized
- [ ] Rate limiting configured appropriately
- [ ] Static assets served via CDN (if applicable)

#### Monitoring
- [ ] Application logging configured
- [ ] Error tracking service integrated
- [ ] Database backup strategy implemented
- [ ] Health check endpoints configured
- [ ] Optional: InfluxDB for metrics collection

#### Environment Variables
- [ ] All required variables from `.env.example` configured
- [ ] Provider API tokens with proper permissions
- [ ] SMTP credentials for email notifications
- [ ] PayPal webhook endpoints configured

## Troubleshooting

### Common Development Issues
- **Ports in use**: Run `npm run kill-ports` to free ports 3001 and 5173 before starting dev servers
- **API unreachable**: Confirm backend is running on correct `PORT` from `.env` and all migrations completed
- **Build failures**: Run `npm run check` for TypeScript errors, `npm run lint` for ESLint issues
- **Database connection**: Use `node scripts/test-connection.js` to verify PostgreSQL connectivity

### Provider Integration Issues
- **Linode regions empty**: Validate `LINODE_API_TOKEN` and configure provider settings in admin panel
- **DigitalOcean API errors**: Check `DIGITALOCEAN_API_TOKEN` and ensure proper rate limiting compliance
- **Provider validation fails**: Verify API tokens have correct permissions and aren't expired

### Feature-Specific Issues
- **Notifications not working**: Ensure notification migrations ran successfully and Redis is connected
- **PayPal checkout problems**: Verify SDK loads correctly and credentials match sandbox/live mode
- **SSH console fails**: Check JWT token permissions and SSH bridge accessibility at `/api/vps/:id/ssh`
- **Email delivery issues**: Test SMTP configuration with `node scripts/test-smtp.js`

### Performance & Scaling
- **Slow API responses**: Check database query performance and Redis caching configuration
- **Memory issues**: Monitor Node.js heap usage, consider PM2 for production process management
- **Rate limiting**: Adjust limits in `.env` based on your infrastructure capacity

### Production Deployment
- **Environment variables**: Ensure all production secrets are properly configured
- **Database migrations**: Run `node scripts/run-migration.js` before deployment
- **SSL/TLS**: Configure proper certificates for production domains
- **Monitoring**: Set up logging and monitoring for production error tracking

## UI Gallery

- [Homepage](https://github.com/user-attachments/assets/9946df73-39e1-40da-a642-fd52faf99472)
- [Dashboard](https://github.com/user-attachments/assets/df382c78-3456-4f06-b340-0a38c221bcdf)
- [Billing](https://github.com/user-attachments/assets/15a5868d-188a-4478-9c14-b4948cda2129)
- [VPS Management](https://github.com/user-attachments/assets/a3119176-28f3-4e74-8e67-29c055c41822)
- [Admin Panel](https://github.com/user-attachments/assets/74968f3c-1154-46b3-9a48-6ae46fd1d3e0)
- [Support Tickets](https://github.com/user-attachments/assets/29f20e74-d6fb-4abf-aa64-d6dc73c9a0b9)

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome-change`).
3. Run tests and linting locally.
4. Open a pull request describing the change and validation steps.

## License

Licensed under the [MIT License](LICENSE).

## Support

[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?hosted_button_id=TEY7YEJC8X5HW)

For help, use the in-app support ticket system or open an issue.

---

Built by [skyvps360](https://github.com/skyvps360) for the open-source community.
