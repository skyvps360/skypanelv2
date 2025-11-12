/**
 * Container Platform API Client
 * Handles all container-related API calls
 */

import { apiClient } from "./api";
import type {
  ContainerService,
  ContainerDeployment,
  ContainerBuild,
  ApplicationTemplate,
  ContainerMetrics,
  ContainerSecret,
  WorkerNode,
  ContainerBillingCycle,
} from "@/types/container";

export interface ListServicesParams {
  status?: string;
  template?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListServicesResponse {
  services: ContainerService[];
  total: number;
  hasMore: boolean;
}

export interface CreateServiceParams {
  name: string;
  templateId?: string;
  gitRepository?: string;
  gitBranch?: string;
  buildConfig?: {
    nixExpression?: string;
    buildCommand?: string;
    outputPath?: string;
    environmentType?: "nix" | "docker" | "buildpack";
  };
  environmentVars?: Record<string, string>;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  secretIds?: string[];
}

export interface UpdateServiceParams {
  name?: string;
  gitBranch?: string;
  environmentVars?: Record<string, string>;
  resourceLimits?: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
}

export interface ServiceActionResponse {
  success: boolean;
  message: string;
  serviceId: string;
}

export interface LogsParams {
  lines?: number;
  since?: string;
  level?: string;
  search?: string;
}

export interface LogsResponse {
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    containerId?: string;
  }>;
  hasMore: boolean;
}

export interface MetricsParams {
  timeRange?: "1h" | "24h" | "7d" | "30d";
  startTime?: string;
  endTime?: string;
}

export interface MetricsResponse {
  metrics: ContainerMetrics[];
  summary: {
    avgCpuPercent: number;
    avgMemoryMb: number;
    totalNetworkInGb: number;
    totalNetworkOutGb: number;
    totalCost: number;
  };
}

/**
 * Container Service API
 */
export const containerServiceApi = {
  /**
   * List all container services
   */
  async listServices(params?: ListServicesParams): Promise<ListServicesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.template) queryParams.append("template", params.template);
    if (params?.search) queryParams.append("search", params.search);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const query = queryParams.toString();
    const path = `/containers/services${query ? `?${query}` : ""}`;
    return apiClient.get<ListServicesResponse>(path);
  },

  /**
   * Get a single container service by ID
   */
  async getService(serviceId: string): Promise<ContainerService> {
    return apiClient.get<ContainerService>(`/containers/services/${serviceId}`);
  },

  /**
   * Create a new container service
   */
  async createService(params: CreateServiceParams): Promise<ContainerService> {
    return apiClient.post<ContainerService>("/containers/services", params);
  },

  /**
   * Update a container service
   */
  async updateService(
    serviceId: string,
    params: UpdateServiceParams
  ): Promise<ContainerService> {
    return apiClient.patch<ContainerService>(
      `/containers/services/${serviceId}`,
      params
    );
  },

  /**
   * Delete a container service
   */
  async deleteService(serviceId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(
      `/containers/services/${serviceId}`
    );
  },

  /**
   * Deploy a container service
   */
  async deployService(
    serviceId: string,
    gitCommitSha?: string
  ): Promise<ServiceActionResponse> {
    return apiClient.post<ServiceActionResponse>(
      `/containers/services/${serviceId}/deploy`,
      { gitCommitSha }
    );
  },

  /**
   * Start a container service
   */
  async startService(serviceId: string): Promise<ServiceActionResponse> {
    return apiClient.post<ServiceActionResponse>(
      `/containers/services/${serviceId}/start`
    );
  },

  /**
   * Stop a container service
   */
  async stopService(serviceId: string): Promise<ServiceActionResponse> {
    return apiClient.post<ServiceActionResponse>(
      `/containers/services/${serviceId}/stop`
    );
  },

  /**
   * Restart a container service
   */
  async restartService(serviceId: string): Promise<ServiceActionResponse> {
    return apiClient.post<ServiceActionResponse>(
      `/containers/services/${serviceId}/restart`
    );
  },

  /**
   * Rebuild and redeploy a container service
   */
  async rebuildService(serviceId: string): Promise<ServiceActionResponse> {
    return apiClient.post<ServiceActionResponse>(
      `/containers/services/${serviceId}/rebuild`
    );
  },

  /**
   * Get service logs
   */
  async getServiceLogs(
    serviceId: string,
    params?: LogsParams
  ): Promise<LogsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.lines) queryParams.append("lines", params.lines.toString());
    if (params?.since) queryParams.append("since", params.since);
    if (params?.level) queryParams.append("level", params.level);
    if (params?.search) queryParams.append("search", params.search);

    const query = queryParams.toString();
    const path = `/containers/services/${serviceId}/logs${query ? `?${query}` : ""}`;
    return apiClient.get<LogsResponse>(path);
  },

  /**
   * Get service metrics
   */
  async getServiceMetrics(
    serviceId: string,
    params?: MetricsParams
  ): Promise<MetricsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append("timeRange", params.timeRange);
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);

    const query = queryParams.toString();
    const path = `/containers/services/${serviceId}/metrics${query ? `?${query}` : ""}`;
    return apiClient.get<MetricsResponse>(path);
  },

  /**
   * Get service deployments
   */
  async getServiceDeployments(
    serviceId: string
  ): Promise<{ deployments: ContainerDeployment[] }> {
    return apiClient.get<{ deployments: ContainerDeployment[] }>(
      `/containers/services/${serviceId}/deployments`
    );
  },

  /**
   * Get service builds
   */
  async getServiceBuilds(
    serviceId: string
  ): Promise<{ builds: ContainerBuild[] }> {
    return apiClient.get<{ builds: ContainerBuild[] }>(
      `/containers/services/${serviceId}/builds`
    );
  },

  /**
   * Get webhook URL for a service
   */
  async getWebhookUrl(serviceId: string): Promise<{ webhookUrl: string }> {
    return apiClient.get<{ webhookUrl: string }>(
      `/containers/services/${serviceId}/webhook-url`
    );
  },
};

/**
 * Template API
 */
export const templateApi = {
  /**
   * List all templates
   */
  async listTemplates(): Promise<{ templates: ApplicationTemplate[] }> {
    return apiClient.get<{ templates: ApplicationTemplate[] }>("/templates");
  },

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string): Promise<ApplicationTemplate> {
    return apiClient.get<ApplicationTemplate>(`/templates/${templateId}`);
  },

  /**
   * Deploy from a template
   */
  async deployFromTemplate(
    templateId: string,
    params: Omit<CreateServiceParams, "templateId">
  ): Promise<ContainerService> {
    return apiClient.post<ContainerService>(`/templates/${templateId}/deploy`, params);
  },
};

/**
 * Secrets API
 */
export const secretsApi = {
  /**
   * List all secrets
   */
  async listSecrets(): Promise<{ secrets: ContainerSecret[] }> {
    return apiClient.get<{ secrets: ContainerSecret[] }>("/secrets");
  },

  /**
   * Create a new secret
   */
  async createSecret(params: {
    name: string;
    value: string;
  }): Promise<ContainerSecret> {
    return apiClient.post<ContainerSecret>("/secrets", params);
  },

  /**
   * Update a secret
   */
  async updateSecret(
    secretId: string,
    params: { value: string; restartServices?: boolean }
  ): Promise<ContainerSecret> {
    return apiClient.patch<ContainerSecret>(`/secrets/${secretId}`, params);
  },

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/secrets/${secretId}`);
  },

  /**
   * Get services using a secret
   */
  async getSecretServices(
    secretId: string
  ): Promise<{ services: ContainerService[] }> {
    return apiClient.get<{ services: ContainerService[] }>(
      `/secrets/${secretId}/services`
    );
  },
};

/**
 * Worker API (Admin only)
 */
export const workerApi = {
  /**
   * List all workers
   */
  async listWorkers(): Promise<{ workers: WorkerNode[] }> {
    return apiClient.get<{ workers: WorkerNode[] }>("/workers");
  },

  /**
   * Get a single worker by ID
   */
  async getWorker(workerId: string): Promise<WorkerNode> {
    return apiClient.get<WorkerNode>(`/workers/${workerId}`);
  },

  /**
   * Generate worker installation script
   */
  async generateWorkerScript(): Promise<{ script: string; token: string }> {
    return apiClient.post<{ script: string; token: string }>(
      "/workers/generate-script"
    );
  },

  /**
   * Remove a worker
   */
  async removeWorker(workerId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/workers/${workerId}`);
  },

  /**
   * Drain a worker
   */
  async drainWorker(workerId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/workers/${workerId}/drain`);
  },

  /**
   * Get worker metrics
   */
  async getWorkerMetrics(
    workerId: string
  ): Promise<{ metrics: ContainerMetrics[] }> {
    return apiClient.get<{ metrics: ContainerMetrics[] }>(
      `/workers/${workerId}/metrics`
    );
  },

  /**
   * Get containers on a worker
   */
  async getWorkerContainers(
    workerId: string
  ): Promise<{ containers: ContainerService[] }> {
    return apiClient.get<{ containers: ContainerService[] }>(
      `/workers/${workerId}/containers`
    );
  },

  /**
   * Get cluster status
   */
  async getClusterStatus(): Promise<{
    totalCapacity: { cpuCores: number; memoryMb: number; diskGb: number };
    totalUsage: { cpuCores: number; memoryMb: number; diskGb: number };
    workerCount: number;
    serviceCount: number;
  }> {
    return apiClient.get("/workers/cluster/status");
  },
};

/**
 * Billing API
 */
export const containerBillingApi = {
  /**
   * Get billing summary
   */
  async getBillingSummary(): Promise<{
    currentCycle: ContainerBillingCycle[];
    totalCost: number;
    projectedMonthlyCost: number;
  }> {
    return apiClient.get("/containers/billing/summary");
  },

  /**
   * Get billing history
   */
  async getBillingHistory(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    cycles: ContainerBillingCycle[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const query = queryParams.toString();
    const path = `/containers/billing/history${query ? `?${query}` : ""}`;
    return apiClient.get(path);
  },

  /**
   * Estimate cost for resource configuration
   */
  async estimateCost(params: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    hoursPerMonth?: number;
  }): Promise<{
    hourly: number;
    daily: number;
    monthly: number;
    breakdown: {
      cpu: number;
      memory: number;
      storage: number;
    };
  }> {
    return apiClient.post("/containers/billing/estimate", params);
  },
};
