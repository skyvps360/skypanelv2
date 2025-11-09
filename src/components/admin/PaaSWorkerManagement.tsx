/**
 * PaaS Workers Management Component
 * Manage Docker Swarm worker nodes
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Server, Plus, Trash2, Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

export const PaaSWorkerManagement: React.FC = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    ssh_port: 22,
    ssh_user: 'root',
    ssh_key: '',
    auto_provision: true,
  });

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await apiClient.get('/admin/paas/workers');
      setWorkers(data.workers || []);
    } catch (error) {
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await apiClient.post('/admin/paas/workers', formData);
      toast.success('Worker node added successfully');
      setShowAddDialog(false);
      setFormData({ name: '', ip_address: '', ssh_port: 22, ssh_user: 'root', ssh_key: '', auto_provision: true });
      loadWorkers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add worker');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this worker node? This will drain and remove it from the cluster.')) return;
    try {
      await apiClient.delete(`/admin/paas/workers/${id}`);
      toast.success('Worker removed');
      loadWorkers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove worker');
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    provisioning: 'bg-blue-500',
    draining: 'bg-yellow-500',
    down: 'bg-red-500',
    unreachable: 'bg-gray-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Worker Nodes</h2>
          <p className="text-muted-foreground">Manage Docker Swarm worker nodes</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Worker
        </Button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : workers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No worker nodes yet. Add one to scale your PaaS.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((worker) => (
            <Card key={worker.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{worker.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{worker.ip_address}</p>
                  </div>
                  <Badge className={statusColors[worker.status]}>{worker.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>CPU:</span>
                    <span>
                      {worker.cpu.used.toFixed(2)} / {worker.cpu.total} cores
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>RAM:</span>
                    <span>
                      {(worker.ram.used / 1024).toFixed(2)} / {(worker.ram.total / 1024).toFixed(2)} GB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Containers:</span>
                    <span>{worker.containers}</span>
                  </div>
                  {worker.lastHeartbeat && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Last seen:</span>
                      <span>{new Date(worker.lastHeartbeat).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(worker.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Worker Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Worker Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="worker-1"
                />
              </div>
              <div>
                <Label>IP Address</Label>
                <Input
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  placeholder="192.168.1.101"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SSH Port</Label>
                <Input
                  type="number"
                  value={formData.ssh_port}
                  onChange={(e) => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>SSH User</Label>
                <Input
                  value={formData.ssh_user}
                  onChange={(e) => setFormData({ ...formData, ssh_user: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>SSH Private Key</Label>
              <Textarea
                value={formData.ssh_key}
                onChange={(e) => setFormData({ ...formData, ssh_key: e.target.value })}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.auto_provision}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_provision: checked })}
              />
              <Label>Auto-provision (install Docker, join Swarm automatically)</Label>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add Worker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
