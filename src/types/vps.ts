import type { ProviderType } from './provider';

export interface VPSListRowSelection {
  [id: string]: boolean;
}

export interface VPSInstance {
  id: string;
  label: string;
  status: "running" | "stopped" | "provisioning" | "rebooting" | "error" | "restoring" | "backing_up";
  type: string;
  region: string;
  regionLabel?: string;
  image: string;
  ipv4: string[];
  ipv6: string;
  created: string;
  provider_id?: string | null;
  provider_type?: ProviderType | null;
  providerName?: string | null;
  backup_frequency?: 'daily' | 'weekly' | 'none';
  specs: {
    vcpus: number;
    memory: number;
    disk: number;
    transfer: number;
  };
  stats: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
    uptime: string;
  };
  pricing: {
    hourly: number;
    monthly: number;
  };
  progress?: {
    percent: number | null;
    action: string | null;
    status: string | null;
    message: string | null;
    created: string | null;
  };
}

export interface CreateVPSForm {
  provider_id: string;
  provider_type: ProviderType;
  label: string;
  type: string;
  region: string;
  image: string;
  rootPassword: string;
  sshKeys: string[];
  backups: boolean;
  backup_frequency?: 'daily' | 'weekly' | 'none';
  privateIP: boolean;
  // Marketplace/StackScript
  appSlug?: string;
  appData?: Record<string, any>;
  stackscriptId?: number;
  stackscriptData?: Record<string, any>;
}

export interface VPSPlan {
  id: string;
  name: string;
  description?: string;
  provider_id: string;
  provider_plan_id: string;
  base_price: number;
  markup_price: number;
  backup_price_monthly: number;
  backup_price_hourly: number;
  backup_upcharge_monthly: number;
  backup_upcharge_hourly: number;
  daily_backups_enabled: boolean;
  weekly_backups_enabled: boolean;
  region_id?: string;
  specifications: {
    vcpus?: number;
    memory?: number;
    memory_gb?: number;
    disk?: number;
    storage_gb?: number;
    transfer?: number;
    transfer_gb?: number;
    bandwidth_gb?: number;
    cpu_cores?: number;
    region?: string;
    [key: string]: any;
  };
}

export interface ProviderRegion {
  id: string;
  label: string;
  country: string;
  capabilities?: string[];
  status?: string;
}
