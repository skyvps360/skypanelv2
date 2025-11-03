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
import { Server, ExternalLink, Terminal } from 'lucide-react';

interface VPSInstance {
  id: string;
  label: string;
  status: string;
  ip_address: string | null;
  plan_name: string | null;
  provider_name: string | null;
  region_label: string | null;
  created_at: string;
}

interface UserVPSListProps {
  vpsInstances: VPSInstance[];
}

export const UserVPSList: React.FC<UserVPSListProps> = ({ vpsInstances }) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'stopped':
        return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
      case 'provisioning':
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

  if (vpsInstances.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No VPS Instances</h3>
          <p className="text-muted-foreground text-center">
            This user hasn't created any VPS instances yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          VPS Instances ({vpsInstances.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vpsInstances.map((vps) => (
                <TableRow key={vps.id}>
                  <TableCell className="font-medium">
                    {vps.label}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusBadgeClass(vps.status)}
                    >
                      {vps.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {vps.ip_address || '—'}
                  </TableCell>
                  <TableCell>
                    {vps.plan_name || '—'}
                  </TableCell>
                  <TableCell>
                    {vps.provider_name || '—'}
                  </TableCell>
                  <TableCell>
                    {vps.region_label || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(vps.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to={`/vps/${vps.id}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      {vps.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/vps/${vps.id}/ssh`}>
                            <Terminal className="h-4 w-4 mr-1" />
                            SSH
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};