import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wallet, CreditCard, TrendingUp, Receipt } from 'lucide-react';

interface BillingInfo {
  wallet_balance: number;
  monthly_spend: number;
  total_payments: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  payment_history: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
}

interface UserBillingInfoProps {
  billing: BillingInfo;
}

export const UserBillingInfo: React.FC<UserBillingInfoProps> = ({ billing }) => {
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'pending':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'failed':
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(billing.wallet_balance)}
              </p>
              <p className="text-xs text-muted-foreground">Available funds</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Monthly Spend</p>
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(billing.monthly_spend)}
              </p>
              <p className="text-xs text-muted-foreground">Current month</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Payments</p>
              <p className="text-2xl font-bold tracking-tight">{billing.total_payments}</p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between gap-6 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Last Payment</p>
              <p className="text-2xl font-bold tracking-tight">
                {billing.last_payment_amount 
                  ? formatCurrency(billing.last_payment_amount)
                  : '—'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {billing.last_payment_date 
                  ? formatDate(billing.last_payment_date).split(',')[0]
                  : 'No payments'
                }
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billing.payment_history.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment History</h3>
              <p className="text-muted-foreground">
                This user hasn't made any payments yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.payment_history.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getPaymentStatusBadgeClass(payment.status)}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};