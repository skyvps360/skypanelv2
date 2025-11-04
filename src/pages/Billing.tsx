/**
 * Billing Page Component
 * Handles wallet management, payments, and billing history
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  Plus, 
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Filter,
  X,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentService, type WalletTransaction, type PaymentHistory, type VPSUptimeSummary, type BillingSummary } from '../services/paymentService';
import Pagination from '../components/ui/Pagination';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PayPalCheckoutDialog from '@/components/billing/PayPalCheckoutDialog';
import { formatCurrency as formatCurrencyDisplay } from '@/lib/formatters';
// Navigation provided by AppLayout

interface FilterState {
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'history'>('overview');
  const [isPayPalDialogOpen, setIsPayPalDialogOpen] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number | null>(null);
  const [pendingPaymentDescription, setPendingPaymentDescription] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  // VPS Uptime state
  const [vpsUptimeData, setVpsUptimeData] = useState<VPSUptimeSummary | null>(null);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [uptimeError, setUptimeError] = useState<string | null>(null);

  // Billing summary state
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Monthly spend calculation states
  const [computedMonthlySpent, setComputedMonthlySpent] = useState<number | null>(null);
  const [computingMonthlySpent, setComputingMonthlySpent] = useState<boolean>(false);
  const [monthlySpentError, setMonthlySpentError] = useState<string | null>(null);
  const [monthlySpentDiscrepancy, setMonthlySpentDiscrepancy] = useState<boolean>(false);

  // Pagination states for each tab
  const [overviewPagination, setOverviewPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
  });

  const [transactionsPagination, setTransactionsPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
  });

  const [historyPagination, setHistoryPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
  });

  // Define load functions with useCallback
  const loadOverviewData = React.useCallback(async () => {
    try {
      const offset = (overviewPagination.currentPage - 1) * overviewPagination.itemsPerPage;
      const result = await paymentService.getWalletTransactions(
        overviewPagination.itemsPerPage,
        offset
      );
      setTransactions(result.transactions);
      
      // Fetch total count - we'll approximate based on hasMore
      if (result.hasMore) {
        setOverviewPagination(prev => ({
          ...prev,
          totalItems: Math.max(prev.totalItems, offset + result.transactions.length + 1)
        }));
      } else {
        setOverviewPagination(prev => ({
          ...prev,
          totalItems: offset + result.transactions.length
        }));
      }
    } catch (error) {
      console.error('Failed to load overview data:', error);
      toast.error('Failed to load recent activity');
    }
  }, [overviewPagination.currentPage, overviewPagination.itemsPerPage]);

  const loadTransactionsData = React.useCallback(async () => {
    try {
      const offset = (transactionsPagination.currentPage - 1) * transactionsPagination.itemsPerPage;
      const result = await paymentService.getWalletTransactions(
        transactionsPagination.itemsPerPage,
        offset
      );
      setTransactions(result.transactions);
      
      if (result.hasMore) {
        setTransactionsPagination(prev => ({
          ...prev,
          totalItems: Math.max(prev.totalItems, offset + result.transactions.length + 1)
        }));
      } else {
        setTransactionsPagination(prev => ({
          ...prev,
          totalItems: offset + result.transactions.length
        }));
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast.error('Failed to load wallet transactions');
    }
  }, [transactionsPagination.currentPage, transactionsPagination.itemsPerPage]);

  const loadHistoryData = React.useCallback(async () => {
    try {
      const offset = (historyPagination.currentPage - 1) * historyPagination.itemsPerPage;
      const result = await paymentService.getPaymentHistory(
        historyPagination.itemsPerPage,
        offset,
        filters.status
      );
      setPaymentHistory(result.payments);
      
      if (result.hasMore) {
        setHistoryPagination(prev => ({
          ...prev,
          totalItems: Math.max(prev.totalItems, offset + result.payments.length + 1)
        }));
      } else {
        setHistoryPagination(prev => ({
          ...prev,
          totalItems: offset + result.payments.length
        }));
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
      toast.error('Failed to load payment history');
    }
  }, [historyPagination.currentPage, historyPagination.itemsPerPage, filters.status]);

  const loadVPSUptimeData = React.useCallback(async () => {
    setUptimeLoading(true);
    setUptimeError(null);
    try {
      const result = await paymentService.getVPSUptimeSummary();
      if (result.success && result.data) {
        setVpsUptimeData(result.data);
      } else {
        setUptimeError(result.error || 'Failed to load VPS uptime data');
      }
    } catch (error) {
      console.error('Failed to load VPS uptime data:', error);
      setUptimeError('Failed to load VPS uptime data');
    } finally {
      setUptimeLoading(false);
    }
  }, []);

  const loadBillingSummary = React.useCallback(async () => {
    setSummaryLoading(true);
    try {
      const result = await paymentService.getBillingSummary();
      if (result.success && result.summary) {
        setBillingSummary(result.summary);
      } else {
        console.error('Failed to load billing summary:', result.error);
      }
    } catch (error) {
      console.error('Failed to load billing summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Robust date parser for transaction createdAt values
  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      if (/^\d+$/.test(dateString)) {
        const ts = parseInt(dateString, 10);
        return new Date(ts < 10000000000 ? ts * 1000 : ts);
      }
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  // Compute monthly spent from wallet transactions with calendar month boundaries
  const calculateMonthlySpent = React.useCallback(async (summaryData?: BillingSummary | null) => {
    setComputingMonthlySpent(true);
    setMonthlySpentError(null);
    setMonthlySpentDiscrepancy(false);

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const pageSize = 100;
      let offset = 0;
      let hasMore = true;
      let pagesFetched = 0;
      const maxPages = 20; // safety cap
      let monthlyTotal = 0;
      let foundAny = false;

      while (hasMore && pagesFetched < maxPages) {
        const result = await paymentService.getWalletTransactions(pageSize, offset);
        const pageTxs = result.transactions || [];
        if (pageTxs.length === 0) {
          hasMore = false;
          break;
        }

        // Filter to current month boundaries
        for (const tx of pageTxs) {
          const created = parseDate(tx.createdAt);
          if (!created) continue;
          if (created >= monthStart && created <= monthEnd) {
            foundAny = true;
            const isDebit = tx.type === 'debit' || (typeof tx.amount === 'number' && tx.amount < 0);
            if (isDebit) {
              monthlyTotal += Math.abs(tx.amount || 0);
            }
          }
        }

        hasMore = result.hasMore;
        offset += pageSize;
        pagesFetched += 1;

        // Optimization: if the oldest transaction in this page is before monthStart and API is sorted by date desc,
        // additional pages are unlikely to include current month. We keep going only if hasMore remains true.
      }

      if (!foundAny) {
        setMonthlySpentError('No current-month transactions found');
      }

      setComputedMonthlySpent(Number(monthlyTotal.toFixed(2)));

      // Compare against server summary if available and flag discrepancies beyond small threshold
      const serverValue = summaryData?.totalSpentThisMonth;
      if (typeof serverValue === 'number') {
        const diff = Math.abs(serverValue - monthlyTotal);
        const threshold = Math.max(0.01, serverValue * 0.005); // 0.5% or $0.01
        setMonthlySpentDiscrepancy(diff > threshold);
      }
    } catch (err) {
      console.error('Monthly spend calculation error:', err);
      setMonthlySpentError('Failed to calculate monthly spend');
      setComputedMonthlySpent(null);
    } finally {
      setComputingMonthlySpent(false);
    }
  }, []);

  const loadBillingData = React.useCallback(async () => {
    setLoading(true);
    try {
      const balance = await paymentService.getWalletBalance();
      if (balance) {
        setWalletBalance(balance.balance);
      }
      await loadOverviewData();
      await Promise.all([
        loadVPSUptimeData(),
        loadBillingSummary()
      ]);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, [loadOverviewData, loadVPSUptimeData, loadBillingSummary]);

  // Separate effect to calculate monthly spend after billing summary is loaded
  useEffect(() => {
    if (billingSummary) {
      calculateMonthlySpent(billingSummary);
    }
  }, [billingSummary, calculateMonthlySpent]);

  // Initial load
  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Reload data when filter status changes
  useEffect(() => {
    if (filters.status && activeTab === 'history') {
      setHistoryPagination(prev => ({ ...prev, currentPage: 1 }));
    }
  }, [filters.status, activeTab]);

  // Load data when tab or pagination changes
  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverviewData();
    } else if (activeTab === 'transactions') {
      loadTransactionsData();
    } else if (activeTab === 'history') {
      loadHistoryData();
    }
  }, [activeTab, loadOverviewData, loadTransactionsData, loadHistoryData]);

  const handlePayPalDialogOpenChange = React.useCallback((nextOpen: boolean) => {
    setIsPayPalDialogOpen(nextOpen);
    if (!nextOpen) {
      setPendingPaymentAmount(null);
      setPendingPaymentDescription('');
    }
  }, []);

  const handlePayPalSuccess = React.useCallback(async () => {
    toast.success('Payment completed. Wallet updated.');
    setAddFundsAmount('');
    await loadBillingData();
  }, [loadBillingData]);

  const handlePayPalCancel = React.useCallback(() => {
    toast.info('PayPal checkout cancelled.');
  }, []);

  const handlePayPalError = React.useCallback((message: string) => {
    toast.error(message);
  }, []);

  const handleAddFunds = () => {
    if (!addFundsAmount) {
      toast.error('Please enter a valid amount');
      return;
    }

    const parsed = parseFloat(addFundsAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const normalizedAmount = Math.round(parsed * 100) / 100;
    setPendingPaymentAmount(normalizedAmount);
    setPendingPaymentDescription(`Add ${formatCurrencyValue(normalizedAmount)} to wallet`);
    setIsPayPalDialogOpen(true);
  };

  const formatCurrencyValue = (amount: number | null | undefined): string =>
    formatCurrencyDisplay(amount, { absolute: true });

  const formatDate = (dateString: string | null | undefined): string => {
    // Handle null, undefined, or empty strings
    if (!dateString) {
      return 'N/A';
    }

    try {
      let date: Date;
      
      // Check if it's a Unix timestamp (number as string)
      if (/^\d+$/.test(dateString)) {
        const timestamp = parseInt(dateString);
        // Check if it's in seconds (Unix timestamp) or milliseconds
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      } else {
        // Try to parse as ISO string or other date format
        date = new Date(dateString);
      }

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        // If parsing failed, try to show the original string as fallback
        console.warn('Failed to parse date:', dateString);
        return dateString.length > 20 ? dateString.substring(0, 20) + '...' : dateString;
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      // Return the original string as fallback instead of "Invalid Date"
      return dateString.length > 20 ? dateString.substring(0, 20) + '...' : dateString;
    }
  };

  const getStatusBadgeClasses = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400';
      case 'pending':
        return 'bg-amber-500/15 text-amber-600 border border-amber-500/20 dark:text-amber-400';
      case 'failed':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'cancelled':
        return 'bg-muted text-muted-foreground border border-border/60';
      case 'refunded':
        return 'bg-purple-500/15 text-purple-600 border border-purple-500/20 dark:text-purple-300';
      default:
        return 'bg-muted text-muted-foreground border border-border/60';
    }
  };

  const exportToCSV = (data: Array<Record<string, string>>, filename: string, headers: string[]) => {
    try {
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header.toLowerCase().replace(/\s+/g, '')];
            // Escape commas and quotes in values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${filename} downloaded successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleExportTransactions = () => {
    const headers = ['Description', 'Type', 'Amount', 'Date', 'Balance After'];
    const exportData = transactions.map(transaction => ({
      description: transaction.description,
      type: transaction.type === 'credit' ? 'Credit' : 'Debit',
      amount: `${transaction.type === 'credit' ? '+' : '-'}${formatCurrencyValue(transaction.amount)}`,
      date: formatDate(transaction.createdAt),
      balanceafter: formatCurrencyValue(transaction.balanceAfter)
    }));
    
    exportToCSV(exportData, 'wallet-transactions.csv', headers);
  };

  const handleExportPaymentHistory = () => {
    const headers = ['Description', 'Amount', 'Status', 'Provider', 'Date'];
    const exportData = paymentHistory.map(payment => ({
      description: payment.description,
      amount: `${formatCurrencyValue(payment.amount)} ${payment.currency}`,
      status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
      provider: payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1),
      date: formatDate(payment.createdAt)
    }));
    
    exportToCSV(exportData, 'payment-history.csv', headers);
  };

  const handleExportVPSUptime = () => {
    try {
      if (!vpsUptimeData || vpsUptimeData.vpsInstances.length === 0) {
        toast.error('No VPS uptime data to export');
        return;
      }

      const headers = ['VPS Label', 'Status', 'Created Date', 'Active Hours', 'Hourly Rate', 'Estimated Cost'];
      const exportData = vpsUptimeData.vpsInstances.map(vps => ({
        vpslabel: vps.label,
        status: vps.status.charAt(0).toUpperCase() + vps.status.slice(1),
        createddate: formatDate(vps.createdAt),
        activehours: vps.activeHours.toLocaleString('en-US', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }),
        hourlyrate: formatCurrencyValue(vps.hourlyRate),
        estimatedcost: formatCurrencyValue(vps.estimatedCost)
      }));

      // Generate filename with timestamp
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `vps-uptime-report-${dateStr}.csv`;

      exportToCSV(exportData, filename, headers);
      toast.success('VPS uptime report exported successfully');
    } catch (error) {
      console.error('Export VPS uptime error:', error);
      toast.error('Failed to export VPS uptime data');
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      dateFrom: '',
      dateTo: ''
    });
    setShowFilter(false);
  };

  const hasActiveFilters = filters.status || filters.dateFrom || filters.dateTo;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Billing
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="h-10 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-9 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
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
              Billing
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Billing &amp; Payments
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage your wallet, add funds via PayPal, and track your spending across all services.
          </p>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Wallet className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <DollarSign className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {/* Wallet Overview - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrencyValue(walletBalance)}
                </p>
                <p className="text-xs text-muted-foreground">Available funds</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-3xl font-bold tracking-tight">
                  {summaryLoading ? (
                    <span className="text-base text-muted-foreground">Loading...</span>
                  ) : billingSummary ? (
                    formatCurrencyValue(billingSummary.monthlyEstimate)
                  ) : (
                    formatCurrencyValue(0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Estimated cost</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <ArrowUpRight className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Spent This Month</p>
                <div className="flex items-center space-x-2">
                  <p className="text-3xl font-bold tracking-tight">
                    {summaryLoading || computingMonthlySpent ? (
                      <span className="text-base text-muted-foreground">{computingMonthlySpent ? 'Calc...' : 'Loading...'}</span>
                    ) : (() => {
                      const serverValue = billingSummary?.totalSpentThisMonth;
                      const displayValue = (computedMonthlySpent ?? serverValue ?? 0);
                      return formatCurrencyValue(displayValue);
                    })()}
                  </p>
                  {monthlySpentDiscrepancy && (
                    <span title="Data discrepancy detected" className="inline-flex items-center text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                  )}
                </div>
                {monthlySpentError ? (
                  <p className="text-xs text-destructive">{monthlySpentError}</p>
                ) : !monthlySpentError && computedMonthlySpent !== null && billingSummary ? (
                  <p className="text-xs text-muted-foreground">From current month</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Total spent</p>
                )}
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <ArrowDownLeft className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">VPS Active Hours</p>
                <p className="text-3xl font-bold tracking-tight">
                  {uptimeLoading ? (
                    <span className="text-base text-muted-foreground">Loading...</span>
                  ) : vpsUptimeData ? (
                    `${vpsUptimeData.totalActiveHours.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    })}h`
                  ) : (
                    '0h'
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Total runtime</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Clock className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Funds Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add Funds to Wallet</CardTitle>
          <CardDescription>Top up your wallet balance using PayPal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1 max-w-xs">
              <label htmlFor="amount" className="sr-only">Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-muted-foreground " />
                </div>
                <input
                  type="number"
                  id="amount"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  className="block w-full pl-10 pr-3 py-2 border border rounded-md bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddFunds}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Funds via PayPal
            </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Funds will be added to your wallet after successful PayPal payment
            </p>
          </CardContent>
        </Card>

        <PayPalCheckoutDialog
          open={isPayPalDialogOpen}
          amount={pendingPaymentAmount}
          description={pendingPaymentDescription}
          onOpenChange={handlePayPalDialogOpenChange}
          onPaymentSuccess={handlePayPalSuccess}
          onPaymentCancel={handlePayPalCancel}
          onError={handlePayPalError}
        />

        {/* VPS Uptime Summary Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-primary" />
                VPS Uptime Summary
              </CardTitle>
              {!uptimeLoading && (
                <button
                  onClick={loadVPSUptimeData}
                  className="inline-flex items-center px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh uptime data"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {uptimeLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="ml-3 text-muted-foreground">Loading VPS uptime data...</p>
              </div>
            ) : uptimeError ? (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">{uptimeError}</p>
                <button
                  onClick={loadVPSUptimeData}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </button>
              </div>
            ) : vpsUptimeData && vpsUptimeData.vpsInstances.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Active Hours</p>
                    <p className="text-2xl font-bold text-foreground">
                      {vpsUptimeData.totalActiveHours.toLocaleString('en-US', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1
                      })} hours
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Estimated Cost</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrencyValue(vpsUptimeData.totalEstimatedCost)}
                    </p>
                  </div>
                </div>

                {/* VPS Uptime Details Table */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">VPS Instance Details</h4>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            VPS Label
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Active Hours
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Hourly Rate
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Estimated Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-border">
                        {vpsUptimeData.vpsInstances.map((vps) => (
                          <tr key={vps.id} className="hover:bg-secondary/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                              {vps.label}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                vps.status === 'running' 
                                  ? 'bg-primary/10 text-primary border border-primary/20' 
                                  : vps.status === 'stopped'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {vps.status.charAt(0).toUpperCase() + vps.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right">
                              {vps.activeHours.toLocaleString('en-US', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right">
                              {formatCurrencyValue(vps.hourlyRate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground text-right">
                              {formatCurrencyValue(vps.estimatedCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {vpsUptimeData.vpsInstances.map((vps) => (
                      <div key={vps.id} className="bg-card border border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium text-foreground">{vps.label}</h5>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            vps.status === 'running' 
                              ? 'bg-primary/10 text-primary border border-primary/20' 
                              : vps.status === 'stopped'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {vps.status.charAt(0).toUpperCase() + vps.status.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Active Hours</p>
                            <p className="text-sm font-medium text-foreground">
                              {vps.activeHours.toLocaleString('en-US', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
                            <p className="text-sm font-medium text-foreground">
                              {formatCurrencyValue(vps.hourlyRate)}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Estimated Cost</p>
                            <p className="text-sm font-bold text-foreground">
                              {formatCurrencyValue(vps.estimatedCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={handleExportVPSUptime}
                    className="inline-flex items-center px-4 py-2 border border shadow-sm text-sm leading-4 font-medium rounded-md text-muted-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export VPS Uptime Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No VPS instances found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a VPS instance to see uptime tracking
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <CardHeader className="border-b border">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-gray-300 hover:border-input dark:hover:border-gray-600'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'transactions'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-gray-300 hover:border-input dark:hover:border-gray-600'
                }`}
              >
                Wallet Transactions
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-gray-300 hover:border-input dark:hover:border-gray-600'
                }`}
              >
                Payment History
              </button>
            </nav>
          </CardHeader>

          <CardContent>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        onClick={() => navigate(`/billing/transaction/${transaction.id}`)}
                        className="flex items-center justify-between py-3 px-3 -mx-3 border-b border-border border last:border-b-0 rounded-md cursor-pointer hover:bg-secondary/80/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${transaction.type === 'credit' ? 'bg-primary/10' : 'bg-muted/50'}`}>
                            {transaction.type === 'credit' ? (
                              <ArrowUpRight className="h-4 w-4 text-primary" />
                            ) : (
                              <ArrowDownLeft className="h-4 w-4 text-foreground" />
                            )}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(transaction.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${transaction.type === 'credit' ? 'text-primary' : 'text-foreground'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrencyValue(transaction.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: {transaction.balanceAfter !== null && transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter)
                              ? formatCurrencyValue(transaction.balanceAfter)
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {overviewPagination.totalItems > 0 && (
                    <Pagination
                      currentPage={overviewPagination.currentPage}
                      totalItems={overviewPagination.totalItems}
                      itemsPerPage={overviewPagination.itemsPerPage}
                      onPageChange={(page) => setOverviewPagination(prev => ({ ...prev, currentPage: page }))}
                      onItemsPerPageChange={(itemsPerPage) => setOverviewPagination(prev => ({ ...prev, itemsPerPage, currentPage: 1 }))}
                      className="mt-4"
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-foreground">Wallet Transactions</h3>
                  <button 
                    onClick={handleExportTransactions}
                    className="inline-flex items-center px-3 py-2 border border shadow-sm text-sm leading-4 font-medium rounded-md text-muted-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </button>
                </div>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-700 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Balance After
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {transactions.map((transaction) => (
                        <tr 
                          key={transaction.id}
                          onClick={() => navigate(`/billing/transaction/${transaction.id}`)}
                          className="cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              transaction.type === 'credit' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted/50 text-foreground'
                            }`}>
                              {transaction.type === 'credit' ? 'Credit' : 'Debit'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrencyValue(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(transaction.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatCurrencyValue(transaction.balanceAfter)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactionsPagination.totalItems > 0 && (
                  <Pagination
                    currentPage={transactionsPagination.currentPage}
                    totalItems={transactionsPagination.totalItems}
                    itemsPerPage={transactionsPagination.itemsPerPage}
                    onPageChange={(page) => setTransactionsPagination(prev => ({ ...prev, currentPage: page }))}
                    onItemsPerPageChange={(itemsPerPage) => setTransactionsPagination(prev => ({ ...prev, itemsPerPage, currentPage: 1 }))}
                    className="mt-4"
                  />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-foreground">Payment History</h3>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowFilter(!showFilter)}
                      className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                        hasActiveFilters 
                          ? 'border-primary text-primary bg-primary/10 dark:border-primary dark:text-primary dark:bg-primary/20' 
                          : 'border text-muted-foreground bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                      {hasActiveFilters && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">
                          {[filters.status, filters.dateFrom, filters.dateTo].filter(Boolean).length}
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={handleExportPaymentHistory}
                      className="inline-flex items-center px-3 py-2 border border shadow-sm text-sm leading-4 font-medium rounded-md text-muted-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export as CSV
                    </button>
                  </div>
                </div>

                {/* Filter Panel */}
                {showFilter && (
                  <div className="bg-muted rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-foreground">Filter Options</h4>
                      <button
                        onClick={() => setShowFilter(false)}
                        className="text-muted-foreground hover:text-muted-foreground dark:hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="status-filter" className="block text-sm font-medium text-muted-foreground mb-1">
                          Status
                        </label>
                        <select
                          id="status-filter"
                          value={filters.status}
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                          className="block w-full px-3 py-2 border border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">All Statuses</option>
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="date-from" className="block text-sm font-medium text-muted-foreground mb-1">
                          From Date
                        </label>
                        <input
                          type="date"
                          id="date-from"
                          value={filters.dateFrom}
                          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                          className="block w-full px-3 py-2 border border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="date-to" className="block text-sm font-medium text-muted-foreground mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          id="date-to"
                          value={filters.dateTo}
                          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                          className="block w-full px-3 py-2 border border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                    {hasActiveFilters && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={clearFilters}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-primary hover:text-primary/80"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-700 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {payment.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {formatCurrencyValue(payment.amount)} {payment.currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className={getStatusBadgeClasses(payment.status)}>
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(payment.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyPagination.totalItems > 0 && (
                  <Pagination
                    currentPage={historyPagination.currentPage}
                    totalItems={historyPagination.totalItems}
                    itemsPerPage={historyPagination.itemsPerPage}
                    onPageChange={(page) => setHistoryPagination(prev => ({ ...prev, currentPage: page }))}
                    onItemsPerPageChange={(itemsPerPage) => setHistoryPagination(prev => ({ ...prev, itemsPerPage, currentPage: 1 }))}
                    className="mt-4"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

export default Billing;
