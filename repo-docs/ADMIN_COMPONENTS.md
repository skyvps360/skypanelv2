# Admin User Management Components

Comprehensive documentation for the admin user management components in SkyPanelV2.

## Overview

The admin user management system consists of several modal components for organization and member management, integrated with the main `OrganizationManagement` component and enhanced `AdminUserDetail` page.

## Component Architecture

```
OrganizationManagement
├── OrganizationCreateModal
├── OrganizationEditModal
├── OrganizationDeleteDialog
├── MemberAddModal
├── MemberEditModal
└── MemberRemoveDialog

AdminUserDetail
├── UserEditModal
├── UserDeleteDialog
└── ImpersonationDialog
```

## Organization Management Components

### OrganizationCreateModal

Modal component for creating new organizations with owner assignment.

#### Props

```typescript
interface OrganizationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { OrganizationCreateModal } from '@/components/admin/OrganizationCreateModal';

function OrganizationManagement() {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    // Refresh organization list
    refetchOrganizations();
  };

  return (
    <>
      <Button onClick={() => setCreateModalOpen(true)}>
        New Organization
      </Button>
      
      <OrganizationCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
```

#### Features

- **Form Validation**: Real-time validation for name, slug, and owner selection
- **User Search**: Integrated user search for owner assignment
- **Unique Validation**: Checks for name and slug uniqueness
- **Error Handling**: Displays API errors and validation messages
- **Loading States**: Shows loading spinner during submission

#### Form Fields

- `name` (required): Organization display name
- `slug` (required): URL-friendly identifier
- `ownerId` (required): UUID of the user who will own the organization
- `description` (optional): Organization description

---

### OrganizationEditModal

Modal component for editing existing organization details.

#### Props

```typescript
interface OrganizationEditModalProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { OrganizationEditModal } from '@/components/admin/OrganizationEditModal';

function OrganizationManagement() {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const handleEdit = (organization: Organization) => {
    setSelectedOrganization(organization);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedOrganization(null);
    refetchOrganizations();
  };

  return (
    <>
      <Button onClick={() => handleEdit(organization)}>
        Edit
      </Button>
      
      <OrganizationEditModal
        organization={selectedOrganization}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
```

#### Features

- **Pre-populated Form**: Loads existing organization data
- **Selective Updates**: Only sends changed fields to API
- **Unique Validation**: Validates name/slug uniqueness if changed
- **Optimistic Updates**: Updates UI immediately on success

---

### OrganizationDeleteDialog

Confirmation dialog for deleting organizations with cascading deletion warnings.

#### Props

```typescript
interface OrganizationDeleteDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { OrganizationDeleteDialog } from '@/components/admin/OrganizationDeleteDialog';

function OrganizationManagement() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const handleDelete = (organization: Organization) => {
    setSelectedOrganization(organization);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Button variant="destructive" onClick={() => handleDelete(organization)}>
        Delete
      </Button>
      
      <OrganizationDeleteDialog
        organization={selectedOrganization}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          setSelectedOrganization(null);
          refetchOrganizations();
        }}
      />
    </>
  );
}
```

#### Features

- **Confirmation Required**: User must type organization name to confirm
- **Resource Warning**: Shows count of resources that will be deleted
- **Cascading Deletion**: Handles cleanup of VPS, billing, and member data
- **Safety Checks**: Prevents accidental deletion

## Member Management Components

### MemberAddModal

Modal component for adding users to organizations with role assignment.

#### Props

```typescript
interface MemberAddModalProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { MemberAddModal } from '@/components/admin/MemberAddModal';

function OrganizationManagement() {
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const handleAddMember = (organizationId: string) => {
    setSelectedOrgId(organizationId);
    setAddMemberModalOpen(true);
  };

  return (
    <>
      <Button onClick={() => handleAddMember(organization.id)}>
        Add Member
      </Button>
      
      <MemberAddModal
        organizationId={selectedOrgId}
        open={addMemberModalOpen}
        onOpenChange={setAddMemberModalOpen}
        onSuccess={() => {
          setAddMemberModalOpen(false);
          refetchOrganizations();
        }}
      />
    </>
  );
}
```

#### Features

- **User Search**: Real-time search with organization context
- **Role Selection**: Choose from owner, admin, or member roles
- **Duplicate Prevention**: Filters out existing members
- **Ownership Transfer**: Handles ownership transfer when adding owner

---

### MemberEditModal

Modal component for changing member roles within organizations.

#### Props

```typescript
interface MemberEditModalProps {
  member: OrganizationMember | null;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { MemberEditModal } from '@/components/admin/MemberEditModal';

function OrganizationManagement() {
  const [editMemberModalOpen, setEditMemberModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);

  const handleEditMember = (member: OrganizationMember) => {
    setSelectedMember(member);
    setEditMemberModalOpen(true);
  };

  return (
    <>
      <Button onClick={() => handleEditMember(member)}>
        Edit Role
      </Button>
      
      <MemberEditModal
        member={selectedMember}
        organizationId={organization.id}
        open={editMemberModalOpen}
        onOpenChange={setEditMemberModalOpen}
        onSuccess={() => {
          setEditMemberModalOpen(false);
          setSelectedMember(null);
          refetchOrganizations();
        }}
      />
    </>
  );
}
```

#### Features

- **Role Management**: Change between owner, admin, and member roles
- **Ownership Transfer**: Handles ownership transfer with confirmation
- **Current Role Display**: Shows member's current role
- **Validation**: Prevents invalid role changes

---

### MemberRemoveDialog

Confirmation dialog for removing members from organizations.

#### Props

```typescript
interface MemberRemoveDialogProps {
  member: OrganizationMember | null;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

#### Usage

```tsx
import { MemberRemoveDialog } from '@/components/admin/MemberRemoveDialog';

function OrganizationManagement() {
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);

  const handleRemoveMember = (member: OrganizationMember) => {
    setSelectedMember(member);
    setRemoveMemberDialogOpen(true);
  };

  return (
    <>
      <Button variant="destructive" onClick={() => handleRemoveMember(member)}>
        Remove
      </Button>
      
      <MemberRemoveDialog
        member={selectedMember}
        organizationId={organization.id}
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
        onSuccess={() => {
          setRemoveMemberDialogOpen(false);
          setSelectedMember(null);
          refetchOrganizations();
        }}
      />
    </>
  );
}
```

#### Features

- **Owner Protection**: Prevents removal of organization owners
- **Confirmation Required**: User must confirm the removal
- **Resource Cleanup**: Handles cleanup of member-specific resources
- **Clear Warnings**: Shows impact of member removal

## Enhanced AdminUserDetail Component

The `AdminUserDetail` component has been enhanced with improved error handling, loading states, and user management functionality.

### Key Features

#### Comprehensive User Data Display

```tsx
// User profile information
<UserProfileCard user={userDetail.user} />

// VPS instances with organization context
<UserVPSList instances={userDetail.vpsInstances} />

// Billing information and wallet balance
<UserBillingInfo billing={userDetail.billing} />

// Recent activity and statistics
<UserActivityLog activity={userDetail.activity} />
<UserStatistics stats={userDetail.statistics} />
```

#### Enhanced User Actions

```tsx
// Edit user information
<UserEditModal
  user={userDetail.user}
  open={editModalOpen}
  onOpenChange={setEditModalOpen}
  onSuccess={handleEditSuccess}
/>

// Impersonate user with confirmation
<ImpersonationDialog
  user={userDetail.user}
  open={impersonateDialogOpen}
  onOpenChange={setImpersonateDialogOpen}
  onSuccess={handleImpersonateSuccess}
/>

// Delete user account with cascading deletion
<UserDeleteDialog
  user={userDetail.user}
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  onSuccess={handleDeleteSuccess}
/>
```

#### Error Handling and Loading States

```tsx
// Loading state
if (isLoading) {
  return <UserDetailSkeleton />;
}

// Error state
if (error) {
  return (
    <div className="text-center py-8">
      <h2 className="text-xl font-semibold text-red-600">
        {error.status === 404 ? 'User Not Found' : 'Error Loading User'}
      </h2>
      <p className="text-gray-600 mt-2">{error.message}</p>
      <Button onClick={() => navigate('/admin/users')} className="mt-4">
        Back to Users
      </Button>
    </div>
  );
}
```

## Integration Examples

### Complete OrganizationManagement Integration

```tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OrganizationCreateModal } from '@/components/admin/OrganizationCreateModal';
import { OrganizationEditModal } from '@/components/admin/OrganizationEditModal';
import { OrganizationDeleteDialog } from '@/components/admin/OrganizationDeleteDialog';
import { MemberAddModal } from '@/components/admin/MemberAddModal';
import { MemberEditModal } from '@/components/admin/MemberEditModal';
import { MemberRemoveDialog } from '@/components/admin/MemberRemoveDialog';

