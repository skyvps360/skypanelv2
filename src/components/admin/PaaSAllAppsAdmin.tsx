/**
 * PaaS All Apps Admin Component
 * View and manage all PaaS applications across all organizations
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, Ban, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/lib/api';

export const PaaSAllAppsAdmin: React.FC = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const data = await apiClient.get('/admin/paas/apps');
      setApps(data.apps || []);
    } catch (error) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
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

  const filteredApps = search
    ? apps.filter(
        (app) =>
          app.name.toLowerCase().includes(search.toLowerCase()) ||
          app.organization_name.toLowerCase().includes(search.toLowerCase())
      )
    : apps;

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
          <p className="text-muted-foreground">Manage PaaS applications across all organizations</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6">Loading...</p>
          ) : filteredApps.length === 0 ? (
            <p className="p-6 text-muted-foreground">No applications found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                {filteredApps.map((app) => (
                  <TableRow key={app.id}>
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
                        {app.status === 'suspended' ? (
                          <Button size="sm" variant="outline" onClick={() => handleResume(app.id)}>
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                        ) : (
                          <Button size="sm" variant="destructive" onClick={() => handleSuspend(app.id)}>
                            <Ban className="w-4 h-4 mr-1" />
                            Suspend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
