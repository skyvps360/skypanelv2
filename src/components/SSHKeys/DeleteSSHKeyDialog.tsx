import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

interface DeleteSSHKeyDialogProps {
  isOpen: boolean;
  keyName: string;
  providers: Array<'linode'>;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export const DeleteSSHKeyDialog: React.FC<DeleteSSHKeyDialogProps> = ({
  isOpen,
  keyName,
  providers,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  const providerCount = providers.length;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete SSH Key</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Are you sure you want to delete "{keyName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">
              This action will:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Remove the key from your account</li>
              <li>Delete the key from all cloud providers</li>
              <li>Prevent using this key for new VPS instances</li>
            </ul>
          </div>
          {providerCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                The key will be removed from {providerCount} {providerCount === 1 ? 'provider' : 'providers'}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Existing VPS instances using this key will not be
            affected, but you won't be able to use this key for new instances.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete SSH Key'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
