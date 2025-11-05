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
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Containers
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="h-10 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
              Containers
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Container Plans
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Choose a container plan to start deploying and managing containerized applications with Dokploy.
          </p>
          {currentSubscription && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/containers')}>
                <Container className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Container className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <DollarSign className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrency(walletBalance?.balance || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Available funds</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Available Plans</p>
                <p className="text-3xl font-bold tracking-tight">{plans.length}</p>
                <p className="text-xs text-muted-foreground">Plans to choose from</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Container className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                <p className="text-3xl font-bold tracking-tight">
                  {currentSubscription ? (
                    formatCurrency(currentSubscription.plan?.priceMonthly || 0)
                  ) : (
                    '—'
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentSubscription ? 'Per month' : 'Not subscribed'}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Container className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Subscription */}
      {currentSubscription && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Subscription</CardTitle>
                <CardDescription className="mt-1">
                  {currentSubscription.plan?.name} • Next billing on{' '}
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </CardDescription>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription className="mt-1">
                Select a plan that fits your containerized application needs
              </CardDescription>
            </div>
            {!currentSubscription && walletBalance && walletBalance.balance < (plans[0]?.priceMonthly || 0) && (
              <Button variant="outline" onClick={() => navigate('/billing')}>
                Add Funds
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Container className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No Container Plans Available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Container plans are not currently available. Please check back later.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isCurrentPlan = currentSubscription?.planId === plan.id;
                const canAfford = walletBalance && walletBalance.balance >= plan.priceMonthly;
                const isSubscribing = subscribing === plan.id;

                return (
                  <Card 
                    key={plan.id} 
                    className={`relative transition-all hover:shadow-lg ${
                      isCurrentPlan ? 'border-primary/50 shadow-md' : ''
                    }`}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge variant="default" className="shadow-sm">
                          <Check className="h-3 w-3 mr-1" />
                          Current Plan
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <div className="pt-4 border-t border-border/50">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold tracking-tight">
                            {formatCurrency(plan.priceMonthly)}
                          </span>
                          <span className="text-sm text-muted-foreground">/month</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pb-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <div className="rounded-md bg-primary/10 p-2">
                            <Cpu className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {formatResource(plan.maxCpuCores, 'vCPU Core')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <div className="rounded-md bg-primary/10 p-2">
                            <MemoryStick className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {plan.maxMemoryGb} GB Memory
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <div className="rounded-md bg-primary/10 p-2">
                            <HardDrive className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {plan.maxStorageGb} GB Storage
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <div className="rounded-md bg-primary/10 p-2">
                            <Container className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {formatResource(plan.maxContainers, 'Container')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <div className="rounded-md bg-primary/10 p-2">
                            <Container className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {formatResource(plan.maxProjects, 'Project')}
                          </span>
                        </div>
                      </div>

                      {!canAfford && !isCurrentPlan && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Insufficient balance. Need {formatCurrency(plan.priceMonthly - (walletBalance?.balance || 0))} more.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>

                    <CardFooter className="pt-0">
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
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Container className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Getting Started with Containers</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Once you subscribe to a container plan, you'll be able to:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Create projects to organize your containers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Deploy applications from Docker images or templates
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Manage database services (PostgreSQL, MySQL, Redis, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Monitor resource usage and container logs
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Scale your applications within your plan limits
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContainerPlansPage;