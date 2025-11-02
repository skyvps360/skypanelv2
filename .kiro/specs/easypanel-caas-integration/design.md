# Design Document: Easypanel CaaS Integration

## Overview

This design document outlines the architecture and implementation approach for integrating Easypanel Container as a Service (CaaS) into SkyPanelV2. The integration will enable users to deploy and manage containerized applications through a subscription-based model, similar to the existing VPS service offering.

The design follows the existing architectural patterns established for VPS services, including provider abstraction, plan management, billing cycles, and activity logging. The integration will add new database tables, API routes, services, and UI components while maintaining consistency with the existing codebase.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SkyPanelV2 Frontend                      │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  User Dashboard  │  │ Admin Dashboard  │                │
│  │  - Projects      │  │  - Plans         │                │
│  │  - Services      │  │  - Templates     │                │
│  │  - Monitoring    │  │  - Monitoring    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SkyPanelV2 Backend API                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Container Routes (/api/containers)       │  │
│  │  - Projects  - Services  - Plans  - Templates        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Container Service Layer              │  │
│  │  - EasypanelService  - ContainerPlanService          │  │
│  │  - ResourceQuotaService  - ContainerBillingService   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/Bearer Token
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Easypanel Instance                      │
│  - Projects API  - Services API  - Templates API            │
│  - Docker Container Management                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Request Flow**:
   - User interacts with React frontend
   - Frontend calls SkyPanelV2 backend API
   - Backend validates authentication, authorization, and resource quotas
   - Backend calls Easypanel API with Bearer token
   - Backend stores metadata in PostgreSQL
   - Backend returns response to frontend

2. **Admin Configuration Flow**:
   - Admin configures Easypanel credentials in platform settings
   - Admin creates container plans with resource quotas
   - Admin enables/disables templates for user deployment
   - Configuration stored in PostgreSQL with encrypted credentials

3. **Billing Flow**:
   - Monthly billing cycle created on subscription
   - Automated billing job runs daily to check for due cycles
   - Charges deducted from organization wallet
   - New billing cycle created for next period

## Components and Interfaces

### Database Schema

#### New Tables

**container_plans**
```sql
CREATE TABLE container_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    max_cpu_cores INTEGER NOT NULL,
    max_memory_gb INTEGER NOT NULL,
    max_storage_gb INTEGER NOT NULL,
    max_containers INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**container_subscriptions**
```sql
CREATE TABLE container_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES container_plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**container_projects**
```sql
CREATE TABLE container_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES container_subscriptions(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    easypanel_project_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, project_name)
);
```

**container_services**
```sql
CREATE TABLE container_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES container_projects(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    easypanel_service_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('app', 'postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'wordpress', 'box', 'compose')),
    status VARCHAR(50) DEFAULT 'deploying',
    cpu_limit DECIMAL(5,2),
    memory_limit_gb DECIMAL(10,2),
    storage_limit_gb DECIMAL(10,2),
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, service_name)
);
```

**container_templates**
```sql
CREATE TABLE container_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_schema JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**container_billing_cycles**
```sql
CREATE TABLE container_billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES container_subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    monthly_rate DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**easypanel_config**
```sql
CREATE TABLE easypanel_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_url VARCHAR(500) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    last_connection_test TIMESTAMP WITH TIME ZONE,
    connection_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Indexes

```sql
CREATE INDEX idx_container_subscriptions_org_id ON container_subscriptions(organization_id);
CREATE INDEX idx_container_subscriptions_status ON container_subscriptions(status);
CREATE INDEX idx_container_projects_org_id ON container_projects(organization_id);
CREATE INDEX idx_container_projects_subscription_id ON container_projects(subscription_id);
CREATE INDEX idx_container_services_project_id ON container_services(project_id);
CREATE INDEX idx_container_services_status ON container_services(status);
CREATE INDEX idx_container_billing_cycles_subscription_id ON container_billing_cycles(subscription_id);
CREATE INDEX idx_container_billing_cycles_org_id ON container_billing_cycles(organization_id);
CREATE INDEX idx_container_billing_cycles_period ON container_billing_cycles(billing_period_start, billing_period_end);
CREATE INDEX idx_container_templates_enabled ON container_templates(enabled);
```

### Backend Services

#### EasypanelService

**Purpose**: Abstraction layer for Easypanel API communication

**Key Methods**:
```typescript
class EasypanelService {
  // Authentication
  async testConnection(): Promise<boolean>
  async getUser(): Promise<EasypanelUser>
  
  // Projects
  async listProjects(): Promise<EasypanelProject[]>
  async listProjectsAndServices(): Promise<EasypanelProjectWithServices[]>
  async inspectProject(projectName: string): Promise<EasypanelProjectDetail>
  async createProject(projectName: string): Promise<EasypanelProject>
  async destroyProject(projectName: string): Promise<void>
  async updateProjectEnv(projectName: string, env: Record<string, string>): Promise<void>
  
  // App Services
  async createAppService(projectName: string, config: AppServiceConfig): Promise<void>
  async inspectAppService(projectName: string, serviceName: string): Promise<AppServiceDetail>
  async deployAppService(projectName: string, serviceName: string): Promise<void>
  async startAppService(projectName: string, serviceName: string): Promise<void>
  async stopAppService(projectName: string, serviceName: string): Promise<void>
  async restartAppService(projectName: string, serviceName: string): Promise<void>
  async destroyAppService(projectName: string, serviceName: string): Promise<void>
  async updateAppEnv(projectName: string, serviceName: string, env: Record<string, string>): Promise<void>
  async updateAppResources(projectName: string, serviceName: string, resources: ResourceConfig): Promise<void>
  
  // Database Services
  async createPostgresService(projectName: string, config: PostgresServiceConfig): Promise<void>
  async createMysqlService(projectName: string, config: MysqlServiceConfig): Promise<void>
  async createMariadbService(projectName: string, config: MariadbServiceConfig): Promise<void>
  async createMongoService(projectName: string, config: MongoServiceConfig): Promise<void>
  async createRedisService(projectName: string, config: RedisServiceConfig): Promise<void>
  
  // Templates
  async createFromTemplate(projectName: string, templateName: string, schema: TemplateSchema): Promise<void>
  
  // Monitoring
  async getDockerContainers(serviceName: string): Promise<DockerContainer[]>
  async getServiceError(projectName: string, serviceName: string): Promise<ServiceError | null>
}
```

**Configuration**:
- API URL and encrypted API key stored in `easypanel_config` table
- Bearer token authentication for all requests
- Base URL format: `https://easypanel.example.com/api/trpc`
- Request format: TRPC-style JSON with `{ json: { ...params } }`

#### ContainerPlanService

**Purpose**: Manage container plans and subscriptions

**Key Methods**:
```typescript
class ContainerPlanService {
  async listPlans(): Promise<ContainerPlan[]>
  async getPlan(planId: string): Promise<ContainerPlan>
  async createPlan(plan: CreateContainerPlanInput): Promise<ContainerPlan>
  async updatePlan(planId: string, updates: UpdateContainerPlanInput): Promise<ContainerPlan>
  async activatePlan(planId: string): Promise<void>
  async deactivatePlan(planId: string): Promise<void>
  
  async subscribe(organizationId: string, planId: string): Promise<ContainerSubscription>
  async cancelSubscription(subscriptionId: string): Promise<void>
  async getSubscription(organizationId: string): Promise<ContainerSubscription | null>
  async listSubscriptions(): Promise<ContainerSubscription[]>
}
```

#### ResourceQuotaService

**Purpose**: Enforce resource quotas and track usage

**Key Methods**:
```typescript
class ResourceQuotaService {
  async calculateCurrentUsage(organizationId: string): Promise<ResourceUsage>
  async checkQuotaAvailability(organizationId: string, requiredResources: ResourceRequirement): Promise<QuotaCheckResult>
  async validateDeployment(organizationId: string, serviceConfig: ServiceConfig): Promise<ValidationResult>
  
  interface ResourceUsage {
    cpuCores: number
    memoryGb: number
    storageGb: number
    containerCount: number
  }
  
  interface QuotaCheckResult {
    allowed: boolean
    exceededQuotas: string[]
    availableResources: ResourceUsage
  }
}
```

