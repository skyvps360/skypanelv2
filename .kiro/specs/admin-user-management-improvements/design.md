# Design Document

## Overview

This design addresses the incomplete admin user management functionality in SkyPanelV2 by implementing comprehensive organization management capabilities and ensuring reliable user detail views. The solution builds upon the existing OrganizationManagement component and AdminUserDetail page, completing the placeholder functionality and fixing any reliability issues.

## Architecture

### Component Architecture

```mermaid
graph TB
    A[Admin.tsx] --> B[OrganizationManagement.tsx]
    A --> C[AdminUserDetail.tsx]
    
    B --> D[OrganizationCreateModal]
    B --> E[OrganizationEditModal]
    B --> F[OrganizationDeleteDialog]
    B --> G[MemberAddModal]
    B --> H[MemberEditModal]
    B --> I[MemberRemoveDialog]
    
    C --> J[UserProfileCard]
    C --> K[UserEditModal]
    C --> L[UserVPSList]
    C --> M[UserBillingInfo]
    
    N[API Routes] --> O[/api/admin/organizations]
    N --> P[/api/admin/organizations/:id]
    N --> Q[/api/admin/organizations/:id/members]
    N --> R[/api/admin/users/:id/detail]
```

### Data Flow

1. **Organization Management Flow**
   - Admin navigates to user management section
   - OrganizationManagement component fetches organizations via API
   - User interactions trigger modals/dialogs for CRUD operations
   - API calls update backend data
   - Component state refreshes to reflect changes

2. **User Detail Flow**
   - Admin clicks on user from organization member list
   - Navigation to `/admin/user/:uuid` route
   - AdminUserDetail component fetches comprehensive user data
   - Tabs display different aspects of user information
   - Actions (edit, impersonate, delete) trigger appropriate handlers

## Components and Interfaces

### New Components

#### OrganizationCreateModal
```typescript
interface OrganizationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface OrganizationCreateForm {
  name: string;
  slug: string;
  ownerId: string;
  description?: string;
}
```

#### OrganizationEditModal
```typescript
interface OrganizationEditModalProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface OrganizationEditForm {
  name: string;
  slug: string;
  description?: string;
}
```

#### MemberAddModal
```typescript
interface MemberAddModalProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface MemberAddForm {
  userId: string;
  role: 'owner' | 'admin' | 'member';
}
```

#### MemberEditModal
```typescript
interface MemberEditModalProps {
  member: OrganizationMember | null;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface MemberEditForm {
  role: 'owner' | 'admin' | 'member';
}
```

### Enhanced Existing Components

#### OrganizationManagement (Enhanced)
- Add state management for modals and dialogs
- Implement CRUD operation handlers
- Add user search functionality for member addition
- Enhance error handling and loading states

#### AdminUserDetail (Enhanced)
- Improve error handling for invalid user IDs
- Add comprehensive data validation
- Enhance loading states and error messages
- Ensure all API calls are properly handled

## Data Models

### Organization Model (Enhanced)
```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  members: OrganizationMember[];
  memberCount: number;
  // Additional metadata
  settings?: Record<string, any>;
  status: 'active' | 'suspended' | 'deleted';
}
```

### OrganizationMember Model (Enhanced)
```typescript
interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'user'; // Platform role
  role: 'owner' | 'admin' | 'member'; // Organization role
  joinedAt: string;
  invitedBy?: string;
  lastActive?: string;
  permissions?: string[];
}
```

### User Search Result
```typescript
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
```

## API Endpoints

### Organization Management Endpoints

#### Create Organization
```
POST /api/admin/organizations
Body: {
  name: string;
  slug: string;
  ownerId: string;
  description?: string;
}
Response: { organization: Organization }
```

#### Update Organization
```
PUT /api/admin/organizations/:id
Body: {
  name?: string;
  slug?: string;
  description?: string;
}
Response: { organization: Organization }
```

#### Delete Organization
```
DELETE /api/admin/organizations/:id
Response: { success: boolean }
```

