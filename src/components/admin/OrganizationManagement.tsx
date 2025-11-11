/**
 * Organization Management Component
 * Unified interface for managing organizations and their members
 */
import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  UserPlus,
  Calendar,
  AlertTriangle,
  DollarSign,
  Cpu,
  PauseCircle,
  PlayCircle,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Import modal components
import { OrganizationCreateModal } from './OrganizationCreateModal';
import { OrganizationEditModal } from './OrganizationEditModal';
import { OrganizationDeleteDialog } from './OrganizationDeleteDialog';
import { MemberAddModal } from './MemberAddModal';
import { MemberEditModal } from './MemberEditModal';
import { MemberRemoveDialog } from './MemberRemoveDialog';

// Use shared API client with default base `/api`

interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'admin' | 'member';
  userRole: string; // admin or user
  joinedAt: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  members: OrganizationMember[];
  memberCount: number;
  paasAppCount?: number;
  paasCost30d?: number;
  paasCpuHours30d?: number;
  paasRamMbHours30d?: number;
  paasLastUsageAt?: string | null;
  paasSuspended?: boolean;
  paasSuspendReason?: string | null;
  paasSuspendedAt?: string | null;
}

interface OrganizationManagementProps {
  onUserAction?: (userId: string, action: string) => void;
}

