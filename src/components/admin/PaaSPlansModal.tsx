import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

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
}

interface PaaSRuntime {
  id: number;
  name: string;
  runtime_type: string;
  version: string;
}

interface PaaSPlansModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaaSPlansModal({ open, onClose, onSuccess }: PaaSPlansModalProps) {
  const [plans, setPlans] = useState<PaaSPlan[]>([]);
  const [runtimes, setRuntimes] = useState<PaaSRuntime[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaaSPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cpu_limit: 1000,
    memory_limit: 512,
    storage_limit: 1024,
    monthly_price: 10.0,
    supported_runtimes: [] as number[],
  });

  useEffect(() => {
    if (open) {
      fetchPlans();
      fetchRuntimes();
    }
  }, [open]);

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/plans?include_inactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchRuntimes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/runtimes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRuntimes(data.runtimes);
      }
    } catch (error) {
      console.error('Error fetching runtimes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingPlan
        ? `${API_BASE_URL}/paas/admin/plans/${editingPlan.id}`
        : `${API_BASE_URL}/paas/admin/plans`;
      
      const response = await fetch(url, {
        method: editingPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        await fetchPlans();
        resetForm();
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: PaaSPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      cpu_limit: plan.cpu_limit,
      memory_limit: plan.memory_limit,
      storage_limit: plan.storage_limit,
      monthly_price: plan.monthly_price,
      supported_runtimes: plan.supported_runtimes,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchPlans();
        onSuccess();
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      cpu_limit: 1000,
      memory_limit: 512,
      storage_limit: 1024,
      monthly_price: 10.0,
      supported_runtimes: [],
    });
  };

  const toggleRuntime = (runtimeId: number) => {
    setFormData(prev => ({
      ...prev,
      supported_runtimes: prev.supported_runtimes.includes(runtimeId)
        ? prev.supported_runtimes.filter(id => id !== runtimeId)
        : [...prev.supported_runtimes, runtimeId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage PaaS Plans</DialogTitle>
          <DialogDescription>
            Create and manage hosting plans for PaaS applications
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="cpu_limit">CPU Limit (millicores)</Label>
                <Input
                  id="cpu_limit"
                  type="number"
                  value={formData.cpu_limit}
                  onChange={e => setFormData({ ...formData, cpu_limit: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="memory_limit">Memory Limit (MB)</Label>
                <Input
                  id="memory_limit"
                  type="number"
                  value={formData.memory_limit}
                  onChange={e => setFormData({ ...formData, memory_limit: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="storage_limit">Storage Limit (MB)</Label>
                <Input
                  id="storage_limit"
                  type="number"
                  value={formData.storage_limit}
                  onChange={e => setFormData({ ...formData, storage_limit: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="monthly_price">Monthly Price ($)</Label>
                <Input
                  id="monthly_price"
                  type="number"
                  step="0.01"
                  value={formData.monthly_price}
                  onChange={e => setFormData({ ...formData, monthly_price: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div>
                <Label>Supported Runtimes</Label>
                <div className="space-y-2 mt-2">
                  {runtimes.map(runtime => (
                    <div key={runtime.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`runtime-${runtime.id}`}
                        checked={formData.supported_runtimes.includes(runtime.id)}
                        onCheckedChange={() => toggleRuntime(runtime.id)}
                      />
                      <label htmlFor={`runtime-${runtime.id}`} className="text-sm">
                        {runtime.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
                {editingPlan && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Existing Plans</h3>
            <div className="space-y-4">
              {plans.map(plan => (
                <div key={plan.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{plan.name}</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(plan)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(plan.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>CPU: {plan.cpu_limit} millicores</p>
                    <p>RAM: {plan.memory_limit} MB</p>
                    <p>Storage: {plan.storage_limit} MB</p>
                    <p className="font-semibold">${plan.monthly_price}/mo (${plan.hourly_rate.toFixed(4)}/hr)</p>
                    <p className={plan.is_active ? 'text-green-600' : 'text-gray-500'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
