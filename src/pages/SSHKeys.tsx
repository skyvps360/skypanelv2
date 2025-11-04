import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SSHKeyForm } from '@/components/SSHKeys/SSHKeyForm';
import { DeleteSSHKeyDialog } from '@/components/SSHKeys/DeleteSSHKeyDialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UserSSHKey {
  id: string;
  name: string;
  public_key: string;
  fingerprint: string;
  linode_key_id?: string;
  digitalocean_key_id?: number;
  created_at: string;
  updated_at: string;
}

const SSHKeys: React.FC = () => {
  const { token } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<UserSSHKey | null>(null);
  const queryClient = useQueryClient();

  // Fetch SSH keys
  const {
    data: sshKeys,
    isLoading,
    error,
  } = useQuery<UserSSHKey[]>({
    queryKey: ['ssh-keys'],
    queryFn: async () => {
      const response = await fetch('/api/ssh-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch SSH keys');
      }
      const data = await response.json();
      return data.keys || [];
    },
    enabled: !!token,
  });

  // Add SSH key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (data: { name: string; publicKey: string }) => {
      const response = await fetch('/api/ssh-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name,
          publicKey: data.publicKey,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add SSH key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setIsAddDialogOpen(false);
      
      if (data.partialSuccess) {
        toast.warning(data.message || 'SSH key added with warnings', {
          description: data.description || 'The key was added but some cloud providers could not be synchronized.',
        });
      } else {
        toast.success(data.message || 'SSH key added successfully', {
          description: data.description || 'The key has been synchronized to all cloud providers.',
        });
      }
    },
    onError: (error: any) => {
      toast.error('Failed to add SSH key', {
        description: error.message,
      });
    },
  });

  // Delete SSH key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/ssh-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete SSH key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setKeyToDelete(null);
      
      if (data.partialSuccess) {
        toast.warning(data.message || 'SSH key deleted with warnings', {
          description: data.description || 'The key was removed but some cloud providers could not be synchronized.',
        });
      } else {
        toast.success(data.message || 'SSH key deleted successfully', {
          description: data.description || 'The key has been removed from all cloud providers.',
        });
      }
    },
    onError: (error: any) => {
      toast.error('Failed to delete SSH key', {
        description: error.message,
      });
      setKeyToDelete(null);
    },
  });

  const handleAddKey = async (data: { name: string; publicKey: string }) => {
    await addKeyMutation.mutateAsync(data);
  };

  const handleDeleteKey = async () => {
    if (keyToDelete) {
      await deleteKeyMutation.mutateAsync(keyToDelete.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProviderStatus = (key: UserSSHKey) => {
    const providers: Array<'linode' | 'digitalocean'> = [];
    if (key.linode_key_id) providers.push('linode');
    if (key.digitalocean_key_id) providers.push('digitalocean');
    return providers;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <Skeleton className="h-6 w-32 mb-3" />
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-5 w-2/3" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <Badge variant="secondary" className="mb-3">
            Security
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            SSH Keys
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage your SSH keys across all cloud providers
          </p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load SSH keys. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <div className="mb-2">
            <Badge variant="secondary" className="mb-3">
              Security
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            SSH Keys
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage your SSH keys across all cloud providers. Keys are automatically synchronized when you create VPS instances.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add SSH Key
            </Button>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Key className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Keys</p>
                <p className="text-3xl font-bold tracking-tight">{sshKeys?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Configured SSH keys</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Key className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Providers</p>
                <p className="text-3xl font-bold tracking-tight">
                  {sshKeys && sshKeys.length > 0
                    ? Math.max(...sshKeys.map(k => getProviderStatus(k).length))
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Synchronized across</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Key className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Latest</p>
                <p className="text-3xl font-bold tracking-tight">
                  {sshKeys && sshKeys.length > 0
                    ? formatDate(sshKeys[0].created_at)
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Most recent key</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Key className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SSH Keys List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your SSH Keys</CardTitle>
              <CardDescription className="mt-1">
                SSH keys are automatically synchronized across all configured cloud providers
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!sshKeys || sshKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No SSH keys yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first SSH key to use it when creating VPS instances
              </p>
              <Button size="sm" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add SSH Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sshKeys.map((key) => {
                const providers = getProviderStatus(key);
                return (
                  <div
                    key={key.id}
                    className="group rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="rounded-md bg-primary/10 p-2">
                            <Key className="h-4 w-4 text-primary flex-shrink-0" />
                          </div>
                          <h3 className="font-semibold truncate">{key.name}</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-mono text-xs truncate bg-muted px-2 py-1 rounded">
                              {key.fingerprint}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>Added {formatDate(key.created_at)}</span>
                            <span>•</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {providers.length} {providers.length === 1 ? 'Provider' : 'Providers'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setKeyToDelete(key)}
                        disabled={deleteKeyMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {deleteKeyMutation.isPending &&
                        keyToDelete?.id === key.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Delete'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add SSH Key Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add SSH Key</DialogTitle>
            <DialogDescription>
              Add a new SSH key that will be available when creating VPS instances across
              all cloud providers.
            </DialogDescription>
          </DialogHeader>
          <SSHKeyForm
            onSubmit={handleAddKey}
            isLoading={addKeyMutation.isPending}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete SSH Key Dialog */}
      {keyToDelete && (
        <DeleteSSHKeyDialog
          isOpen={!!keyToDelete}
          keyName={keyToDelete.name}
          providers={getProviderStatus(keyToDelete)}
          onConfirm={handleDeleteKey}
          onCancel={() => setKeyToDelete(null)}
          isLoading={deleteKeyMutation.isPending}
        />
      )}
    </div>
  );
};

export default SSHKeys;