export const OrganizationManagement: React.FC<OrganizationManagementProps> = ({
  onUserAction,
}) => {
  const { token } = useAuth();
  const { startImpersonation, isStarting } = useImpersonation();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberAddModalOpen, setMemberAddModalOpen] = useState(false);
  const [memberEditModalOpen, setMemberEditModalOpen] = useState(false);
  const [memberRemoveDialogOpen, setMemberRemoveDialogOpen] = useState(false);

  // Selected data for modals
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [selectedOrgForMember, setSelectedOrgForMember] = useState<string>('');

  // Error and loading states
  const [error, setError] = useState<string>('');
  const [operationLoading, setOperationLoading] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get<{ organizations: Organization[] }>(
        '/admin/organizations'
      );
      setOrganizations(data.organizations || []);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load organizations';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const toggleOrganization = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.members.some(
      (member) =>
        member.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (value?: number | null) => {
    const amount = Number(value ?? 0);
    return `$${amount.toFixed(2)}`;
  };

  const formatNumber = (value?: number | null, digits = 2) => {
    const amount = Number(value ?? 0);
    return amount.toFixed(digits);
  };

  // Modal handlers
  const handleCreateOrganization = () => {
    setCreateModalOpen(true);
  };

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrganization(org);
    setEditModalOpen(true);
  };

  const handleDeleteOrganization = (org: Organization) => {
    setSelectedOrganization(org);
    setDeleteDialogOpen(true);
  };

  const handleAddMember = (orgId: string) => {
    setSelectedOrgForMember(orgId);
    setMemberAddModalOpen(true);
  };

  const handleEditMember = (member: OrganizationMember, orgId: string) => {
    setSelectedMember(member);
    setSelectedOrgForMember(orgId);
    setMemberEditModalOpen(true);
  };

  const handleRemoveMember = (member: OrganizationMember, orgId: string) => {
    setSelectedMember(member);
    setSelectedOrgForMember(orgId);
    setMemberRemoveDialogOpen(true);
  };

  const handleSuspendPaas = async (org: Organization) => {
    if (!token) return;
    const reason =
      window.prompt('Enter a reason for suspending PaaS (optional)', org.paasSuspendReason || '') ?? '';
    setOperationLoading(true);
    try {
      await apiClient.post(`/admin/organizations/${org.id}/paas/suspend`, { reason });
      toast.success(`Suspended PaaS for ${org.name}`);
      await fetchOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to suspend PaaS');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleResumePaas = async (org: Organization) => {
    if (!token) return;
    setOperationLoading(true);
    try {
      await apiClient.post(`/admin/organizations/${org.id}/paas/resume`);
      toast.success(`Resumed PaaS for ${org.name}`);
      await fetchOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume PaaS');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleModalSuccess = () => {
    // Clear any previous errors
    setError('');
    // Refresh the organizations list
    fetchOrganizations();
    // Clear selected data
    setSelectedOrganization(null);
    setSelectedMember(null);
    setSelectedOrgForMember('');
  };

  const handleRefresh = async () => {
    setError('');
    await fetchOrganizations();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Organization & Member Management
          </CardTitle>
          <CardDescription>
            Manage organizations and their members in a unified interface
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={loading || operationLoading}
          >
            <RefreshCw className={cn('h-4 w-4', (loading || operationLoading) && 'animate-spin')} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button 
            size="sm" 
            className="gap-2" 
            onClick={handleCreateOrganization}
            disabled={loading || operationLoading}
          >
            <Plus className="h-4 w-4" />
            New Organization
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="org-search" className="sr-only">
              Search organizations and members
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="org-search"
                placeholder="Search organizations or members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchTerm && (
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredOrganizations.length} organization
                {filteredOrganizations.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleRefresh}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Organizations List */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
              <p>Loading organizations...</p>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Building2 className="mx-auto h-8 w-8 opacity-50 mb-2" />
              <p>No organizations found</p>
              {searchTerm && (
                <p className="text-xs mt-1">Try adjusting your search</p>
              )}
            </div>
          ) : (
            filteredOrganizations.map((org) => (
              <Collapsible
                key={org.id}
                open={expandedOrgs.has(org.id)}
                onOpenChange={() => toggleOrganization(org.id)}
              >
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                    <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                      {expandedOrgs.has(org.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{org.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                            </Badge>
                            {org.paasAppCount !== undefined && org.paasAppCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {org.paasAppCount} PaaS app{org.paasAppCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Owner: {org.ownerName} ({org.ownerEmail})
                          </p>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-muted-foreground mr-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(org.createdAt)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditOrganization(org);
                        }}
                        disabled={loading || operationLoading}
                        title="Edit organization"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrganization(org);
                        }}
                        disabled={loading || operationLoading}
                        title="Delete organization"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="border-t p-4 bg-accent/20 space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              PaaS Billing (30d)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {formatCurrency(org.paasCost30d)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Last usage:{' '}
                              {org.paasLastUsageAt ? formatDate(org.paasLastUsageAt) : 'No data'}
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-muted-foreground" />
                              Resource Usage (30d)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">CPU hours</span>
                              <span className="font-semibold">
                                {formatNumber(org.paasCpuHours30d, 2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">RAM GB hours</span>
                              <span className="font-semibold">
                                {formatNumber((org.paasRamMbHours30d ?? 0) / 1024, 2)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-medium">PaaS Status</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {org.paasSuspended
                                  ? org.paasSuspendReason || 'Suspended by administrator'
                                  : 'PaaS access is active'}
                              </p>
                            </div>
                            <Badge
                              variant={org.paasSuspended ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {org.paasSuspended ? 'Suspended' : 'Active'}
                            </Badge>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                              {org.paasSuspendedAt
                                ? `Since ${formatDate(org.paasSuspendedAt)}`
                                : 'Applications can deploy normally'}
                            </div>
                            {org.paasSuspended ? (
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => handleResumePaas(org)}
                                disabled={loading || operationLoading}
                              >
                                <PlayCircle className="h-4 w-4" />
                                Resume PaaS
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-2"
                                onClick={() => handleSuspendPaas(org)}
                                disabled={loading || operationLoading}
                              >
                                <PauseCircle className="h-4 w-4" />
                                Suspend PaaS
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Members ({org.memberCount})
                        </h4>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2"
                          onClick={() => handleAddMember(org.id)}
                          disabled={loading || operationLoading}
                        >
                          <UserPlus className="h-4 w-4" />
                          Add Member
                        </Button>
                      </div>
                      
                      {org.members.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No members in this organization
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>User Role</TableHead>
                              <TableHead>Org Role</TableHead>
                              <TableHead>Joined</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {org.members.map((member) => (
                          <TableRow key={`${org.id}-${member.userId}`}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{member.userName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {member.userEmail}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      member.userRole === 'admin' &&
                                        'border-red-400/30 bg-red-400/10 text-red-400'
                                    )}
                                  >
                                    {member.userRole.charAt(0).toUpperCase() +
                                      member.userRole.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline"
                                    className={cn(
                                      member.role === 'owner' && 'border-yellow-400/30 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400',
                                      member.role === 'admin' && 'border-blue-400/30 bg-blue-400/10 text-blue-600 dark:text-blue-400',
                                      member.role === 'member' && 'border-gray-400/30 bg-gray-400/10 text-gray-600 dark:text-gray-400'
                                    )}
                                  >
                                    {member.role.charAt(0).toUpperCase() +
                                      member.role.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatDate(member.joinedAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => onUserAction?.(member.userId, 'view')}
                                      title="Open user details"
                                      disabled={loading || operationLoading}
                                    >
                                      <User className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditMember(member, org.id)}
                                      title="Edit member role"
                                      disabled={loading || operationLoading}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        try {
                                          await startImpersonation(member.userId);
                                        } catch (err: any) {
                                          // Confirmation required for admin-to-admin impersonation is handled by context
                                          toast.error(err?.message || 'Failed to impersonate user');
                                        }
                                      }}
                                      title="Impersonate user"
                                      disabled={loading || operationLoading || isStarting}
                                    >
                                      <Users className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRemoveMember(member, org.id)}
                                      title={member.role === 'owner' ? 'Cannot remove owner' : 'Remove member'}
                                      disabled={loading || operationLoading || member.role === 'owner'}
                                      className={cn(
                                        member.role === 'owner' && 'opacity-50 cursor-not-allowed'
                                      )}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </div>
      </CardContent>

      {/* Modals and Dialogs */}
      <OrganizationCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleModalSuccess}
      />

      <OrganizationEditModal
        organization={selectedOrganization}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleModalSuccess}
      />

      <OrganizationDeleteDialog
        organization={selectedOrganization}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleModalSuccess}
        availableOrganizations={organizations}
      />

      <MemberAddModal
        organizationId={selectedOrgForMember}
        organizationName={organizations.find(org => org.id === selectedOrgForMember)?.name}
        open={memberAddModalOpen}
        onOpenChange={setMemberAddModalOpen}
        onSuccess={handleModalSuccess}
      />

      <MemberEditModal
        member={selectedMember}
        organizationId={selectedOrgForMember}
        organizationName={organizations.find(org => org.id === selectedOrgForMember)?.name}
        open={memberEditModalOpen}
        onOpenChange={setMemberEditModalOpen}
        onSuccess={handleModalSuccess}
      />

      <MemberRemoveDialog
        member={selectedMember}
        organizationId={selectedOrgForMember}
        organizationName={organizations.find(org => org.id === selectedOrgForMember)?.name}
        open={memberRemoveDialogOpen}
        onOpenChange={setMemberRemoveDialogOpen}
        onSuccess={handleModalSuccess}
      />
    </Card>
  );
};
