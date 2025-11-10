import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn()) as Mock;
const stopMock = vi.hoisted(() => vi.fn()) as Mock;
const deployMock = vi.hoisted(() => vi.fn()) as Mock;

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

vi.mock('../../services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
  '../../services/paas/nodeManagerService.js',
  () => ({
    NodeManagerService: {},
  }),
  { virtual: true }
);

vi.mock(
  '../../utils/paasApiError.js',
  () => ({
    handlePaasApiError: vi.fn(),
  }),
  { virtual: true }
);

vi.mock('../../services/paas/deployerService.js', () => ({
  DeployerService: {
    stop: stopMock,
    deploy: deployMock,
  },
}));

import adminPaasRouter from './paas.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/paas', adminPaasRouter);
  return app;
};

describe('Admin PaaS app actions', () => {
  beforeEach(() => {
    queryMock.mockReset();
    stopMock.mockReset();
    deployMock.mockReset();
  });

  it('suspends an application after stopping the service', async () => {
    const appId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const appRow = { id: appId, name: 'Test App' };

    queryMock
      .mockResolvedValueOnce({ rows: [appRow] })
      .mockResolvedValueOnce({ rows: [] });
    stopMock.mockResolvedValueOnce(undefined);

    const response = await request(createTestApp()).post(`/api/admin/paas/apps/${appId}/suspend`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Application suspended');
    expect(stopMock).toHaveBeenCalledWith(appId);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM paas_applications WHERE id = $1',
      [appId]
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'UPDATE paas_applications SET status = $1 WHERE id = $2',
      ['suspended', appId]
    );
  });

  it('deletes an application after stopping the service', async () => {
    const appId = '1c2a9d65-9bf7-4c5e-8f6d-7a9e4c3b2f10';
    const appRow = { id: appId, name: 'Delete Me', organization_id: 'org-1' };

    queryMock
      .mockResolvedValueOnce({ rows: [appRow] })
      .mockResolvedValue({ rows: [] });
    stopMock.mockResolvedValueOnce(undefined);

    const response = await request(createTestApp()).delete(`/api/admin/paas/apps/${appId}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Application deleted successfully');
    expect(stopMock).toHaveBeenCalledWith(appId);
    expect(queryMock).toHaveBeenCalledTimes(5);
  });

  it('performs bulk suspend action across applications', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    stopMock.mockResolvedValue(undefined);

    const response = await request(createTestApp())
      .post('/api/admin/paas/apps/bulk-action')
      .send({
        action: 'suspend',
        app_ids: [
          'd2719e06-7a4b-4c2d-8f51-7d9c1e2f3a4b',
          'a89b7c65-4321-4fed-9cba-0123456789ab',
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toEqual([
      'd2719e06-7a4b-4c2d-8f51-7d9c1e2f3a4b',
      'a89b7c65-4321-4fed-9cba-0123456789ab',
    ]);
    expect(response.body.failed).toEqual([]);
    expect(stopMock).toHaveBeenCalledTimes(2);
  });

  it('performs bulk delete action across applications', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    stopMock.mockResolvedValue(undefined);

    const response = await request(createTestApp())
      .post('/api/admin/paas/apps/bulk-action')
      .send({
        action: 'delete',
        app_ids: ['bb0f3cde-5e7a-4b12-9f3c-d5a6b7c8d9e0'],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toEqual(['bb0f3cde-5e7a-4b12-9f3c-d5a6b7c8d9e0']);
    expect(response.body.failed).toEqual([]);
    expect(stopMock).toHaveBeenCalledWith('bb0f3cde-5e7a-4b12-9f3c-d5a6b7c8d9e0');
  });
});
