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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, ChevronsUpDown, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { validateForm, ValidationSchemas } from '@/lib/validation';
import { handleApiError, displaySuccess } from '@/lib/errorHandling';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface OrganizationCreateForm {
  name: string;
  slug: string;
  ownerId: string;
  description: string;
}

interface OrganizationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const OrganizationCreateModal: React.FC<OrganizationCreateModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const [formData, setFormData] = useState<OrganizationCreateForm>({
    name: '',
    slug: '',
    ownerId: '',
    description: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !formData.slug) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, formData.slug]);

  // Search users for owner selection
  const searchUsers = async (query: string) => {
    if (!token || !query.trim()) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setUsers([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      } else {
        setUsers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, token]);

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const validation = validateForm({ [fieldName]: value }, { [fieldName]: ValidationSchemas.organizationCreate[fieldName] });
    setErrors(prev => ({
      ...prev,
      [fieldName]: validation.errors[fieldName] || '',
    }));
    return !validation.errors[fieldName];
  };

  // Validate entire form
  const validateFormData = () => {
    const validation = validateForm(formData, ValidationSchemas.organizationCreate);
    setErrors(validation.errors);
    setServerError('');
    return validation.isValid;
  };

  // Handle field blur for validation
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    validateField(fieldName, formData[fieldName]);
  };

  // Handle field change with real-time validation
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear server error when user starts typing
    if (serverError) {
      setServerError('');
    }
    
    // Validate if field has been touched
    if (touched[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    const allFields = Object.keys(ValidationSchemas.organizationCreate);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateFormData()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setIsLoading(true);
    setServerError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          ownerId: formData.ownerId,
          description: formData.description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        await handleApiError(response, 'Failed to create organization');
        return;
      }

      displaySuccess('Organization created successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      // Error is already handled by handleApiError
      console.error('Organization creation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: '',
        slug: '',
        ownerId: '',
        description: '',
      });
      setSelectedUser(null);
      setUsers([]);
      setUserSearchQuery('');
      setErrors({});
      setServerError('');
      setTouched({});
      onOpenChange(false);
    }
  };

  const handleUserSelect = (user: UserSearchResult) => {
    setSelectedUser(user);
    handleFieldChange('ownerId', user.id);
    setUserSearchOpen(false);
    setUserSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Create a new organization and assign an owner to manage it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              placeholder="Enter organization name"
              disabled={isLoading}
              maxLength={100}
              className={errors.name && touched.name ? 'border-red-500' : ''}
            />
            {errors.name && touched.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Organization Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => handleFieldChange('slug', e.target.value)}
              onBlur={() => handleFieldBlur('slug')}
              placeholder="organization-slug"
              disabled={isLoading}
              maxLength={50}
              className={errors.slug && touched.slug ? 'border-red-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs and API calls. Only lowercase letters, numbers, and hyphens allowed.
            </p>
            {errors.slug && touched.slug && (
              <p className="text-sm text-red-500">{errors.slug}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Organization Owner *</Label>
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userSearchOpen}
                  className="w-full justify-between"
                  disabled={isLoading}
                >
                  {selectedUser ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedUser.name} ({selectedUser.email})</span>
                    </div>
                  ) : (
                    "Search and select owner..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput
                    placeholder="Search users by name or email..."
                    value={userSearchQuery}
                    onValueChange={setUserSearchQuery}
                  />
                  <CommandList>
                    {isSearching ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-sm">Searching...</span>
                      </div>
                    ) : users.length === 0 && userSearchQuery ? (
                      <CommandEmpty>No users found.</CommandEmpty>
                    ) : users.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Start typing to search for users
                      </div>
                    ) : (
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={() => handleUserSelect(user)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedUser?.id === user.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email} • {user.role}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.ownerId && touched.ownerId && (
              <p className="text-sm text-red-500">{errors.ownerId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              onBlur={() => handleFieldBlur('description')}
              placeholder="Optional description for the organization"
              rows={3}
              disabled={isLoading}
              maxLength={500}
              className={errors.description && touched.description ? 'border-red-500' : ''}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
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
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};