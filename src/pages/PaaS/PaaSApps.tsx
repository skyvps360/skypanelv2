/**
 * PaaS Applications List Page
 * Main page for viewing and managing PaaS applications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Rocket, Server, Activity, AlertCircle, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

interface PaasApp {
  id: string;
  name: string;
  slug: string;
  status: 'inactive' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'suspended';
  subdomain: string;
  replicas: number;
  plan_name: string;
  cpu_cores: number;
  ram_mb: number;
  max_replicas?: number;
  created_at: string;
  updated_at: string;
}

const statusColors = {
  inactive: 'bg-gray-500',
  building: 'bg-blue-500',
  deploying: 'bg-yellow-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-500',
  failed: 'bg-red-500',
  suspended: 'bg-orange-500',
};

const statusLabels = {
  inactive: 'Inactive',
  building: 'Building',
  deploying: 'Deploying',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  suspended: 'Suspended',
};

const PaaSApps: React.FC = () => {
  const [apps, setApps] = useState<PaasApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultDomain, setDefaultDomain] = useState('apps.example.com');
  const { token } = useAuth();
  const navigate = useNavigate();

  // Load default domain from settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiClient.get('/admin/paas/settings');
        const domainSetting = data.settings?.find((s: any) => s.key === 'default_domain');
        if (domainSetting?.value_encrypted) {
          setDefaultDomain(domainSetting.value_encrypted);
        }
      } catch (error) {
        console.error('Failed to load domain settings:', error);
        // Continue with default domain
      }
    };
    loadSettings();
  }, []);

  const loadApps = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient.get('/paas/apps');
      setApps(data.apps || []);
    } catch (error: any) {
      toast.error('Failed to load applications');
      console.error('Error loading apps:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const getAppUrl = (subdomain: string) => {
    return `https://${subdomain}.${defaultDomain}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Deploy and manage your applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/paas/marketplace')}>
            <Package className="w-4 h-4 mr-2" />
            Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate('/paas/plans')}>
            Compare Plans
          </Button>
          <Button onClick={() => navigate('/paas/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        </div>
      </div>

      {apps.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Rocket className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No applications yet</h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first application
            </p>
            <Button onClick={() => navigate('/paas/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First App
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card
              key={app.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/paas/${app.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{app.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{app.slug}</p>
                  </div>
                  <Badge className={statusColors[app.status]}>
                    {statusLabels[app.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Plan Info */}
                  <div className="flex items-center text-sm">
                    <Server className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span>
                      {app.plan_name} - {app.cpu_cores} CPU, {app.ram_mb}MB RAM
                    </span>
                  </div>

                  {/* Replicas */}
                  <div className="flex items-center text-sm">
                    <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span>{app.replicas} replica{app.replicas !== 1 ? 's' : ''}</span>
                  </div>

                  {/* URL */}
                  {app.status === 'running' && (
                    <div className="flex items-center text-sm">
                      <ExternalLink className="w-4 h-4 mr-2 text-muted-foreground" />
                      <a
                        href={getAppUrl(app.subdomain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {app.subdomain}.apps.example.com
                      </a>
                    </div>
                  )}

                  {/* Error state */}
                  {app.status === 'failed' && (
                    <div className="flex items-center text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      <span>Deployment failed - check logs</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/paas/${app.id}`);
                    }}
                  >
                    Manage App
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaaSApps;
