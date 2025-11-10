# PaaS Fixes and Completion - Design Document

## Overview

This design document outlines the architecture and implementation approach for completing the SkyPanelV2 PaaS system. The current implementation has a solid foundation with database schema, basic API routes, and initial UI components, but lacks critical functionality and has several bugs preventing production use.

The design focuses on:
1. Fixing immediate critical errors (500 errors, null handling)
2. Completing missing UI components
3. Implementing core backend services
4. Integrating billing and resource tracking
5. Ensuring production-ready reliability

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Dashboard (React)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Apps   │  │ Metrics  │  │   Logs   │  │ Domains  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                    API Server (Express)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/paas/*  |  /api/admin/paas/*                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Backend Services Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Builder  │  │ Deployer │  │  Logger  │  │ Billing  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Scaler  │  │NodeMgr   │  │ Settings │  │HealthChk │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Worker Process (Bull)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Build   │  │  Deploy  │  │ Billing  │                  │
│  │  Queue   │  │  Queue   │  │  Queue   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Docker Swarm Orchestration                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Manager Node  │  Worker Node 1  │  Worker Node 2   │   │
│  │  ┌────┐ ┌────┐ │  ┌────┐ ┌────┐ │  ┌────┐ ┌────┐   │   │
│  │  │App1│ │App2│ │  │App3│ │App4│ │  │App5│ │App6│   │   │
│  │  └────┘ └────┘ │  └────┘ └────┘ │  └────┘ └────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Infrastructure Services                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Loki    │  │ Grafana  │  │ Traefik  │  │Prometheus│   │
│  │  (Logs)  │  │  (UI)    │  │ (Proxy)  │  │(Metrics) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Deployment Flow
```
User triggers deploy
    ↓
API creates deployment record
    ↓
Job added to Build Queue
    ↓
Worker picks up job
    ↓
Builder clones git repo
    ↓
Builder detects buildpack
    ↓
Builder creates slug
    ↓
Slug uploaded to storage
    ↓
Job added to Deploy Queue
    ↓
Worker picks up job
    ↓
Deployer creates Swarm service
    ↓
Traefik routes traffic
    ↓
Application running
```

#### Billing Flow
```
Hourly cron job
    ↓
Query all running apps
    ↓
Calculate: (CPU * replicas * price) + (RAM * replicas * price)
    ↓
Insert into paas_resource_usage
    ↓
Deduct from organization wallet
    ↓
If wallet < 0, stop applications
```

## Components and Interfaces

### 1. API Error Fixes

#### Problem
The `/api/admin/paas/overview` endpoint returns 500 errors when:
- No applications exist (GROUP BY returns empty)
- Aggregate functions return NULL
- Database queries fail silently

#### Solution
```typescript
// api/routes/admin/paas.ts - Fixed overview endpoint
router.get('/overview', async (req: Request, res: Response) => {
  try {
    // Use COALESCE to handle NULL aggregates
    const appsResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM paas_applications
      GROUP BY status
      UNION ALL
      SELECT 'total' as status, COUNT(*) as count FROM paas_applications
    `);

    const deploymentsResult = await pool.query(`
      SELECT COALESCE(COUNT(*), 0) as total 
      FROM paas_deployments 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const usageResult = await pool.query(`
      SELECT
        COALESCE(SUM(cpu_cores * replicas), 0) as total_cpu,
        COALESCE(SUM(ram_mb * replicas), 0) as total_ram_mb,
        COALESCE(SUM(cost), 0) as total_cost_today
      FROM paas_resource_usage
      WHERE recorded_at > NOW() - INTERVAL '24 hours'
    `);

    const nodesResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM paas_worker_nodes
      GROUP BY status
      UNION ALL
      SELECT 'total' as status, COUNT(*) as count FROM paas_worker_nodes
    `);

    // Format response with safe defaults
    const applications = appsResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    const worker_nodes = nodesResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    res.json({
      applications,
      deployments: {
        total: parseInt(deploymentsResult.rows[0]?.total || 0)
      },
      resource_usage: {
        total_cpu: parseFloat(usageResult.rows[0]?.total_cpu || 0),
        total_ram_mb: parseInt(usageResult.rows[0]?.total_ram_mb || 0),
        total_cost_today: parseFloat(usageResult.rows[0]?.total_cost_today || 0)
      },
      worker_nodes
    });
  } catch (error: any) {
    console.error('Failed to get PaaS overview:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to get overview',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
```

### 2. Missing UI Components

#### DomainManager Component
```typescript
// src/components/PaaS/DomainManager.tsx
interface Domain {
  id: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  ssl_status: 'pending' | 'active' | 'failed';
  created_at: string;
}

export const DomainManager: React.FC<{ appId: string }> = ({ appId }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  // Load domains
  // Add domain with DNS validation
  // Show DNS configuration instructions
  // Display SSL certificate status
  // Remove domain
};
```

#### ResourceMetrics Component
```typescript
// src/components/PaaS/ResourceMetrics.tsx
export const ResourceMetrics: React.FC<{ appId: string }> = ({ appId }) => {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [timeRange, setTimeRange] = useState('1h');

  // Fetch metrics from Prometheus
  // Display CPU usage chart
  // Display RAM usage chart
  // Display request rate chart
  // Allow time range selection (1h, 6h, 24h, 7d)
};
```

#### DeploymentProgress Component
```typescript
// src/components/PaaS/DeploymentProgress.tsx
export const DeploymentProgress: React.FC<{ deploymentId: string }> = ({ deploymentId }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'building' | 'deploying' | 'success' | 'failed'>('building');

  // Stream build logs via SSE
  // Show progress stages: Clone → Build → Package → Deploy
  // Display real-time log output
  // Show success/failure status
};
```

#### PlanComparison Component
```typescript
// src/pages/PaaS/PaaSPlans.tsx
export const PaaSPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);

  // Display all plans in a comparison table
  // Highlight features per plan
  // Show pricing (hourly and monthly)
  // Allow selecting a plan for new app
};
```

### 3. Backend Services Implementation

#### BillingService Enhancement
```typescript
// api/services/paas/billingService.ts
export class PaasBillingService {
  /**
   * Record hourly resource usage for all running applications
   */
  static async recordHourlyUsage(): Promise<void> {
    const apps = await pool.query(`
      SELECT a.id, a.organization_id, a.replicas, p.cpu_cores, p.ram_mb, p.price_per_hour
      FROM paas_applications a
      JOIN paas_plans p ON a.plan_id = p.id
      WHERE a.status = 'running'
    `);

    for (const app of apps.rows) {
      const cost = app.price_per_hour * app.replicas;
      
      await pool.query(`
        INSERT INTO paas_resource_usage 
        (application_id, organization_id, cpu_cores, ram_mb, replicas, cost, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [app.id, app.organization_id, app.cpu_cores, app.ram_mb, app.replicas, cost]);

      // Deduct from wallet
      await pool.query(`
        UPDATE organizations 
        SET wallet_balance = wallet_balance - $1
        WHERE id = $2
      `, [cost, app.organization_id]);

      // Check if wallet is depleted
      const org = await pool.query(
        'SELECT wallet_balance FROM organizations WHERE id = $1',
        [app.organization_id]
      );

      if (org.rows[0].wallet_balance <= 0) {
        // Stop all apps for this organization
        await this.stopOrganizationApps(app.organization_id);
      }
    }
  }

  static async stopOrganizationApps(organizationId: string): Promise<void> {
    const apps = await pool.query(
      'SELECT id FROM paas_applications WHERE organization_id = $1 AND status = $2',
      [organizationId, 'running']
    );

    for (const app of apps.rows) {
      await DeployerService.stop(app.id);
      await pool.query(
        'UPDATE paas_applications SET status = $1 WHERE id = $2',
        ['stopped', app.id]
      );
    }
  }
}
```

#### HealthCheckService
```typescript
// api/services/paas/healthCheckService.ts
export class HealthCheckService {
  /**
   * Configure health checks for a Docker Swarm service
   */
  static async configureHealthCheck(appId: string, healthCheckPath: string = '/health'): Promise<void> {
    const serviceName = `paas-${appId}`;
    
    // Update service with health check
    await execAsync(`docker service update \\
      --health-cmd "curl -f http://localhost:5000${healthCheckPath} || exit 1" \\
      --health-interval 30s \\
      --health-timeout 10s \\
      --health-retries 3 \\
      ${serviceName}`);
  }

  /**
   * Monitor health check status for all applications
   */
  static async monitorHealthChecks(): Promise<void> {
    const apps = await pool.query(
      'SELECT id FROM paas_applications WHERE status = $1',
      ['running']
    );

    for (const app of apps.rows) {
      const serviceName = `paas-${app.id}`;
      const { stdout } = await execAsync(`docker service ps ${serviceName} --format "{{.CurrentState}}"`);
      
      if (stdout.includes('Failed')) {
        await LoggerService.log(app.id, 'system', 'Health check failed, restarting container');
      }
    }
  }
}
```

#### SSLService
```typescript
// api/services/paas/sslService.ts
export class SSLService {
  /**
   * Provision SSL certificate for a custom domain
   */
  static async provisionCertificate(domain: string): Promise<void> {
    // Traefik handles this automatically via Let's Encrypt
    // We just need to configure the Traefik labels on the service
    
    // Update Traefik configuration
    const traefikLabels = {
      'traefik.enable': 'true',
      [`traefik.http.routers.${domain}.rule`]: `Host(\`${domain}\`)`,
      [`traefik.http.routers.${domain}.tls`]: 'true',
      [`traefik.http.routers.${domain}.tls.certresolver`]: 'letsencrypt',
    };

    // Labels will be applied during deployment
  }

  /**
   * Validate domain ownership via DNS TXT record
   */
  static async validateDomainOwnership(domain: string, appId: string): Promise<boolean> {
    const expectedTxt = `paas-verify=${appId}`;
    
    try {
      const { stdout } = await execAsync(`dig +short TXT _paas-verify.${domain}`);
      return stdout.includes(expectedTxt);
    } catch (error) {
      return false;
    }
  }
}
```

### 4. Database Schema Enhancements

#### Add Missing Indexes
```sql
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_paas_apps_org_status ON paas_applications(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_paas_deployments_app_status ON paas_deployments(application_id, status);
CREATE INDEX IF NOT EXISTS idx_paas_resource_usage_recorded ON paas_resource_usage(recorded_at);
CREATE INDEX IF NOT EXISTS idx_paas_env_vars_app ON paas_environment_vars(application_id);
CREATE INDEX IF NOT EXISTS idx_paas_domains_app ON paas_domains(application_id);
```

#### Fix CASCADE Rules
```sql
-- Ensure proper cascading
ALTER TABLE paas_applications 
  DROP CONSTRAINT IF EXISTS paas_applications_organization_id_fkey,
  ADD CONSTRAINT paas_applications_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE paas_deployments
  DROP CONSTRAINT IF EXISTS paas_deployments_application_id_fkey,
  ADD CONSTRAINT paas_deployments_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES paas_applications(id)
    ON DELETE CASCADE;
```

#### Add Triggers for Resource Tracking
```sql
-- Trigger to update application updated_at
CREATE OR REPLACE FUNCTION update_paas_app_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paas_app_update_timestamp
  BEFORE UPDATE ON paas_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_paas_app_timestamp();
```

### 5. Worker Queue Implementation

#### Queue Configuration
```typescript
// api/worker/queues.ts
import Bull from 'bull';

export const buildQueue = new Bull('paas-builds', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const deployQueue = new Bull('paas-deploys', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const billingQueue = new Bull('paas-billing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Process build jobs
buildQueue.process(async (job) => {
  const { deploymentId } = job.data;
  await BuilderService.build(deploymentId);
});

// Process deploy jobs
deployQueue.process(async (job) => {
  const { deploymentId, replicas } = job.data;
  await DeployerService.deploy({ deploymentId, replicas });
});

// Process billing jobs (hourly)
billingQueue.process(async (job) => {
  await PaasBillingService.recordHourlyUsage();
});

// Schedule hourly billing
billingQueue.add({}, {
  repeat: { cron: '0 * * * *' } // Every hour
});
```

### 6. Log Streaming Implementation

#### LoggerService Enhancement
```typescript
// api/services/paas/loggerService.ts
export class LoggerService {
  /**
   * Stream logs from Loki via SSE
   */
  static async streamLogs(appId: string, res: Response): Promise<void> {
    const lokiEndpoint = await PaasSettingsService.get('loki_endpoint');
    const query = `{app="${appId}"}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Query Loki every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${lokiEndpoint}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=100`
        );
        const data = await response.json();

        if (data.data?.result) {
          for (const stream of data.data.result) {
            for (const [timestamp, message] of stream.values) {
              res.write(`data: ${JSON.stringify({ timestamp, message })}\n\n`);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    }, 2000);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(interval);
    });
  }
}
```

## Data Models

### Enhanced Application Model
```typescript
interface PaasApplication {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  git_url?: string;
  git_branch: string;
  buildpack?: string;
  status: 'inactive' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'suspended';
  subdomain: string;
  replicas: number;
  plan_id: string;
  health_check_path: string; // NEW
  auto_deploy: boolean; // NEW
  created_at: Date;
  updated_at: Date;
}
```

### Enhanced Domain Model
```typescript
interface PaasDomain {
  id: string;
  application_id: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  ssl_status: 'pending' | 'active' | 'failed';
  ssl_cert_expires_at?: Date; // NEW
  dns_validated_at?: Date; // NEW
  created_at: Date;
}
```

### Resource Usage Model
```typescript
interface PaasResourceUsage {
  id: string;
  application_id: string;
  organization_id: string;
  cpu_cores: number;
  ram_mb: number;
  replicas: number;
  cost: number;
  recorded_at: Date;
}
```

## Error Handling

### API Error Response Format
```typescript
interface ApiError {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Example usage
try {
  // ... operation
} catch (error: any) {
  console.error('Operation failed:', error);
  console.error('Stack:', error.stack);
  
  res.status(500).json({
    error: 'Operation failed',
    code: 'PAAS_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  });
}
```

### User-Friendly Error Messages
```typescript
const ERROR_MESSAGES = {
  BUILD_FAILED: 'Build failed. Check your application code and dependencies.',
  DEPLOY_FAILED: 'Deployment failed. The application may have crashed on startup.',
  INSUFFICIENT_FUNDS: 'Insufficient wallet balance. Please add funds to continue.',
  INVALID_GIT_URL: 'Invalid git repository URL or repository is not accessible.',
  SLUG_TAKEN: 'This application slug is already in use. Please choose another.',
  PLAN_LIMIT_REACHED: 'You have reached the maximum number of applications for your organization.',
};
```

## Testing Strategy

### Unit Tests
- Test all service methods with mocked dependencies
- Test API endpoints with mocked database
- Test utility functions (slug generation, validation)

### Integration Tests
- Test full deployment flow from git clone to running service
- Test billing calculation and wallet deduction
- Test log streaming from Loki
- Test worker queue processing

### End-to-End Tests
- Test user creating and deploying an application
- Test scaling an application
- Test rolling back a deployment
- Test adding a custom domain
- Test application stopping when wallet depletes

### Performance Tests
- Test concurrent deployments (10+ simultaneous)
- Test log streaming with high volume
- Test database query performance with 1000+ applications

## Security Considerations

### Environment Variable Encryption
- All env vars encrypted with organization-specific key
- Keys derived from master encryption key + organization ID
- Never return decrypted values in API responses

### SSH Key Security
- Worker node SSH keys encrypted in database
- Keys only decrypted in memory during provisioning
- Keys never logged or exposed in API responses

### Docker Isolation
- Each application runs in isolated overlay network
- Applications cannot communicate with each other
- Resource limits enforced at Docker level

### API Authentication
- All endpoints require valid JWT token
- Organization membership verified for all operations
- Admin endpoints require admin role

## Deployment Strategy

### Phase 1: Critical Fixes (Week 1)
1. Fix API 500 errors
2. Add NULL handling in database queries
3. Improve error logging
4. Fix admin dashboard display

### Phase 2: Core Features (Week 2-3)
1. Implement billing service
2. Implement worker queues
3. Complete log streaming
4. Add health checks

### Phase 3: UI Completion (Week 4)
1. Build domain management UI
2. Build metrics dashboard
3. Build deployment progress UI
4. Build plan comparison page

### Phase 4: Advanced Features (Week 5-6)
1. Implement SSL provisioning
2. Implement build caching
3. Implement worker node auto-provisioning
4. Add user management integration

### Phase 5: Testing & Polish (Week 7)
1. Write comprehensive tests
2. Performance optimization
3. Documentation updates
4. Bug fixes

## Monitoring and Observability

### Metrics to Track
- Deployment success rate
- Average build time
- Average deployment time
- Application uptime
- Resource utilization per node
- Billing accuracy
- API response times

### Alerts to Configure
- Deployment failures
- Worker node down
- Loki unavailable
- Wallet balance low
- High error rate
- Resource exhaustion

### Logging Strategy
- All API requests logged with request ID
- All deployments logged with full context
- All errors logged with stack traces
- All admin actions logged for audit

## Performance Optimization

### Database Optimization
- Add indexes on frequently queried columns
- Use connection pooling
- Implement query result caching for settings
- Use prepared statements

### Build Optimization
- Implement build caching
- Parallelize buildpack operations
- Use local Docker registry for faster pulls
- Optimize slug compression

### Deployment Optimization
- Pre-pull images on worker nodes
- Use rolling updates for zero-downtime
- Implement health checks for faster rollback
- Cache DNS lookups

## Scalability Considerations

### Horizontal Scaling
- API server can run multiple instances behind load balancer
- Worker process can run on multiple servers
- Docker Swarm distributes load across nodes
- Redis handles distributed queue coordination

### Vertical Scaling
- Increase worker node resources as needed
- Scale database with read replicas
- Use CDN for static assets
- Implement caching layer (Redis)

### Resource Limits
- Enforce plan limits at Docker level
- Implement rate limiting on API
- Queue depth limits to prevent overload
- Automatic cleanup of old deployments

## Migration Path

### For Existing Installations
1. Run database migration to add new columns/indexes
2. Deploy updated API server
3. Deploy worker process
4. Initialize infrastructure services
5. Migrate existing applications (if any)

### Rollback Plan
1. Keep previous version running during deployment
2. Database migrations are backwards compatible
3. Feature flags for new functionality
4. Ability to rollback API server independently

## Documentation Updates

### Admin Documentation
- Update setup guide with new features
- Add troubleshooting section for common issues
- Document all configuration options
- Add architecture diagrams

### User Documentation
- Update user guide with new UI features
- Add tutorials for common workflows
- Document all API endpoints
- Add FAQ section

### Developer Documentation
- Document all services and their interfaces
- Add code examples for common operations
- Document database schema
- Add contribution guidelines