#### ContainerBillingService

**Purpose**: Handle billing cycles for container subscriptions

**Key Methods**:
```typescript
class ContainerBillingService {
  async createBillingCycle(subscriptionId: string): Promise<ContainerBillingCycle>
  async processDueBillingCycles(): Promise<BillingProcessResult>
  async chargeBillingCycle(cycleId: string): Promise<void>
  async suspendSubscriptionForNonPayment(subscriptionId: string): Promise<void>
  async listBillingCycles(organizationId: string): Promise<ContainerBillingCycle[]>
}
```

#### ContainerTemplateService

**Purpose**: Manage available templates for deployment

**Key Methods**:
```typescript
class ContainerTemplateService {
  async listEnabledTemplates(): Promise<ContainerTemplate[]>
  async listAllTemplates(): Promise<ContainerTemplate[]>
  async getTemplate(templateId: string): Promise<ContainerTemplate>
  async createTemplate(template: CreateTemplateInput): Promise<ContainerTemplate>
  async updateTemplate(templateId: string, updates: UpdateTemplateInput): Promise<ContainerTemplate>
  async enableTemplate(templateId: string): Promise<void>
  async disableTemplate(templateId: string): Promise<void>
}
```

### API Routes

#### Container Routes (`/api/containers`)

**Authentication**: All routes require `authenticateToken` and `requireOrganization` middleware

**Plan Management**:
- `GET /api/containers/plans` - List active container plans (user)
- `GET /api/containers/admin/plans` - List all container plans (admin)
- `POST /api/containers/admin/plans` - Create container plan (admin)
- `PUT /api/containers/admin/plans/:id` - Update container plan (admin)
- `POST /api/containers/admin/plans/:id/activate` - Activate plan (admin)
- `POST /api/containers/admin/plans/:id/deactivate` - Deactivate plan (admin)

**Subscription Management**:
- `GET /api/containers/subscription` - Get current subscription
- `POST /api/containers/subscription` - Subscribe to plan
- `DELETE /api/containers/subscription` - Cancel subscription
- `GET /api/containers/subscription/usage` - Get resource usage

**Project Management**:
- `GET /api/containers/projects` - List user projects
- `POST /api/containers/projects` - Create project
- `GET /api/containers/projects/:projectName` - Get project details
- `DELETE /api/containers/projects/:projectName` - Delete project
- `PUT /api/containers/projects/:projectName/env` - Update project environment

**Service Management**:
- `GET /api/containers/projects/:projectName/services` - List services
- `POST /api/containers/projects/:projectName/services/app` - Deploy app service
- `POST /api/containers/projects/:projectName/services/database` - Deploy database service
- `POST /api/containers/projects/:projectName/services/template` - Deploy from template
- `GET /api/containers/projects/:projectName/services/:serviceName` - Get service details
- `POST /api/containers/projects/:projectName/services/:serviceName/start` - Start service
- `POST /api/containers/projects/:projectName/services/:serviceName/stop` - Stop service
- `POST /api/containers/projects/:projectName/services/:serviceName/restart` - Restart service
- `DELETE /api/containers/projects/:projectName/services/:serviceName` - Delete service
- `PUT /api/containers/projects/:projectName/services/:serviceName/env` - Update environment
- `PUT /api/containers/projects/:projectName/services/:serviceName/resources` - Update resources
- `GET /api/containers/projects/:projectName/services/:serviceName/logs` - Get logs

**Template Management**:
- `GET /api/containers/templates` - List enabled templates (user)
- `GET /api/containers/admin/templates` - List all templates (admin)
- `POST /api/containers/admin/templates` - Create template (admin)
- `PUT /api/containers/admin/templates/:id` - Update template (admin)
- `POST /api/containers/admin/templates/:id/enable` - Enable template (admin)
- `POST /api/containers/admin/templates/:id/disable` - Disable template (admin)

