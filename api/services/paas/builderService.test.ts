import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryMock,
  mkdirMock,
  rmMock,
  statMock,
  readdirMock,
  tarCreateMock,
  tarExtractMock,
  execMock,
  getStorageConfigMock,
  validateRepositoryMock,
  cloneRepositoryMock,
  getCacheConfigMock,
  getValidCacheMock,
  downloadCacheArchiveMock,
  touchCacheMock,
  saveCacheArchiveMock,
  pruneCachesExceptMock,
  randomUuidMock,
  createHashMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  mkdirMock: vi.fn(),
  rmMock: vi.fn(),
  statMock: vi.fn(),
  readdirMock: vi.fn(),
  tarCreateMock: vi.fn(),
  tarExtractMock: vi.fn(),
  execMock: vi.fn(),
  getStorageConfigMock: vi.fn(),
  validateRepositoryMock: vi.fn(),
  cloneRepositoryMock: vi.fn(),
  getCacheConfigMock: vi.fn(),
  getValidCacheMock: vi.fn(),
  downloadCacheArchiveMock: vi.fn(),
  touchCacheMock: vi.fn(),
  saveCacheArchiveMock: vi.fn(),
  pruneCachesExceptMock: vi.fn(),
  randomUuidMock: vi.fn(() => 'build-id'),
  createHashMock: vi.fn(() => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'cache-key'),
    };
    return chain;
  }),
}));

vi.mock('../../lib/database.js', () => ({
  pool: {
    query: queryMock,
  },
  PaasApplication: {} as any,
  PaasDeployment: {} as any,
}));

vi.mock('./settingsService.js', () => ({
  PaasSettingsService: {
    getStorageConfig: getStorageConfigMock,
  },
}));

vi.mock('./gitService.js', () => ({
  GitService: {
    validateRepository: validateRepositoryMock,
    cloneRepository: cloneRepositoryMock,
  },
}));

vi.mock('./buildCacheService.js', () => ({
  BuildCacheService: {
    getConfig: getCacheConfigMock,
    getValidCache: getValidCacheMock,
    downloadCacheArchive: downloadCacheArchiveMock,
    touchCache: touchCacheMock,
    saveCacheArchive: saveCacheArchiveMock,
    pruneCachesExcept: pruneCachesExceptMock,
  },
  BuildCacheConfig: {} as any,
}));

vi.mock('child_process', () => ({
  exec: (...args: any[]) => execMock(...args),
}));


vi.mock('fs/promises', () => {
  const mod = {
    mkdir: mkdirMock,
    rm: rmMock,
    stat: statMock,
    readdir: readdirMock,
  };
  return { __esModule: true, ...mod, default: mod };
});

vi.mock('tar', () => ({
  create: (...args: any[]) => tarCreateMock(...args),
  extract: (...args: any[]) => tarExtractMock(...args),
}));

vi.mock('path', () => {
  const join = (...segments: string[]) => segments.filter(Boolean).join('/');
  const basename = (target: string) => target.split('/').filter(Boolean).pop() || '';
  return { __esModule: true, join, basename, default: { join, basename } };
});

vi.mock('crypto', () => ({
  __esModule: true,
  randomUUID: randomUuidMock,
  createHash: createHashMock,
  join: vi.fn(),
  rm: vi.fn(),
  default: {
    randomUUID: randomUuidMock,
    createHash: createHashMock,
    join: vi.fn(),
    rm: vi.fn(),
  },
}));

let BuilderService: typeof import('./builderService.js')['BuilderService'];
let restoreBuildCacheSpy: ReturnType<typeof vi.spyOn>;
let persistBuildCacheSpy: ReturnType<typeof vi.spyOn>;

const appRow = {
  id: 'app-123',
  stack: 'heroku-22',
};
const deploymentRow = {
  id: 'dep-456',
};

const buildCacheConfig = {
  enabled: true,
  ttlHours: 24,
  maxSizeMb: 10,
};

describe('BuilderService.build', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    const module = await import('./builderService.js');
    BuilderService = module.BuilderService;
    vi.spyOn(BuilderService, 'initialize').mockResolvedValue();
    vi.spyOn(BuilderService as any, 'validateRepository').mockResolvedValue(undefined);
    vi.spyOn(BuilderService as any, 'cloneRepository').mockResolvedValue(undefined);
    vi.spyOn(BuilderService as any, 'detectBuildpack').mockResolvedValue('heroku/nodejs');
    vi.spyOn(BuilderService as any, 'prepareCacheDirectory').mockResolvedValue('/tmp/cache-dir');
    vi.spyOn(BuilderService as any, 'runBuildpack').mockResolvedValue(undefined);
    vi.spyOn(BuilderService as any, 'createSlug').mockResolvedValue(2048);
    vi.spyOn(BuilderService as any, 'uploadSlug').mockResolvedValue('slug-url');
    vi.spyOn(BuilderService as any, 'logBuild').mockResolvedValue(undefined);

    restoreBuildCacheSpy = vi
      .spyOn(BuilderService as any, 'restoreBuildCache')
      .mockResolvedValue('cache-key');
    persistBuildCacheSpy = vi
      .spyOn(BuilderService as any, 'persistBuildCache')
      .mockResolvedValue(undefined);

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT * FROM paas_applications')) {
        return { rows: [appRow] };
      }

      if (sql.includes('COALESCE(MAX(version)')) {
        return { rows: [{ next_version: 1 }] };
      }

      if (sql.startsWith('INSERT INTO paas_deployments')) {
        return { rows: [deploymentRow] };
      }

      return { rows: [] };
    });

    mkdirMock.mockResolvedValue();
    rmMock.mockResolvedValue();
    readdirMock.mockResolvedValue(['package.json']);
    statMock.mockImplementation(async (targetPath: string) => {
      if (targetPath.endsWith('-cache.tgz')) {
        return { size: 256 };
      }

      return { size: 1024 };
    });
    tarCreateMock.mockResolvedValue();
    tarExtractMock.mockResolvedValue();

    execMock.mockResolvedValue({ stdout: 'build output', stderr: '' });

    getStorageConfigMock.mockResolvedValue({
      type: 'local',
      local: { path: '/tmp/paas-test' },
    });

    validateRepositoryMock.mockResolvedValue(undefined);
    cloneRepositoryMock.mockResolvedValue(undefined);

    getCacheConfigMock.mockResolvedValue(buildCacheConfig);
    getValidCacheMock.mockResolvedValue(null);
    downloadCacheArchiveMock.mockResolvedValue({});
    touchCacheMock.mockResolvedValue(undefined);
    saveCacheArchiveMock.mockResolvedValue(undefined);
    pruneCachesExceptMock.mockResolvedValue(undefined);
  });

  it('completes successfully when build cache is enabled', async () => {
    const result = await BuilderService.build({
      applicationId: appRow.id,
      gitUrl: 'https://example.com/repo.git',
      gitBranch: 'main',
      gitCommit: 'abcdef',
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(result.deploymentId).toBe(deploymentRow.id);
    expect(restoreBuildCacheSpy).toHaveBeenCalledWith(
      expect.objectContaining({ app: appRow })
    );
    expect(persistBuildCacheSpy).toHaveBeenCalledWith(
      expect.objectContaining({ app: appRow, cacheKey: 'cache-key' })
    );
  });
});
