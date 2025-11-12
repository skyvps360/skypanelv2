/**
 * Container Metrics Component
 * Resource usage charts with cost breakdown and historical data
 */

import { useState, useEffect } from "react";
import { Download, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ContainerMetrics } from "@/types/container";
import { formatCurrency } from "@/lib/formatters";

interface ContainerMetricsProps {
  serviceId: string;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  onFetchMetrics: (params: {
    timeRange?: "1h" | "24h" | "7d" | "30d";
    startTime?: string;
    endTime?: string;
  }) => Promise<{
    metrics: ContainerMetrics[];
    summary: {
      avgCpuPercent: number;
      avgMemoryMb: number;
      totalNetworkInGb: number;
      totalNetworkOutGb: number;
      totalCost: number;
    };
  }>;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatMemory = (mb: number): string => {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
};

export function ContainerMetrics({
  serviceId,
  resourceLimits,
  onFetchMetrics,
}: ContainerMetricsProps) {
  const [metrics, setMetrics] = useState<ContainerMetrics[]>([]);
  const [summary, setSummary] = useState<{
    avgCpuPercent: number;
    avgMemoryMb: number;
    totalNetworkInGb: number;
    totalNetworkOutGb: number;
    totalCost: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");

  // Fetch metrics
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await onFetchMetrics({ timeRange });
      setMetrics(data.metrics);
      setSummary(data.summary);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, timeRange]);

  const downloadMetrics = () => {
    const csvHeader = "Timestamp,CPU %,Memory MB,Memory %,Network In,Network Out,Disk Read,Disk Write\n";
    const csvRows = metrics.map((m) =>
      [
        m.timestamp,
        m.cpuPercent,
        m.memoryMb,
        m.memoryPercent,
        m.networkInBytes,
        m.networkOutBytes,
        m.diskReadBytes,
        m.diskWriteBytes,
      ].join(",")
    );
    const csv = csvHeader + csvRows.join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `container-metrics-${serviceId}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Metrics exported successfully");
  };

  // Get latest metrics for current usage
  const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  // Calculate cost breakdown
  const costBreakdown = summary
    ? {
        cpu: (resourceLimits.cpuCores * 0.01 * 730).toFixed(2),
        memory: ((resourceLimits.memoryMb / 1024) * 0.005 * 730).toFixed(2),
        storage: (resourceLimits.diskGb * 0.000137 * 730).toFixed(2),
        network: ((summary.totalNetworkInGb + summary.totalNetworkOutGb) * 0.01).toFixed(2),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Label htmlFor="time-range">Time Range</Label>
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger id="time-range" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchMetrics} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadMetrics} disabled={metrics.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{summary.avgCpuPercent.toFixed(1)}%</p>
                <Progress value={summary.avgCpuPercent} className="h-2" />
                {summary.avgCpuPercent > 80 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    High Usage
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{formatMemory(summary.avgMemoryMb)}</p>
                <Progress
                  value={(summary.avgMemoryMb / resourceLimits.memoryMb) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  of {formatMemory(resourceLimits.memoryMb)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Network Transfer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">In:</span>
                  <span className="font-medium">
                    {summary.totalNetworkInGb.toFixed(2)} GB
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Out:</span>
                  <span className="font-medium">
                    {summary.totalNetworkOutGb.toFixed(2)} GB
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  For selected period
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current Usage */}
      {latestMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Current Resource Usage</CardTitle>
            <CardDescription>Real-time resource consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPU</span>
                <span className="font-medium">{latestMetrics.cpuPercent.toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics.cpuPercent} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-medium">
                  {formatMemory(latestMetrics.memoryMb)} ({latestMetrics.memoryPercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={latestMetrics.memoryPercent} className="h-2" />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Network In</p>
                <p className="font-medium">{formatBytes(latestMetrics.networkInBytes)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Network Out</p>
                <p className="font-medium">{formatBytes(latestMetrics.networkOutBytes)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Disk Read</p>
                <p className="font-medium">{formatBytes(latestMetrics.diskReadBytes)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Disk Write</p>
                <p className="font-medium">{formatBytes(latestMetrics.diskWriteBytes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      {costBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Monthly cost estimate by resource type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">CPU</p>
                  <p className="text-xs text-muted-foreground">
                    {resourceLimits.cpuCores} cores × $0.01/hour
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(costBreakdown.cpu))}/mo</p>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Memory</p>
                  <p className="text-xs text-muted-foreground">
                    {(resourceLimits.memoryMb / 1024).toFixed(1)} GB × $0.005/hour
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(costBreakdown.memory))}/mo</p>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Storage</p>
                  <p className="text-xs text-muted-foreground">
                    {resourceLimits.diskGb} GB × $0.000137/hour
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(costBreakdown.storage))}/mo</p>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Network Transfer</p>
                  <p className="text-xs text-muted-foreground">
                    {summary ? (summary.totalNetworkInGb + summary.totalNetworkOutGb).toFixed(2) : "0"} GB × $0.01/GB
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(costBreakdown.network))}</p>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <p className="text-base font-semibold">Total Estimated Cost</p>
              <p className="text-lg font-bold">
                {formatCurrency(
                  parseFloat(costBreakdown.cpu) +
                    parseFloat(costBreakdown.memory) +
                    parseFloat(costBreakdown.storage) +
                    parseFloat(costBreakdown.network)
                )}/mo
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder for charts */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage Over Time</CardTitle>
            <CardDescription>Historical resource consumption charts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">
                Charts will be rendered here using a charting library (e.g., Recharts)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && metrics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          </CardContent>
        </Card>
      )}

      {!loading && metrics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No metrics data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
