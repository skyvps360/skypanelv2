# SkyPanel PaaS Agent

This agent runs on worker nodes and executes deployment tasks from the SkyPanel control plane.

## Installation

### Prerequisites
- Docker installed and running
- Node.js 20+
- Network access to control plane

### Setup

1. Install dependencies:
```bash
cd Paas-Agent
npm install
```

2. Get a registration token from the admin panel (create a new node)

3. Configure environment variables:
```bash
# Windows
set CONTROL_PLANE_URL=http://localhost:3001
set REGISTRATION_TOKEN=your-token-from-admin-panel
set PAAS_REGION=us-east
set PAAS_NODE_NAME=worker-1

# Linux/Mac
export CONTROL_PLANE_URL=http://localhost:3001
export REGISTRATION_TOKEN=your-token-from-admin-panel
export PAAS_REGION=us-east
export PAAS_NODE_NAME=worker-1
```

4. Start the agent:
```bash
npm start
```

On first run, the agent will:
- Register with the control plane
- Receive a JWT secret
- Save configuration to `config.json`
- Start heartbeat and task polling

## Running with Main App

The agent can run alongside the main SkyPanel app. See the main `package.json` for scripts to run both together.

## Configuration

Configuration is stored in `config.json`:

```json
{
  "controlPlaneUrl": "http://localhost:3001",
  "nodeId": 123,
  "jwtSecret": "secret-from-registration",
  "region": "us-east",
  "nodeName": "worker-1",
  "maxContainers": 50,
  "maxCpuPercent": 90,
  "maxMemoryPercent": 90,
  "heartbeatInterval": 30000,
  "taskPollInterval": 10000,
  "logLevel": "info"
}
```

## Environment Variables

- `CONTROL_PLANE_URL` - Control plane URL (required)
- `REGISTRATION_TOKEN` - One-time registration token (required for first run)
- `PAAS_REGION` - Geographic region (default: "local")
- `PAAS_NODE_NAME` - Node name (default: "local-worker-1")
- `MAX_CONTAINERS` - Max containers (default: 50)
- `MAX_CPU_PERCENT` - CPU alert threshold (default: 90)
- `MAX_MEMORY_PERCENT` - Memory alert threshold (default: 90)
- `HEARTBEAT_INTERVAL` - Heartbeat interval in ms (default: 30000)
- `TASK_POLL_INTERVAL` - Task polling interval in ms (default: 10000)
- `LOG_LEVEL` - Log level (default: "info")
- `WORKSPACE_DIR` - Build workspace directory (default: "./workspaces")

## How It Works

1. **Registration**: Agent registers with control plane using one-time token
2. **Heartbeat**: Sends system metrics every 30 seconds
3. **Task Polling**: Polls for pending tasks every 10 seconds
4. **Task Execution**: Executes deploy/restart/stop/start/scale tasks
5. **Status Updates**: Reports task status back to control plane

## Deployment Workflow

When a deploy task is received:

1. Clone Git repository
2. Detect buildpack or use existing Dockerfile
3. Generate Dockerfile if needed
4. Build Docker image
5. Stop old container (if exists)
6. Create new container with resource limits
7. Start container
8. Report success/failure

## Logs

Logs are written to:
- Console (formatted with colors)
- `agent.log` (all logs)
- `agent-error.log` (errors only)

## Supported Task Types

- `deploy` - Full deployment (git clone → build → run)
- `restart` - Restart container
- `stop` - Stop container
- `start` - Start container
- `scale` - Scale instances (not yet implemented)

## Docker Container Naming

Containers are named: `paas-app-{appId}`

Example: `paas-app-123`

## Troubleshooting

### Agent won't start
- Check Docker is running: `docker ps`
- Verify CONTROL_PLANE_URL is reachable
- Check registration token is valid

### Registration fails
- Get new registration token from admin panel
- Verify control plane is running
- Check network connectivity

### Deployments fail
- Check Docker daemon is running
- Verify disk space
- Check Git URL is accessible
- Review logs in `agent-error.log`

### High resource usage
- Reduce MAX_CONTAINERS
- Check for runaway containers: `docker stats`
- Clean up old images: `docker system prune`

## Security

- JWT authentication for all API calls
- One-time registration tokens
- Docker socket requires appropriate permissions
- Build workspaces cleaned after deployment
- Resource limits enforced on containers

## License

Copyright © 2025 SkyVPS360. All rights reserved.
