/**
 * PaaS Overview Admin Component
 * Displays global PaaS statistics and system health
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Cloud,
  Container,
  Database,
  DollarSign,
  Monitor,
  Package,
  RefreshCw,
  Rocket,
  Server,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

interface PaaSStats {
  totalApps: number;
  deployedApps: number;
  buildingApps: number;
  errorApps: number;
  totalDeployments: number;
  totalAddOns: number;
  activeAddOns: number;
  monthlySpend: number;
  totalBuilds: number;
  successfulBuilds: number;
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

interface BillingOverview {
  monthlyRevenue: number;
  totalRevenue: number;
  activeSubscriptions: number;
  failedBillingAttempts: number;
  totalBilledHours: number;
}

export const PaaSOverview: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<PaaSStats | null>(null);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPaaSStats = async () => {
    try {
      const response = await fetch('/api/admin/paas/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch PaaS stats');
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Error fetching PaaS stats:', error);
      toast.error('Failed to fetch PaaS statistics');
    }
  };

  const fetchWorkerStats = async () => {
    try {
      const response = await fetch('/api/admin/paas/workers', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch worker stats');
      const data = await response.json();
      setWorkerStats(data.data.stats);
    } catch (error) {
      console.error('Error fetching worker stats:', error);
      toast.error('Failed to fetch worker statistics');
    }
  };

  const fetchBillingOverview = async () => {
    try {
      const response = await fetch('/api/admin/paas/billing/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch billing overview');
      const data = await response.json();
      setBillingOverview(data.data);
    } catch (error) {
      console.error('Error fetching billing overview:', error);
      toast.error('Failed to fetch billing overview');
    }
  };

  const refreshAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPaaSStats(),
      fetchWorkerStats(),
      fetchBillingOverview(),
    ]);
    setLoading(false);
  };

  const runBillingProcess = async () => {
    try {
      const response = await fetch('/api/admin/paas/billing/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'paas' }),
      });

      if (!response.ok) throw new Error('Failed to trigger billing');

      const result = await response.json();
      toast.success('Billing process triggered successfully');

      // Refresh billing data after process
      setTimeout(fetchBillingOverview, 2000);
    } catch (error) {
      console.error('Error triggering billing:', error);
      toast.error('Failed to trigger billing process');
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const getHealthStatus = () => {
    if (!workerStats) return { status: 'unknown', color: 'bg-gray-100 text-gray-600', message: 'No data' };

    const { onlineNodes, totalNodes } = workerStats;
    if (totalNodes === 0) return { status: 'error', color: 'bg-red-100 text-red-600', message: 'No workers available' };
    if (onlineNodes === totalNodes) return { status: 'healthy', color: 'bg-green-100 text-green-600', message: 'All workers online' };
    if (onlineNodes > totalNodes / 2) return { status: 'warning', color: 'bg-yellow-100 text-yellow-600', message: 'Some workers offline' };
    return { status: 'critical', color: 'bg-red-100 text-red-600', message: 'Critical worker availability' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">PaaS Overview</h2>
          <p className="text-muted-foreground">
            Monitor your Platform as a Service infrastructure and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runBillingProcess}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Run Billing
          </Button>
          <Button
            variant="outline"
            onClick={refreshAllData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>
            Overall system health and worker node status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${healthStatus.color}`}>
                {healthStatus.message}
              </div>
              {workerStats && (
                <div className="text-sm text-muted-foreground">
                  {workerStats.onlineNodes}/{workerStats.totalNodes} workers online
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {workerStats && (
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {workerStats.availableCapacity} capacity available
                  </div>
                  <Progress
                    value={(workerStats.availableCapacity / workerStats.totalCapacity) * 100}
                    className="w-32 h-2"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Applications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className="h-5 w-5" />
              Applications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">
              {stats?.totalApps || 0}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{stats?.deployedApps || 0} deployed</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-blue-500" />
                <span>{stats?.buildingApps || 0} building</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span>{stats?.errorApps || 0} errors</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-500" />
                <span>{stats?.totalDeployments || 0} total</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add-ons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">
              {stats?.totalAddOns || 0}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Active</span>
                <Badge variant="secondary">{stats?.activeAddOns || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Monthly Revenue</span>
                <span className="font-medium">
                  ${(stats?.monthlySpend || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worker Nodes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              Workers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">
              {workerStats?.totalNodes || 0}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Online</span>
                <Badge className="bg-green-100 text-green-600">
                  {workerStats?.onlineNodes || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Busy</span>
                <Badge className="bg-yellow-100 text-yellow-600">
                  {workerStats?.busyNodes || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Offline</span>
                <Badge className="bg-red-100 text-red-600">
                  {workerStats?.offlineNodes || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">
              ${(billingOverview?.monthlyRevenue || 0).toFixed(2)}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Monthly</span>
                <span className="font-medium">
                  ${(billingOverview?.monthlyRevenue || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Revenue</span>
                <span className="font-medium">
                  ${(billingOverview?.totalRevenue || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Active Subscriptions</span>
                <Badge variant="secondary">
                  {billingOverview?.activeSubscriptions || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common administrative tasks for PaaS management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/admin#paas-workers'}
              className="h-20 flex-col gap-2"
            >
              <Server className="h-6 w-6" />
              <span>Manage Workers</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/admin#paas-plans'}
              className="h-20 flex-col gap-2"
            >
              <Package className="h-6 w-6" />
              <span>Pricing Plans</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/admin#paas-addons'}
              className="h-20 flex-col gap-2"
            >
              <Database className="h-6 w-6" />
              <span>Add-on Services</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
