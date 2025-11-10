import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isPrometheusConfigured, queryPrometheusRange, PrometheusPoint } from '@/lib/prometheus';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface ResourceMetricsProps {
  appId: string;
}

type MetricKey = 'cpu' | 'memory' | 'requests';

const PROM_APP_LABEL = import.meta.env.VITE_PROMETHEUS_APP_LABEL || 'app_id';

const CPU_QUERY_TEMPLATE =
  import.meta.env.VITE_PROMETHEUS_CPU_QUERY ||
  `sum(rate(container_cpu_usage_seconds_total{${PROM_APP_LABEL}="{{APP_ID}}"}[5m])) * 100`;

const MEMORY_QUERY_TEMPLATE =
  import.meta.env.VITE_PROMETHEUS_MEMORY_QUERY ||
  `avg(container_memory_usage_bytes{${PROM_APP_LABEL}="{{APP_ID}}"}) / 1024 / 1024`;

const REQUEST_QUERY_TEMPLATE =
  import.meta.env.VITE_PROMETHEUS_REQUEST_QUERY ||
  `sum(rate(traefik_http_requests_total{${PROM_APP_LABEL}="{{APP_ID}}"}[5m]))`;

const rangeOptions = [
  { label: '1h', value: '1h', seconds: 60 * 60, step: 30 },
  { label: '6h', value: '6h', seconds: 6 * 60 * 60, step: 120 },
  { label: '24h', value: '24h', seconds: 24 * 60 * 60, step: 300 },
  { label: '7d', value: '7d', seconds: 7 * 24 * 60 * 60, step: 1800 },
] as const;

type RangeOption = (typeof rangeOptions)[number];

const formatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatValue = (metric: MetricKey, value?: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  if (metric === 'cpu') {
    return `${value.toFixed(1)}%`;
  }
  if (metric === 'memory') {
    return `${value.toFixed(0)} MB`;
  }
  return `${value.toFixed(2)} req/s`;
};

const resolveQuery = (template: string, appId: string) =>
  template.replace(/{{APP_ID}}/g, appId).replace(/{{APP_LABEL}}/g, PROM_APP_LABEL);

export const ResourceMetrics: React.FC<ResourceMetricsProps> = ({ appId }) => {
  const [timeRange, setTimeRange] = useState<RangeOption>(rangeOptions[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<MetricKey, PrometheusPoint[]>>({
    cpu: [],
    memory: [],
    requests: [],
  });

  const fetchMetrics = useCallback(async (signal?: AbortSignal) => {
    if (!isPrometheusConfigured) {
      setError('Prometheus endpoint not configured. Set VITE_PROMETHEUS_URL.');
       setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const end = Date.now();
    const start = end - timeRange.seconds * 1000;

    try {
      const [cpu, memory, requests] = await Promise.all([
        queryPrometheusRange(resolveQuery(CPU_QUERY_TEMPLATE, appId), {
          start,
          end,
          stepSeconds: timeRange.step,
          signal,
        }),
        queryPrometheusRange(resolveQuery(MEMORY_QUERY_TEMPLATE, appId), {
          start,
          end,
          stepSeconds: timeRange.step,
          signal,
        }),
        queryPrometheusRange(resolveQuery(REQUEST_QUERY_TEMPLATE, appId), {
          start,
          end,
          stepSeconds: timeRange.step,
          signal,
        }),
      ]);

      setMetrics({ cpu, memory, requests });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      setError(err?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [appId, timeRange]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMetrics(controller.signal);
    return () => controller.abort();
  }, [fetchMetrics]);

  const latestValues = useMemo(() => {
    const current: Partial<Record<MetricKey, number>> = {};
    (Object.keys(metrics) as MetricKey[]).forEach((key) => {
      const points = metrics[key];
      if (points.length > 0) {
        current[key] = points[points.length - 1].value;
      }
    });
    return current;
  }, [metrics]);

  const chartData = useMemo(() => {
    const toChartData = (points: PrometheusPoint[]) =>
      points.map((point) => ({
        timestamp: point.timestamp,
        value: Number(point.value.toFixed(4)),
      }));

    return {
      cpu: toChartData(metrics.cpu),
      memory: toChartData(metrics.memory),
      requests: toChartData(metrics.requests),
    };
  }, [metrics]);

  const hasData = (metric: MetricKey) => chartData[metric].length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resource Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Live metrics visualized from Prometheus ({timeRange.label} view)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {rangeOptions.map((range) => (
            <Button
              key={range.value}
              size="sm"
              variant={range.value === timeRange.value ? 'default' : 'outline'}
              onClick={() => setTimeRange(range)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {!isPrometheusConfigured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Prometheus not configured</AlertTitle>
          <AlertDescription>
            Set <code>VITE_PROMETHEUS_URL</code> (and optional query overrides) in your environment to enable
            live metrics.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Metrics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CPU Usage</CardDescription>
            <CardTitle className="text-3xl">{formatValue('cpu', latestValues.cpu)}</CardTitle>
            <Badge variant="outline" className="w-fit text-xs">
              Avg of all replicas
            </Badge>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Memory Usage</CardDescription>
            <CardTitle className="text-3xl">{formatValue('memory', latestValues.memory)}</CardTitle>
            <Badge variant="outline" className="w-fit text-xs">
              Working set (MB)
            </Badge>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Request Rate</CardDescription>
            <CardTitle className="text-3xl">{formatValue('requests', latestValues.requests)}</CardTitle>
            <Badge variant="outline" className="w-fit text-xs">
              Average req/s
            </Badge>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-6">
        <MetricChart
          title="CPU Usage"
          data={chartData.cpu}
          loading={loading}
          empty={!hasData('cpu')}
          valueFormatter={(value) => `${value.toFixed(2)}%`}
          ySuffix="%"
        />
        <MetricChart
          title="Memory Usage"
          data={chartData.memory}
          loading={loading}
          empty={!hasData('memory')}
          valueFormatter={(value) => `${value.toFixed(0)} MB`}
          ySuffix="MB"
        />
        <MetricChart
          title="Request Rate"
          data={chartData.requests}
          loading={loading}
          empty={!hasData('requests')}
          valueFormatter={(value) => `${value.toFixed(2)} req/s`}
          ySuffix="req/s"
        />
      </div>
    </div>
  );
};

interface MetricChartProps {
  title: string;
  data: { timestamp: number; value: number }[];
  loading: boolean;
  empty: boolean;
  valueFormatter: (value: number) => string;
  ySuffix: string;
}

const MetricChart: React.FC<MetricChartProps> = ({ title, data, loading, empty, valueFormatter, ySuffix }) => (
  <Card className="w-full">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold">{title}</CardTitle>
    </CardHeader>
    <CardContent className="h-72">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading metrics...</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">No datapoints in selected range.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`${title}-gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeWidth={0.5} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => formatter.format(value)}
              minTickGap={24}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}${ySuffix}`}
              width={70}
            />
            <Tooltip
              formatter={(value: number) => valueFormatter(value)}
              labelFormatter={(value) => formatter.format(value)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              fillOpacity={1}
              fill={`url(#${title}-gradient)`}
              strokeWidth={2}
            />
            <Brush dataKey="timestamp" height={20} stroke="#2563eb" travellerWidth={10} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);
