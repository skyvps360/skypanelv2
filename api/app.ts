/**
 * SkyPanelV2 API Server
 */

// Load environment variables FIRST before any other imports
// ONLY if not in Docker (Docker passes env vars directly)
import dotenv from 'dotenv'
if (!process.env.IN_DOCKER) {
  dotenv.config()
}

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import { smartRateLimit, addRateLimitHeaders } from './middleware/rateLimiting.js'
import { config, validateConfig } from './config/index.js'
import authRoutes from './routes/auth.js'
import paymentRoutes from './routes/payments.js'
import adminRoutes from './routes/admin.js'
import vpsRoutes from './routes/vps.js'
import supportRoutes from './routes/support.js'
import activityRoutes from './routes/activity.js'
import invoicesRouter from './routes/invoices.js';
import notificationsRouter from './routes/notifications.js';
import themeRoutes from './routes/theme.js';
import healthRoutes from './routes/health.js';
import contactRouter from './routes/contact.js';
import adminContactRoutes from './routes/admin/contact.js';
import adminPlatformRoutes from './routes/admin/platform.js';
import adminPaaSRoutes from './routes/admin/paas.js';
import paasRoutes from './routes/paas.js';
import internalPaaSRoutes from './routes/internal/paas.js';
import faqRoutes from './routes/faq.js';
import adminFaqRoutes from './routes/adminFaq.js';
import sshKeysRoutes from './routes/sshKeys.js';
import pricingRoutes from './routes/pricing.js';
import { notificationService } from './services/notificationService.js';
import { performStartupValidation, initializeConfigurationMonitoring } from './services/rateLimitConfigValidator.js';
import { initializeMetricsCollection, startMetricsPersistence } from './services/rateLimitMetrics.js';

// for esm mode

// Validate configuration
validateConfig()

// Perform comprehensive rate limiting configuration validation
performStartupValidation().catch(err => {
  console.error('Rate limiting startup validation failed:', err);
});

// Initialize rate limiting monitoring and metrics
initializeConfigurationMonitoring();
initializeMetricsCollection();
startMetricsPersistence();

// Start notification service for real-time updates
notificationService.start().catch(err => {
  console.error('Failed to start notification service:', err);
});

const app: express.Application = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientBuildPath = path.resolve(__dirname, '../dist')
const clientIndexFile = path.join(clientBuildPath, 'index.html')

// Trust proxy configuration - must be set before other middleware
// This enables proper IP detection when behind proxies (Vite dev server, reverse proxies, etc.)
app.set('trust proxy', config.rateLimiting.trustProxy)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// Smart rate limiting with differentiated limits based on user type
app.use('/api/', addRateLimitHeaders)
app.use('/api/', smartRateLimit)

