import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Worker Authentication Middleware
 * 
 * Validates worker authentication tokens and extracts worker identity.
 * This middleware should be used on endpoints that are exclusively for worker nodes.
 */

export interface WorkerAuthRequest extends Request {
  workerId?: string;
  workerToken?: string;
}

/**
 * Middleware to authenticate worker nodes
 * 
 * Validates the worker auth token from the Authorization header
 * and attaches worker information to the request object.
 */
export const authenticateWorker = async (
  req: WorkerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Worker authentication token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid worker authentication token'
      });
      return;
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;

      // Validate token type
      if (decoded.type !== 'worker') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token type'
        });
        return;
      }

      // Attach worker info to request
      req.workerId = decoded.workerId;
      req.workerToken = token;

      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired worker token'
      });
      return;
    }
  } catch (error) {
    console.error('Worker authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate worker'
    });
  }
};

/**
 * Middleware to restrict endpoints to worker nodes only
 * 
 * Should be used after authenticateWorker middleware
 */
export const requireWorkerAuth = (
  req: WorkerAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.workerId && !req.workerToken) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is restricted to worker nodes'
    });
    return;
  }

  next();
};
