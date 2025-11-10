/**
 * PaaS App Detail Page
 * Comprehensive view of a single application with tabs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Rocket,
  Play,
  Square,
  RotateCcw,
  Settings,
  Trash2,
  ExternalLink,
  Activity,
  FileText,
  Key,
  Globe,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { DeploymentsList } from '@/components/PaaS/DeploymentsList';
import { LogViewer } from '@/components/PaaS/LogViewer';
import { EnvVarManager } from '@/components/PaaS/EnvVarManager';
import { AppSettings } from '@/components/PaaS/AppSettings';
import { ScaleSlider } from '@/components/PaaS/ScaleSlider';
import { DomainManager } from '@/components/PaaS/DomainManager';
import { ResourceMetrics } from '@/components/PaaS/ResourceMetrics';
import { DeploymentProgress } from '@/components/PaaS/DeploymentProgress';

interface App {
  id: string;
  name: string;
  slug: string;
  git_url?: string;
  git_branch: string;
  buildpack?: string;
  status: string;
  subdomain: string;
  replicas: number;
  plan_name: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  max_replicas?: number;
  plan_price_per_hour?: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  inactive: 'bg-gray-500',
  building: 'bg-blue-500',
  deploying: 'bg-yellow-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-500',
  failed: 'bg-red-500',
  suspended: 'bg-orange-500',
};

const getJobStorageKey = (appId: string) => `paas:deploy-job:${appId}`;

const PaaSAppDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeJob, setActiveJob] = useState<{ jobId: string; queue?: string } | null>(null);
  const [deploymentsRefresh, setDeploymentsRefresh] = useState(0);
  const [defaultDomain, setDefaultDomain] = useState('apps.example.com');
  const { token } = useAuth();
  const navigate = useNavigate();
  const currentAppId = app?.id || id || '';

  const loadApp = useCallback(async () => {
    if (!id || !token) return;
    try {
      const data = await apiClient.get(`/paas/apps/${id}`);
      setApp(data.app);
    } catch (error: any) {
      toast.error('Failed to load application');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    const loadDefaultDomainSetting = async () => {
      try {
        const data = await apiClient.get('/admin/paas/settings');
        const domainSetting = data.settings?.find((setting: any) => setting.key === 'default_domain');
        if (domainSetting?.value_encrypted) {
          setDefaultDomain(domainSetting.value_encrypted);
        }
      } catch (error) {
        console.warn('Failed to load default domain setting:', error);
      }
    };
    loadDefaultDomainSetting();
  }, []);

  useEffect(() => {
    if (!id) return;
    try {
      const stored = sessionStorage.getItem(getJobStorageKey(id));
      if (stored) {
        setActiveJob(JSON.parse(stored));
      }
    } catch {
      sessionStorage.removeItem(getJobStorageKey(id));
    }
  }, [id]);

  useEffect(() => {
    loadApp();
    // Refresh every 10 seconds if building/deploying
    const interval = setInterval(() => {
      if (app && ['building', 'deploying'].includes(app.status)) {
        loadApp();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadApp, app]);

  const handleDeploy = async () => {
    if (!app) return;
    setDeploying(true);
    try {
      const response = await apiClient.post<{ jobId?: string; queue?: string }>(`/paas/apps/${app.id}/deploy`, {});
      toast.success('Deployment started!');
      if (response?.jobId) {
        const jobPayload = { jobId: String(response.jobId), queue: response.queue };
        setActiveJob(jobPayload);
        sessionStorage.setItem(getJobStorageKey(app.id), JSON.stringify(jobPayload));
      }
      setActiveTab('deployments');
      loadApp();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start deployment');
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async () => {
    if (!app) return;
    try {
      await apiClient.post(`/paas/apps/${app.id}/stop`, {});
      toast.success('Application stopped');
      loadApp();
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop application');
    }
  };

  const handleRestart = async () => {
    if (!app) return;
    setRestarting(true);
    try {
      await apiClient.post(`/paas/apps/${app.id}/restart`, {});
      toast.success('Application restarting');
      loadApp();
    } catch (error: any) {
      toast.error(error.message || 'Failed to restart application');
    } finally {
      setRestarting(false);
    }
  };

  const handleDelete = async () => {
    if (!app) return;
    if (!confirm(`Are you sure you want to delete "${app.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.delete(`/paas/apps/${app.id}`);
      toast.success('Application deleted');
      navigate('/paas');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete application');
    }
  };

  const triggerDeploymentRefresh = useCallback(() => {
    setDeploymentsRefresh((value) => value + 1);
  }, []);

  const handleJobComplete = useCallback(() => {
    if (currentAppId) {
      sessionStorage.removeItem(getJobStorageKey(currentAppId));
    }
    setActiveJob(null);
    triggerDeploymentRefresh();
    loadApp();
  }, [currentAppId, triggerDeploymentRefresh, loadApp]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-bold mb-2">Application Not Found</h2>
            <Button onClick={() => navigate('/paas')}>Back to Applications</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const domainHost = defaultDomain || 'apps.example.com';
  const appUrl = `https://${app.subdomain}.${domainHost}`;
  const maxReplicas = app.max_replicas ?? 20;
  const hourlyRate = Number(app.plan_price_per_hour ?? 0);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <Button
        variant="ghost"
        onClick={() => navigate('/paas')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Applications
      </Button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {app.name}
            <Badge className={statusColors[app.status]}>
              {app.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">{app.slug}</p>
        </div>

        <div className="flex gap-2">
          {app.status === 'running' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => window.open(appUrl, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open App
              </Button>
              <Button variant="outline" size="sm" onClick={handleStop}>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          ) : ['stopped', 'suspended'].includes(app.status) ? (
            <Button variant="outline" size="sm" onClick={handleRestart} disabled={restarting}>
              <Play className="w-4 h-4 mr-2" />
              {restarting ? 'Restarting...' : 'Restart'}
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={handleDeploy}
            disabled={deploying || !app.git_url || ['building', 'deploying'].includes(app.status)}
          >
            <Rocket className="w-4 h-4 mr-2" />
            {deploying ? 'Deploying...' : 'Deploy'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app.plan_name}</div>
            <p className="text-xs text-muted-foreground">
              {app.cpu_cores} CPU, {app.ram_mb}MB RAM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Replicas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app.replicas}</div>
            <p className="text-xs text-muted-foreground">Running instances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Buildpack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app.buildpack || 'Auto'}</div>
            <p className="text-xs text-muted-foreground">Build system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">URL</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {app.subdomain}.apps.example.com
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7 gap-2">
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="deployments">
            <Rocket className="w-4 h-4 mr-2" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="environment">
            <Key className="w-4 h-4 mr-2" />
            Environment
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Globe className="w-4 h-4 mr-2" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Git Repository</h4>
                <p className="text-sm text-muted-foreground">
                  {app.git_url || 'No repository configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Branch: {app.git_branch}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Scale Application</h4>
                <ScaleSlider
                  appId={app.id}
                  currentReplicas={app.replicas}
                  maxReplicas={maxReplicas}
                  hourlyRate={hourlyRate}
                  onUpdate={loadApp}
                />
              </div>

              <div>
                <h4 className="font-semibold mb-2">Quick Actions</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('logs')}>
                    View Logs
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('deployments')}>
                    Deployment History
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete App
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <DeploymentProgress
            appId={app.id}
            jobInfo={activeJob}
            onJobComplete={handleJobComplete}
            onDeploymentUpdated={triggerDeploymentRefresh}
          />
          <DeploymentsList appId={app.id} refreshToken={deploymentsRefresh} />
        </TabsContent>

        <TabsContent value="logs">
          <LogViewer appId={app.id} />
        </TabsContent>

        <TabsContent value="environment">
          <EnvVarManager appId={app.id} />
        </TabsContent>

        <TabsContent value="settings">
          <AppSettings app={app} onUpdate={loadApp} />
        </TabsContent>

        <TabsContent value="domains">
          <DomainManager appId={app.id} appSlug={app.slug} defaultDomain={domainHost} />
        </TabsContent>

        <TabsContent value="metrics">
          <ResourceMetrics appId={app.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaaSAppDetail;
