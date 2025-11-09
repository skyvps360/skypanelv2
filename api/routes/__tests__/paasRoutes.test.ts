import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startAppMock = vi.fn();
const stopAppMock = vi.fn();
const getAppByIdMock = vi.fn();
const triggerRedeployMock = vi.fn();

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

vi.mock('../../services/paasService.js', () => ({
  PaaSService: {
    startApp: startAppMock,
    stopApp: stopAppMock,
    getAppById: getAppByIdMock
  }
}));

vi.mock('../../services/buildService.js', () => ({
  BuildService: {
    triggerRedeploy: triggerRedeployMock
  }
}));

const createApp = () => ({
  id: 'app-123',
  organizationId: 'org-1',
  planId: 'plan-1',
  name: 'Test App',
  slug: 'test-app',
  description: 'Demo application',
  githubRepoUrl: 'https://github.com/example/repo',
  githubBranch: 'main',
  githubCommitSha: null,
  status: 'deployed' as const,
  dockerfilePath: './Dockerfile',
  buildCommand: 'npm run build',
  startCommand: 'npm start',
  environmentVariables: {},
  autoDeployments: false,
  lastDeployedAt: new Date('2024-01-01T00:00:00.000Z'),
  lastBuiltAt: null,
  assignedWorkerId: null,
  resourceUsage: { cpu: 0, memory: 0, storage: 0 },
  healthCheckUrl: null,
  healthCheckInterval: 60,
  customDomains: [] as string[],
  metadata: {},
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
});

describe('PaaS application lifecycle routes', () => {
  let appServer: express.Express;

  beforeEach(async () => {
    startAppMock.mockReset();
    stopAppMock.mockReset();
    getAppByIdMock.mockReset();
    triggerRedeployMock.mockReset();

    const router = (await import('../paas.js')).default;
    appServer = express();
    appServer.use(express.json());
    appServer.use('/api/paas', router);
  });

  it('starts an application and returns updated status payload', async () => {
    const appData = { ...createApp(), status: 'deployed' as const };
    startAppMock.mockResolvedValue(appData);

    const response = await request(appServer).post('/api/paas/apps/app-123/start');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('deployed');
    expect(response.body.data.app).toMatchObject({
      id: 'app-123',
      status: 'deployed',
      repository_url: appData.githubRepoUrl,
      branch: appData.githubBranch
    });
    expect(startAppMock).toHaveBeenCalledWith('app-123', 'org-1', 'user-1');
  });

  it('stops an application and returns updated status payload', async () => {
    const appData = { ...createApp(), status: 'stopped' as const };
    stopAppMock.mockResolvedValue(appData);

    const response = await request(appServer).post('/api/paas/apps/app-123/stop');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('stopped');
    expect(response.body.data.app).toMatchObject({
      id: 'app-123',
      status: 'stopped',
      repository_url: appData.githubRepoUrl,
      branch: appData.githubBranch
    });
    expect(stopAppMock).toHaveBeenCalledWith('app-123', 'org-1', 'user-1');
  });

  it('returns 404 when attempting to start a missing application', async () => {
    startAppMock.mockResolvedValue(null);

    const response = await request(appServer).post('/api/paas/apps/missing/start');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('returns 404 when attempting to stop a missing application', async () => {
    stopAppMock.mockResolvedValue(null);

    const response = await request(appServer).post('/api/paas/apps/missing/stop');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('triggers a redeploy and returns deployment details', async () => {
    const initialApp = createApp();
    const buildingApp = { ...initialApp, status: 'building' as const, updatedAt: new Date('2024-01-01T01:00:00.000Z') };

    getAppByIdMock.mockResolvedValueOnce(initialApp);
    getAppByIdMock.mockResolvedValueOnce(buildingApp);
    triggerRedeployMock.mockResolvedValue({ deploymentId: 'deploy-1', success: true });

    const response = await request(appServer).post('/api/paas/apps/app-123/redeploy');

    expect(getAppByIdMock).toHaveBeenNthCalledWith(1, 'app-123', 'org-1');
    expect(triggerRedeployMock).toHaveBeenCalledWith({
      appId: 'app-123',
      organizationId: 'org-1',
      triggeredBy: 'user-1',
      appName: initialApp.name
    });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.deploymentId).toBe('deploy-1');
    expect(response.body.data.status).toBe('building');
    expect(response.body.data.app).toMatchObject({
      id: 'app-123',
      status: 'building'
    });
  });

  it('returns 404 when redeploying a missing application', async () => {
    getAppByIdMock.mockResolvedValue(null);

    const response = await request(appServer).post('/api/paas/apps/app-123/redeploy');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(triggerRedeployMock).not.toHaveBeenCalled();
  });
});
