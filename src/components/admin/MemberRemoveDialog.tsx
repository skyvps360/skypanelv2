import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, User, Crown, Shield, Users, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface MemberRemoveDialogProps {
  member: OrganizationMember | null;
  organizationId: string;
  organizationName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const MemberRemoveDialog: React.FC<MemberRemoveDialogProps> = ({
  member,
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmationText('');
      setError('');
    }
  }, [open]);

  // Don't render if no member
  if (!member) {
    return null;
  }

  const isConfirmationValid = confirmationText === member.userEmail;
  const isOwner = member.role === 'owner';

  const handleRemove = async () => {
    if (isOwner) {
      setError('Cannot remove organization owner. Transfer ownership first.');
      return;
    }

    if (!isConfirmationValid) {
      setError('Please type the member\'s email address exactly as shown');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organizationId}/members/${member.userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }

      toast.success(`${member.userName} removed from organization successfully`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      setError(error.message || 'Failed to remove member');
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setConfirmationText('');
      setError('');
      onOpenChange(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              Remove Member
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription asChild>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are about to remove{' '}
              <span className="font-semibold text-foreground">{member.userName}</span>{' '}
              from {organizationName ? `"${organizationName}"` : 'this organization'}.
              This action cannot be undone.
            </p>

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
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={getRoleColor(member.role)}>
                        <div className="flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </div>
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDate(member.joinedAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Protection Warning */}
            {isOwner && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
                  <Crown className="h-4 w-4" />
                  <span className="font-semibold">Cannot Remove Owner</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This member is the organization owner and cannot be removed. 
                  To remove them, you must first transfer ownership to another member.
                </p>
              </div>
            )}

            {/* Resource Impact Warning */}
            {!isOwner && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  This will permanently:
                </h4>
                <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  <li className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Remove all member permissions and access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Clean up member-specific resources</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Remove member from all organization projects</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Confirmation Input */}
            {!isOwner && (
              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  Type <span className="font-mono font-semibold">{member.userEmail}</span> to confirm removal:
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => {
                    setConfirmationText(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={member.userEmail}
                  disabled={isLoading}
                  className={cn(
                    error && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>
            )}
          </div>
        </AlertDialogDescription>
        
        <AlertDialogFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          {!isOwner && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isLoading || !isConfirmationValid}
              className={cn(
                "transition-all duration-200",
                !isConfirmationValid && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};