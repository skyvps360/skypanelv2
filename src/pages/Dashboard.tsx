/**
 * Dashboard Component
 * Presents a refreshed command center view for VPS, billing, and activity.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server,
  Wallet,
  Activity as ActivityIcon,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { getMonthlySpendWithFallback } from '../lib/billingUtils';
import { MonthlyResetIndicator } from '@/components/Dashboard/MonthlyResetIndicator';
import { formatCurrency } from '@/lib/formatters';
import { apiClient } from '@/lib/api';

interface MetricSummary {
  average: number;
  peak: number;
  last: number;
}

interface VpsMetrics {
  cpu?: MetricSummary | null;
  network?: {
    inbound?: MetricSummary | null;
    outbound?: MetricSummary | null;
  };
  io?: {
    read?: MetricSummary | null;
    swap?: MetricSummary | null;
  };
}

interface VPSStats {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'provisioning';
  plan: string;
  location: string;
  cpu: number;
  memory: number | null;
  storage: number;
  ip: string;
  metrics?: VpsMetrics;
}

interface BillingStats {
  walletBalance: number;
  monthlySpend: number;
  lastPayment: {
    amount: number;
    date: string;
  };
}

interface ActivityItem {
  id: string;
  type: 'vps' | 'billing' | 'support' | 'activity';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

const Dashboard: React.FC = () => {
  const [vpsInstances, setVpsInstances] = useState<VPSStats[]>([]);
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [vpsData, walletData, paymentsData] = await Promise.all([
        apiClient.get('/vps'),
        apiClient.get('/payments/wallet/balance'),
        apiClient.get('/payments/history?limit=1&status=completed'),
      ]);

      const instances: VPSStats[] = await Promise.all(
        (vpsData.instances || []).map(async (instance: any) => {
          let metrics: VpsMetrics | undefined;
          let cpu = 0;

          try {
            const detailData = await apiClient.get(`/vps/${instance.id}`);
            metrics = {
              cpu: detailData.metrics?.cpu?.summary ?? null,
              network: {
                inbound: detailData.metrics?.network?.inbound?.summary ?? null,
                outbound: detailData.metrics?.network?.outbound?.summary ?? null
              },
              io: {
                read: detailData.metrics?.io?.read?.summary ?? null,
                swap: detailData.metrics?.io?.swap?.summary ?? null
              }
            };
            cpu = detailData.metrics?.cpu?.summary?.last || 0;
          } catch (error) {
            console.warn(`Failed to fetch metrics for VPS ${instance.id}:`, error);
          }

          return {
            id: instance.id,
            name: instance.label || 'instance',
            status: instance.status || 'provisioning',
            plan: instance.configuration?.type || '',
            location: instance.configuration?.region || '',
            cpu: Math.round(cpu * 100) / 100,
            memory: null,
            storage: 0,
            ip: instance.ip_address || '',
            metrics
          } satisfies VPSStats;
        })
      );

      setVpsInstances(instances);

      const lastPaymentItem = (paymentsData.payments || [])[0];
      const monthlySpend = await getMonthlySpendWithFallback();

      setBilling({
        walletBalance: walletData.balance ?? 0,
        monthlySpend,
        lastPayment: {
          amount: lastPaymentItem?.amount ?? 0,
          date: lastPaymentItem?.created_at ?? ''
        }
      });

      try {
        const actData = await apiClient.get('/activity/recent?limit=10');
        const mapped: ActivityItem[] = (actData.activities || []).map((activity: any) => ({
          id: activity.id,
          type: activity.type || activity.entity_type || 'activity',
          message: activity.message || `${activity.event_type}`,
          timestamp: activity.timestamp || activity.created_at,
          status: activity.status || 'info'
        }));
        setRecentActivity(mapped);
      } catch (error) {
        console.warn('Failed to load recent activity', error);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = useMemo(
    () => ([
      {
        title: 'Launch a VPS',
        description: 'Deploy a fresh instance in under a minute.',
        to: '/vps',
        icon: <Plus className="h-4 w-4" />
      },
      {
        title: 'Top up wallet',
        description: 'Add credits with secure PayPal checkout.',
        to: '/billing',
        icon: <Wallet className="h-4 w-4" />
      },
      {
        title: 'Create support ticket',
        description: 'Reach the platform team 24/7.',
        to: '/support',
        icon: <ShieldCheck className="h-4 w-4" />
      }
    ]),
    []
  );

  const heroStats = useMemo(() => {
    if (!vpsInstances.length) {
      return {
        running: 0,
        flagged: 0,
        averageCpu: null as number | null,
        topInstance: null as VPSStats | null
      };
    }

    const running = vpsInstances.filter((v) => v.status === 'running').length;
    const flagged = vpsInstances.length - running;
    const cpuSamples = vpsInstances
      .map((v) => v.metrics?.cpu?.last ?? v.metrics?.cpu?.average ?? null)
      .filter((value): value is number => typeof value === 'number');

    const averageCpu = cpuSamples.length
      ? Math.round((cpuSamples.reduce((sum, value) => sum + value, 0) / cpuSamples.length) * 10) / 10
      : null;

    const topInstance = vpsInstances.reduce<VPSStats | null>((top, instance) => {
      const topCpu = top?.metrics?.cpu?.last ?? top?.cpu ?? -1;
      const currentCpu = instance.metrics?.cpu?.last ?? instance.cpu ?? -1;
      return currentCpu > topCpu ? instance : top;
    }, null);

    return { running, flagged, averageCpu, topInstance };
  }, [vpsInstances]);

  const formatTimestamp = useCallback((timestamp: string | undefined) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }, []);

  const handleVpsClick = useCallback((vpsId: string) => {
    navigate(`/vps/${vpsId}`);
  }, [navigate]);

  const walletBalance = billing?.walletBalance ?? 0;
  const monthlySpend = billing?.monthlySpend ?? 0;
  const lastPayment = billing?.lastPayment;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <Skeleton className="h-6 w-32 mb-3" />
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-5 w-2/3" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Welcome back
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {user?.firstName ? `Good to see you, ${user.firstName}.` : 'Welcome to SkyPanel'}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Deploy and manage infrastructure across your providers with live telemetry, unified billing, and proactive insights.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/vps">
                <Plus className="mr-2 h-4 w-4" />
                Launch VPS
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/billing">
                View billing
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Server className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <Wallet className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">VPS Instances</p>
                <p className="text-3xl font-bold tracking-tight">{vpsInstances.length}</p>
                <p className="text-xs text-muted-foreground">Across all providers</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Server className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(walletBalance)}</p>
                <p className="text-xs text-muted-foreground">Ready to deploy infrastructure</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Wallet className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Monthly Spend</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(monthlySpend)}</p>
                <MonthlyResetIndicator monthlySpend={monthlySpend} />
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <TrendingUp className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Last Payment</p>
                <p className="text-3xl font-bold tracking-tight">
                  {lastPayment?.amount ? formatCurrency(lastPayment.amount) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastPayment?.date ? formatTimestamp(lastPayment.date) : 'No payments yet'}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <ActivityIcon className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-2 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          {heroStats.running} active
        </Badge>
        {heroStats.flagged > 0 && (
          <Badge variant="secondary" className="gap-2 px-3 py-1.5">
            <AlertTriangle className="h-3 w-3" />
            {heroStats.flagged} attention
          </Badge>
        )}
        {heroStats.averageCpu !== null && (
          <Badge variant="outline" className="gap-2 px-3 py-1.5">
            <TrendingUp className="h-3 w-3" />
            Avg CPU {heroStats.averageCpu.toFixed(1)}%
          </Badge>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* VPS Fleet - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>VPS Fleet</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Live signal across your deployments</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/vps">
                Manage all
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vpsInstances.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Server className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">No instances yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Deploy your first VPS to see live metrics
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/vps">
                      <Plus className="mr-2 h-4 w-4" />
                      Deploy VPS
                    </Link>
                  </Button>
                </div>
              ) : (
                vpsInstances.slice(0, 5).map((vps) => {
                  const cpuLoad = Math.min(100, Math.max(0, vps.metrics?.cpu?.last ?? vps.cpu ?? 0));
                  const inbound = vps.metrics?.network?.inbound?.last ?? null;
                  const outbound = vps.metrics?.network?.outbound?.last ?? null;

                  return (
                    <button
                      key={vps.id}
                      type="button"
                      onClick={() => handleVpsClick(vps.id)}
                      className="group w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold group-hover:text-primary">{vps.name}</h4>
                            <Badge
                              variant={
                                vps.status === 'running'
                                  ? 'default'
                                  : vps.status === 'stopped'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {vps.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{vps.plan || 'Unassigned'}</span>
                            <span>•</span>
                            <span>{vps.location || 'Unknown region'}</span>
                            <span>•</span>
                            <span>{vps.ip || 'IP pending'}</span>
                          </div>
                        </div>
                        <div className="w-32 space-y-2 text-right">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">CPU</span>
                              <span className="font-semibold">{cpuLoad.toFixed(1)}%</span>
                            </div>
                            <Progress value={cpuLoad} className="h-1.5" />
                          </div>
                          <div className="flex justify-end gap-3 text-[10px] text-muted-foreground">
                            {inbound !== null && (
                              <div className="flex items-center gap-1">
                                <ArrowUpRight className="h-3 w-3" />
                                {inbound.toFixed(1)}
                              </div>
                            )}
                            {outbound !== null && (
                              <div className="flex items-center gap-1">
                                <Compass className="h-3 w-3" />
                                {outbound.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}

              {vpsInstances.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to="/vps">
                    View all {vpsInstances.length} instances
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar - Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  to={action.to}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/50 hover:bg-accent"
                >
                  <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Top Instance Card */}
          {heroStats.topInstance && (
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Highest Load
                  </CardTitle>
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {((heroStats.topInstance.metrics?.cpu?.last ?? heroStats.topInstance.cpu) ?? 0).toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{heroStats.topInstance.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {heroStats.topInstance.plan} • {heroStats.topInstance.location || 'Unknown'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Track your platform events</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/activity">
              View all
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <ActivityIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Activity will appear here after your next deployment or billing event
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.slice(0, 8).map((activity, index) => (
                <div key={activity.id} className="relative flex gap-4 pl-6">
                  {index !== recentActivity.length - 1 && (
                    <span className="absolute left-2 top-6 h-full w-px bg-border" />
                  )}
                  <div
                    className={`absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      activity.status === 'success'
                        ? 'border-primary bg-primary/10'
                        : activity.status === 'warning'
                        ? 'border-muted-foreground bg-muted'
                        : activity.status === 'error'
                        ? 'border-destructive bg-destructive/10'
                        : 'border-primary bg-primary/10'
                    }`}
                  />
                  <div className="flex flex-1 flex-col gap-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.type === 'billing' && 'Billing event'}
                        {activity.type === 'vps' && 'VPS event'}
                        {activity.type === 'support' && 'Support update'}
                        {!['billing', 'vps', 'support'].includes(activity.type) && 'System event'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
