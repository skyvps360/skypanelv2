import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Minus, Info, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  max_replicas: number;
  price_per_hour: number;
  price_per_month?: number;
  features?: Record<string, string | boolean>;
  metadata?: Record<string, any>;
}

type PriceFilter = 'all' | 'starter' | 'growth' | 'scale';

const filterPredicate: Record<PriceFilter, (plan: Plan) => boolean> = {
  all: () => true,
  starter: (plan) => plan.price_per_month ? plan.price_per_month < 30 : plan.price_per_hour < 0.05,
  growth: (plan) =>
    plan.price_per_month
      ? plan.price_per_month >= 30 && plan.price_per_month < 80
      : plan.price_per_hour >= 0.05 && plan.price_per_hour < 0.15,
  scale: (plan) =>
    plan.price_per_month
      ? plan.price_per_month >= 80
      : plan.price_per_hour >= 0.15,
};

const priceFilterLabel: Record<PriceFilter, string> = {
  all: 'All plans',
  starter: 'Starter (< $30/mo)',
  growth: 'Growth ($30-80/mo)',
  scale: 'Scale (>= $80/mo)',
};

const formatHourly = (value: number) => `$${value.toFixed(2)}/hr`;
const formatMonthly = (value?: number) => (value ? `$${value.toFixed(2)}/mo` : '—');

const PaaSPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PriceFilter>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<{ plans: Plan[] }>('/paas/plans');
        setPlans(data.plans || []);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  const filteredPlans = useMemo(() => plans.filter(filterPredicate[filter]), [plans, filter]);

  const recommendedPlanId = useMemo(() => {
    const explicit = plans.find((plan) => plan.metadata?.recommended === true);
    if (explicit) return explicit.id;
    if (plans.length === 0) return null;
    const sorted = [...plans].sort((a, b) => (a.price_per_month || 0) - (b.price_per_month || 0));
    return sorted[Math.floor(sorted.length / 2)].id;
  }, [plans]);

  const featureKeys = useMemo(() => {
    const keys = new Set<string>();
    plans.forEach((plan) => {
      if (plan.features) {
        Object.keys(plan.features).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [plans]);

  const handleSelectPlan = (plan: Plan) => {
    navigate(`/paas/new?plan=${plan.id}`);
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase text-muted-foreground tracking-wide">Plans</p>
          <h1 className="text-3xl font-bold mt-1">Compare PaaS Plans</h1>
          <p className="text-muted-foreground mt-2">
            Select a plan that matches your workload and wallet. Pricing is always transparent.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={filter} onValueChange={(value) => setFilter(value as PriceFilter)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by price" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(priceFilterLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/paas')}>
            Back to Apps
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading plans...</CardContent>
        </Card>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No plans match the selected filter. Try a different range.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlans.map((plan) => {
            const isRecommended = plan.id === recommendedPlanId;
            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col justify-between border-2',
                  isRecommended ? 'border-primary shadow-lg' : 'border-border'
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription className="capitalize">{plan.slug.replace(/-/g, ' ')}</CardDescription>
                    </div>
                    {isRecommended && (
                      <Badge className="gap-1">
                        <Shield className="h-3.5 w-3.5" />
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold">{formatMonthly(plan.price_per_month)}</p>
                    <p className="text-sm text-muted-foreground">{formatHourly(plan.price_per_hour)}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li>{plan.cpu_cores} vCPU · {plan.ram_mb} MB RAM</li>
                    <li>{plan.disk_gb} GB SSD · up to {plan.max_replicas} replicas</li>
                    {plan.features &&
                      Object.entries(plan.features).slice(0, 3).map(([key, value]) => (
                        <li key={key} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          {typeof value === 'string' && (
                            <span className="text-muted-foreground">({value})</span>
                          )}
                        </li>
                      ))}
                  </ul>
                  <Button onClick={() => handleSelectPlan(plan)}>Select Plan</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
            <CardDescription>Spot the differences between every plan.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead>Disk</TableHead>
                  <TableHead>Replicas</TableHead>
                  <TableHead>Hourly</TableHead>
                  <TableHead>Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.cpu_cores} vCPU</TableCell>
                    <TableCell>{plan.ram_mb} MB</TableCell>
                    <TableCell>{plan.disk_gb} GB</TableCell>
                    <TableCell>{plan.max_replicas}</TableCell>
                    <TableCell>{formatHourly(plan.price_per_hour)}</TableCell>
                    <TableCell>{formatMonthly(plan.price_per_month)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {featureKeys.length > 0 && (
        <TooltipProvider delayDuration={0}>
          <Card>
            <CardHeader>
              <CardTitle>Feature Matrix</CardTitle>
              <CardDescription>Understand which plan unlocks each feature.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    {plans.map((plan) => (
                      <TableHead key={plan.id}>{plan.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureKeys.map((feature) => (
                    <TableRow key={feature}>
                      <TableCell className="capitalize">
                        <div className="flex items-center gap-1">
                          {feature.replace(/_/g, ' ')}
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {feature.replace(/_/g, ' ')} availability
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      {plans.map((plan) => {
                        const value = plan.features?.[feature];
                        const enabled = typeof value === 'boolean' ? value : Boolean(value);
                        return (
                          <TableCell key={`${plan.id}-${feature}`} className="text-center">
                            {enabled ? (
                              <Check className="h-4 w-4 mx-auto text-emerald-500" />
                            ) : (
                              <Minus className="h-4 w-4 mx-auto text-muted-foreground" />
                            )}
                            {typeof value === 'string' && (
                              <p className="text-[10px] text-muted-foreground">{value}</p>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TooltipProvider>
      )}
    </div>
  );
};

export default PaaSPlans;