export function OrganizationManagement() {
  // Modal state management
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [editMemberModalOpen, setEditMemberModalOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);

  // Selected items for modals
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Data fetching
  const { data: organizations, refetch: refetchOrganizations } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: fetchOrganizations
  });

  // Event handlers
  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    refetchOrganizations();
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedOrganization(null);
    refetchOrganizations();
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedOrganization(null);
    refetchOrganizations();
  };

  const handleMemberSuccess = () => {
    setAddMemberModalOpen(false);
    setEditMemberModalOpen(false);
    setRemoveMemberDialogOpen(false);
    setSelectedMember(null);
    setSelectedOrgId('');
    refetchOrganizations();
  };

  return (
    <div className="space-y-6">
      {/* Organization list with action buttons */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Button onClick={() => setCreateModalOpen(true)}>
          New Organization
        </Button>
      </div>

      {/* Organizations table */}
      <OrganizationsTable
        organizations={organizations}
        onEdit={(org) => {
          setSelectedOrganization(org);
          setEditModalOpen(true);
        }}
        onDelete={(org) => {
          setSelectedOrganization(org);
          setDeleteDialogOpen(true);
        }}
        onAddMember={(orgId) => {
          setSelectedOrgId(orgId);
          setAddMemberModalOpen(true);
        }}
        onEditMember={(member, orgId) => {
          setSelectedMember(member);
          setSelectedOrgId(orgId);
          setEditMemberModalOpen(true);
        }}
        onRemoveMember={(member, orgId) => {
          setSelectedMember(member);
          setSelectedOrgId(orgId);
          setRemoveMemberDialogOpen(true);
        }}
      />

      {/* All modals and dialogs */}
      <OrganizationCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      <OrganizationEditModal
        organization={selectedOrganization}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
      />

      <OrganizationDeleteDialog
        organization={selectedOrganization}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />

      <MemberAddModal
        organizationId={selectedOrgId}
        open={addMemberModalOpen}
        onOpenChange={setAddMemberModalOpen}
        onSuccess={handleMemberSuccess}
      />

      <MemberEditModal
        member={selectedMember}
        organizationId={selectedOrgId}
        open={editMemberModalOpen}
        onOpenChange={setEditMemberModalOpen}
        onSuccess={handleMemberSuccess}
      />

      <MemberRemoveDialog
        member={selectedMember}
        organizationId={selectedOrgId}
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
        onSuccess={handleMemberSuccess}
      />
    </div>
  );
}
```

## Styling and Theming

All components use the shadcn/ui design system with Tailwind CSS:

### Color Scheme

- **Primary Actions**: Blue (`bg-blue-600`, `hover:bg-blue-700`)
- **Destructive Actions**: Red (`bg-red-600`, `hover:bg-red-700`)
- **Success States**: Green (`text-green-600`, `bg-green-50`)
- **Error States**: Red (`text-red-600`, `bg-red-50`)
- **Loading States**: Gray (`text-gray-500`, `animate-pulse`)

### Component Variants

```tsx
// Button variants
<Button variant="default">Primary Action</Button>
<Button variant="destructive">Delete Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost">Subtle Action</Button>

// Input variants
<Input className="border-red-300" /> // Error state
<Input className="border-green-300" /> // Success state
```

## Accessibility Features

All components follow WCAG 2.1 AA guidelines:

### Keyboard Navigation

- **Tab Order**: Logical tab sequence through form fields
- **Enter/Space**: Activates buttons and form submissions
- **Escape**: Closes modals and dialogs
- **Arrow Keys**: Navigate through select options

### Screen Reader Support

```tsx
// ARIA labels and descriptions
<Button aria-label="Create new organization">
  <Plus className="w-4 h-4" />
</Button>

<Input
  aria-describedby="name-error"
  aria-invalid={!!errors.name}
/>

<div id="name-error" role="alert">
  {errors.name?.message}
</div>
```

### Focus Management

- **Auto-focus**: First form field receives focus when modal opens
- **Focus Trap**: Focus stays within modal during interaction
- **Focus Return**: Focus returns to trigger element when modal closes

## Testing

### Unit Tests

Each component has comprehensive unit tests:

```bash
# Run component tests
npm test src/components/admin/__tests__/

# Run specific component test
npm test OrganizationCreateModal.test.tsx
```

### Integration Tests

API integration tests verify component behavior:

```bash
# Run API integration tests
npm test api/tests/admin-organizations.test.ts
```

### E2E Tests

End-to-end tests cover complete workflows:

```bash
# Run E2E tests (when implemented)
npm run test:e2e
```

## Troubleshooting

### Common Issues

#### Modal Not Opening

```tsx
// Ensure state is properly managed
const [modalOpen, setModalOpen] = useState(false);

// Check if onOpenChange is called
<Modal
  open={modalOpen}
  onOpenChange={(open) => {
    console.log('Modal state changing:', open);
    setModalOpen(open);
  }}
/>
```

#### Form Validation Errors

```tsx
// Check validation schema
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format')
});

// Verify error handling
const { errors } = useForm({
  resolver: zodResolver(schema)
});
```

#### API Call Failures

```tsx
// Add error logging
const mutation = useMutation({
  mutationFn: createOrganization,
  onError: (error) => {
    console.error('API Error:', error);
    toast.error(error.message);
  }
});
```

### Performance Issues

#### Slow Modal Opening

- Check for heavy computations in modal components
- Use `React.memo` for expensive child components
- Implement lazy loading for complex forms

#### Memory Leaks

- Ensure proper cleanup of event listeners
- Cancel pending API requests on unmount
- Clear form state when modals close

### Browser Compatibility

Components are tested on:

- **Chrome 90+**
- **Firefox 88+**
- **Safari 14+**
- **Edge 90+**

For older browsers, consider polyfills for:

- `fetch` API
- `Promise` support
- CSS Grid/Flexbox

## Contributing

When adding new admin components:

1. **Follow Patterns**: Use existing components as templates
2. **Add Tests**: Include unit tests for all new components
3. **Update Documentation**: Add component documentation here
4. **Accessibility**: Ensure WCAG compliance
5. **Type Safety**: Use TypeScript interfaces for all props

### Component Checklist

- [ ] TypeScript interfaces defined
- [ ] Props validation implemented
- [ ] Error handling included
- [ ] Loading states implemented
- [ ] Accessibility features added
- [ ] Unit tests written
- [ ] Documentation updated
- [ ] Integration tested