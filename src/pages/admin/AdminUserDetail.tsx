import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  UserCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { PageHeader } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserProfileCard,
  UserVPSList,
  UserBillingInfo,
  UserEditModal
} from '@/components/admin';

interface AdminUserDetailResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    timezone?: string;
    preferences?: Record<string, any>;
    created_at: string;
    updated_at: string;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: string;
      joinedAt: string;
    }>;
  };
  vpsInstances: Array<{
    id: string;
    label: string;
    status: string;
    ip_address: string | null;
    plan_name: string | null;
    provider_name: string | null;
    region_label: string | null;
    created_at: string;
  }>;
  billing: {
    wallet_balance: number;
    monthly_spend: number;
    total_spend: number;
    total_payments: number;
    last_payment_date: string | null;
    last_payment_amount: number | null;
    payment_history: Array<{
      id: string;
      amount: number;
      status: string;
      created_at: string;
    }>;
  };
  activity: Array<{
    id: string;
    event_type: string;
    message: string;
    created_at: string;
  }>;
  supportTickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
    updated_at: string;
    organization_name: string;
  }>;
  statistics: {
    totalVPS: number;
    activeVPS: number;
    totalSpend: number;
    monthlySpend: number;
    totalOrganizations: number;
    totalSupportTickets: number;
    openSupportTickets: number;
  };
}

const AdminUserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { startImpersonation } = useImpersonation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showImpersonationDialog, setShowImpersonationDialog] = useState(false);
  const [impersonationTarget, setImpersonationTarget] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Fetch user detail data with retry mechanism
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'user-detail', id],
    queryFn: async (): Promise<AdminUserDetailResponse> => {
      if (!id) {
        throw new Error('User ID is required');
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error('Invalid user ID format');
      }

      const response = await fetch(`/api/admin/users/${id}/detail`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        } else if (response.status === 403) {
          throw new Error('Access denied');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again');
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch user details`);
      }

      const result = await response.json();
      
      // Validate response structure
      if (!result.user || !result.user.id) {
        throw new Error('Invalid response format');
      }

      return result;
    },
    enabled: !!id && !!token,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 403 errors
      if (error?.message?.includes('not found') || error?.message?.includes('Access denied')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this user');
        } else if (response.status === 404) {
          throw new Error('User not found');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to delete user`);
      }

      return response.json().catch(() => ({}));
    },
    onSuccess: (data) => {
      const userName = user?.name || 'User';
      toast.success(`${userName} has been successfully deleted`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      
      // Navigate back to user management with a slight delay to show the success message
      setTimeout(() => {
        navigate('/admin#user-management');
      }, 1000);
    },
    onError: (error: any) => {
      console.error('User deletion error:', error);
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const handleImpersonate = async () => {
    if (!data?.user) return;

    try {
      await startImpersonation(data.user.id);
    } catch (error: any) {
      if (error.requiresConfirmation && error.targetUser) {
        // Show confirmation dialog for admin-to-admin impersonation
        setImpersonationTarget(error.targetUser);
        setShowImpersonationDialog(true);
      } else {
        toast.error(error.message || 'Failed to start impersonation');
      }
    }
  };

  const handleConfirmImpersonation = async () => {
    if (!impersonationTarget) return;

    try {
      await startImpersonation(impersonationTarget.id, true);
      setShowImpersonationDialog(false);
      setImpersonationTarget(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start impersonation');
      setShowImpersonationDialog(false);
      setImpersonationTarget(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!data?.user || deleteConfirmEmail !== (data.user.email || '')) {
      toast.error('Please type the user email exactly as shown to confirm deletion');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserMutation.mutateAsync();
      setShowDeleteDialog(false);
      setDeleteConfirmEmail('');
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    setShowEditModal(false);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    refetch();
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';
    
    const message = error.message || error.toString();
    
    if (message.includes('not found')) {
      return 'User not found';
    } else if (message.includes('Access denied')) {
      return 'You do not have permission to view this user';
    } else if (message.includes('Invalid user ID format')) {
      return 'Invalid user ID format';
    } else if (message.includes('Server error')) {
      return 'Server error - please try again later';
    } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return 'Network error - please check your connection';
    }
    
    return message;
  };

  if (isLoading || isRefetching) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 text-sm">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <span>/</span>
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <span>/</span>
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>

        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">
              {isRefetching ? 'Refreshing user data...' : 'Loading user details...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = getErrorMessage(error);
    const isNetworkError = errorMessage.includes('Network error') || errorMessage.includes('Server error');
    const isNotFound = errorMessage.includes('not found');
    const isAccessDenied = errorMessage.includes('permission');

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin#user-management" className="hover:text-foreground">
            Users
          </Link>
          <span>/</span>
          <span className="text-foreground">Error</span>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
          {isNetworkError ? (
            <WifiOff className="h-12 w-12 text-muted-foreground" />
          ) : (
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          )}
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {isNotFound ? 'User Not Found' : 
               isAccessDenied ? 'Access Denied' : 
               isNetworkError ? 'Connection Error' : 'Error Loading User'}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {errorMessage}
            </p>
          </div>

          {/* Error-specific alerts */}
          {isNetworkError && (
            <Alert className="max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please check your internet connection and try again.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin#user-management">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Users
              </Link>
            </Button>
            
            {isNetworkError && (
              <Button onClick={handleRetry} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { user, vpsInstances, billing, activity, supportTickets, statistics } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">
          Admin
        </Link>
        <span>/</span>
        <Link to="/admin#user-management" className="hover:text-foreground">
          Users
        </Link>
        <span>/</span>
        <span className="text-foreground">{user?.name || 'Unknown User'}</span>
      </div>

      <PageHeader
        title={user?.name || 'Unknown User'}
        description={`User account details and management for ${user?.email || 'unknown email'}`}
        badge={{
          text: user?.role === 'admin' ? 'Administrator' : 'User',
          variant: user?.role === 'admin' ? 'default' : 'secondary',
        }}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={handleImpersonate}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Impersonate
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      {/* User Profile Card */}
      <UserProfileCard user={user || {
        id: '',
        email: 'Unknown',
        name: 'Unknown User',
        role: 'user',
        created_at: '',
        updated_at: '',
        organizations: []
      }} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vps">VPS ({vpsInstances?.length || 0})</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* VPS Stats */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">VPS Instances</h3>
              <p className="text-3xl font-bold">{statistics?.totalVPS || vpsInstances?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                {statistics?.activeVPS || vpsInstances?.filter(v => v.status === 'running').length || 0} running
              </p>
            </div>
            
            {/* Wallet Balance */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Wallet Balance</h3>
              <p className="text-3xl font-bold">
                ${(billing?.wallet_balance || 0).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                ${(billing?.monthly_spend || 0).toFixed(2)} this month
              </p>
            </div>

            {/* Organizations */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Organizations</h3>
              <p className="text-3xl font-bold">
                {statistics?.totalOrganizations || user?.organizations?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                {user?.organizations?.filter(org => org.role === 'owner').length || 0} owned
              </p>
            </div>

            {/* Support Tickets */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Support Tickets</h3>
              <p className="text-3xl font-bold">
                {statistics?.totalSupportTickets || supportTickets?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                {statistics?.openSupportTickets || supportTickets?.filter(t => t.status === 'open').length || 0} open
              </p>
            </div>
          </div>

          {/* User Information */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">User Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{user?.email || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                <p className="text-sm">{user?.name || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                <p className="text-sm">
                  <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                    {user?.role === 'admin' ? 'Administrator' : 'User'}
                  </Badge>
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <p className="text-sm">{user?.phone || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Timezone</Label>
                <p className="text-sm">{user?.timezone || 'Not set'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                <p className="text-sm">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Organizations */}
          {user?.organizations && user.organizations.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Organizations</h3>
              <div className="space-y-3">
                {user.organizations.map((org, index) => (
                  <div key={org.organizationId || index} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{org.organizationName || 'Unnamed Organization'}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {org.joinedAt ? new Date(org.joinedAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {org.role || 'member'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {activity && activity.length > 0 ? (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {activity.slice(0, 5).map((item, index) => (
                  <div key={item.id || index} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.message || 'No message'}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown time'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs ml-2">
                      {item.event_type || 'unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">No recent activity found.</p>
            </div>
          )}

          {/* Support Tickets */}
          {supportTickets && supportTickets.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Support Tickets</h3>
              <div className="space-y-3">
                {supportTickets.slice(0, 5).map((ticket, index) => (
                  <div key={ticket.id || index} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ticket.subject || 'No subject'}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.organization_name || 'Unknown organization'} • {' '}
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <Badge 
                        variant={ticket.status === 'open' ? 'destructive' : 
                                ticket.status === 'resolved' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {ticket.status || 'unknown'}
                      </Badge>
                      {ticket.priority && (
                        <Badge variant="outline" className="text-xs">
                          {ticket.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vps">
          <UserVPSList vpsInstances={vpsInstances || []} />
        </TabsContent>

        <TabsContent value="billing">
          <UserBillingInfo billing={billing || {
            wallet_balance: 0,
            monthly_spend: 0,
            total_spend: 0,
            total_payments: 0,
            last_payment_date: null,
            last_payment_amount: null,
            payment_history: []
          }} />
        </TabsContent>
      </Tabs>

      {/* User Edit Modal */}
      <UserEditModal
        user={user}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Impersonation Confirmation Dialog */}
      <AlertDialog open={showImpersonationDialog} onOpenChange={setShowImpersonationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Admin Impersonation</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to impersonate <strong>{impersonationTarget?.name}</strong>, who is also an administrator.
              </p>
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">Target User Details:</p>
                <p className="text-sm">Name: {impersonationTarget?.name}</p>
                <p className="text-sm">Email: {impersonationTarget?.email}</p>
                <p className="text-sm">Role: {impersonationTarget?.role}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This action will be logged for security purposes. You will have full access to their account and data.
              </p>
              <p className="font-semibold text-amber-600">
                Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowImpersonationDialog(false);
              setImpersonationTarget(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImpersonation}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Confirm Impersonation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This will permanently delete <strong>{user?.name || 'this user'}</strong> and all associated data.
              </p>
              
              {/* Resource Impact Summary */}
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-3">
                <h4 className="font-semibold text-destructive">Resources to be deleted:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">VPS Instances</p>
                    <p className="text-muted-foreground">{vpsInstances?.length || 0} instances</p>
                    {vpsInstances && vpsInstances.length > 0 && (
                      <p className="text-xs text-destructive">
                        {vpsInstances.filter(v => v.status === 'running').length} currently running
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Organizations</p>
                    <p className="text-muted-foreground">{user?.organizations?.length || 0} memberships</p>
                    {user?.organizations && user.organizations.length > 0 && (
                      <p className="text-xs text-destructive">
                        {user.organizations.filter(org => org.role === 'owner').length} owned
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Wallet Balance</p>
                    <p className="text-muted-foreground">${(billing?.wallet_balance || 0).toFixed(2)}</p>
                    {billing && billing.wallet_balance > 0 && (
                      <p className="text-xs text-destructive">Funds will be lost</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Support Tickets</p>
                    <p className="text-muted-foreground">{supportTickets?.length || 0} tickets</p>
                    {supportTickets && supportTickets.filter(t => t.status === 'open').length > 0 && (
                      <p className="text-xs text-destructive">
                        {supportTickets.filter(t => t.status === 'open').length} open tickets
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Special warnings */}
              {user?.role === 'admin' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This user is an administrator. Deleting this account will remove their admin privileges and access to the admin panel.
                  </AlertDescription>
                </Alert>
              )}

              {user?.organizations && user.organizations.some(org => org.role === 'owner') && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This user owns {user.organizations.filter(org => org.role === 'owner').length} organization(s). Deleting this account may affect other users in those organizations.
                  </AlertDescription>
                </Alert>
              )}

              {vpsInstances && vpsInstances.filter(v => v.status === 'running').length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This user has {vpsInstances.filter(v => v.status === 'running').length} running VPS instance(s) that will be permanently destroyed.
                  </AlertDescription>
                </Alert>
              )}

              <p className="font-semibold text-destructive">
                This action cannot be undone. All data will be permanently lost.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-sm font-medium">
                To confirm deletion, type the user's email address:
              </Label>
              <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {user?.email || 'user email'}
              </p>
              <Input
                id="confirm-email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder="Type the email address above"
                className="font-mono"
              />
            </div>
            
            {deleteConfirmEmail && deleteConfirmEmail !== (user?.email || '') && (
              <p className="text-sm text-destructive">
                Email address does not match. Please type the exact email address.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteConfirmEmail !== (user?.email || '') || isDeleting || deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting || deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting User...
                </>
              ) : (
                'Delete User Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDetail;