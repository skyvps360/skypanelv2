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
import { Loader2, Check, ChevronsUpDown, User, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { validateForm, ValidationSchemas } from '@/lib/validation';
import { handleApiError, displaySuccess } from '@/lib/errorHandling';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
  isAlreadyMember: boolean;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface MemberAddForm {
  userId: string;
  role: 'owner' | 'admin' | 'member';
}

interface MemberAddModalProps {
  organizationId: string;
  organizationName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const MemberAddModal: React.FC<MemberAddModalProps> = ({
  organizationId,
  organizationName,
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
  
  const [formData, setFormData] = useState<MemberAddForm>({
    userId: '',
    role: 'member',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const validation = validateForm({ [fieldName]: value }, { [fieldName]: ValidationSchemas.memberAdd[fieldName] });
    setErrors(prev => ({
      ...prev,
      [fieldName]: validation.errors[fieldName] || '',
    }));
    return !validation.errors[fieldName];
  };

  // Validate entire form
  const validateFormData = () => {
    const validation = validateForm(formData, ValidationSchemas.memberAdd);
    
    // Add custom validation for already member check
    if (selectedUser?.isAlreadyMember) {
      validation.errors.userId = 'This user is already a member of this organization';
      validation.isValid = false;
    }
    
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

  // Search users for member addition
  const searchUsers = async (query: string) => {
    if (!token || !query.trim()) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(query)}&organizationId=${organizationId}`,
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
  }, [userSearchQuery, token, organizationId]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    const allFields = Object.keys(ValidationSchemas.memberAdd);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateFormData()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setIsLoading(true);
    setServerError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: formData.userId,
          role: formData.role,
        }),
      });

      if (!response.ok) {
        await handleApiError(response, 'Failed to add member');
        return;
      }

      displaySuccess(`${selectedUser?.name} added to organization successfully`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Member add error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        userId: '',
        role: 'member',
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
    handleFieldChange('userId', user.id);
    setUserSearchOpen(false);
    setUserSearchQuery('');
  };

  const handleRoleChange = (role: 'owner' | 'admin' | 'member') => {
    handleFieldChange('role', role);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Member to Organization</DialogTitle>
          <DialogDescription>
            Add a new member to {organizationName ? `"${organizationName}"` : 'this organization'} and assign them a role.
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
            <Label>Select User *</Label>
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
                      {selectedUser.isAlreadyMember && (
                        <Badge variant="secondary" className="text-xs">
                          Already Member
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "Search and select user..."
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
                            disabled={user.isAlreadyMember}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedUser?.id === user.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <User className="h-4 w-4" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{user.name}</span>
                                  {user.isAlreadyMember && (
                                    <Badge variant="secondary" className="text-xs">
                                      Already Member
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email} • {user.role}
                                </div>
                                {user.organizations.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Member of: {user.organizations.map(org => `${org.name} (${org.role})`).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                            {user.isAlreadyMember && (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.userId && touched.userId && (
              <p className="text-sm text-red-500">{errors.userId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Member Role *</Label>
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
                  <div>
                    <div className="font-medium">Member</div>
                    <div className="text-xs text-muted-foreground">
                      Basic access to organization resources
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div>
                    <div className="font-medium">Admin</div>
                    <div className="text-xs text-muted-foreground">
                      Can manage organization members and settings
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div>
                    <div className="font-medium">Owner</div>
                    <div className="text-xs text-muted-foreground">
                      Full control over organization (transfers ownership)
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {formData.role === 'owner' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Ownership Transfer</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Selecting "Owner" will transfer ownership of this organization to the selected user. 
                  The current owner will become an admin.
                </p>
              </div>
            )}
            {errors.role && touched.role && (
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
              disabled={isLoading || (selectedUser?.isAlreadyMember)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};