# SkyPanelV2 Worker Agent

The SkyPanelV2 Worker Agent is responsible for executing application builds and deployments for the PaaS platform. It runs on build servers and connects to the main SkyPanel application to receive build tasks.

## Features

- **Docker-based builds** - Builds applications using Docker containers
- **Git integration** - Clones repositories from GitHub and other Git providers
- **Real-time communication** - Maintains persistent connection with SkyPanel main application
- **Automatic registration** - Self-registers with the main application
- **Health monitoring** - Sends regular heartbeats and status updates
- **Automatic cleanup** - Cleans up old build artifacts and Docker resources

## Prerequisites

- Node.js 18.0.0 or higher
- Docker installed and running
- Access to SkyPanel main application
- Sufficient disk space for build artifacts

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd skypanelv2/worker-agent

# Install dependencies
npm install

# Build the agent
npm run build
```

## Configuration

The worker agent is configured via environment variables. Create a `.env` file:

```env
# SkyPanel connection
SKYPANEL_URL=https://your-skypanel.com
WORKER_NODE_ID=your-node-id
WORKER_AUTH_TOKEN=your-auth-token

# Worker identification
WORKER_NAME=worker-01
WORKER_HOSTNAME=build-server-01
WORKER_IP_ADDRESS=192.168.1.100
WORKER_PORT=3001

# Build configuration
WORKSPACE_DIR=/tmp/skypanel-builds
MAX_CONCURRENT_BUILDS=3
BUILD_TIMEOUT_MINUTES=15
CLEANUP_INTERVAL_MINUTES=30

# Docker configuration (optional)
DOCKER_HOST=/var/run/docker.sock
# DOCKER_HOST=tcp://localhost:2376
# DOCKER_PORT=2376

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### Required Environment Variables

- `SKYPANEL_URL` - URL of the SkyPanel main application
- `WORKER_NAME` - Unique name for this worker node
- `WORKER_HOSTNAME` - Hostname of the worker machine
- `WORKER_IP_ADDRESS` - IP address of the worker machine

### Optional Environment Variables

- `WORKER_NODE_ID` - Existing node ID (for reconnection)
- `WORKER_AUTH_TOKEN` - Existing auth token (for reconnection)
- `WORKER_PORT` - Port for worker communication (default: 3001)
- `WORKSPACE_DIR` - Directory for build artifacts (default: /tmp/skypanel-builds)
- `MAX_CONCURRENT_BUILDS` - Maximum concurrent builds (default: 3)
- `BUILD_TIMEOUT_MINUTES` - Build timeout in minutes (default: 15)
- `CLEANUP_INTERVAL_MINUTES` - Cleanup interval in minutes (default: 30)
- `DOCKER_HOST` - Docker daemon socket or URL
- `DOCKER_PORT` - Docker daemon port (if using TCP)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `NODE_ENV` - Environment (development, production)

### Fetching Worker Credentials

If you need to re-use an existing worker's `WORKER_NODE_ID` and `WORKER_AUTH_TOKEN`, you can dump the latest values directly from the database without scrolling through logs. From the repository root run:

```bash
npx tsx scripts/show-worker-credentials.ts
```

This prints the most recent entries from `paas_worker_nodes` along with the decoded auth token so you can copy the values into `worker-agent/.env`.

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start the worker agent
pm2 start dist/index.js --name skypanel-worker

# View status
pm2 status

# View logs
pm2 logs skypanel-worker

# Stop the agent
pm2 stop skypanel-worker
```

### Using Docker

```bash
# Build Docker image
docker build -t skypanel-worker-agent .

# Run the agent
docker run -d \
  --name skypanel-worker \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e SKYPANEL_URL=https://your-skypanel.com \
  -e WORKER_NAME=docker-worker-01 \
  -e WORKER_HOSTNAME=docker-worker-01 \
  -e WORKER_IP_ADDRESS=172.17.0.1 \
  skypanel-worker-agent
```

## Worker Lifecycle

1. **Startup** - Agent starts and validates configuration
2. **Docker Check** - Verifies Docker connection
3. **SkyPanel Check** - Tests connection to main application
4. **Registration** - Registers or re-registers with SkyPanel
5. **Heartbeat Loop** - Sends regular heartbeats (every 30 seconds)
6. **Build Polling** - Polls for queued builds (every 10 seconds)
7. **Build Execution** - Builds and deploys applications
8. **Cleanup** - Periodic cleanup of resources (every 30 minutes)

## Build Process

1. **Accept Build** - Worker accepts a build job from SkyPanel
2. **Clone Repository** - Clones the Git repository to workspace
3. **Checkout Commit** - Checks out specific commit SHA if provided
4. **Docker Build** - Builds Docker image using Dockerfile
5. **Container Run** - Starts container from built image
6. **Status Update** - Reports success/failure back to SkyPanel
7. **Cleanup** - Removes build artifacts and intermediate images

## Monitoring and Logs

### View Logs

```bash
# View all logs
pm2 logs skypanel-worker

# View logs in real-time
pm2 logs skypanel-worker --lines 100

# View logs from file
tail -f logs/combined.log
```

### Check Worker Status

The worker agent exposes a status endpoint (when running with HTTP server):

```bash
curl http://localhost:3001/status
```

## Security Considerations

- Keep worker authentication tokens secure
- Use HTTPS for SkyPanel communication
- Limit network access for build containers
- Regularly update Docker and dependencies
- Monitor build logs for security issues
- Use resource limits to prevent abuse

## Troubleshooting

### Common Issues

1. **Docker Connection Failed**
   - Ensure Docker is running
   - Check Docker socket permissions
   - Verify DOCKER_HOST environment variable

2. **SkyPanel Connection Failed**
   - Verify SKYPANEL_URL is correct
   - Check network connectivity
   - Ensure authentication tokens are valid

3. **Build Failures**
   - Check build logs for specific errors
   - Verify Dockerfile syntax
   - Ensure sufficient disk space
   - Check resource limits

4. **Memory Issues**
   - Reduce MAX_CONCURRENT_BUILDS
   - Increase system memory
   - Implement build timeouts

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

## Development

### Project Structure

```
src/
├── index.ts          # Entry point
├── config.ts         # Configuration management
├── logger.ts         # Logging configuration
├── client.ts         # SkyPanel API client
├── docker.ts         # Docker service
├── build.ts          # Build service
└── worker.ts         # Main worker agent
```

### Building

```bash
# Build TypeScript
npm run build

# Clean build artifacts
npm run clean

# Development with auto-restart
npm run dev
```

## License

MIT License - see LICENSE file for details.