// CORS configuration
// CORS configuration with sensible dev defaults and optional override
const devOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production' ? ['https://your-domain.com'] : devOrigins)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Body parsing middleware
app.use(
  express.json({
    limit: '10mb',
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = Buffer.from(buf)
    },
  })
)
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
})

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/invoices', invoicesRouter);
app.use('/api/admin', adminRoutes)
app.use('/api/vps', vpsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/notifications', notificationsRouter)
app.use('/api/theme', themeRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/pricing', pricingRoutes)
app.use('/api/contact', contactRouter);
app.use('/api/admin/contact', adminContactRoutes);
app.use('/api/admin/platform', adminPlatformRoutes);
app.use('/api/admin/paas', adminPaaSRoutes);
app.use('/api/paas', paasRoutes)
app.use('/api/internal/paas', internalPaaSRoutes)
app.use('/api/faq', faqRoutes)
app.use('/api/admin/faq', adminFaqRoutes)
app.use('/api/ssh-keys', sshKeysRoutes)

// Agent download endpoint
app.get('/agent/download', async (_req: Request, res: Response) => {
  try {
    const agentPath = path.join(__dirname, '../agent/dist')
    const fs = await import('fs/promises')
    const archiver = await import('archiver')
    
    // Create tar.gz of agent/dist directory
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', 'attachment; filename="skypanel-agent.tar.gz"')
    
    const archive = (archiver as any).default('tar', { gzip: true })
    archive.pipe(res)
    archive.directory(agentPath, 'skypanel-agent')
    await archive.finalize()
  } catch (err) {
    console.error('Agent download error:', err)
    res.status(500).json({ success: false, error: 'Agent package not available' })
  }
})

// Minimal agent installer endpoint (control-plane root scope)
app.get('/agent/install.sh', (_req: Request, res: Response) => {
  const script = `#!/bin/bash
set -e

CONTROL_PLANE_URL="$1"
REGISTRATION_TOKEN="$2"

if [ -z "$CONTROL_PLANE_URL" ] || [ -z "$REGISTRATION_TOKEN" ]; then
  echo "Usage: install.sh <control-plane-url> <registration-token>" >&2
  echo "Example: bash install.sh https://panel.example.com abc123token" >&2
  exit 1
fi

echo "=== SkyPanel PaaS Agent Installation ==="
echo "Control Plane: $CONTROL_PLANE_URL"
echo ""

# Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed successfully"
else
  echo "Docker already installed"
fi

# Install Node.js 20 if missing
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "Node.js installed successfully"
else
  echo "Node.js already installed"
fi

# Install Nginx for ingress
if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing Nginx..."
  apt-get update
  apt-get install -y nginx
  systemctl enable nginx
  echo "Nginx installed successfully"
else
  echo "Nginx already installed"
fi

# Create directory structure
echo "Setting up agent directories..."
mkdir -p /opt/skypanel-agent
mkdir -p /etc/skypanel/nginx/conf.d
mkdir -p /var/log/skypanel

# Download agent package
echo "Downloading agent package..."
cd /opt/skypanel-agent
curl -sSL "${'${'}CONTROL_PLANE_URL${'}'}/agent/download" -o agent.tar.gz
tar -xzf agent.tar.gz
rm agent.tar.gz
cd skypanel-agent

# Install dependencies
echo "Installing agent dependencies..."
npm install --production

# Register node with control plane
echo "Registering node with control plane..."
REGISTER_RESPONSE=$(curl -sSL -X POST "${'${'}CONTROL_PLANE_URL${'}'}/api/internal/paas/nodes/register" \
  -H 'Content-Type: application/json' \
  -d '{"registrationToken":"'"${'${'}REGISTRATION_TOKEN${'}'}"'","hostAddress":"'$(hostname -f)'"}')

# Extract node ID and JWT secret from response
NODE_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
JWT_SECRET=$(echo "$REGISTER_RESPONSE" | grep -o '"jwtSecret":"[^"]*' | cut -d'"' -f4)
REGION=$(echo "$REGISTER_RESPONSE" | grep -o '"region":"[^"]*' | cut -d'"' -f4)

if [ -z "$NODE_ID" ] || [ -z "$JWT_SECRET" ]; then
  echo "ERROR: Registration failed. Response: $REGISTER_RESPONSE"
  exit 1
fi

echo "Node registered successfully!"
echo "  Node ID: $NODE_ID"
echo "  Region: $REGION"

# Create config.json
cat > config.json <<EOF
{
  "controlPlaneUrl": "$CONTROL_PLANE_URL",
  "nodeId": "$NODE_ID",
  "jwtSecret": "$JWT_SECRET",
  "region": "$REGION",
  "maxContainers": 50,
  "maxCpuPercent": 90,
  "maxMemoryPercent": 90,
  "ingressType": "nginx",
  "sslProvider": "letsencrypt",
  "logLevel": "info",
  "dataDir": "/opt/skypanel-agent/.data",
  "ingressConfigPath": "/etc/skypanel/nginx/conf.d",
  "nginxReloadCommand": "nginx -s reload",
  "certEmail": "admin@example.com",
  "challengeDir": "/opt/skypanel-agent/.data/acme-challenges",
  "letsencryptDirectory": "production",
  "backupProvider": "local"
}
EOF

# Create systemd service
cat > /etc/systemd/system/skypanel-agent.service <<EOF
[Unit]
Description=SkyPanel PaaS Agent
After=network.target docker.service nginx.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skypanel-agent/skypanel-agent
ExecStart=/usr/bin/node /opt/skypanel-agent/skypanel-agent/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/skypanel/agent.log
StandardError=append:/var/log/skypanel/agent-error.log

[Install]
WantedBy=multi-user.target
EOF

# Start agent service
echo "Starting SkyPanel agent service..."
systemctl daemon-reload
systemctl enable skypanel-agent
systemctl start skypanel-agent

echo ""
echo "=== Installation Complete ==="
echo "Agent is now running and connected to the control plane"
echo "Check status: systemctl status skypanel-agent"
echo "View logs: journalctl -u skypanel-agent -f"
echo ""
`
  res.setHeader('Content-Type', 'text/plain')
  res.send(script)
})

// Health check routes are now handled by the dedicated health router

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  // Log full error details server-side
  console.error('API error:', error)
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(500).json({
    success: false,
    error: isDev ? (error?.message || 'Server internal error') : 'Server internal error',
  })
})

/**
 * 404 handler
 */
if (process.env.NODE_ENV === 'production') {
  // Serve the built frontend from /dist when running in production
  app.use(express.static(clientBuildPath))

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      return next()
    }

    res.sendFile(clientIndexFile, err => {
      if (err) {
        next(err)
      }
    })
  })
}

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
