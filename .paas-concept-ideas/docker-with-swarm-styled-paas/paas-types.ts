// SkyPanelV2 PaaS TypeScript Interfaces
// This file contains all TypeScript interfaces for PaaS functionality

// ============================================================
// Base PaaS Types
// ============================================================

export interface PaasPlan {
  id: string;
  name: string;
  description?: string;
  base_hourly_rate: number;
  cpu_cores: number;
  memory_mb: number;
  storage_gb: number;
  bandwidth_gb: number;
  max_applications: number;
  max_clusters: number;
  features: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PaasCluster {
  id: string;
  organization_id: string;
  service_provider_id?: string;
  plan_id: string;
  name: string;
  provider_cluster_id?: string;
  status: 'provisioning' | 'initializing' | 'active' | 'updating' | 'error' | 'maintenance' | 'terminating';
  configuration: Record<string, any>;
  node_count: number;
  manager_nodes: number;
  worker_nodes: number;
  network_config: Record<string, any>;
  storage_config: Record<string, any>;
  last_billed_at?: Date;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  plan?: PaasPlan;
  provider?: ServiceProvider;
  applications?: PaasApplication[];
  worker_nodes?: PaasWorkerNode[];
}

export interface PaasApplication {
  id: string;
  cluster_id: string;
  organization_id: string;
  name: string;
  repository_url?: string;
  branch: string;
  commit_hash?: string;
  dockerfile_path: string;
  build_context_path: string;
  build_command?: string;
  start_command?: string;
  environment_variables: Record<string, string>;
  secrets: Record<string, string>;
  port_bindings: Record<string, any>;
  volume_mounts: Record<string, any>;
  resource_limits: Record<string, any>;
  health_check: Record<string, any>;
  deployment_config: Record<string, any>;
  status: 'stopped' | 'building' | 'deploying' | 'running' | 'updating' | 'error' | 'deleting';
  replicas: number;
  deployed_at?: Date;
  last_deployed_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  cluster?: PaasCluster;
  deployments?: PaasDeployment[];
  domains?: PaasDomain[];
  services?: PaasService[];
}

export interface PaasDeployment {
  id: string;
  application_id: string;
  deployment_number: number;
  commit_hash?: string;
  commit_message?: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled' | 'rolling_back';
  build_logs?: string;
  deployment_logs?: string;
  error_message?: string;
  build_time_seconds?: number;
  deployment_time_seconds?: number;
  triggered_by?: string;
  started_at: Date;
  completed_at?: Date;
  created_at: Date;

  // Optional joins
  application?: PaasApplication;
  triggered_by_user?: User;
}

export interface PaasDomain {
  id: string;
  application_id: string;
  domain: string;
  ssl_status: 'none' | 'pending' | 'validating' | 'issued' | 'error' | 'renewing' | 'expired';
  ssl_certificate: Record<string, any>;
  dns_challenge: Record<string, any>;
  validation_method: 'http' | 'dns' | 'tls';
  primary_domain: boolean;
  status: 'pending' | 'validating' | 'active' | 'error' | 'deleting';
  verification_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  application?: PaasApplication;
}

export interface PaasBillingCycle {
  id: string;
  cluster_id: string;
  organization_id: string;
  billing_period_start: Date;
  billing_period_end: Date;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  resource_usage: Record<string, any>;
  application_usage: Record<string, any>;
  status: 'pending' | 'billed' | 'failed' | 'refunded' | 'disputed';
  payment_transaction_id?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  cluster?: PaasCluster;
  payment_transaction?: PaymentTransaction;
}

// ============================================================
// Worker Management Types
// ============================================================

export interface PaasWorkerNode {
  id: string;
  cluster_id: string;
  provider_node_id?: string;
  node_type: 'manager' | 'worker';
  status: 'provisioning' | 'active' | 'draining' | 'unavailable' | 'error' | 'removing';
  internal_ip?: string;
  external_ip?: string;
  hostname?: string;
  configuration: Record<string, any>;
  resource_capacity: Record<string, any>;
  resource_usage: Record<string, any>;
  labels: Record<string, string>;
  last_health_check?: Date;
  health_status: 'healthy' | 'unhealthy' | 'unknown' | 'maintenance';
  docker_version?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  cluster?: PaasCluster;
}

export interface PaasWorkerSetupCode {
  id: string;
  organization_id: string;
  cluster_id?: string;
  code_name: string;
  setup_token: string;
  setup_script: string;
  configuration: Record<string, any>;
  usage_limit: number;
  usage_count: number;
  expires_at: Date;
  created_by: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  organization?: Organization;
  cluster?: PaasCluster;
  created_by_user?: User;
}

// ============================================================
// Service & Database Types
// ============================================================

export interface PaasService {
  id: string;
  cluster_id: string;
  organization_id: string;
  application_id?: string;
  name: string;
  service_type: 'postgresql' | 'mysql' | 'redis' | 'mongodb' | 'nginx' | 'custom';
  version?: string;
  configuration: Record<string, any>;
  environment_variables: Record<string, string>;
  resource_limits: Record<string, any>;
  volume_mounts: Record<string, any>;
  connection_info: Record<string, any>;
  status: 'stopped' | 'starting' | 'running' | 'updating' | 'error' | 'deleting';
  backups_enabled: boolean;
  backup_schedule: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  cluster?: PaasCluster;
  application?: PaasApplication;
  backups?: PaasBackup[];
}

export interface PaasBackup {
  id: string;
  entity_type: 'application' | 'service' | 'cluster';
  entity_id: string;
  backup_type: 'manual' | 'scheduled' | 'pre-deployment';
  backup_method: 'full' | 'incremental' | 'snapshot';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'deleting';
  backup_location?: string;
  backup_size_bytes?: number;
  compression_method: string;
  encryption_enabled: boolean;
  retention_days: number;
  metadata: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  created_by_user?: User;
}

// ============================================================
// Organization Invitation Types
// ============================================================

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  invited_by: string;
  invited_email: string;
  invited_user_id?: string;
  invitation_token: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  message?: string;
  expires_at: Date;
  accepted_at?: Date;
  declined_at?: Date;
  created_at: Date;
  updated_at: Date;

  // Optional joins
  organization?: Organization;
  invited_by_user?: User;
  invited_user?: User;
}

// ============================================================
// Request/Response Types
// ============================================================

// Cluster Management
export interface CreateClusterRequest {
  plan_id: string;
  name: string;
  configuration?: Record<string, any>;
  network_config?: Record<string, any>;
  storage_config?: Record<string, any>;
}

export interface UpdateClusterRequest {
  name?: string;
  configuration?: Record<string, any>;
  node_count?: number;
}

export interface ScaleClusterRequest {
  manager_nodes: number;
  worker_nodes: number;
}

// Application Management
export interface CreateApplicationRequest {
  cluster_id: string;
  name: string;
  repository_url?: string;
  branch?: string;
  dockerfile_path?: string;
  build_context_path?: string;
  build_command?: string;
  start_command?: string;
  environment_variables?: Record<string, string>;
  port_bindings?: Record<string, any>;
  volume_mounts?: Record<string, any>;
  resource_limits?: Record<string, any>;
  health_check?: Record<string, any>;
}

export interface UpdateApplicationRequest {
  name?: string;
  repository_url?: string;
  branch?: string;
  dockerfile_path?: string;
  build_context_path?: string;
  build_command?: string;
  start_command?: string;
  environment_variables?: Record<string, string>;
  port_bindings?: Record<string, any>;
  volume_mounts?: Record<string, any>;
  resource_limits?: Record<string, any>;
  health_check?: Record<string, any>;
}

export interface DeployApplicationRequest {
  commit_hash?: string;
  force_rebuild?: boolean;
}

