/**
 * Subscription Management Component
 * Displays current subscription details and management options
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings
} from 'lucide-react';
import { containerService } from '@/services/containerService';
import type { ContainerSubscription } from '@/types/containers';

interface SubscriptionManagementProps {
  subscription: ContainerSubscription;
  onSubscriptionChange?: () => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  subscription,
  onSubscriptionChange,
}) => {
  const navigate = useNavigate();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysUntilBilling = (): number => {
    const now = new Date();
    const billingDate = new Date(subscription.currentPeriodEnd);
    const diffTime = billingDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'suspended':
        return <AlertTriangle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setError(null);

    try {
      const result = await containerService.cancelSubscription();

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      setShowCancelDialog(false);
      onSubscriptionChange?.();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const daysUntilBilling = getDaysUntilBilling();
  const isNearBilling = daysUntilBilling <= 7;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Subscription Management
              </CardTitle>
              <CardDescription>
                Manage your container service subscription
              </CardDescription>
            </div>
            <Badge className={getStatusColor(subscription.status)}>
              {getStatusIcon(subscription.status)}
              <span className="ml-1 capitalize">{subscription.status}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold">{subscription.plan?.name || 'Unknown Plan'}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Cost</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(subscription.plan?.priceMonthly || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subscription Start</p>
                <p className="font-medium">{formatDate(subscription.currentPeriodStart)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Next Billing Date
                </p>
                <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                <p className="text-sm text-muted-foreground">
                  {daysUntilBilling > 0 
                    ? `${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''} remaining`
                    : 'Due today'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Plan Resources */}
          {subscription.plan && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Plan Resources</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{subscription.plan.maxCpuCores}</p>
                  <p className="text-xs text-blue-700">CPU Cores</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{subscription.plan.maxMemoryGb}</p>
                  <p className="text-xs text-green-700">GB Memory</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{subscription.plan.maxStorageGb}</p>
                  <p className="text-xs text-purple-700">GB Storage</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{subscription.plan.maxContainers}</p>
                  <p className="text-xs text-orange-700">Containers</p>
                </div>
              </div>
            </div>
          )}

          {/* Billing Alert */}
          {isNearBilling && subscription.status === 'active' && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Your next billing cycle starts in {daysUntilBilling} day{daysUntilBilling !== 1 ? 's' : ''}. 
                Make sure you have sufficient wallet balance to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}

          {/* Suspended Status Alert */}
          {subscription.status === 'suspended' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription is suspended due to insufficient wallet balance. 
                Add funds to your wallet to reactivate your container services.
              </AlertDescription>
            </Alert>
          )}

          {/* Cancelled Status Alert */}
          {subscription.status === 'cancelled' && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Your subscription has been cancelled. You can still access your containers until {formatDate(subscription.currentPeriodEnd)}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3">
          {/* Upgrade/Downgrade Options */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              disabled
            >
              <ArrowUpCircle className="h-4 w-4" />
              Upgrade Plan
              <Badge variant="secondary" className="ml-1 text-xs">Coming Soon</Badge>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              disabled
            >
              <ArrowDownCircle className="h-4 w-4" />
              Downgrade Plan
              <Badge variant="secondary" className="ml-1 text-xs">Coming Soon</Badge>
            </Button>
          </div>

          {/* Cancel Subscription */}
          {subscription.status === 'active' && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancel Subscription
            </Button>
          )}

          {/* Add Funds Button for Suspended */}
          {subscription.status === 'suspended' && (
            <Button
              onClick={() => navigate('/billing')}
              className="flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Add Funds
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Container Subscription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your container subscription? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> You must delete all projects and containers before cancelling your subscription.
                Your subscription will remain active until {formatDate(subscription.currentPeriodEnd)}.
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">What happens when you cancel:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• No new billing cycles will be created</li>
                <li>• You can continue using containers until {formatDate(subscription.currentPeriodEnd)}</li>
                <li>• All containers and data will be permanently deleted after the period ends</li>
                <li>• You can resubscribe at any time to create new containers</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelling}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Subscription'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubscriptionManagement;