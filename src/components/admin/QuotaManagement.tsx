/**
 * Quota Management Component (Admin)
 * Allows administrators to view and configure quotas for all organizations
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface OrganizationQuota {
  id: string;
  name: string;
  slug: string;
  quotas: {
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
    max_services: number;
  };
  usage: {
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
    service_count: number;
  };
  utilization: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    service_count_percent: number;
  };
  last_calculated_at: string | null;
}

export function QuotaManagement() {
  const [organizations, setOrganizations] = useState<OrganizationQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrganizationQuota | null>(null);
  const [editForm, setEditForm] = useState({
    cpu_cores: 0,
    memory_mb: 0,
    disk_gb: 0,
    max_services: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrganizations();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOrganizations, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/api/containers/quotas/all');
      if (response.data.success) {
        setOrganizations(response.data.data);
        setError(null);
      }
    } catch (err: any) {
      console.error('Error fetching organizations:', err);
      setError(err.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuota = (org: OrganizationQuota) => {
    setEditingOrg(org);
    setEditForm({
      cpu_cores: org.quotas.cpu_cores,
      memory_mb: org.quotas.memory_mb,
      disk_gb: org.quotas.disk_gb,
      max_services: org.quotas.max_services,
    });
  };

  const handleSaveQuota = async () => {
    if (!editingOrg) return;

    setSaving(true);
    try {
      const response = await api.put(
        `/api/containers/quotas/organization/${editingOrg.id}`,
        editForm
      );

      if (response.data.success) {
        toast.success('Quota limits updated successfully');
        setEditingOrg(null);
        fetchOrganizations();
      }
    } catch (err: any) {
      console.error('Error updating quota:', err);
      toast.error(err.response?.data?.message || 'Failed to update quota');
    } finally {
      setSaving(false);
    }
  };

  const getUtilizationBadge = (percent: number) => {
    if (percent >= 100) {
      return <Badge variant="destructive">Exceeded</Badge>;
    }
    if (percent >= 90) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (percent >= 80) {
      return <Badge className="bg-yellow-600">Warning</Badge>;
    }
    return <Badge variant="secondary">Normal</Badge>;
  };

  const getMaxUtilization = (org: OrganizationQuota): number => {
    return Math.max(
      org.utilization.cpu_percent,
      org.utilization.memory_percent,
      org.utilization.disk_percent,
      org.utilization.service_count_percent
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quota Management</CardTitle>
          <CardDescription>Loading organization quotas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const criticalOrgs = organizations.filter((org) => getMaxUtilization(org) >= 90);
  const warningOrgs = organizations.filter(
    (org) => getMaxUtilization(org) >= 80 && getMaxUtilization(org) < 90
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalOrgs.length}</div>
            <p className="text-xs text-muted-foreground">≥90% utilization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningOrgs.length}</div>
            <p className="text-xs text-muted-foreground">80-89% utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Quotas</CardTitle>
          <CardDescription>
            View and manage resource quotas for all organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Disk</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => {
                const maxUtil = getMaxUtilization(org);
                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{org.name}</div>
                        <div className="text-xs text-muted-foreground">{org.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {org.usage.cpu_cores} / {org.quotas.cpu_cores}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {org.utilization.cpu_percent.toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {(org.usage.memory_mb / 1024).toFixed(1)} /{' '}
                        {(org.quotas.memory_mb / 1024).toFixed(1)} GB
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {org.utilization.memory_percent.toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {org.usage.disk_gb} / {org.quotas.disk_gb} GB
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {org.utilization.disk_percent.toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {org.usage.service_count} / {org.quotas.max_services}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {org.utilization.service_count_percent.toFixed(0)}%
                      </div>
                    </TableCell>
                    <TableCell>{getUtilizationBadge(maxUtil)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditQuota(org)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Quota Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={() => setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Quota Limits</DialogTitle>
            <DialogDescription>
              Update resource quota limits for {editingOrg?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cpu_cores">CPU Cores</Label>
              <Input
                id="cpu_cores"
                type="number"
                min="0"
                step="0.5"
                value={editForm.cpu_cores}
                onChange={(e) =>
                  setEditForm({ ...editForm, cpu_cores: parseFloat(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Current usage: {editingOrg?.usage.cpu_cores} cores
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memory_mb">Memory (MB)</Label>
              <Input
                id="memory_mb"
                type="number"
                min="0"
                step="256"
                value={editForm.memory_mb}
                onChange={(e) =>
                  setEditForm({ ...editForm, memory_mb: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Current usage: {((editingOrg?.usage.memory_mb || 0) / 1024).toFixed(1)} GB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disk_gb">Disk Storage (GB)</Label>
              <Input
                id="disk_gb"
                type="number"
                min="0"
                step="10"
                value={editForm.disk_gb}
                onChange={(e) =>
                  setEditForm({ ...editForm, disk_gb: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Current usage: {editingOrg?.usage.disk_gb} GB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_services">Maximum Services</Label>
              <Input
                id="max_services"
                type="number"
                min="0"
                step="1"
                value={editForm.max_services}
                onChange={(e) =>
                  setEditForm({ ...editForm, max_services: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Current usage: {editingOrg?.usage.service_count} services
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuota} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
