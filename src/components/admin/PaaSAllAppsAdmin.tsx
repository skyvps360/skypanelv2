/**
 * PaaS All Apps Admin Component
 * View and manage all PaaS applications across all organizations
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, Ban, Play, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/lib/api';

interface App {
  id: string;
  name: string;
  organization_name: string;
  status: string;
  plan_name: string;
  plan_id: string;
  replicas: number;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  cpu_cores: number;
  ram_mb: number;
  price_per_hour: number;
}

export const PaaSAllAppsAdmin: React.FC = () => {
  const [apps, setApps] = useState<App[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalApps, setTotalApps] = useState(0);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [newPlanId, setNewPlanId] = useState('');

  useEffect(() => {
    loadApps();
    loadPlans();
  }, [currentPage, search, statusFilter]);

  const loadApps = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (search) {
        params.append('search', search);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const data = await apiClient.get(`/admin/paas/apps?${params.toString()}`);
      setApps(data.apps || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalApps(data.pagination?.total || 0);
    } catch (error) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await apiClient.get('/admin/paas/plans');
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to load plans');
    }
  };

  const handleSuspend = async (appId: string) => {
    if (!confirm('Suspend this application?')) return;
    try {
      await apiClient.post(`/admin/paas/apps/${appId}/suspend`, {});
      toast.success('Application suspended');
      loadApps();
    } catch (error: any) {
      toast.error(error.message || 'Failed to suspend');
    }
  };

  const handleResume = async (appId: string) => {
    try {
      await apiClient.post(`/admin/paas/apps/${appId}/resume`, {});
      toast.success('Application resumed');
      loadApps();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume');
    }
  };

  const handleDelete = async (appId: string, appName: string) => {
    if (!confirm(`Delete application "${appName}"? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/paas/apps/${appId}`);
      toast.success('Application deleted');
      loadApps();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleBulkAction = async (action: 'suspend' | 'resume' | 'delete') => {
    if (selectedApps.size === 0) {
      toast.error('No applications selected');
      return;
    }

    const actionText = action === 'delete' ? 'delete' : action;
    if (!confirm(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} ${selectedApps.size} selected application(s)?`)) return;

    try {
      const result = await apiClient.post('/admin/paas/apps/bulk-action', {
        app_ids: Array.from(selectedApps),
        action,
      });

      toast.success(`${result.success.length} app(s) ${actionText}d successfully`);
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} app(s) failed`);
      }

      setSelectedApps(new Set());
      loadApps();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${actionText} applications`);
    }
  };

  const openPlanDialog = (app: App) => {
    setSelectedApp(app);
    setNewPlanId(app.plan_id);
    setPlanDialogOpen(true);
  };

  const handlePlanChange = async () => {
    if (!selectedApp || !newPlanId) return;

    try {
      await apiClient.patch(`/admin/paas/apps/${selectedApp.id}/plan`, {
        plan_id: newPlanId,
      });
      toast.success('Plan updated successfully');
      setPlanDialogOpen(false);
      loadApps();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plan');
    }
  };

  const toggleAppSelection = (appId: string) => {
    const newSelection = new Set(selectedApps);
    if (newSelection.has(appId)) {
      newSelection.delete(appId);
    } else {
      newSelection.add(appId);
    }
    setSelectedApps(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedApps.size === apps.length) {
      setSelectedApps(new Set());
    } else {
      setSelectedApps(new Set(apps.map(app => app.id)));
    }
  };

  const statusColors: Record<string, string> = {
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    suspended: 'bg-orange-500',
    failed: 'bg-red-500',
    building: 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">All Applications</h2>
          <p className="text-muted-foreground">
            Manage PaaS applications across all organizations ({totalApps} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="building">Building</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search apps..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {selectedApps.size > 0 && (
        <Card className="border-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedApps.size} app(s) selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('suspend')}>
                  <Ban className="w-4 h-4 mr-1" />
                  Suspend All
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('resume')}>
                  <Play className="w-4 h-4 mr-1" />
                  Resume All
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6">Loading...</p>
          ) : apps.length === 0 ? (
            <p className="p-6 text-muted-foreground">No applications found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedApps.size === apps.length && apps.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Replicas</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedApps.has(app.id)}
                          onCheckedChange={() => toggleAppSelection(app.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell>{app.organization_name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[app.status]}>{app.status}</Badge>
                      </TableCell>
                      <TableCell>{app.plan_name}</TableCell>
                      <TableCell>{app.replicas}</TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPlanDialog(app)}
                            title="Change Plan"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {app.status === 'suspended' ? (
                            <Button size="sm" variant="outline" onClick={() => handleResume(app.id)}>
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleSuspend(app.id)}>
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(app.id, app.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan Change Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Change the plan for {selectedApp?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Plan</Label>
              <p className="text-sm text-muted-foreground">{selectedApp?.plan_name}</p>
            </div>
            <div>
              <Label>New Plan</Label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.cpu_cores} CPU, {plan.ram_mb}MB RAM) - ${plan.price_per_hour}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePlanChange} disabled={!newPlanId || newPlanId === selectedApp?.plan_id}>
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
