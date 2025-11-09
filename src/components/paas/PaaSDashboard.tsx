/**
 * Customer PaaS Dashboard
 * Main dashboard for managing PaaS applications
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Cloud,
  Code,
  Database,
  ExternalLink,
  GitBranch,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Rocket,
  Server,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  plan_name: string;
  url?: string;
  created_at: string;
  updated_at: string;
  build_status?: 'pending' | 'running' | 'success' | 'failed';
  deployment_count: number;
  addon_count: number;
}

interface PaaSDashboardStats {
  total_apps: number;
  deployed_apps: number;
  building_apps: number;
  error_apps: number;
  total_deployments: number;
  total_addons: number;
  monthly_spend: number;
  last_build_status?: 'success' | 'failed';
}

const normalizeApp = (raw: any): PaaSApp => ({
  id: String(raw?.id ?? ''),
  name: typeof raw?.name === 'string' ? raw.name : 'Untitled Application',
  description: typeof raw?.description === 'string' ? raw.description : '',
  status: (raw?.status as PaaSApp['status']) ?? 'building',
  repository_url:
    (raw?.repository_url as string) ??
    (raw?.repositoryUrl as string) ??
    (raw?.githubRepoUrl as string) ??
    (raw?.github_repo_url as string) ??
    '',
  branch:
    (raw?.branch as string) ??
    (raw?.githubBranch as string) ??
    (raw?.github_branch as string) ??
    'main',
  last_commit:
    (raw?.last_commit as string) ??
    (raw?.lastCommit as string) ??
    (raw?.githubCommitSha as string) ??
    (raw?.lastCommitSha as string),
  last_deployed_at:
    (raw?.last_deployed_at as string) ??
    (raw?.lastDeployedAt as string) ??
    (raw?.lastDeployed as string),
  plan_name:
    (raw?.plan_name as string) ??
    (raw?.planName as string) ??
    (raw?.plan?.name as string) ??
    'Unknown Plan',
  url: (raw?.url as string) ?? (raw?.app_url as string) ?? (raw?.appUrl as string),
  created_at: (raw?.created_at as string) ?? (raw?.createdAt as string) ?? '',
  updated_at: (raw?.updated_at as string) ?? (raw?.updatedAt as string) ?? '',
  build_status: (raw?.build_status as PaaSApp['build_status']) ?? (raw?.buildStatus as PaaSApp['build_status']),
  deployment_count: Number(raw?.deployment_count ?? raw?.deploymentCount ?? 0),
  addon_count: Number(raw?.addon_count ?? raw?.addonCount ?? 0),
});

const normalizeStats = (raw: any): PaaSDashboardStats => ({
  total_apps: Number(raw?.total_apps ?? raw?.totalApps) || 0,
  deployed_apps: Number(raw?.deployed_apps ?? raw?.deployedApps) || 0,
  building_apps: Number(raw?.building_apps ?? raw?.buildingApps) || 0,
  error_apps: Number(raw?.error_apps ?? raw?.errorApps) || 0,
  total_deployments: Number(raw?.total_deployments ?? raw?.totalDeployments) || 0,
  total_addons: Number(raw?.total_addons ?? raw?.totalAddons) || 0,
  monthly_spend: Number(raw?.monthly_spend ?? raw?.monthlySpend) || 0,
  last_build_status:
    raw?.last_build_status === 'success' || raw?.last_build_status === 'failed'
      ? raw.last_build_status
      : raw?.lastBuildStatus === 'success' || raw?.lastBuildStatus === 'failed'
        ? raw.lastBuildStatus
        : undefined,
});

export const PaaSDashboard: React.FC = () => {
  const { token, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<PaaSApp[]>([]);
  const [stats, setStats] = useState<PaaSDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteAppId, setDeleteAppId] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/paas/apps', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch apps');
      const data = await response.json();
      const fetchedApps = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data?.apps)
          ? data.data.apps
          : [];
      const normalizedApps = fetchedApps.map(normalizeApp);
      setApps(normalizedApps);
    } catch (error) {
      console.error('Error fetching apps:', error);
      toast.error('Failed to fetch applications');
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/paas/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      const fetchedStats = data.data && typeof data.data === 'object' ? normalizeStats(data.data) : null;
      setStats(fetchedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to fetch statistics');
    }
  }, [token]);

  const refreshData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchApps(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchApps, fetchStats, token]);

  const deleteApp = async (appId: string) => {
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
      setDeleteAppId(null);
      refreshData();
    } catch (error) {
      console.error('Error deleting app:', error);
      toast.error('Failed to delete application');
    }
  };

  const redeployApp = async (appId: string) => {
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

      if (!response.ok) throw new Error('Failed to trigger redeploy');

      toast.success('Redeployment triggered successfully');
      refreshData();
    } catch (error) {
      console.error('Error triggering redeploy:', error);
      toast.error('Failed to trigger redeployment');
    }
  };

  const stopApp = async (appId: string) => {
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
    }
  };

  const startApp = async (appId: string) => {
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
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!token) {
      setLoading(false);
      setApps([]);
      setStats(null);
      return;
    }
    refreshData();
  }, [authLoading, token, refreshData]);

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
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const appList = Array.isArray(apps) ? apps : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PaaS Dashboard</h1>
          <p className="text-muted-foreground">
            Deploy and manage your Node.js applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={loading || !token}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/paas/apps/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Application
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Rocket className="h-5 w-5" />
                Applications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">{stats.total_apps}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{stats.deployed_apps} deployed</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3 text-blue-500" />
                  <span>{stats.building_apps} building</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span>{stats.error_apps} errors</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-gray-500" />
                  <span>{stats.total_deployments} deploys</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Add-ons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">{stats.total_addons}</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Active Services</span>
                  <Badge variant="secondary">{stats.total_addons}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Monthly Spend</span>
                  <span className="font-medium">
                    ${stats.monthly_spend.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">Active</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Deployed Apps</span>
                  <span className="font-medium">{stats.deployed_apps}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Build Status</span>
                  <div className="flex items-center gap-1">
                    {stats.last_build_status === 'success' ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="capitalize">{stats.last_build_status || 'No builds'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">
                ${stats.monthly_spend.toFixed(2)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>This Month</span>
                  <span className="font-medium">
                    ${stats.monthly_spend.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Deployments</span>
                  <Badge variant="secondary">{stats.total_deployments}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Your Applications
          </CardTitle>
          <CardDescription>
            Manage your deployed applications and deployment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appList.length === 0 ? (
            <div className="text-center py-12">
              <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
              <p className="text-muted-foreground mb-4">
                Deploy your first Node.js application to get started
              </p>
              <Link to="/paas/apps/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Application
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {appList.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(app.status)}
                      {getStatusBadge(app.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{app.name}</h4>
                        {app.url && (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {app.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          <span>{app.branch}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{app.plan_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          <span>{app.addon_count} add-ons</span>
                        </div>
                        {app.last_deployed_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              Deployed {new Date(app.last_deployed_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/paas/apps/${app.id}`}>
                            <Settings className="h-4 w-4 mr-2" />
                            Manage
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/paas/apps/${app.id}/deployments`}>
                            <Activity className="h-4 w-4 mr-2" />
                            Deployments
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/paas/apps/${app.id}/logs`}>
                            <Code className="h-4 w-4 mr-2" />
                            Logs
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {app.status === 'deployed' ? (
                          <DropdownMenuItem onClick={() => stopApp(app.id)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Stop
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => startApp(app.id)}>
                            <Zap className="h-4 w-4 mr-2" />
                            Start
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => redeployApp(app.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Redeploy
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteAppId(app.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common tasks for managing your PaaS applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/paas/apps/new">
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-2"
              >
                <Plus className="h-6 w-6" />
                <span>New Application</span>
              </Button>
            </Link>
            <Link to="/paas/addons">
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-2"
              >
                <Database className="h-6 w-6" />
                <span>Manage Add-ons</span>
              </Button>
            </Link>
            <Link to="/paas/billing">
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-2"
              >
                <TrendingUp className="h-6 w-6" />
                <span>Billing & Usage</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deleteAppId)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteAppId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application and all its data. This action cannot be undone.
              The application URL will become unavailable immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAppId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAppId) {
                  deleteApp(deleteAppId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
