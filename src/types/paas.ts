export type PaasStatus = 'pending' | 'building' | 'running' | 'stopped' | 'failed' | 'suspended'

export interface PaasPlan {
  id: string
  name: string
  description?: string | null
  cpu_millicores: number
  memory_mb: number
  storage_gb: number
  price_hourly: number
  price_monthly: number
  supported_runtimes?: string[]
  active: boolean
}

export interface PaasRuntime {
  id: string
  runtime_type: string
  version: string
  base_image: string
  default_build_command?: string | null
  default_start_command?: string | null
  allow_custom_docker?: boolean
  active: boolean
  enforce_non_root?: boolean
  default_run_user?: string | null
}

export interface PaasRegion {
  region: string
  node_count: number
}

export interface PaasApplication {
  id: string
  name: string
  slug: string
  status: PaasStatus
  organization_id: string
  owner_user_id?: string | null
  plan_id?: string | null
  runtime_id?: string | null
  region: string
  git_repo_url?: string | null
  git_branch?: string | null
  git_repo_full_name?: string | null
  git_webhook_id?: string | number | null
  auto_deploy?: boolean
  system_domain?: string | null
  custom_domains?: Array<{ domain: string; status?: string }>
  instance_count?: number
  needs_redeploy?: boolean
  updated_at?: string
  created_at?: string
}

export interface EnvVarSummary {
  key: string
}

export type DatabaseEngine = 'mysql' | 'postgresql' | 'redis' | 'mongodb'

export interface PaasDatabase {
  id: string
  organization_id: string
  name: string
  db_type: DatabaseEngine
  version: string
  plan_id?: string | null
  node_id?: string | null
  host?: string | null
  port?: number | null
  username?: string | null
  password?: string | null
  database_name?: string | null
  status: string
  created_at?: string
  updated_at?: string
}

export interface PaasDatabaseLink extends PaasDatabase {
  env_var_prefix?: string
  linked_at?: string
  link_id?: string
}

export interface PaasApplicationMetric {
  created_at: string
  cpu_millicores: number
  memory_mb: number
  request_rate?: number
}

export interface PaasBillingSummary {
  totals: Record<string, { total: number; hours: number }>
  grand: number
}

export interface PaasBillingRecord {
  id: string
  resource_type: 'application' | 'database'
  resource_id: string
  plan_id: string | null
  instance_count: number
  hourly_rate: number
  hours_used: number
  total_cost: number
  billing_period_start: string
  billing_period_end: string
}

export interface PaasSpendingAlert {
  id: string
  organization_id: string
  threshold_amount: number
  notified_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface PaasApplicationBilling {
  history: Array<{ month: string; total: number; hours: number }>
  currentMonthTotal: number
}
