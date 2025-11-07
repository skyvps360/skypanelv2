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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaaSRuntime {
  id: number;
  name: string;
  runtime_type: 'node' | 'python' | 'php' | 'docker';
  version: string;
  base_image: string;
  default_build_cmd: string | null;
  default_start_cmd: string | null;
  is_active: boolean;
}

interface PaaSRuntimesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaaSRuntimesModal({ open, onClose, onSuccess }: PaaSRuntimesModalProps) {
  const [runtimes, setRuntimes] = useState<PaaSRuntime[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRuntime, setEditingRuntime] = useState<PaaSRuntime | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    runtime_type: 'node' as 'node' | 'python' | 'php' | 'docker',
    version: '',
    base_image: '',
    default_build_cmd: '',
    default_start_cmd: '',
  });

  useEffect(() => {
    if (open) {
      fetchRuntimes();
    }
  }, [open]);

  const fetchRuntimes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/runtimes?include_inactive=true`, {
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
      const url = editingRuntime
        ? `${API_BASE_URL}/paas/admin/runtimes/${editingRuntime.id}`
        : `${API_BASE_URL}/paas/admin/runtimes`;
      
      const response = await fetch(url, {
        method: editingRuntime ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        await fetchRuntimes();
        resetForm();
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving runtime:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (runtime: PaaSRuntime) => {
    setEditingRuntime(runtime);
    setFormData({
      name: runtime.name,
      runtime_type: runtime.runtime_type,
      version: runtime.version,
      base_image: runtime.base_image,
      default_build_cmd: runtime.default_build_cmd || '',
      default_start_cmd: runtime.default_start_cmd || '',
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this runtime?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/admin/runtimes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchRuntimes();
        onSuccess();
      }
    } catch (error) {
      console.error('Error deleting runtime:', error);
    }
  };

  const resetForm = () => {
    setEditingRuntime(null);
    setFormData({
      name: '',
      runtime_type: 'node',
      version: '',
      base_image: '',
      default_build_cmd: '',
      default_start_cmd: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage PaaS Runtimes</DialogTitle>
          <DialogDescription>
            Configure available runtime environments for applications
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {editingRuntime ? 'Edit Runtime' : 'Create New Runtime'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Runtime Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Node.js 20 LTS"
                  required
                />
              </div>

              <div>
                <Label htmlFor="runtime_type">Runtime Type</Label>
                <Select
                  value={formData.runtime_type}
                  onValueChange={(value: any) => setFormData({ ...formData, runtime_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="node">Node.js</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="php">PHP</SelectItem>
                    <SelectItem value="docker">Custom Docker</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={e => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g., 20"
                  required
                />
              </div>

              <div>
                <Label htmlFor="base_image">Base Docker Image</Label>
                <Input
                  id="base_image"
                  value={formData.base_image}
                  onChange={e => setFormData({ ...formData, base_image: e.target.value })}
                  placeholder="e.g., node:20-alpine"
                  required
                />
              </div>

              <div>
                <Label htmlFor="default_build_cmd">Default Build Command</Label>
                <Input
                  id="default_build_cmd"
                  value={formData.default_build_cmd}
                  onChange={e => setFormData({ ...formData, default_build_cmd: e.target.value })}
                  placeholder="e.g., npm install && npm run build"
                />
              </div>

              <div>
                <Label htmlFor="default_start_cmd">Default Start Command</Label>
                <Input
                  id="default_start_cmd"
                  value={formData.default_start_cmd}
                  onChange={e => setFormData({ ...formData, default_start_cmd: e.target.value })}
                  placeholder="e.g., npm start"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingRuntime ? 'Update Runtime' : 'Create Runtime'}
                </Button>
                {editingRuntime && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Existing Runtimes</h3>
            <div className="space-y-4">
              {runtimes.map(runtime => (
                <div key={runtime.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{runtime.name}</h4>
                      <p className="text-sm text-gray-600">{runtime.runtime_type} {runtime.version}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(runtime)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(runtime.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-mono text-xs break-all">{runtime.base_image}</p>
                    {runtime.default_build_cmd && (
                      <p className="text-xs text-gray-600">Build: {runtime.default_build_cmd}</p>
                    )}
                    {runtime.default_start_cmd && (
                      <p className="text-xs text-gray-600">Start: {runtime.default_start_cmd}</p>
                    )}
                    <p className={runtime.is_active ? 'text-green-600' : 'text-gray-500'}>
                      {runtime.is_active ? 'Active' : 'Inactive'}
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
