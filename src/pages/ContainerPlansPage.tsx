/**
 * Container Plans Page
 * Displays available container plans and allows users to subscribe
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, Cpu, HardDrive, MemoryStick, Container, DollarSign, AlertCircle } from 'lucide-react';
import { containerService } from '@/services/containerService';
import { paymentService } from '@/services/paymentService';
import type { ContainerPlan, ContainerSubscription } from '@/types/containers';
import type { WalletBalance } from '@/services/paymentService';

const ContainerPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ContainerPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<ContainerSubscription | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [plansResult, subscriptionResult, balanceResult] = await Promise.all([
        containerService.getPlans(),
        containerService.getSubscription(),
        paymentService.getWalletBalance(),
      ]);

      if (!plansResult.success) {
        throw new Error(plansResult.error || 'Failed to load container plans');
      }

      setPlans(plansResult.plans || []);
      setCurrentSubscription(subscriptionResult.subscription || null);
      setWalletBalance(balanceResult);
    } catch (err) {
      console.error('Failed to load container plans data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load container plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string, monthlyPrice: number) => {
    if (!walletBalance || walletBalance.balance < monthlyPrice) {
      setError(`Insufficient wallet balance. Required: $${monthlyPrice.toFixed(2)}, Available: $${walletBalance?.balance.toFixed(2) || '0.00'}`);
      return;
    }

    setSubscribing(planId);
    setError(null);

    try {
      const result = await containerService.subscribe(planId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to subscribe to container plan');
      }

      // Refresh data after successful subscription
      await loadData();
      
      // Navigate to container dashboard
      navigate('/containers');
    } catch (err) {
      console.error('Failed to subscribe to container plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to container plan');
    } finally {
      setSubscribing(null);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatResource = (value: number, unit: string): string => {
    return `${value} ${unit}${value !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading container plans...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Container Plans</h1>
        <p className="text-muted-foreground">
          Choose a container plan to start deploying and managing containerized applications
        </p>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Subscription */}
      {currentSubscription && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Subscription</CardTitle>
                <CardDescription>
                  You are currently subscribed to: {currentSubscription.plan?.name}
                </CardDescription>
              </div>
              <Badge variant="default">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Cost</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(currentSubscription.plan?.priceMonthly || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Billing Date</p>
                <p className="font-medium">
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => navigate('/containers')}
            >
              Go to Container Dashboard
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Wallet Balance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {formatCurrency(walletBalance?.balance || 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                Available for container subscriptions
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/billing')}
            >
              Add Funds
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">Available Plans</h2>
        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Container className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Container Plans Available</h3>
                <p className="text-muted-foreground">
                  Container plans are not currently available. Please check back later.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan = currentSubscription?.planId === plan.id;
              const canAfford = walletBalance && walletBalance.balance >= plan.priceMonthly;
              const isSubscribing = subscribing === plan.id;

              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${isCurrentPlan ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <Badge variant="default">
                        <Check className="h-3 w-3 mr-1" />
                        Current Plan
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-2">
                      <span className="text-3xl font-bold">{formatCurrency(plan.priceMonthly)}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatResource(plan.maxCpuCores, 'CPU Core')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <MemoryStick className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatResource(plan.maxMemoryGb, 'GB Memory')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatResource(plan.maxStorageGb, 'GB Storage')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Container className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatResource(plan.maxContainers, 'Container')}
                        </span>
                      </div>
                    </div>

                    {!canAfford && !isCurrentPlan && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Insufficient wallet balance. Need {formatCurrency(plan.priceMonthly - (walletBalance?.balance || 0))} more.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>

                  <CardFooter>
                    {isCurrentPlan ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate('/containers')}
                      >
                        Manage Containers
                      </Button>
                    ) : currentSubscription ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled
                      >
                        Change Plan (Coming Soon)
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(plan.id, plan.priceMonthly)}
                        disabled={!canAfford || isSubscribing}
                      >
                        {isSubscribing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Subscribing...
                          </>
                        ) : (
                          'Subscribe Now'
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Container className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Getting Started</h3>
              <p className="text-sm text-blue-700 mb-2">
                Once you subscribe to a container plan, you'll be able to:
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Create projects to organize your containers</li>
                <li>• Deploy applications from Docker images or templates</li>
                <li>• Manage database services (PostgreSQL, MySQL, Redis, etc.)</li>
                <li>• Monitor resource usage and container logs</li>
                <li>• Scale your applications within your plan limits</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContainerPlansPage;