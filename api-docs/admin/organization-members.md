# Admin Organization Member Management API

Admin endpoints for managing organization memberships in SkyPanelV2.

## Authentication

All endpoints require:
- Valid JWT token
- Admin role (`role: "admin"`)

## Member Roles

- `owner` - Organization owner (only one per organization)
- `admin` - Organization administrator
- `member` - Regular organization member

## Endpoints

### Add Member to Organization

Add a user as a member of an organization with a specified role.

**POST** `/api/admin/organizations/:id/members`

#### Path Parameters

- `id` (required): UUID of the organization

#### Request Body

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "member"
}
```

#### Request Validation

- `userId` (required): Valid UUID of existing user
- `role` (required): Must be one of `owner`, `admin`, or `member`

#### Response

**Status: 201 Created**

```json
{
  "member": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "userName": "Jane Smith",
    "userEmail": "jane@example.com",
    "role": "member",
    "userRole": "user",
    "joinedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

#### Error Responses

**Status: 404 Not Found**
```json
{
  "error": "Organization not found"
}
```

**Status: 400 Bad Request**
```json
{
  "error": "User not found"
}
```

```json
{
  "error": "User is already a member of this organization"
}
```

#### Ownership Transfer

When adding a user with `role: "owner"`:

1. Current owner is demoted to `admin` role
2. Organization's `owner_id` is updated to the new user
3. New user is added as organization member with `owner` role

This operation is performed within a database transaction for consistency.

#### Side Effects

1. Creates organization membership record
2. If role is `owner`, transfers ownership (see above)
3. Logs activity event `organization_member.add`

---

### Update Member Role

Change a member's role within an organization.

**PUT** `/api/admin/organizations/:id/members/:userId`

#### Path Parameters

- `id` (required): UUID of the organization
- `userId` (required): UUID of the user/member

#### Request Body

```json
{
  "role": "admin"
}
```

#### Request Validation

- `role` (required): Must be one of `owner`, `admin`, or `member`

#### Response

**Status: 200 OK**

```json
{
  "member": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "userName": "Jane Smith",
    "userEmail": "jane@example.com",
    "role": "admin",
    "userRole": "user",
    "joinedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

#### Error Responses

**Status: 404 Not Found**
```json
{
  "error": "Organization not found"
}
```

```json
{
  "error": "Member not found in organization"
}
```

#### Ownership Transfer

When changing role to `owner`:

1. Current owner is demoted to `admin` role
2. Organization's `owner_id` is updated to the target user
3. Target user's role is updated to `owner`

This operation is performed within a database transaction for consistency.

#### Side Effects

1. Updates organization membership record
2. If role is `owner`, transfers ownership (see above)
3. Logs activity event `organization_member.update`

---

### Remove Member from Organization

Remove a user from an organization.

**DELETE** `/api/admin/organizations/:id/members/:userId`

#### Path Parameters

- `id` (required): UUID of the organization
- `userId` (required): UUID of the user/member

#### Response

**Status: 204 No Content**

#### Error Responses

**Status: 404 Not Found**
```json
{
  "error": "Organization not found"
}
```

```json
{
  "error": "Member not found in organization"
}
```

**Status: 400 Bad Request**
```json
{
  "error": "Cannot remove organization owner. Transfer ownership first."
}
```

#### Ownership Protection

Organization owners cannot be removed directly. To remove an owner:

1. First transfer ownership to another member using the update member role endpoint
2. Then remove the former owner

#### Side Effects

1. Deletes organization membership record
2. Logs activity event `organization_member.remove`

---

## Activity Logging

All member management operations generate activity log entries:

- **Event Types**: `organization_member.add`, `organization_member.update`, `organization_member.remove`
- **Entity Type**: `organization_member`
- **Entity ID**: Format `{organizationId}-{userId}`
- **Metadata**: Includes member details, role changes, and organization context

## Security Considerations

1. **Admin Only**: All endpoints require admin privileges
2. **Ownership Protection**: Prevents removal of organization owners
3. **Atomic Operations**: Ownership transfers use database transactions
4. **Audit Trail**: All membership changes are logged
5. **Validation**: Strict validation prevents invalid role assignments

## Business Rules

1. **Single Owner**: Each organization has exactly one owner
2. **Owner Transfer**: Ownership can be transferred but not removed
3. **Duplicate Prevention**: Users cannot be added twice to the same organization
4. **Role Hierarchy**: Owner > Admin > Member (for permission purposes)
5. **Membership Cleanup**: Removing users from organizations doesn't delete the user account