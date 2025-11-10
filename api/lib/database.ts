import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

// Load environment variables ONLY if not in Docker (Docker passes env vars directly)
// In Docker, environment variables come from docker-compose.yml, not .env files
if (!process.env.IN_DOCKER) {
  dotenv.config();
}

// Get PostgreSQL configuration from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing PostgreSQL configuration:');
  console.error('DATABASE_URL:', databaseUrl ? 'Set' : 'Missing');
  throw new Error('Missing required DATABASE_URL environment variable');
}

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database connection helper
export const getDbClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

// Query helper function
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

// Transaction helper
export const transaction = async (callback: (client: PoolClient) => Promise<any>): Promise<any> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Database types for PostgreSQL
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'user';
  phone?: string;
  timezone?: string;
  preferences?: any;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: any;
  website?: string;
  address?: string;
  tax_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  organization_id: string;
  config: any;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VpsInstance {
  id: string;
  organization_id: string;
  plan_id: string;
  provider_instance_id: string;
  label: string;
  status: string;
  ip_address: string | null;
  configuration: any;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  organization_id: string;
  created_by: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  organization_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface UserApiKey {
  id: string;
  user_id: string;
  key_name: string;
  key_hash: string;
  key_prefix: string;
  permissions?: any;
  last_used_at?: string;
  expires_at?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// PaaS Types
export interface PaasApplication {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  git_url?: string;
  git_branch: string;
  buildpack?: string;
  plan_id?: string;
  status: 'inactive' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'suspended';
  subdomain?: string;
  stack: string;
  replicas: number;
  last_billed_at?: string;
  health_check_enabled?: boolean;
  health_check_path?: string;
  health_check_interval_seconds?: number;
  health_check_timeout_seconds?: number;
  health_check_retries?: number;
  health_check_protocol?: string;
  last_health_status?: string;
  last_health_check_at?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface PaasDeployment {
  id: string;
  application_id: string;
  version: number;
  git_commit?: string;
  slug_url?: string;
  slug_size_bytes?: number;
  buildpack_used?: string;
  build_log?: string;
  status: 'pending' | 'building' | 'build_failed' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  error_message?: string;
  build_started_at?: string;
  build_completed_at?: string;
  deployed_at?: string;
  created_by?: string;
  rolled_back_from?: string;
  created_at: string;
  updated_at: string;
}

export interface PaasBuildCache {
  id: string;
  application_id: string;
  cache_key: string;
  cache_url: string;
  size_bytes?: number;
  last_used_at?: string;
  created_at: string;
}

export interface PaasWorkerNode {
  id: string;
  name: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_encrypted?: string;
  swarm_node_id?: string;
  swarm_role: 'manager' | 'worker';
  status: 'provisioning' | 'active' | 'draining' | 'down' | 'unreachable';
  capacity_cpu?: number;
  capacity_ram_mb?: number;
  used_cpu: number;
  used_ram_mb: number;
  labels: any;
  metadata: any;
  last_heartbeat_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaasEnvironmentVar {
  id: string;
  application_id: string;
  key: string;
  value_encrypted: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaasDomain {
  id: string;
  application_id: string;
  domain: string;
  is_verified: boolean;
  ssl_enabled: boolean;
  ssl_cert_path?: string;
  ssl_cert_expires_at?: string;
  dns_verification_token?: string;
  verification_status?: string;
  verification_requested_at?: string;
  verified_at?: string;
  ssl_status?: string;
  ssl_last_checked_at?: string;
  ssl_error?: string;
  created_at: string;
  updated_at: string;
}

export interface PaasPlan {
  id: string;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  max_replicas: number;
  disk_gb: number;
  price_per_hour: number;
  price_per_month?: number;
  is_active: boolean;
  features: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface PaasResourceUsage {
  id: string;
  application_id: string;
  organization_id: string;
  deployment_id?: string;
  cpu_cores: number;
  ram_mb: number;
  replicas: number;
  hours: number;
  cost: number;
  recorded_at: string;
  billing_cycle_id?: string;
  created_at: string;
}

export interface PaasSettings {
  id: string;
  key: string;
  value_encrypted?: string;
  value_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_sensitive: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}
