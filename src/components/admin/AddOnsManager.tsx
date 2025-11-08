/**
 * Add-ons Manager Admin Component
 * Allows administrators to manage PaaS add-on services
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle,
  Database,
  DollarSign,
  Edit,
  Key,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Trash2,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AddOnPlan {
  id: string;
  name: string;
  serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
  description: string;
  specifications: Record<string, any>;
  priceHourly: number;
  priceMonthly: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateAddOnPlanData {
  name: string;
  serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
  description: string;
  specifications: Record<string, any>;
  priceHourly: number;
  priceMonthly: number;
  active: boolean;
}

interface AddOnStats {
  totalAddOns: number;
  activeAddOns: number;
  provisioningAddOns: number;
  suspendedAddOns: number;
  terminatedAddOns: number;
  monthlySpend: number;
  addOnsByType: Record<string, number>;
}

const SERVICE_TYPE_ICONS = {
  postgresql: Database,
  redis: Server,
  mysql: Database,
  mongodb: Database,
};

const SERVICE_TYPE_COLORS = {
  postgresql: 'bg-blue-100 text-blue-600 border-blue-200',
  redis: 'bg-red-100 text-red-600 border-red-200',
  mysql: 'bg-green-100 text-green-600 border-green-200',
  mongodb: 'bg-orange-100 text-orange-600 border-orange-200',
};

export const AddOnsManager: React.FC = () => {
  const { token } = useAuth();
  const [plans, setPlans] = useState<AddOnPlan[]>([]);
  const [stats, setStats] = useState<AddOnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AddOnPlan | null>(null);
  const [formData, setFormData] = useState<CreateAddOnPlanData>({
    name: '',
    serviceType: 'postgresql',
    description: '',
    specifications: {
      cpu: 0.5,
      memoryMb: 512,
      storageGb: 10,
      maxConnections: 25,
    },
    priceHourly: 0.004,
    priceMonthly: 2.90,
    active: true,
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/paas/addon-plans', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch add-on plans');
      const data = await response.json();
      setPlans(data.data);
    } catch (error) {
      console.error('Error fetching add-on plans:', error);
      toast.error('Failed to fetch add-on plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // This would need to be implemented in the API
      // For now, we'll compute from the existing plans
      const computedStats: AddOnStats = {
        totalAddOns: plans.length,
        activeAddOns: plans.filter(p => p.active).length,
        provisioningAddOns: 0,
        suspendedAddOns: 0,
        terminatedAddOns: 0,
        monthlySpend: plans.reduce((sum, plan) => sum + (plan.active ? plan.priceMonthly : 0), 0),
        addOnsByType: plans.reduce((acc, plan) => {
          acc[plan.serviceType] = (acc[plan.serviceType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
      setStats(computedStats);
    } catch (error) {
      console.error('Error computing stats:', error);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const response = await fetch('/api/admin/paas/addon-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create add-on plan');

      toast.success('Add-on plan created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchPlans();
      fetchStats();
    } catch (error) {
      console.error('Error creating add-on plan:', error);
      toast.error('Failed to create add-on plan');
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    try {
      const response = await fetch(`/api/admin/paas/addon-plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update add-on plan');

      toast.success('Add-on plan updated successfully');
      setEditDialogOpen(false);
      setSelectedPlan(null);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error('Error updating add-on plan:', error);
      toast.error('Failed to update add-on plan');
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      const response = await fetch(`/api/admin/paas/addon-plans/${selectedPlan.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) throw new Error('Failed to delete add-on plan');

      toast.success('Add-on plan deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
      fetchStats();
    } catch (error) {
      console.error('Error deleting add-on plan:', error);
      toast.error('Failed to delete add-on plan');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      serviceType: 'postgresql',
      description: '',
      specifications: {
        cpu: 0.5,
        memoryMb: 512,
        storageGb: 10,
        maxConnections: 25,
      },
      priceHourly: 0.004,
      priceMonthly: 2.90,
      active: true,
    });
  };

  const openEditDialog = (plan: AddOnPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      serviceType: plan.serviceType,
      description: plan.description,
      specifications: plan.specifications,
      priceHourly: plan.priceHourly,
      priceMonthly: plan.priceMonthly,
      active: plan.active,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (plan: AddOnPlan) => {
    setSelectedPlan(plan);
    setDeleteDialogOpen(true);
  };

  const handleSpecificationChange = (key: string, value: any) => {
    setFormData({
      ...formData,
      specifications: {
        ...formData.specifications,
        [key]: value,
      },
    });
  };

  useEffect(() => {
    fetchPlans();
  }, [plans.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Add-on Services</h2>
          <p className="text-muted-foreground">
            Manage managed services and add-ons for PaaS applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchPlans();
              fetchStats();
            }}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Add-on
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Total Add-ons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAddOns}</div>
              <div className="text-sm text-muted-foreground">
                Available services
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Active Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.activeAddOns}
              </div>
              <div className="text-sm text-muted-foreground">
                Currently active
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.monthlySpend.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                From active services
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Services by Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.addOnsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    {React.createElement(SERVICE_TYPE_ICONS[type as keyof typeof SERVICE_TYPE_ICONS], {
                      className: "h-3 w-3",
                    })}
                    <span className="capitalize">{type}</span>
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.active ? '' : 'opacity-50'}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {React.createElement(
                      SERVICE_TYPE_ICONS[plan.serviceType],
                      { className: "h-5 w-5" }
                    )}
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
                  <Badge
                    className={`border ${SERVICE_TYPE_COLORS[plan.serviceType]}`}
                  >
                    <div className="flex items-center gap-1">
                      {React.createElement(
                        SERVICE_TYPE_ICONS[plan.serviceType],
                        { className: "h-3 w-3" }
                      )}
                      <span className="capitalize text-xs">{plan.serviceType}</span>
                    </div>
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

              {/* Specifications */}
              <div className="space-y-1">
                {Object.entries(plan.specifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    <span>{value}</span>
                  </div>
                ))}
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
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No add-on plans found</h3>
            <p className="text-muted-foreground mb-4">
              Create managed service plans that customers can add to their applications
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Add-on
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
              {editDialogOpen ? 'Edit Add-on Plan' : 'Create Add-on Plan'}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? 'Update the configuration for this add-on service plan'
                : 'Create a new managed service plan for customers'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., PostgreSQL Mini"
                />
              </div>

              <div>
                <Label htmlFor="serviceType">Service Type</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      serviceType: value as 'postgresql' | 'redis' | 'mysql' | 'mongodb',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this add-on service and its ideal use cases"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Specifications based on service type */}
            <div className="space-y-4">
              <Label>Specifications</Label>

              {formData.serviceType === 'postgresql' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cpu">CPU Cores</Label>
                    <Input
                      id="cpu"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="4"
                      value={formData.specifications.cpu}
                      onChange={(e) => handleSpecificationChange('cpu', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="memory">Memory (MB)</Label>
                    <Input
                      id="memory"
                      type="number"
                      min="128"
                      max="8192"
                      step="64"
                      value={formData.specifications.memoryMb}
                      onChange={(e) => handleSpecificationChange('memoryMb', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="storage">Storage (GB)</Label>
                    <Input
                      id="storage"
                      type="number"
                      min="1"
                      max="500"
                      value={formData.specifications.storageGb}
                      onChange={(e) => handleSpecificationChange('storageGb', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxConnections">Max Connections</Label>
                    <Input
                      id="maxConnections"
                      type="number"
                      min="1"
                      max="500"
                      value={formData.specifications.maxConnections}
                      onChange={(e) => handleSpecificationChange('maxConnections', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {formData.serviceType === 'redis' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cpu">CPU Cores</Label>
                    <Input
                      id="cpu"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="4"
                      value={formData.specifications.cpu}
                      onChange={(e) => handleSpecificationChange('cpu', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="memory">Memory (MB)</Label>
                    <Input
                      id="memory"
                      type="number"
                      min="64"
                      max="8192"
                      step="64"
                      value={formData.specifications.memoryMb}
                      onChange={(e) => handleSpecificationChange('memoryMb', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="storage">Storage (GB)</Label>
                    <Input
                      id="storage"
                      type="number"
                      min="1"
                      max="50"
                      value={formData.specifications.storageGb}
                      onChange={(e) => handleSpecificationChange('storageGb', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMemoryPolicy">Max Memory Policy</Label>
                    <Input
                      id="maxMemoryPolicy"
                      value={formData.specifications.maxMemoryPolicy || 'allkeys-lru'}
                      onChange={(e) => handleSpecificationChange('maxMemoryPolicy', e.target.value)}
                      placeholder="e.g., allkeys-lru"
                    />
                  </div>
                </div>
              )}
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
            <AlertDialogTitle>Delete Add-on Plan</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete the "{selectedPlan?.name}" add-on plan?
            This action cannot be undone and will affect existing customers using this
            service.
          </AlertDialogDescription>
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
