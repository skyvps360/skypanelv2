import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  AlertCircle,
  Rocket,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import TemplateSelector, { estimateTemplateResources } from '@/components/containers/TemplateSelector';
import { containerService } from '@/services/containerService';
import type {
  ContainerTemplate,
  ContainerProject,
  ResourceUsage,
  ContainerSubscription,
} from '@/types/containers';

const serviceNamePattern = /^[a-z0-9-_]+$/;

type UsageSummary = {
  usage: ResourceUsage | null;
  quota: ResourceUsage | null;
};

type DeployVariables = {
  projectName: string;
  serviceName: string;
  template: ContainerTemplate;
};

const formatMetric = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(value < 1 ? 2 : 1);
};

const ContainerTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTemplate, setSelectedTemplate] = useState<ContainerTemplate | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceNameError, setServiceNameError] = useState<string | null>(null);

  const templatesQuery = useQuery<ContainerTemplate[]>({
    queryKey: ['containers', 'templates', 'available'],
    queryFn: async () => {
      const result = await containerService.getTemplates();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load container templates');
      }

      return result.templates ?? [];
    },
  });

  const subscriptionQuery = useQuery<ContainerSubscription | null>({
    queryKey: ['containers', 'subscription', 'current'],
    queryFn: async () => {
      const result = await containerService.getSubscription();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load subscription details');
      }

      return result.subscription ?? null;
    },
  });

  const projectsQuery = useQuery<ContainerProject[]>({
    queryKey: ['containers', 'projects', 'list'],
    enabled: subscriptionQuery.isSuccess && Boolean(subscriptionQuery.data),
    queryFn: async () => {
      const result = await containerService.getProjects();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load projects');
      }

      return result.projects ?? [];
    },
  });

  const usageQuery = useQuery<UsageSummary>({
    queryKey: ['containers', 'usage', 'summary'],
    queryFn: async () => {
      const result = await containerService.getResourceUsage();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load resource usage');
      }

      return {
        usage: result.usage ?? null,
        quota: result.quota ?? null,
      };
    },
  });

  const templates = templatesQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const subscription = subscriptionQuery.data ?? null;
  const hasSubscription = Boolean(subscription);
  const currentUsage = usageQuery.data?.usage ?? null;
  const quota = usageQuery.data?.quota ?? null;

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplate(null);
      return;
    }

    setSelectedTemplate((current) => {
      if (current && templates.some((template) => template.id === current.id)) {
        return current;
      }

      return templates[0];
    });
  }, [templates]);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProject('');
      return;
    }

    setSelectedProject((current) => {
      if (current && projects.some((project) => project.projectName === current)) {
        return current;
      }

      return projects[0].projectName;
    });
  }, [projects]);

  useEffect(() => {
    if (!selectedTemplate) {
      setServiceName('');
      return;
    }

    setServiceName(selectedTemplate.templateName);
    setServiceNameError(null);
  }, [selectedTemplate]);

  const templateRequirements = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    return estimateTemplateResources(selectedTemplate);
  }, [selectedTemplate]);

  const quotaStatus = useMemo(() => {
    if (!templateRequirements || !currentUsage || !quota) {
      return { canDeploy: true, warnings: [] as string[] };
    }

    const warnings: string[] = [];

    if (currentUsage.cpuCores + templateRequirements.cpuCores > quota.cpuCores) {
      warnings.push('CPU quota exceeded');
    }
    if (currentUsage.memoryGb + templateRequirements.memoryGb > quota.memoryGb) {
      warnings.push('Memory quota exceeded');
    }
    if (currentUsage.storageGb + templateRequirements.storageGb > quota.storageGb) {
      warnings.push('Storage quota exceeded');
    }
    if (currentUsage.containerCount + templateRequirements.containerCount > quota.containerCount) {
      warnings.push('Container limit exceeded');
    }

    return {
      canDeploy: warnings.length === 0,
      warnings,
    };
  }, [templateRequirements, currentUsage, quota]);

  const resourceSummaries = useMemo(() => {
    if (!currentUsage || !quota) {
      return [] as Array<{
        label: string;
        used: number;
        total: number;
        icon: React.ElementType;
        suffix?: string;
      }>;
    }

    return [
      {
        label: 'CPU Cores',
        used: currentUsage.cpuCores,
        total: quota.cpuCores,
        icon: Cpu,
        suffix: 'cores',
      },
      {
        label: 'Memory',
        used: currentUsage.memoryGb,
        total: quota.memoryGb,
        icon: MemoryStick,
        suffix: 'GB',
      },
      {
        label: 'Storage',
        used: currentUsage.storageGb,
        total: quota.storageGb,
        icon: HardDrive,
        suffix: 'GB',
      },
      {
        label: 'Services',
        used: currentUsage.containerCount,
        total: quota.containerCount,
        icon: Server,
      },
    ];
  }, [currentUsage, quota]);

  const deployTemplateMutation = useMutation({
    mutationFn: async ({ projectName, serviceName: name, template }: DeployVariables) => {
      const result = await containerService.deployTemplateService(projectName, {
        serviceName: name,
        templateName: template.templateName,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to deploy template');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.template.displayName} deployment started`);
      queryClient.invalidateQueries({ queryKey: ['containers', 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['containers', 'usage'] });
      navigate(`/containers/projects/${variables.projectName}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to deploy template';
      toast.error(message);
    },
  });

  const handleDeployTemplate = () => {
    if (!selectedTemplate) {
      toast.error('Select a template to deploy');
      return;
    }

    if (!hasSubscription) {
      toast.error('An active container subscription is required to deploy templates');
      return;
    }

    if (!selectedProject) {
      toast.error('Create a project before deploying a template');
      return;
    }

    const trimmedName = serviceName.trim();

    if (!trimmedName) {
      setServiceNameError('Service name is required');
      return;
    }

    if (!serviceNamePattern.test(trimmedName)) {
      setServiceNameError('Service name must contain only lowercase letters, numbers, hyphens, and underscores');
      return;
    }

    setServiceNameError(null);

    deployTemplateMutation.mutate({
      projectName: selectedProject,
      serviceName: trimmedName,
      template: selectedTemplate,
    });
  };

  if (templatesQuery.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading container templates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold">Container Templates</h1>
        <p className="text-muted-foreground">
          Browse curated application blueprints and launch services with minimal configuration.
        </p>
      </div>

      {templatesQuery.isError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {templatesQuery.error instanceof Error
              ? templatesQuery.error.message
              : 'Unable to load container templates at this time.'}
          </AlertDescription>
        </Alert>
      )}

      {!templates.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No templates available</CardTitle>
            <CardDescription>
              Check back soon for quick deployment options.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <TemplateSelector
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              currentUsage={currentUsage ?? undefined}
              quota={quota ?? undefined}
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Usage</CardTitle>
                <CardDescription>
                  Review resource quotas before launching new template deployments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usageQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading usage data...</span>
                  </div>
                ) : usageQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {usageQuery.error instanceof Error
                        ? usageQuery.error.message
                        : 'Unable to load resource usage.'}
                    </AlertDescription>
                  </Alert>
                ) : !resourceSummaries.length ? (
                  <p className="text-sm text-muted-foreground">
                    Usage information will appear once you have an active container subscription.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {resourceSummaries.map((resource) => {
                      const percent = resource.total > 0 ? Math.min(100, (resource.used / resource.total) * 100) : 0;
                      const Icon = resource.icon;

                      return (
                        <div key={resource.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Icon className="h-4 w-4" />
                              <span>{resource.label}</span>
                            </div>
                            <span className="font-medium text-foreground">
                              {formatMetric(resource.used)} / {formatMetric(resource.total)} {resource.suffix ?? ''}
                            </span>
                          </div>
                          <Progress value={percent} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deploy Template</CardTitle>
                <CardDescription>
                  Select a project and service name to launch your chosen template.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedTemplate ? (
                  <p className="text-sm text-muted-foreground">
                    Select a template from the list to view deployment options.
                  </p>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedTemplate.displayName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedTemplate.description?.trim() || 'Template details coming soon.'}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {selectedTemplate.category?.trim() || 'General'}
                        </Badge>
                      </div>
                    </div>

                    {templateRequirements && (
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          <span>{templateRequirements.cpuCores} cores</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MemoryStick className="h-3 w-3" />
                          <span>{templateRequirements.memoryGb} GB memory</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          <span>{templateRequirements.storageGb} GB storage</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          <span>{templateRequirements.containerCount} service{templateRequirements.containerCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    )}

                    {!hasSubscription ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="space-y-2">
                          <p>
                            You need an active container subscription before deploying templates.
                          </p>
                          <Button variant="outline" size="sm" onClick={() => navigate('/containers/plans')}>
                            View container plans
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="project">Project</Label>
                          <Select
                            value={selectedProject}
                            onValueChange={setSelectedProject}
                            disabled={projectsQuery.isLoading || !projects.length || deployTemplateMutation.isPending}
                          >
                            <SelectTrigger id="project">
                              <SelectValue placeholder={projectsQuery.isLoading ? 'Loading projects...' : 'Select project'} />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.projectName}>
                                  {project.projectName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!projectsQuery.isLoading && !projects.length && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                You do not have any active projects yet. Create a project to start deploying services.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/containers/projects/new')}
                              >
                                Create project
                              </Button>
                            </div>
                          )}
                          {projectsQuery.isError && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {projectsQuery.error instanceof Error
                                  ? projectsQuery.error.message
                                  : 'Unable to load projects.'}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="serviceName">Service Name</Label>
                          <Input
                            id="serviceName"
                            placeholder="my-service"
                            value={serviceName}
                            onChange={(event) => setServiceName(event.target.value)}
                            disabled={deployTemplateMutation.isPending}
                          />
                          {serviceNameError && (
                            <p className="text-sm text-red-500">{serviceNameError}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Lowercase letters, numbers, hyphens, and underscores only.
                          </p>
                        </div>

                        {quotaStatus.warnings.length > 0 && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {quotaStatus.warnings.join(', ')}. Consider upgrading your plan or removing unused services.
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          onClick={handleDeployTemplate}
                          disabled={
                            deployTemplateMutation.isPending ||
                            !projects.length ||
                            !quotaStatus.canDeploy
                          }
                        >
                          {deployTemplateMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deploying
                            </>
                          ) : (
                            <>
                              <Rocket className="mr-2 h-4 w-4" />
                              Deploy Template
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContainerTemplatesPage;
