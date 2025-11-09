/**
 * PaaS Overview Admin Component
 * Shows high-level stats and metrics for the PaaS platform
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Server, Rocket, Activity, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

export const PaaSOverview: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const data = await apiClient.get('/admin/paas/overview');
      setOverview(data);
    } catch (error) {
      toast.error('Failed to load PaaS overview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const totalApps = overview?.applications?.reduce((sum: number, item: any) => sum + parseInt(item.count || 0), 0) || 0;
  const runningApps = overview?.applications?.find((item: any) => item.status === 'running')?.count || 0;
  const activeWorkers = overview?.worker_nodes?.find((item: any) => item.status === 'active')?.count || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PaaS Overview</h2>
        <p className="text-muted-foreground">Monitor your Platform-as-a-Service infrastructure</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Rocket className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApps}</div>
            <p className="text-xs text-muted-foreground">{runningApps} running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deployments Today</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.deployments?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Worker Nodes</CardTitle>
            <Server className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkers}</div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${overview?.resource_usage?.total_cost_today?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">PaaS billing</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total CPU:</span>
              <span className="font-semibold">{overview?.resource_usage?.total_cpu?.toFixed(2) || 0} cores</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Total RAM:</span>
              <span className="font-semibold">{((overview?.resource_usage?.total_ram_mb || 0) / 1024).toFixed(2)} GB</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overview?.applications?.map((item: any) => (
                <div key={item.status} className="flex justify-between text-sm">
                  <span className="capitalize">{item.status}:</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
