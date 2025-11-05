/**
 * Container Service for SkyPanelV2 Frontend
 * Handles Dokploy Container as a Service (CaaS) API interactions
 */

import { apiClient } from '@/lib/api';
import { extractErrorInfo, createDisplayError } from '@/lib/containerErrors';
import type {
  // Core Types
  ContainerPlan,
  ContainerSubscription,
  ContainerProject,
  ContainerService as ContainerServiceType,
  ContainerTemplate,
  ResourceUsage,
  QuotaCheckResult,
  
  // Request Types
  CreateContainerPlanRequest,
  UpdateContainerPlanRequest,
  CreateSubscriptionRequest,
  CreateProjectRequest,
  UpdateProjectEnvRequest,
  DeployAppServiceRequest,
  DeployDatabaseServiceRequest,
  DeployTemplateServiceRequest,
  UpdateServiceEnvRequest,
  UpdateServiceResourcesRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  EasypanelConfigRequest,
  
  // Response Types
  ContainerPlansResponse,
  SubscriptionResponse,
  ResourceUsageResponse,
  ProjectResponse,
  ProjectsResponse,
  ServiceResponse,
  ServicesResponse,
  ServiceLogsResponse,
  TemplatesResponse,
  AdminOverviewResponse,
  AdminSubscriptionsResponse,
  AdminServicesResponse,
  EasypanelConfigResponse,
  ConnectionTestResponse,
  
  // Other Types
  ServiceLogEntry,
  EasypanelUser,
} from '@/types/containers';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ContainerService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  // ============================================================================
  // Plan Management Methods
  // ============================================================================

  /**
   * Get all active container plans (user)
   */
  async getPlans(): Promise<{
    success: boolean;
    plans?: ContainerPlan[];
    error?: string;
    errorDetails?: any;
  }> {
    try {
      const response = await apiClient.get<ContainerPlansResponse>('/containers/plans');
      return {
        success: true,
        plans: response.plans,
      };
    } catch (error) {
      console.error('Get container plans error:', error);
      const errorInfo = extractErrorInfo(error);
      return {
        success: false,
        error: errorInfo.message,
        errorDetails: createDisplayError(error),
      };
    }
  }

  /**
   * Get all container plans (admin)
   */
  async getAllPlans(): Promise<{
    success: boolean;
    plans?: ContainerPlan[];
    error?: string;
    errorDetails?: any;
  }> {
    try {
      const response = await apiClient.get<ContainerPlansResponse>('/containers/admin/plans');
      return {
        success: true,
        plans: response.plans,
      };
    } catch (error) {
      console.error('Get all container plans error:', error);
      const errorInfo = extractErrorInfo(error);
      return {
        success: false,
        error: errorInfo.message,
        errorDetails: createDisplayError(error),
      };
    }
  }

  /**
   * Create a new container plan (admin)
   */
  async createPlan(planData: CreateContainerPlanRequest): Promise<{
    success: boolean;
    plan?: ContainerPlan;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<{ plan: ContainerPlan }>('/containers/admin/plans', planData);
      return {
        success: true,
        plan: response.plan,
      };
    } catch (error: any) {
      console.error('Create container plan error:', error);
      // Re-throw with structured details so mutations can display validation errors
      throw createDisplayError(error);
    }
  }

  /**
   * Update a container plan (admin)
   */
  async updatePlan(planId: string, updates: UpdateContainerPlanRequest): Promise<{
    success: boolean;
    plan?: ContainerPlan;
    error?: string;
  }> {
    try {
      const response = await apiClient.put<{ plan: ContainerPlan }>(`/containers/admin/plans/${planId}`, updates);
      return {
        success: true,
        plan: response.plan,
      };
    } catch (error: any) {
      console.error('Update container plan error:', error);
      // Re-throw with structured details so mutations can display validation errors
      throw createDisplayError(error);
    }
  }

  /**
   * Activate a container plan (admin)
   */
  async activatePlan(planId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/admin/plans/${planId}/activate`);
      return { success: true };
    } catch (error) {
      console.error('Activate container plan error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate container plan',
      };
    }
  }

  /**
   * Deactivate a container plan (admin)
   */
  async deactivatePlan(planId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/admin/plans/${planId}/deactivate`);
      return { success: true };
    } catch (error) {
      console.error('Deactivate container plan error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate container plan',
      };
    }
  }

  /**
   * Delete a container plan (admin)
   */
  async deletePlan(planId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.delete(`/containers/admin/plans/${planId}`);
      return { success: true };
    } catch (error) {
      console.error('Delete container plan error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete container plan',
      };
    }
  }

  // ============================================================================
  // Subscription Management Methods
  // ============================================================================

  /**
   * Get current subscription
   */
  async getSubscription(): Promise<{
    success: boolean;
    subscription?: ContainerSubscription;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<SubscriptionResponse>('/containers/subscription');
      return {
        success: true,
        subscription: response.subscription,
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load subscription',
      };
    }
  }

  /**
   * Subscribe to a container plan
   */
  async subscribe(planId: string): Promise<{
    success: boolean;
    subscription?: ContainerSubscription;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<SubscriptionResponse>('/containers/subscription', { planId });
      return {
        success: true,
        subscription: response.subscription,
      };
    } catch (error) {
      console.error('Subscribe error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe to container plan',
      };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<{
    success: boolean;
    refundAmount?: number;
    projectsDeleted?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
        refundAmount: number;
        projectsDeleted: number;
      }>('/containers/subscription');
      return { 
        success: true,
        refundAmount: response.refundAmount,
        projectsDeleted: response.projectsDeleted,
        message: response.message
      };
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription',
      };
    }
  }

  /**
   * Get resource usage
   */
  async getResourceUsage(): Promise<{
    success: boolean;
    usage?: ResourceUsage;
    quota?: ResourceUsage;
    percentages?: {
      cpu: number;
      memory: number;
      storage: number;
      containers: number;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ResourceUsageResponse>('/containers/subscription/usage');
      return {
        success: true,
        usage: response.usage,
        quota: response.quota,
        percentages: response.percentages,
      };
    } catch (error) {
      console.error('Get resource usage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load resource usage',
      };
    }
  }

  // ============================================================================
  // Project Management Methods
  // ============================================================================

  /**
   * Get all projects
   */
  async getProjects(): Promise<{
    success: boolean;
    projects?: ContainerProject[];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ProjectsResponse>('/containers/projects');
      return {
        success: true,
        projects: response.projects,
      };
    } catch (error) {
      console.error('Get projects error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load projects',
      };
    }
  }

  /**
   * Create a new project
   */
  async createProject(projectName: string): Promise<{
    success: boolean;
    project?: ContainerProject;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<ProjectResponse>('/containers/projects', { projectName });
      return {
        success: true,
        project: response.project,
      };
    } catch (error) {
      console.error('Create project error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      };
    }
  }

  /**
   * Get project details
   */
  async getProject(projectName: string): Promise<{
    success: boolean;
    project?: ContainerProject;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ProjectResponse>(`/containers/projects/${projectName}`);
      return {
        success: true,
        project: response.project,
      };
    } catch (error) {
      console.error('Get project error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load project',
      };
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.delete(`/containers/projects/${projectName}`);
      return { success: true };
    } catch (error) {
      console.error('Delete project error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      };
    }
  }

  /**
   * Update project environment variables
   */
  async updateProjectEnv(projectName: string, env: Record<string, string>): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.put(`/containers/projects/${projectName}/env`, { env });
      return { success: true };
    } catch (error) {
      console.error('Update project env error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project environment',
      };
    }
  }

  // ============================================================================
  // Service Management Methods
  // ============================================================================

  /**
   * Get services in a project
   */
  async getServices(projectName: string): Promise<{
    success: boolean;
    services?: ContainerServiceType[];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ServicesResponse>(`/containers/projects/${projectName}/services`);
      return {
        success: true,
        services: response.services,
      };
    } catch (error) {
      console.error('Get services error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load services',
      };
    }
  }

  /**
   * Deploy an app service
   */
  async deployAppService(projectName: string, config: DeployAppServiceRequest): Promise<{
    success: boolean;
    service?: ContainerServiceType;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<ServiceResponse>(`/containers/projects/${projectName}/services/app`, config);
      return {
        success: true,
        service: response.service,
      };
    } catch (error) {
      console.error('Deploy app service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy app service',
      };
    }
  }

  /**
   * Deploy a database service
   */
  async deployDatabaseService(projectName: string, config: DeployDatabaseServiceRequest): Promise<{
    success: boolean;
    service?: ContainerServiceType;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<ServiceResponse>(`/containers/projects/${projectName}/services/database`, config);
      return {
        success: true,
        service: response.service,
      };
    } catch (error) {
      console.error('Deploy database service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy database service',
      };
    }
  }

  /**
   * Deploy a service from template
   */
  async deployTemplateService(projectName: string, config: DeployTemplateServiceRequest): Promise<{
    success: boolean;
    service?: ContainerServiceType;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<ServiceResponse>(`/containers/projects/${projectName}/services/template`, config);
      return {
        success: true,
        service: response.service,
      };
    } catch (error) {
      console.error('Deploy template service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy service from template',
      };
    }
  }

  /**
   * Get service details
   */
  async getService(projectName: string, serviceName: string): Promise<{
    success: boolean;
    service?: ContainerServiceType;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ServiceResponse>(`/containers/projects/${projectName}/services/${serviceName}`);
      return {
        success: true,
        service: response.service,
      };
    } catch (error) {
      console.error('Get service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service',
      };
    }
  }

  /**
   * Start a service
   */
  async startService(projectName: string, serviceName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/projects/${projectName}/services/${serviceName}/start`);
      return { success: true };
    } catch (error) {
      console.error('Start service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start service',
      };
    }
  }

  /**
   * Stop a service
   */
  async stopService(projectName: string, serviceName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/projects/${projectName}/services/${serviceName}/stop`);
      return { success: true };
    } catch (error) {
      console.error('Stop service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop service',
      };
    }
  }

  /**
   * Restart a service
   */
  async restartService(projectName: string, serviceName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/projects/${projectName}/services/${serviceName}/restart`);
      return { success: true };
    } catch (error) {
      console.error('Restart service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restart service',
      };
    }
  }

  /**
   * Delete a service
   */
  async deleteService(projectName: string, serviceName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.delete(`/containers/projects/${projectName}/services/${serviceName}`);
      return { success: true };
    } catch (error) {
      console.error('Delete service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete service',
      };
    }
  }

  /**
   * Update service environment variables
   */
  async updateServiceEnv(projectName: string, serviceName: string, env: Record<string, string>): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.put(`/containers/projects/${projectName}/services/${serviceName}/env`, { env });
      return { success: true };
    } catch (error) {
      console.error('Update service env error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service environment',
      };
    }
  }

  /**
   * Update service resources
   */
  async updateServiceResources(projectName: string, serviceName: string, resources: UpdateServiceResourcesRequest['resources']): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.put(`/containers/projects/${projectName}/services/${serviceName}/resources`, { resources });
      return { success: true };
    } catch (error) {
      console.error('Update service resources error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service resources',
      };
    }
  }

  /**
   * Get service logs
   */
  async getServiceLogs(projectName: string, serviceName: string, lines?: number): Promise<{
    success: boolean;
    logs?: ServiceLogEntry[];
    error?: string;
  }> {
    try {
      const params = lines ? `?lines=${lines}` : '';
      const response = await apiClient.get<ServiceLogsResponse>(`/containers/projects/${projectName}/services/${serviceName}/logs${params}`);
      return {
        success: true,
        logs: response.logs,
      };
    } catch (error) {
      console.error('Get service logs error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service logs',
      };
    }
  }

  // ============================================================================
  // Template Management Methods
  // ============================================================================

  /**
   * Get enabled templates (user)
   */
  async getTemplates(): Promise<{
    success: boolean;
    templates?: ContainerTemplate[];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<TemplatesResponse>('/containers/templates');
      return {
        success: true,
        templates: response.templates,
      };
    } catch (error) {
      console.error('Get templates error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      };
    }
  }

  /**
   * Get all templates (admin)
   */
  async getAllTemplates(): Promise<{
    success: boolean;
    templates?: ContainerTemplate[];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<TemplatesResponse>('/containers/admin/templates');
      return {
        success: true,
        templates: response.templates,
      };
    } catch (error) {
      console.error('Get all templates error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      };
    }
  }

  /**
   * Create a template (admin)
   */
  async createTemplate(templateData: CreateTemplateRequest): Promise<{
    success: boolean;
    template?: ContainerTemplate;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<{ template: ContainerTemplate }>('/containers/admin/templates', templateData);
      return {
        success: true,
        template: response.template,
      };
    } catch (error) {
      console.error('Create template error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      };
    }
  }

  /**
   * Update a template (admin)
   */
  async updateTemplate(templateId: string, updates: UpdateTemplateRequest): Promise<{
    success: boolean;
    template?: ContainerTemplate;
    error?: string;
  }> {
    try {
      const response = await apiClient.put<{ template: ContainerTemplate }>(`/containers/admin/templates/${templateId}`, updates);
      return {
        success: true,
        template: response.template,
      };
    } catch (error) {
      console.error('Update template error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      };
    }
  }

  /**
   * Enable a template (admin)
   */
  async enableTemplate(templateId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/admin/templates/${templateId}/enable`);
      return { success: true };
    } catch (error) {
      console.error('Enable template error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable template',
      };
    }
  }

  /**
   * Disable a template (admin)
   */
  async disableTemplate(templateId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post(`/containers/admin/templates/${templateId}/disable`);
      return { success: true };
    } catch (error) {
      console.error('Disable template error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable template',
      };
    }
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  /**
   * Get platform overview (admin)
   */
  async getAdminOverview(): Promise<{
    success: boolean;
    statistics?: AdminOverviewResponse['statistics'];
    resourceUsage?: AdminOverviewResponse['resourceUsage'];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<AdminOverviewResponse>('/containers/admin/overview');
      return {
        success: true,
        statistics: response.statistics,
        resourceUsage: response.resourceUsage,
      };
    } catch (error) {
      console.error('Get admin overview error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load admin overview',
      };
    }
  }

  /**
   * Get all subscriptions (admin)
   */
  async getAdminSubscriptions(): Promise<{
    success: boolean;
    subscriptions?: AdminSubscriptionsResponse['subscriptions'];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<AdminSubscriptionsResponse>('/containers/admin/subscriptions');
      return {
        success: true,
        subscriptions: response.subscriptions,
      };
    } catch (error) {
      console.error('Get admin subscriptions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load subscriptions',
      };
    }
  }

  /**
   * Get all services (admin)
   */
  async getAdminServices(): Promise<{
    success: boolean;
    services?: AdminServicesResponse['services'];
    error?: string;
  }> {
    try {
      const response = await apiClient.get<AdminServicesResponse>('/containers/admin/services');
      return {
        success: true,
        services: response.services,
      };
    } catch (error) {
      console.error('Get admin services error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load services',
      };
    }
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Get Easypanel configuration (admin)
   */
  async getEasypanelConfig(): Promise<{
    success: boolean;
    config?: EasypanelConfigResponse;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<EasypanelConfigResponse | { config: EasypanelConfigResponse }>(
        '/containers/admin/config'
      );

      const configData =
        response && typeof response === 'object' && 'config' in response
          ? (response as { config: EasypanelConfigResponse }).config
          : (response as EasypanelConfigResponse);
      return {
        success: true,
        config: configData,
      };
    } catch (error) {
      console.error('Get Easypanel config error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Easypanel configuration',
      };
    }
  }

  /**
   * Update Easypanel configuration (admin)
   */
  async updateEasypanelConfig(config: EasypanelConfigRequest): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/containers/admin/config', config);
      if (response.success === false) {
        throw new Error(response.message || 'Failed to update Easypanel configuration');
      }
      return {
        success: true,
        message: response.message,
      };
    } catch (error: any) {
      console.error('Update Easypanel config error:', error);
      // Re-throw to let React Query handle it
      throw error;
    }
  }

  /**
   * Test Easypanel connection (admin)
   */
  async testEasypanelConnection(config?: EasypanelConfigRequest): Promise<{
    success: boolean;
    message?: string;
    user?: EasypanelUser;
  }> {
    try {
      const response = await apiClient.post<ConnectionTestResponse>('/containers/admin/config/test', config || {});
      if (response.success === false) {
        throw new Error(response.message || 'Connection test failed');
      }
      return {
        success: true,
        message: response.message,
        user: response.user,
      };
    } catch (error: any) {
      console.error('Test Easypanel connection error:', error);
      // Re-throw to let React Query handle it
      throw error;
    }
  }

  /**
   * Get Dokploy configuration (admin)
   */
  async getDokployConfig(): Promise<{
    success: boolean;
    config?: EasypanelConfigResponse;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<EasypanelConfigResponse | { config: EasypanelConfigResponse }>(
        '/containers/admin/dokploy/config'
      );

      const configData =
        response && typeof response === 'object' && 'config' in response
          ? (response as { config: EasypanelConfigResponse }).config
          : (response as EasypanelConfigResponse);
      return {
        success: true,
        config: configData,
      };
    } catch (error) {
      console.error('Get Dokploy config error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Dokploy configuration',
      };
    }
  }

  /**
   * Update Dokploy configuration (admin)
   */
  async updateDokployConfig(config: EasypanelConfigRequest): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/containers/admin/dokploy/config', config);
      if (response.success === false) {
        throw new Error(response.message || 'Failed to update Dokploy configuration');
      }
      return {
        success: true,
        message: response.message,
      };
    } catch (error: any) {
      console.error('Update Dokploy config error:', error);
      // Re-throw to let React Query handle it
      throw error;
    }
  }

  /**
   * Test Dokploy connection (admin)
   */
  async testDokployConnection(config?: EasypanelConfigRequest): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await apiClient.post<{success: boolean; message?: string}>('/containers/admin/dokploy/config/test', config || {});
      if (response.success === false) {
        throw new Error(response.message || 'Connection test failed');
      }
      return {
        success: true,
        message: response.message,
      };
    } catch (error: any) {
      console.error('Test Dokploy connection error:', error);
      // Re-throw to let React Query handle it
      throw error;
    }
  }

  /**
   * Get organization detail (admin)
   */
  async getOrganizationDetail(organizationId: string): Promise<{
    success: boolean;
    organization?: any;
    error?: string;
  }> {
    try {
      const response = await apiClient.get(`/containers/admin/organizations/${organizationId}`);
      return {
        success: true,
        organization: response,
      };
    } catch (error) {
      console.error('Get organization detail error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load organization details',
      };
    }
  }
}

export const containerService = new ContainerService();