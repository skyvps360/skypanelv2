/**
 * Project Detail Component
 * Detailed view for a specific container project with services management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Settings,
  Trash2,
  Play,
  Square,
  RotateCcw,
  Database,
  Globe,
  Server,
  AlertTriangle,
  ExternalLink,
  Edit,
  Save,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { containerService } from '@/services/containerService';
import type {
  ContainerProject,
  ContainerService as ContainerServiceType
} from '@/types/containers';

interface ProjectDetailState {
  project: ContainerProject | null;
  services: ContainerServiceType[];
  loading: boolean;
  error: string | null;
  updating: boolean;
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

const ProjectDetail: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    services: [],
    loading: true,
    error: null,
    updating: false
  });
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvironmentVariable[]>([]);
  const [showEnvValues, setShowEnvValues] = useState<Record<string, boolean>>({});
  const { token } = useAuth();
  const navigate = useNavigate();

  const loadProjectData = useCallback(async () => {
    if (!token || !projectName) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [projectResult, servicesResult] = await Promise.all([
        containerService.getProject(projectName),
        containerService.getServices(projectName)
      ]);

      if (!projectResult.success) {
        throw new Error(projectResult.error || 'Failed to load project');
      }

      if (!servicesResult.success) {
        throw new Error(servicesResult.error || 'Failed to load services');
      }

      setState(prev => ({
        ...prev,
        project: projectResult.project || null,
        services: servicesResult.services || [],
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to load project data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load project data'
      }));
      toast.error('Failed to load project details');
    }
  }, [token, projectName]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Initialize environment variables when project loads
  useEffect(() => {
    if (state.project?.metadata?.env) {
      const envEntries = Object.entries(state.project.metadata.env).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setEnvVariables(envEntries);
    } else {
      setEnvVariables([]);
    }
  }, [state.project]);

  const handleDeleteProject = useCallback(async () => {
    if (!projectName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
    try {
      const result = await containerService.deleteProject(projectName);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete project');
      }
      
      toast.success('Project deleted successfully');
      navigate('/containers');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, navigate]);

  const handleUpdateEnvironment = useCallback(async () => {
    if (!projectName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
    try {
      const envObject = envVariables.reduce((acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      const result = await containerService.updateProjectEnv(projectName, envObject);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update environment variables');
      }
      
      toast.success('Environment variables updated successfully');
      setEnvDialogOpen(false);
      loadProjectData(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update environment variables:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update environment variables');
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, envVariables, loadProjectData]);

  const handleServiceAction = useCallback(async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    if (!projectName) return;
    
    try {
      let result;
      switch (action) {
        case 'start':
          result = await containerService.startService(projectName, serviceName);
          break;
        case 'stop':
          result = await containerService.stopService(projectName, serviceName);
          break;
        case 'restart':
          result = await containerService.restartService(projectName, serviceName);
          break;
      }
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${action} service`);
      }
      
      toast.success(`Service ${action}ed successfully`);
      loadProjectData(); // Reload to get updated status
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} service`);
    }
  }, [projectName, loadProjectData]);

  const addEnvironmentVariable = useCallback(() => {
    setEnvVariables(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const updateEnvironmentVariable = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setEnvVariables(prev => prev.map((env, i) => 
      i === index ? { ...env, [field]: value } : env
    ));
  }, []);

  const removeEnvironmentVariable = useCallback((index: number) => {
    setEnvVariables(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleShowEnvValue = useCallback((key: string) => {
    setShowEnvValues(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

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

  const serviceStats = useMemo(() => {
    const total = state.services.length;
    const running = state.services.filter(s => s.status === 'running').length;
    const stopped = state.services.filter(s => s.status === 'stopped').length;
    const deploying = state.services.filter(s => s.status === 'deploying').length;
    const error = state.services.filter(s => s.status === 'error').length;
    
    return { total, running, stopped, deploying, error };
  }, [state.services]);

  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="mt-2 h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.error || !state.project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/containers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Project Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Failed to load project details</p>
          <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
          <Button onClick={loadProjectData} size="sm" className="mt-4">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const canDeleteProject = state.services.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/containers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{state.project.projectName}</h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(state.project.createdAt).toLocaleDateString()} • 
              Status: <span className="capitalize">{state.project.status}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Environment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Project Environment Variables</DialogTitle>
                <DialogDescription>
                  Configure environment variables for the {state.project.projectName} project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {envVariables.map((env, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Variable name"
                        value={env.key}
                        onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="relative">
                        <Input
                          type={showEnvValues[env.key] ? 'text' : 'password'}
                          placeholder="Variable value"
                          value={env.value}
                          onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                        />
                        {env.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => toggleShowEnvValue(env.key)}
                          >
                            {showEnvValues[env.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEnvironmentVariable(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addEnvironmentVariable}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variable
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEnvDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateEnvironment} disabled={state.updating}>
                  {state.updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={() => navigate(`/containers/projects/${projectName}/deploy`)}>
            <Plus className="mr-2 h-4 w-4" />
            Deploy Service
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!canDeleteProject}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  {canDeleteProject ? (
                    <>
                      Are you sure you want to delete the project "{state.project.projectName}"? 
                      This action cannot be undone.
                    </>
                  ) : (
                    <>
                      Cannot delete project "{state.project.projectName}" because it contains {state.services.length} service(s). 
                      Please delete all services first.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {canDeleteProject && (
                  <AlertDialogAction onClick={handleDeleteProject} disabled={state.updating}>
                    {state.updating ? 'Deleting...' : 'Delete Project'}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-2xl font-bold">{serviceStats.total}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Running</p>
                <p className="text-2xl font-bold text-emerald-600">{serviceStats.running}</p>
              </div>
              <Play className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stopped</p>
                <p className="text-2xl font-bold text-muted-foreground">{serviceStats.stopped}</p>
              </div>
              <Square className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold text-amber-600">{serviceStats.deploying + serviceStats.error}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Services</CardTitle>
            <p className="text-sm text-muted-foreground">
              Containerized applications running in this project.
            </p>
          </div>
          <Button onClick={() => navigate(`/containers/projects/${projectName}/deploy`)}>
            <Plus className="mr-2 h-4 w-4" />
            Deploy Service
          </Button>
        </CardHeader>
        <CardContent>
          {state.services.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
              <Server className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No services deployed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Deploy your first service to start running containerized applications.
              </p>
              <Button 
                onClick={() => navigate(`/containers/projects/${projectName}/deploy`)} 
                size="sm" 
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Deploy Service
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {state.services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {getServiceTypeIcon(service.serviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{service.serviceName}</h3>
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {service.serviceType} service
                        {service.cpuLimit && ` • ${service.cpuLimit} CPU`}
                        {service.memoryLimitGb && ` • ${service.memoryLimitGb}GB RAM`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.status === 'stopped' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleServiceAction(service.serviceName, 'start')}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {service.status === 'running' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceAction(service.serviceName, 'restart')}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceAction(service.serviceName, 'stop')}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/containers/projects/${projectName}/services/${service.serviceName}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetail;