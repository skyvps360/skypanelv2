/**
 * Container Types
 * Type definitions for Easypanel Container as a Service (CaaS) integration
 */

// ============================================================================
// Core Container Types
// ============================================================================

export interface ContainerPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxContainers: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerSubscription {
  id: string;
  organizationId: string;
  planId: string;
  plan?: ContainerPlan;
  status: 'active' | 'suspended' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerProject {
  id: string;
  organizationId: string;
  subscriptionId: string;
  projectName: string;
  easypanelProjectName: string;
  status: string;
  metadata: Record<string, any>;
  services?: ContainerService[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainerService {
  id: string;
  projectId: string;
  serviceName: string;
  easypanelServiceName: string;
  serviceType: 'app' | 'postgres' | 'mysql' | 'mariadb' | 'mongo' | 'redis' | 'wordpress' | 'box' | 'compose';
  status: string;
  cpuLimit?: number;
  memoryLimitGb?: number;
  storageLimitGb?: number;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerTemplate {
  id: string;
  templateName: string;
  displayName: string;
  description: string;
  category: string;
  templateSchema: TemplateSchema;
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerBillingCycle {
  id: string;
  subscriptionId: string;
  organizationId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  monthlyRate: number;
  status: 'pending' | 'billed' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Resource Management Types
// ============================================================================

export interface ResourceUsage {
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  containerCount: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  exceededQuotas: string[];
  availableResources: ResourceUsage;
}

export interface ResourceConfig {
  cpuLimit?: number;
  memoryLimit?: number;
  memoryReservation?: number;
}

export interface ResourceRequirement {
  cpuCores?: number;
  memoryGb?: number;
  storageGb?: number;
  containerCount?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Easypanel API Types
// ============================================================================

export interface EasypanelUser {
  id: string;
  email: string;
  name: string;
}

export interface EasypanelProject {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface EasypanelProjectDetail extends EasypanelProject {
  services: EasypanelService[];
  env: Record<string, string>;
}

export interface EasypanelProjectWithServices extends EasypanelProject {
  services: EasypanelService[];
}

export interface EasypanelService {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppServiceDetail {
  name: string;
  type: 'app';
  status: string;
  source: ServiceSource;
  env: Record<string, string>;
  domains: DomainConfig[];
  mounts: MountConfig[];
  deploy: DeployConfig;
  resources: ResourceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceSource {
  type: 'image' | 'github' | 'git' | 'upload' | 'dockerfile';
  image?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  dockerfile?: string;
}

export interface DomainConfig {
  host: string;
  port: number;
  https: boolean;
}

export interface MountConfig {
  type: 'bind' | 'volume' | 'file';
  hostPath?: string;
  mountPath: string;
  content?: string;
}

export interface DeployConfig {
  replicas: number;
  command?: string;
  args?: string[];
}

export interface DockerContainer {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: string[];
  createdAt: string;
}

export interface ServiceError {
  message: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
}

// ============================================================================
// Template Types
// ============================================================================

export interface TemplateSchema {
  services?: TemplateService[];
  [key: string]: any;
}

export interface TemplateService {
  name?: string;
  type: string;
  configuration?: Record<string, any>;
  data?: Record<string, any>;
  [key: string]: any;
}

// ============================================================================
// Service Configuration Types
// ============================================================================

export interface AppServiceConfig {
  serviceName: string;
  source: ServiceSource;
  env?: Record<string, string>;
  domains?: DomainConfig[];
  mounts?: MountConfig[];
  deploy?: DeployConfig;
  resources?: ResourceConfig;
}

export interface DatabaseServiceConfig {
  serviceName: string;
  databaseType: 'postgres' | 'mysql' | 'mariadb' | 'mongo' | 'redis';
  version?: string;
  username?: string;
  password?: string;
  database?: string;
  resources?: ResourceConfig;
}

export interface PostgresServiceConfig extends DatabaseServiceConfig {
  databaseType: 'postgres';
  database: string;
  username: string;
  password: string;
}

export interface MysqlServiceConfig extends DatabaseServiceConfig {
  databaseType: 'mysql';
  database: string;
  username: string;
  password: string;
}

export interface MariadbServiceConfig extends DatabaseServiceConfig {
  databaseType: 'mariadb';
  database: string;
  username: string;
  password: string;
}

export interface MongoServiceConfig extends DatabaseServiceConfig {
  databaseType: 'mongo';
  username?: string;
  password?: string;
}

export interface RedisServiceConfig extends DatabaseServiceConfig {
  databaseType: 'redis';
  password?: string;
}

export interface ServiceConfig {
  serviceName: string;
  serviceType: ContainerService['serviceType'];
  configuration: AppServiceConfig | DatabaseServiceConfig;
  resources?: ResourceConfig;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Plan Management
export interface CreateContainerPlanRequest {
  name: string;
  description: string;
  priceMonthly: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxContainers: number;
}

export interface UpdateContainerPlanRequest extends Partial<CreateContainerPlanRequest> {}

export interface ContainerPlansResponse {
  plans: ContainerPlan[];
}

// Subscription Management
export interface CreateSubscriptionRequest {
  planId: string;
}

export interface SubscriptionResponse {
  subscription: ContainerSubscription;
}

export interface ResourceUsageResponse {
  usage: ResourceUsage;
  quota: ResourceUsage;
  percentages: {
    cpu: number;
    memory: number;
    storage: number;
    containers: number;
  };
}

// Project Management
export interface CreateProjectRequest {
  projectName: string;
}

export interface UpdateProjectEnvRequest {
  env: Record<string, string>;
}

export interface ProjectResponse {
  project: ContainerProject;
}

export interface ProjectsResponse {
  projects: ContainerProject[];
}

// Service Management
export interface DeployAppServiceRequest {
  serviceName: string;
  source: ServiceSource;
  env?: Record<string, string>;
  domains?: DomainConfig[];
  mounts?: MountConfig[];
  deploy?: DeployConfig;
  resources?: ResourceConfig;
}

export interface DeployDatabaseServiceRequest {
  serviceName: string;
  databaseType: DatabaseServiceConfig['databaseType'];
  version?: string;
  username?: string;
  password?: string;
  database?: string;
  resources?: ResourceConfig;
}

export interface DeployTemplateServiceRequest {
  serviceName: string;
  templateName: string;
  templateConfig?: Record<string, any>;
}

export interface UpdateServiceEnvRequest {
  env: Record<string, string>;
}

export interface UpdateServiceResourcesRequest {
  resources: ResourceConfig;
}

export interface ServiceResponse {
  service: ContainerService;
}

export interface ServicesResponse {
  services: ContainerService[];
}

export interface ServiceLogsResponse {
  logs: ServiceLogEntry[];
}

export interface ServiceLogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  source?: string;
}

// Template Management
export interface CreateTemplateRequest {
  templateName: string;
  displayName: string;
  description: string;
  category: string;
  templateSchema: TemplateSchema;
  displayOrder?: number;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface TemplatesResponse {
  templates: ContainerTemplate[];
}

// Admin Monitoring
export interface AdminOverviewResponse {
  statistics: {
    totalSubscriptions: number;
    totalProjects: number;
    totalServices: number;
    totalOrganizations: number;
  };
  resourceUsage: {
    totalCpuCores: number;
    totalMemoryGb: number;
    totalStorageGb: number;
    totalContainers: number;
  };
}

export interface AdminSubscriptionsResponse {
  subscriptions: (ContainerSubscription & {
    organizationName: string;
    planName: string;
  })[];
}

export interface AdminServicesResponse {
  services: (ContainerService & {
    organizationName: string;
    projectName: string;
  })[];
}

// Configuration
export interface EasypanelConfigRequest {
  apiUrl: string;
  apiKey?: string; // Optional when updating existing config
}

export interface EasypanelConfigResponse {
  apiUrl: string;
  hasApiKey?: boolean;
  connectionStatus?: string;
  lastConnectionTest?: string;
  source?: 'db' | 'env' | 'none';
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  user?: EasypanelUser;
}

// ============================================================================
// Billing Types
// ============================================================================

export interface BillingProcessResult {
  processedCycles: number;
  successfulCharges: number;
  failedCharges: number;
  suspendedSubscriptions: number;
  errors: string[];
}

// ============================================================================
// Form Types
// ============================================================================

export interface ContainerPlanFormData {
  name: string;
  description: string;
  priceMonthly: string;
  maxCpuCores: string;
  maxMemoryGb: string;
  maxStorageGb: string;
  maxContainers: string;
}

export interface ProjectFormData {
  projectName: string;
}

export interface AppServiceFormData {
  serviceName: string;
  sourceType: ServiceSource['type'];
  image?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  dockerfile?: string;
  env: Array<{ key: string; value: string }>;
  cpuLimit?: string;
  memoryLimit?: string;
  memoryReservation?: string;
}

export interface DatabaseServiceFormData {
  serviceName: string;
  databaseType: DatabaseServiceConfig['databaseType'];
  version?: string;
  username?: string;
  password?: string;
  database?: string;
  cpuLimit?: string;
  memoryLimit?: string;
}

export interface TemplateServiceFormData {
  serviceName: string;
  templateName: string;
  templateConfig?: Record<string, any>;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ContainerDashboardState {
  subscription: ContainerSubscription | null;
  projects: ContainerProject[];
  resourceUsage: ResourceUsage | null;
  loading: boolean;
  error: string | null;
}

export interface DeployServiceModalState {
  isOpen: boolean;
  step: 'type' | 'config' | 'review';
  deploymentType: 'template' | 'app' | 'database' | null;
  projectName: string;
  formData: AppServiceFormData | DatabaseServiceFormData | TemplateServiceFormData | null;
}

export interface ServiceDetailState {
  service: ContainerService | null;
  logs: ServiceLogEntry[];
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ContainerError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface QuotaExceededError extends ContainerError {
  code: 'QUOTA_EXCEEDED';
  exceededQuotas: string[];
  currentUsage: ResourceUsage;
  planLimits: ResourceUsage;
}

export interface EasypanelApiError extends ContainerError {
  code: 'EASYPANEL_API_ERROR';
  statusCode?: number;
  endpoint?: string;
}

export interface ValidationError extends ContainerError {
  code: 'VALIDATION_ERROR';
  fieldErrors: Record<string, string[]>;
}

// ============================================================================
// Event Types for Activity Logging
// ============================================================================

export type ContainerEventType = 
  | 'container.subscription.create'
  | 'container.subscription.cancel'
  | 'container.project.create'
  | 'container.project.delete'
  | 'container.service.create'
  | 'container.service.start'
  | 'container.service.stop'
  | 'container.service.restart'
  | 'container.service.delete'
  | 'container.service.update'
  | 'container.billing.charge'
  | 'container.billing.failed';

export interface ContainerActivityEvent {
  type: ContainerEventType;
  organizationId: string;
  userId: string;
  entityType: 'subscription' | 'project' | 'service' | 'billing';
  entityId: string;
  metadata?: Record<string, any>;
  timestamp: string;
}