# SkyPanelV2 Agent Guide

## Project Overview

SkyPanelV2 is an open-source cloud service reseller billing panel that provides a white-label control plane for cloud hosting businesses. It enables service providers to offer VPS and container services through a unified interface with integrated billing and customer management.

## Technology Stack

### Frontend
- **React 18** with TypeScript and Vite
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query v5** for server state management
- **Zustand** for client-side state management
- **React Router v7** for navigation
- **Framer Motion** for animations

### Backend
- **Node.js 20+** with Express.js (ESM mode)
- **TypeScript** for type safety
- **PostgreSQL** for primary database
- **Redis** for caching and sessions
- **Bull** queues for background jobs

### Key Integrations
- **PayPal REST SDK** for payments
- **Linode/Akamai API** and **DigitalOcean API** for VPS
- **Easypanel API** for container services
- **ssh2** for WebSocket SSH console access
- **Nodemailer** with SMTP2GO for emails
- **JWT** authentication with **bcryptjs** hashing

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 12+
- Redis 6+

### Initial Setup
```bash
# Clone and install dependencies
npm install

# Environment configuration
cp .env.example .env
# Edit .env with your configuration

# Database setup
node scripts/run-migration.js

# Generate SSH encryption keys
node scripts/generate-ssh-secret.js

# Create admin user
node scripts/create-test-admin.js
```

## Development Commands

### Core Development
```bash
# Start both frontend and backend
npm run dev

# Frontend only (Vite dev server on port 5173)
npm run client:dev

# Backend only (Nodemon on port 3001)
npm run server:dev

# Free development ports
npm run kill-ports
```

### Building & Testing
```bash
# Full build (TypeScript check + Vite build)
npm run build

# Run test suite
npm run test

# Watch mode for tests
npm run test:watch

# ESLint validation
npm run lint

# TypeScript type checking
npm run check
```

### Production
```bash
# Production server + preview
npm run start

# PM2 process management
npm run pm2:start
npm run pm2:reload
npm run pm2:stop
```

## Database Management

### Migration System
```bash
# Apply pending migrations
node scripts/run-migration.js

# Apply specific migration
node scripts/apply-single-migration.js

# Reset database (development only)
node scripts/reset-database.js

# Test database connection
node scripts/test-connection.js
```

### Migration Files
- Located in `migrations/` directory
- Sequential naming: `001_initial_schema.sql`, `002_add_feature.sql`
- Automatically tracked in database

## Utility Scripts

### User Management
```bash
# Create test admin user
node scripts/create-test-admin.js

# Promote user to admin
node scripts/promote-to-admin.js

# Update admin password
node scripts/update-admin-password.js

# Check admin users
node scripts/check-admin-users.js

# Debug admin login issues
node scripts/debug-admin-login.js
```

### System Operations
```bash
# Generate SSH encryption secret
node scripts/generate-ssh-secret.js

# Test SMTP configuration
node scripts/test-smtp.js

# Test SSH key synchronization
node scripts/test-ssh-key-sync.js

# Check platform settings
node scripts/check-platform-settings.js

# Check contact methods status
node scripts/check-contact-methods-status.js
```

### Billing & Provider Management
```bash
# Process container billing
node scripts/process-container-billing.js

# Test hourly billing
node scripts/test-hourly-billing.js

# Test container billing
node scripts/test-container-billing.js

# Migrate VPS provider data
node scripts/migrate-vps-provider-data.js

# Migrate backup pricing data
node scripts/migrate-backup-pricing-data.js

# Fix provider encryption
node scripts/fix-provider-encryption.js
```

### Integration Testing
```bash
# Test Easypanel connection
node scripts/test-easypanel-connection.js

# Test database connection
node scripts/test-connection.js
```

## API Structure

### Authentication Endpoints
```
POST /api/auth/login          # User login
POST /api/auth/register       # User registration
POST /api/auth/logout         # User logout
GET  /api/auth/me            # Get current user
POST /api/auth/refresh       # Refresh JWT token
```

### VPS Management
```
GET    /api/vps              # List user VPS instances
POST   /api/vps              # Create new VPS
GET    /api/vps/:id          # Get VPS details
PUT    /api/vps/:id          # Update VPS
DELETE /api/vps/:id          # Delete VPS
POST   /api/vps/:id/power    # Power operations (start/stop/reboot)
GET    /api/vps/:id/console  # WebSocket SSH console access
```

### Container Services (Easypanel)
```
GET    /api/containers       # List containers
POST   /api/containers       # Create container
GET    /api/containers/:id   # Get container details
PUT    /api/containers/:id   # Update container
DELETE /api/containers/:id   # Delete container
```

### Billing & Wallets
```
GET    /api/billing/wallet   # Get wallet balance
POST   /api/billing/topup    # Add funds via PayPal
GET    /api/billing/invoices # List invoices
GET    /api/billing/usage    # Usage statistics
```

### Admin Endpoints
```
GET    /api/admin/users      # List all users
PUT    /api/admin/users/:id  # Update user
GET    /api/admin/settings   # Platform settings
PUT    /api/admin/settings   # Update settings
GET    /api/admin/providers  # VPS provider configuration
```

## Environment Variables

### Core Configuration
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/skypanel
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Provider APIs
```env
# Linode/Akamai
LINODE_API_TOKEN=your-linode-token

# DigitalOcean
DIGITALOCEAN_API_TOKEN=your-do-token

# Easypanel (Optional)
EASYPANEL_API_URL=https://your-easypanel.com
EASYPANEL_API_TOKEN=your-easypanel-token
```

### Payment Integration
```env
# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret
PAYPAL_MODE=sandbox  # or 'live' for production
```

### Email Configuration
```env
# SMTP2GO
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@yourdomain.com
```

### SSH & Security
```env
# SSH Console Access
SSH_ENCRYPTION_KEY=generated-by-script
SSH_ENCRYPTION_IV=generated-by-script

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Project Structure

### Backend (`api/`)
```
api/
├── app.ts                  # Express app setup
├── server.ts               # Server startup
├── index.ts                # Vercel entry point
├── config/                 # Configuration management
├── lib/                    # Database & utilities
├── middleware/             # Auth, rate limiting, CORS
├── routes/                 # API endpoints
└── services/               # Business logic & integrations
```

### Frontend (`src/`)
```
src/
├── App.tsx                 # Main app & routing
├── main.tsx                # React entry point
├── components/             # Reusable UI components
├── contexts/               # React contexts (auth, theme)
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities & API client
├── pages/                  # Route components
├── services/               # API service wrappers
├── theme/                  # Theme configuration
└── types/                  # TypeScript definitions
```

## Key Features

### Multi-Provider VPS Management
- Unified interface for Linode and DigitalOcean
- Provider abstraction with normalized APIs
- Real-time status monitoring
- WebSocket SSH console access

### Container as a Service (CaaS)
- Optional Easypanel integration
- Subscription-based container plans
- Application deployment and management

### Billing System
- PayPal prepaid wallet system
- Hourly usage reconciliation
- Automated invoice generation
- Usage tracking and reporting

### White-Label Branding
- Environment-driven customization
- Complete platform rebranding capability
- Custom domain support

### Real-Time Notifications
- PostgreSQL LISTEN/NOTIFY integration
- Server-Sent Events for live updates
- Real-time billing and status updates

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (user/admin)
- Secure password hashing with bcryptjs
- Session management with Redis

### API Security
- Rate limiting middleware
- CORS configuration
- Input validation and sanitization
- SQL injection prevention

### Infrastructure Security
- Encrypted SSH key storage
- Secure provider API token management
- Environment-based configuration
- Production security headers

## Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
vercel --prod

# Environment variables configured in Vercel dashboard
```

### PM2 (VPS Deployment)
```bash
# Start with PM2
npm run pm2:start

# Reload processes
npm run pm2:reload

# Monitor processes
pm2 monit
```

### Docker (Alternative)
```dockerfile
# Dockerfile example for containerized deployment
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Monitoring & Debugging

### Logs
- Application logs via console output
- PM2 logs: `pm2 logs`
- Error tracking in production

### Health Checks
```bash
# Test database connection
node scripts/test-connection.js

# Test external integrations
node scripts/test-easypanel-connection.js
node scripts/test-smtp.js
```

### Performance Monitoring
- Redis for caching frequently accessed data
- Database query optimization
- API response time monitoring

## Common Issues & Solutions

### Database Connection Issues
```bash
# Check connection
node scripts/test-connection.js

# Reset database (development)
node scripts/reset-database.js
```

### Migration Problems
```bash
# Apply specific migration
node scripts/apply-single-migration.js

# Clean migration state
node scripts/clean-migration.js
```

### Provider API Issues
- Check API token validity
- Verify rate limiting compliance
- Test provider connectivity

### Email Delivery Problems
```bash
# Test SMTP configuration
node scripts/test-smtp.js
```

## Development Best Practices

### Code Style
- ESM modules throughout (`.js` extensions in imports)
- TypeScript strict mode disabled for flexibility
- Functional React components with hooks
- Async/await preferred over promises
- Proper error handling with try/catch

### Testing
- Vitest for unit tests
- Supertest for API integration tests
- Test coverage for critical business logic

### Git Workflow
- Feature branches for new development
- Pull requests for code review
- Automated testing in CI/CD pipeline

## Support & Documentation

### Additional Documentation
- `repo-docs/`: Feature guides and API references
- `README.md`: Quick start guide
- Environment variable documentation in `repo-docs/ENVIRONMENT_VARIABLES.md`

### Community & Support
- GitHub Issues for bug reports
- Discussions for feature requests
- Documentation contributions welcome

This guide provides comprehensive information for developers, operators, and administrators working with SkyPanelV2. Keep it updated as the project evolves and new features are added.