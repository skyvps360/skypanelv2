/**
 * PaaS Plans Management Component
 * Admin interface for managing App Hosting Plans
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface PaaSPlan {
  id: number;
  name: string;
  cpu_limit: number;
  memory_limit: number;
  storage_limit: number;
  monthly_price: number;
  hourly_rate: number;
  supported_runtimes: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
  name: string;
  cpu_limit: string;
  memory_limit: string;
  storage_limit: string;
  monthly_price: string;
  hourly_rate: string;
  supported_runtimes: number[];
  is_active: boolean;
}

export function PaaSPlansManagement() {
  const [plans, setPlans] = useState<PaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaaSPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    cpu_limit: '',
    memory_limit: '',
    storage_limit: '',
    monthly_price: '',
    hourly_rate: '',
    supported_runtimes: [],
    is_active: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/paas/plans');
      if (response.data.success) {
        setPlans(response.data.plans);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan?: PaaSPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        cpu_limit: plan.cpu_limit.toString(),
        memory_limit: plan.memory_limit.toString(),
        storage_limit: plan.storage_limit.toString(),
        monthly_price: plan.monthly_price.toString(),
        hourly_rate: plan.hourly_rate.toString(),
        supported_runtimes: plan.supported_runtimes || [],
        is_active: plan.is_active,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        cpu_limit: '',
        memory_limit: '',
        storage_limit: '',
        monthly_price: '',
        hourly_rate: '',
        supported_runtimes: [],
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        name: formData.name,
        cpu_limit: parseInt(formData.cpu_limit),
        memory_limit: parseInt(formData.memory_limit),
        storage_limit: parseInt(formData.storage_limit),
        monthly_price: parseFloat(formData.monthly_price),
        hourly_rate: parseFloat(formData.hourly_rate),
        supported_runtimes: formData.supported_runtimes,
        is_active: formData.is_active,
      };

      if (editingPlan) {
        await api.put(`/admin/paas/plans/${editingPlan.id}`, data);
        toast.success("Plan updated successfully");
      } else {
        await api.post('/admin/paas/plans', data);
        toast.success('Plan created successfully');
      }

      handleCloseDialog();
      fetchPlans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save plan');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this plan?')) {
      return;
    }

    try {
      await api.delete(`/admin/paas/plans/${id}`);
      toast.success('Plan deleted successfully');
      fetchPlans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete plan');
    }
  };

  if (loading) {
    return <div>Loading plans...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">App Hosting Plans</h2>
          <p className="text-muted-foreground">
            Manage resource tiers and pricing for customer applications
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>CPU</TableHead>
              <TableHead>Memory</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Monthly Price</TableHead>
              <TableHead>Hourly Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No plans found. Create your first plan to get started.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{(plan.cpu_limit / 1000).toFixed(1)} cores</TableCell>
                  <TableCell>{plan.memory_limit} MB</TableCell>
                  <TableCell>{(plan.storage_limit / 1024).toFixed(0)} GB</TableCell>
                  <TableCell>${plan.monthly_price.toFixed(2)}</TableCell>
                  <TableCell>${plan.hourly_rate.toFixed(4)}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(plan)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </DialogTitle>
              <DialogDescription>
                Configure resource limits and pricing for this hosting plan.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Starter, Professional"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cpu_limit">CPU (millicores)</Label>
                  <Input
                    id="cpu_limit"
                    type="number"
                    value={formData.cpu_limit}
                    onChange={(e) => setFormData({ ...formData, cpu_limit: e.target.value })}
                    placeholder="1000 = 1 core"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="memory_limit">Memory (MB)</Label>
                  <Input
                    id="memory_limit"
                    type="number"
                    value={formData.memory_limit}
                    onChange={(e) => setFormData({ ...formData, memory_limit: e.target.value })}
                    placeholder="512"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="storage_limit">Storage (MB)</Label>
                <Input
                  id="storage_limit"
                  type="number"
                  value={formData.storage_limit}
                  onChange={(e) => setFormData({ ...formData, storage_limit: e.target.value })}
                  placeholder="5120 = 5GB"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="monthly_price">Monthly Price ($)</Label>
                  <Input
                    id="monthly_price"
                    type="number"
                    step="0.01"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                    placeholder="10.00"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.0001"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder="0.0139"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
