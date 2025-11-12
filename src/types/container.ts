/**
 * Container Platform Type Definitions
 */

export type ContainerServiceStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "stopped"
  | "failed"
  | "deleted";

export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "stopped"
  | "failed"
  | "rolled_back";

export type BuildStatus =
  | "pending"
  | "building"
  | "success"
  | "failed"
  | "cancelled";

export interface ResourceLimits {
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}

export interface BuildConfig {
  nixExpression?: string;
  buildCommand?: string;
  outputPath?: string;
  environmentType: "nix" | "docker" | "buildpack";
}

export interface ContainerService {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  templateId?: string;
  gitRepository?: string;
  gitBranch: string;
  buildConfig: BuildConfig;
  environmentVars: Record<string, string>;
  resourceLimits: ResourceLimits;
  status: ContainerServiceStatus;
  currentDeploymentId?: string;
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerDeployment {
  id: string;
  serviceId: string;
  workerId?: string;
  swarmServiceId?: string;
  containerId?: string;
  imageTag: string;
  status: DeploymentStatus;
  buildLogs?: string;
  deploymentLogs?: string;
  publicUrl?: string;
  internalPort?: number;
  externalPort?: number;
  deployedAt?: string;
  stoppedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerBuild {
  id: string;
  serviceId: string;
  deploymentId?: string;
  gitCommitSha?: string;
  buildStatus: BuildStatus;
  buildLogs?: string;
  imageTag?: string;
  buildDurationSeconds?: number;
  artifactSizeMb?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  category: "web" | "api" | "worker" | "database" | "static" | "custom";
  iconUrl?: string;
  nixExpression: string;
  defaultEnvVars: Record<string, string>;
  defaultResourceLimits: ResourceLimits;
  isActive: boolean;
  displayOrder: number;
  isMultiService: boolean;
  services?: {
    name: string;
    nixExpression: string;
    resourceLimits: ResourceLimits;
    dependencies: string[];
    environmentVars: Record<string, string>;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainerMetrics {
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadBytes: number;
  diskWriteBytes: number;
  timestamp: string;
}

export interface ContainerSecret {
  id: string;
  organizationId: string;
  name: string;
  createdBy: string;
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  swarmNodeId?: string;
  status: "pending" | "active" | "unhealthy" | "draining" | "offline";
  capacity: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  currentLoad: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    containerCount: number;
  };
  lastHeartbeatAt?: string;
  metadata: {
    osVersion?: string;
    dockerVersion?: string;
    nixVersion?: string;
    region?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContainerBillingCycle {
  id: string;
  serviceId: string;
  organizationId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  cpuHours: number;
  memoryGbHours: number;
  storageGbHours: number;
  networkGb: number;
  buildMinutes: number;
  totalAmount: number;
  status: "pending" | "billed" | "failed" | "refunded";
  paymentTransactionId?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
