import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn()) as Mock;

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: express.Response, next: express.NextFunction) => {
    req.userId = 'admin-user';
    req.organizationId = 'admin-org';
    next();
  },
  requireAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../lib/database.js', () => ({
  pool: {
    query: queryMock,
  },
}));

import adminPaasRouter from './paas.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/paas', adminPaasRouter);
  return app;
};

describe('GET /api/admin/paas/overview', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns zeroed stats when database has no rows', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // applications
      .mockResolvedValueOnce({ rows: [{ total: 0, deployed: 0, failed: 0 }] }) // deployments
      .mockResolvedValueOnce({ rows: [{ total_cpu: 0, total_ram_mb: 0 }] }) // capacity
      .mockResolvedValueOnce({ rows: [{ total_cost_today: 0 }] }) // billing
      .mockResolvedValueOnce({ rows: [] }); // worker nodes

    const response = await request(createTestApp()).get('/api/admin/paas/overview');

    expect(response.status).toBe(200);
    expect(response.body.summary.total_applications).toBe(0);
    expect(response.body.summary.running_applications).toBe(0);
    expect(response.body.resource_usage.total_cpu).toBe(0);
    expect(response.body.worker_nodes.length).toBeGreaterThan(0);
  });

  it('aggregates stats from database rows', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { status: 'running', count: '3' },
          { status: 'stopped', count: '1' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 4, deployed: 3, failed: 1 }] })
      .mockResolvedValueOnce({ rows: [{ total_cpu: 4.5, total_ram_mb: 8192 }] })
      .mockResolvedValueOnce({ rows: [{ total_cost_today: 12.34 }] })
      .mockResolvedValueOnce({ rows: [{ status: 'active', count: 2 }] });

    const response = await request(createTestApp()).get('/api/admin/paas/overview');

    expect(response.status).toBe(200);
    expect(response.body.summary.total_applications).toBe(4);
    expect(response.body.summary.running_applications).toBe(3);
    expect(response.body.summary.active_workers).toBe(2);
    expect(response.body.resource_usage.total_cpu).toBeCloseTo(4.5);
    expect(response.body.resource_usage.total_ram_mb).toBe(8192);
    expect(response.body.resource_usage.total_cost_today).toBeCloseTo(12.34);
  });
});
