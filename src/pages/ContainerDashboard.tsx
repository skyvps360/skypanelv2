/**
 * Container Dashboard Component
 * Main dashboard for Easypanel Container as a Service (CaaS) management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Plus,
  ArrowUpRight,
  Server,
  Database,
  Globe,
  AlertTriangle,
  TrendingUp,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity as ActivityIcon,
  Settings,
  Play,
  Square,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useContainerError } from '@/hooks/useContainerError';
import { ContainerErrorBoundary, ContainerErrorFallback } from '@/components/containers/ContainerErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { containerService } from '@/services/containerService';
import type {
  ContainerSubscription,
  ContainerProject,
  ResourceUsage,
  ContainerService as ContainerServiceType
} from '@/types/containers';

interface ContainerDashboardState {
  subscription: ContainerSubscription | null;
  projects: ContainerProject[];
  resourceUsage: ResourceUsage | null;
  quota: ResourceUsage | null;
  percentages: {
    cpu: number;
    memory: number;
    storage: number;
    containers: number;
  } | null;
  loading: boolean;
  error: string | null;
}

const ContainerDashboard: React.FC = () => {
  const [state, setState] = useState<ContainerDashboardState>({
    subscription: null,
    projects: [],
    resourceUsage: null,
    quota: null,
    percentages: null,
    loading: true,
    error: null
  });
  const { token } = useAuth();
  const navigate = useNavigate();
  const { handleError, showBillingError, showConfigError } = useContainerError();

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [subscriptionResult, projectsResult, usageResult] = await Promise.all([
        containerService.getSubscription(),
        containerService.getProjects(),
        containerService.getResourceUsage()
      ]);

      if (!subscriptionResult.success) {
        throw new Error(subscriptionResult.error || 'Failed to load subscription');
      }

      if (!projectsResult.success) {
        throw new Error(projectsResult.error || 'Failed to load projects');
      }

      if (!usageResult.success) {
        throw new Error(usageResult.error || 'Failed to load resource usage');
      }

      setState(prev => ({
        ...prev,
        subscription: subscriptionResult.subscription || null,
        projects: projectsResult.projects || [],
        resourceUsage: usageResult.usage || null,
        quota: usageResult.quota || null,
        percentages: usageResult.percentages || null,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to load container dashboard data:', error);
      
      // Handle specific error types based on the error response
      handleError(error, { customMessage: 'Failed to load dashboard data' });
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data'
      }));
    }
  }, [token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = useMemo(() => [
    {
      title: 'Create Project',
      description: 'Start a new container project to organize your services.',
      action: () => navigate('/containers/projects/new'),
      icon: <Plus className="h-4 w-4" />
    },
    {
      title: 'Browse Templates',
      description: 'Deploy popular applications with one-click templates.',
      action: () => navigate('/containers/templates'),
      icon: <Globe className="h-4 w-4" />
    },
    {
      title: 'View Plans',
      description: 'Upgrade your subscription or view plan details.',
      action: () => navigate('/containers/plans'),
      icon: <Settings className="h-4 w-4" />
    }
  ], [navigate]);

  const dashboardStats = useMemo(() => {
    const totalServices = state.projects.reduce((sum, project) => 
      sum + (project.services?.length || 0), 0
    );
    
    const runningServices = state.projects.reduce((sum, project) => 
      sum + (project.services?.filter(service => service.status === 'running').length || 0), 0
    );

    const stoppedServices = totalServices - runningServices;

    return {
      totalProjects: state.projects.length,
      totalServices,
      runningServices,
      stoppedServices
    };
  }, [state.projects]);

  const getServiceTypeIcon = useCallback((serviceType: ContainerServiceType['serviceType']) => {
    switch (serviceType) {
      case 'postgres':
      case 'mysql':
      case 'mariadb':
      case 'mongo':
      case 'redis':
        return <Database className="h-4 w-4" />;
      case 'app':
      case 'wordpress':
        return <Globe className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'stopped':
        return 'bg-muted text-muted-foreground border-muted';
      case 'deploying':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  }, []);

  const handleProjectClick = useCallback((projectName: string) => {
    navigate(`/containers/projects/${projectName}`);
  }, [navigate]);

  if (state.loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-3xl border bg-card/60 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
          <Skeleton className="mt-6 h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Failed to load container dashboard</p>
        <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
        <Button onClick={loadDashboardData} size="sm" className="mt-4">
          Try again
        </Button>
      </div>
    );
  }

  if (!state.subscription) {
    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-10">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 left-10 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <Container className="mb-4 h-12 w-12 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Container as a Service
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Deploy and manage containerized applications with Easypanel integration. 
              Choose a plan to get started with your container infrastructure.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/containers/plans">
                  <Plus className="mr-2 h-4 w-4" />
                  Choose a Plan
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/containers/templates">
                  Browse Templates
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-10">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_60%)]" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit bg-primary/15 text-primary">
              Container Dashboard
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Container Management Center
              </h1>
              <p className="max-w-xl text-base text-muted-foreground">
                Deploy, manage, and monitor your containerized applications with real-time metrics and unified control.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-4 py-2">
                <Server className="h-4 w-4 text-primary" />
                {dashboardStats.totalProjects} projects
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-400">
                <Play className="h-4 w-4" />
                {dashboardStats.runningServices} running
              </span>
              {dashboardStats.stoppedServices > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-400">
                  <Square className="h-4 w-4" />
                  {dashboardStats.stoppedServices} stopped
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/containers/projects/new')}>
                <Plus className="mr-2 h-4 w-4" />Create Project
              </Button>
              <Button variant="outline" asChild>
                <Link to="/containers/templates">
                  Browse Templates
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Resource Usage Card */}
          {state.resourceUsage && state.quota && state.percentages && (
            <Card className="w-full max-w-sm border-primary/20 bg-background/70 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-muted-foreground">
                  Resource Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Cpu className="h-4 w-4" />
                        CPU Cores
                      </span>
                      <span className="font-medium">
                        {state.resourceUsage.cpuCores} / {state.quota.cpuCores}
                      </span>
                    </div>
                    <Progress value={state.percentages.cpu} className="mt-1 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.cpu.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <MemoryStick className="h-4 w-4" />
                        Memory
                      </span>
                      <span className="font-medium">
                        {state.resourceUsage.memoryGb}GB / {state.quota.memoryGb}GB
                      </span>
                    </div>
                    <Progress value={state.percentages.memory} className="mt-1 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.memory.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <HardDrive className="h-4 w-4" />
                        Storage
                      </span>
                      <span className="font-medium">
                        {state.resourceUsage.storageGb}GB / {state.quota.storageGb}GB
                      </span>
                    </div>
                    <Progress value={state.percentages.storage} className="mt-1 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.storage.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Container className="h-4 w-4" />
                        Containers
                      </span>
                      <span className="font-medium">
                        {state.resourceUsage.containerCount} / {state.quota.containerCount}
                      </span>
                    </div>
                    <Progress value={state.percentages.containers} className="mt-1 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.containers.toFixed(1)}% used
                    </p>
                  </div>
                </div>

                {/* Warning for high usage */}
                {Object.values(state.percentages).some(p => p > 80) && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">High Usage Warning</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-600/80">
                      Some resources are above 80% usage. Consider upgrading your plan.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Projects</p>
              <p className="text-3xl font-semibold tracking-tight">{dashboardStats.totalProjects}</p>
              <p className="text-xs text-muted-foreground">Container projects</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Server className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Services</p>
              <p className="text-3xl font-semibold tracking-tight">{dashboardStats.totalServices}</p>
              <p className="text-xs text-muted-foreground">Deployed containers</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Container className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Running</p>
              <p className="text-3xl font-semibold tracking-tight">{dashboardStats.runningServices}</p>
              <p className="text-xs text-muted-foreground">Active services</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500">
              <Play className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Plan</p>
              <p className="text-3xl font-semibold tracking-tight">{state.subscription.plan?.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">Current subscription</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Main Content */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Projects List */}
        <Card className="h-full">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Container Projects</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your containerized applications organized by project.
              </p>
            </div>
            <Button onClick={() => navigate('/containers/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
                <Server className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No projects yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create your first project to start deploying containerized applications.
                </p>
                <Button onClick={() => navigate('/containers/projects/new')} size="sm" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />Create Project
                </Button>
              </div>
            ) : (
              state.projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectClick(project.projectName)}
                  className="w-full rounded-2xl border border-muted bg-background p-5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{project.projectName}</span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {project.services?.length || 0} services • Created {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                      
                      {/* Services Preview */}
                      {project.services && project.services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {project.services.slice(0, 3).map((service) => (
                            <span
                              key={service.id}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                            >
                              {getServiceTypeIcon(service.serviceType)}
                              {service.serviceName}
                            </span>
                          ))}
                          {project.services.length > 3 && (
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                              +{project.services.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Common tasks for container management.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={action.action}
                className="flex w-full items-start gap-3 rounded-2xl border border-muted/60 bg-background/80 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {action.icon}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {action.title}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{action.description}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

// Wrap with error boundary
const ContainerDashboardWithErrorBoundary = () => (
  <ContainerErrorBoundary>
    <ContainerDashboard />
  </ContainerErrorBoundary>
);

export default ContainerDashboardWithErrorBoundary;