#### Add Organization Member
```
POST /api/admin/organizations/:id/members
Body: {
  userId: string;
  role: 'owner' | 'admin' | 'member';
}
Response: { member: OrganizationMember }
```

#### Update Member Role
```
PUT /api/admin/organizations/:id/members/:userId
Body: {
  role: 'owner' | 'admin' | 'member';
}
Response: { member: OrganizationMember }
```

#### Remove Organization Member
```
DELETE /api/admin/organizations/:id/members/:userId
Response: { success: boolean }
```

#### Search Users for Organization
```
GET /api/admin/users/search?q=:query&organizationId=:id
Response: { users: UserSearchResult[] }
```

### Enhanced User Detail Endpoint

#### Get User Detail (Enhanced)
```
GET /api/admin/users/:id/detail
Response: {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    timezone?: string;
    preferences?: Record<string, any>;
    created_at: string;
    updated_at: string;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: string;
      joinedAt: string;
    }>;
  };
  vpsInstances: VPSInstance[];
  billing: BillingInfo;
  activity: ActivityLog[];
  statistics: {
    totalVPS: number;
    activeVPS: number;
    totalSpend: number;
    monthlySpend: number;
  };
}
```

## Error Handling

### Client-Side Error Handling

1. **Form Validation Errors**
   - Display field-specific error messages
   - Prevent form submission with invalid data
   - Provide clear guidance for correction

2. **API Error Handling**
   - Display toast notifications for API errors
   - Handle network connectivity issues
   - Provide retry mechanisms for failed operations

3. **Not Found Errors**
   - Display appropriate 404 pages for invalid user IDs
   - Provide navigation back to parent sections
   - Include helpful error messages

### Server-Side Error Handling

1. **Validation Errors**
   - Return structured error responses
   - Include field-specific validation messages
   - Use appropriate HTTP status codes

2. **Business Logic Errors**
   - Prevent invalid operations (e.g., removing organization owner)
   - Handle constraint violations gracefully
   - Provide meaningful error messages

3. **Database Errors**
   - Handle foreign key constraints
   - Manage transaction rollbacks
   - Log errors for debugging

## Security Considerations

### Authorization
- Verify admin role for all organization management operations
- Implement proper permission checks for user detail access
- Validate organization membership for member operations

### Data Validation
- Sanitize all user inputs
- Validate UUIDs and other identifiers
- Implement rate limiting for API endpoints

### Audit Logging
- Log all organization CRUD operations
- Track member additions/removals
- Record user impersonation activities

## Testing Strategy

### Unit Tests
- Test individual component functionality
- Mock API calls and external dependencies
- Validate form validation logic
- Test error handling scenarios

### Integration Tests
- Test API endpoint functionality
- Validate database operations
- Test authentication and authorization
- Verify data consistency

### End-to-End Tests
- Test complete user workflows
- Validate UI interactions
- Test error scenarios and edge cases
- Verify responsive design

### Test Coverage Goals
- Minimum 80% code coverage for new components
- 100% coverage for critical business logic
- All API endpoints must have integration tests
- All user workflows must have E2E tests

## Performance Considerations

### Frontend Optimization
- Implement proper loading states
- Use React Query for efficient data fetching
- Implement pagination for large organization lists
- Optimize re-renders with proper memoization

### Backend Optimization
- Use database indexes for search operations
- Implement proper query optimization
- Use connection pooling for database access
- Cache frequently accessed data

### User Experience
- Provide immediate feedback for user actions
- Implement optimistic updates where appropriate
- Use skeleton loading states
- Minimize API calls through efficient data fetching

## Migration Strategy

### Database Changes
- Add any missing indexes for performance
- Update existing tables if schema changes needed
- Ensure backward compatibility during deployment

### Component Updates
- Enhance existing components incrementally
- Maintain existing API contracts
- Add new functionality without breaking changes

### Deployment Plan
1. Deploy backend API changes first
2. Update frontend components
3. Test functionality in staging environment
4. Deploy to production with monitoring
5. Monitor for any issues and rollback if necessary