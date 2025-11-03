/**
 * Service Detail Component
 * Detailed view for a specific container service with management capabilities
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Settings,
  Database,
  Globe,
  Server,
  AlertTriangle,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  Download,
  RefreshCw,
  Edit,
  Save,
  X,
  Plus,
  Eye,
  EyeOff,
  Search,
  Filter
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { containerService } from '@/services/containerService';
import type {
  ContainerService as ContainerServiceType,
  ServiceLogEntry,
  ResourceConfig
} from '@/types/containers';

interface ServiceDetailState {
  service: ContainerServiceType | null;
  logs: ServiceLogEntry[];
  loading: boolean;
  logsLoading: boolean;
  error: string | null;
  updating: boolean;
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

const ServiceDetail: React.FC = () => {
  const { projectName, serviceName } = useParams<{ projectName: string; serviceName: string }>();
  const [state, setState] = useState<ServiceDetailState>({
    service: null,
    logs: [],
    loading: true,
    logsLoading: false,
    error: null,
    updating: false
  });
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [resourcesDialogOpen, setResourcesDialogOpen] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvironmentVariable[]>([]);
  const [resources, setResources] = useState<ResourceConfig>({});
  const [showEnvValues, setShowEnvValues] = useState<Record<string, boolean>>({});
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'debug'>('all');
  const [logSearch, setLogSearch] = useState('');
  const { token } = useAuth();
  const navigate = useNavigate();

  const loadServiceData = useCallback(async () => {
    if (!token || !projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await containerService.getService(projectName, serviceName);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load service');
      }

      setState(prev => ({
        ...prev,
        service: result.service || null,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to load service data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load service data'
      }));
      toast.error('Failed to load service details');
    }
  }, [token, projectName, serviceName]);

  const loadServiceLogs = useCallback(async () => {
    if (!token || !projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, logsLoading: true }));
    
    try {
      const result = await containerService.getServiceLogs(projectName, serviceName, 100);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load logs');
      }

      setState(prev => ({
        ...prev,
        logs: result.logs || [],
        logsLoading: false
      }));
    } catch (error) {
      console.error('Failed to load service logs:', error);
      setState(prev => ({
        ...prev,
        logs: [],
        logsLoading: false
      }));
      toast.error('Failed to load service logs');
    }
  }, [token, projectName, serviceName]);

  useEffect(() => {
    loadServiceData();
    loadServiceLogs();
  }, [loadServiceData, loadServiceLogs]);

  // Initialize environment variables when service loads
  useEffect(() => {
    if (state.service?.configuration?.env) {
      const envEntries = Object.entries(state.service.configuration.env).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setEnvVariables(envEntries);
    } else {
      setEnvVariables([]);
    }
  }, [state.service]);

  // Initialize resources when service loads
  useEffect(() => {
    if (state.service) {
      setResources({
        cpuLimit: state.service.cpuLimit,
        memoryLimit: state.service.memoryLimitGb ? state.service.memoryLimitGb * 1024 : undefined, // Convert GB to MB
        memoryReservation: undefined
      });
    }
  }, [state.service]);

  const handleServiceAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    if (!projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
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
      loadServiceData(); // Reload to get updated status
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} service`);
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, serviceName, loadServiceData]);

  const handleDeleteService = useCallback(async () => {
    if (!projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
    try {
      const result = await containerService.deleteService(projectName, serviceName);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete service');
      }
      
      toast.success('Service deleted successfully');
      navigate(`/containers/projects/${projectName}`);
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete service');
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, serviceName, navigate]);

  const handleUpdateEnvironment = useCallback(async () => {
    if (!projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
    try {
      const envObject = envVariables.reduce((acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      const result = await containerService.updateServiceEnv(projectName, serviceName, envObject);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update environment variables');
      }
      
      toast.success('Environment variables updated successfully');
      setEnvDialogOpen(false);
      loadServiceData(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update environment variables:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update environment variables');
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, serviceName, envVariables, loadServiceData]);

  const handleUpdateResources = useCallback(async () => {
    if (!projectName || !serviceName) return;
    
    setState(prev => ({ ...prev, updating: true }));
    
    try {
      const result = await containerService.updateServiceResources(projectName, serviceName, resources);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update resource limits');
      }
      
      toast.success('Resource limits updated successfully');
      setResourcesDialogOpen(false);
      loadServiceData(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update resource limits:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update resource limits');
    } finally {
      setState(prev => ({ ...prev, updating: false }));
    }
  }, [projectName, serviceName, resources, loadServiceData]);

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

  const downloadLogs = useCallback(() => {
    const logsText = state.logs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.logs, serviceName]);

  const getServiceTypeIcon = useCallback((serviceType: ContainerServiceType['serviceType']) => {
    switch (serviceType) {
      case 'postgres':
      case 'mysql':
      case 'mariadb':
      case 'mongo':
      case 'redis':
        return <Database className="h-5 w-5" />;
      case 'app':
      case 'wordpress':
        return <Globe className="h-5 w-5" />;
      default:
        return <Server className="h-5 w-5" />;
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

  const getLogLevelColor = useCallback((level: ServiceLogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-amber-500';
      case 'info':
        return 'text-blue-500';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  }, []);

  const filteredLogs = useMemo(() => {
    let filtered = state.logs;
    
    if (logFilter !== 'all') {
      filtered = filtered.filter(log => log.level === logFilter);
    }
    
    if (logSearch) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(logSearch.toLowerCase())
      );
    }
    
    return filtered;
  }, [state.logs, logFilter, logSearch]);

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
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

  if (state.error || !state.service) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/containers/projects/${projectName}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Service Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Failed to load service details</p>
          <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
          <Button onClick={loadServiceData} size="sm" className="mt-4">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/containers/projects/${projectName}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              {getServiceTypeIcon(state.service.serviceType)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{state.service.serviceName}</h1>
              <p className="text-sm text-muted-foreground">
                {state.service.serviceType} service in {projectName}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {state.service.status === 'stopped' && (
            <Button
              onClick={() => handleServiceAction('start')}
              disabled={state.updating}
            >
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          {state.service.status === 'running' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleServiceAction('restart')}
                disabled={state.updating}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart
              </Button>
              <Button
                variant="outline"
                onClick={() => handleServiceAction('stop')}
                disabled={state.updating}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the service "{state.service.serviceName}"? 
                  This action cannot be undone and all data will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteService} disabled={state.updating}>
                  {state.updating ? 'Deleting...' : 'Delete Service'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status and Resource Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={`mt-1 ${getStatusColor(state.service.status)}`}>
                  {state.service.status}
                </Badge>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPU Limit</p>
                <p className="text-2xl font-bold">
                  {state.service.cpuLimit ? `${state.service.cpuLimit}` : 'Unlimited'}
                </p>
              </div>
              <Cpu className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memory Limit</p>
                <p className="text-2xl font-bold">
                  {state.service.memoryLimitGb ? `${state.service.memoryLimitGb}GB` : 'Unlimited'}
                </p>
              </div>
              <MemoryStick className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Service Name</Label>
                  <p className="mt-1 text-sm">{state.service.serviceName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Service Type</Label>
                  <p className="mt-1 text-sm capitalize">{state.service.serviceType}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="mt-1 text-sm">{new Date(state.service.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                  <p className="mt-1 text-sm">{new Date(state.service.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              
              {state.service.configuration && Object.keys(state.service.configuration).length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Configuration</Label>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-auto">
                    {JSON.stringify(state.service.configuration, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Environment Variables</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure environment variables for this service.
                </p>
              </div>
              <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Variables
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Environment Variables</DialogTitle>
                    <DialogDescription>
                      Configure environment variables for {state.service.serviceName}.
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
            </CardHeader>
            <CardContent>
              {envVariables.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
                  <Settings className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No environment variables</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add environment variables to configure your service.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {envVariables.map((env, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{env.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {showEnvValues[env.key] ? env.value : '••••••••'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowEnvValue(env.key)}
                      >
                        {showEnvValues[env.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Resource Limits</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure CPU and memory limits for this service.
                </p>
              </div>
              <Dialog open={resourcesDialogOpen} onOpenChange={setResourcesDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Limits
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Resource Limits</DialogTitle>
                    <DialogDescription>
                      Configure resource limits for {state.service.serviceName}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cpu-limit">CPU Limit (cores)</Label>
                      <Input
                        id="cpu-limit"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g., 1.0"
                        value={resources.cpuLimit || ''}
                        onChange={(e) => setResources(prev => ({
                          ...prev,
                          cpuLimit: e.target.value ? parseFloat(e.target.value) : undefined
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="memory-limit">Memory Limit (MB)</Label>
                      <Input
                        id="memory-limit"
                        type="number"
                        min="0"
                        placeholder="e.g., 512"
                        value={resources.memoryLimit || ''}
                        onChange={(e) => setResources(prev => ({
                          ...prev,
                          memoryLimit: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="memory-reservation">Memory Reservation (MB)</Label>
                      <Input
                        id="memory-reservation"
                        type="number"
                        min="0"
                        placeholder="e.g., 256"
                        value={resources.memoryReservation || ''}
                        onChange={(e) => setResources(prev => ({
                          ...prev,
                          memoryReservation: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setResourcesDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateResources} disabled={state.updating}>
                      {state.updating ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">CPU Limit</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {state.service.cpuLimit ? `${state.service.cpuLimit}` : 'Unlimited'}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Memory Limit</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {state.service.memoryLimitGb ? `${state.service.memoryLimitGb}GB` : 'Unlimited'}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Storage Limit</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {state.service.storageLimitGb ? `${state.service.storageLimitGb}GB` : 'Unlimited'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Service Logs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and search through service logs.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadLogs} disabled={state.logs.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button variant="outline" onClick={loadServiceLogs} disabled={state.logsLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${state.logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={logFilter} onValueChange={(value: any) => setLogFilter(value)}>
                  <SelectTrigger className="w-32">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-96 rounded-md border">
                <div className="p-4">
                  {state.logsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading logs...</span>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">No logs found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {state.logs.length === 0 
                          ? 'No logs available for this service.'
                          : 'No logs match your current filter criteria.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-xs">
                      {filteredLogs.map((log, index) => (
                        <div key={index} className="flex gap-4 rounded-md bg-muted/50 p-2">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`font-medium uppercase whitespace-nowrap ${getLogLevelColor(log.level)}`}>
                            {log.level}
                          </span>
                          <span className="flex-1 break-all">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServiceDetail;