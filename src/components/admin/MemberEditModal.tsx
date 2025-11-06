import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, User, AlertCircle, Crown, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'admin' | 'member';
  userRole: string; // Platform role (admin/user)
  joinedAt: string;
}

interface MemberEditForm {
  role: 'owner' | 'admin' | 'member';
}

interface MemberEditModalProps {
  member: OrganizationMember | null;
  organizationId: string;
  organizationName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const MemberEditModal: React.FC<MemberEditModalProps> = ({
  member,
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<MemberEditForm>({
    role: 'member',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when member changes
  useEffect(() => {
    if (member) {
      setFormData({
        role: member.role,
      });
      setErrors({});
    }
  }, [member]);

  // Don't render if no member
  if (!member) {
    return null;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.role) {
      newErrors.role = 'Please select a role for the member';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // If no changes, just close the modal
    if (formData.role === member.role) {
      toast.info('No changes to save');
      handleClose();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organizationId}/members/${member.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: formData.role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      const actionText = formData.role === 'owner' 
        ? 'Ownership transferred successfully' 
        : `${member.userName}'s role updated successfully`;
      
      toast.success(actionText);
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update member role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        role: member.role,
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  const handleRoleChange = (role: 'owner' | 'admin' | 'member') => {
    setFormData(prev => ({ ...prev, role }));
    if (errors.role) {
      setErrors(prev => ({ ...prev, role: '' }));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'member':
        return <Users className="h-4 w-4 text-gray-500" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400';
      case 'admin':
        return 'border-blue-400/30 bg-blue-400/10 text-blue-600 dark:text-blue-400';
      case 'member':
        return 'border-gray-400/30 bg-gray-400/10 text-gray-600 dark:text-gray-400';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Member Role</DialogTitle>
          <DialogDescription>
            Change the role of {member.userName} in {organizationName ? `"${organizationName}"` : 'this organization'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Information */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{member.userName}</h3>
                  <Badge
                    variant="outline"
                    className={member.userRole === 'admin' ? 'border-red-400/30 bg-red-400/10 text-red-400' : ''}
                  >
                    {member.userRole.charAt(0).toUpperCase() + member.userRole.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{member.userEmail}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Current role:</span>
                  <Badge variant="outline" className={getRoleColor(member.role)}>
                    <div className="flex items-center gap-1">
                      {getRoleIcon(member.role)}
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </div>
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">New Role *</Label>
            <Select
              value={formData.role}
              onValueChange={handleRoleChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">Member</div>
                      <div className="text-xs text-muted-foreground">
                        Basic access to organization resources
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-xs text-muted-foreground">
                        Can manage organization members and settings
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="font-medium">Owner</div>
                      <div className="text-xs text-muted-foreground">
                        Full control over organization (transfers ownership)
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Ownership Transfer Warning */}
            {formData.role === 'owner' && member.role !== 'owner' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Ownership Transfer</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This will transfer ownership of the organization to {member.userName}. 
                  The current owner will become an admin. This action cannot be undone.
                </p>
              </div>
            )}

            {/* Role Downgrade Warning */}
            {member.role === 'owner' && formData.role !== 'owner' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Owner Role Change</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  You cannot change the owner's role directly. To transfer ownership, 
                  promote another member to owner first.
                </p>
              </div>
            )}

            {errors.role && (
              <p className="text-sm text-red-500">{errors.role}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (member.role === 'owner' && formData.role !== 'owner')}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : formData.role === 'owner' ? (
                'Transfer Ownership'
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};