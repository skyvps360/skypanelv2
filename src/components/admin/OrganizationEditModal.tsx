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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { validateForm, ValidationSchemas } from '@/lib/validation';
import { handleApiError, displaySuccess, displayInfo } from '@/lib/errorHandling';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}

interface OrganizationEditForm {
  name: string;
  slug: string;
  description: string;
}

interface OrganizationEditModalProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const OrganizationEditModal: React.FC<OrganizationEditModalProps> = ({
  organization,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<OrganizationEditForm>({
    name: '',
    slug: '',
    description: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Initialize form data when organization changes
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        description: organization.description || '',
      });
      setErrors({});
      setServerError('');
      setTouched({});
    }
  }, [organization]);

  // Don't render if no organization
  if (!organization) {
    return null;
  }

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const validation = validateForm({ [fieldName]: value }, { [fieldName]: ValidationSchemas.organizationEdit[fieldName] });
    setErrors(prev => ({
      ...prev,
      [fieldName]: validation.errors[fieldName] || '',
    }));
    return !validation.errors[fieldName];
  };

  // Validate entire form
  const validateFormData = () => {
    const validation = validateForm(formData, ValidationSchemas.organizationEdit);
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
    const allFields = Object.keys(ValidationSchemas.organizationEdit);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateFormData()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    // Only send changed fields
    const updateData: Partial<OrganizationEditForm> = {};
    
    if (formData.name !== organization.name) {
      updateData.name = formData.name.trim();
    }
    
    if (formData.slug !== organization.slug) {
      updateData.slug = formData.slug.trim();
    }
    
    if (formData.description !== (organization.description || '')) {
      updateData.description = formData.description.trim();
    }

    // If no changes, just close the modal
    if (Object.keys(updateData).length === 0) {
      displayInfo('No changes to save');
      handleClose();
      return;
    }

    setIsLoading(true);
    setServerError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/organizations/${organization.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        await handleApiError(response, 'Failed to update organization');
        return;
      }

      displaySuccess('Organization updated successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Organization update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
        description: organization.description || '',
      });
      setErrors({});
      setServerError('');
      setTouched({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update organization details. The owner cannot be changed from this dialog.
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
            <Label>Current Owner</Label>
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">{organization.ownerName}</div>
              <div className="text-sm text-muted-foreground">{organization.ownerEmail}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              To change the owner, use the member management section to transfer ownership.
            </p>
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