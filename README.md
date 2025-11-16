# SkyPanelV2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

SkyPanelV2 is an open-source cloud service billing panel that provides a white-label control plane for cloud hosting businesses. It enables service providers to offer VPS hosting services through a unified interface with integrated billing, customer management, and comprehensive administrative tools.

THIS IS NOT A RESELLER PANEL IN ANY SORTS

## Feature Highlights

> **Latest Update**: Major admin user management improvements with enhanced organization management system featuring comprehensive modal-based UI, advanced user search capabilities, robust member management with role-based permissions, and improved error handling throughout the admin interface. Includes a completely rewritten validation system with real-time form validation, pattern matching, and custom validation rules. Enhanced testing suite with comprehensive unit tests for all modal components and API integrations. See [Organization Management API Documentation](./api-docs/admin/organizations.md) for details.

### Core VPS Management
- **Managed Linode support**: Unified interface for Linode with provider abstraction and normalized APIs
- **Flexible backup pricing**: Provider-specific backup options with admin-configurable upcharges and transparent pricing
- **SSH console access**: WebSocket-based SSH bridge for direct VPS terminal access
- **Real-time monitoring**: Live status updates and resource monitoring across all instances

### Billing & Payments
- **PayPal integration**: Prepaid wallet system with automated hourly billing reconciliation
- **Invoice management**: Automated invoice generation with downloadable PDF artifacts
- **Usage tracking**: Detailed resource usage monitoring and cost breakdown
- **Multi-currency support**: Flexible pricing with currency formatting

### Administration & Management
- **Enhanced admin panel**: Comprehensive user management with improved error handling, provider configuration, and system monitoring
- **Advanced organization management**: Complete CRUD operations with enhanced modal-based UI featuring:
  - **Organization creation**: Real-time user search with debounced queries, automatic slug generation, owner assignment with validation, and comprehensive form validation
  - **Organization editing**: Pre-populated forms with change detection, validation for name/slug uniqueness, and owner information display with transfer guidance
  - **Safe deletion**: Confirmation dialogs requiring exact name input, resource impact warnings showing member count and data cleanup, and cascading deletion protection
  - **Member management**: Add, edit, and remove organization members with comprehensive role-based permissions including:
    - **Advanced user search**: Real-time search with membership status indicators and duplicate prevention
    - **Role management**: Complete role assignment system with ownership transfer capabilities
    - **Safe member removal**: Protection against removing owners with proper validation and warnings
    - **Ownership transfers**: Secure ownership transfer with admin-to-admin confirmation dialogs
- **Enhanced user detail management**: Improved AdminUserDetail component with:
  - **Robust error handling**: Comprehensive error states for network issues, invalid user IDs, and access denied scenarios
  - **Reliable data loading**: Retry mechanisms, proper loading states, and graceful fallbacks
  - **Enhanced user operations**: Improved edit, impersonation, and deletion workflows with better validation
  - **Resource impact warnings**: Detailed deletion confirmations showing VPS instances, wallet balances, and organization memberships
- **Role-based access**: Admin and user roles with enhanced impersonation capabilities including admin-to-admin confirmation
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
- **Comprehensive validation system**: Unified form validation with real-time feedback, pattern matching for emails/UUIDs/slugs, SSH key format validation, marketplace app region compatibility checking, and custom validation rules
- **Database migrations**: Versioned schema management with rollback support
- **Enhanced testing suite**: Comprehensive unit tests with Vitest, React Testing Library for component testing, and Supertest for API integration tests
- **Test coverage**: Complete test coverage for admin modal components including form validation, API integration, error handling, and user interaction flows
- **Development tools**: ESLint, TypeScript strict checking, automated formatting, and test-driven development workflow

## Available Pages & Features

