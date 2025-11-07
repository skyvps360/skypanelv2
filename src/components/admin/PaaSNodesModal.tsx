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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface PaaSNode {
  id: number;
  name: string;
  region: string;
  host_address: string;
  status: 'pending' | 'online' | 'offline' | 'disabled';
  cpu_total: number | null;
  memory_total: number | null;
  disk_total: number | null;
  cpu_used: number;
  memory_used: number;
  disk_used: number;
  container_count: number;
  last_heartbeat: string | null;
  registration_token?: string;
}

interface PaaSNodesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaaSNodesModal({ open, onClose, onSuccess }: PaaSNodesModalProps) {
  const [nodes, setNodes] = useState<PaaSNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [installScript, setInstallScript] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    host_address: '',
  });

  useEffect(() => {
    if (open) {
      fetchNodes();
    }
  }, [open]);

  const fetchNodes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setNodes(data.nodes);
      }
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setInstallScript(data.install_script);
        setRegistrationToken(data.registration_token);
        setShowScript(true);
        await fetchNodes();
        resetForm();
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating node:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this node? This will stop all applications running on it.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/nodes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchNodes();
        onSuccess();
      }
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  };

  const handleStatusChange = async (id: number, status: 'online' | 'offline' | 'disabled') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/nodes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchNodes();
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating node status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      region: '',
      host_address: '',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'disabled': return 'bg-gray-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatBytes = (mb: number | null) => {
    if (!mb) return 'N/A';
    if (mb < 1024) return `${mb} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getUsagePercent = (used: number, total: number | null) => {
    if (!total) return 0;
    return Math.round((used / total) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage PaaS Worker Nodes</DialogTitle>
          <DialogDescription>
            Add and manage worker nodes for running PaaS applications
          </DialogDescription>
        </DialogHeader>

        {showScript ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Node Created Successfully!</h3>
              <p className="text-sm text-green-800 mb-4">
                Run the following script on your worker node to install and configure the PaaS Agent.
              </p>
              <div className="mb-3">
                <Label>Registration Token</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={registrationToken} readOnly className="font-mono text-xs" />
                  <Button size="sm" onClick={() => copyToClipboard(registrationToken)}>
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <Label>Installation Script</Label>
                <Textarea
                  value={installScript}
                  readOnly
                  className="font-mono text-xs mt-1 h-64"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => copyToClipboard(installScript)}>
                    Copy Script
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowScript(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Add New Node</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Node Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Worker-US-East-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                    placeholder="e.g., us-east"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="host_address">Host Address (Optional)</Label>
                  <Input
                    id="host_address"
                    value={formData.host_address}
                    onChange={e => setFormData({ ...formData, host_address: e.target.value })}
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating...' : 'Create Node & Get Install Script'}
                </Button>
              </form>
            </div>

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Existing Nodes</h3>
              <div className="space-y-4">
                {nodes.map(node => (
                  <div key={node.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{node.name}</h4>
                          <Badge className={getStatusColor(node.status)}>
                            {node.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{node.region}</p>
                        {node.host_address && (
                          <p className="text-xs text-gray-500">{node.host_address}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {node.status === 'online' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(node.id, 'disabled')}
                          >
                            Disable
                          </Button>
                        )}
                        {node.status === 'disabled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(node.id, 'online')}
                          >
                            Enable
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(node.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {node.status !== 'pending' && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">CPU</p>
                          <p className="font-semibold">
                            {getUsagePercent(node.cpu_used, node.cpu_total)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {node.cpu_used}/{node.cpu_total || 0} millicores
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Memory</p>
                          <p className="font-semibold">
                            {getUsagePercent(node.memory_used, node.memory_total)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatBytes(node.memory_used)}/{formatBytes(node.memory_total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Containers</p>
                          <p className="font-semibold">{node.container_count}</p>
                          <p className="text-xs text-gray-500">
                            {node.last_heartbeat
                              ? `Updated ${new Date(node.last_heartbeat).toLocaleTimeString()}`
                              : 'No heartbeat'}
                          </p>
                        </div>
                      </div>
                    )}

                    {node.status === 'pending' && node.registration_token && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm font-semibold text-yellow-900 mb-1">
                          Awaiting Registration
                        </p>
                        <p className="text-xs text-yellow-800">
                          Run the installation script on this node to complete setup
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
