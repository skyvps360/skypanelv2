import React from 'react';
import { User, Mail, Shield, Calendar, Clock, Server, Activity, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorBoundary } from './ErrorBoundary';
import { UserProfileSkeleton } from './UserManagementSkeleton';
import { cn } from '@/lib/utils';

interface DetailedUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  timezone?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'inactive' | 'suspended';
  organizations: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
    joinedAt?: string;
  }>;
  activity_summary?: {
    vps_count: number;
    container_count: number;
    last_activity?: string;
  };
}

interface UserProfileModalProps {
  user: DetailedUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) {
    return 'Never';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  isLoading = false,
}) => {
  if (!isOpen) {
    return null;
  }

  const statusBadgeVariant = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const roleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400';
      case 'user':
        return 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      default:
        return 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-2xl animate-in fade-in-0 zoom-in-95 duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      )}>
        <ErrorBoundary
          fallback={
            <div className="p-6 text-center animate-in fade-in-0 duration-300">
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load user profile data. Please try closing and reopening the modal.
                </AlertDescription>
              </Alert>
              <Button variant="outline" onClick={onClose} className="transition-all duration-200 hover:scale-105">
                Close
              </Button>
            </div>
          }
        >
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold animate-in slide-in-from-left-2 duration-300">
              <User className="h-5 w-5 text-muted-foreground" />
              User Profile
            </DialogTitle>
          </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          {isLoading || !user ? (
            <div className="animate-in fade-in-0 duration-500">
              <UserProfileSkeleton />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-400">
            {/* Basic Information */}
            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300 delay-100">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                Basic Information
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Name</span>
                  </div>
                  <p className="font-medium text-foreground">{user.name}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                  <p className="font-medium text-foreground">{user.email}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>Role</span>
                  </div>
                  <Badge variant="outline" className={roleBadgeClass(user.role)}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <span>Status</span>
                  </div>
                  <Badge variant={statusBadgeVariant(user.status)}>
                    {user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300 delay-200">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                Account Details
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Created</span>
                  </div>
                  <p className="text-sm text-foreground">{formatDateTime(user.created_at)}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last Updated</span>
                  </div>
                  <p className="text-sm text-foreground">{formatDateTime(user.updated_at)}</p>
                </div>
                {user.phone && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Phone</span>
                    </div>
                    <p className="text-sm text-foreground">{user.phone}</p>
                  </div>
                )}
                {user.timezone && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Timezone</span>
                    </div>
                    <p className="text-sm text-foreground">{user.timezone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Organization Memberships */}
            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300 delay-300">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                Organization Memberships
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </h3>
              {user.organizations && user.organizations.length > 0 ? (
                <div className="space-y-3">
                  {user.organizations.map((org) => (
                    <div
                      key={`${user.id}-${org.organizationId}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg border border-border p-3",
                        "transition-all duration-200 hover:border-primary/50 hover:bg-accent/30",
                        "animate-in slide-in-from-left-2 duration-300"
                      )}
                      style={{ animationDelay: `${300 + (user.organizations.indexOf(org) * 100)}ms` }}
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {org.organizationName || org.organizationSlug || org.organizationId}
                        </p>
                        {org.organizationSlug && org.organizationName !== org.organizationSlug && (
                          <p className="text-sm text-muted-foreground">@{org.organizationSlug}</p>
                        )}
                        {org.joinedAt && (
                          <p className="text-xs text-muted-foreground">
                            Joined {formatRelativeTime(org.joinedAt)}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No organization memberships</p>
              )}
            </div>

            {/* Activity Summary */}
            {user.activity_summary && (
              <div className="space-y-4 animate-in slide-in-from-left-2 duration-300 delay-500">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                  Activity Summary
                  <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className={cn(
                    "rounded-lg border border-border p-4 text-center",
                    "transition-all duration-200 hover:border-primary/50 hover:bg-accent/30 hover:scale-105",
                    "animate-in slide-in-from-bottom-2 duration-300 delay-600"
                  )}>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                      <Server className="h-4 w-4" />
                      <span className="text-sm">VPS Instances</span>
                    </div>
                    <p className="text-2xl font-semibold text-foreground transition-colors duration-200">
                      {user.activity_summary.vps_count}
                    </p>
                  </div>
                  {/* Containers summary removed */}
                  <div className={cn(
                    "rounded-lg border border-border p-4 text-center",
                    "transition-all duration-200 hover:border-primary/50 hover:bg-accent/30 hover:scale-105",
                    "animate-in slide-in-from-bottom-2 duration-300 delay-800"
                  )}>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                      <Activity className="h-4 w-4" />
                      <span className="text-sm">Last Activity</span>
                    </div>
                    <p className="text-sm font-medium text-foreground transition-colors duration-200">
                      {formatRelativeTime(user.activity_summary.last_activity)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
        </ScrollArea>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
};
