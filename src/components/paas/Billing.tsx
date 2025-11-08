/**
 * PaaS Billing & Usage Page
 * View billing history and usage statistics for PaaS applications
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  ArrowLeft,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BillingRecord {
  id: string;
  appName: string;
  appId: string;
  date: string;
  hours: number;
  cost: number;
  status: 'paid' | 'pending' | 'failed';
}

interface UsageSummary {
  currentMonth: {
    totalCost: number;
    totalHours: number;
    appCount: number;
  };
  previousMonth: {
    totalCost: number;
    totalHours: number;
  };
}

export const Billing: React.FC = () => {
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error('Please log in to view billing data');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/paas/billing/history', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load billing data');
      }

      const data = await response.json();
      setBillingHistory(data.history || []);
      setUsageSummary(data.summary || {
        currentMonth: { totalCost: 0, totalHours: 0, appCount: 0 },
        previousMonth: { totalCost: 0, totalHours: 0 },
      });
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      paid: 'default',
      pending: 'secondary',
      failed: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const calculatePercentageChange = () => {
    if (!usageSummary || usageSummary.previousMonth.totalCost === 0) {
      return 0;
    }

    const change =
      ((usageSummary.currentMonth.totalCost - usageSummary.previousMonth.totalCost) /
        usageSummary.previousMonth.totalCost) *
      100;

    return Math.round(change);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/paas">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Billing & Usage</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const percentageChange = calculatePercentageChange();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/paas">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground">
            View your PaaS application billing history and usage statistics
          </p>
        </div>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Month Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(usageSummary?.currentMonth.totalCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {percentageChange > 0 && '+'}
              {percentageChange}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(usageSummary?.currentMonth.totalHours || 0)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Across {usageSummary?.currentMonth.appCount || 0} applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageSummary?.currentMonth.appCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Detailed billing records for your PaaS applications
              </CardDescription>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {billingHistory.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No billing history yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Billing records will appear here once your applications start running
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/paas/apps/${record.appId}`}
                        className="text-primary hover:underline"
                      >
                        {record.appName}
                      </Link>
                    </TableCell>
                    <TableCell>{record.hours.toFixed(2)}h</TableCell>
                    <TableCell>{formatCurrency(record.cost)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Helpful Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            How Billing Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Hourly Billing</h4>
            <p className="text-sm text-muted-foreground">
              You're billed hourly for each running application based on the resources allocated.
              Billing starts when your application is deployed and stops when it's removed or paused.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Payment Methods</h4>
            <p className="text-sm text-muted-foreground">
              Charges are deducted from your account wallet balance. Make sure to keep your wallet
              funded to avoid service interruptions.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Usage Monitoring</h4>
            <p className="text-sm text-muted-foreground">
              Track your usage in real-time and set up billing alerts to stay within your budget.
              Visit your account settings to configure notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
