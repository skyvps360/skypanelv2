import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Container, ExternalLink, Package } from 'lucide-react';

interface ContainerSubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  created_at: string;
}

interface ContainerProject {
  id: string;
  project_name: string;
  status: string;
  service_count: number;
  created_at: string;
}

interface UserContainerListProps {
  subscription: ContainerSubscription | null;
  projects: ContainerProject[];
}

export const UserContainerList: React.FC<UserContainerListProps> = ({
  subscription,
  projects,
}) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'inactive':
      case 'stopped':
        return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
      case 'deploying':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Container Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Plan</label>
                <p className="text-base font-semibold">{subscription.plan_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={getStatusBadgeClass(subscription.status)}
                  >
                    {subscription.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-base">{formatDate(subscription.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Projects</label>
                <p className="text-base font-semibold">{projects.length}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Container className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Container Subscription</h3>
              <p className="text-muted-foreground">
                This user hasn't subscribed to any container plans yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Container Projects */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            Container Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-6">
              <Container className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Container Projects</h3>
              <p className="text-muted-foreground">
                This user hasn't created any container projects yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        {project.project_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusBadgeClass(project.status)}
                        >
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{project.service_count}</span>
                        <span className="text-muted-foreground ml-1">
                          {project.service_count === 1 ? 'service' : 'services'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(project.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/containers/projects/${project.project_name}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
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