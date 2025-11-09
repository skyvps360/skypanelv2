/**
 * Deployments List Component
 * Shows deployment history with rollback capability
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, RotateCcw, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Deployment {
  id: string;
  version: number;
  git_commit?: string;
  status: string;
  build_started_at?: string;
  build_completed_at?: string;
  deployed_at?: string;
  error_message?: string;
}

interface DeploymentsListProps {
  appId: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  deployed: <CheckCircle className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  build_failed: <XCircle className="w-4 h-4 text-red-500" />,
  building: <Clock className="w-4 h-4 text-blue-500 animate-spin" />,
  deploying: <Clock className="w-4 h-4 text-yellow-500 animate-spin" />,
};

export const DeploymentsList: React.FC<DeploymentsListProps> = ({ appId }) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeployments();
  }, [appId]);

  const loadDeployments = async () => {
    try {
      const data = await apiClient.get(`/paas/apps/${appId}/deployments`);
      setDeployments(data.deployments || []);
    } catch (error) {
      toast.error('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (!confirm(`Rollback to version ${version}?`)) return;
    try {
      await apiClient.post(`/paas/apps/${appId}/rollback`, { version });
      toast.success(`Rolling back to version ${version}`);
      loadDeployments();
    } catch (error: any) {
      toast.error(error.message || 'Rollback failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : deployments.length === 0 ? (
          <p className="text-muted-foreground">No deployments yet</p>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {statusIcons[deployment.status]}
                  <div>
                    <div className="font-semibold">Version {deployment.version}</div>
                    <div className="text-sm text-muted-foreground">
                      {deployment.git_commit?.substring(0, 7)}
                      {' • '}
                      {deployment.deployed_at
                        ? formatDistanceToNow(new Date(deployment.deployed_at), { addSuffix: true })
                        : 'Not deployed'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {deployment.status === 'deployed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRollback(deployment.version)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
