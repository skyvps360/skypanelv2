import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('util', () => {
  const promisify = (fn: any) => fn;
  return { promisify, default: { promisify } };
});

vi.mock('child_process', () => {
  const exec = vi.fn();
  return { exec, default: { exec } };
});

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual, default: actual };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, default: actual };
});

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, default: actual };
});

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return { ...actual, default: actual };
});

const queryMock = vi.hoisted(() => vi.fn()) as Mock;
const upsertManyMock = vi.hoisted(() => vi.fn()) as Mock;
const logActivityMock = vi.hoisted(() => vi.fn()) as Mock;

vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: express.Response, next: express.NextFunction) => {
    req.userId = 'user-123';
    req.organizationId = 'org-456';
    next();
  },
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../lib/database.js', () => ({
  pool: {
    query: queryMock,
  },
}));

vi.mock('../services/activityLogger.js', () => ({
  logActivity: logActivityMock,
}));

vi.mock('../services/paas/deployerService.js', () => ({
  DeployerService: {
    delete: vi.fn(),
    rollback: vi.fn(),
    prefetchSlug: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    deploy: vi.fn(),
  },
}));

vi.mock('../services/paas/scalerService.js', () => ({
  ScalerService: {
    scale: vi.fn(),
  },
}));

vi.mock('../services/paas/loggerService.js', () => ({
  LoggerService: {
    tail: vi.fn(),
  },
}));

vi.mock('../services/paas/organizationService.js', () => ({
  PaasOrganizationService: {
    assertActive: vi.fn(),
    isSuspended: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../services/paas/billingService.js', () => ({
  PaasBillingService: {
    getInvoiceSummary: vi.fn(),
  },
}));

vi.mock('../worker/queues.js', () => ({
  buildQueue: { add: vi.fn() },
  deployQueue: { add: vi.fn() },
}));

vi.mock('../services/paas/sslService.js', () => ({
  SSLService: {
    provision: vi.fn(),
  },
}));

vi.mock('../services/paas/slugService.js', () => ({
  SlugService: {
    reserve: vi.fn(),
  },
}));

vi.mock('../services/paas/planService.js', () => ({
  PaasPlanService: {
    listForOrg: vi.fn(),
  },
}));

vi.mock('../services/paas/buildCacheService.js', () => ({
  BuildCacheService: {
    invalidate: vi.fn(),
  },
}));

vi.mock('../utils/paasApiError.js', () => ({
  handlePaasApiError: ({ res, clientMessage }: any) =>
    res.status(500).json({ error: clientMessage ?? 'error' }),
}));

vi.mock('../services/paas/environmentService.js', () => ({
  PaasEnvironmentService: {
    upsertMany: upsertManyMock,
    list: vi.fn(),
    delete: vi.fn(),
    parseEnv: vi.fn(),
    export: vi.fn(),
    getRuntimeEnv: vi.fn(),
  },
}));

import paasRouter from './paas.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/paas', paasRouter);
  return app;
};

describe('POST /api/paas/marketplace/deploy/:slug', () => {
  beforeEach(() => {
    queryMock.mockReset();
    upsertManyMock.mockReset();
    logActivityMock.mockReset();
  });

  it('persists template environment variables via PaasEnvironmentService', async () => {
    const template = {
      id: 'template-1',
      name: 'Example Template',
      slug: 'example-template',
      git_url: 'https://example.com/repo.git',
      git_branch: 'main',
      buildpack: 'nodejs',
      min_cpu_cores: 1,
      min_ram_mb: 512,
      default_env_vars: {
        DEFAULT_KEY: 'default-value',
        SHARED_KEY: 'template-value',
      },
    };

    const plan = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      cpu_cores: 2,
      ram_mb: 1024,
    };

    const insertedApp = {
      id: 'app-1',
      organization_id: 'org-456',
      name: 'My App',
      slug: 'my-app',
    };

    queryMock
      .mockResolvedValueOnce({ rows: [template] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [plan] })
      .mockResolvedValueOnce({ rows: [insertedApp] })
      .mockResolvedValueOnce({ rows: [{ id: 'deployment-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    upsertManyMock.mockResolvedValue(['DEFAULT_KEY', 'SHARED_KEY', 'CUSTOM_KEY']);
    logActivityMock.mockResolvedValue(undefined);

    const response = await request(createTestApp())
      .post('/api/paas/marketplace/deploy/example-template')
      .send({
        name: 'My App',
        plan_id: '123e4567-e89b-42d3-a456-426614174000',
        custom_env_vars: {
          CUSTOM_KEY: 'custom-value',
          SHARED_KEY: 'custom-override',
          NUMBER_VALUE: 42,
          NULL_VALUE: null,
        },
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(upsertManyMock).toHaveBeenCalledTimes(1);
    expect(upsertManyMock).toHaveBeenCalledWith('app-1', 'org-456', {
      CUSTOM_KEY: 'custom-value',
      DEFAULT_KEY: 'default-value',
      NUMBER_VALUE: '42',
      SHARED_KEY: 'custom-override',
    });
  });
});