export interface ScaleApplicationRequest {
  replicas: number;
}

// Domain Management
export interface CreateDomainRequest {
  application_id: string;
  domain: string;
  validation_method?: 'http' | 'dns' | 'tls';
  primary_domain?: boolean;
}

export interface UpdateDomainRequest {
  primary_domain?: boolean;
}

// Service Management
export interface CreateServiceRequest {
  cluster_id: string;
  application_id?: string;
  name: string;
  service_type: 'postgresql' | 'mysql' | 'redis' | 'mongodb' | 'nginx' | 'custom';
  version?: string;
  configuration?: Record<string, any>;
  environment_variables?: Record<string, string>;
  resource_limits?: Record<string, any>;
  volume_mounts?: Record<string, any>;
  backups_enabled?: boolean;
  backup_schedule?: Record<string, any>;
}

// Worker Management
export interface CreateWorkerSetupCodeRequest {
  cluster_id?: string;
  code_name: string;
  configuration?: Record<string, any>;
  usage_limit?: number;
  expires_hours?: number;
}

// Organization Management
export interface CreateOrganizationInvitationRequest {
  email: string;
  role: 'owner' | 'admin' | 'member';
  message?: string;
  expires_hours?: number;
}

export interface UpdateOrganizationMemberRequest {
  role: 'owner' | 'admin' | 'member';
}

// ============================================================
// API Response Types
// ============================================================

export interface PaasClusterListResponse {
  clusters: PaasCluster[];
  total: number;
  page: number;
  limit: number;
}

export interface PaasApplicationListResponse {
  applications: PaasApplication[];
  total: number;
  page: number;
  limit: number;
}

export interface PaasDeploymentListResponse {
  deployments: PaasDeployment[];
  total: number;
  page: number;
  limit: number;
}

export interface PaasServiceListResponse {
  services: PaasService[];
  total: number;
  page: number;
  limit: number;
}

export interface ClusterResourceUsage {
  total_applications: number;
  running_applications: number;
  total_services: number;
  running_services: number;
  active_domains: number;
  recent_deployments: number;
  last_activity?: Date;
}

export interface ApplicationMetrics {
  cpu_usage_percent: number;
  memory_usage_mb: number;
  memory_usage_percent: number;
  disk_usage_gb: number;
  disk_usage_percent: number;
  network_rx_mb: number;
  network_tx_mb: number;
  request_count: number;
  error_rate_percent: number;
  response_time_ms: number;
}

export interface ClusterMetrics {
  total_nodes: number;
  active_nodes: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  disk_usage_percent: number;
  network_throughput_mbps: number;
}

// ============================================================
// Validation Types
// ============================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================
// Configuration Types
// ============================================================

export interface DockerSwarmConfig {
  advertise_addr?: string;
  listen_addr?: string;
  default_addr_pool?: string[];
  subnet_size?: number;
  data_path_port?: number;
  default_arp_pool?: string[];
  snapshot_interval?: number;
  log_entries_for_slow_followers?: number;
  election_tick?: number;
  heartbeat_tick?: number;
}

export interface NetworkConfig {
  driver: string;
  options: Record<string, any>;
  labels: Record<string, string>;
  attachable: boolean;
  ingress: boolean;
  internal: boolean;
  scope: string;
}

export interface StorageConfig {
  driver: string;
  options: Record<string, any>;
  labels: Record<string, string>;
  parameters: Record<string, any>;
}

export interface ResourceLimits {
  cpu_limit?: number;
  cpu_reservation?: number;
  memory_limit?: number;
  memory_reservation?: number;
  pids_limit?: number;
}

export interface HealthCheckConfig {
  test: string[];
  interval: number;
  timeout: number;
  retries: number;
  start_period: number;
  start_interval?: number;
}

// ============================================================
// Event Types
// ============================================================

export interface PaasEvent {
  id: string;
  cluster_id?: string;
  application_id?: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata: Record<string, any>;
  created_at: Date;
}

export interface DeploymentEvent {
  deployment_id: string;
  event_type: 'build_started' | 'build_completed' | 'build_failed' | 'deployment_started' | 'deployment_completed' | 'deployment_failed';
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ClusterEvent {
  cluster_id: string;
  event_type: 'node_added' | 'node_removed' | 'node_failed' | 'service_created' | 'service_updated' | 'service_removed' | 'cluster_scaled';
  message: string;
  node_id?: string;
  service_id?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// ============================================================
// Existing System Types (for reference)
// ============================================================

// These are types from the existing system that PaaS integrates with
export interface ServiceProvider {
  id: string;
  name: string;
  type: 'linode' | 'digitalocean' | 'aws' | 'gcp' | 'dockerswarm';
  api_key_encrypted: string;
  configuration: Record<string, any>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  phone?: string;
  timezone?: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: Record<string, any>;
  website?: string;
  address?: string;
  tax_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentTransaction {
  id: string;
  organization_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  provider_transaction_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Type Guards and Utilities
// ============================================================

export function isPaasCluster(obj: any): obj is PaasCluster {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.organization_id === 'string' &&
         typeof obj.plan_id === 'string' &&
         typeof obj.name === 'string';
}

export function isPaasApplication(obj: any): obj is PaasApplication {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.cluster_id === 'string' &&
         typeof obj.organization_id === 'string' &&
         typeof obj.name === 'string';
}

export function isPaasDeployment(obj: any): obj is PaasDeployment {
  return obj && typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.application_id === 'string' &&
         typeof obj.deployment_number === 'number';
}

export function isValidClusterStatus(status: string): status is PaasCluster['status'] {
  return ['provisioning', 'initializing', 'active', 'updating', 'error', 'maintenance', 'terminating'].includes(status);
}

export function isValidApplicationStatus(status: string): status is PaasApplication['status'] {
  return ['stopped', 'building', 'deploying', 'running', 'updating', 'error', 'deleting'].includes(status);
}

export function isValidDeploymentStatus(status: string): status is PaasDeployment['status'] {
  return ['pending', 'building', 'deploying', 'success', 'failed', 'cancelled', 'rolling_back'].includes(status);
}

// ============================================================
// Export everything
// ============================================================

export default {
  // Core types
  PaasPlan,
  PaasCluster,
  PaasApplication,
  PaasDeployment,
  PaasDomain,
  PaasBillingCycle,

  // Worker management
  PaasWorkerNode,
  PaasWorkerSetupCode,

  // Services and backups
  PaasService,
  PaasBackup,

  // Organization management
  OrganizationInvitation,

  // Request types
  CreateClusterRequest,
  UpdateClusterRequest,
  ScaleClusterRequest,
  CreateApplicationRequest,
  UpdateApplicationRequest,
  DeployApplicationRequest,
  ScaleApplicationRequest,
  CreateDomainRequest,
  UpdateDomainRequest,
  CreateServiceRequest,
  CreateWorkerSetupCodeRequest,
  CreateOrganizationInvitationRequest,
  UpdateOrganizationMemberRequest,

  // Response types
  PaasClusterListResponse,
  PaasApplicationListResponse,
  PaasDeploymentListResponse,
  PaasServiceListResponse,
  ClusterResourceUsage,
  ApplicationMetrics,
  ClusterMetrics,

  // Configuration
  DockerSwarmConfig,
  NetworkConfig,
  StorageConfig,
  ResourceLimits,
  HealthCheckConfig,

  // Events
  PaasEvent,
  DeploymentEvent,
  ClusterEvent,

  // Utilities
  isPaasCluster,
  isPaasApplication,
  isPaasDeployment,
  isValidClusterStatus,
  isValidApplicationStatus,
  isValidDeploymentStatus,
};
