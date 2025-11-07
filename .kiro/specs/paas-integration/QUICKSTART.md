# PaaS Integration - Quick Start Guide

## Prerequisites

1. PostgreSQL database running
2. Node.js 20+ installed
3. Environment variables configured in `.env`

## Step 1: Run the Migration

The PaaS migration adds all necessary database tables.

```bash
# Option 1: Using the migration script
node scripts/run-migration.js 003_paas_integration.sql

# Option 2: Manual SQL execution
psql -U your_user -d your_database -f migrations/003_paas_integration.sql
```

The migration will create:
- `paas_plans` - Hosting plans with pricing
- `paas_runtimes` - Available runtimes (Node, Python, PHP, Docker)
- `paas_nodes` - Worker nodes
- `paas_applications` - Customer applications
- `paas_builds` - Build history
- `paas_environment_vars` - Environment variables (encrypted)
- `paas_databases` - Managed databases
- `paas_app_databases` - App-database links
- `paas_billing_records` - Usage billing
- `paas_database_backups` - Database backups
- `paas_tasks` - Task queue for agent

Default data includes:
- 7 runtimes (Node 18/20, Python 3.11/3.12, PHP 8.2/8.3, Docker)
- 5 plans (Starter $5/mo to Enterprise $80/mo)

## Step 2: Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start PaaS monitoring automatically.

## Step 3: Access Admin Dashboard

1. Navigate to `http://localhost:5173` (dev) or your production URL
2. Log in as admin
3. Go to Admin Dashboard
4. You'll need to manually add PaaS management UI to the admin page

## Step 4: Configure Your First Node (Optional - Requires Agent)

### Via Admin UI (Once Wired):
1. Open "Manage PaaS Nodes" modal
2. Click "Add New Node"
3. Enter name (e.g., "Worker-US-East-1") and region (e.g., "us-east")
4. Click "Create Node & Get Install Script"
5. Copy the installation script
6. Run it on your worker server as root

### Via API (For Testing):
```bash
curl -X POST http://localhost:3001/api/paas/admin/nodes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Worker",
    "region": "us-east",
    "host_address": "192.168.1.100"
  }'
```

Save the `registration_token` and `install_script` from the response.

## Step 5: Test Customer Workflow

1. Create/login as a customer account
2. Navigate to `/paas` (add to main navigation first)
3. Click "Create Application"
4. Fill in:
   - Name: "my-test-app"
   - Runtime: "Node.js 20 LTS"
   - Plan: "Starter"
   - Region: "us-east"
5. Click Create

You should see the application created with status "pending".

## Step 6: Verify Database Records

```sql
-- Check plans
SELECT * FROM paas_plans;

-- Check runtimes  
SELECT * FROM paas_runtimes;

-- Check nodes
SELECT * FROM paas_nodes;

-- Check applications
SELECT * FROM paas_applications;

-- Check tasks (should be queued)
SELECT * FROM paas_tasks WHERE status = 'pending';
```

## Step 7: Monitor Node Health

The PaaS monitor runs automatically and checks for offline nodes every 60 seconds.

Check server logs:
```bash
# You should see
[PaaS Monitor] Starting node health monitoring...
```

## What You Can Do Now

### ✅ Works Without Agent
- Create/edit/delete plans
- Create/edit/delete runtimes
- Create nodes (get install script)
- Create applications
- Configure Git repositories
- Set environment variables
- Queue deployment tasks
- View build history (empty until agent runs)
- Manage databases (meta-data only)

### ❌ Requires Agent
- Actually deploy applications
- Build from Git
- Run containers
- Generate SSL certificates
- Route traffic
- Collect logs
- Execute start/stop/restart commands

## Troubleshooting

### Migration fails
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Check for conflicting table names
- Review error message for specific SQL issue

### Can't create application
- Verify plans exist: `SELECT * FROM paas_plans WHERE is_active = true`
- Verify runtimes exist: `SELECT * FROM paas_runtimes WHERE is_active = true`
- Check frontend console for errors
- Verify API endpoint responds: `GET /api/paas/plans`

### Admin UI not showing PaaS options
- PaaS components need to be wired into Admin.tsx
- Add manually or wait for that implementation

### Node shows as offline
- Normal if agent isn't installed yet
- Once agent is running, it will send heartbeats
- Offline threshold is 90 seconds

## Next Steps

1. **Wire Admin UI Components**
   - Edit `src/pages/Admin.tsx`
   - Import and add PaaSPlansModal, PaaSRuntimesModal, PaaSNodesModal
   - Add buttons/tabs to open them

2. **Add Navigation**
   - Edit `src/components/AppLayout.tsx`
   - Add link to `/paas` in main navigation

3. **Build the Agent** (Most Important!)
   - See `agent/PLACEHOLDER.md` for architecture
   - Implement connection, heartbeat, task execution
   - Deploy to worker node

4. **Test End-to-End**
   - Create application
   - Trigger deployment
   - Agent picks up task
   - Agent builds and deploys
   - Application is accessible

## Environment Variables

Add to your `.env` if not already present:

```env
# PaaS Configuration
PAAS_PLATFORM_DOMAIN=apps.yourdomain.com
CONTROL_PLANE_URL=https://panel.yourdomain.com
SSH_CRED_SECRET=your-32-char-secret-key-here

# Existing vars
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

## API Testing

### Create a Plan
```bash
curl -X POST http://localhost:3001/api/paas/admin/plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Plan",
    "cpu_limit": 1000,
    "memory_limit": 512,
    "storage_limit": 1024,
    "monthly_price": 10.00,
    "supported_runtimes": [1,2,3,4,5,6,7]
  }'
```

### Create an Application
```bash
curl -X POST http://localhost:3001/api/paas/applications \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "runtime_id": 2,
    "plan_id": 1,
    "region": "us-east"
  }'
```

### Trigger Deployment
```bash
curl -X POST http://localhost:3001/api/paas/applications/1/deploy \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### Check Task Queue
```bash
curl http://localhost:3001/api/paas/admin/nodes/1/tasks \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Support

For implementation questions, refer to:
- `.kiro/specs/paas-integration/design.md` - Architecture
- `.kiro/specs/paas-integration/requirements.md` - Requirements  
- `.kiro/specs/paas-integration/IMPLEMENTATION_PROGRESS.md` - Status
- API documentation in `api-docs/`

## License

Copyright © 2025 SkyPanel. All rights reserved.
