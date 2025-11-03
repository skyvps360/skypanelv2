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
  Clock,
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
import { PageHeader, StatsGrid, ContentCard } from '@/components/layouts';
import { getMonthlySpendWithFallback } from '../lib/billingUtils';
import { MonthlyResetIndicator } from '@/components/Dashboard/MonthlyResetIndicator';
import { formatCurrency } from '@/lib/formatters';

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
      const [vpsRes, walletRes, paymentsRes] = await Promise.all([
        fetch('/api/vps', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/payments/wallet/balance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/payments/history?limit=1&status=completed', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [vpsData, walletData, paymentsData] = await Promise.all([
        vpsRes.json(),
        walletRes.json(),
        paymentsRes.json()
      ]);

      if (!vpsRes.ok) throw new Error(vpsData.error || 'Failed to load VPS instances');
      if (!walletRes.ok) throw new Error(walletData.error || 'Failed to load wallet');
      if (!paymentsRes.ok) throw new Error(paymentsData.error || 'Failed to load payment history');

      const instances: VPSStats[] = await Promise.all(
        (vpsData.instances || []).map(async (instance: any) => {
          let metrics: VpsMetrics | undefined;
          let cpu = 0;

          try {
            const detailRes = await fetch(`/api/vps/${instance.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (detailRes.ok) {
              const detailData = await detailRes.json();
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
            }
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
        const actRes = await fetch('/api/activity/recent?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const actData = await actRes.json();
        if (actRes.ok) {
          const mapped: ActivityItem[] = (actData.activities || []).map((activity: any) => ({
            id: activity.id,
            type: activity.type || activity.entity_type || 'activity',
            message: activity.message || `${activity.event_type}`,
            timestamp: activity.timestamp || activity.created_at,
            status: activity.status || 'info'
          }));
          setRecentActivity(mapped);
        }
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

  const getActivityIcon = useCallback((type: string) => {
    switch (type) {
      case 'vps':
        return <Server className="h-4 w-4" />;
      case 'billing':
        return <Wallet className="h-4 w-4" />;
      case 'support':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <ActivityIcon className="h-4 w-4" />;
    }
  }, []);

  const getStatusAccent = useCallback((status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-500/60 bg-green-500/10 text-green-500';
      case 'warning':
        return 'border-yellow-500/60 bg-yellow-500/10 text-yellow-500';
      case 'error':
        return 'border-red-500/60 bg-red-500/10 text-red-500';
      default:
        return 'border-primary/60 bg-primary/10 text-primary';
    }
  }, []);

  const handleVpsClick = useCallback((vpsId: string) => {
    navigate(`/vps/${vpsId}`);
  }, [navigate]);

  const walletBalance = billing?.walletBalance ?? 0;
  const monthlySpend = billing?.monthlySpend ?? 0;
  const lastPayment = billing?.lastPayment;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-3xl border bg-card/60 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
          <Skeleton className="mt-6 h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-8 md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <PageHeader
            title={user?.firstName ? `Good to see you, ${user.firstName}.` : 'SkyPanel command center'}
            description="Deploy and manage infrastructure across your providers with live telemetry, unified billing, and proactive insights."
            badge={{ text: "Welcome back", variant: "secondary" }}
            actions={
              <>
                <Button asChild>
                  <Link to="/vps">
                    <Plus className="mr-2 h-4 w-4" />Launch VPS
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/billing">
                    View billing
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            }
          />
          <Card className="w-full max-w-sm border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Platform pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Wallet balance</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(walletBalance)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Monthly spend</span>
                  <span className="font-medium text-foreground">{formatCurrency(monthlySpend)}</span>
                </div>
                <MonthlyResetIndicator monthlySpend={monthlySpend} />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Last payment</span>
                  <span className="font-medium text-foreground">
                    {lastPayment?.amount ? formatCurrency(lastPayment.amount) : '—'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastPayment?.date ? `Processed ${formatTimestamp(lastPayment.date)}` : 'No payments recorded yet.'}
                </p>
              </div>
              {heroStats.topInstance && (
                <div className="rounded-xl border border-border bg-card p-4 text-sm">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                    Top load VPS
                    <span className="inline-flex items-center gap-1 text-primary">
                      <TrendingUp className="h-3 w-3" />
                      {((heroStats.topInstance.metrics?.cpu?.last ?? heroStats.topInstance.cpu) ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">{heroStats.topInstance.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {heroStats.topInstance.plan} • {heroStats.topInstance.location || 'Unknown region'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Quick Stats */}
        <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Server className="h-4 w-4 text-primary" />
            {heroStats.running} active
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {heroStats.flagged} attention
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Avg CPU {heroStats.averageCpu !== null ? `${heroStats.averageCpu.toFixed(1)}%` : 'n/a'}
          </span>
        </div>
      </section>

      <StatsGrid
        columns={3}
        stats={[
          {
            label: "VPS instances",
            value: vpsInstances.length,
            description: "Across all connected providers",
            icon: <Server className="h-6 w-6" />
          },
          {
            label: "Wallet balance",
            value: formatCurrency(walletBalance),
            description: "Ready to deploy infrastructure",
            icon: <Wallet className="h-6 w-6" />
          },
          {
            label: "Monthly spend",
            value: formatCurrency(monthlySpend),
            description: "Resets at the start of each cycle",
            icon: <TrendingUp className="h-6 w-6" />
          }
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ContentCard
          title="VPS fleet"
          description="Live signal across your most recent deployments."
          headerAction={
            <Button variant="outline" size="sm" asChild>
              <Link to="/vps">
                Manage instances
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        >
          <div className="space-y-4">
            {vpsInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center">
                <Server className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No instances yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Provision your first VPS to see live health and provider telemetry here.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/vps">
                    <Plus className="mr-2 h-4 w-4" />Deploy VPS
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
                    className="w-full rounded-2xl border border-muted bg-background p-5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{vps.name}</span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              vps.status === 'running'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : vps.status === 'stopped'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {vps.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {vps.plan || 'Unassigned plan'} • {vps.location || 'Unknown region'}
                        </p>
                        <p className="text-xs text-muted-foreground">{vps.ip || 'IP pending'}</p>
                      </div>
                      <div className="flex w-full flex-col gap-3 sm:w-64">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>CPU load</span>
                            <span className="font-medium text-foreground">{cpuLoad.toFixed(1)}%</span>
                          </div>
                          <Progress value={cpuLoad} className="mt-1 h-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3 text-primary" />
                            {inbound !== null ? `${inbound.toFixed(2)} Mb/s in` : 'Inbound n/a'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Compass className="h-3 w-3 text-primary" />
                            {outbound !== null ? `${outbound.toFixed(2)} Mb/s out` : 'Outbound n/a'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {vpsInstances.length > 5 && (
              <div className="pt-2 text-right text-xs">
                <Link to="/vps" className="text-primary hover:underline">
                  View all {vpsInstances.length} instances
                </Link>
              </div>
            )}
          </div>
        </ContentCard>

        <div className="grid gap-6">
          <ContentCard title="Billing snapshot">
            <div className="space-y-5 text-sm">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-primary">
                  Spend this cycle
                  <span className="text-foreground">{formatCurrency(monthlySpend)}</span>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Cycle resets with billing service each hour.</p>
                  <Button variant="secondary" size="sm" className="mt-2" asChild>
                    <Link to="/billing">Open billing workspace</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wallet balance</span>
                  <span className="font-medium text-foreground">{formatCurrency(walletBalance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last payment</span>
                  <span className="font-medium text-foreground">
                    {lastPayment?.date ? formatTimestamp(lastPayment.date) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last payment amount</span>
                  <span className="font-medium text-foreground">
                    {lastPayment?.amount ? formatCurrency(lastPayment.amount) : '—'}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-muted bg-muted/20 p-4 text-xs text-muted-foreground">
                <Clock className="mr-2 inline h-4 w-4 align-middle text-primary" />
                Hourly billing engine reconciles usage at the top of each hour.
              </div>
            </div>
          </ContentCard>

          <ContentCard
            title="Quick actions"
            description="Fast paths for the workflows you visit the most."
          >
            <div className="space-y-4">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  to={action.to}
                  className="flex items-start gap-3 rounded-2xl border border-muted/60 bg-background/80 p-4 transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {action.icon}
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {action.title}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </ContentCard>
        </div>
      </section>

      <ContentCard title="Recent activity">
        <div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted p-10 text-center text-sm text-muted-foreground">
              <ActivityIcon className="mb-3 h-8 w-8" />
              Activity will appear here after your next deployment or billing event.
            </div>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((activity, index) => (
                <div key={activity.id} className="relative pl-6">
                  {index !== recentActivity.length - 1 && (
                    <span className="absolute left-2 top-6 h-full w-px bg-border" aria-hidden />
                  )}
                  <span
                    className={`absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${getStatusAccent(activity.status)}`}
                    aria-hidden
                  >
                    {getActivityIcon(activity.type)}
                  </span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-foreground">{activity.message}</p>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activity.type === 'billing' && 'Billing event'}
                    {activity.type === 'vps' && 'VPS event'}
                    {activity.type === 'support' && 'Support update'}
                  </p>
                </div>
              ))}
              <div className="text-right text-xs">
                <Link to="/activity" className="text-primary hover:underline">
                  View all activity
                </Link>
              </div>
            </div>
          )}
        </div>
      </ContentCard>
    </div>
  );
};

export default Dashboard;
