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
  paasAppCount?: number;
  paasCost30d?: number;
}

interface OrganizationDeleteDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  availableOrganizations: Organization[];
}

export const OrganizationDeleteDialog: React.FC<OrganizationDeleteDialogProps> = ({
  organization,
  open,
  onOpenChange,
  onSuccess,
  availableOrganizations,
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState('');
  const [paasAction, setPaasAction] = useState<'delete' | 'reassign'>('delete');
  const [targetOrgId, setTargetOrgId] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmationText('');
      setError('');
      setPaasAction((organization?.paasAppCount || 0) > 0 ? 'delete' : 'delete');
      setTargetOrgId('');
    }
  }, [open]);

  // Don't render if no organization
  if (!organization) {
    return null;
  }

  const isConfirmationValid = confirmationText === organization.name;
  const formatCurrency = (value?: number | null) => `$${(Number(value ?? 0)).toFixed(2)}`;

  const handleDelete = async () => {
    if (!isConfirmationValid) {
      setError('Please type the organization name exactly as shown');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        paasAction,
      };

      if (organization.paasAppCount && organization.paasAppCount > 0 && paasAction === 'reassign') {
        if (!targetOrgId) {
          setError('Select a target organization for reassignment');
          setIsLoading(false);
          return;
        }
        payload.targetOrganizationId = targetOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organization.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

            {organization.paasAppCount && organization.paasAppCount > 0 && (
              <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                <div>
                  <h4 className="font-semibold mb-1">PaaS Applications</h4>
                  <p className="text-sm text-muted-foreground">
                    {organization.paasAppCount} application{organization.paasAppCount !== 1 ? 's' : ''} attached to this organization.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last 30 days cost: {formatCurrency(organization.paasCost30d)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Choose how to handle these applications:</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="paasAction"
                        value="delete"
                        checked={paasAction === 'delete'}
                        onChange={() => setPaasAction('delete')}
                      />
                      Delete all applications permanently
                    </label>
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paasAction"
                          value="reassign"
                          checked={paasAction === 'reassign'}
                          onChange={() => setPaasAction('reassign')}
                        />
                        Reassign applications to another organization
                      </span>
                      {paasAction === 'reassign' && (
                        <select
                          className="border rounded-md px-3 py-2 text-sm"
                          value={targetOrgId}
                          onChange={(e) => setTargetOrgId(e.target.value)}
                        >
                          <option value="">Select organization</option>
                          {availableOrganizations
                            .filter((orgOption) => orgOption.id !== organization.id)
                            .map((orgOption) => (
                              <option key={orgOption.id} value={orgOption.id}>
                                {orgOption.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

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
