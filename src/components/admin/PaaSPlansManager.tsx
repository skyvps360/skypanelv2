/**
 * PaaS Plans Manager Admin Component
 * Allows administrators to manage PaaS service plans
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

interface PaasPlan {
  id: string;
  name: string;
  description: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  bandwidthGb: number;
  priceHourly: number;
  priceMonthly: number;
  maxDeployments: number;
  maxEnvironmentVars: number;
  supportsCustomDomains: boolean;
  supportsAutoDeployments: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CreatePlanData {
  name: string;
  description: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  bandwidthGb: number;
  priceHourly: number;
  priceMonthly: number;
  maxDeployments: number;
  maxEnvironmentVars: number;
  supportsCustomDomains: boolean;
  supportsAutoDeployments: boolean;
  active: boolean;
  displayOrder: number;
}

export const PaaSPlansManager: React.FC = () => {
  const { token } = useAuth();
  const [plans, setPlans] = useState<PaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaasPlan | null>(null);
  const [formData, setFormData] = useState<CreatePlanData>({
    name: '',
    description: '',
    cpuCores: 0.5,
    memoryMb: 512,
    storageGb: 1024,
    bandwidthGb: 100,
    priceHourly: 0.008,
    priceMonthly: 5.80,
    maxDeployments: 10,
    maxEnvironmentVars: 100,
    supportsCustomDomains: true,
    supportsAutoDeployments: true,
    active: true,
    displayOrder: 0,
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/paas/plans', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch PaaS plans');
      const data = await response.json();
      setPlans(data.data);
    } catch (error) {
      console.error('Error fetching PaaS plans:', error);
      toast.error('Failed to fetch PaaS plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const response = await fetch('/api/admin/paas/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to create plan');
      }

      toast.success('PaaS plan created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      toast.error('Failed to create PaaS plan');
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    try {
      const response = await fetch(`/api/admin/paas/plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to update plan');
      }

      toast.success('PaaS plan updated successfully');
      setEditDialogOpen(false);
      setSelectedPlan(null);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update PaaS plan');
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      const response = await fetch(`/api/admin/paas/plans/${selectedPlan.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to delete plan');
      }

      toast.success('PaaS plan deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete PaaS plan');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      cpuCores: 0.5,
      memoryMb: 512,
      storageGb: 1024,
      bandwidthGb: 100,
      priceHourly: 0.008,
      priceMonthly: 5.80,
      maxDeployments: 10,
      maxEnvironmentVars: 100,
      supportsCustomDomains: true,
      supportsAutoDeployments: true,
      active: true,
      displayOrder: 0,
    });
  };

  const openEditDialog = (plan: PaasPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      cpuCores: plan.cpuCores,
      memoryMb: plan.memoryMb,
      storageGb: plan.storageGb,
      bandwidthGb: plan.bandwidthGb,
      priceHourly: plan.priceHourly,
      priceMonthly: plan.priceMonthly,
      maxDeployments: plan.maxDeployments,
      maxEnvironmentVars: plan.maxEnvironmentVars,
      supportsCustomDomains: plan.supportsCustomDomains,
      supportsAutoDeployments: plan.supportsAutoDeployments,
      active: plan.active,
      displayOrder: plan.displayOrder,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (plan: PaasPlan) => {
    setSelectedPlan(plan);
    setDeleteDialogOpen(true);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">PaaS Plans</h2>
          <p className="text-muted-foreground">
            Manage pricing plans and service tiers for Platform as a Service
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchPlans}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.active ? '' : 'opacity-50'}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {plan.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    ${plan.priceMonthly.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    per month
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    ${plan.priceHourly.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    per hour
                  </div>
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    CPU
                  </span>
                  <span>{plan.cpuCores} cores</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Memory
                  </span>
                  <span>{plan.memoryMb} MB</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Storage
                  </span>
                  <span>{plan.storageGb} GB</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Bandwidth</span>
                  <span>{plan.bandwidthGb} GB</span>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                {plan.supportsCustomDomains && (
                  <Badge variant="outline" className="text-xs">
                    Custom Domains
                  </Badge>
                )}
                {plan.supportsAutoDeployments && (
                  <Badge variant="outline" className="text-xs">
                    Auto Deploy
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(plan)}
                  className="gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteDialog(plan)}
                  className="gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No PaaS plans found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first PaaS service plan
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
            setSelectedPlan(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? 'Edit PaaS Plan' : 'Create PaaS Plan'}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? 'Update the configuration for this PaaS service plan'
                : 'Create a new PaaS service plan for customers'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Professional Plan"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this plan's features and ideal use cases"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cpuCores">CPU Cores</Label>
                  <Input
                    id="cpuCores"
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="8"
                    value={formData.cpuCores}
                    onChange={(e) => setFormData({ ...formData, cpuCores: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="memoryMb">Memory (MB)</Label>
                  <Input
                    id="memoryMb"
                    type="number"
                    min="128"
                    max="16384"
                    step="128"
                    value={formData.memoryMb}
                    onChange={(e) => setFormData({ ...formData, memoryMb: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storageGb">Storage (GB)</Label>
                  <Input
                    id="storageGb"
                    type="number"
                    min="1"
                    max="500"
                    value={formData.storageGb}
                    onChange={(e) => setFormData({ ...formData, storageGb: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="bandwidthGb">Bandwidth (GB)</Label>
                  <Input
                    id="bandwidthGb"
                    type="number"
                    min="0"
                    max="10000"
                    value={formData.bandwidthGb}
                    onChange={(e) => setFormData({ ...formData, bandwidthGb: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priceHourly">Hourly Price ($)</Label>
                  <Input
                    id="priceHourly"
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.priceHourly}
                    onChange={(e) => setFormData({ ...formData, priceHourly: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="priceMonthly">Monthly Price ($)</Label>
                  <Input
                    id="priceMonthly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceMonthly}
                    onChange={(e) => setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxDeployments">Max Deployments</Label>
                  <Input
                    id="maxDeployments"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.maxDeployments}
                    onChange={(e) => setFormData({ ...formData, maxDeployments: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxEnvironmentVars">Max Environment Variables</Label>
                  <Input
                    id="maxEnvironmentVars"
                    type="number"
                    min="10"
                    max="1000"
                    value={formData.maxEnvironmentVars}
                    onChange={(e) => setFormData({ ...formData, maxEnvironmentVars: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="supportsCustomDomains"
                    checked={formData.supportsCustomDomains}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, supportsCustomDomains: checked })
                    }
                  />
                  <Label htmlFor="supportsCustomDomains">Custom Domains</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="supportsAutoDeployments"
                    checked={formData.supportsAutoDeployments}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, supportsAutoDeployments: checked })
                    }
                  />
                  <Label htmlFor="supportsAutoDeployments">Auto Deployments</Label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Active Plan</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editDialogOpen ? handleUpdatePlan : handleCreatePlan}>
              {editDialogOpen ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PaaS Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedPlan?.name}" plan? This
              action cannot be undone and may affect existing customers using this
              plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
