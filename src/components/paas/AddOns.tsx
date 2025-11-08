/**
 * PaaS Add-ons Page
 * Customer-facing page to browse available add-on plans and view subscriptions
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';

interface AddOnPlan {
  id: string;
  name: string;
  serviceType: 'postgresql' | 'redis' | 'mysql' | 'mongodb';
  description?: string;
  specifications: Record<string, any>;
  priceHourly: number;
  priceMonthly: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddOnSubscription {
  id: string;
  name: string;
  status: 'provisioning' | 'active' | 'suspended' | 'error' | 'terminated';
  addonPlanId: string;
  appId?: string;
  createdAt: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
};

export const AddOns: React.FC = () => {
  const { token } = useAuth();
  const [plans, setPlans] = useState<AddOnPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<AddOnSubscription[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPlans = async () => {
    try {
      const resp = await fetch('/api/paas/addons/plans', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) throw new Error('Failed to fetch add-on plans');
      const data = await resp.json();
      setPlans(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching add-on plans:', err);
      toast.error('Failed to fetch add-on plans');
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const resp = await fetch('/api/paas/addons', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) throw new Error('Failed to fetch add-on subscriptions');
      const data = await resp.json();
      const subs = Array.isArray(data.data?.subscriptions) ? data.data.subscriptions : [];
      setSubscriptions(subs);
    } catch (err) {
      console.error('Error fetching add-on subscriptions:', err);
      toast.error('Failed to fetch add-on subscriptions');
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPlans(), fetchSubscriptions()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Add-on Services</h1>
          <p className="text-muted-foreground">Browse managed databases and services</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Available Plans
          </CardTitle>
          <CardDescription>Select a plan to add services to your apps</CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No plans available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{plan.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {SERVICE_TYPE_LABELS[plan.serviceType] || plan.serviceType}
                      </div>
                    </div>
                    <Badge variant={plan.active ? 'default' : 'secondary'}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {plan.description && (
                    <div className="text-sm text-muted-foreground mt-2">{plan.description}</div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <div className="text-lg font-bold">${plan.priceMonthly.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">per month</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">${plan.priceHourly.toFixed(4)}</div>
                      <div className="text-xs text-muted-foreground">per hour</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(plan.specifications || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" disabled className="w-full">
                      Coming soon
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Add-ons</CardTitle>
          <CardDescription>Your active and provisioning services</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No add-ons yet</div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.status}</div>
                  </div>
                  <Badge variant="secondary">{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AddOns;

