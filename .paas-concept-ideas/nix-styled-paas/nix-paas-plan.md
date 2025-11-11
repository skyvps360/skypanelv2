# SkyPanelV2 Platform as a Service (PaaS) Implementation Plan

## Executive Summary

This document outlines the comprehensive plan to integrate Platform as a Service (PaaS) capabilities into SkyPanelV2 using NIX packages, providing clients with a robust alternative to Heroku. The implementation will leverage NIX's reproducible builds, declarative configuration, and isolation capabilities to offer a modern, scalable PaaS solution.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [NIX Integration Strategy](#nix-integration-strategy)
4. [Build System Architecture](#build-system-architecture)
5. [Deployment Pipeline](#deployment-pipeline)
6. [Runtime Management](#runtime-management)
7. [Database Services](#database-services)
8. [Networking & Load Balancing](#networking--load-balancing)
9. [Security Implementation](#security-implementation)
10. [Monitoring & Observability](#monitoring--observability)
11. [Auto-scaling Strategy](#auto-scaling-strategy)
12. [API Design](#api-design)
13. [Frontend Integration](#frontend-integration)
14. [Migration Strategy](#migration-strategy)
15. [Testing Strategy](#testing-strategy)
16. [Performance Optimization](#performance-optimization)
17. [Disaster Recovery](#disaster-recovery)
18. [Implementation Phases](#implementation-phases)
19. [Technical Requirements](#technical-requirements)
20. [Cost Analysis](#cost-analysis)

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SkyPanelV2 PaaS Layer                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Web    │  │   API    │  │   CLI    │  │  GitHub  │   │
│  │Dashboard │  │ Gateway  │  │  Client  │  │   App    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│  ┌────▼──────────────▼──────────────▼──────────────▼────┐  │
│  │              Control Plane API                        │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │  │
│  │  │  Auth  │  │  Apps  │  │Deploys │  │ Config │    │  │
│  │  │  Mgmt  │  │  CRUD  │  │  API   │  │  Store │    │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘    │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │              Orchestration Layer                   │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │Builder │  │Deployer│  │Scheduler│  │ Health │ │  │
│  │  │Service │  │Service │  │ Service │  │ Check │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │              NIX Runtime Layer                     │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │  NIX   │  │Container│  │Process │  │Resource│ │  │
│  │  │ Store  │  │ Runtime│  │Manager │  │ Limits │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

- **Control Plane**: Manages application lifecycle, authentication, and configuration
- **Orchestration Layer**: Handles build, deployment, and runtime orchestration
- **NIX Runtime Layer**: Provides isolated, reproducible runtime environments
- **Data Plane**: Runs actual application workloads in NIX-managed containers

### 1.3 Technology Stack

- **Core Runtime**: NIX 2.x with Flakes support
- **Container Runtime**: systemd-nspawn or Firecracker microVMs
- **Process Supervision**: systemd with custom service templates
- **Networking**: WireGuard for secure inter-node communication
- **Storage**: ZFS for efficient snapshots and cloning
- **Database**: PostgreSQL 15+ for control plane data
- **Cache**: Redis for build cache and session management
- **Message Queue**: NATS for event streaming
- **Monitoring**: Prometheus + Grafana stack

## 2. Core Components

### 2.1 Application Manager

```typescript
interface ApplicationManager {
  // Application lifecycle
  createApp(params: CreateAppParams): Promise<Application>;
  deleteApp(appId: string): Promise<void>;
  updateApp(appId: string, updates: Partial<Application>): Promise<Application>;

  // Configuration management
  setEnvVar(appId: string, key: string, value: string): Promise<void>;
  removeEnvVar(appId: string, key: string): Promise<void>;
  setSecrets(appId: string, secrets: Record<string, string>): Promise<void>;

  // Domain management
  addDomain(appId: string, domain: string): Promise<DomainConfig>;
  removeDomain(appId: string, domain: string): Promise<void>;
  enableSSL(appId: string, domain: string): Promise<SSLCertificate>;

  // Addons
  attachAddon(appId: string, addonType: AddonType, config: AddonConfig): Promise<Addon>;
  detachAddon(appId: string, addonId: string): Promise<void>;
}

interface Application {
  id: string;
  name: string;
  ownerId: string;
  stack: LanguageStack;
  region: string;
  tier: AppTier;
  config: AppConfig;
  domains: DomainConfig[];
  addons: Addon[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Build Service

```typescript
interface BuildService {
  // Build pipeline
  triggerBuild(appId: string, source: BuildSource): Promise<Build>;
  getBuildStatus(buildId: string): Promise<BuildStatus>;
  getBuildLogs(buildId: string): AsyncIterator<string>;
  cancelBuild(buildId: string): Promise<void>;

  // Buildpack management
  detectBuildpack(source: BuildSource): Promise<Buildpack>;
  customBuildpack(appId: string, nixExpression: string): Promise<void>;

  // Cache management
  clearBuildCache(appId: string): Promise<void>;
  getCacheUsage(appId: string): Promise<CacheStats>;
}

interface Build {
  id: string;
  appId: string;
  sourceType: 'git' | 'docker' | 'nixpack' | 'archive';
  sourceRef: string;
  status: BuildStatus;
  nixDerivation: string;
  outputPath: string;
  logs: string[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
```

### 2.3 Deployment Service

```typescript
interface DeploymentService {
  // Deployment operations
  deploy(appId: string, buildId: string, strategy: DeployStrategy): Promise<Deployment>;
  rollback(appId: string, deploymentId: string): Promise<Deployment>;
  promoteStaging(appId: string): Promise<Deployment>;

  // Release management
  createRelease(appId: string, buildId: string, config: ReleaseConfig): Promise<Release>;
  activateRelease(appId: string, releaseId: string): Promise<void>;

  // Deployment strategies
  blueGreenDeploy(params: BlueGreenParams): Promise<Deployment>;
  canaryDeploy(params: CanaryParams): Promise<Deployment>;
  rollingDeploy(params: RollingParams): Promise<Deployment>;
}

interface Deployment {
  id: string;
  appId: string;
  releaseId: string;
  strategy: DeployStrategy;
  status: DeploymentStatus;
  instances: Instance[];
  healthChecks: HealthCheck[];
  metrics: DeploymentMetrics;
  startedAt: Date;
  completedAt?: Date;
}
```

### 2.4 Runtime Manager

```typescript
interface RuntimeManager {
  // Process management
  startInstance(appId: string, instanceId: string): Promise<void>;
  stopInstance(instanceId: string, graceful: boolean): Promise<void>;
  restartInstance(instanceId: string): Promise<void>;

  // Scaling operations
  scaleApp(appId: string, targetInstances: number): Promise<void>;
  autoScale(appId: string, rules: AutoScaleRules): Promise<void>;

  // Resource management
  setResourceLimits(appId: string, limits: ResourceLimits): Promise<void>;
  getResourceUsage(appId: string): Promise<ResourceUsage>;

  // Health monitoring
  checkHealth(instanceId: string): Promise<HealthStatus>;
  enableHealthChecks(appId: string, config: HealthCheckConfig): Promise<void>;
}

interface Instance {
  id: string;
  appId: string;
  releaseId: string;
  nodeId: string;
  status: InstanceStatus;
  pid?: number;
  nixProfile: string;
  ipAddress: string;
  port: number;
  resources: ResourceUsage;
  startedAt: Date;
}
```

## 3. NIX Integration Strategy

### 3.1 NIX Flakes Configuration

```nix
# flake.nix template for applications
{
  description = "SkyPanelV2 PaaS Application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
    flake-utils.url = "github:numtide/flake-utils";

    # Language-specific inputs
    poetry2nix.url = "github:nix-community/poetry2nix";
    naersk.url = "github:nix-community/naersk";
    node2nix.url = "github:svanderburg/node2nix";
  };

  outputs = { self, nixpkgs, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Build configuration based on detected stack
        appBuild = stackType: sourceDir:
          if stackType == "nodejs" then
            buildNodeApp { inherit sourceDir pkgs; }
          else if stackType == "python" then
            buildPythonApp { inherit sourceDir pkgs inputs; }
          else if stackType == "rust" then
            buildRustApp { inherit sourceDir pkgs inputs; }
          else if stackType == "go" then
            buildGoApp { inherit sourceDir pkgs; }
          else
            throw "Unsupported stack type: ${stackType}";

      in {
        packages.default = appBuild;

        # Development shell for debugging
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            nixUnstable
            cachix
            nix-prefetch-git
          ];
        };
      });
}
```

### 3.2 Buildpack Implementations

#### Node.js Buildpack

```nix
# buildpacks/nodejs.nix
{ pkgs, sourceDir, ... }:
let
  packageJSON = builtins.fromJSON (builtins.readFile "${sourceDir}/package.json");

  # Detect package manager
  packageManager =
    if builtins.pathExists "${sourceDir}/yarn.lock" then "yarn"
    else if builtins.pathExists "${sourceDir}/pnpm-lock.yaml" then "pnpm"
    else "npm";

  nodeVersion = packageJSON.engines.node or "18";

  nodePkg = pkgs."nodejs_${nodeVersion}";

in pkgs.stdenv.mkDerivation {
  pname = packageJSON.name or "app";
  version = packageJSON.version or "1.0.0";

  src = sourceDir;

  buildInputs = [ nodePkg ] ++
    (if packageManager == "yarn" then [ pkgs.yarn ]
     else if packageManager == "pnpm" then [ pkgs.pnpm ]
     else []);

  buildPhase = ''
    export HOME=$TMPDIR

    # Install dependencies
    ${if packageManager == "yarn" then ''
      yarn install --frozen-lockfile --production=false
      yarn build || true
    '' else if packageManager == "pnpm" then ''
      pnpm install --frozen-lockfile
      pnpm build || true
    '' else ''
      npm ci
      npm run build || true
    ''}
  '';

  installPhase = ''
    mkdir -p $out/app
    cp -r * $out/app/

    # Create start script
    cat > $out/start.sh <<EOF
    #!/usr/bin/env bash
    cd $out/app
    ${if packageJSON.scripts.start or null != null then
      "${nodePkg}/bin/node $out/app/${packageJSON.scripts.start}"
    else
      "${nodePkg}/bin/node $out/app/${packageJSON.main or "index.js"}"
    }
    EOF
    chmod +x $out/start.sh
  '';

  passthru = {
    stack = "nodejs";
    runtime = nodePkg;
  };
}
```

#### Python Buildpack

```nix
# buildpacks/python.nix
{ pkgs, sourceDir, inputs, ... }:
let
  pythonVersion =
    if builtins.pathExists "${sourceDir}/runtime.txt" then
      builtins.readFile "${sourceDir}/runtime.txt"
    else if builtins.pathExists "${sourceDir}/.python-version" then
      builtins.readFile "${sourceDir}/.python-version"
    else
      "3.11";

  pythonPkg = pkgs."python${builtins.replaceStrings ["."] [""] pythonVersion}";

  # Detect framework
  requirements = builtins.readFile "${sourceDir}/requirements.txt";
  isDjango = builtins.match ".*[Dd]jango.*" requirements != null;
  isFlask = builtins.match ".*[Ff]lask.*" requirements != null;
  isFastAPI = builtins.match ".*fastapi.*" requirements != null;

  poetry2nix = inputs.poetry2nix.lib.mkPoetry2Nix { inherit pkgs; };

in if builtins.pathExists "${sourceDir}/pyproject.toml" then
  # Poetry project
  poetry2nix.mkPoetryApplication {
    projectDir = sourceDir;
    python = pythonPkg;
  }
else
  # Requirements.txt project
  pkgs.python3Packages.buildPythonApplication {
    pname = "app";
    version = "1.0.0";
    src = sourceDir;

    propagatedBuildInputs =
      let
        reqLines = pkgs.lib.splitString "\n" requirements;
        cleanReqs = builtins.filter (x: x != "" && !(pkgs.lib.hasPrefix "#" x)) reqLines;
        packages = map (req:
          let
            pkgName = builtins.head (pkgs.lib.splitString "==" req);
            cleanName = pkgs.lib.replaceStrings ["-"] ["_"] pkgName;
          in pythonPkg.pkgs.${cleanName} or null
        ) cleanReqs;
      in builtins.filter (x: x != null) packages;

    postInstall = ''
      # Create appropriate start script based on framework
      cat > $out/bin/start.sh <<EOF
      #!/usr/bin/env bash
      ${if isDjango then ''
        python manage.py migrate
        python manage.py collectstatic --noinput
        gunicorn --bind 0.0.0.0:$PORT project.wsgi
      '' else if isFlask then ''
        gunicorn --bind 0.0.0.0:$PORT "app:app"
      '' else if isFastAPI then ''
        uvicorn main:app --host 0.0.0.0 --port $PORT
      '' else ''
        python main.py
      ''}
      EOF
      chmod +x $out/bin/start.sh
    '';
  }
```

#### Dockerfile Support

```nix
# buildpacks/docker.nix
{ pkgs, sourceDir, ... }:
let
  dockerImage = pkgs.dockerTools.buildImage {
    name = "app";
    tag = "latest";

    # Convert Dockerfile to NIX
    config =
      let
        dockerfile = builtins.readFile "${sourceDir}/Dockerfile";
        # Parse and convert Dockerfile commands to NIX
        convertedConfig = parseDockerfile dockerfile;
      in convertedConfig;
  };

  # Function to parse Dockerfile
  parseDockerfile = dockerfile: {
    Cmd = [ "/start.sh" ];
    Env = parseEnvVars dockerfile;
    ExposedPorts = parseExpose dockerfile;
    WorkingDir = parseWorkdir dockerfile;
  };

in pkgs.stdenv.mkDerivation {
  name = "docker-app";

  buildInputs = [ pkgs.skopeo ];

  buildPhase = ''
    # Extract Docker image layers
    skopeo copy docker-archive:${dockerImage} dir:$TMPDIR/image
  '';

  installPhase = ''
    mkdir -p $out
    cp -r $TMPDIR/image/* $out/
  '';
}
```

### 3.3 NIX Store Management

```typescript
// api/services/nixStore.ts
export class NixStoreService {
  private storeRoot: string = '/nix/store';
  private profilesRoot: string = '/nix/var/nix/profiles';

  async buildDerivation(nixExpression: string): Promise<StorePath> {
    const drvPath = await this.instantiate(nixExpression);
    const outPath = await this.realize(drvPath);

    return {
      derivation: drvPath,
      output: outPath,
      closure: await this.computeClosure(outPath),
      size: await this.getPathSize(outPath),
    };
  }

  async createProfile(appId: string, storePath: string): Promise<string> {
    const profileName = `skypanel-app-${appId}`;
    const profilePath = path.join(this.profilesRoot, profileName);

    await this.exec(`nix-env --profile ${profilePath} --set ${storePath}`);

    return profilePath;
  }

  async garbageCollect(options: GCOptions = {}): Promise<GCResult> {
    const {
      deleteOlderThan = '30d',
      maxFreed = '10G',
      dryRun = false
    } = options;

    const cmd = [
      'nix-collect-garbage',
      `--delete-older-than ${deleteOlderThan}`,
      `--max-freed ${maxFreed}`,
      dryRun && '--dry-run'
    ].filter(Boolean).join(' ');

    const result = await this.exec(cmd);

    return this.parseGCResult(result);
  }

  async optimizeStore(): Promise<OptimizeResult> {
    const before = await this.getStoreSize();
    await this.exec('nix-store --optimise');
    const after = await this.getStoreSize();

    return {
      savedSpace: before - after,
      linkedFiles: await this.countHardLinks(),
    };
  }

  async copyToRemote(storePath: string, remote: string): Promise<void> {
    await this.exec(`nix copy --to ssh://${remote} ${storePath}`);
  }

  async signPath(storePath: string, keyFile: string): Promise<void> {
    await this.exec(`nix sign-paths --key-file ${keyFile} ${storePath}`);
  }
}
```

## 4. Build System Architecture

### 4.1 Build Pipeline

```typescript
// api/services/buildPipeline.ts
export class BuildPipeline {
  constructor(
    private nixStore: NixStoreService,
    private cacheService: CacheService,
    private storageService: StorageService,
  ) {}

  async executeBuild(build: Build): Promise<BuildResult> {
    const pipeline = this.createPipeline(build);

    try {
      // Stage 1: Source fetching
      await pipeline.stage('fetch', async () => {
        if (build.sourceType === 'git') {
          await this.fetchGitSource(build);
        } else if (build.sourceType === 'archive') {
          await this.fetchArchiveSource(build);
        }
      });

      // Stage 2: Stack detection
      await pipeline.stage('detect', async () => {
        build.stack = await this.detectStack(build.sourceDir);
        build.buildpack = await this.selectBuildpack(build.stack);
      });

      // Stage 3: Dependency resolution
      await pipeline.stage('dependencies', async () => {
        const cached = await this.cacheService.getCachedDependencies(build);
        if (!cached) {
          await this.resolveDependencies(build);
          await this.cacheService.cacheDependencies(build);
        }
      });

      // Stage 4: Build execution
      await pipeline.stage('build', async () => {
        const nixExpression = await this.generateNixExpression(build);
        build.derivation = await this.nixStore.buildDerivation(nixExpression);
      });

      // Stage 5: Test execution (optional)
      if (build.runTests) {
        await pipeline.stage('test', async () => {
          await this.runTests(build);
        });
      }

      // Stage 6: Artifact creation
      await pipeline.stage('package', async () => {
        build.artifact = await this.createArtifact(build);
        await this.storageService.storeArtifact(build.artifact);
      });

      // Stage 7: Image optimization
      await pipeline.stage('optimize', async () => {
        await this.optimizeImage(build);
      });

      return {
        success: true,
        artifact: build.artifact,
        metrics: pipeline.getMetrics(),
      };

    } catch (error) {
      await pipeline.handleFailure(error);
      throw error;
    }
  }

  private async detectStack(sourceDir: string): Promise<LanguageStack> {
    const detectors = [
      { file: 'package.json', stack: 'nodejs' },
      { file: 'requirements.txt', stack: 'python' },
      { file: 'Gemfile', stack: 'ruby' },
      { file: 'Cargo.toml', stack: 'rust' },
      { file: 'go.mod', stack: 'go' },
      { file: 'pom.xml', stack: 'java' },
      { file: 'composer.json', stack: 'php' },
      { file: 'mix.exs', stack: 'elixir' },
      { file: 'project.clj', stack: 'clojure' },
    ];

    for (const detector of detectors) {
      if (await fs.pathExists(path.join(sourceDir, detector.file))) {
        return detector.stack as LanguageStack;
      }
    }

    // Check for Dockerfile
    if (await fs.pathExists(path.join(sourceDir, 'Dockerfile'))) {
      return 'docker';
    }

    // Default to static site
    return 'static';
  }
}
```

### 4.2 Build Cache System

```typescript
// api/services/buildCache.ts
export class BuildCacheService {
  private cacheDir = '/var/cache/skypanel/builds';
  private s3Client: S3Client;

  async getCacheKey(build: Build): Promise<string> {
    const components = [
      build.stack,
      await this.hashDependencyFile(build),
      build.nixChannel || 'stable',
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('-'))
      .digest('hex');
  }

  async getCachedBuild(cacheKey: string): Promise<CachedBuild | null> {
    // Check local cache first
    const localPath = path.join(this.cacheDir, cacheKey);
    if (await fs.pathExists(localPath)) {
      return this.loadLocalCache(localPath);
    }

    // Check distributed cache
    try {
      const s3Key = `builds/${cacheKey}.tar.gz`;
      const data = await this.s3Client.getObject({
        Bucket: 'skypanel-build-cache',
        Key: s3Key,
      });

      return this.extractCache(data.Body);
    } catch (error) {
      return null;
    }
  }

  async saveBuildCache(build: Build, artifact: BuildArtifact): Promise<void> {
    const cacheKey = await this.getCacheKey(build);

    // Save locally
    const localPath = path.join(this.cacheDir, cacheKey);
    await this.saveLocalCache(localPath, artifact);

    // Upload to distributed cache
    const tarball = await this.createTarball(artifact);
    await this.s3Client.putObject({
      Bucket: 'skypanel-build-cache',
      Key: `builds/${cacheKey}.tar.gz`,
      Body: tarball,
      Metadata: {
        stack: build.stack,
        nixDerivation: build.derivation,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async pruneCaches(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    // Prune local caches
    const entries = await fs.readdir(this.cacheDir);
    const now = Date.now();

    for (const entry of entries) {
      const stats = await fs.stat(path.join(this.cacheDir, entry));
      if (now - stats.mtimeMs > maxAge) {
        await fs.remove(path.join(this.cacheDir, entry));
      }
    }

    // Prune S3 caches
    const objects = await this.s3Client.listObjectsV2({
      Bucket: 'skypanel-build-cache',
      Prefix: 'builds/',
    });

    const deleteKeys = objects.Contents
      ?.filter(obj => {
        const age = now - (obj.LastModified?.getTime() || 0);
        return age > maxAge;
      })
      .map(obj => ({ Key: obj.Key }));

    if (deleteKeys?.length) {
      await this.s3Client.deleteObjects({
        Bucket: 'skypanel-build-cache',
        Delete: { Objects: deleteKeys },
      });
    }
  }
}
```

## 5. Deployment Pipeline

### 5.1 Deployment Strategies

```typescript
// api/services/deploymentStrategies.ts
export abstract class DeploymentStrategy {
  abstract deploy(params: DeploymentParams): Promise<DeploymentResult>;
  abstract rollback(deployment: Deployment): Promise<void>;
  abstract getStatus(deployment: Deployment): Promise<DeploymentStatus>;
}

export class BlueGreenStrategy extends DeploymentStrategy {
  async deploy(params: DeploymentParams): Promise<DeploymentResult> {
    const { app, release, targetInstances } = params;

    // Step 1: Create new green environment
    const greenInstances = await this.createInstances(
      app,
      release,
      targetInstances,
      'green'
    );

    // Step 2: Start green instances
    await Promise.all(
      greenInstances.map(instance =>
        this.runtimeManager.startInstance(app.id, instance.id)
      )
    );

    // Step 3: Health checks on green
    await this.waitForHealthy(greenInstances, {
      timeout: 300000, // 5 minutes
      interval: 5000,
    });

    // Step 4: Run smoke tests
    if (params.smokeTests) {
      await this.runSmokeTests(greenInstances, params.smokeTests);
    }

    // Step 5: Switch traffic to green
    await this.loadBalancer.switchToGreen(app.id, greenInstances);

    // Step 6: Monitor for errors
    await this.monitorDeployment(greenInstances, {
      duration: 60000, // 1 minute
      errorThreshold: 0.01, // 1% error rate
    });

    // Step 7: Terminate blue instances
    const blueInstances = await this.getBlueInstances(app.id);
    await this.scheduleTermination(blueInstances, {
      delay: 300000, // 5 minutes
    });

    return {
      success: true,
      instances: greenInstances,
      metrics: await this.collectMetrics(greenInstances),
    };
  }

  async rollback(deployment: Deployment): Promise<void> {
    // Switch back to blue
    const blueInstances = await this.getBlueInstances(deployment.appId);
    await this.loadBalancer.switchToBlue(deployment.appId, blueInstances);

    // Terminate green instances
    const greenInstances = deployment.instances;
    const greenInstances = deployment.instances;
    await this.terminateInstances(greenInstances);
  }
}

export class CanaryStrategy extends DeploymentStrategy {
  async deploy(params: DeploymentParams): Promise<DeploymentResult> {
    const { app, release, targetInstances, canaryConfig } = params;
    const {
      initialPercentage = 10,
      incrementPercentage = 10,
      intervalMs = 60000,
      errorThreshold = 0.01,
      successThreshold = 0.99,
    } = canaryConfig || {};

    let currentPercentage = initialPercentage;
    const canaryInstances: Instance[] = [];
    const stableInstances = await this.getStableInstances(app.id);

    while (currentPercentage <= 100) {
      // Calculate instances for current percentage
      const canaryCount = Math.ceil((targetInstances * currentPercentage) / 100);
      const newInstancesNeeded = canaryCount - canaryInstances.length;

      // Create and start new canary instances
      if (newInstancesNeeded > 0) {
        const newInstances = await this.createInstances(
          app,
          release,
          newInstancesNeeded,
          'canary'
        );

        await Promise.all(
          newInstances.map(instance =>
            this.runtimeManager.startInstance(app.id, instance.id)
          )
        );

        canaryInstances.push(...newInstances);
      }

      // Update load balancer weights
      await this.loadBalancer.updateWeights(app.id, {
        stable: 100 - currentPercentage,
        canary: currentPercentage,
      });

      // Monitor metrics
      const metrics = await this.monitorCanary(
        canaryInstances,
        intervalMs,
        {
          errorThreshold,
          successThreshold,
          compareWith: stableInstances,
        }
      );

      // Check if rollback is needed
      if (metrics.errorRate > errorThreshold || metrics.successRate < successThreshold) {
        await this.rollbackCanary(app.id, canaryInstances, stableInstances);
        throw new Error(`Canary deployment failed: ${metrics.reason}`);
      }

      // Increment percentage
      currentPercentage = Math.min(100, currentPercentage + incrementPercentage);

      // Wait before next iteration
      if (currentPercentage < 100) {
        await this.sleep(intervalMs);
      }
    }

    // Full deployment successful - clean up old instances
    await this.scheduleTermination(stableInstances, { delay: 300000 });

    return {
      success: true,
      instances: canaryInstances,
      metrics: await this.collectMetrics(canaryInstances),
    };
  }
}

export class RollingStrategy extends DeploymentStrategy {
  async deploy(params: DeploymentParams): Promise<DeploymentResult> {
    const { app, release, targetInstances, rollingConfig } = params;
    const {
      batchSize = Math.ceil(targetInstances / 3),
      pauseBetweenBatches = 30000,
      healthCheckTimeout = 60000,
    } = rollingConfig || {};

    const oldInstances = await this.getRunningInstances(app.id);
    const newInstances: Instance[] = [];
    const batches = Math.ceil(targetInstances / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min((i + 1) * batchSize, targetInstances);
      const batchInstanceCount = batchEnd - batchStart;

      // Create new instances for this batch
      const batchInstances = await this.createInstances(
        app,
        release,
        batchInstanceCount,
        `batch-${i}`
      );

      // Start new instances
      await Promise.all(
        batchInstances.map(instance =>
          this.runtimeManager.startInstance(app.id, instance.id)
        )
      );

      // Wait for health checks
      await this.waitForHealthy(batchInstances, {
        timeout: healthCheckTimeout,
      });

      // Add to load balancer
      await this.loadBalancer.addInstances(app.id, batchInstances);

      // Remove corresponding old instances
      const instancesToRemove = oldInstances.slice(batchStart, batchEnd);
      await this.loadBalancer.removeInstances(app.id, instancesToRemove);
      await this.terminateInstances(instancesToRemove);

      newInstances.push(...batchInstances);

      // Pause between batches
      if (i < batches - 1) {
        await this.sleep(pauseBetweenBatches);
      }
    }

    return {
      success: true,
      instances: newInstances,
      metrics: await this.collectMetrics(newInstances),
    };
  }
}
```

## 6. Runtime Management

### 6.1 Process Supervisor

```typescript
// api/services/processSupervisor.ts
export class ProcessSupervisor {
  private processes: Map<string, ManagedProcess> = new Map();

  async startProcess(config: ProcessConfig): Promise<ManagedProcess> {
    const { appId, instanceId, command, environment, limits } = config;

    // Create systemd service unit
    const unitName = `skypanel-${appId}-${instanceId}.service`;
    const unitFile = this.generateSystemdUnit(config);

    await fs.writeFile(
      `/etc/systemd/system/${unitName}`,
      unitFile
    );

    // Reload systemd and start service
    await this.exec('systemctl daemon-reload');
    await this.exec(`systemctl start ${unitName}`);

    const process: ManagedProcess = {
      id: instanceId,
      appId,
      unitName,
      pid: await this.getPid(unitName),
      startTime: new Date(),
      status: 'running',
      restarts: 0,
      command,
      environment,
    };

    this.processes.set(instanceId, process);

    // Set up monitoring
    this.setupMonitoring(process);

    return process;
  }

  private generateSystemdUnit(config: ProcessConfig): string {
    const { appId, instanceId, command, environment, limits, user = 'skypanel' } = config;

    return `
[Unit]
Description=SkyPanel App ${appId} Instance ${instanceId}
After=network.target

[Service]
Type=simple
User=${user}
Group=${user}
WorkingDirectory=/apps/${appId}

# Command
ExecStart=${command}

# Environment
${Object.entries(environment || {})
  .map(([key, value]) => `Environment="${key}=${value}"`)
  .join('\n')}

# Resource limits
${limits?.memory ? `MemoryLimit=${limits.memory}` : ''}
${limits?.cpu ? `CPUQuota=${limits.cpu}%` : ''}
${limits?.io ? `IOWeight=${limits.io}` : ''}

# Restart policy
Restart=on-failure
RestartSec=10
MaxRestartSec=60

# Security
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/apps/${appId}/data

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=skypanel-${appId}

[Install]
WantedBy=multi-user.target
    `.trim();
  }

  async stopProcess(instanceId: string, graceful: boolean = true): Promise<void> {
    const process = this.processes.get(instanceId);
    if (!process) throw new Error(`Process ${instanceId} not found`);

    if (graceful) {
      // Send SIGTERM and wait
      await this.exec(`systemctl stop ${process.unitName}`);

      // Wait for graceful shutdown
      const timeout = 30000; // 30 seconds
      const started = Date.now();

      while (Date.now() - started < timeout) {
        if (!await this.isRunning(process.unitName)) {
          break;
        }
        await this.sleep(1000);
      }
    }

    // Force kill if still running
    if (await this.isRunning(process.unitName)) {
      await this.exec(`systemctl kill -s KILL ${process.unitName}`);
    }

    this.processes.delete(instanceId);
  }

  async getProcessMetrics(instanceId: string): Promise<ProcessMetrics> {
    const process = this.processes.get(instanceId);
    if (!process) throw new Error(`Process ${instanceId} not found`);

    // Get metrics from systemd
    const cpuUsage = await this.exec(
      `systemctl show ${process.unitName} -p CPUUsageNSec --value`
    );

    const memoryUsage = await this.exec(
      `systemctl show ${process.unitName} -p MemoryCurrent --value`
    );

    // Get additional metrics from /proc
    const procStats = await this.getProcStats(process.pid);

    return {
      cpu: {
        usage: parseInt(cpuUsage) / 1e9, // Convert nanoseconds to seconds
        userTime: procStats.utime,
        systemTime: procStats.stime,
      },
      memory: {
        current: parseInt(memoryUsage),
        peak: procStats.peakMemory,
        virtual: procStats.virtualMemory,
      },
      io: {
        readBytes: procStats.readBytes,
        writeBytes: procStats.writeBytes,
        readOps: procStats.readOps,
        writeOps: procStats.writeOps,
      },
      network: await this.getNetworkStats(process),
    };
  }
}
```

### 6.2 Container Runtime

```typescript
// api/services/containerRuntime.ts
export class ContainerRuntime {
  private runtime: 'nspawn' | 'firecracker' | 'gvisor';

  constructor(runtime: 'nspawn' | 'firecracker' | 'gvisor' = 'nspawn') {
    this.runtime = runtime;
  }

  async createContainer(config: ContainerConfig): Promise<Container> {
    switch (this.runtime) {
      case 'nspawn':
        return this.createNspawnContainer(config);
      case 'firecracker':
        return this.createFirecrackerVM(config);
      case 'gvisor':
        return this.createGvisorContainer(config);
    }
  }

  private async createNspawnContainer(config: ContainerConfig): Promise<Container> {
    const { appId, instanceId, rootfs, limits } = config;
    const containerName = `skypanel-${appId}-${instanceId}`;

    // Prepare container directory
    const containerDir = `/var/lib/machines/${containerName}`;
    await fs.ensureDir(containerDir);

    // Copy rootfs from NIX store
    await this.exec(`cp -a ${rootfs}/* ${containerDir}/`);

    // Create nspawn configuration
    const nspawnConfig = `
[Exec]
Boot=no
Parameters=${config.command}
Environment=${Object.entries(config.environment || {})
  .map(([k, v]) => `${k}=${v}`)
  .join(' ')}
WorkingDirectory=/app
User=${config.user || 'app'}

[Files]
BindReadOnly=/nix/store
Bind=/apps/${appId}/data:/data

[Network]
VirtualEthernet=yes
Bridge=br-skypanel

[Resources]
CPUQuota=${limits?.cpu || 100}%
MemoryMax=${limits?.memory || '512M'}
IOWeight=${limits?.io || 100}
    `.trim();

    await fs.writeFile(
      `/etc/systemd/nspawn/${containerName}.nspawn`,
      nspawnConfig
    );

    // Start container
    await this.exec(`machinectl start ${containerName}`);

    // Get container info
    const info = await this.getContainerInfo(containerName);

    return {
      id: containerName,
      type: 'nspawn',
      appId,
      instanceId,
      pid: info.leaderPid,
      ipAddress: info.ipAddress,
      status: 'running',
      startedAt: new Date(),
    };
  }

  private async createFirecrackerVM(config: ContainerConfig): Promise<Container> {
    const { appId, instanceId, rootfs, limits } = config;
    const vmId = `skypanel-${appId}-${instanceId}`;

    // Create VM configuration
    const vmConfig = {
      'boot-source': {
        'kernel_image_path': '/var/lib/firecracker/vmlinux',
        'boot_args': 'console=ttyS0 reboot=k panic=1 pci=off',
        'initrd_path': `/var/lib/firecracker/initrd-${appId}`,
      },
      'drives': [{
        'drive_id': 'rootfs',
        'path_on_host': rootfs,
        'is_root_device': true,
        'is_read_only': false,
      }],
      'machine-config': {
        'vcpu_count': limits?.cpu || 1,
        'mem_size_mib': parseInt(limits?.memory || '512'),
        'smt': false,
      },
      'network-interfaces': [{
        'iface_id': 'eth0',
        'guest_mac': this.generateMAC(),
        'host_dev_name': `tap-${vmId}`,
      }],
    };

    // Start Firecracker VM
    const socketPath = `/var/run/firecracker/${vmId}.sock`;
    const proc = spawn('firecracker', [
      '--api-sock', socketPath,
      '--config-file', '/dev/stdin',
    ]);

    proc.stdin.write(JSON.stringify(vmConfig));
    proc.stdin.end();

    // Wait for VM to start
    await this.waitForSocket(socketPath);

    // Configure networking
    await this.setupVMNetworking(vmId);

    return {
      id: vmId,
      type: 'firecracker',
      appId,
      instanceId,
      pid: proc.pid,
      ipAddress: await this.getVMIP(vmId),
      status: 'running',
      startedAt: new Date(),
    };
  }
}
```

## 7. Database Services

### 7.1 Database Addon System

```typescript
// api/services/databaseAddons.ts
export class DatabaseAddonService {
  private providers: Map<DatabaseType, DatabaseProvider> = new Map();

  constructor() {
    this.registerProvider('postgresql', new PostgreSQLProvider());
    this.registerProvider('mysql', new MySQLProvider());
    this.registerProvider('redis', new RedisProvider());
    this.registerProvider('mongodb', new MongoDBProvider());
    this.registerProvider('elasticsearch', new ElasticsearchProvider());
  }

  async provisionDatabase(
    appId: string,
    type: DatabaseType,
    tier: DatabaseTier
  ): Promise<DatabaseInstance> {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unsupported database type: ${type}`);
    }

    // Create database instance
    const instance = await provider.provision({
      name: `skypanel_${appId}_${type}`,
      tier,
      region: await this.getAppRegion(appId),
      version: await this.getLatestStableVersion(type),
      backupEnabled: tier !== 'dev',
      highAvailability: tier === 'production',
    });

    // Set up monitoring
    await this.setupMonitoring(instance);

    // Configure backup schedule
    if (tier !== 'dev') {
      await this.configureBackups(instance, {
        schedule: tier === 'production' ? '0 */6 * * *' : '0 2 * * *',
        retention: tier === 'production' ? 30 : 7,
      });
    }

    // Create connection credentials
    const credentials = await provider.createCredentials(instance);

    // Store encrypted credentials
    await this.storeCredentials(appId, instance.id, credentials);

    // Update app environment
    await this.updateAppEnvironment(appId, {
      [`${type.toUpperCase()}_URL`]: credentials.connectionString,
    });

    return instance;
  }

  async scaleDatabase(
    instanceId: string,
    newTier: DatabaseTier
  ): Promise<void> {
    const instance = await this.getInstance(instanceId);
    const provider = this.providers.get(instance.type);

    // Validate scaling path
    if (!this.canScale(instance.tier, newTier)) {
      throw new Error(`Cannot scale from ${instance.tier} to ${newTier}`);
    }

    // Create snapshot before scaling
    const snapshot = await provider.createSnapshot(instance);

    try {
      // Scale the instance
      await provider.scale(instance, {
        tier: newTier,
        cpu: this.getTierCPU(newTier),
        memory: this.getTierMemory(newTier),
        storage: this.getTierStorage(newTier),
      });

      // Wait for instance to be ready
      await this.waitForReady(instance, { timeout: 600000 });

      // Update monitoring thresholds
      await this.updateMonitoringThresholds(instance, newTier);

    } catch (error) {
      // Rollback on failure
      await provider.restoreFromSnapshot(instance, snapshot);
      throw error;
    }
  }

  async backupDatabase(instanceId: string): Promise<Backup> {
    const instance = await this.getInstance(instanceId);
    const provider = this.providers.get(instance.type);

    const backup = await provider.createBackup(instance, {
      type: 'manual',
      compression: true,
      encryption: true,
    });

    // Upload to S3
    await this.uploadBackupToS3(backup);

    // Update backup registry
    await this.registerBackup(instance.id, backup);

    return backup;
  }
}

// Database provider implementations
class PostgreSQLProvider implements DatabaseProvider {
  async provision(config: ProvisionConfig): Promise<DatabaseInstance> {
    // Create NIX derivation for PostgreSQL
    const derivation = `
      { pkgs ? import <nixpkgs> {} }:

      pkgs.postgresql_15.override {
        settings = {
          shared_buffers = "${this.calculateSharedBuffers(config.tier)}";
          max_connections = ${this.getMaxConnections(config.tier)};
          effective_cache_size = "${this.calculateCacheSize(config.tier)}";
          maintenance_work_mem = "${this.calculateMaintenanceMemory(config.tier)}";
          checkpoint_completion_target = 0.9;
          wal_buffers = "16MB";
          default_statistics_target = 100;
          random_page_cost = 1.1;
          effective_io_concurrency = 200;
          work_mem = "4MB";
          min_wal_size = "1GB";
          max_wal_size = "4GB";
        };
      }
    `;

    // Build and install PostgreSQL
    const storePath = await this.nixStore.buildDerivation(derivation);

    // Initialize database cluster
    const dataDir = `/var/lib/skypanel/postgres/${config.name}`;
    await this.exec(`${storePath}/bin/initdb -D ${dataDir}`);

    // Start PostgreSQL
    const instance = await this.startPostgreSQL(config, dataDir, storePath);

    // Create database and user
    await this.createDatabase(instance, config.name);

    // Set up replication if HA
    if (config.highAvailability) {
      await this.setupReplication(instance);
    }

    return instance;
  }

  async createBackup(
    instance: DatabaseInstance,
    options: BackupOptions
  ): Promise<Backup> {
    const backupPath = `/backups/${instance.id}/${Date.now()}.sql`;

    // Use pg_dump for logical backup
    await this.exec(`
      pg_dump \
        --host=${instance.host} \
        --port=${instance.port} \
        --username=${instance.username} \
        --dbname=${instance.database} \
        --file=${backupPath} \
        --format=custom \
        --compress=9 \
        --verbose
    `);

    // Encrypt if requested
    if (options.encryption) {
      await this.encryptFile(backupPath);
    }

    return {
      id: crypto.randomUUID(),
      instanceId: instance.id,
      type: 'logical',
      path: backupPath,
      size: await this.getFileSize(backupPath),
      createdAt: new Date(),
      encrypted: options.encryption,
    };
  }
}
```

## 8. Networking & Load Balancing

### 8.1 Load Balancer Service

```typescript
// api/services/loadBalancer.ts
export class LoadBalancerService {
  private backends: Map<string, Backend[]> = new Map();

  async configureLoadBalancer(app: Application): Promise<LoadBalancerConfig> {
    const config: LoadBalancerConfig = {
      appId: app.id,
      domains: app.domains,
      ssl: await this.getSSLConfig(app),
      backends: await this.getBackends(app),
      healthCheck: this.getHealthCheckConfig(app),
      rules: await this.generateRoutingRules(app),
    };

    // Generate Caddy configuration
    const caddyConfig = this.generateCaddyConfig(config);

    // Apply configuration
    await this.applyCaddyConfig(caddyConfig);

    return config;
  }

  private generateCaddyConfig(config: LoadBalancerConfig): string {
    return `
${config.domains.map(domain => `
${domain.name} {
  # TLS configuration
  ${config.ssl.enabled ? `
  tls ${config.ssl.email} {
    protocols tls1.2 tls1.3
    ciphers TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  }` : ''}

  # Request handling
  handle {
    # Rate limiting
    rate_limit {
      zone dynamic {
        key {remote_host}
        events 100
        window 60s
      }
    }

    # Load balancing
    reverse_proxy ${config.backends.map(b => b.url).join(' ')} {
      # Load balancing policy
      lb_policy ${config.loadBalancingPolicy || 'round_robin'}

      # Health checks
      health_uri ${config.healthCheck.path}
      health_interval ${config.healthCheck.interval}s
      health_timeout ${config.healthCheck.timeout}s
      health_status ${config.healthCheck.expectedStatus}

      # Circuit breaker
      circuit_breaker {
        threshold 0.5
        half_opens 3
        timeout 30s
      }

      # Retries
      retry {
        max_attempts 3
        duration 5s
      }

      # Headers
      header_up X-Real-IP {remote_host}
      header_up X-Forwarded-For {remote_host}
      header_up X-Forwarded-Proto {scheme}

      # Timeouts
      transport http {
        dial_timeout 10s
        response_header_timeout 10s
        expect_continue_timeout 1s
        max_idle_conns_per_host 100
      }
    }
  }

  # Error handling
  handle_errors {
    @404 {
      expression {http.error.status_code} == 404
    }
    respond @404 "Not Found" 404

    @5xx {
      expression {http.error.status_code} >= 500
    }
    respond @5xx "Internal Server Error" 500
  }

  # Logging
  log {
    output file /var/log/caddy/${domain.name}.log {
      roll_size 100mb
      roll_keep 10
    }
    format json
  }
}
`).join('\n')}
    `.trim();
  }

  async updateBackends(appId: string, backends: Backend[]): Promise<void> {
    this.backends.set(appId, backends);

    // Update Caddy configuration dynamically
    await this.updateCaddyBackends(appId, backends);

    // Verify configuration
    await this.verifyCaddyConfig();
  }

  async enableWebSockets(appId: string): Promise<void> {
    const config = await this.getConfig(appId);

    config.websocket = {
      enabled: true,
      path: '/ws',
      origins: config.domains.map(d => `https://${d.name}`),
    };

    await this.updateConfig(appId, config);
  }

  async configureRateLimiting(
    appId: string,
    limits: RateLimitConfig
  ): Promise<void> {
    const { requestsPerMinute, requestsPerHour, burstSize } = limits;

    const rateLimitConfig = `
    rate_limit {
      zone app_${appId} {
        key {remote_host}
        events ${requestsPerMinute}
        window 60s
        burst ${burstSize}
      }

      zone app_${appId}_hourly {
        key {remote_host}
        events ${requestsPerHour}
        window 3600s
      }
    }
    `;

    await this.applyCaddyDirective(appId, 'rate_limit', rateLimitConfig);
  }
}
```

### 8.2 Service Discovery

```typescript
// api/services/serviceDiscovery.ts
export class ServiceDiscovery {
  private consul: Consul;
  private services: Map<string, ServiceRegistration> = new Map();

  async registerService(
    appId: string,
    instance: Instance
  ): Promise<ServiceRegistration> {
    const registration: ServiceRegistration = {
      id: `${appId}-${instance.id}`,
      name: appId,
      address: instance.ipAddress,
      port: instance.port,
      tags: [
        `env:${instance.environment}`,
        `version:${instance.version}`,
        `region:${instance.region}`,
      ],
      check: {
        http: `http://${instance.ipAddress}:${instance.port}/health`,
        interval: '10s',
        timeout: '5s',
      },
      meta: {
        instanceId: instance.id,
        deploymentId: instance.deploymentId,
        startedAt: instance.startedAt.toISOString(),
      },
    };

    // Register with Consul
    await this.consul.agent.service.register(registration);

    // Store locally
    this.services.set(registration.id, registration);

    // Set up deregistration on shutdown
    this.setupDeregistration(registration);

    return registration;
  }

  async discoverService(appId: string): Promise<ServiceInstance[]> {
    const services = await this.consul.health.service(appId);

    return services
      .filter(s => s.Checks.every(c => c.Status === 'passing'))
      .map(s => ({
        id: s.Service.ID,
        address: s.Service.Address,
        port: s.Service.Port,
        tags: s.Service.Tags,
        meta: s.Service.Meta,
      }));
  }

  async watchService(
    appId: string,
    callback: (instances: ServiceInstance[]) => void
  ): Promise<() => void> {
    const watch = this.consul.watch({
      method: this.consul.health.service,
      options: {
        service: appId,
        passing: true,
      },
    });

    watch.on('change', (data) => {
      const instances = data.map(s => ({
        id: s.Service.ID,
        address: s.Service.Address,
        port: s.Service.Port,
        tags: s.Service.Tags,
        meta: s.Service.Meta,
      }));

      callback(instances);
    });

    watch.on('error', (error) => {
      console.error(`Service watch error for ${appId}:`, error);
    });

    return () => watch.end();
  }
}
```

## 9. Security Implementation

### 9.1 Security Manager

```typescript
// api/services/securityManager.ts
export class SecurityManager {
  async secureApplication(app: Application): Promise<SecurityConfig> {
    const config: SecurityConfig = {
      appId: app.id,
      isolation: await this.configureIsolation(app),
      secrets: await this.manageSecrets(app),
      network: await this.configureNetworkSecurity(app),
      runtime: await this.configureRuntimeSecurity(app),
      audit: await this.setupAuditLogging(app),
    };

    return config;
  }

  private async configureIsolation(app: Application): Promise<IsolationConfig> {
    return {
      // User namespace isolation
      userNamespace: {
        enabled: true,
        uidMapping: {
          containerUID: 1000,
          hostUID: 100000 + app.numericId,
          range: 65536,
        },
        gidMapping: {
          containerGID: 1000,
          hostGID: 100000 + app.numericId,
          range: 65536,
        },
      },
      },

      // Network namespace
      networkNamespace: {
        enabled: true,
        type: 'private',
        bridge: 'br-skypanel',
      },

      // Mount namespace
      mountNamespace: {
        enabled: true,
        readOnlyPaths: ['/usr', '/lib', '/lib64'],
        hiddenPaths: ['/proc/kcore', '/proc/kallsyms'],
        tmpfs: ['/tmp', '/var/tmp'],
      },

      // PID namespace
      pidNamespace: {
        enabled: true,
        maxProcesses: 1000,
      },

      // Capabilities
      capabilities: {
        drop: ['CAP_SYS_ADMIN', 'CAP_NET_RAW', 'CAP_SYS_MODULE'],
        ambient: ['CAP_NET_BIND_SERVICE'],
      },

      // Seccomp
      seccomp: {
        enabled: true,
        profile: 'default',
        syscalls: {
          allow: ['read', 'write', 'open', 'close', 'stat', 'fstat'],
          deny: ['mount', 'umount', 'pivot_root', 'chroot'],
        },
      },
    };
  }

  private async manageSecrets(app: Application): Promise<SecretsConfig> {
    const vaultPath = `secret/apps/${app.id}`;

    // Initialize Vault secrets engine
    await this.vault.mount(vaultPath, {
      type: 'kv-v2',
      description: `Secrets for app ${app.id}`,
    });

    // Generate encryption keys
    const encryptionKey = await this.generateKey(256);
    const signingKey = await this.generateKey(256);

    // Store keys in Vault
    await this.vault.write(`${vaultPath}/keys`, {
      encryption: encryptionKey,
      signing: signingKey,
    });

    // Setup automatic rotation
    await this.vault.write(`${vaultPath}/config/rotation`, {
      period: '90d',
      max_versions: 10,
    });

    return {
      engine: 'vault',
      path: vaultPath,
      rotation: true,
      encryption: 'aes-256-gcm',
    };
  }

  async scanForVulnerabilities(app: Application): Promise<VulnerabilityReport> {
    const scanners = [
      new TrivyScanner(),
      new SnykScanner(),
      new OWASPScanner(),
    ];

    const results = await Promise.all(
      scanners.map(scanner => scanner.scan(app))
    );

    return this.aggregateResults(results);
  }
}
```

## 10. Monitoring & Observability

### 10.1 Metrics Collection

```typescript
// api/services/metricsCollector.ts
export class MetricsCollector {
  private prometheus: PrometheusClient;
  private intervals: Map<string, NodeJS.Timer> = new Map();

  async collectApplicationMetrics(app: Application): Promise<void> {
    const instances = await this.getInstances(app.id);

    for (const instance of instances) {
      // CPU metrics
      this.prometheus.gauge('app_cpu_usage_percent', {
        app: app.id,
        instance: instance.id,
      }).set(await this.getCPUUsage(instance));

      // Memory metrics
      const memoryStats = await this.getMemoryStats(instance);
      this.prometheus.gauge('app_memory_usage_bytes', {
        app: app.id,
        instance: instance.id,
      }).set(memoryStats.used);

      this.prometheus.gauge('app_memory_limit_bytes', {
        app: app.id,
        instance: instance.id,
      }).set(memoryStats.limit);

      // Network metrics
      const networkStats = await this.getNetworkStats(instance);
      this.prometheus.counter('app_network_rx_bytes', {
        app: app.id,
        instance: instance.id,
      }).inc(networkStats.rxBytes);

      this.prometheus.counter('app_network_tx_bytes', {
        app: app.id,
        instance: instance.id,
      }).inc(networkStats.txBytes);

      // HTTP metrics (if applicable)
      if (app.type === 'web') {
        const httpStats = await this.getHTTPStats(instance);

        for (const [status, count] of Object.entries(httpStats.statusCodes)) {
          this.prometheus.counter('app_http_requests_total', {
            app: app.id,
            instance: instance.id,
            status,
          }).inc(count);
        }

        this.prometheus.histogram('app_http_request_duration_seconds', {
          app: app.id,
          instance: instance.id,
        }).observe(httpStats.avgResponseTime);
      }

      // Custom metrics
      const customMetrics = await this.getCustomMetrics(instance);
      for (const [name, value] of Object.entries(customMetrics)) {
        this.prometheus.gauge(`app_custom_${name}`, {
          app: app.id,
          instance: instance.id,
        }).set(value);
      }
    }
  }

  async setupMetricsEndpoint(app: Application): Promise<string> {
    const metricsPath = `/metrics/${app.id}`;

    // Configure Prometheus scraping
    await this.configurePrometheusScraping({
      job_name: `app_${app.id}`,
      scrape_interval: '30s',
      metrics_path: metricsPath,
      static_configs: [{
        targets: await this.getInstanceEndpoints(app.id),
      }],
    });

    return metricsPath;
  }
}
```

### 10.2 Logging System

```typescript
// api/services/loggingSystem.ts
export class LoggingSystem {
  private elasticsearch: ElasticsearchClient;
  private logStreams: Map<string, LogStream> = new Map();

  async setupApplicationLogging(app: Application): Promise<LoggingConfig> {
    // Create Elasticsearch index
    const indexName = `skypanel-app-${app.id}`;
    await this.createIndex(indexName);

    // Configure log forwarding
    const logConfig = {
      sources: [
        {
          type: 'stdout',
          parser: this.detectLogFormat(app),
        },
        {
          type: 'stderr',
          parser: 'raw',
        },
        {
          type: 'file',
          paths: ['/app/logs/*.log'],
          parser: 'json',
        },
      ],
      destination: {
        type: 'elasticsearch',
        index: indexName,
        pipeline: await this.createIngestPipeline(app),
      },
      filters: [
        {
          type: 'sanitize',
          patterns: ['password', 'token', 'secret'],
        },
        {
          type: 'enrich',
          fields: {
            app_id: app.id,
            environment: app.environment,
            version: app.version,
          },
        },
      ],
    };

    // Setup Vector for log aggregation
    await this.deployVector(app, logConfig);

    return logConfig;
  }

  async streamLogs(
    appId: string,
    options: StreamOptions = {}
  ): AsyncIterableIterator<LogEntry> {
    const {
      follow = false,
      tail = 100,
      since,
      until,
      level,
      pattern,
    } = options;

    const query = this.buildLogQuery(appId, { since, until, level, pattern });

    if (follow) {
      // Real-time streaming
      return this.streamRealtime(appId, query, tail);
    } else {
      // Historical logs
      return this.queryHistorical(appId, query, tail);
    }
  }

  private async* streamRealtime(
    appId: string,
    query: any,
    tail: number
  ): AsyncIterableIterator<LogEntry> {
    // Get initial logs
    const initial = await this.elasticsearch.search({
      index: `skypanel-app-${appId}`,
      body: {
        query,
        size: tail,
        sort: [{ '@timestamp': 'desc' }],
      },
    });

    for (const hit of initial.hits.hits.reverse()) {
      yield this.parseLogEntry(hit);
    }

    // Stream new logs
    const stream = new EventSource(`/api/apps/${appId}/logs/stream`);

    for await (const event of stream) {
      yield JSON.parse(event.data) as LogEntry;
    }
  }
}
```

### 10.3 Distributed Tracing

```typescript
// api/services/tracingService.ts
export class TracingService {
  private jaeger: JaegerClient;

  async setupTracing(app: Application): Promise<TracingConfig> {
    const config: TracingConfig = {
      serviceName: app.id,
      sampler: {
        type: 'adaptive',
        maxTracesPerSecond: 100,
      },
      reporter: {
        agentHost: 'jaeger-agent.skypanel.svc',
        agentPort: 6831,
      },
      tags: {
        'app.id': app.id,
        'app.version': app.version,
        'app.environment': app.environment,
      },
    };

    // Inject tracing configuration into app environment
    await this.injectTracingEnv(app, {
      OTEL_EXPORTER_JAEGER_ENDPOINT: 'http://jaeger-collector:14268/api/traces',
      OTEL_SERVICE_NAME: app.id,
      OTEL_TRACES_SAMPLER: 'parentbased_traceidratio',
      OTEL_TRACES_SAMPLER_ARG: '0.1',
    });

    return config;
  }

  async getTraces(appId: string, options: TraceQueryOptions): Promise<Trace[]> {
    const traces = await this.jaeger.getTraces({
      service: appId,
      start: options.start,
      end: options.end,
      minDuration: options.minDuration,
      maxDuration: options.maxDuration,
      limit: options.limit || 100,
    });

    return traces.map(trace => this.enrichTrace(trace));
  }
}
```

## 11. Auto-scaling Strategy

### 11.1 Auto-scaler Implementation

```typescript
// api/services/autoScaler.ts
export class AutoScaler {
  private scalingPolicies: Map<string, ScalingPolicy> = new Map();
  private scalingHistory: Map<string, ScalingEvent[]> = new Map();

  async createScalingPolicy(
    appId: string,
    policy: ScalingPolicy
  ): Promise<void> {
    this.scalingPolicies.set(appId, policy);

    // Start monitoring loop
    this.startMonitoring(appId, policy);
  }

  private async startMonitoring(appId: string, policy: ScalingPolicy): void {
    const interval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics(appId);
        const decision = await this.makeScalingDecision(policy, metrics);

        if (decision.action !== 'none') {
          await this.executeScaling(appId, decision);
        }
      } catch (error) {
        console.error(`Auto-scaling error for ${appId}:`, error);
      }
    }, policy.checkInterval || 30000);

    this.intervals.set(appId, interval);
  }

  private async makeScalingDecision(
    policy: ScalingPolicy,
    metrics: Metrics
  ): Promise<ScalingDecision> {
    const currentInstances = metrics.instanceCount;

    // Check CPU-based scaling
    if (policy.cpuThreshold) {
      if (metrics.avgCPU > policy.cpuThreshold.scaleUp) {
        return {
          action: 'scale-up',
          targetInstances: Math.min(
            currentInstances + (policy.scaleUpStep || 1),
            policy.maxInstances
          ),
          reason: `CPU usage ${metrics.avgCPU}% exceeds threshold ${policy.cpuThreshold.scaleUp}%`,
        };
      }

      if (metrics.avgCPU < policy.cpuThreshold.scaleDown) {
        return {
          action: 'scale-down',
          targetInstances: Math.max(
            currentInstances - (policy.scaleDownStep || 1),
            policy.minInstances
          ),
          reason: `CPU usage ${metrics.avgCPU}% below threshold ${policy.cpuThreshold.scaleDown}%`,
        };
      }
    }

    // Check memory-based scaling
    if (policy.memoryThreshold) {
      if (metrics.avgMemory > policy.memoryThreshold.scaleUp) {
        return {
          action: 'scale-up',
          targetInstances: Math.min(
            currentInstances + (policy.scaleUpStep || 1),
            policy.maxInstances
          ),
          reason: `Memory usage ${metrics.avgMemory}% exceeds threshold ${policy.memoryThreshold.scaleUp}%`,
        };
      }
    }

    // Check request rate-based scaling
    if (policy.requestRateThreshold) {
      const requestsPerInstance = metrics.requestRate / currentInstances;

      if (requestsPerInstance > policy.requestRateThreshold) {
        const targetInstances = Math.ceil(
          metrics.requestRate / policy.requestRateThreshold
        );

        return {
          action: 'scale-up',
          targetInstances: Math.min(targetInstances, policy.maxInstances),
          reason: `Request rate ${requestsPerInstance} req/s per instance exceeds threshold`,
        };
      }
    }

    // Check custom metrics
    if (policy.customMetrics) {
      for (const metric of policy.customMetrics) {
        const value = metrics.custom[metric.name];

        if (metric.type === 'threshold') {
          if (value > metric.scaleUp) {
            return {
              action: 'scale-up',
              targetInstances: Math.min(
                currentInstances + (policy.scaleUpStep || 1),
                policy.maxInstances
              ),
              reason: `Custom metric ${metric.name}=${value} exceeds threshold ${metric.scaleUp}`,
            };
          }
        }
      }
    }

    return { action: 'none' };
  }

  private async executeScaling(
    appId: string,
    decision: ScalingDecision
  ): Promise<void> {
    // Check cooldown period
    if (!this.checkCooldown(appId)) {
      console.log(`Skipping scaling for ${appId}: cooldown period active`);
      return;
    }

    // Record scaling event
    const event: ScalingEvent = {
      timestamp: new Date(),
      action: decision.action,
      fromInstances: await this.getCurrentInstanceCount(appId),
      toInstances: decision.targetInstances,
      reason: decision.reason,
    };

    this.recordScalingEvent(appId, event);

    // Execute scaling
    if (decision.action === 'scale-up') {
      await this.scaleUp(appId, decision.targetInstances);
    } else if (decision.action === 'scale-down') {
      await this.scaleDown(appId, decision.targetInstances);
    }
  }
}
```

## 12. API Design

### 12.1 RESTful API Endpoints

```typescript
// api/routes/paas.ts
export function setupPaaSRoutes(router: Router): void {
  // Application management
  router.post('/api/apps', authenticateToken, createApp);
  router.get('/api/apps', authenticateToken, listApps);
  router.get('/api/apps/:id', authenticateToken, getApp);
  router.patch('/api/apps/:id', authenticateToken, updateApp);
  router.delete('/api/apps/:id', authenticateToken, deleteApp);

  // Deployments
  router.post('/api/apps/:id/deployments', authenticateToken, deployApp);
  router.get('/api/apps/:id/deployments', authenticateToken, listDeployments);
  router.post('/api/apps/:id/rollback', authenticateToken, rollbackDeployment);

  // Configuration
  router.get('/api/apps/:id/config', authenticateToken, getConfig);
  router.put('/api/apps/:id/config', authenticateToken, setConfig);
  router.post('/api/apps/:id/config/vars', authenticateToken, setEnvVars);
  router.delete('/api/apps/:id/config/vars/:key', authenticateToken, unsetEnvVar);

  // Domains
  router.get('/api/apps/:id/domains', authenticateToken, listDomains);
  router.post('/api/apps/:id/domains', authenticateToken, addDomain);
  router.delete('/api/apps/:id/domains/:domain', authenticateToken, removeDomain);
  router.post('/api/apps/:id/domains/:domain/ssl', authenticateToken, enableSSL);

  // Scaling
  router.get('/api/apps/:id/scale', authenticateToken, getScale);
  router.put('/api/apps/:id/scale', authenticateToken, setScale);
  router.post('/api/apps/:id/autoscale', authenticateToken, configureAutoScale);

  // Logs & Metrics
  router.get('/api/apps/:id/logs', authenticateToken, streamLogs);
  router.get('/api/apps/:id/metrics', authenticateToken, getMetrics);
  router.get('/api/apps/:id/traces', authenticateToken, getTraces);

  // Addons
  router.get('/api/apps/:id/addons', authenticateToken, listAddons);
  router.post('/api/apps/:id/addons', authenticateToken, attachAddon);
  router.delete('/api/apps/:id/addons/:addonId', authenticateToken, detachAddon);

  // Builds
  router.post('/api/apps/:id/builds', authenticateToken, triggerBuild);
  router.get('/api/apps/:id/builds', authenticateToken, listBuilds);
  router.get('/api/apps/:id/builds/:buildId', authenticateToken, getBuild);
  router.get('/api/apps/:id/builds/:buildId/logs', authenticateToken, getBuildLogs);
}
```

### 12.2 WebSocket API

```typescript
// api/services/websocketAPI.ts
export class WebSocketAPI {
  setupWebSocketHandlers(io: Server): void {
    io.use(this.authenticateSocket);

    io.on('connection', (socket) => {
      const { appId, userId } = socket.data;

      // Join app room
      socket.join(`app:${appId}`);
      socket.join(`user:${userId}`);

      // Real-time logs
      socket.on('logs:subscribe', async (options) => {
        const stream = await this.loggingSystem.streamLogs(appId, {
          ...options,
          follow: true,
        });

        for await (const entry of stream) {
          socket.emit('logs:entry', entry);
        }
      });

      // Real-time metrics
      socket.on('metrics:subscribe', async (metrics: string[]) => {
        const interval = setInterval(async () => {
          const data = await this.metricsCollector.getMetrics(appId, metrics);
          socket.emit('metrics:update', data);
        }, 5000);

        socket.on('metrics:unsubscribe', () => {
          clearInterval(interval);
        });
      });

      // Deployment events
      socket.on('deployments:subscribe', () => {
        this.deploymentService.on(`deploy:${appId}`, (event) => {
          socket.emit('deployment:event', event);
        });
      });

      // Build events
      socket.on('builds:subscribe', (buildId: string) => {
        this.buildService.on(`build:${buildId}`, (event) => {
          socket.emit('build:event', event);
        });
      });

      // Instance events
      socket.on('instances:subscribe', () => {
        this.runtimeManager.on(`instances:${appId}`, (event) => {
          socket.emit('instance:event', event);
        });
      });
    });
  }
}
```

## 13. Frontend Integration

### 13.1 React Components Structure

```typescript
// src/components/paas/AppDashboard.tsx
export const AppDashboard: React.FC = () => {
  const { appId } = useParams();
  const { data: app, isLoading } = useQuery(['app', appId], () =>
    api.getApp(appId)
  );

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <AppHeader app={app} />

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Instances" value={app?.instances} />
        <MetricCard title="Memory" value={app?.metrics?.memory} />
        <MetricCard title="Requests/min" value={app?.metrics?.rpm} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AppOverview app={app} />
        </TabsContent>

        <TabsContent value="deployments">
          <DeploymentHistory appId={appId} />
        </TabsContent>

        <TabsContent value="logs">
          <LogViewer appId={appId} />
        </TabsContent>

        <TabsContent value="metrics">
          <MetricsDashboard appId={appId} />
        </TabsContent>

        <TabsContent value="settings">
          <AppSettings app={app} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

### 13.2 State Management

```typescript
// src/store/paasSlice.ts
export const paasSlice = createSlice({
  name: 'paas',
  initialState: {
    apps: [],
    selectedApp: null,
    deployments: {},
    builds: {},
    logs: {},
    metrics: {},
  },
  reducers: {
    setApps: (state, action) => {
      state.apps = action.payload;
    },
    updateApp: (state, action) => {
      const index = state.apps.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.apps[index] = action.payload;
      }
    },
    addDeployment: (state, action) => {
      const { appId, deployment } = action.payload;
      if (!state.deployments[appId]) {
        state.deployments[appId] = [];
      }
      state.deployments[appId].unshift(deployment);
    },
    appendLogs: (state, action) => {
      const { appId, entries } = action.payload;
      if (!state.logs[appId]) {
        state.logs[appId] = [];
      }
      state.logs[appId].push(...entries);
    },
    updateMetrics: (state, action) => {
      const { appId, metrics } = action.payload;
      state.metrics[appId] = metrics;
    },
  },
});
```

## 14. Migration Strategy

### 14.1 Heroku Migration Tool

```typescript
// api/services/herokuMigration.ts
export class HerokuMigrationService {
  async migrateApp(herokuApp: HerokuApp): Promise<MigrationResult> {
    const migration: Migration = {
      id: crypto.randomUUID(),
      sourceApp: herokuApp,
      status: 'in-progress',
      startedAt: new Date(),
      steps: [],
    };

    try {
      // Step 1: Analyze Heroku app
      migration.steps.push(await this.analyzeHerokuApp(herokuApp));

      // Step 2: Create SkyPanel app
      const app = await this.createApp({
        name: herokuApp.name,
        stack: this.mapHerokuStack(herokuApp.stack),
        region: this.mapRegion(herokuApp.region),
      });
      migration.targetApp = app;

      // Step 3: Migrate configuration
      await this.migrateConfig(herokuApp, app);
      migration.steps.push({ name: 'config', status: 'completed' });

      // Step 4: Migrate addons
      await this.migrateAddons(herokuApp, app);
      migration.steps.push({ name: 'addons', status: 'completed' });

      // Step 5: Migrate domains
      await this.migrateDomains(herokuApp, app);
      migration.steps.push({ name: 'domains', status: 'completed' });

      // Step 6: Migrate source code
      await this.migrateSourceCode(herokuApp, app);
      migration.steps.push({ name: 'source', status: 'completed' });

      // Step 7: Deploy application
      const deployment = await this.deployApp(app);
      migration.steps.push({ name: 'deploy', status: 'completed' });

      // Step 8: Verify migration
      await this.verifyMigration(herokuApp, app);
      migration.steps.push({ name: 'verify', status: 'completed' });

      migration.status = 'completed';
      migration.completedAt = new Date();

      return {
        success: true,
        migration,
        app,
      };

    } catch (error) {
      migration.status = 'failed';
      migration.error = error.message;
      throw error;
    }
  }

  private mapHerokuStack(herokuStack: string): string {
    const stackMap = {
      'heroku-20': 'ubuntu-20.04',
      'heroku-22': 'ubuntu-22.04',
      'container': 'docker',
    };

    return stackMap[herokuStack] || 'ubuntu-22.04';
  }

  private async migrateAddons(herokuApp: HerokuApp, app: Application): Promise<void> {
    const addonMap = {
      'heroku-postgresql': 'postgresql',
      'heroku-redis': 'redis',
      'mongolab': 'mongodb',
      'cleardb': 'mysql',
      'cloudamqp': 'rabbitmq',
    };

    for (const addon of herokuApp.addons) {
      const addonType = addonMap[addon.service];
      if (addonType) {
        await this.provisionAddon(app.id, addonType, addon.plan);
      }
    }
  }
}
```

## 15. Testing Strategy

### 15.1 Integration Tests

```typescript
// tests/paas/integration.test.ts
describe('PaaS Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe('Application Lifecycle', () => {
    test('should create application', async () => {
      app = await paasService.createApp({
        name: 'test-app',
        stack: 'nodejs',
      });

      expect(app).toBeDefined();
      expect(app.status).toBe('created');
    });

    test('should deploy application', async () => {
      const deployment = await paasService.deploy(app.id, {
        source: 'https://github.com/example/app.git',
        branch: 'main',
      });

      expect(deployment.status).toBe('success');

      // Wait for app to be running
      await waitFor(async () => {
        const status = await paasService.getAppStatus(app.id);
        return status === 'running';
      });
    });

    test('should handle traffic', async () => {
      const response = await fetch(`https://${app.id}.skypanel.app`);
      expect(response.status).toBe(200);
    });

    test('should scale application', async () => {
      await paasService.scale(app.id, 3);

      const instances = await paasService.getInstances(app.id);
      expect(instances.length).toBe(3);
    });

    test('should handle rollback', async () => {
      const deployment = await paasService.deploy(app.id, {
        source: 'https://github.com/example/app.git',
        branch: 'broken',
      });

      expect(deployment.status).toBe('failed');

      await paasService.rollback(app.id);

      const status = await paasService.getAppStatus(app.id);
      expect(status).toBe('running');
    });
  });

  describe('Load Testing', () => {
    test('should handle concurrent deployments', async () => {
      const deployments = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          paasService.createApp({
            name: `load-test-${i}`,
            stack: 'static',
          }).then(app =>
            paasService.deploy(app.id, {
              source: 'test-source',
            })
          )
        )
      );

      expect(deployments.every(d => d.status === 'success')).toBe(true);
    });

    test('should auto-scale under load', async () => {
      await paasService.configureAutoScale(app.id, {
        minInstances: 1,
        maxInstances: 5,
        cpuThreshold: { scaleUp: 70, scaleDown: 30 },
      });

      // Generate load
      await generateLoad(`https://${app.id}.skypanel.app`, {
        duration: 60,
        rps: 1000,
      });

      // Check that scaling occurred
      const instances =
      const instances = await paasService.getInstances(app.id);
      expect(instances.length).toBeGreaterThan(1);
      expect(instances.length).toBeLessThanOrEqual(5);
    });
  });
});
```

### 15.2 Performance Tests

```typescript
// tests/paas/performance.test.ts
describe('PaaS Performance Tests', () => {
  test('build performance', async () => {
    const builds = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        measurePerformance(async () => {
          const build = await buildService.triggerBuild({
            source: 'test-repo',
            stack: 'nodejs',
          });

          await waitForBuildComplete(build.id);
          return build;
        })
      )
    );

    const avgBuildTime = builds.reduce((sum, b) => sum + b.duration, 0) / builds.length;
    expect(avgBuildTime).toBeLessThan(120000); // 2 minutes
  });

  test('deployment performance', async () => {
    const deploymentTime = await measurePerformance(async () => {
      await paasService.deploy(app.id, {
        strategy: 'blue-green',
        source: 'prebuilt',
      });
    });

    expect(deploymentTime).toBeLessThan(30000); // 30 seconds
  });

  test('cold start performance', async () => {
    await paasService.scale(app.id, 0);
    await sleep(60000); // Wait for complete shutdown

    const firstRequestTime = await measurePerformance(async () => {
      const response = await fetch(`https://${app.id}.skypanel.app`);
      return response;
    });

    expect(firstRequestTime).toBeLessThan(5000); // 5 seconds
  });
});
```

## 16. Performance Optimization

### 16.1 Build Cache Optimization

```typescript
// api/services/buildOptimization.ts
export class BuildOptimizer {
  async optimizeBuildCache(app: Application): Promise<CacheStrategy> {
    const analysis = await this.analyzeBuildPatterns(app);

    return {
      // Layer caching for Docker builds
      layerCaching: {
        enabled: true,
        maxLayers: 50,
        strategy: 'content-hash',
        storage: 's3',
      },

      // Dependency caching
      dependencyCache: {
        nodejs: {
          paths: ['node_modules', '.pnpm-store'],
          key: 'package-lock.json',
          restore_keys: ['package-lock', 'package'],
        },
        python: {
          paths: ['.venv', 'pip-cache'],
          key: 'requirements.txt',
          restore_keys: ['requirements'],
        },
        rust: {
          paths: ['target', '.cargo'],
          key: 'Cargo.lock',
          restore_keys: ['Cargo'],
        },
      },

      // Build artifact caching
      artifactCache: {
        enabled: true,
        compression: 'zstd',
        maxSize: '5GB',
        ttl: 7 * 24 * 60 * 60, // 7 days
      },

      // Distributed cache
      distributedCache: {
        enabled: true,
        nodes: ['cache1.skypanel.internal', 'cache2.skypanel.internal'],
        replication: 2,
      },
    };
  }

