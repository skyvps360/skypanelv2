/**
 * Application Creation/Edit Form
 * Form for creating or editing PaaS applications
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle,
  Code,
  Database,
  GitBranch,
  Globe,
  Info,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface PaaSPlan {
  id: string;
  name: string;
  description: string;
  priceHourly: number;
  priceMonthly: number;
  specs: {
    cpu: string;
    memory: string;
    storage: string;
    bandwidth: string;
  };
  features: string[];
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

interface FormData {
  name: string;
  description: string;
  repository_url: string;
  branch: string;
  build_command: string;
  start_command: string;
  node_version: string;
  planId: string;
  environment_variables: EnvironmentVariable[];
  auto_deploy: boolean;
}

const getNumericValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const pickNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const numericValue = getNumericValue(value);
    if (typeof numericValue === 'number') {
      return numericValue;
    }
  }
  return undefined;
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const stringValue = getStringValue(value);
    if (typeof stringValue === 'string') {
      return stringValue;
    }
  }
  return undefined;
};

const formatSpec = (unit: string, ...values: unknown[]): string => {
  for (const value of values) {
    const stringValue = getStringValue(value);
    if (stringValue) {
      return stringValue;
    }
    const numericValue = getNumericValue(value);
    if (typeof numericValue === 'number') {
      return `${numericValue}${unit}`;
    }
  }
  return 'N/A';
};

const formatHourlyPrice = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.0000';
  }
  return value >= 1 ? value.toFixed(2) : value.toFixed(4);
};

const normalizePlan = (plan: any): PaaSPlan => {
  const featureSource = [plan?.features, plan?.featureList, plan?.feature_list, plan?.metadata?.features]
    .find(Array.isArray) as unknown[] | undefined;

  const normalizedFeatures = featureSource
    ? featureSource
        .map(feature => getStringValue(feature))
        .filter((feature): feature is string => Boolean(feature))
    : [];

  return {
    id: pickString(plan?.id, plan?._id, plan?.planId) || '',
    name: pickString(plan?.name) || 'Unnamed Plan',
    description: pickString(plan?.description) || '',
    priceHourly:
      pickNumber(
        plan?.priceHourly,
        plan?.price_per_hour,
        plan?.price_hourly,
        plan?.pricePerHour
      ) || 0,
    priceMonthly:
      pickNumber(
        plan?.priceMonthly,
        plan?.price_per_month,
        plan?.price_monthly,
        plan?.pricePerMonth
      ) || 0,
    specs: {
      cpu: formatSpec(' vCPU', plan?.specs?.cpu, plan?.cpu, plan?.cpuCores, plan?.cpu_cores),
      memory: formatSpec(' MB', plan?.specs?.memory, plan?.memory, plan?.memoryMb, plan?.memory_mb),
      storage: formatSpec(' GB', plan?.specs?.storage, plan?.storage, plan?.storageGb, plan?.storage_gb),
      bandwidth: formatSpec(
        ' GB',
        plan?.specs?.bandwidth,
        plan?.bandwidth,
        plan?.bandwidthGb,
        plan?.bandwidth_gb
      ),
    },
    features: normalizedFeatures,
  };
};

export const ApplicationForm: React.FC = () => {
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { appId } = useParams();
  const isEditing = Boolean(appId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PaaSPlan[]>([]);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [newEnvVar, setNewEnvVar] = useState<EnvironmentVariable>({ key: '', value: '' });

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    repository_url: '',
    branch: 'main',
    build_command: 'npm install && npm run build',
    start_command: 'npm start',
    node_version: '18.x',
    planId: '',
    environment_variables: [],
    auto_deploy: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchPlans = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/paas/plans', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      const rawPlans = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.plans)
          ? data.data.plans
          : [];
      const normalizedPlans = rawPlans.map(normalizePlan).filter(plan => Boolean(plan.id));
      setPlans(normalizedPlans);

      // Set default plan if not editing
      if (!isEditing && normalizedPlans.length > 0) {
        setFormData(prev => ({ ...prev, planId: normalizedPlans[0].id }));
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to fetch available plans');
    }
  };

  const fetchApp = async () => {
    if (!appId || !token) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/paas/apps/${appId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch application');
      const data = await response.json();

      const app = data.data;
      setFormData({
        name: app.name,
        description: app.description,
        repository_url: app.repository_url,
        branch: app.branch,
        build_command: app.build_command,
        start_command: app.start_command,
        node_version: app.node_version,
        planId: app.planId,
        environment_variables: app.environment_variables || [],
        auto_deploy: app.auto_deploy || false,
      });
    } catch (error) {
      console.error('Error fetching app:', error);
      toast.error('Failed to fetch application details');
      navigate('/paas');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Application name is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (!formData.repository_url.trim()) {
      errors.repository_url = 'Repository URL is required';
    } else if (!isValidGitHubUrl(formData.repository_url)) {
      errors.repository_url = 'Please enter a valid GitHub repository URL';
    }

    if (!formData.branch.trim()) {
      errors.branch = 'Branch name is required';
    }

    if (!formData.build_command.trim()) {
      errors.build_command = 'Build command is required';
    }

    if (!formData.start_command.trim()) {
      errors.start_command = 'Start command is required';
    }

    if (!formData.planId) {
      errors.planId = 'Please select a plan';
    }

    // Validate environment variables
    formData.environment_variables.forEach((envVar, index) => {
      if (!envVar.key.trim()) {
        errors[`env_key_${index}`] = 'Environment variable key is required';
      }
      if (!envVar.value.trim()) {
        errors[`env_value_${index}`] = 'Environment variable value is required';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidGitHubUrl = (url: string): boolean => {
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w\-\.]+\/[\w\-\.]+(\.git)?$/;
    return githubUrlPattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    if (!token) {
      toast.error('You must be signed in to manage applications');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/paas/apps/${appId}` : '/api/paas/apps';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save application');
      }

      const result = await response.json();
      toast.success(isEditing ? 'Application updated successfully' : 'Application created successfully');

      // Redirect to the application details page
      navigate(`/paas/apps/${result.data.id}`);
    } catch (error) {
      console.error('Error saving app:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const addEnvironmentVariable = () => {
    if (newEnvVar.key.trim() && newEnvVar.value.trim()) {
      setFormData(prev => ({
        ...prev,
        environment_variables: [...prev.environment_variables, { ...newEnvVar }]
      }));
      setNewEnvVar({ key: '', value: '' });
      setShowEnvDialog(false);
    }
  };

  const removeEnvironmentVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables.filter((_, i) => i !== index)
    }));
  };

  const testRepositoryConnection = async () => {
    if (!formData.repository_url.trim()) {
      toast.error('Please enter a repository URL first');
      return;
    }

    if (!token) {
      toast.error('You must be signed in to manage applications');
      return;
    }

    try {
      const response = await fetch('/api/paas/validate-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repository_url: formData.repository_url,
          branch: formData.branch,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Repository validation failed');
      }

      const result = await response.json();
      toast.success('Repository is accessible and ready for deployment');
    } catch (error) {
      console.error('Error validating repository:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate repository');
    }
  };

  useEffect(() => {
    if (authLoading || !token) {
      return;
    }
    fetchPlans();
    if (isEditing) {
      fetchApp();
    }
  }, [appId, isEditing, token, authLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedPlan = formData.planId ? plans.find(plan => plan.id === formData.planId) : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/paas')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Application' : 'Create New Application'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update your application configuration' : 'Deploy a new Node.js application from GitHub'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Configure your application's basic settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Application Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="my-awesome-app"
                      className={validationErrors.name ? 'border-red-500' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-red-500">{validationErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="plan_id">PaaS Plan *</Label>
                    <Select
                      value={formData.planId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, planId: value }))}
                    >
                      <SelectTrigger className={validationErrors.planId ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{plan.name}</span>
                              <span className="text-muted-foreground">
                                ${formatHourlyPrice(plan.priceHourly)}/hr
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.planId && (
                      <p className="text-sm text-red-500">{validationErrors.planId}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what your application does..."
                    rows={3}
                    className={validationErrors.description ? 'border-red-500' : ''}
                  />
                  {validationErrors.description && (
                    <p className="text-sm text-red-500">{validationErrors.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Source Code Repository
                </CardTitle>
                <CardDescription>
                  Connect your GitHub repository for automatic deployments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="repository_url">GitHub Repository URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="repository_url"
                      value={formData.repository_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, repository_url: e.target.value }))}
                      placeholder="https://github.com/username/repository"
                      className={validationErrors.repository_url ? 'border-red-500' : ''}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testRepositoryConnection}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Test
                    </Button>
                  </div>
                  {validationErrors.repository_url && (
                    <p className="text-sm text-red-500">{validationErrors.repository_url}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Must be a public GitHub repository URL
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch *</Label>
                    <Input
                      id="branch"
                      value={formData.branch}
                      onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                      placeholder="main"
                      className={validationErrors.branch ? 'border-red-500' : ''}
                    />
                    {validationErrors.branch && (
                      <p className="text-sm text-red-500">{validationErrors.branch}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="node_version">Node.js Version</Label>
                    <Select
                      value={formData.node_version}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, node_version: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16.x">Node.js 16.x</SelectItem>
                        <SelectItem value="18.x">Node.js 18.x</SelectItem>
                        <SelectItem value="20.x">Node.js 20.x</SelectItem>
                        <SelectItem value="22.x">Node.js 22.x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_deploy"
                    checked={formData.auto_deploy}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_deploy: checked }))}
                  />
                  <Label htmlFor="auto_deploy">Auto-deploy on push</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Build & Start Commands
                </CardTitle>
                <CardDescription>
                  Define how your application should be built and started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="build_command">Build Command *</Label>
                  <Input
                    id="build_command"
                    value={formData.build_command}
                    onChange={(e) => setFormData(prev => ({ ...prev, build_command: e.target.value }))}
                    placeholder="npm install && npm run build"
                    className={validationErrors.build_command ? 'border-red-500' : ''}
                  />
                  {validationErrors.build_command && (
                    <p className="text-sm text-red-500">{validationErrors.build_command}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_command">Start Command *</Label>
                  <Input
                    id="start_command"
                    value={formData.start_command}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_command: e.target.value }))}
                    placeholder="npm start"
                    className={validationErrors.start_command ? 'border-red-500' : ''}
                  />
                  {validationErrors.start_command && (
                    <p className="text-sm text-red-500">{validationErrors.start_command}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Environment Variables
                </CardTitle>
                <CardDescription>
                  Configure environment variables for your application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.environment_variables.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground mb-4">No environment variables configured</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowEnvDialog(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Environment Variable
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.environment_variables.map((envVar, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{envVar.key}</div>
                          <div className="text-sm text-muted-foreground">{envVar.value}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEnvironmentVariable(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowEnvDialog(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Environment Variable
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Plan Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlan ? (
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium">{selectedPlan.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ${formatHourlyPrice(selectedPlan.priceHourly)}/hour
                      </div>
                      {selectedPlan.priceMonthly > 0 && (
                        <div className="text-xs text-muted-foreground">
                          ≈${selectedPlan.priceMonthly.toFixed(2)}/month
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>CPU:</span>
                        <span>{selectedPlan.specs.cpu}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memory:</span>
                        <span>{selectedPlan.specs.memory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Storage:</span>
                        <span>{selectedPlan.specs.storage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bandwidth:</span>
                        <span>{selectedPlan.specs.bandwidth}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Features:</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlan.features.length > 0 ? (
                          selectedPlan.features.map((feature, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No features listed</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a plan to see details
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Deployment Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${formData.name ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Application name configured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${formData.planId ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Plan selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${formData.repository_url ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Repository connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${formData.build_command && formData.start_command ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Build commands configured</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/paas')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Application' : 'Create Application'}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Environment Variable Dialog */}
      <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
            <DialogDescription>
              Add a new environment variable for your application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="env_key">Key</Label>
              <Input
                id="env_key"
                value={newEnvVar.key}
                onChange={(e) => setNewEnvVar(prev => ({ ...prev, key: e.target.value }))}
                placeholder="DATABASE_URL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="env_value">Value</Label>
              <Textarea
                id="env_value"
                value={newEnvVar.value}
                onChange={(e) => setNewEnvVar(prev => ({ ...prev, value: e.target.value }))}
                placeholder="postgresql://user:pass@host:port/db"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEnvDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={addEnvironmentVariable}
              disabled={!newEnvVar.key.trim() || !newEnvVar.value.trim()}
            >
              Add Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
