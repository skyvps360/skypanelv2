import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, ExternalLink, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';

interface PaaSApplication {
  id: number;
  name: string;
  slug: string;
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
  system_domain: string;
  instance_count: number;
  created_at: string;
}

interface PaaSPlan {
  id: number;
  name: string;
  cpu_limit: number;
  memory_limit: number;
  storage_limit: number;
  monthly_price: number;
  hourly_rate: number;
}

interface PaaSRuntime {
  id: number;
  name: string;
  runtime_type: string;
}

interface Region {
  name: string;
  available: boolean;
  capacity: number;
}

export default function PaaSPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<PaaSApplication[]>([]);
  const [plans, setPlans] = useState<PaaSPlan[]>([]);
  const [runtimes, setRuntimes] = useState<PaaSRuntime[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    runtime_id: '',
    plan_id: '',
    region: '',
  });

  useEffect(() => {
    fetchApplications();
    fetchPlans();
    fetchRuntimes();
    fetchRegions();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setApplications(data.applications);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/plans`, {
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
      const response = await fetch(`${API_BASE_URL}/paas/runtimes`, {
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

  const fetchRegions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/regions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRegions(data.regions);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          runtime_id: parseInt(formData.runtime_id),
          plan_id: parseInt(formData.plan_id),
          region: formData.region,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCreateModalOpen(false);
        setFormData({ name: '', runtime_id: '', plan_id: '', region: '' });
        await fetchApplications();
        navigate(`/paas/${data.application.id}`);
      }
    } catch (error) {
      console.error('Error creating application:', error);
    }
  };

  const handleAction = async (appId: number, action: 'restart' | 'stop' | 'start') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${appId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchApplications();
      }
    } catch (error) {
      console.error(`Error ${action} application:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'building': return 'bg-blue-500';
      case 'stopped': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'building') {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">PaaS Applications</h1>
          <p className="text-gray-600 mt-1">Deploy and manage your applications</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Application
        </Button>
      </div>

      {applications.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">No applications yet</h3>
          <p className="text-gray-600 mb-6">
            Get started by creating your first application
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Application
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map(app => (
            <Card key={app.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{app.name}</h3>
                  <p className="text-sm text-gray-600">{app.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(app.status)}
                  <Badge className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </div>
              </div>

              {app.system_domain && (
                <div className="mb-4">
                  <a
                    href={`https://${app.system_domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {app.system_domain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                <span>{app.instance_count} instance{app.instance_count !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>Created {new Date(app.created_at).toLocaleDateString()}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/paas/${app.id}`)}
                >
                  Manage
                </Button>
                {app.status === 'running' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(app.id, 'restart')}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(app.id, 'stop')}
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {app.status === 'stopped' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(app.id, 'start')}
                  >
                    <PlayCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Application</DialogTitle>
            <DialogDescription>
              Deploy a new application on our PaaS platform
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateApplication} className="space-y-4">
            <div>
              <Label htmlFor="name">Application Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-awesome-app"
                required
              />
            </div>

            <div>
              <Label htmlFor="runtime">Runtime</Label>
              <Select
                value={formData.runtime_id}
                onValueChange={value => setFormData({ ...formData, runtime_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a runtime" />
                </SelectTrigger>
                <SelectContent>
                  {runtimes.map(runtime => (
                    <SelectItem key={runtime.id} value={runtime.id.toString()}>
                      {runtime.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select
                value={formData.plan_id}
                onValueChange={value => setFormData({ ...formData, plan_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name} - ${plan.monthly_price}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="region">Region</Label>
              <Select
                value={formData.region}
                onValueChange={value => setFormData({ ...formData, region: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.filter(r => r.available).map(region => (
                    <SelectItem key={region.name} value={region.name}>
                      {region.name} ({region.capacity}% available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Application</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