  async implementNixCacheOptimizations(): Promise<void> {
    // Configure Cachix for NIX builds
    await this.exec('cachix use skypanel');

    // Setup local NIX store optimization
    await this.nixStore.optimizeStore();

    // Configure binary cache
    await this.configureBinaryCache({
      url: 'https://cache.skypanel.app',
      publicKey: process.env.NIX_CACHE_PUBLIC_KEY,
      priority: 40,
    });

    // Enable content-addressed derivations
    await this.enableCADerivations();
  }
}
```

### 16.2 Runtime Performance

```typescript
// api/services/runtimeOptimization.ts
export class RuntimeOptimizer {
  async optimizeRuntime(app: Application): Promise<RuntimeOptimizations> {
    return {
      // JIT compilation for dynamic languages
      jit: {
        nodejs: {
          enabled: true,
          v8Flags: '--max-old-space-size=4096 --optimize-for-size',
        },
        python: {
          enabled: true,
          pypy: app.requirements?.performance === 'high',
        },
        ruby: {
          enabled: true,
          jitMode: 'mjit',
        },
      },

      // Memory optimization
      memory: {
        swappiness: 10,
        hugepages: app.tier === 'production',
        oomKillDisable: false,
        memoryHighWatermark: 0.9,
      },

      // Network optimization
      network: {
        tcpNoDelay: true,
        tcpQuickAck: true,
        keepAlive: {
          enabled: true,
          time: 60,
          interval: 10,
          probes: 6,
        },
        congestionControl: 'bbr',
      },

      // File system optimization
      filesystem: {
        noatime: true,
        directIO: app.type === 'database',
        readahead: 128,
        writebackPercent: 5,
      },
    };
  }
}
```

## 17. Disaster Recovery

### 17.1 Backup Strategy

```typescript
// api/services/disasterRecovery.ts
export class DisasterRecoveryService {
  async setupBackupStrategy(app: Application): Promise<BackupStrategy> {
    return {
      // Application state backup
      appState: {
        frequency: 'hourly',
        retention: {
          hourly: 24,
          daily: 7,
          weekly: 4,
          monthly: 12,
        },
        storage: {
          primary: 's3',
          secondary: 'glacier',
          crossRegion: true,
        },
      },

      // Database backups
      database: {
        strategy: 'continuous',
        pointInTimeRecovery: true,
        retentionDays: 30,
        crossRegionReplica: app.tier === 'production',
      },

      // File storage backup
      fileStorage: {
        enabled: true,
        incremental: true,
        encryption: 'aes-256-gcm',
        verification: 'sha256',
      },

      // Configuration backup
      configuration: {
        versionControl: true,
        encryption: true,
        auditLog: true,
      },
    };
  }

  async createDisasterRecoveryPlan(app: Application): Promise<DRPlan> {
    return {
      rto: app.tier === 'production' ? 15 : 60, // minutes
      rpo: app.tier === 'production' ? 5 : 30, // minutes

      failoverStrategy: {
        automatic: app.tier === 'production',
        healthCheckFailures: 3,
        failoverTime: 30, // seconds
        primaryRegion: app.region,
        failoverRegions: ['us-west-2', 'eu-west-1'],
      },

      recoveryProcedures: [
        {
          name: 'Database Recovery',
          steps: [
            'Identify last known good backup',
            'Restore to new instance',
            'Verify data integrity',
            'Update connection strings',
          ],
          estimatedTime: 10, // minutes
        },
        {
          name: 'Application Recovery',
          steps: [
            'Deploy last known good release',
            'Restore configuration',
            'Verify health checks',
            'Enable traffic',
          ],
          estimatedTime: 5, // minutes
        },
      ],

      testingSchedule: {
        frequency: 'monthly',
        scope: 'full',
        notification: ['ops-team@company.com'],
      },
    };
  }
}
```

### 17.2 High Availability Setup

```typescript
// api/services/highAvailability.ts
export class HighAvailabilityService {
  async setupHA(app: Application): Promise<HAConfiguration> {
    return {
      // Multi-region deployment
      regions: {
        primary: 'us-east-1',
        secondary: ['us-west-2', 'eu-west-1'],
        trafficDistribution: {
          'us-east-1': 40,
          'us-west-2': 30,
          'eu-west-1': 30,
        },
      },

      // Load balancing
      loadBalancing: {
        type: 'global',
        algorithm: 'geoproximity',
        healthChecks: {
          interval: 30,
          timeout: 5,
          unhealthyThreshold: 2,
          healthyThreshold: 3,
        },
        failoverPriority: ['us-west-2', 'eu-west-1'],
      },

      // Database replication
      database: {
        replicationMode: 'async',
        replicas: 2,
        readReplicas: {
          'us-west-2': 1,
          'eu-west-1': 1,
        },
        failoverMode: 'automatic',
        consistencyLevel: 'eventual',
      },

      // State synchronization
      stateSync: {
        method: 'raft',
        nodes: 3,
        heartbeatInterval: 1000, // ms
        electionTimeout: 5000, // ms
      },
    };
  }
}
```

## 18. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Week 1-2: Core Infrastructure**
- Set up NIX package management system
- Implement basic container runtime (systemd-nspawn)
- Create database schema for PaaS components
- Set up development and testing environments

**Week 3-4: Build System**
- Implement buildpack detection system
- Create Node.js and Python buildpacks
- Set up build caching infrastructure
- Implement basic CI/CD pipeline

**Deliverables:**
- Working NIX environment
- Basic build and deployment for Node.js/Python apps
- Database migrations for PaaS tables

### Phase 2: Runtime & Orchestration (Weeks 5-8)

**Week 5-6: Process Management**
- Implement process supervisor with systemd
- Create health checking system
- Build resource limit enforcement
- Develop instance lifecycle management

**Week 7-8: Networking & Load Balancing**
- Set up Caddy for reverse proxy/load balancing
- Implement SSL certificate management
- Create service discovery mechanism
- Build traffic routing rules engine

**Deliverables:**
- Running applications with health checks
- Working load balancer with SSL support
- Service discovery and registration

### Phase 3: Developer Experience (Weeks 9-12)

**Week 9-10: API & CLI**
- Build comprehensive REST API
- Implement WebSocket endpoints for real-time features
- Create CLI tool for deployment and management
- Develop GitHub Actions integration

**Week 11-12: Frontend Dashboard**
- Create React components for app management
- Build real-time log viewer
- Implement metrics dashboards
- Design deployment interface

**Deliverables:**
- Full API with documentation
- CLI tool with all core features
- Web dashboard with core functionality

### Phase 4: Advanced Features (Weeks 13-16)

**Week 13-14: Monitoring & Observability**
- Integrate Prometheus for metrics
- Set up Elasticsearch for logging
- Implement distributed tracing with Jaeger
- Create alerting system

**Week 15-16: Auto-scaling & Optimization**
- Build auto-scaling engine
- Implement various scaling strategies
- Create performance optimization system
- Develop cost optimization features

**Deliverables:**
- Complete monitoring stack
- Auto-scaling with multiple strategies
- Performance optimization tools

### Phase 5: Enterprise Features (Weeks 17-20)

**Week 17-18: Security & Compliance**
- Implement security scanning
- Build secrets management
- Create audit logging
- Develop compliance reporting

**Week 19-20: High Availability & DR**
- Set up multi-region support
- Implement backup and restore
- Create disaster recovery procedures
- Build failover mechanisms

**Deliverables:**
- Security and compliance features
- High availability setup
- Disaster recovery plan

### Phase 6: Migration & Launch (Weeks 21-24)

**Week 21-22: Migration Tools**
- Build Heroku migration tool
- Create import/export functionality
- Develop data migration scripts
- Test migration paths

**Week 23-24: Production Readiness**
- Performance testing and optimization
- Security audit and fixes
- Documentation completion
- Beta testing with select users

**Deliverables:**
- Migration tools and documentation
- Production-ready platform
- Complete documentation

## 19. Technical Requirements

### 19.1 Infrastructure Requirements

```yaml
# Minimum Infrastructure Requirements
compute:
  controlPlane:
    nodes: 3
    cpu: 8 cores
    memory: 32GB
    storage: 500GB SSD

  workerNodes:
    minNodes: 3
    maxNodes: 100
    cpu: 16 cores
    memory: 64GB
    storage: 1TB SSD

networking:
  publicIPs: 10
  loadBalancers: 2
  bandwidth: 10Gbps

storage:
  objectStorage: 10TB
  blockStorage: 5TB
  backupStorage: 20TB

database:
  postgresql:
    version: "15+"
    replicas: 2
    storage: 500GB

  redis:
    version: "7+"
    memory: 16GB
    persistence: true
```

### 19.2 Software Requirements

```yaml
# Software Stack Requirements
runtime:
  nix:
    version: "2.13+"
    features: ["flakes", "ca-derivations"]

  container:
    systemd: "250+"
    systemd-nspawn: "250+"

languages:
  nodejs: ["14", "16", "18", "20"]
  python: ["3.8", "3.9", "3.10", "3.11", "3.12"]
  ruby: ["2.7", "3.0", "3.1", "3.2"]
  go: ["1.19", "1.20", "1.21"]
  rust: ["stable", "nightly"]
  java: ["11", "17", "21"]

monitoring:
  prometheus: "2.40+"
  grafana: "9.0+"
  elasticsearch: "8.0+"
  jaeger: "1.40+"

networking:
  caddy: "2.7+"
  wireguard: "1.0+"
  consul: "1.16+"
```

### 19.3 Security Requirements

- **Encryption**: AES-256-GCM for data at rest, TLS 1.3 for data in transit
- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: RBAC with fine-grained permissions
- **Secrets Management**: Vault or integrated secrets store
- **Network Security**: Private networks, firewall rules, DDoS protection
- **Compliance**: SOC2, GDPR, HIPAA-ready infrastructure
- **Audit Logging**: Complete audit trail of all operations
- **Vulnerability Scanning**: Regular security scans of containers and dependencies

## 20. Cost Analysis

### 20.1 Development Costs

```
Initial Development (24 weeks):
- 3 Senior Engineers @ $150/hour: $54,000/week
- 2 DevOps Engineers @ $140/hour: $22,400/week
- 1 UI/UX Designer @ $120/hour (12 weeks): $4,800/week
- 1 Technical Writer @ $80/hour (8 weeks): $3,200/week

Total Development: ~$1,500,000
```

### 20.2 Infrastructure Costs (Monthly)

```
Base Infrastructure:
- Control Plane (3 nodes): $1,500
- Worker Nodes (10 initial): $5,000
- Load Balancers: $500
- Storage (S3-compatible): $1,000
- Database Instances: $1,000
- Monitoring Stack: $500
- Backup Storage: $500
- Network Transfer: $2,000

Total Monthly: ~$12,000

Per-App Costs:
- Small (1 instance): $10-20/month
- Medium (3 instances): $50-100/month
- Large (10+ instances): $200-500/month
```

### 20.3 Operational Costs

```
Ongoing Operations:
- DevOps Team (2 FTE): $25,000/month
- On-call Support: $5,000/month
- Security Audits: $10,000/quarter
- Infrastructure Scaling: Variable
- Third-party Services: $3,000/month
```

### 20.4 Revenue Projections

```
Pricing Tiers:
- Hobby: $7/month (1 app, 512MB RAM)
- Starter: $25/month (3 apps, 1GB RAM each)
- Professional: $100/month (10 apps, 2GB RAM each)
- Business: $500/month (unlimited apps, custom resources)
- Enterprise: Custom pricing

Break-even Analysis:
- Fixed Costs: $50,000/month
- Variable Cost per Customer: $15/month average
- Average Revenue per Customer: $75/month
- Break-even: ~835 customers
- Target Year 1: 2,000 customers
- Projected Revenue Year 1: $1,800,000
```

### 20.5 ROI Analysis

```
Investment Recovery Timeline:
- Initial Investment: $1,500,000
- Monthly Operating Costs: $50,000
- Monthly Revenue (Year 1 avg): $150,000
- Monthly Profit: $100,000
- ROI Period: 15 months

5-Year Projection:
- Total Investment: $2,500,000
- Total Revenue: $15,000,000
- Total Profit: $12,500,000
- ROI: 400%
```

## Conclusion

This comprehensive plan provides a detailed roadmap for implementing a Platform as a Service solution using NIX packages within the SkyPanelV2 ecosystem. The implementation leverages NIX's reproducible builds and declarative configuration to provide a robust, scalable alternative to Heroku.

The phased approach ensures manageable milestones while building toward a full-featured PaaS platform. With proper execution, this platform can serve as a competitive alternative in the PaaS market while integrating seamlessly with SkyPanelV2's existing infrastructure management capabilities.

Key success factors:
- Leveraging NIX for reproducible, reliable deployments
- Focus on developer experience and ease of migration
- Strong security and compliance features
- Competitive pricing with transparent costs
- Seamless integration with existing SkyPanelV2 features

The platform is designed to scale from hobby projects to enterprise applications, providing a growth path for customers while maintaining operational efficiency and profitability.