**Admin Monitoring**:
- `GET /api/containers/admin/overview` - Platform-wide statistics
- `GET /api/containers/admin/subscriptions` - All subscriptions
- `GET /api/containers/admin/services` - All services across organizations

**Configuration**:
- `GET /api/containers/admin/config` - Get Easypanel configuration (admin)
- `POST /api/containers/admin/config` - Update Easypanel configuration (admin)
- `POST /api/containers/admin/config/test` - Test Easypanel connection (admin)

### Frontend Components

#### User Dashboard Components

**ContainerDashboard** (`src/pages/ContainerDashboard.tsx`)
- Overview of subscription, resource usage, and projects
- Quick actions for creating projects and deploying services

**ProjectsList** (`src/components/containers/ProjectsList.tsx`)
- List of user projects with service counts
- Create project button and project actions

**ProjectDetail** (`src/components/containers/ProjectDetail.tsx`)
- Project information and environment variables
- List of services within the project
- Deploy service options

**ServicesList** (`src/components/containers/ServicesList.tsx`)
- Grid/list view of services with status indicators
- Service actions (start, stop, restart, delete)

**ServiceDetail** (`src/components/containers/ServiceDetail.tsx`)
- Service configuration and status
- Environment variables editor
- Resource usage metrics
- Logs viewer

**DeployServiceModal** (`src/components/containers/DeployServiceModal.tsx`)
- Multi-step wizard for deploying services
- Options: Template, Custom App, Database
- Form validation and quota checking

**TemplateSelector** (`src/components/containers/TemplateSelector.tsx`)
- Browse and search templates
- Template details and configuration

**ResourceUsageWidget** (`src/components/containers/ResourceUsageWidget.tsx`)
- Visual representation of quota usage
- Progress bars for CPU, memory, storage, container count
- Warning indicators for high usage

#### Admin Dashboard Components

**ContainerPlansManagement** (`src/pages/admin/ContainerPlansManagement.tsx`)
- List of container plans with edit/delete actions
- Create plan form

**ContainerTemplatesManagement** (`src/pages/admin/ContainerTemplatesManagement.tsx`)
- List of templates with enable/disable toggles
- Template configuration editor

**ContainerMonitoring** (`src/pages/admin/ContainerMonitoring.tsx`)
- Platform-wide statistics
- List of all subscriptions and services
- Resource usage across organizations

**EasypanelConfig** (`src/pages/admin/EasypanelConfig.tsx`)
- Easypanel API configuration form
- Connection test button

## Data Models

### TypeScript Interfaces

```typescript
interface ContainerPlan {
  id: string
  name: string
  description: string
  priceMonthly: number
  maxCpuCores: number
  maxMemoryGb: number
  maxStorageGb: number
  maxContainers: number
  active: boolean
  createdAt: string
  updatedAt: string
}

interface ContainerSubscription {
  id: string
  organizationId: string
  planId: string
  plan?: ContainerPlan
  status: 'active' | 'suspended' | 'cancelled'
  currentPeriodStart: string
  currentPeriodEnd: string
  createdAt: string
  updatedAt: string
}

interface ContainerProject {
  id: string
  organizationId: string
  subscriptionId: string
  projectName: string
  easypanelProjectName: string
  status: string
  metadata: Record<string, any>
  services?: ContainerService[]
  createdAt: string
  updatedAt: string
}

interface ContainerService {
  id: string
  projectId: string
  serviceName: string
  easypanelServiceName: string
  serviceType: 'app' | 'postgres' | 'mysql' | 'mariadb' | 'mongo' | 'redis' | 'wordpress' | 'box' | 'compose'
  status: string
  cpuLimit?: number
  memoryLimitGb?: number
  storageLimitGb?: number
  configuration: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface ContainerTemplate {
  id: string
  templateName: string
  displayName: string
  description: string
  category: string
  templateSchema: TemplateSchema
  enabled: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

interface TemplateSchema {
  services: TemplateService[]
}

interface AppServiceConfig {
  serviceName: string
  source: {
    type: 'image' | 'github' | 'git' | 'upload' | 'dockerfile'
    image?: string
    owner?: string
    repo?: string
    ref?: string
    path?: string
    dockerfile?: string
  }
  env?: Record<string, string>
  domains?: DomainConfig[]
  mounts?: MountConfig[]
  deploy?: DeployConfig
  resources?: ResourceConfig
}

interface ResourceConfig {
  cpuLimit?: number
  memoryLimit?: number
  memoryReservation?: number
}

interface ResourceUsage {
  cpuCores: number
  memoryGb: number
  storageGb: number
  containerCount: number
}
```

