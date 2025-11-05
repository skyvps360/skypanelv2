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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
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
}

interface OrganizationManagementProps {
  onUserAction?: (userId: string, action: string) => void;
}

export const OrganizationManagement: React.FC<OrganizationManagementProps> = ({
  onUserAction,
}) => {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const fetchOrganizations = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/admin/organizations`, {
        headers: authHeader,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load organizations');
      }
      
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load organizations');
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
            onClick={fetchOrganizations}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" className="gap-2">
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
                          toast.info('Edit organization - coming soon');
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info('Delete organization - coming soon');
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="border-t p-4 bg-accent/20">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Members ({org.memberCount})
                        </h4>
                        <Button size="sm" variant="outline" className="gap-2">
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
                                  <Badge variant="secondary">
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
                                      onClick={() => {
                                        if (onUserAction) {
                                          onUserAction(member.userId, 'view');
                                        }
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        toast.info('Remove member - coming soon');
                                      }}
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
    </Card>
  );
};
