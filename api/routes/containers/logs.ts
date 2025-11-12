/**
 * Container Logs Routes
 * Handles log streaming, retrieval, and download for container services
 */
import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { logStreamingService, LogFilter } from '../../services/containers/LogStreamingService.js';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { query } from '../../lib/database.js';

const router = express.Router();

// Special middleware for SSE that supports token in query parameter
const authenticateSSE = async (
  req: AuthenticatedRequest,
  res: Response,
  next: express.NextFunction
) => {
  try {
    // Try to get token from query parameter (for SSE EventSource compatibility)
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    
    // Get user from database
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = userResult.rows[0];

    // Get user's organization
    let organizationId;
    try {
      const orgResult = await query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1',
        [user.id]
      );
      organizationId = orgResult.rows[0]?.organization_id;
    } catch {
      console.warn('organization_members table not found');
    }

    // Fallback: use organization owned by the user
    if (!organizationId) {
      try {
        const ownerOrg = await query(
          'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        organizationId = ownerOrg.rows[0]?.id;
      } catch {
        console.warn('organizations lookup failed');
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId
    };

    next();
  } catch (error) {
    console.error('SSE authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Stream logs in real-time via Server-Sent Events
 * GET /api/containers/services/:serviceId/logs/stream?token=<jwt>&tail=100&follow=true
 */
router.get('/services/:serviceId/stream', authenticateSSE, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;
    const tail = parseInt(req.query.tail as string) || 100;
    const follow = req.query.follow !== 'false';

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Log stream connected' })}\n\n`);

    // Stream logs
    try {
      const logStream = await logStreamingService.streamLogs(serviceId, user.organizationId, {
        tail,
        follow,
        timestamps: true,
      });

      for await (const logEntry of logStream) {
        res.write(`data: ${JSON.stringify({ 
          type: 'log', 
          data: logEntry 
        })}\n\n`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stream logs';
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: errorMessage 
      })}\n\n`);
    }

    // Cleanup on client disconnect
    req.on('close', () => {
      res.end();
    });
  } catch (error) {
    console.error('Error streaming logs:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to stream logs' 
      });
    }
  }
});

/**
 * Get historical logs with filtering
 * GET /api/containers/services/:serviceId/logs?level=ERROR&startTime=2024-01-01&limit=1000
 */
router.get('/services/:serviceId/logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;
    const limit = Math.min(parseInt(req.query.limit as string) || 1000, 10000);

    const filter: LogFilter = {};

    if (req.query.level) {
      filter.level = req.query.level as LogFilter['level'];
    }

    if (req.query.startTime) {
      filter.startTime = new Date(req.query.startTime as string);
    }

    if (req.query.endTime) {
      filter.endTime = new Date(req.query.endTime as string);
    }

    if (req.query.searchText) {
      filter.searchText = req.query.searchText as string;
    }

    if (req.query.containerId) {
      filter.containerId = req.query.containerId as string;
    }

    const logs = await logStreamingService.getLogs(serviceId, user.organizationId, filter, limit);

    res.json({ 
      logs,
      count: logs.length,
      filter,
      limit
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch logs' 
    });
  }
});

/**
 * Download logs in specified format
 * GET /api/containers/services/:serviceId/logs/download?format=json&level=ERROR
 */
router.get('/services/:serviceId/logs/download', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceId = req.params.serviceId;
    const format = (req.query.format as string) || 'text';

    if (!['json', 'text', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be json, text, or csv' });
    }

    const filter: LogFilter = {};

    if (req.query.level) {
      filter.level = req.query.level as LogFilter['level'];
    }

    if (req.query.startTime) {
      filter.startTime = new Date(req.query.startTime as string);
    }

    if (req.query.endTime) {
      filter.endTime = new Date(req.query.endTime as string);
    }

    if (req.query.searchText) {
      filter.searchText = req.query.searchText as string;
    }

    const logsContent = await logStreamingService.downloadLogs(
      serviceId,
      user.organizationId,
      format as 'json' | 'text' | 'csv',
      filter
    );

    // Set appropriate content type and filename
    const contentTypes = {
      json: 'application/json',
      text: 'text/plain',
      csv: 'text/csv',
    };

    const extensions = {
      json: 'json',
      text: 'txt',
      csv: 'csv',
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `container-logs-${serviceId}-${timestamp}.${extensions[format as keyof typeof extensions]}`;

    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(logsContent);
  } catch (error) {
    console.error('Error downloading logs:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to download logs' 
    });
  }
});

export default router;