### Customer Portal
- **Dashboard**: Overview of VPS instances, billing summary, and recent activity
- **VPS Management**: Create, manage, and monitor VPS instances with real-time status
- **SSH Console**: Browser-based SSH access with full terminal functionality
- **SSH Keys**: Manage SSH public keys for secure VPS access with comprehensive format validation supporting RSA, Ed25519, ECDSA, and DSS key types
- **Billing**: Wallet management, PayPal top-ups, invoice history, and usage tracking
- **Support**: Ticket system with real-time messaging and file attachments
- **Settings**: Account management, preferences, and security settings
- **Activity**: Comprehensive activity log with filtering and search

### Administrative Interface
- **Admin Dashboard**: System overview with key metrics and quick actions
- **Enhanced User Management**: Comprehensive user accounts management with improved error handling, roles, and enhanced impersonation capabilities including:
  - **Robust user detail views**: Enhanced AdminUserDetail component with comprehensive error handling for invalid user IDs, network issues, and access denied scenarios
  - **Reliable data loading**: Retry mechanisms, proper loading states, and graceful fallbacks for all user data
  - **Enhanced user operations**: Improved edit, impersonation, and deletion workflows with better validation and user feedback
  - **Resource impact warnings**: Detailed deletion confirmations showing VPS instances, wallet balances, organization memberships, and support tickets
  - **Admin-to-admin impersonation**: Enhanced confirmation dialogs for admin-to-admin impersonation with security warnings
- **Advanced Organization Management**: Complete CRUD operations with enhanced modal-based UI featuring:
  - **Organization Creation Modal**: Real-time user search with debounced queries, automatic slug generation from organization names, owner assignment with validation, and comprehensive form validation
  - **Organization Edit Modal**: Pre-populated forms with change detection, validation for name/slug uniqueness, and owner information display with transfer guidance
  - **Organization Delete Dialog**: Safe deletion with confirmation requiring exact name input, resource impact warnings showing member count and data cleanup, and cascading deletion protection
  - **Member Add Modal**: Advanced user search with membership status indicators, role selection with ownership transfer warnings, and validation to prevent duplicate memberships
  - **Member Edit Modal**: Role management with ownership transfer capabilities, validation for role change restrictions, and comprehensive warnings for ownership changes
  - **Member Remove Dialog**: Safe member removal with validation to prevent removing owners, confirmation dialogs with resource cleanup warnings, and proper error handling
  - **Advanced user search system**: Real-time user search with organization membership filtering, pagination support, and membership status indicators
- **VPS Plans**: Configure pricing, markups, and available instance types
- **Provider Management**: Configure Linode APIs and settings
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
- **Infrastructure (`scripts/`)**: Migration runners, admin utilities, organization management, billing automation, SMTP testing, and operational tooling.

## Repository Layout

- `api/` – Express app, middleware, services, and database helpers.
- `src/` – React SPA with routing, contexts, services, and UI components.
  - `src/lib/validation.ts` – Comprehensive form validation system with schemas for admin operations
  - `src/components/admin/` – Enhanced admin interface components with modal-based organization management
  - `src/components/admin/__tests__/` – Comprehensive test suite for admin components with React Testing Library
- `migrations/` – Versioned SQL migrations for schema and data changes.
- `scripts/` – Node utilities for migrations, admin seeding, billing, SMTP, and diagnostics.
- `public/` – Static assets served by Vite.
- `repo-docs/` – Feature documentation and API references.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router v7, TanStack Query v5, Zustand, shadcn/ui components, comprehensive form validation system.
- **Backend**: Node.js 20+, Express.js (ESM), TypeScript, PostgreSQL, Redis, Bull queues, Nodemailer, WebSockets (ssh2).
- **Integrations**: PayPal REST SDK, Linode/Akamai API, SMTP2GO, optional InfluxDB metrics.

## Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL 12+
- Redis 6+ (required for PaaS Worker queue processing)

