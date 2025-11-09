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
import adminPaasRoutes from './routes/admin/paas.js';
import faqRoutes from './routes/faq.js';
import adminFaqRoutes from './routes/adminFaq.js';
import sshKeysRoutes from './routes/sshKeys.js';
import pricingRoutes from './routes/pricing.js';
import paasRoutes from './routes/paas.js';
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
app.use(express.json({ limit: '10mb' }))
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
app.use('/api/admin/paas', adminPaasRoutes);
app.use('/api/faq', faqRoutes)
app.use('/api/admin/faq', adminFaqRoutes)
app.use('/api/ssh-keys', sshKeysRoutes)
app.use('/api/paas', paasRoutes)

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
