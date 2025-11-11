# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkyPanelV2 is an open-source cloud service reseller billing panel with multi-provider support and white-label branding. It serves as a control plane for cloud service providers offering VPS services with comprehensive billing, user management, and real-time monitoring capabilities.

### Tech Stack

**Frontend (`src/`)**:
- React 18 with TypeScript and Vite
- Tailwind CSS with shadcn-inspired components (Radix UI primitives)
- TanStack Query 5 for server state management
- Zustand for client state management
- React Router for navigation
- React Hook Form with Zod validation

**Backend (`api/`)**:
- Node.js 20 with Express.js (ESM modules)
- TypeScript with tsx runtime compilation
- PostgreSQL with versioned migrations
- Redis for caching and Bull queues
- JWT authentication with role-based access control
- WebSocket support for SSH bridge (xterm.js)

**Integrations**:
- PayPal REST SDK for wallet payments
- Multi-provider support: Linode and DigitalOcean APIs
- SMTP2GO for email communications
- Docker Engine hooks for container management

## Development Commands

### Full-Stack Development
```bash
npm run dev              # Start both frontend (5173) and backend (3001)
npm run client:dev       # Frontend only (Vite dev server)
npm run server:dev       # Backend only (Nodemon with tsx)
npm run kill-ports       # Clear ports 3001/5173 before restart
npm run dev-up           # Start both frontend (5173) and backend (3001) concurrently
```

### Build & Production
```bash
npm run build           # TypeScript check + Vite production build
npm run start           # Production server (Express + Vite preview)
npm run preview         # Vite preview server only
```

### Production Deployment (PM2)
```bash
npm run pm2:start       # Build + start PM2 processes
npm run pm2:reload      # Reload PM2 processes
npm run pm2:stop        # Stop PM2 processes
npm run pm2:list        # List PM2 process status
```

### Code Quality & Testing
```bash
npm run lint            # ESLint with TypeScript and React rules
npm run check           # TypeScript type checking (noEmit)
npm run test            # Vitest test runner
npm run test:watch      # Vitest watch mode
```

### Database Operations
```bash
npm run db:fresh        # Reset database + run all migrations
npm run db:reset        # Reset database with confirmation prompt
npm run db:reset:confirm # Reset database without confirmation
node scripts/run-migration.js     # Apply pending migrations
node scripts/test-connection.js   # Test database connectivity
```

### Admin & User Management
```bash
node scripts/seed-admin.js               # Create default admin user
node scripts/create-test-admin.js --email admin@example.com --password admin123
node scripts/promote-to-admin.js --email user@example.com
node scripts/update-admin-password.js --email admin@example.com --password newpassword123
```

## Key Architecture Patterns

### Provider Abstraction Layer
The system uses a sophisticated factory pattern to support multiple cloud providers (Linode, DigitalOcean) with a unified interface:

```typescript
// Provider service usage
import { getProviderService } from 'api/services/providerService.js';

const provider = await getProviderService(providerId);
const instances = await provider.listInstances();
```

**Key Components**:
- `IProviderService` interface defines common contract
- `BaseProviderService` abstract class with shared functionality
- `ProviderFactory` for creating provider instances
- `ProviderResourceCache` for intelligent caching (1-6 hour TTLs)
- Error normalization across providers (`errorNormalizer.ts`)

**Provider Cache Strategy**:
- Plans: 6-hour TTL
- Images: 1-hour TTL
- Regions: 24-hour TTL
- Reduces API calls by 80-90%

### Authentication & Authorization System
Multi-tier security with JWT tokens and role-based access:

```typescript
// Authentication middleware
import { authenticateToken, requireRole, requireOrganization } from 'api/middleware/auth.js';

// Route protection examples
router.get('/admin/users', authenticateToken, requireRole('admin'), getUsers);
router.get('/vps/:id', authenticateToken, requireOrganization, getVPS);
```

**Security Features**:
- JWT with refresh tokens (7-day expiration)
- Role-based middleware (`admin`, `user`, `readonly`)
- Organization-based data isolation
- Password hashing with bcrypt (12 rounds)
- Admin impersonation with special JWT tokens

### Real-Time Notification System
PostgreSQL LISTEN/NOTIFY → Server-Sent Events for real-time updates:

```typescript
// Frontend SSE connection
const eventSource = new EventSource('/api/notifications/stream?token=...');
eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Handle activity, billing, system notifications
};
```

**Features**:
- 30-second heartbeat for connection monitoring
- Automatic reconnection with exponential backoff (max 10 attempts)
- Event types: `auth.login`, `vps.create`, `billing.charge`, etc.
- Activity logging with automatic notification triggers

### Billing Service Architecture
Sophisticated hourly billing system with PayPal wallet integration:

```typescript
// Billing automation runs hourly
class BillingService {
  async processHourlyBilling() {
    // 1. Calculate charges for active VPS instances
    // 2. Charge organizational wallets via PayPal
    // 3. Handle insufficient balance gracefully
    // 4. Generate billing records and notifications
  }
}
```

**Key Features**:
- Millisecond-level billing accuracy with hourly rounding
- Backup pricing: Daily (1.5x multiplier), Weekly (standard)
- VPS instances continue billing even when stopped
- Insufficient balance handling with service continuation
- Comprehensive billing history and invoice generation

## Database Schema & Migration System

### Migration Management
```bash
# Development workflow
npm run db:fresh                    # Fresh start with all migrations
node scripts/run-migration.js       # Apply pending migrations
node scripts/apply-single-migration.js migrations/001_initial_schema.sql
```

**Migration Patterns**:
- SQL files in `/migrations/` directory with alphabetical execution order
- Atomic operations with transaction-based rollbacks
- Schema validation post-migration
- Data migration scripts for complex schema changes

### Database Helpers
Use the centralized database helper for consistent operations:

```typescript
import { query, transaction } from 'api/lib/database.js';

// Simple queries
const result = await query('SELECT * FROM users WHERE organization_id = $1', [orgId]);

// Transactions for complex operations
await transaction(async (client) => {
  await client.query('INSERT INTO users (...) VALUES (...)', [userData]);
  await client.query('INSERT INTO wallets (...) VALUES (...)', [walletData]);
});
```

### Schema Patterns
- **Multi-tenancy**: All tables reference `organization_id` for data isolation
- **Activity Logging**: Comprehensive `activity_logs` table with automatic triggers
- **Encrypted Storage**: Provider API tokens encrypted with `SSH_CRED_SECRET`
- **Soft Deletes**: Key tables use `deleted_at` timestamps for audit trails

## Frontend Architecture & Patterns

### State Management Strategy
```typescript
// TanStack Query for server state
import { useQuery, useMutation } from '@tanstack/react-query';

const { data: instances, isLoading } = useQuery({
  queryKey: ['vps-instances'],
  queryFn: () => apiClient.get('/vps/instances'),
  staleTime: 30 * 1000, // 30 seconds
});

// Zustand for client state
import { useAuthStore } from '@/stores/authStore';

const { user, login, logout } = useAuthStore();
```

**State Hierarchy**:
1. **Server State**: TanStack Query (caching, background refetching)
2. **Client State**: Zustand stores for complex UI state
3. **Local State**: React Context for auth, theme, impersonation
4. **Form State**: React Hook Form with Zod validation

### Component Architecture
```typescript
// shadcn-inspired component pattern
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Compound component pattern for complex forms
<VPSCreationWizard>
  <VPSCreationWizard.Step provider />
  <VPSCreationWizard.Step configuration />
  <VPSCreationWizard.Step review />
</VPSCreationWizard>
```

**Component Organization**:
- `src/components/ui/` - Reusable UI primitives (shadcn-style)
- `src/components/` - Feature-specific components
- Compound components for complex multi-step flows
- Error boundaries for graceful error handling

### API Integration
Centralized API client with authentication and error handling:

```typescript
import { apiClient, paymentService } from '@/lib/api';

// Auto-configured authentication headers
const response = await apiClient.get('/vps/instances');

// PayPal payment flows
const { success, approvalUrl } = await paymentService.createPayment({
  amount: 50.00,
  currency: 'USD',
  description: 'Wallet top-up'
});
```

**Features**:
- Automatic JWT token attachment
- Auto-logout on 401 responses
- Centralized error handling with user-friendly messages
- TypeScript interfaces for all API responses

## Backend Service Layer Architecture

### Route Organization
```typescript
// api/routes/vps.js - VPS management routes
router.get('/', authenticateToken, getVPSInstances);
router.post('/', authenticateToken, createVPSInstance);
router.post('/:id/action', authenticateToken, performVPSAction);

// api/routes/admin.js - Admin-only routes
router.get('/users', authenticateToken, requireRole('admin'), getUsers);
router.post('/providers', authenticateToken, requireRole('admin'), createProvider);
```

### Service Layer Pattern
Business logic separated from route handlers:

```typescript
// api/services/vpsService.js
export class VPSService {
  async createInstance(userId, config) {
    // 1. Validate configuration
    // 2. Check organization quotas
    // 3. Provision via provider abstraction
    // 4. Store in database with activity log
    // 5. Send real-time notification
  }
}
```

### Provider Service Integration
```typescript
// Using the provider abstraction
import { getProviderService } from 'api/services/providerService.js';

const provider = await getProviderService(providerId);
const instance = await provider.createInstance({
  plan: config.plan,
  region: config.region,
  image: config.image
});
```

**Provider Features**:
- Unified API across Linode and DigitalOcean
- Intelligent caching for plans, images, regions
- Error normalization for consistent user experience
- Credential validation and management

## Configuration Management

### Environment Configuration
```typescript
// api/config/index.ts - Runtime configuration proxy
import { config } from 'api/config/index.js';

// Dynamic configuration that supports hot reload
const dbConfig = {
  connectionString: config.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
};

// Multi-tier rate limiting
const rateLimits = {
  anonymous: config.rateLimiting.anonymousMaxRequests,
  authenticated: config.rateLimiting.authenticatedMaxRequests,
  admin: config.rateLimiting.adminMaxRequests
};
```

**Configuration Features**:
- Runtime config proxy (reads env vars at request time, not import time)
- Production validation for required secrets
- Multi-tier rate limiting by user role
- Environment-specific feature flags

### Rate Limiting Configuration
```bash
# Environment variables for rate limiting
RATE_LIMIT_ANONYMOUS_MAX=200
RATE_LIMIT_AUTHENTICATED_MAX=500
RATE_LIMIT_ADMIN_MAX=1000
RATE_LIMIT_ANONYMOUS_WINDOW_MS=900000
TRUST_PROXY=true
```

## Security Implementation

### Authentication Middleware
```typescript
// Multi-layer authentication
router.get('/public', optionalAuth, publicHandler);           // Optional auth
router.get('/user', authenticateToken, userHandler);          // Required auth
router.get('/admin', authenticateToken, requireRole('admin'), adminHandler); // Admin only
router.get('/org', authenticateToken, requireOrganization, orgHandler); // Org member
```

### Data Security
- **API Token Encryption**: Provider tokens encrypted with `SSH_CRED_SECRET`
- **Input Validation**: express-validator with custom sanitization
- **SQL Injection Prevention**: All database queries use parameterized statements
- **CORS Configuration**: Strict origin-based restrictions
- **Security Headers**: Helmet.js with CSP policies

### Access Control Patterns
```typescript
// Organization-based data isolation
const instances = await query(
  'SELECT * FROM vps_instances WHERE organization_id = $1 AND deleted_at IS NULL',
  [organizationId]
);

// Role-based feature access
if (user.role !== 'admin' && !organization.members.some(m => m.user_id === user.id)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

## Real-Time Features Implementation

### SSH WebSocket Bridge
Direct terminal access to VPS instances via WebSocket:

```typescript
// WebSocket endpoint for SSH connections
app.ws('/ssh/:instanceId', async (ws, req) => {
  const sshClient = new SSHClient();

  // Connect to VPS instance
  await sshClient.connect(instanceConfig);

  // Bidirectional data forwarding
  sshClient.on('data', (data) => ws.send(data));
  ws.on('message', (data) => sshClient.write(data));
});
```

### Notification System
```typescript
// Triggering real-time notifications
await notificationService.notifyUser(userId, {
  type: 'vps.created',
  data: { instanceId: instance.id },
  message: `VPS instance ${instance.name} created successfully`
});
```

## Production Deployment

### PM2 Configuration
The application uses PM2 for production process management:

```javascript
// ecosystem.config.cjs - Separate API and UI processes
{
  name: "skypanelv2-api",
  script: "api/server.ts",
  interpreter_args: "--import tsx",
  instances: 1,
  max_memory_restart: "500M",
  autorestart: true,
  env_production: {
    NODE_ENV: "production",
    PORT: 3001
  }
}
```

### Production Considerations
- **SSL/HTTPS**: Automated HTTPS via reverse proxy or Vercel
- **Database**: PostgreSQL with connection pooling and SSL
- **Redis**: For caching and queue management
- **Health Checks**: Database connectivity and API endpoint validation
- **Logging**: Structured logging with request tracking
- **Monitoring**: Memory limits and automatic restart policies

## Testing Guidelines

### Unit Testing with Vitest
```typescript
// Component testing
import { render, screen } from '@testing-library/react';
import { VPSList } from '@/components/VPSList';

test('displays VPS instances', async () => {
  render(<VPSList />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Test VPS')).toBeInTheDocument();
  });
});
```

### API Testing with Supertest
```typescript
// Route testing
import request from 'supertest';
import app from '../app.js';

test('GET /api/vps/instances returns user instances', async () => {
  const response = await request(app)
    .get('/api/vps/instances')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(Array.isArray(response.body.instances)).toBe(true);
});
```

## Development Best Practices

### Code Organization
- **2-space indentation** for TypeScript and React files
- **Named exports** preferred over default exports
- **Feature-based organization** with co-located components
- **Consistent import ordering**: external libs, internal modules, relative imports

### Error Handling Patterns
```typescript
// Provider error normalization
try {
  const instance = await provider.createInstance(config);
} catch (error) {
  const normalized = normalizeProviderError(error);
  // Returns: { code: 'PROVIDER_ERROR', message: 'User-friendly message', field: 'region' }
}

// Database error handling
try {
  await transaction(async (client) => {
    // Complex database operations
  });
} catch (error) {
  console.error('Transaction failed:', error);
  // Transaction automatically rolls back
}
```

### Import Patterns
```typescript
// Consistent import organization
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { VPSInstance } from '@/types/vps';
```

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Test database connectivity
node scripts/test-connection.js

# Reset database if encryption key issues
npm run db:fresh

# Check database URL format
echo $DATABASE_URL
```

### Port Conflicts
```bash
# Clear stuck processes
npm run kill-ports

# Check what's using ports
lsof -i :3001
lsof -i :5173
```

### Provider API Issues
```bash
# Test provider credentials
node scripts/test-provider-credentials.js --provider linode

# Check provider configuration in database
SELECT * FROM service_providers WHERE active = true;
```

### Development Environment Setup
```bash
# Fresh development setup
git clone <repository>
cd skypanelv2
npm install
cp .env.example .env
# Edit .env with your configuration
npm run db:fresh
node scripts/seed-admin.js
npm run dev
```

This architecture provides a solid foundation for scaling while maintaining security, performance, and developer productivity. The established patterns enable rapid development while ensuring consistency across the codebase.
