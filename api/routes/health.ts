/**
 * Health Check Routes
 *
 * Provides comprehensive health check endpoints including
 * rate limiting status and configuration validation.
 */

import { Router, Request, Response } from "express";
import {
  getRateLimitHealthCheck,
  validateRateLimitConfiguration,
} from "../services/rateLimitConfigValidator.js";
import { listActiveRateLimitOverrides } from "../services/rateLimitOverrideService.js";
import { getCurrentMetrics } from "../services/rateLimitMetrics.js";
import { config } from "../config/index.js";
import { query } from "../lib/database.js";
import { PlatformStatsService } from "../services/platformStatsService.js";
import { optionalAuth, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

/**
 * Basic health check endpoint
 */
router.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * Public status endpoint for platform statistics
 * No authentication required - provides aggregate counts
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    // Get VPS instance counts by status
    const vpsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'stopped') as stopped,
        COUNT(*) FILTER (WHERE status NOT IN ('running', 'stopped')) as other
      FROM vps_instances
    `);

    const vpsStats = vpsResult.rows[0] || {
      total: 0,
      running: 0,
      stopped: 0,
      other: 0,
    };

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        vps: {
          total: parseInt(vpsStats.total) || 0,
          running: parseInt(vpsStats.running) || 0,
          stopped: parseInt(vpsStats.stopped) || 0,
          other: parseInt(vpsStats.other) || 0,
        },
      },
    });
  } catch (error) {
    console.error("Status endpoint failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve status",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "Internal server error",
    });
  }
});

/**
 * Comprehensive health check with rate limiting status
 */
router.get("/detailed", (req: Request, res: Response) => {
  try {
    const rateLimitHealth = getRateLimitHealthCheck();
    const metrics = getCurrentMetrics(15); // Last 15 minutes

    const healthStatus = {
      status: rateLimitHealth.status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",

      // Rate limiting health
      rateLimiting: {
        ...rateLimitHealth.rateLimiting,
        configuration: rateLimitHealth.configuration,
        issues: rateLimitHealth.issues,
        recommendations: rateLimitHealth.recommendations.slice(0, 5), // Limit recommendations
      },

      // Recent metrics
      metrics: {
        timeWindow: metrics.timeWindow,
        totalRequests: metrics.totalRequests,
        rateLimitHitRate: Math.round(metrics.rateLimitHitRate * 100) / 100,
        userTypeBreakdown: {
          anonymous: metrics.anonymousRequests,
          authenticated: metrics.authenticatedRequests,
          admin: metrics.adminRequests,
        },
        violations: {
          anonymous: metrics.anonymousViolations,
          authenticated: metrics.authenticatedViolations,
          admin: metrics.adminViolations,
        },
      },

      // System info
      system: {
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
        memoryUsage: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
    };

    // Set appropriate HTTP status based on health
    const httpStatus =
      rateLimitHealth.status === "error"
        ? 503
        : rateLimitHealth.status === "warning"
        ? 200
        : 200;

    res.status(httpStatus).json({
      success: rateLimitHealth.status !== "error",
      ...healthStatus,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      success: false,
      status: "error",
      message: "Health check failed",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * Rate limiting specific health check
 */
router.get("/rate-limiting", async (req: Request, res: Response) => {
  try {
    const health = getRateLimitHealthCheck();
    const validation = validateRateLimitConfiguration();
    const overrides = await listActiveRateLimitOverrides();

    res.status(health.status === "error" ? 503 : 200).json({
      success: health.status !== "error",
      status: health.status,
      timestamp: health.timestamp,

      configuration: {
        valid: validation.isValid,
        summary: validation.configSummary,
        limits: {
          anonymous: `${
            config.rateLimiting.anonymousMaxRequests
          } requests per ${Math.round(
            config.rateLimiting.anonymousWindowMs / 60000
          )} minutes`,
          authenticated: `${
            config.rateLimiting.authenticatedMaxRequests
          } requests per ${Math.round(
            config.rateLimiting.authenticatedWindowMs / 60000
          )} minutes`,
          admin: `${
            config.rateLimiting.adminMaxRequests
          } requests per ${Math.round(
            config.rateLimiting.adminWindowMs / 60000
          )} minutes`,
        },
        trustProxy: config.rateLimiting.trustProxy,
        rawLimits: {
          anonymous: config.rateLimiting.anonymousMaxRequests,
          authenticated: config.rateLimiting.authenticatedMaxRequests,
          admin: config.rateLimiting.adminMaxRequests,
        },
        windows: {
          anonymousMs: config.rateLimiting.anonymousWindowMs,
          authenticatedMs: config.rateLimiting.authenticatedWindowMs,
          adminMs: config.rateLimiting.adminWindowMs,
        },
      },

      validation: {
        errors: validation.errors,
        warnings: validation.warnings,
        recommendations: validation.recommendations,
      },

      health: {
        configValid: health.rateLimiting.configValid,
        trustProxyEnabled: health.rateLimiting.trustProxyEnabled,
        limitsConfigured: health.rateLimiting.limitsConfigured,
        metricsEnabled: health.rateLimiting.metricsEnabled,
      },
      overrides: overrides.map((override) => ({
        id: override.id,
        userId: override.userId,
        userEmail: override.userEmail,
        userName: override.userName,
        maxRequests: override.maxRequests,
        windowMs: override.windowMs,
        reason: override.reason,
        createdBy: override.createdBy,
        createdByEmail: override.createdByEmail,
        createdByName: override.createdByName,
        expiresAt: override.expiresAt ? override.expiresAt.toISOString() : null,
        createdAt: override.createdAt.toISOString(),
        updatedAt: override.updatedAt.toISOString(),
      })),
      overridesCount: overrides.length,
    });
  } catch (error) {
    console.error("Rate limiting health check failed:", error);
    res.status(503).json({
      success: false,
      status: "error",
      message: "Rate limiting health check failed",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * Rate limiting metrics endpoint
 */
router.get("/metrics", (req: Request, res: Response) => {
  try {
    const windowMinutes = parseInt(req.query.window as string) || 15;

    // Validate window parameter
    if (windowMinutes < 1 || windowMinutes > 1440) {
      // Max 24 hours
      return res.status(400).json({
        success: false,
        error: "Invalid window parameter. Must be between 1 and 1440 minutes.",
      });
    }

    const metrics = getCurrentMetrics(windowMinutes);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        ...metrics,
        // Add calculated rates
        rates: {
          anonymousRequestsPerMinute:
            Math.round((metrics.anonymousRequests / windowMinutes) * 100) / 100,
          authenticatedRequestsPerMinute:
            Math.round((metrics.authenticatedRequests / windowMinutes) * 100) /
            100,
          adminRequestsPerMinute:
            Math.round((metrics.adminRequests / windowMinutes) * 100) / 100,
          violationsPerMinute:
            Math.round(
              ((metrics.anonymousViolations +
                metrics.authenticatedViolations +
                metrics.adminViolations) /
                windowMinutes) *
                100
            ) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Metrics endpoint failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve metrics",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * Configuration validation endpoint (for admin use)
 */
router.get("/config-validation", (req: Request, res: Response) => {
  try {
    const validation = validateRateLimitConfiguration();

    res.status(validation.isValid ? 200 : 400).json({
      success: validation.isValid,
      timestamp: new Date().toISOString(),
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        recommendations: validation.recommendations,
        configSummary: validation.configSummary,
      },
    });
  } catch (error) {
    console.error("Configuration validation failed:", error);
    res.status(500).json({
      success: false,
      message: "Configuration validation failed",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/**
 * VPS Infrastructure Statistics Endpoint
 * Returns VPS infrastructure metrics with status breakdown and resource totals
 * Public access with limited data, authenticated users get detailed metrics
 */
router.get("/stats", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await PlatformStatsService.getVPSStats();

    // If user is authenticated, return full details
    if (req.user) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        ...stats
      });
    }

    // For unauthenticated users, return limited public data
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      vps: {
        total: stats.vps.total,
        byStatus: stats.vps.byStatus,
        // Omit detailed resource information for public access
        resources: {
          totalVCPUs: 0,
          totalMemoryGB: 0,
          totalDiskGB: 0
        }
      },
      lastUpdated: stats.lastUpdated
    });
  } catch (error) {
    console.error("VPS stats endpoint failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve VPS statistics",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "Internal server error",
    });
  }
});

/**
 * Platform Statistics Endpoint
 * Returns all-time platform statistics for the about page
 * Public access with sanitized data
 */
router.get("/platform-stats", async (req: Request, res: Response) => {
  try {
    const platformStats = await PlatformStatsService.getPlatformStats();

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...platformStats
    });
  } catch (error) {
    console.error("Platform stats endpoint failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve platform statistics",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "Internal server error",
    });
  }
});

export default router;
