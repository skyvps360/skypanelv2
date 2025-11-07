# 🚀 PaaS Quick Reference Card

## One-Command Setup

```bash
# Install agent dependencies
cd Paas-Agent && npm install && cd ..

# Run migration
psql -U user -d database -f migrations/003_paas_integration.sql

# Start everything
npm run dev
```

## Scripts

```bash
npm run dev              # Start control plane + agent
npm run dev:no-agent     # Start without agent
npm run agent:dev        # Agent only
npm start                # Production with agent
npm start:no-agent       # Production without agent
```

## First Run Setup

1. Start app: `npm run dev`
2. Go to Admin → PaaS → Nodes
3. Create node, copy token
4. Stop app
5. Set token: `set REGISTRATION_TOKEN=your-token` (Windows) or `export REGISTRATION_TOKEN=your-token` (Linux/Mac)
6. Restart: `npm run dev`
7. Agent registers automatically!

## Agent Auto-Generated Config

After first run, `Paas-Agent/config.json` contains:

```json
{
  "controlPlaneUrl": "http://localhost:3001",
  "nodeId": 1,
  "jwtSecret": "auto-generated",
  "region": "local",
  "nodeName": "local-worker-1"
}
```

## Deployment Flow

```
Customer clicks Deploy
  ↓
Task queued in database
  ↓
Agent polls (every 10s)
  ↓
Agent clones Git repo
  ↓
Agent builds Docker image
  ↓
Agent starts container
  ↓
Reports success!
```

## API Endpoints

### Customer
- `GET /api/paas/applications` - List apps
- `POST /api/paas/applications` - Create app
- `POST /api/paas/applications/:id/deploy` - Deploy
- `POST /api/paas/applications/:id/restart` - Restart
- `GET /api/paas/applications/:id/builds` - Build history
- `GET /api/paas/applications/:id/env` - Env vars

### Admin
- `GET /api/paas/admin/plans` - List plans
- `POST /api/paas/admin/plans` - Create plan
- `GET /api/paas/admin/runtimes` - List runtimes
- `GET /api/paas/admin/nodes` - List nodes
- `POST /api/paas/admin/nodes` - Create node

### Internal (Agent)
- `POST /api/paas/internal/nodes/register` - Register node
- `POST /api/paas/internal/nodes/:id/heartbeat` - Send heartbeat
- `GET /api/paas/internal/nodes/:id/tasks` - Get pending tasks
- `PUT /api/paas/internal/tasks/:id/status` - Update task status

## Database Tables

```sql
paas_plans              -- Hosting plans
paas_runtimes          -- Runtime environments
paas_nodes             -- Worker nodes
paas_applications      -- Customer apps
paas_builds            -- Build history
paas_environment_vars  -- Env variables
paas_databases         -- Managed databases
paas_app_databases     -- App-DB links
paas_billing_records   -- Usage tracking
paas_tasks             -- Task queue
```

## Supported Runtimes

- Node.js 18, 20
- Python 3.11, 3.12
- PHP 8.2, 8.3
- Docker (custom Dockerfile)

## Environment Variables

```env
# Control Plane
CONTROL_PLANE_URL=http://localhost:3001
PAAS_PLATFORM_DOMAIN=apps.yourdomain.com
SSH_CRED_SECRET=your-32-char-secret

# Agent (optional)
REGISTRATION_TOKEN=token-from-admin
PAAS_REGION=local
PAAS_NODE_NAME=worker-1
MAX_CONTAINERS=50
HEARTBEAT_INTERVAL=30000
TASK_POLL_INTERVAL=10000
```

## Docker Container Names

Containers are named: `paas-app-{appId}`

Example: `paas-app-123`

## Check Status

```bash
# Docker containers
docker ps

# Database tasks
psql -d database -c "SELECT * FROM paas_tasks WHERE status='pending';"

# Agent logs
tail -f Paas-Agent/agent.log
```

## Troubleshooting

### Agent won't start
- Check Docker is running: `docker ps`
- Verify CONTROL_PLANE_URL: `http://localhost:3001`

### Deployment fails
- Check Git URL is accessible
- Verify OAuth token (for private repos)
- Review `Paas-Agent/agent-error.log`

### Task not executing
- Check agent is running: look for "✨ PaaS Agent is running!"
- Verify node is "online" in admin panel
- Check JWT secret in `config.json`

## Files to Check

- `Paas-Agent/agent.log` - All agent logs
- `Paas-Agent/agent-error.log` - Error logs
- `Paas-Agent/config.json` - Agent configuration
- `.kiro/specs/paas-integration/FINAL_SETUP.md` - Complete guide

## Test Deployment

Simple Node.js app:

```javascript
// package.json
{
  "name": "test-app",
  "scripts": { "start": "node index.js" },
  "dependencies": { "express": "^4.18.2" }
}

// index.js
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello!'));
app.listen(process.env.PORT || 3000);
```

Push to GitHub, deploy in SkyPanel!

## Documentation

- **FINAL_SETUP.md** - Complete setup guide
- **COMPLETION_REPORT.md** - Full report
- **MISSION_COMPLETE.md** - Summary
- **Paas-Agent/README.md** - Agent docs

All in: `.kiro/specs/paas-integration/`

## Support

Questions? Check docs in `.kiro/specs/paas-integration/`

---

**Ready?** Run `npm run dev` and start deploying! 🚀
