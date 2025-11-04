import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Activity as ActivityIcon, Filter, Download, Clock, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import Pagination from '@/components/ui/Pagination';

interface ActivityRecord {
  id: string;
  user_id: string;
  organization_id?: string | null;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  message?: string | null;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: any;
  created_at: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
}

const ActivityPage: React.FC = () => {
  const { token } = useAuth();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [limit, setLimit] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 10,
    offset: 0,
    page: 1,
    totalPages: 1
  });

  const fetchActivities = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (status && status !== 'all') params.set('status', status);
      if (from instanceof Date) params.set('from', from.toISOString());
      if (to instanceof Date) params.set('to', to.toISOString());
      params.set('limit', String(limit));
      params.set('offset', String((page - 1) * limit));
      const res = await fetch(`/api/activity?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load activity');
      setActivities(data.activities || []);
      setPagination(data.pagination || {
        total: 0,
        limit: limit,
        offset: (page - 1) * limit,
        page: page,
        totalPages: 1
      });
      setCurrentPage(page);
    } catch (err) {
      console.error('Activity load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to page 1 when filters or limit change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      fetchActivities(1);
    } else {
      fetchActivities(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, from, to, limit]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchActivities(page);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (from instanceof Date) params.set('from', from.toISOString());
    if (to instanceof Date) params.set('to', to.toISOString());
    const url = `/api/activity/export?${params.toString()}`;
    // Open in new tab/window to trigger download; include auth header via fetch for blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const blob = await res.blob();
        const dlUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = 'activity_export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(dlUrl);
      })
      .catch(err => console.error('Export error:', err));
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'success':
        return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 dark:border-green-900/60 dark:text-green-200 dark:bg-green-900/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50 dark:border-yellow-900/60 dark:text-yellow-200 dark:bg-yellow-900/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Warning
        </Badge>;
      case 'error':
        return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 dark:border-red-900/60 dark:text-red-200 dark:bg-red-900/30">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>;
      default:
        return <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
          <Info className="h-3 w-3 mr-1" />
          Info
        </Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Activity
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Activity Log
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Track and monitor all activities across your infrastructure, billing, and support.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <ActivityIcon className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <Clock className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-3xl font-bold tracking-tight">{pagination.total}</p>
                <p className="text-xs text-muted-foreground">Activity records</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <ActivityIcon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Current Page</p>
                <p className="text-3xl font-bold tracking-tight">{pagination.page} / {pagination.totalPages}</p>
                <p className="text-xs text-muted-foreground">Page navigation</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Filter className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Per Page</p>
                <p className="text-3xl font-bold tracking-tight">{limit}</p>
                <p className="text-xs text-muted-foreground">Items displayed</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <ActivityIcon className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down your activity search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input 
                id="type"
                value={type} 
                onChange={e => setType(e.target.value)} 
                placeholder="vps, container, billing" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePicker 
                date={from} 
                onDateChange={setFrom} 
                placeholder="Select start date" 
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePicker 
                date={to} 
                onDateChange={setTo} 
                placeholder="Select end date" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Items per page</Label>
              <Select value={limit.toString()} onValueChange={(value) => handleLimitChange(Number(value))}>
                <SelectTrigger id="limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Button onClick={() => fetchActivities(1)} className="w-full">
                <Filter className="h-4 w-4 mr-2" /> Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Records</CardTitle>
              <CardDescription className="mt-1">
                {activities.length > 0
                  ? `Showing ${activities.length} of ${pagination.total} activities`
                  : 'No activities found'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground">Loading activities...</span>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <ActivityIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No Activity Found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or check back later
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Message
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {activities.map(a => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge variant="outline">{a.entity_type}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {a.event_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground max-w-md truncate">
                          {a.message || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {getStatusBadge(a.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.total > 0 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={pagination.page}
                    totalItems={pagination.total}
                    itemsPerPage={pagination.limit}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleLimitChange}
                    itemsPerPageOptions={[10, 20, 50, 100]}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityPage;