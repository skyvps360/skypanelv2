/**
 * PaaS Marketplace Deploy Page
 * Deployment wizard for marketplace templates
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Rocket, Package, Settings, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  git_url: string;
  git_branch: string;
  buildpack: string;
  default_env_vars: Record<string, string>;
  required_addons: string[];
  required_addons_details?: Addon[];
  recommended_plan_slug: string;
  recommended_plan?: Plan;
  min_cpu_cores: number;
  min_ram_mb: number;
  deploy_count: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  price_per_hour: number;
  price_per_month: number;
}

interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  addon_type: string;
  price_per_hour: number;
}

const PaaSMarketplaceDeploy: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<Template | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  // Form state
  const [appName, setAppName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [customEnvVars, setCustomEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (slug) {
      loadTemplate();
      loadPlans();
      loadAddons();
    }
  }, [slug]);

  const loadTemplate = async () => {
    try {
      const data = await apiClient.get(`/paas/marketplace/templates/${slug}`);
      const tpl = data.template;
      setTemplate(tpl);

      // Auto-select recommended plan
      if (tpl.recommended_plan) {
        setSelectedPlanId(tpl.recommended_plan.id);
      }

      // Initialize custom env vars with template defaults
      setCustomEnvVars({ ...tpl.default_env_vars });

      // Auto-select required addons
      if (tpl.required_addons_details) {
        setSelectedAddons(tpl.required_addons_details.map((a: Addon) => a.id));
      }
    } catch (error) {
      toast.error('Failed to load template');
      navigate('/paas/marketplace');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await apiClient.get('/paas/plans');
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to load plans');
    }
  };

  const loadAddons = async () => {
    try {
      const data = await apiClient.get('/paas/marketplace/addons');
      setAddons(data.addons || []);
    } catch (error) {
      console.error('Failed to load addons');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setAppName(value);
    if (!customSlug) {
      setCustomSlug(generateSlug(value));
    }
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  const updateEnvVar = (key: string, value: string) => {
    setCustomEnvVars((prev) => ({ ...prev, [key]: value }));
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }

    setDeploying(true);
    try {
      const data = await apiClient.post(`/paas/marketplace/deploy/${slug}`, {
        name: appName,
        custom_slug: customSlug,
        plan_id: selectedPlanId,
        custom_env_vars: customEnvVars,
        selected_addons: selectedAddons,
      });

      toast.success(`${template?.name} deployed successfully!`);
      navigate(`/paas/${data.app.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to deploy template');
    } finally {
      setDeploying(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const totalPrice = selectedPlan
    ? selectedPlan.price_per_hour +
      selectedAddons.reduce((sum, addonId) => {
        const addon = addons.find((a) => a.id === addonId);
        return sum + (addon?.price_per_hour || 0);
      }, 0)
    : 0;

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <p className="text-center">Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <p className="text-center">Template not found</p>
      </div>
    );
  }

  const requiredAddonIds = template.required_addons_details?.map((a) => a.id) || [];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate('/paas/marketplace')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Marketplace
      </Button>

      {/* Template Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start gap-4">
            <Package className="w-12 h-12 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-2xl">{template.name}</CardTitle>
              <CardDescription className="mt-2">{template.description}</CardDescription>
              <div className="flex gap-2 mt-3">
                <Badge>{template.category}</Badge>
                <Badge variant="outline">{template.buildpack}</Badge>
                <Badge variant="secondary">{template.deploy_count} deploys</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Deployment Form */}
      <form onSubmit={handleDeploy} className="space-y-6">
        {/* App Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Application Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app_name">Application Name</Label>
              <Input
                id="app_name"
                value={appName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={`My ${template.name}`}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom_slug">Slug (URL identifier)</Label>
              <Input
                id="custom_slug"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="my-app"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Plan Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5" />
              Resource Plan
            </CardTitle>
            <CardDescription>
              Minimum requirements: {template.min_cpu_cores} CPU cores, {template.min_ram_mb}MB RAM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter(
                    (p) => p.cpu_cores >= template.min_cpu_cores && p.ram_mb >= template.min_ram_mb
                  )
                  .map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.cpu_cores} CPU, {plan.ram_mb}MB RAM (${plan.price_per_hour.toFixed(3)}/hr)
                      {plan.slug === template.recommended_plan_slug && ' ⭐ Recommended'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Addons */}
        {addons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Add-ons
              </CardTitle>
              <CardDescription>
                Enhance your application with databases, caching, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {addons.map((addon) => {
                const isRequired = requiredAddonIds.includes(addon.id);
                const isSelected = selectedAddons.includes(addon.id);

                return (
                  <div key={addon.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={addon.id}
                      checked={isSelected}
                      onCheckedChange={() => !isRequired && toggleAddon(addon.id)}
                      disabled={isRequired}
                    />
                    <div className="flex-1">
                      <Label htmlFor={addon.id} className="cursor-pointer font-medium">
                        {addon.name}
                        {isRequired && <Badge className="ml-2">Required</Badge>}
                      </Label>
                      <p className="text-sm text-muted-foreground">{addon.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{addon.addon_type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          ${addon.price_per_hour.toFixed(3)}/hr
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Environment Variables */}
        {Object.keys(template.default_env_vars || {}).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>Configure your application settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(template.default_env_vars || {}).map(([key, defaultValue]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`env_${key}`}>{key}</Label>
                  <Input
                    id={`env_${key}`}
                    value={customEnvVars[key] || defaultValue}
                    onChange={(e) => updateEnvVar(key, e.target.value)}
                    placeholder={defaultValue as string}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pricing Summary */}
        {selectedPlan && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>{selectedPlan.name}</span>
                <span>${selectedPlan.price_per_hour.toFixed(3)}/hr</span>
              </div>
              {selectedAddons.map((addonId) => {
                const addon = addons.find((a) => a.id === addonId);
                return addon ? (
                  <div key={addonId} className="flex justify-between text-sm">
                    <span>{addon.name}</span>
                    <span>${addon.price_per_hour.toFixed(3)}/hr</span>
                  </div>
                ) : null;
              })}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>
                  ${totalPrice.toFixed(3)}/hr ≈ ${(totalPrice * 730).toFixed(2)}/mo
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/paas/marketplace')}
            disabled={deploying}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={deploying || !selectedPlanId} className="flex-1">
            {deploying ? 'Deploying...' : `Deploy ${template.name}`}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PaaSMarketplaceDeploy;