## Error Handling

### Error Categories

1. **Authentication Errors**
   - Invalid Easypanel credentials
   - Expired or missing Bearer token
   - Connection timeout

2. **Validation Errors**
   - Invalid project/service names (pattern mismatch)
   - Missing required fields
   - Invalid resource configurations

3. **Quota Errors**
   - CPU quota exceeded
   - Memory quota exceeded
   - Storage quota exceeded
   - Container count limit reached

4. **Billing Errors**
   - Insufficient wallet balance
   - Failed payment transaction
   - Subscription suspended

5. **Easypanel API Errors**
   - Service deployment failed
   - Project creation failed
   - Service not found
   - Project not found

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}
```

### Error Handling Strategy

1. **API Layer**: Catch and transform Easypanel API errors into standardized format
2. **Service Layer**: Validate inputs and check quotas before API calls
3. **Route Layer**: Handle authentication and authorization errors
4. **Frontend**: Display user-friendly error messages with actionable guidance

## Testing Strategy

### Unit Tests

**Backend Services**:
- `EasypanelService`: Mock Easypanel API responses
- `ResourceQuotaService`: Test quota calculations and validations
- `ContainerBillingService`: Test billing cycle logic
- `ContainerPlanService`: Test plan CRUD operations

**Frontend Components**:
- `DeployServiceModal`: Test form validation and submission
- `ResourceUsageWidget`: Test quota display calculations
- `ServicesList`: Test service action handlers

### Integration Tests

**API Routes**:
- Test complete request/response cycles
- Test authentication and authorization
- Test error handling and validation

**Database Operations**:
- Test CRUD operations for all container tables
- Test foreign key constraints
- Test transaction rollbacks

### End-to-End Tests

**User Workflows**:
1. Subscribe to container plan
2. Create project
3. Deploy service from template
4. Start/stop/restart service
5. View logs and metrics
6. Delete service and project
7. Cancel subscription

**Admin Workflows**:
1. Configure Easypanel credentials
2. Create container plan
3. Enable/disable templates
4. Monitor platform usage

### Manual Testing Checklist

- [ ] Easypanel connection test with valid credentials
- [ ] Easypanel connection test with invalid credentials
- [ ] Create container plan with all fields
- [ ] Subscribe to plan with sufficient balance
- [ ] Subscribe to plan with insufficient balance
- [ ] Create project with valid name
- [ ] Create project with invalid name
- [ ] Deploy app from Docker image
- [ ] Deploy app from template
- [ ] Deploy database service
- [ ] Start/stop/restart service
- [ ] Update environment variables
- [ ] View service logs
- [ ] Delete service
- [ ] Delete project with services (should fail)
- [ ] Delete empty project
- [ ] Exceed CPU quota
- [ ] Exceed memory quota
- [ ] Exceed storage quota
- [ ] Exceed container count quota
- [ ] Monthly billing cycle processing
- [ ] Subscription suspension for non-payment
- [ ] Cancel subscription with active projects (should fail)
- [ ] Cancel subscription without projects

## Security Considerations

### API Key Encryption

- Easypanel API key encrypted using `encryptSecret()` from `lib/crypto.js`
- Same encryption mechanism as VPS provider API keys
- Decryption only in service layer, never exposed to frontend

### Authentication & Authorization

- All container routes require valid JWT token
- Organization membership verified for all operations
- Admin routes require admin role
- Users can only access their organization's resources

### Input Validation

- Project names validated against pattern `^[a-z0-9-_]+$`
- Service names validated against pattern `^[a-z0-9-_]+$`
- Resource limits validated as positive numbers
- Environment variables sanitized before storage

### Rate Limiting

- Container API routes subject to existing rate limiting
- Separate rate limits for admin operations
- Easypanel API calls throttled to prevent abuse

### Data Privacy

- Service configurations may contain sensitive data (passwords, API keys)
- Environment variables stored in JSONB with encryption consideration
- Logs filtered to remove sensitive information before display

## Performance Considerations

### Caching Strategy

- Cache Easypanel project list for 30 seconds
- Cache template list for 5 minutes
- Cache resource usage calculations for 1 minute
- Invalidate cache on mutations

### Database Optimization

- Indexes on frequently queried columns
- JSONB indexes for configuration searches
- Pagination for large result sets
- Connection pooling for concurrent requests

### API Call Optimization

- Batch Easypanel API calls where possible
- Use `listProjectsAndServices` instead of multiple calls
- Implement request debouncing on frontend
- Background jobs for non-critical operations

### Frontend Performance

- Lazy load service details
- Virtual scrolling for large service lists
- Optimistic UI updates for actions
- WebSocket for real-time status updates (future enhancement)

## Migration Strategy

### Database Migration

1. Add new tables to `migrations/001_initial_schema.sql`
2. Create indexes and foreign keys
3. Add triggers for `updated_at` columns
4. Seed default data (if any)

### Deployment Steps

1. Run database migration
2. Deploy backend with new routes and services
3. Deploy frontend with new components
4. Configure Easypanel credentials via admin UI
5. Create initial container plans
6. Enable templates for users

### Rollback Plan

1. Disable container routes via feature flag
2. Revert database migration if no data created
3. If data exists, mark feature as deprecated and plan data migration

## Future Enhancements

### Phase 2 Features

- Real-time container metrics (CPU, memory, network)
- Container logs streaming via WebSocket
- Custom domain management for services
- SSL certificate management
- Container backup and restore
- Service scaling (horizontal and vertical)
- Container health checks and auto-restart
- Service dependencies and linking

### Phase 3 Features

- Multi-region container deployment
- Container orchestration (Kubernetes integration)
- CI/CD pipeline integration
- Container image registry
- Advanced monitoring and alerting
- Cost optimization recommendations
- Container security scanning

## Dependencies

### Backend Dependencies

- `axios` or `node-fetch`: HTTP client for Easypanel API calls
- Existing: `pg`, `bcrypt`, `jsonwebtoken`, `express`

### Frontend Dependencies

- Existing: `react`, `react-router-dom`, `@tanstack/react-query`
- Existing UI components from `src/components/ui`

### External Services

- Easypanel instance (self-hosted or managed)
- PostgreSQL database (existing)
- Redis (existing, for caching)

## Configuration

### Environment Variables

Add to `.env.example`:

```bash
# Easypanel Configuration
EASYPANEL_API_URL=https://easypanel.example.com
EASYPANEL_API_KEY=your-easypanel-api-key
```

### Admin Configuration

- Easypanel credentials configurable via admin UI
- Stored in `easypanel_config` table
- Connection test available before saving

## Monitoring and Logging

### Activity Logging

New event types for `activity_logs` table:
- `container.subscription.create`
- `container.subscription.cancel`
- `container.project.create`
- `container.project.delete`
- `container.service.create`
- `container.service.start`
- `container.service.stop`
- `container.service.restart`
- `container.service.delete`
- `container.service.update`
- `container.billing.charge`
- `container.billing.failed`

### Metrics to Track

- Total active subscriptions
- Total projects and services
- Resource utilization per organization
- Billing success/failure rates
- Easypanel API response times
- Error rates by endpoint

### Alerting

- Alert on Easypanel connection failures
- Alert on billing failures
- Alert on quota violations
- Alert on service deployment failures
