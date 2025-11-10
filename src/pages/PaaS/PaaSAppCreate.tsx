/**
 * PaaS Create Application Page
 * Wizard for creating new PaaS applications
 * Includes admin override controls for organization and plan selection
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Rocket, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  max_replicas: number;
  price_per_hour: number;
  price_per_month: number;
  features?: Record<string, string | boolean>;
}

interface Organization {
  id: string;
  name: string;
}

const PaaSAppCreate: React.FC = () => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [buildpack, setBuildpack] = useState('');
  const [planId, setPlanId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Admin override fields
  const isAdmin = user?.role === 'admin';
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [useCustomPricing, setUseCustomPricing] = useState(false);
  const [customPricePerHour, setCustomPricePerHour] = useState('');

  const selectedPlan = plans.find((plan) => plan.id === planId);

  useEffect(() => {
    loadPlans();
    if (isAdmin) {
      loadOrganizations();
    }
  }, [isAdmin]);

  useEffect(() => {
    const requestedPlan = searchParams.get('plan');
    if (!requestedPlan) return;
    const exists = plans.find((plan) => plan.id === requestedPlan);
    if (exists) {
      setPlanId(requestedPlan);
    }
  }, [searchParams, plans]);

  const loadPlans = async () => {
    try {
      const endpoint = isAdmin ? '/admin/paas/plans' : '/paas/plans';
      const data = await apiClient.get(endpoint);
      setPlans(data.plans || []);
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const data = await apiClient.get('/admin/organizations');
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const generateSlug = (appName: string) => {
    return appName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) {
      toast.error('Please select a plan');
      return;
    }

    if (isAdmin && selectedOrgId && !user?.organizationId && !selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name,
        slug,
        git_url: gitUrl || undefined,
        git_branch: gitBranch,
        buildpack: buildpack || undefined,
        plan_id: planId,
      };

      // Admin overrides
      if (isAdmin) {
        if (selectedOrgId) {
          payload.organization_id = selectedOrgId;
        }
        if (useCustomPricing && customPricePerHour) {
          payload.custom_price_per_hour = parseFloat(customPricePerHour);
        }
      }

      const endpoint = isAdmin && (selectedOrgId || useCustomPricing)
        ? '/admin/paas/apps/create'
        : '/paas/apps';

      const data = await apiClient.post(endpoint, payload);

      toast.success('Application created successfully!');
      navigate(`/paas/${data.app.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button variant="ghost" onClick={() => navigate('/paas')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Applications
        </Button>
        <Button variant="outline" onClick={() => navigate('/paas/plans')}>
          Compare Plans
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8" />
            <div>
              <CardTitle>Create New Application</CardTitle>
              <CardDescription>
                Deploy your application in minutes
              </CardDescription>
            </div>
          </div>

          {selectedPlan && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-semibold">{selectedPlan.name}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">CPU/RAM:</span>{' '}
                  {selectedPlan.cpu_cores} vCPU · {selectedPlan.ram_mb}MB
                </p>
                <p>
                  <span className="text-muted-foreground">Replicas:</span>{' '}
                  Up to {selectedPlan.max_replicas}
                </p>
                <p>
                  <span className="text-muted-foreground">Disk:</span>{' '}
                  {selectedPlan.disk_gb}GB SSD
                </p>
                <p>
                  <span className="text-muted-foreground">Pricing:</span>{' '}
                  {useCustomPricing && customPricePerHour ? (
                    <span className="font-bold text-orange-500">
                      ${parseFloat(customPricePerHour).toFixed(2)}/hr (Custom)
                    </span>
                  ) : (
                    <>
                      ${selectedPlan.price_per_hour.toFixed(2)}/hr · ${selectedPlan.price_per_month?.toFixed(2) ?? '—'}/mo
                    </>
                  )}
                </p>
              </div>
              {selectedPlan.features && (
                <div className="text-xs text-muted-foreground">
                  Includes:{' '}
                  {Object.keys(selectedPlan.features)
                    .slice(0, 4)
                    .map((feature) => feature.replace(/_/g, ' '))
                    .join(', ')}
                  {Object.keys(selectedPlan.features).length > 4 && ', …'}
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Override Section */}
            {isAdmin && (
              <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-300">
                  <strong>Admin Mode:</strong> You have additional controls to create apps for any organization and set custom pricing.
                </AlertDescription>
              </Alert>
            )}

            {/* Admin: Organization Selection */}
            {isAdmin && (
              <div className="space-y-2 border-l-4 border-orange-500 pl-4">
                <Label htmlFor="organization">Organization (Admin Override)</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization (or use your own)" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Leave empty to create in your own organization
                </p>
              </div>
            )}

            {/* App Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Application Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Awesome App"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL identifier)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-awesome-app"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            {/* Git URL */}
            <div className="space-y-2">
              <Label htmlFor="git_url">Git Repository URL (Optional)</Label>
              <Input
                id="git_url"
                type="url"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
              />
              <p className="text-sm text-muted-foreground">
                You can add this later before deploying
              </p>
            </div>

            {/* Git Branch */}
            <div className="space-y-2">
              <Label htmlFor="git_branch">Git Branch</Label>
              <Input
                id="git_branch"
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
                placeholder="main"
              />
            </div>

            {/* Buildpack */}
            <div className="space-y-2">
              <Label htmlFor="buildpack">Buildpack (Optional)</Label>
              <Select value={buildpack} onValueChange={setBuildpack}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-detect</SelectItem>
                  <SelectItem value="heroku/nodejs">Node.js</SelectItem>
                  <SelectItem value="heroku/python">Python</SelectItem>
                  <SelectItem value="heroku/ruby">Ruby</SelectItem>
                  <SelectItem value="heroku/php">PHP</SelectItem>
                  <SelectItem value="heroku/go">Go</SelectItem>
                  <SelectItem value="heroku/java">Java</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Plan Selection */}
            <div className="space-y-2">
              <Label htmlFor="plan">Resource Plan</Label>
              <Select value={planId} onValueChange={setPlanId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.cpu_cores} CPU, {plan.ram_mb}MB RAM
                      (${plan.price_per_hour}/hr ≈ ${plan.price_per_month?.toFixed(2)}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingPlans && (
                <p className="text-sm text-muted-foreground">Loading plans...</p>
              )}
            </div>

            {/* Admin: Custom Pricing */}
            {isAdmin && (
              <div className="space-y-3 border-l-4 border-orange-500 pl-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="custom_pricing"
                    checked={useCustomPricing}
                    onCheckedChange={(checked) => setUseCustomPricing(checked as boolean)}
                  />
                  <Label htmlFor="custom_pricing" className="cursor-pointer">
                    Use Custom Pricing (Admin Override)
                  </Label>
                </div>
                {useCustomPricing && (
                  <div className="space-y-2">
                    <Label htmlFor="custom_price">Custom Price Per Hour ($)</Label>
                    <Input
                      id="custom_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={customPricePerHour}
                      onChange={(e) => setCustomPricePerHour(e.target.value)}
                      placeholder="0.00"
                      required={useCustomPricing}
                    />
                    <p className="text-sm text-muted-foreground">
                      Override the plan's default pricing for this app
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/paas')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !planId} className="flex-1">
                {loading ? 'Creating...' : 'Create Application'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaaSAppCreate;
