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
  Settings,
  Play,
  Square
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useContainerError } from '@/hooks/useContainerError';
import { ContainerErrorBoundary } from '@/components/containers/ContainerErrorBoundary';
import { CancelSubscriptionDialog } from '@/components/containers/CancelSubscriptionDialog';
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
  const { handleError } = useContainerError();

  const loadDashboardData = useCallback(async () => {
    if (!token) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const subscriptionResult = await containerService.getSubscription();

      if (!subscriptionResult.success) {
        throw new Error(subscriptionResult.error || 'Failed to load subscription');
      }

      const subscription = subscriptionResult.subscription || null;

      if (!subscription) {
        setState(prev => ({
          ...prev,
          subscription: null,
          projects: [],
          resourceUsage: null,
          quota: null,
          percentages: null,
          loading: false,
          error: null
        }));
        return;
      }

      const [projectsResult, usageResult] = await Promise.all([
        containerService.getProjects(),
        containerService.getResourceUsage()
      ]);

      if (!projectsResult.success) {
        throw new Error(projectsResult.error || 'Failed to load projects');
      }

      if (!usageResult.success) {
        throw new Error(usageResult.error || 'Failed to load resource usage');
      }

      setState(prev => ({
        ...prev,
        subscription,
        projects: projectsResult.projects || [],
        resourceUsage: usageResult.usage || null,
        quota: usageResult.quota || null,
        percentages: usageResult.percentages || null,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to load container dashboard data:', error);

      handleError(error, { customMessage: 'Failed to load dashboard data' });

      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data'
      }));
    }
  }, [token, handleError]);

  const handleCancelSuccess = useCallback(() => {
    toast.success('Your subscription has been cancelled and any refund has been credited to your wallet.');
    // Reload dashboard to reflect changes
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCancelError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: 'Create Project',
        description: 'Start a new container project to organize your services.',
        action: () => navigate('/containers/projects/new'),
        icon: <Plus className="h-4 w-4" />
      },
      {
        title: 'View Plans',
        description: 'Upgrade your subscription or view plan details.',
        action: () => navigate('/containers/plans'),
        icon: <Settings className="h-4 w-4" />
      }
    ];

    if (state.subscription?.status === 'active') {
      actions.splice(1, 0, {
        title: 'Browse Templates',
        description: 'Deploy popular applications with one-click templates.',
        action: () => navigate('/containers/templates'),
        icon: <Globe className="h-4 w-4" />
      });
    }

    return actions;
  }, [navigate, state.subscription?.status]);

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

  const handleProjectClick = useCallback((projectName: string) => {
    navigate(`/containers/projects/${projectName}`);
  }, [navigate]);

  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <Skeleton className="h-6 w-32 mb-3" />
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-5 w-2/3" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
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
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 p-8 md:p-12">
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Container className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Container as a Service
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Deploy and manage containerized applications with ease. 
              Choose a plan to get started with your container infrastructure.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/containers/plans">
                  <Plus className="mr-2 h-4 w-4" />
                  Choose a Plan
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
            <Container className="absolute right-10 top-10 h-32 w-32 rotate-12" />
            <Server className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Container Dashboard
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Container Management Center
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Deploy, manage, and monitor your containerized applications with real-time metrics and unified control.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/containers/projects/new')} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/containers/projects')}>
              <Server className="mr-2 h-4 w-4" />
              View All Projects
            </Button>
            {state.subscription?.status === 'active' && (
              <Button variant="outline" size="lg" asChild>
                <Link to="/containers/templates">
                  Browse Templates
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Container className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <Server className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {/* Status Overview */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-2 px-3 py-1.5">
          <Server className="h-3 w-3" />
          {dashboardStats.totalProjects} projects
        </Badge>
        <Badge variant="outline" className="gap-2 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          {dashboardStats.runningServices} running
        </Badge>
        {dashboardStats.stoppedServices > 0 && (
          <Badge variant="secondary" className="gap-2 px-3 py-1.5">
            <Square className="h-3 w-3" />
            {dashboardStats.stoppedServices} stopped
          </Badge>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Projects</p>
                <p className="text-3xl font-bold tracking-tight">{dashboardStats.totalProjects}</p>
                <p className="text-xs text-muted-foreground">Container projects</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Server className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Services</p>
                <p className="text-3xl font-bold tracking-tight">{dashboardStats.totalServices}</p>
                <p className="text-xs text-muted-foreground">Deployed containers</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Container className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Running</p>
                <p className="text-3xl font-bold tracking-tight">{dashboardStats.runningServices}</p>
                <p className="text-xs text-muted-foreground">Active services</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Play className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Plan</p>
                <p className="text-2xl font-bold tracking-tight">{state.subscription.plan?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">Current subscription</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <TrendingUp className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects List - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Container Projects</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Manage your containerized applications</p>
            </div>
            <Button onClick={() => navigate('/containers/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {state.projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Server className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">No projects yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first project to start deploying containers
                  </p>
                  <Button onClick={() => navigate('/containers/projects/new')} size="sm" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                </div>
              ) : (
                state.projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectClick(project.projectName)}
                    className="group w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold group-hover:text-primary">{project.projectName}</h4>
                            <Badge
                              variant={project.status === 'active' ? 'default' : 'secondary'}
                            >
                              {project.status}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{project.services?.length || 0} services</span>
                          <span>•</span>
                          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        {/* Services Preview */}
                        {project.services && project.services.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {project.services.slice(0, 3).map((service) => (
                              <span
                                key={service.id}
                                className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
                              >
                                {getServiceTypeIcon(service.serviceType)}
                                {service.serviceName}
                              </span>
                            ))}
                            {project.services.length > 3 && (
                              <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
                                +{project.services.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resource Usage Card */}
          {state.resourceUsage && state.quota && state.percentages && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resource Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Cpu className="h-3.5 w-3.5" />
                        CPU Cores
                      </span>
                      <span className="font-semibold">
                        {state.resourceUsage.cpuCores} / {state.quota.cpuCores}
                      </span>
                    </div>
                    <Progress value={state.percentages.cpu} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.cpu.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MemoryStick className="h-3.5 w-3.5" />
                        Memory
                      </span>
                      <span className="font-semibold">
                        {state.resourceUsage.memoryGb}GB / {state.quota.memoryGb}GB
                      </span>
                    </div>
                    <Progress value={state.percentages.memory} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.memory.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5" />
                        Storage
                      </span>
                      <span className="font-semibold">
                        {state.resourceUsage.storageGb}GB / {state.quota.storageGb}GB
                      </span>
                    </div>
                    <Progress value={state.percentages.storage} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.storage.toFixed(1)}% used
                    </p>
                  </div>
                  
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Container className="h-3.5 w-3.5" />
                        Containers
                      </span>
                      <span className="font-semibold">
                        {state.resourceUsage.containerCount} / {state.quota.containerCount}
                      </span>
                    </div>
                    <Progress value={state.percentages.containers} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.percentages.containers.toFixed(1)}% used
                    </p>
                  </div>
                </div>

                {/* Warning for high usage */}
                {Object.values(state.percentages).some(p => p > 80) && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">High Usage</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
                      Some resources exceed 80%. Consider upgrading.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={action.action}
                  className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-accent"
                >
                  <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Cancel Subscription */}
          {state.subscription && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Subscription Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-sm font-medium">{state.subscription.plan?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${state.subscription.plan?.priceMonthly.toFixed(2)}/month
                    </p>
                  </div>
                  <CancelSubscriptionDialog
                    subscription={state.subscription}
                    projectCount={state.projects.length}
                    onSuccess={handleCancelSuccess}
                    onError={handleCancelError}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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
