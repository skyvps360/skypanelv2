/**
 * Quota Dashboard Component
 * Displays current quota usage and limits for an organization
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface QuotaData {
  usage: {
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
    service_count: number;
  };
  limits: {
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
    max_services: number;
  };
  utilization: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    service_count_percent: number;
  };
  last_calculated_at: string | null;
}

interface QuotaDashboardProps {
  organizationId: string;
}

export function QuotaDashboard({ organizationId }: QuotaDashboardProps) {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotaData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchQuotaData, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  const fetchQuotaData = async () => {
    try {
      const response = await api.get(`/api/containers/quotas/organization/${organizationId}`);
      if (response.data.success) {
        setQuotaData(response.data.data);
        setError(null);
      }
    } catch (err: any) {
      console.error('Error fetching quota data:', err);
      setError(err.response?.data?.message || 'Failed to load quota data');
    } finally {
      setLoading(false);
    }
  };

  const getUtilizationStatus = (percent: number): 'success' | 'warning' | 'critical' | 'exceeded' => {
    if (percent >= 100) return 'exceeded';
    if (percent >= 90) return 'critical';
    if (percent >= 80) return 'warning';
    return 'success';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-orange-600';
      case 'exceeded':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'exceeded':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getProgressColor = (percent: number): string => {
    if (percent >= 100) return 'bg-red-600';
    if (percent >= 90) return 'bg-orange-600';
    if (percent >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Quotas</CardTitle>
          <CardDescription>Loading quota information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
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

  if (!quotaData) {
    return null;
  }

  const resources = [
    {
      name: 'CPU Cores',
      usage: quotaData.usage.cpu_cores,
      limit: quotaData.limits.cpu_cores,
      percent: quotaData.utilization.cpu_percent,
      unit: 'cores',
    },
    {
      name: 'Memory',
      usage: (quotaData.usage.memory_mb / 1024).toFixed(1),
      limit: (quotaData.limits.memory_mb / 1024).toFixed(1),
      percent: quotaData.utilization.memory_percent,
      unit: 'GB',
    },
    {
      name: 'Disk Storage',
      usage: quotaData.usage.disk_gb,
      limit: quotaData.limits.disk_gb,
      percent: quotaData.utilization.disk_percent,
      unit: 'GB',
    },
    {
      name: 'Services',
      usage: quotaData.usage.service_count,
      limit: quotaData.limits.max_services,
      percent: quotaData.utilization.service_count_percent,
      unit: 'services',
    },
  ];

  const hasWarnings = resources.some((r) => r.percent >= 80);
  const hasCritical = resources.some((r) => r.percent >= 90);
  const hasExceeded = resources.some((r) => r.percent >= 100);

  return (
    <div className="space-y-4">
      {/* Overall Status Alert */}
      {hasExceeded && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            One or more resource quotas have been exceeded. New deployments will be blocked until
            resources are freed or quotas are increased.
          </AlertDescription>
        </Alert>
      )}

      {!hasExceeded && hasCritical && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Critical: One or more resources are at 90% or higher utilization. Consider reducing
            usage or requesting a quota increase.
          </AlertDescription>
        </Alert>
      )}

      {!hasExceeded && !hasCritical && hasWarnings && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Warning: One or more resources are at 80% or higher utilization. Monitor your usage
            closely.
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Quotas</CardTitle>
          <CardDescription>
            Current resource usage and limits for your organization
            {quotaData.last_calculated_at && (
              <span className="block text-xs mt-1">
                Last updated: {new Date(quotaData.last_calculated_at).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {resources.map((resource) => {
              const status = getUtilizationStatus(resource.percent);
              return (
                <div key={resource.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="font-medium">{resource.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getStatusColor(status)}`}>
                        {resource.usage} / {resource.limit} {resource.unit}
                      </span>
                      <Badge
                        variant={status === 'exceeded' || status === 'critical' ? 'destructive' : 'secondary'}
                      >
                        {resource.percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(resource.percent, 100)} className="h-2" />
                    <div
                      className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(
                        resource.percent
                      )}`}
                      style={{ width: `${Math.min(resource.percent, 100)}%` }}
                    />
                  </div>
                  {resource.percent >= 80 && (
                    <p className="text-xs text-muted-foreground">
                      {resource.percent >= 100
                        ? 'Quota exceeded - deployments blocked'
                        : resource.percent >= 90
                        ? 'Critical utilization - immediate action recommended'
                        : 'High utilization - monitor closely'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
