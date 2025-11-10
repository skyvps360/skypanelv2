import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { Download } from 'lucide-react';

type UsageReport = {
  range: {
    start: string;
    end: string;
  };
  organizations: Array<{
    id: string;
    name: string;
    totalCost: number;
    cpuHours: number;
    ramMbHours: number;
    appCount: number;
    lastUsageAt?: string;
  }>;
  applications: Array<{
    id: string;
    applicationName: string;
    organizationName: string;
    totalCost: number;
    cpuHours: number;
    ramMbHours: number;
    lastUsageAt?: string;
  }>;
  timeline: Array<{
    bucket: string;
    totalCost: number;
    cpuHours: number;
    ramMbHours: number;
  }>;
};

const ranges = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

const formatCurrency = (value?: number) => `$${(Number(value ?? 0)).toFixed(2)}`;
const formatNumber = (value?: number, digits = 2) => Number(value ?? 0).toFixed(digits);

export const PaaSUsageReports: React.FC = () => {
  const [range, setRange] = useState('30d');
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'organization' | 'application' | null>(null);

  useEffect(() => {
    loadReport();
  }, [range]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<UsageReport>(`/admin/paas/usage/report?range=${range}`);
      setReport(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load usage report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'organization' | 'application') => {
    setExporting(type);
    try {
      const csv = await apiClient.get<string>(`/admin/paas/usage/report/export?range=${range}&type=${type}`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paas-usage-${type}-${range}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || 'Failed to export usage report');
    } finally {
      setExporting(null);
    }
  };

  if (loading || !report) {
    return <div>Loading usage report...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">PaaS Usage Reports</h2>
          <p className="text-muted-foreground">
            Monitor costs and resource consumption across organizations and applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Range</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {ranges.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Usage by Organization</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleExport('organization')}
              disabled={exporting === 'organization'}
            >
              <Download className="h-4 w-4" />
              {exporting === 'organization' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Organization</th>
                  <th className="py-2 pr-4 font-medium">Apps</th>
                  <th className="py-2 pr-4 font-medium">Cost</th>
                  <th className="py-2 pr-4 font-medium">CPU hrs</th>
                  <th className="py-2 pr-4 font-medium">RAM GB hrs</th>
                </tr>
              </thead>
              <tbody>
                {report.organizations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No organizations have usage in this range.
                    </td>
                  </tr>
                ) : (
                  report.organizations.map((org) => (
                    <tr key={org.id} className="border-t">
                      <td className="py-2 pr-4 font-medium">{org.name}</td>
                      <td className="py-2 pr-4">{org.appCount || 0}</td>
                      <td className="py-2 pr-4">{formatCurrency(org.totalCost)}</td>
                      <td className="py-2 pr-4">{formatNumber(org.cpuHours)}</td>
                      <td className="py-2 pr-4">
                        {formatNumber((org.ramMbHours || 0) / 1024)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Usage by Application</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleExport('application')}
              disabled={exporting === 'application'}
            >
              <Download className="h-4 w-4" />
              {exporting === 'application' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Application</th>
                  <th className="py-2 pr-4 font-medium">Organization</th>
                  <th className="py-2 pr-4 font-medium">Cost</th>
                  <th className="py-2 pr-4 font-medium">CPU hrs</th>
                  <th className="py-2 pr-4 font-medium">RAM GB hrs</th>
                </tr>
              </thead>
              <tbody>
                {report.applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No application usage found for this range.
                    </td>
                  </tr>
                ) : (
                  report.applications.map((app) => (
                    <tr key={app.id} className="border-t">
                      <td className="py-2 pr-4 font-medium">{app.applicationName}</td>
                      <td className="py-2 pr-4">{app.organizationName}</td>
                      <td className="py-2 pr-4">{formatCurrency(app.totalCost)}</td>
                      <td className="py-2 pr-4">{formatNumber(app.cpuHours)}</td>
                      <td className="py-2 pr-4">
                        {formatNumber((app.ramMbHours || 0) / 1024)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Timeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Cost</th>
                <th className="py-2 pr-4 font-medium">CPU hrs</th>
                <th className="py-2 pr-4 font-medium">RAM GB hrs</th>
              </tr>
            </thead>
            <tbody>
              {report.timeline.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No usage recorded in this range.
                  </td>
                </tr>
              ) : (
                report.timeline.map((row) => (
                  <tr key={row.bucket} className="border-t">
                    <td className="py-2 pr-4">{new Date(row.bucket).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{formatCurrency(row.totalCost)}</td>
                    <td className="py-2 pr-4">{formatNumber(row.cpuHours)}</td>
                    <td className="py-2 pr-4">{formatNumber((row.ramMbHours || 0) / 1024)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
