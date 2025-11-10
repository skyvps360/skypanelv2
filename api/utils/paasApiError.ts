import type { Request, Response } from 'express';
import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'paas-api.log');

const ensureLogDir = () => {
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
    } catch (error) {
      console.error('[PaaS API] Failed to create log directory:', error);
    }
  }
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
    };
  }

  return {
    message: 'Unknown error',
  };
};

const writeLogLine = (entry: Record<string, any>) => {
  try {
    ensureLogDir();
    const line = `${JSON.stringify(entry)}\n`;
    appendFile(LOG_FILE, line).catch((err) => {
      console.error('[PaaS API] Failed to append log entry:', err);
    });
  } catch (error) {
    console.error('[PaaS API] Failed to write log entry:', error);
  }
};

export const logPaasApiError = (req: Request, context: string, error: unknown, requestId: string) => {
  const serializedError = serializeError(error);
  const entry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    message: context,
    request: {
      method: req.method,
      path: req.originalUrl || req.url,
      userId: (req as any).userId || null,
      organizationId: (req as any).organizationId || null,
      ip: req.ip,
      id: requestId,
    },
    error: serializedError,
  };

  console.error(
    `[PaaS API] ${context}`,
    {
      path: entry.request.path,
      userId: entry.request.userId,
      organizationId: entry.request.organizationId,
      error: serializedError.message,
    },
  );

  writeLogLine(entry);
};

interface HandlePaasApiErrorOptions {
  req: Request;
  res: Response;
  error: unknown;
  logMessage: string;
  clientMessage?: string;
  statusCode?: number;
}

const getRequestId = (req: Request): string => {
  const headerId = req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim().length > 0) {
    return headerId;
  }
  if (Array.isArray(headerId) && headerId.length > 0) {
    return headerId[0];
  }
  if (typeof (req as any).requestId === 'string' && (req as any).requestId.trim().length > 0) {
    return (req as any).requestId;
  }
  return randomUUID();
};

export const handlePaasApiError = ({
  req,
  res,
  error,
  logMessage,
  clientMessage,
  statusCode = 500,
}: HandlePaasApiErrorOptions) => {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);
  logPaasApiError(req, logMessage, error, requestId);

  const response: Record<string, unknown> = {
    error: clientMessage || 'An unexpected PaaS error occurred',
    requestId,
  };

  if (process.env.NODE_ENV !== 'production') {
    const serializedError = serializeError(error);
    response.details = serializedError.message;
    if (serializedError.stack) {
      response.stack = serializedError.stack;
    }
  }

  res.status(statusCode).json(response);
};