- Optional: InfluxDB 2.x for metrics collection
- Optional: Docker and Docker Compose for PaaS infrastructure deployment

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
   - `LINODE_API_TOKEN` for provider APIs.

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

   For full PaaS development (API + Server + Worker):
   ```bash
   npm run dev:all  # Runs all three components: Client, API, and Worker
   ```

   For individual servers:
   ```bash
   npm run client:dev  # Frontend only
   npm run server:dev  # Backend only
   npm run dev:worker  # PaaS Worker only
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
- `npm run dev:all` – Start all three components: Client, API, and Worker (for PaaS development).
- `npm run dev-up` – Kill ports and start development servers (convenience script).
- `npm run client:dev` – Run frontend only (Vite dev server on port 5173).
- `npm run server:dev` – Run backend only (Nodemon on port 3001).
- `npm run dev:worker` – Run PaaS worker only (background job processing).
- `npm run worker` – Run PaaS worker in production mode.
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

### PaaS Infrastructure
- `npm run paas:init` – Initialize PaaS infrastructure with Docker Swarm integration.
- Note: PaaS worker component must be running (`npm run dev:worker` or included via PM2) for PaaS deployments to function.

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
- **Worker component**: Background job processor in `api/worker/index.ts` handles PaaS build/deploy queues using Bull and Redis
- **Database access**: Use `api/lib/database.ts` (`query`, `transaction`) for atomic operations, especially billing
- **Enhanced organization management**: Complete REST API with CRUD operations featuring:
  - **Comprehensive member management**: Role assignments, ownership transfers, and member lifecycle management
  - **Advanced user search**: Organization membership filtering, pagination support, and real-time query capabilities
  - **Safe cascading deletion**: Resource validation, impact warnings, and proper cleanup procedures
  - **Robust validation**: Server-side validation for all organization operations with proper error responses
- **Enhanced user management API**: Improved user detail endpoints with comprehensive error handling, validation, and resource impact analysis
- **Activity logging**: Use `logActivity` in `api/services/activityLogger.ts` for auditable events and notifications
- **Rate limiting**: Configured in `api/middleware/rateLimiting.ts` with tiered limits for different user types

### Frontend Development
- **API communication**: Route calls through `src/lib/api.ts` for consistent auth headers and error handling
- **State management**: TanStack Query for server state, Zustand for client state, React Context for auth/theme
- **Component library**: shadcn/ui components with Tailwind CSS for consistent styling
- **Form validation**: Comprehensive validation system in `src/lib/validation.ts` with real-time feedback, pattern matching for emails/UUIDs/slugs, SSH key format validation with support for multiple key types (RSA, Ed25519, ECDSA), marketplace app region compatibility checking, and custom validation rules for admin forms
- **Enhanced admin components**: Comprehensive admin interface improvements including:
  - **Enhanced AdminUserDetail**: Robust error handling for invalid user IDs, network issues, and access denied scenarios with retry mechanisms and proper loading states
  - **Advanced modal system**: Comprehensive organization management modals including:
    - `OrganizationCreateModal`: Real-time user search with debounced queries, automatic slug generation from names, owner assignment with validation, and comprehensive form validation
    - `OrganizationEditModal`: Pre-populated forms with change detection, validation for uniqueness checks, and owner information display with transfer guidance
    - `OrganizationDeleteDialog`: Safe deletion with exact name confirmation, resource impact warnings showing affected resources, and cascading deletion protection
    - `MemberAddModal`: Advanced user search with membership status indicators, role selection with ownership transfer warnings, and duplicate membership prevention
    - `MemberEditModal`: Role management with ownership transfer capabilities, validation for role restrictions, and comprehensive warnings for ownership changes
    - `MemberRemoveDialog`: Safe member removal with owner protection validation, confirmation dialogs with resource cleanup warnings, and proper error handling
  - **Enhanced OrganizationManagement**: Unified interface with collapsible organization views, real-time member management, and comprehensive error handling
- **Testing**: Comprehensive test coverage for all admin components with React Testing Library, including form validation, API integration, and error handling scenarios
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

- **[API Reference](./api-docs/README.md)** - Complete API endpoint reference
- **[Admin API Documentation](./api-docs/admin/README.md)** - Administrative endpoints and organization management
- **[Organization Management API](./api-docs/admin/organizations.md)** - Enhanced organization CRUD operations with comprehensive validation, error handling, and resource impact analysis
- **[Organization Member Management](./api-docs/admin/organization-members.md)** - Advanced member management with role assignments, ownership transfers, and safe member removal
- **[User Search API](./api-docs/admin/user-search.md)** - Enhanced user search with organization filtering, membership status indicators, and real-time query capabilities
- **[Admin User Management](./api-docs/admin/user-detail.md)** - Enhanced user detail management with robust error handling and comprehensive resource impact analysis
- **[Flexible Backup Pricing API](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md)** - Backup configuration and pricing endpoints
- **[Multi-Provider VPS](./repo-docs/MULTI_PROVIDER_VPS.md)** - Multi-provider VPS management

### Configuration Documentation

- **[Environment Variables](./repo-docs/ENVIRONMENT_VARIABLES.md)** - Complete environment configuration reference

Additional documentation for specific features is available in the `repo-docs/` directory.

## Testing & Quality

### Test Suite Overview
- **Unit Tests**: Comprehensive Vitest-powered unit tests for all components and utilities
- **Component Tests**: React Testing Library tests for UI components with user interaction simulation
- **API Integration Tests**: Supertest-based tests for backend endpoints (see `api/middleware/__tests__`)
- **Admin Component Testing**: Complete test coverage for admin modal components including:
  - `OrganizationCreateModal`: Form validation, user search, API integration, and error handling
  - `OrganizationEditModal`: Data loading, form updates, and validation scenarios
  - `MemberAddModal`: User search functionality, role selection, and duplicate prevention
  - All modal components include comprehensive error scenario testing and edge case coverage

### Testing Commands
- `npm run test` – Run complete test suite once
- `npm run test:watch` – Continuous testing during development with file watching
- `npm run lint` – ESLint validation for code quality
- `npm run check` – TypeScript type checking without compilation

### Test Coverage Areas
- **Form Validation**: Real-time validation, error states, and user feedback
- **API Integration**: Mock API responses, error handling, and loading states
- **User Interactions**: Click events, form submissions, and modal state management
- **Error Scenarios**: Network failures, validation errors, and edge cases
- **Authentication**: Mock auth contexts and role-based access testing

### CI/CD Integration
Continuous integration runs `npm run test` + `npm run lint` + `npm run check` for comprehensive quality assurance.

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
- **Form validation errors**: Check validation schemas in `src/lib/validation.ts`, ensure proper field validation rules, and verify real-time validation feedback is working
- **SSH key validation issues**: Ensure SSH keys follow proper format (ssh-rsa, ssh-ed25519, etc.), check key length requirements (100-8192 characters), and verify key content is base64 encoded
- **Admin user detail errors**: Check for proper error handling in AdminUserDetail component, verify user ID format validation, and ensure proper retry mechanisms for failed API calls
- **Organization API errors**: Ensure admin role and proper authentication for organization management endpoints
- **User search not working**: Verify admin authentication and check that user search API endpoint is accessible with proper query parameters and organization filtering
- **Modal validation issues**: Check form validation logic, ensure proper error state management in organization modals, and verify real-time validation feedback
- **Member management errors**: Ensure proper role validation, ownership transfer restrictions, and member removal protection for organization owners
- **Organization deletion blocked**: Verify confirmation text matches exactly and check for proper resource cleanup warnings
- **Impersonation failures**: Check admin-to-admin impersonation confirmation dialogs and ensure proper error handling for impersonation attempts
- **User deletion issues**: Verify resource impact warnings are displayed correctly and confirmation dialogs show proper deletion consequences
- **Test failures**: Run `npm run test` to identify failing tests, check mock configurations in test files, and ensure proper test environment setup
- **Component test issues**: Verify React Testing Library setup, check mock implementations for dependencies like `sonner` and validation libraries, and ensure proper auth context mocking

### Provider Integration Issues
- **Linode regions empty**: Validate `LINODE_API_TOKEN` and configure provider settings in admin panel
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
