import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { validateForm, ValidationSchemas } from '@/lib/validation';
import { handleApiError, displaySuccess, displayInfo } from '@/lib/errorHandling';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  timezone?: string;
}

interface UserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    timezone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const validation = validateForm({ [fieldName]: value }, { [fieldName]: ValidationSchemas.userEdit[fieldName] });
    setErrors(prev => ({
      ...prev,
      [fieldName]: validation.errors[fieldName] || '',
    }));
    return !validation.errors[fieldName];
  };

  // Validate entire form
  const validateFormData = () => {
    const validation = validateForm(formData, ValidationSchemas.userEdit);
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

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (updates: { name?: string; email?: string; role?: string; phone?: string; timezone?: string }) => {
      if (!user?.id) throw new Error('User ID is required');

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update user`);
      }

      return response.json();
    },
    onSuccess: () => {
      displaySuccess('User updated successfully');
      onSuccess();
      onClose();
    },
    onError: async (error: any) => {
      // If it's a Response object, handle it as an API error
      if (error instanceof Response) {
        await handleApiError(error, 'Failed to update user');
      } else {
        // Handle other types of errors
        const message = error.message || 'Failed to update user';
        setServerError(message);
      }
    },
  });

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        phone: user.phone || '',
        timezone: user.timezone || '',
      });
      setErrors({});
      setServerError('');
      setTouched({});
    }
  }, [user]);

  // Don't render if no user
  if (!user) {
    return null;
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    const allFields = Object.keys(ValidationSchemas.userEdit);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateFormData() || !user) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    // Only send changed fields
    const updateData: { name?: string; email?: string; role?: string; phone?: string; timezone?: string } = {};
    
    if (formData.name.trim() !== (user.name || '')) {
      updateData.name = formData.name.trim();
    }
    
    if (formData.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
      updateData.email = formData.email.trim().toLowerCase();
    }
    
    if (formData.role !== (user.role || '')) {
      updateData.role = formData.role;
    }

    if (formData.phone.trim() !== (user.phone || '')) {
      updateData.phone = formData.phone.trim() || undefined;
    }

    if (formData.timezone.trim() !== (user.timezone || '')) {
      updateData.timezone = formData.timezone.trim() || undefined;
    }

    // If no changes, just close the modal
    if (Object.keys(updateData).length === 0) {
      displayInfo('No changes to save');
      onClose();
      return;
    }

    updateUserMutation.mutate(updateData);
  };

  const handleClose = () => {
    if (!updateUserMutation.isPending && user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        phone: user.phone || '',
        timezone: user.timezone || '',
      });
      setErrors({});
      setServerError('');
      setTouched({});
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions.
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
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              placeholder="Enter user name"
              disabled={updateUserMutation.isPending}
              maxLength={100}
              className={errors.name && touched.name ? 'border-red-500' : ''}
            />
            {errors.name && touched.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              placeholder="Enter email address"
              disabled={updateUserMutation.isPending}
              maxLength={255}
              className={errors.email && touched.email ? 'border-red-500' : ''}
            />
            {errors.email && touched.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleFieldChange('role', value)}
              disabled={updateUserMutation.isPending}
            >
              <SelectTrigger className={errors.role && touched.role ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && touched.role && (
              <p className="text-sm text-red-500">{errors.role}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              onBlur={() => handleFieldBlur('phone')}
              placeholder="Enter phone number (optional)"
              disabled={updateUserMutation.isPending}
              className={errors.phone && touched.phone ? 'border-red-500' : ''}
            />
            {errors.phone && touched.phone && (
              <p className="text-sm text-red-500">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={formData.timezone}
              onChange={(e) => handleFieldChange('timezone', e.target.value)}
              onBlur={() => handleFieldBlur('timezone')}
              placeholder="e.g., America/New_York (optional)"
              disabled={updateUserMutation.isPending}
              className={errors.timezone && touched.timezone ? 'border-red-500' : ''}
            />
            {errors.timezone && touched.timezone && (
              <p className="text-sm text-red-500">{errors.timezone}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};