# Nix Build Pipeline

This document describes the Nix build pipeline implementation for the SkyPanelV2 container platform.

## Overview

The Nix build pipeline provides reproducible builds for containerized applications using the Nix package manager. It supports building from Nix expressions, Git repositories, and application templates.

## Components

### 1. NixBuildService

The main service for orchestrating Nix builds.

**Key Features:**
- Build from Nix expressions with dependency resolution
- Build from Git repositories (GitHub, GitLab, Bitbucket)
- Build from application templates
- Track build status and logs
- Cancel running builds
- Clean up old builds

**Usage Example:**

```typescript
import { NixBuildService } from './NixBuildService.js';

// Build from Nix expression
const result = await NixBuildService.buildFromNixExpression({
  serviceId: 'service-123',
  nixExpression: `
    with import <nixpkgs> {};
    stdenv.mkDerivation {
      name = "my-app";
      src = ./.;
      buildInputs = [ nodejs ];
    }
  `,
  environmentVars: {
    NODE_ENV: 'production'
  }
});

// Build from Git repository
const gitResult = await NixBuildService.buildFromGitRepository({
  serviceId: 'service-123',
  repoUrl: 'https://github.com/user/repo.git',
  branch: 'main',
  accessToken: 'github_pat_...'
});

// Build from template
const templateResult = await NixBuildService.buildFromTemplate({
  serviceId: 'service-123',
  templateId: 'template-456',
  customizations: {
    environmentVars: {
      PORT: '8080'
    }
  }
});
```

### 2. GitIntegration

Handles Git repository operations for builds.

**Key Features:**
- Validate Git URLs and branch access
- Clone repositories with authentication (SSH keys, access tokens)
- Shallow clones for faster builds
- Store commit SHA for traceability
- Support for private repositories

**Usage Example:**

```typescript
import { GitIntegration } from './GitIntegration.js';

// Validate Git URL
const validation = await GitIntegration.validateGitUrl(
  'https://github.com/user/repo.git'
);

// Clone repository
const cloneResult = await GitIntegration.cloneRepository(
  'https://github.com/user/repo.git',
  '/tmp/build-dir',
  {
    branch: 'main',
    shallow: true,
    depth: 1,
    accessToken: 'github_pat_...'
  }
);

// Get commit info
const commitInfo = await GitIntegration.getCommitInfo(
  '/tmp/build-dir',
  'abc123...'
);
```

### 3. BuildPipeline

Orchestrates the complete build-to-deployment flow.

**Key Features:**
- Create Docker images from Nix build output
- Push images to internal registry
- Track build duration and artifact size
- Handle build failures without disrupting running services
- Store build logs for debugging

**Usage Example:**

```typescript
import { BuildPipeline } from './BuildPipeline.js';

// Execute build pipeline
const result = await BuildPipeline.executePipeline({
  serviceId: 'service-123',
  organizationId: 'org-456',
  slug: 'my-app',
  nixResultPath: '/tmp/build-dir/result',
  buildId: 'build-789'
});

// Get build statistics
const stats = await BuildPipeline.getBuildStatistics('service-123');
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Average build time: ${stats.averageBuildTime}s`);
```

### 4. NixCacheService

Manages Nix package caching for faster builds.

**Key Features:**
- Cache common packages on worker nodes
- Share Nix store across builds
- Support external Nix binary cache
- Get cache statistics
- Clean up old packages
- Optimize store (deduplicate and compress)

**Usage Example:**

```typescript
import { NixCacheService } from './NixCacheService.js';

// Configure cache for worker
await NixCacheService.configureCacheForWorker('worker-123', {
  cacheUrl: 'https://cache.example.com',
  enableLocalCache: true,
  enableSharedStore: true
});

// Cache common packages
await NixCacheService.cacheCommonPackages('worker-123', [
  'nodejs',
  'python3',
  'go'
]);

// Get cache statistics
const stats = await NixCacheService.getCacheStatistics();
console.log(`Cache size: ${stats.cacheSizeMb} MB`);
console.log(`Hit rate: ${stats.hitRate}%`);

// Clean up old packages
const deletedCount = await NixCacheService.cleanupOldPackages(30);
console.log(`Deleted ${deletedCount} old packages`);
```

## Build Flow

1. **Initiate Build**
   - User triggers build from UI or webhook
   - Build record created in database
   - Build status set to 'pending'

2. **Source Acquisition**
   - Clone Git repository (if building from Git)
   - Load Nix expression (if building from expression)
   - Load template (if building from template)

3. **Dependency Resolution**
   - Nix resolves all package dependencies
   - Check Nix cache for cached packages
   - Download missing packages from cache or build from source

4. **Build Execution**
   - Nix builds application in isolated environment
   - Build logs captured in real-time
   - Build output stored in Nix store

5. **Image Creation**
   - Create Dockerfile from Nix build output
   - Build Docker image with Nix result
   - Tag image with build ID and timestamp

6. **Registry Push**
   - Push image to internal Docker registry
   - Store image digest for verification

7. **Completion**
   - Update build record with success/failure
   - Store build logs and artifacts
   - Trigger deployment if configured

## Environment Variables

Configure the build pipeline using these environment variables:

```bash
# Nix build workspace directory
NIX_BUILD_WORKSPACE=/tmp/skypanel-builds

# Docker registry URL
DOCKER_REGISTRY_URL=localhost:5000

# Docker registry credentials (optional)
DOCKER_REGISTRY_USERNAME=admin
DOCKER_REGISTRY_PASSWORD=secret

# Nix binary cache URL (optional)
NIX_CACHE_URL=https://cache.example.com

# Nix local cache directory
NIX_LOCAL_CACHE_DIR=/var/cache/nix
```

## Build Timeouts

Default build timeout is 30 minutes (1800 seconds). Maximum timeout is 1 hour (3600 seconds).

You can specify custom timeouts when initiating builds:

```typescript
const result = await NixBuildService.buildFromNixExpression({
  serviceId: 'service-123',
  nixExpression: '...',
  buildTimeout: 2400 // 40 minutes
});
```

## Error Handling

The build pipeline handles errors gracefully:

- **Build failures**: Preserve running container, store logs, notify user
- **Git clone failures**: Validate URL and credentials, provide actionable error messages
- **Nix expression errors**: Validate syntax before building, provide detailed error messages
- **Docker image creation failures**: Clean up partial builds, provide debugging information
- **Registry push failures**: Retry with exponential backoff, fall back to local registry

## Build Logs

Build logs are stored in the database and include:

- Timestamps for each step
- Command output (stdout and stderr)
- Error messages with stack traces
- Build duration and artifact size
- Commit SHA and branch information (for Git builds)

## Caching Strategy

The Nix cache service implements a multi-level caching strategy:

1. **Local Cache**: Packages cached on each worker node
2. **Shared Store**: Nix store shared across builds on the same worker
3. **External Cache**: Optional external binary cache for faster downloads
4. **Build Cache**: Previous build outputs cached for incremental builds

## Security Considerations

- Git URLs validated to prevent command injection
- SSH keys and access tokens stored securely
- Build isolation using Nix sandboxing
- Docker images scanned for vulnerabilities (future enhancement)
- Registry authentication using secure credentials

## Performance Optimization

- Shallow Git clones for faster repository downloads
- Nix binary cache for faster package downloads
- Shared Nix store to avoid duplicate builds
- Parallel builds when possible
- Build artifact cleanup to save disk space

## Monitoring and Metrics

Track build performance using these metrics:

- Build success rate
- Average build time
- Average artifact size
- Cache hit rate
- Build queue length
- Worker utilization

## Troubleshooting

### Build Fails with "Nix expression validation failed"

Check the Nix expression syntax:

```bash
nix-instantiate --parse default.nix
```

### Build Fails with "Git clone failed"

Verify repository access:

```bash
git ls-remote https://github.com/user/repo.git
```

### Build Fails with "Docker image creation failed"

Check Docker daemon status:

```bash
docker info
```

### Build Times Out

Increase build timeout or optimize build:

- Use Nix binary cache
- Reduce dependencies
- Use incremental builds

## Future Enhancements

- [ ] Support for Docker-based builds (fallback when Nix not available)
- [ ] Support for buildpacks (Heroku-style builds)
- [ ] Parallel builds across multiple workers
- [ ] Build caching based on Git commit SHA
- [ ] Automatic vulnerability scanning
- [ ] Build performance analytics
- [ ] Custom build hooks (pre-build, post-build)
- [ ] Multi-stage builds for smaller images

## References

- [Nix Package Manager](https://nixos.org/manual/nix/stable/)
- [Nix Pills](https://nixos.org/guides/nix-pills/)
- [Docker Documentation](https://docs.docker.com/)
- [Git Documentation](https://git-scm.com/doc)
