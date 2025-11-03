import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  UserCheck,
  AlertTriangle,
  Loader2
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
import {
  UserProfileCard,
  UserVPSList,
  UserContainerList,
  UserBillingInfo,
  UserEditModal
} from '@/components/admin';

interface AdminUserDetailResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: string;
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
  containerSubscription: {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    created_at: string;
  } | null;
  containerProjects: Array<{
    id: string;
    project_name: string;
    status: string;
    service_count: number;
    created_at: string;
  }>;
  billing: {
    wallet_balance: number;
    monthly_spend: number;
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

  // Fetch user detail data
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'user-detail', id],
    queryFn: async (): Promise<AdminUserDetailResponse> => {
      const response = await fetch(`/api/admin/users/${id}/detail`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user details');
      }

      return response.json();
    },
    enabled: !!id && !!token,
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
    },
    onSuccess: () => {
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      navigate('/admin#user-management');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const handleImpersonate = async () => {
    if (!data?.user) return;

    try {
      await startImpersonation(data.user.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start impersonation');
    }
  };

  const handleDeleteUser = async () => {
    if (!data?.user || deleteConfirmEmail !== data.user.email) {
      toast.error('Please type the user email to confirm deletion');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserMutation.mutateAsync();
      setShowDeleteDialog(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">User not found</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'The requested user could not be found.'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin#user-management">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
        </Button>
      </div>
    );
  }

  const { user, vpsInstances, containerSubscription, containerProjects, billing, activity } = data;

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
        <span className="text-foreground">{user.name}</span>
      </div>

      <PageHeader
        title={user.name}
        description={`User account details and management for ${user.email}`}
        badge={{
          text: user.role === 'admin' ? 'Administrator' : 'User',
          variant: user.role === 'admin' ? 'default' : 'secondary',
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
      <UserProfileCard user={user} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vps">VPS ({vpsInstances.length})</TabsTrigger>
          <TabsTrigger value="containers">
            Containers ({containerProjects.length})
          </TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Quick Stats */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">VPS Instances</h3>
              <p className="text-3xl font-bold">{vpsInstances.length}</p>
              <p className="text-sm text-muted-foreground">
                {vpsInstances.filter(v => v.status === 'running').length} running
              </p>
            </div>
            
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Container Projects</h3>
              <p className="text-3xl font-bold">{containerProjects.length}</p>
              <p className="text-sm text-muted-foreground">
                {containerSubscription ? 'Active subscription' : 'No subscription'}
              </p>
            </div>
            
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Wallet Balance</h3>
              <p className="text-3xl font-bold">
                ${billing.wallet_balance.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                ${billing.monthly_spend.toFixed(2)} this month
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          {activity.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {activity.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.event_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vps">
          <UserVPSList vpsInstances={vpsInstances} />
        </TabsContent>

        <TabsContent value="containers">
          <UserContainerList
            subscription={containerSubscription}
            projects={containerProjects}
          />
        </TabsContent>

        <TabsContent value="billing">
          <UserBillingInfo billing={billing} />
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      {showEditModal && (
        <UserEditModal
          user={user}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete <strong>{user.name}</strong> and all associated data including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>VPS instances ({vpsInstances.length})</li>
                <li>Container projects ({containerProjects.length})</li>
                <li>Billing records and wallet balance</li>
                <li>Support tickets and activity logs</li>
              </ul>
              <p className="font-semibold text-destructive">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <strong>{user.email}</strong> to confirm:
            </Label>
            <Input
              id="confirm-email"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={user.email}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteConfirmEmail !== user.email || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDetail;