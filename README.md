# SkyPanelV2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)

SkyPanelV2 is an open-source control plane for cloud service providing offering vps and container services. It packages provider provisioning, PayPal-backed wallet billing, white-label branding for the applicaiton owner, and a modern self-service portal backed by a React 18 + Vite frontend and an Express.js API.

## Feature Highlights

- **Multi-provider VPS management**: Unified interface for Linode and DigitalOcean with provider abstraction, normalized APIs, and intelligent caching. See [MULTI_PROVIDER_VPS.md](./repo-docs/MULTI_PROVIDER_VPS.md) for details.
- **Container as a Service (CaaS)**: Optional Easypanel integration for containerized application hosting with subscription-based plans, resource quotas, and template deployments.
- **Flexible backup pricing**: Provider-specific backup options (daily vs weekly for DigitalOcean), transparent pricing with admin-configurable upcharges, and user-driven region selection. See [FLEXIBLE_BACKUP_PRICING_API.md](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md) for API documentation.
- **Provider provisioning**: Linode and DigitalOcean services orchestrate instance creation, plan catalogs, stackscript automation, and activity logging.
- **Billing & wallets**: PayPal prepaid wallets, hourly reconciliation via `BillingService`, invoices, and downloadable billing artifacts.
- **Real-time notifications**: PostgreSQL LISTEN/NOTIFY feeds a Server-Sent Events stream surfaced in the UI for activity, billing, and support updates.
- **White-label experience**: Environment-driven branding, theme toggles, and shadcn-style UI primitives lets admins whitelabel everything from brandname to even the upstream providers.
- **Secure access**: JWT auth, impersonation support, SSH WebSocket bridge for VPS consoles, and centrally managed rate limiting.
- **Team collaboration**: Multi-tenant organizations, role-based routing, and auditable activity logs across the stack.
- **Mention Of Brand Name**: Use of consistant brand name definable by `.env` secret.
- **White Label i.e hiding of digitalocean easypanel & linode**: mentions of linode, digitalocean, or easypanel will not be seen to clients.
- **Providers**: offering the applicaiton admin to define the actual provider i.e linode/digitalocean names via the admin dashboard.
- **Easypanel**: If easypanel is not defined in the `/admin#easypanel-config` it will not allow the use of containers or selling containers to clients. 
- **DESIGN**: WHEN DEVELOPING AND SPEAKING ABOUT APPLICAITON SPEAK ABOUT APPLICATION IN A  customer-facing for your cloud hosting business.
 
## Architecture Snapshot

- Frontend (`src/`): React 18, Vite, TypeScript, Tailwind, TanStack Query 5, Zustand, shadcn-inspired components.
- Backend (`api/`): Express.js (ESM) with modular routes, service layer, and a dynamic config proxy wrapping environment reads.
- Database: PostgreSQL migrations in `migrations/` applied through helper scripts; activity logs trigger notifications automatically.
- Infrastructure helpers (`scripts/`): Migration runners, admin utilities, billing testers, SMTP checks, and other operational tooling.

## Repository Layout

- `api/` – Express app, middleware, services, and database helpers.
- `src/` – React SPA with routing, contexts, services, and UI components.
- `migrations/` – Versioned SQL migrations for schema and data changes.
- `scripts/` – Node utilities for migrations, admin seeding, billing, SMTP, and diagnostics.
- `public/` – Static assets served by Vite.
- `repo-docs/` – Feature documentation and API references.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand.
- **Backend**: Node.js 20, Express, TypeScript, PostgreSQL, Redis, Bull queues, Nodemailer, WebSockets (ssh2).
- **Integrations**: PayPal REST SDK, Linode/Akamai, DigitalOcean (optional), SMTP2GO, Docker Engine hooks, optional InfluxDB metrics.

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
   - `EASYPANEL_API_URL` and `EASYPANEL_API_KEY` (optional) for Easypanel Container as a Service integration.
   - `COMPANY_NAME`, `COMPANY_BRAND_NAME`, or `VITE_COMPANY_NAME` to control white-label branding.
   - `SSH_CRED_SECRET` – Auto-generated by the script above for encrypting provider API tokens.
   - `REDIS_URL`, `SMTP2GO_*`, and rate limiting values to match your environment.

   **Container Service Variables (Optional)**:
   ```bash
   # Easypanel Integration
   EASYPANEL_API_URL=https://your-easypanel-instance.com
   EASYPANEL_API_KEY=your-easypanel-api-key
   ```

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

   - Vite runs at `http://localhost:5173`.
   - Express API (with SSE, PayPal webhooks, and SSH bridge) runs at `http://localhost:3001`.

5. **Seed admin access**

   - Default admin from migrations: `admin@skypanelv2.com` / `admin123`.
   - Or create one manually:

     ```bash
     node scripts/create-test-admin.js --email you@example.com --password changeme
     ```

   Rotate admin passwords promptly in real deployments.

## Easypanel Integration (Optional)

SkyPanelV2 supports optional integration with Easypanel for Container as a Service (CaaS) functionality. This allows users to deploy and manage containerized applications alongside VPS services through a subscription-based model with resource quotas and automated billing.

### Quick Start

1. **Configure Environment Variables**
   ```bash
   # Add to .env file
   EASYPANEL_API_URL=https://your-easypanel-instance.com
   EASYPANEL_API_KEY=your-easypanel-api-key
   ```

2. **Restart Application**
   ```bash
   npm run dev  # Development
   npm run pm2:reload  # Production
   ```

3. **Admin Configuration**
   - Navigate to **Admin Panel** → **Platform Settings** → **Easypanel Config**
   - Test connection and save configuration
   - Create container plans in **Plan Management** → **Container Plans**
   - Enable templates in **Plan Management** → **Container Templates**

4. **User Workflow**
   - Users subscribe to container plans
   - Create projects to organize services
   - Deploy from templates, custom Docker images, or databases
   - Monitor resource usage and manage services

### Core Features

#### For Users
- **Subscription Plans**: Choose from admin-defined plans with CPU, memory, storage, and container quotas
- **Project Organization**: Group related services into logical projects
- **Multiple Deployment Options**:
  - **Templates**: One-click deployment of popular applications (WordPress, databases, etc.)
  - **Custom Apps**: Deploy from Docker images or Git repositories
  - **Managed Databases**: PostgreSQL, MySQL, MongoDB, Redis with automated setup
- **Resource Management**: Real-time quota monitoring with visual usage indicators
- **Service Control**: Start, stop, restart, and configure containerized services
- **Log Access**: View and search container logs for troubleshooting
- **Environment Management**: Update application configuration through environment variables

#### For Administrators
- **Plan Management**: Create subscription tiers with flexible resource quotas and pricing
- **Template Control**: Enable/disable application templates and organize by category
- **Platform Monitoring**: View usage statistics across all organizations
- **Billing Automation**: Integrated monthly billing with wallet deduction and suspension handling
- **Configuration Management**: Secure API credential storage with connection testing

### Architecture Integration

The Easypanel integration follows SkyPanelV2's established patterns:

- **Database Schema**: New tables for plans, subscriptions, projects, services, and billing cycles
- **Service Layer**: Dedicated services for Easypanel API communication, quota management, and billing
- **API Routes**: RESTful endpoints under `/api/containers` with proper authentication
- **Frontend Components**: React components for dashboard, deployment wizards, and management interfaces
- **Billing System**: Extends existing billing infrastructure with container-specific cycles
- **Activity Logging**: All container operations logged for audit and notification purposes

### Security & Compliance

- **API Key Encryption**: Easypanel credentials encrypted using the same system as VPS provider keys
- **Resource Isolation**: Each organization's containers isolated within separate Easypanel projects
- **Quota Enforcement**: Pre-deployment validation prevents resource abuse
- **Access Control**: Role-based permissions with organization-level resource access
- **Audit Trail**: Comprehensive logging of all container operations and billing events

### Requirements

- **Easypanel Instance**: Self-hosted or managed Easypanel installation
- **API Access**: Valid API key with project and service management permissions
- **Network Connectivity**: SkyPanelV2 backend must reach Easypanel API endpoint
- **Resource Planning**: Adequate Easypanel infrastructure to support planned container workloads

### Documentation

- **[Admin Configuration Guide](./repo-docs/EASYPANEL_ADMIN_GUIDE.md)**: Complete setup and management instructions
- **[User Deployment Guide](./repo-docs/EASYPANEL_USER_GUIDE.md)**: End-user container deployment and management
- **[Container API Reference](./repo-docs/CONTAINER_API_REFERENCE.md)**: Complete API endpoint documentation

## Useful npm Scripts

- `npm run dev` – Start Vite + Nodemon concurrently.
- `npm run client:dev` / `npm run server:dev` – Run frontend or backend individually.
- `npm run kill-ports` – Free ports `3001` and `5173` before restarting dev servers.
- `npm run build` – Type-check and build API + frontend assets.
- `npm run start` – Launch production Express server and Vite preview.
- `npm run pm2:start` / `npm run pm2:reload` / `npm run pm2:stop` – Manage PM2-based deployments.
- `npm run test` / `npm run test:watch` – Run Vitest suites.
- `npm run lint` / `npm run check` – Run ESLint and TypeScript diagnostics.

### Script Utilities

#### Database & Migration Scripts
- `node scripts/generate-ssh-secret.js` – Generate and add `SSH_CRED_SECRET` to `.env` for provider token encryption.
- `node scripts/run-migration.js` – Apply pending migrations sequentially.
- `node scripts/apply-stackscript-migration.js <file>` – Execute stackscript-specific SQL helpers.
- `node scripts/test-connection.js` – Verify database connectivity.

#### Billing & Payment Scripts
- `node scripts/test-hourly-billing.js` – Dry-run the hourly billing workflow.
- `node scripts/process-container-billing.js` – Manually process container billing cycles.
- `node scripts/test-container-billing.js` – Test container billing automation with mock data.

#### Communication & Admin Scripts
- `node scripts/test-smtp.js` – Send an SMTP2GO smoke test.
- `node scripts/promote-to-admin.js --email user@example.com` – Elevate an existing account.
- `node scripts/update-admin-password.js --email admin@example.com --password newpass` – Rotate admin passwords.

## Development Notes

- Express boots from `api/server.ts`, wires the SSH WebSocket bridge, and schedules `BillingService.runHourlyBilling()` and `ContainerBillingService.processDueBillingCycles()`.
- Database access should flow through `api/lib/database.ts` (`query`, `transaction`) to keep billing and wallet mutations atomic.
- Use `logActivity` in `api/services/activityLogger.ts` to persist auditable events and emit notifications.
- Rate limiting lives in `api/middleware/rateLimiting.ts`; reuse `smartRateLimit` or `createCustomRateLimiter` for new routes.
- Frontend API calls should go through `src/lib/api.ts` or service wrappers so environment-aware URLs and auth headers stay consistent.
- Update `.env` branding keys and restart dev servers to refresh marketing copy and theming tokens.

## Documentation

### API Documentation

- **[API Reference](./repo-docs/API_REFERENCE.md)** - Complete API endpoint reference
- **[Container API Reference](./repo-docs/CONTAINER_API_REFERENCE.md)** - Easypanel CaaS API endpoints
- **[Flexible Backup Pricing API](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md)** - Backup configuration and pricing endpoints
- **[Multi-Provider VPS](./repo-docs/MULTI_PROVIDER_VPS.md)** - Multi-provider VPS management

### Configuration Documentation

- **[Environment Variables](./repo-docs/ENVIRONMENT_VARIABLES.md)** - Complete environment configuration reference

### Feature Documentation

- **[Easypanel Admin Guide](./repo-docs/EASYPANEL_ADMIN_GUIDE.md)** - Container service configuration and management
- **[Easypanel User Guide](./repo-docs/EASYPANEL_USER_GUIDE.md)** - Container deployment and usage guide

Additional documentation for specific features is available in the `repo-docs/` directory.

## Testing & Quality

- Vitest powers unit and integration specs (see `api/middleware/__tests__` for examples with Supertest).
- React Testing Library covers UI flows where present.
- `npm run test:watch` keeps feedback tight during development; CI runs `npm run test` + `npm run lint` + `npm run check`.

## Deployment

1. `npm run build`
2. Provide production `.env` with hardened secrets and `NODE_ENV=production`.
3. Run `npm run start` (or `npm run pm2:start`) on the target host.

Production checklist:

- Strong `JWT_SECRET`, `ENCRYPTION_KEY`, PayPal live credentials.
- `TRUST_PROXY` tuned to match load balancer hops.
- Redis secured (password and TLS when available).
- PostgreSQL SSL for managed providers.
- Optional InfluxDB target configured for long-term metrics.

## Troubleshooting

- **API unreachable**: Confirm the backend is running on `PORT` from `.env` and migrations completed.
- **Linode regions empty**: Validate `LINODE_API_TOKEN` and ensure provider settings are populated via the admin panel.
- **Notifications missing**: Ensure migrations `008_notifications.sql` and `009_fix_notification_filtering.sql` ran successfully.
- **PayPal checkout issues**: Verify frontend SDK loads and server credentials match sandbox or live mode.
- **SSH console fails**: Ensure JWT tokens include console permissions and the SSH bridge is reachable at `/api/vps/:id/ssh`.

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
