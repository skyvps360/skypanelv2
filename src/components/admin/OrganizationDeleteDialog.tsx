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
import { Loader2, AlertTriangle, Users, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface Organization {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  ownerName: string;
  ownerEmail: string;
}

interface OrganizationDeleteDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const OrganizationDeleteDialog: React.FC<OrganizationDeleteDialogProps> = ({
  organization,
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

  // Don't render if no organization
  if (!organization) {
    return null;
  }

  const isConfirmationValid = confirmationText === organization.name;

  const handleDelete = async () => {
    if (!isConfirmationValid) {
      setError('Please type the organization name exactly as shown');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organization.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete organization');
      }

      toast.success('Organization deleted successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      setError(error.message || 'Failed to delete organization');
      toast.error(error.message || 'Failed to delete organization');
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

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              Delete Organization
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription asChild>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are about to permanently delete the organization{' '}
              <span className="font-semibold text-foreground">"{organization.name}"</span>.
              This action cannot be undone.
            </p>

            {/* Resource Impact Warning */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                This will permanently delete:
              </h4>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{organization.memberCount} member{organization.memberCount !== 1 ? 's' : ''}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>All organization data and settings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>All associated resources and permissions</span>
                </li>
              </ul>
            </div>

            {/* Owner Information */}
            <div className="rounded-lg border p-3 bg-muted/50">
              <h4 className="font-medium text-sm mb-1">Organization Owner</h4>
              <p className="text-sm text-muted-foreground">
                {organization.ownerName} ({organization.ownerEmail})
              </p>
            </div>

            {/* Confirmation Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Type <span className="font-mono font-semibold">{organization.name}</span> to confirm deletion:
              </Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => {
                  setConfirmationText(e.target.value);
                  if (error) setError('');
                }}
                placeholder={organization.name}
                disabled={isLoading}
                className={cn(
                  error && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
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
          
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || !isConfirmationValid}
            className={cn(
              "transition-all duration-200",
              !isConfirmationValid && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Organization'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};