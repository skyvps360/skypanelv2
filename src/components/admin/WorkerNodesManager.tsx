/**
 * Worker Nodes Manager Admin Component
 * Allows administrators to manage PaaS worker nodes
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Monitor,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

interface WorkerNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  status: 'online' | 'offline' | 'busy' | 'maintenance' | 'error';
  capabilities: {
    nodejs: boolean;
    docker: boolean;
    [key: string]: any;
  };
  maxConcurrentBuilds: number;
  currentBuilds: number;
  resourceLimits: Record<string, any>;
  lastHeartbeat?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateWorkerData {
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  capabilities: Record<string, any>;
  maxConcurrentBuilds: number;
  resourceLimits: Record<string, any>;
  metadata: Record<string, any>;
}

interface WorkerStats {
  totalNodes: number;
  onlineNodes: number;
  busyNodes: number;
  offlineNodes: number;
  maintenanceNodes: number;
  errorNodes: number;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
}

export const WorkerNodesManager: React.FC = () => {
  const { token } = useAuth();
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerNode | null>(null);
  const [formData, setFormData] = useState<CreateWorkerData>({
    name: '',
    hostname: '',
    ipAddress: '',
    port: 3001,
    capabilities: {
      nodejs: true,
      docker: true,
    },
    maxConcurrentBuilds: 3,
    resourceLimits: {},
    metadata: {},
  });

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/paas/workers', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch worker nodes');
      const data = await response.json();
      setWorkers(data.data.workers);
      setStats(data.data.stats);
    } catch (error) {
      console.error('Error fetching worker nodes:', error);
      toast.error('Failed to fetch worker nodes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorker = async () => {
    try {
      const response = await fetch('/api/admin/paas/workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create worker node');

      toast.success('Worker node created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchWorkers();
    } catch (error) {
      console.error('Error creating worker:', error);
      toast.error('Failed to create worker node');
    }
  };

  const handleUpdateWorkerStatus = async (workerId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/paas/workers/${workerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        let serverMessage = 'Failed to update worker status';
        try {
          const data = await response.json();
          serverMessage = data?.error || serverMessage;
        } catch {}
        throw new Error(serverMessage);
      }

      toast.success(`Worker status updated to ${status}`);
      fetchWorkers();
    } catch (error) {
      console.error('Error updating worker status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update worker status');
    }
  };

  const handleDeleteWorker = async () => {
    if (!selectedWorker) return;

    try {
      const response = await fetch(`/api/admin/paas/workers/${selectedWorker.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) throw new Error('Failed to delete worker');

      toast.success('Worker node deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedWorker(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast.error('Failed to delete worker node');
    }
  };

  const handleUpdateWorkerConfig = async () => {
    if (!selectedWorker) return;
    try {
      const response = await fetch(`/api/admin/paas/workers/${selectedWorker.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        let serverMessage = 'Failed to update worker';
        try {
          const data = await response.json();
          serverMessage = data?.error || serverMessage;
        } catch {}
        throw new Error(serverMessage);
      }

      toast.success('Worker configuration updated successfully');
      setEditDialogOpen(false);
      setSelectedWorker(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error updating worker configuration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update worker');
    }
  };

  const runMaintenance = async () => {
    try {
      const response = await fetch('/api/admin/paas/workers/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ offlineThresholdMinutes: 5 }),
      });

      if (!response.ok) throw new Error('Failed to run maintenance');

      const data = await response.json();
      toast.success(`Maintenance completed: ${data.data.markedOfflineNodes} nodes marked offline`);
      fetchWorkers();
    } catch (error) {
      console.error('Error running maintenance:', error);
      toast.error('Failed to run maintenance');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      hostname: '',
      ipAddress: '',
      port: 3001,
      capabilities: {
        nodejs: true,
        docker: true,
      },
      maxConcurrentBuilds: 3,
      resourceLimits: {},
      metadata: {},
    });
  };

  const openEditDialog = (worker: WorkerNode) => {
    setSelectedWorker(worker);
    setFormData({
      name: worker.name,
      hostname: worker.hostname,
      ipAddress: worker.ipAddress,
      port: worker.port,
      capabilities: worker.capabilities,
      maxConcurrentBuilds: worker.maxConcurrentBuilds,
      resourceLimits: worker.resourceLimits,
      metadata: worker.metadata,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (worker: WorkerNode) => {
    setSelectedWorker(worker);
    setDeleteDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'busy':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'offline':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'maintenance':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4" />;
      case 'busy':
        return <Clock className="h-4 w-4" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4" />;
      case 'maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Worker Nodes</h2>
          <p className="text-muted-foreground">
            Manage build and deployment worker nodes for the PaaS platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runMaintenance}
            className="gap-2"
          >
            <Wrench className="h-4 w-4" />
            Maintenance
          </Button>
          <Button
            variant="outline"
            onClick={fetchWorkers}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Total Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNodes}</div>
              <div className="text-sm text-muted-foreground">
                Registered nodes
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.onlineNodes}
              </div>
              <div className="text-sm text-muted-foreground">
                Ready for builds
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used</span>
                  <span>{stats.usedCapacity}/{stats.totalCapacity}</span>
                </div>
                <Progress
                  value={(stats.usedCapacity / stats.totalCapacity) * 100}
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {stats.availableCapacity} slots available
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalCapacity > 0
                  ? Math.round((stats.usedCapacity / stats.totalCapacity) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-muted-foreground">
                Current utilization
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workers.map((worker) => (
          <Card key={worker.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {worker.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {worker.hostname} ({worker.ipAddress}:{worker.port})
                  </CardDescription>
                </div>
                <Badge className={`border ${getStatusColor(worker.status)}`}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(worker.status)}
                    <span className="capitalize">{worker.status}</span>
                  </div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Build Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Build Queue</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {worker.currentBuilds}/{worker.maxConcurrentBuilds}
                  </span>
                  <Progress
                    value={(worker.currentBuilds / worker.maxConcurrentBuilds) * 100}
                    className="w-20 h-2"
                  />
                </div>
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-2">
                {worker.capabilities.nodejs && (
                  <Badge variant="outline" className="text-xs">
                    Node.js
                  </Badge>
                )}
                {worker.capabilities.docker && (
                  <Badge variant="outline" className="text-xs">
                    Docker
                  </Badge>
                )}
              </div>

              {/* Last Heartbeat */}
              {worker.lastHeartbeat && (
                <div className="text-xs text-muted-foreground">
                  Last heartbeat:{' '}
                  {new Date(worker.lastHeartbeat).toLocaleString()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {worker.status === 'online' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateWorkerStatus(worker.id, 'maintenance')}
                    className="gap-1"
                  >
                    <Wrench className="h-3 w-3" />
                    Maintenance
                  </Button>
                )}
                {worker.status === 'maintenance' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateWorkerStatus(worker.id, 'online')}
                    className="gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Activate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(worker)}
                  className="gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteDialog(worker)}
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

      {workers.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No worker nodes found</h3>
            <p className="text-muted-foreground mb-4">
              Add worker nodes to handle application builds and deployments
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Worker Node
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
            setSelectedWorker(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? 'Edit Worker Node' : 'Add Worker Node'}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? 'Update the configuration for this worker node'
                : 'Add a new worker node to handle PaaS builds and deployments'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Node Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., worker-01"
                />
              </div>

              <div>
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  placeholder="e.g., build-server-01"
                />
              </div>

              <div>
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input
                  id="ipAddress"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>

              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  min="1"
                  max="65535"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="maxConcurrentBuilds">
                  Max Concurrent Builds
                </Label>
                <Input
                  id="maxConcurrentBuilds"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.maxConcurrentBuilds}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentBuilds: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label>Capabilities</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="nodejs-capability"
                      checked={formData.capabilities.nodejs}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          capabilities: {
                            ...formData.capabilities,
                            nodejs: e.target.checked,
                          },
                        })
                      }
                    />
                    <Label htmlFor="nodejs-capability">Node.js Runtime</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="docker-capability"
                      checked={formData.capabilities.docker}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          capabilities: {
                            ...formData.capabilities,
                            docker: e.target.checked,
                          },
                        })
                      }
                    />
                    <Label htmlFor="docker-capability">Docker Support</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="metadata">Metadata</Label>
                <Textarea
                  id="metadata"
                  value={JSON.stringify(formData.metadata, null, 2)}
                  onChange={(e) => {
                    try {
                      const metadata = JSON.parse(e.target.value);
                      setFormData({ ...formData, metadata });
                    } catch (error) {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder="JSON metadata for this worker"
                  rows={3}
                />
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
            <Button onClick={editDialogOpen ? handleUpdateWorkerConfig : handleCreateWorker}>
              {editDialogOpen ? 'Update Worker' : 'Create Worker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worker Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedWorker?.name}" worker node?
              This action cannot be undone and will interrupt any running builds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorker} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
