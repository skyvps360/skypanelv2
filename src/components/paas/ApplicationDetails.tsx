/**
 * Application Details Page
 * Detailed view and management for a single PaaS application
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Code,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Server,
  Settings,
  Square,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';

interface PaaSApp {
  id: string;
  name: string;
  description: string;
  status: 'building' | 'deployed' | 'error' | 'stopped';
  repository_url: string;
  branch: string;
  last_commit?: string;
  last_deployed_at?: string;
  created_at: string;
  updated_at: string;
  build_status?: 'pending' | 'running' | 'success' | 'failed';
  deployment_count: number;
  plan_name: string;
  url?: string;
  build_command: string;
  start_command: string;
  node_version: string;
  environment_variables: Array<{ key: string; value: string }>;
  auto_deploy: boolean;
  addon_count?: number;
}

interface Deployment {
  id: string;
  app_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  commit_hash: string;
  commit_message: string;
  branch: string;
  created_at: string;
  completed_at?: string;
  build_logs?: string;
  deployment_logs?: string;
}

interface AddOn {
  id: string;
  name: string;
  type: string;
  status: string;
  connection_string?: string;
  created_at: string;
  plan_name?: string;
  price_hourly?: number;
  price_monthly?: number;
}

interface AppStats {
  uptime: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  bandwidth_usage: number;
  request_count: number;
  error_rate: number;
}

const clampPercent = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(num)));
};

const toDateString = (value: unknown, fallback?: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return fallback ?? new Date().toISOString();
};

const toOptionalDateString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
};

const normalizeEnvironmentVariables = (value: unknown): Array<{ key: string; value: string }> => {
  if (Array.isArray(value)) {
    return value
      .map((envVar) => {
        const key = typeof envVar?.key === 'string' ? envVar.key : '';
        const val = envVar?.value;
        return {
          key,
          value: typeof val === 'string' ? val : val !== undefined && val !== null ? String(val) : '',
        };
      })
      .filter((envVar) => envVar.key.length > 0);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, val]) => ({
      key,
      value: typeof val === 'string' ? val : val !== undefined && val !== null ? String(val) : '',
    }));
  }

  return [];
};

const normalizeAppResponse = (raw: any): PaaSApp => ({
  id: String(raw?.id ?? ''),
  name: typeof raw?.name === 'string' ? raw.name : 'Untitled Application',
  description: typeof raw?.description === 'string' ? raw.description : '',
  status: raw?.status ?? 'building',
  repository_url: raw?.repository_url ?? raw?.githubRepoUrl ?? raw?.github_repo_url ?? '',
  branch: raw?.branch ?? raw?.githubBranch ?? raw?.github_branch ?? 'main',
  last_commit: raw?.last_commit ?? raw?.lastCommit ?? raw?.githubCommitSha ?? raw?.github_commit_sha,
  last_deployed_at: toOptionalDateString(raw?.last_deployed_at ?? raw?.lastDeployedAt),
  created_at: toDateString(raw?.created_at ?? raw?.createdAt),
  updated_at: toDateString(raw?.updated_at ?? raw?.updatedAt),
  build_status: raw?.build_status ?? raw?.buildStatus,
  deployment_count: Number(raw?.deployment_count ?? raw?.deploymentCount ?? 0),
  plan_name: raw?.plan_name ?? raw?.planName ?? 'Unknown Plan',
  url: raw?.url ?? raw?.app_url ?? raw?.appUrl,
  build_command: raw?.build_command ?? raw?.buildCommand ?? '',
  start_command: raw?.start_command ?? raw?.startCommand ?? '',
  node_version: raw?.node_version ?? raw?.nodeVersion ?? '18.x',
  environment_variables: normalizeEnvironmentVariables(
    raw?.environment_variables ?? raw?.environmentVariables ?? raw?.environment_vars
  ),
  auto_deploy: Boolean(raw?.auto_deploy ?? raw?.autoDeploy ?? raw?.autoDeployments),
  addon_count: Number(raw?.addon_count ?? raw?.addonCount ?? 0),
});

const normalizeDeployment = (raw: any): Deployment => ({
  id: String(raw?.id ?? ''),
  app_id: raw?.app_id ?? raw?.appId ?? '',
  status: raw?.status ?? 'pending',
  commit_hash: raw?.commit_hash ?? raw?.commitHash ?? raw?.githubCommitSha ?? '',
  commit_message: raw?.commit_message ?? raw?.commitMessage ?? raw?.githubCommitMessage ?? '',
  branch: raw?.branch ?? raw?.githubBranch ?? 'main',
  created_at: toDateString(raw?.created_at ?? raw?.createdAt),
  completed_at: toOptionalDateString(
    raw?.completed_at ??
      raw?.completedAt ??
      raw?.deployment_completed_at ??
      raw?.deploymentCompletedAt ??
      raw?.build_completed_at ??
      raw?.buildCompletedAt
  ),
  build_logs: raw?.build_logs ?? raw?.buildLogs,
  deployment_logs: raw?.deployment_logs ?? raw?.deploymentLogs,
});

const normalizeAddOn = (raw: any): AddOn => ({
  id: String(raw?.id ?? ''),
  name: raw?.name ?? 'Add-on',
  type: raw?.type ?? raw?.service_type ?? raw?.serviceType ?? 'custom',
  status: raw?.status ?? 'provisioning',
  connection_string: raw?.connection_string ?? raw?.connectionString,
  created_at: toDateString(raw?.created_at ?? raw?.createdAt),
  plan_name: raw?.plan_name ?? raw?.planName,
  price_hourly:
    raw?.price_hourly !== undefined
      ? Number(raw.price_hourly)
      : raw?.priceHourly !== undefined
        ? Number(raw.priceHourly)
        : undefined,
  price_monthly:
    raw?.price_monthly !== undefined
      ? Number(raw.price_monthly)
      : raw?.priceMonthly !== undefined
        ? Number(raw.priceMonthly)
        : undefined,
});

const normalizeStats = (raw: any): AppStats => ({
  uptime: clampPercent(raw?.uptime ?? raw?.uptime_percent ?? raw?.uptimePercent ?? 0),
  cpu_usage: clampPercent(raw?.cpu_usage ?? raw?.cpuUsage ?? raw?.cpu ?? 0),
  memory_usage: clampPercent(raw?.memory_usage ?? raw?.memoryUsage ?? raw?.memory ?? 0),
  disk_usage: clampPercent(raw?.disk_usage ?? raw?.diskUsage ?? raw?.storage ?? 0),
  bandwidth_usage: clampPercent(raw?.bandwidth_usage ?? raw?.bandwidthUsage ?? raw?.bandwidth ?? 0),
  request_count: Number(raw?.request_count ?? raw?.requestCount ?? 0) || 0,
  error_rate: clampPercent(raw?.error_rate ?? raw?.errorRate ?? 0),
});

export const ApplicationDetails: React.FC = () => {
  const { token, loading: authLoading } = useAuth();
  const { appId } = useParams();
  const navigate = useNavigate();

  const [app, setApp] = useState<PaaSApp | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchApp = async () => {
    if (!appId || !token) return;

    try {
      const response = await fetch(`/api/paas/apps/${appId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch application');
      const data = await response.json();
      const appPayload = data?.data ?? data?.app;
      if (!appPayload) {
        throw new Error('Invalid application payload');
      }
      setApp(normalizeAppResponse(appPayload));
    } catch (error) {
      console.error('Error fetching app:', error);
      toast.error('Failed to fetch application details');
    }
  };

  const fetchDeployments = async () => {
    if (!appId || !token) return;

    try {
      const response = await fetch(`/api/paas/apps/${appId}/deployments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch deployments');
      const data = await response.json();
      const rawDeployments = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.deployments)
          ? data.data.deployments
          : [];
      setDeployments(rawDeployments.map(normalizeDeployment));
    } catch (error) {
      console.error('Error fetching deployments:', error);
      toast.error('Failed to fetch deployment history');
    }
  };

  const fetchAddOns = async () => {
    if (!appId || !token) return;

    try {
      const response = await fetch(`/api/paas/apps/${appId}/addons`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 404) {
        setAddons([]);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch add-ons');
      const data = await response.json();
      const rawAddOns = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.addons)
          ? data.data.addons
          : [];
      setAddons(rawAddOns.map(normalizeAddOn));
    } catch (error) {
      console.error('Error fetching add-ons:', error);
      toast.error('Failed to fetch add-ons');
    }
  };

  const fetchStats = async () => {
    if (!appId || !token) return;

    try {
      const response = await fetch(`/api/paas/apps/${appId}/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 404) {
        setStats(null);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      if (!data?.data) {
        setStats(null);
        return;
      }
      setStats(normalizeStats(data.data));
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Don't show error toast for stats as it's not critical
    }
  };

  const refreshData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        fetchApp(),
        fetchDeployments(),
        fetchAddOns(),
        fetchStats(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerDeployment = async () => {
    if (!appId) return;

    setActionLoading('deploy');
    try {
      if (!token) {
        toast.error('You must be signed in to manage applications');
        return;
      }
      const response = await fetch(`/api/paas/apps/${appId}/redeploy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to trigger deployment');

      toast.success('Deployment triggered successfully');
      refreshData();
    } catch (error) {
      console.error('Error triggering deployment:', error);
      toast.error('Failed to trigger deployment');
    } finally {
      setActionLoading(null);
    }
  };

  const stopApp = async () => {
    if (!appId) return;

    setActionLoading('stop');
    try {
      if (!token) {
        toast.error('You must be signed in to manage applications');
        return;
      }
      const response = await fetch(`/api/paas/apps/${appId}/stop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to stop app');

      toast.success('Application stopped successfully');
      refreshData();
    } catch (error) {
      console.error('Error stopping app:', error);
      toast.error('Failed to stop application');
    } finally {
      setActionLoading(null);
    }
  };

  const startApp = async () => {
    if (!appId) return;

    setActionLoading('start');
    try {
      if (!token) {
        toast.error('You must be signed in to manage applications');
        return;
      }
      const response = await fetch(`/api/paas/apps/${appId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to start app');

      toast.success('Application started successfully');
      refreshData();
    } catch (error) {
      console.error('Error starting app:', error);
      toast.error('Failed to start application');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteApp = async () => {
    if (!appId) return;

    setActionLoading('delete');
    try {
      if (!token) {
        toast.error('You must be signed in to manage applications');
        return;
      }
      const response = await fetch(`/api/paas/apps/${appId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete app');

      toast.success('Application deleted successfully');
      navigate('/paas');
    } catch (error) {
      console.error('Error deleting app:', error);
      toast.error('Failed to delete application');
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!token) {
      setLoading(false);
      setApp(null);
      setDeployments([]);
      setAddons([]);
      setStats(null);
      return;
    }

    refreshData();
  }, [appId, token, authLoading]);

  if (loading || !app) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return <Badge className="bg-green-100 text-green-600">Deployed</Badge>;
      case 'building':
        return <Badge className="bg-blue-100 text-blue-600">Building</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-600">Error</Badge>;
      case 'stopped':
        return <Badge className="bg-gray-100 text-gray-600">Stopped</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'building':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/paas')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{app.name}</h1>
              {getStatusBadge(app.status)}
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
            </div>
            <p className="text-muted-foreground">{app.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={triggerDeployment}
            disabled={actionLoading === 'deploy' || app.status === 'building'}
            className="gap-2"
          >
            {actionLoading === 'deploy' ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Deploy
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/paas/apps/${app.id}/edit`}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/paas/apps/${app.id}/logs`}>
                  <Code className="h-4 w-4 mr-2" />
                  View Logs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {app.status === 'deployed' ? (
                <DropdownMenuItem onClick={stopApp} disabled={actionLoading === 'stop'}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Application
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={startApp} disabled={actionLoading === 'start'}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Application
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-600"
                disabled={actionLoading === 'delete'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Application
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {getStatusIcon(app.status)}
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium capitalize">{app.status}</div>
              {app.last_deployed_at && (
                <div className="text-sm text-muted-foreground">
                  Last deployed {new Date(app.last_deployed_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5" />
              Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium text-sm truncate">{app.branch}</div>
              <a
                href={app.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View Repository →
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium">{app.plan_name}</div>
              <div className="text-sm text-muted-foreground">
                Node.js {app.node_version}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium">{app.deployment_count} deployments</div>
              <div className="text-sm text-muted-foreground">
                {addons.length} add-ons
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Application Info */}
            <Card>
              <CardHeader>
                <CardTitle>Application Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Repository URL</Label>
                  <div className="mt-1">
                    <a
                      href={app.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {app.repository_url}
                    </a>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Build Command</Label>
                  <div className="mt-1 p-2 bg-muted rounded text-sm font-mono">
                    {app.build_command}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Start Command</Label>
                  <div className="mt-1 p-2 bg-muted rounded text-sm font-mono">
                    {app.start_command}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Auto Deploy</Label>
                  <div className="mt-1">
                    <Badge variant={app.auto_deploy ? "default" : "secondary"}>
                      {app.auto_deploy ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Environment Variables */}
            <Card>
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
              </CardHeader>
              <CardContent>
                {app.environment_variables.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No environment variables configured</p>
                ) : (
                  <div className="space-y-2">
                    {app.environment_variables.map((envVar, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className="font-mono text-sm font-medium">{envVar.key}</div>
                        <div className="text-muted-foreground">=</div>
                        <div className="font-mono text-sm text-muted-foreground truncate">
                          {envVar.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Stats */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Live Statistics</CardTitle>
                <CardDescription>Real-time application performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">CPU Usage</Label>
                      <span className="text-sm">{stats.cpu_usage}%</span>
                    </div>
                    <Progress value={stats.cpu_usage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Memory Usage</Label>
                      <span className="text-sm">{stats.memory_usage}%</span>
                    </div>
                    <Progress value={stats.memory_usage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Disk Usage</Label>
                      <span className="text-sm">{stats.disk_usage}%</span>
                    </div>
                    <Progress value={stats.disk_usage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Uptime</Label>
                      <span className="text-sm">{stats.uptime}%</span>
                    </div>
                    <Progress value={stats.uptime} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Request Count</Label>
                    <div className="text-2xl font-bold">{stats.request_count.toLocaleString()}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Error Rate</Label>
                    <div className="text-2xl font-bold text-red-600">{stats.error_rate}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                Track all deployments and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center py-8">
                  <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No deployments yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Trigger your first deployment to see it here
                  </p>
                  <Button onClick={triggerDeployment} className="gap-2">
                    <Rocket className="h-4 w-4" />
                    Deploy Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {deployments.map((deployment) => (
                    <div
                      key={deployment.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {deployment.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : deployment.status === 'failed' ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : deployment.status === 'running' ? (
                            <Activity className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-500" />
                          )}
                          <Badge
                            variant={
                              deployment.status === 'success'
                                ? 'default'
                                : deployment.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {deployment.status}
                          </Badge>
                        </div>
                        <div>
                          <div className="font-medium">{deployment.commit_message}</div>
                          <div className="text-sm text-muted-foreground">
                            {deployment.branch} • {deployment.commit_hash.substring(0, 7)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(deployment.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Logs
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connected Add-ons</CardTitle>
                  <CardDescription>
                    Manage databases and other services for your application
                  </CardDescription>
                </div>
                <Link to="/paas/addons">
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Service
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {addons.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No add-ons connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a database or other service to enhance your application
                  </p>
                  <Link to="/paas/addons">
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Browse Add-ons
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {addons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Database className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{addon.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {addon.type} • {addon.status}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Connected {new Date(addon.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                Configure your application's deployment and runtime settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Edit Application Configuration</div>
                    <div className="text-sm text-muted-foreground">
                      Update build commands, environment variables, and other settings
                    </div>
                  </div>
                  <Link to={`/paas/apps/${app.id}/edit`}>
                    <Button variant="outline">Edit Settings</Button>
                  </Link>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">View Application Logs</div>
                    <div className="text-sm text-muted-foreground">
                      Monitor build logs, deployment logs, and runtime logs
                    </div>
                  </div>
                  <Link to={`/paas/apps/${app.id}/logs`}>
                    <Button variant="outline">View Logs</Button>
                  </Link>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50">
                  <div>
                    <div className="font-medium text-red-800">Danger Zone</div>
                    <div className="text-sm text-red-600">
                      Delete this application and all its data permanently
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={actionLoading === 'delete'}
                  >
                    Delete Application
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application "{app.name}" and all its data. This action cannot be undone.
              The application URL will become unavailable immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteApp}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading === 'delete'}
            >
              {actionLoading === 'delete' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Application'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
