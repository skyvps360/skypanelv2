import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn()) as Mock;
const stopApplicationMock = vi.hoisted(() => vi.fn()) as Mock;
const deployMock = vi.hoisted(() => vi.fn()) as Mock;
const logActivityMock = vi.hoisted(() => vi.fn()) as Mock;
const handlePaasApiErrorMock = vi.hoisted(() => vi.fn()) as Mock;

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

vi.mock('../../services/paas/deployerService.js', () => ({
  DeployerService: {
    stopApplication: stopApplicationMock,
    deploy: deployMock,
  },
}));

vi.mock('../../services/activityLogger.js', () => ({
  logActivity: logActivityMock,
}));

vi.mock('../../services/paas/nodeManagerService.js', () => ({
  NodeManagerService: {},
}));

vi.mock('../../utils/paasApiError.js', () => ({
  handlePaasApiError: handlePaasApiErrorMock,
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
    stopApplicationMock.mockReset();
    deployMock.mockReset();
    logActivityMock.mockReset();
    handlePaasApiErrorMock.mockReset();
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

describe('DELETE /api/admin/paas/apps/:id', () => {
  const appId = '3af0f2d0-4ce7-4c7d-9b3a-27c5922a3e5d';

  beforeEach(() => {
    queryMock.mockReset();
    stopApplicationMock.mockReset();
    deployMock.mockReset();
    logActivityMock.mockReset();
    handlePaasApiErrorMock.mockReset();
  });

  it('removes environment variables before deleting the application', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: appId,
            name: 'Test App',
            organization_id: 'org-123',
            status: 'running',
          },
        ],
      })
      .mockResolvedValue({ rows: [] });

    stopApplicationMock.mockResolvedValue(undefined);
    logActivityMock.mockResolvedValue(undefined);

    const response = await request(createTestApp()).delete(`/api/admin/paas/apps/${appId}`);

    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      'DELETE FROM paas_environment_vars WHERE application_id = $1',
      [appId]
    );
  });
});

describe('POST /api/admin/paas/apps/bulk-action', () => {
  beforeEach(() => {
    queryMock.mockReset();
    stopApplicationMock.mockReset();
    deployMock.mockReset();
    logActivityMock.mockReset();
    handlePaasApiErrorMock.mockReset();
  });

  it('removes environment variables when bulk deleting applications', async () => {
    const appId = 'b8258f33-a61a-4d6e-bf3f-4f6bb8a07321';

    queryMock.mockResolvedValue({ rows: [] });
    stopApplicationMock.mockResolvedValue(undefined);
    logActivityMock.mockResolvedValue(undefined);

    const response = await request(createTestApp())
      .post('/api/admin/paas/apps/bulk-action')
      .send({
        app_ids: [appId],
        action: 'delete',
      });

    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      'DELETE FROM paas_environment_vars WHERE application_id = $1',
      [appId]
    );
  });
});
