/**
 * Cancel Subscription Dialog Component
 * Allows users to cancel their container subscription with prorated refund preview
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, DollarSign, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { containerService } from '@/services/containerService';
import type { ContainerSubscription } from '@/types/containers';

interface CancelSubscriptionDialogProps {
  subscription: ContainerSubscription;
  projectCount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const CancelSubscriptionDialog: React.FC<CancelSubscriptionDialogProps> = ({
  subscription,
  projectCount,
  onSuccess,
  onError,
}) => {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Calculate prorated refund
  const refundCalculation = useMemo(() => {
    if (!subscription.plan) return { daysRemaining: 0, refundAmount: 0 };

    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const totalDays = 30;
    const daysElapsed = Math.floor((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const monthlyPrice = subscription.plan.priceMonthly;
    const refundAmount = Number(((daysRemaining / totalDays) * monthlyPrice).toFixed(2));

    return { daysRemaining, refundAmount };
  }, [subscription]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const result = await containerService.cancelSubscription();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      onError(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Button 
        variant="destructive" 
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Cancel Subscription
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Subscription
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <p className="text-sm text-foreground">
                This will permanently cancel your <strong>{subscription.plan?.name}</strong> subscription and delete all your container projects.
              </p>

              {/* Refund Information */}
              {refundCalculation.refundAmount > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>Prorated Refund</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Days remaining:</span>
                      <span className="font-medium text-foreground">{refundCalculation.daysRemaining} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly price:</span>
                      <span className="font-medium text-foreground">${subscription.plan?.priceMonthly.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-2">
                      <span className="font-semibold text-foreground">Refund amount:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ${refundCalculation.refundAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This amount will be credited to your wallet immediately.
                  </p>
                </div>
              )}

              {/* Project Deletion Warning */}
              {projectCount > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-destructive">
                        {projectCount} {projectCount === 1 ? 'project' : 'projects'} will be deleted
                      </p>
                      <p className="text-xs text-destructive/80">
                        All containers and services within these projects will be permanently removed from Easypanel.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* No Projects Message */}
              {projectCount === 0 && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    No active projects to delete.
                  </p>
                </div>
              )}

              <p className="text-sm font-semibold text-destructive">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
