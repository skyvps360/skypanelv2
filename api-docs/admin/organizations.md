# Admin Organization Management API

Admin endpoints for managing organizations in SkyPanelV2.

## Authentication

All endpoints require:
- Valid JWT token
- Admin role (`role: "admin"`)

## Endpoints

### Create Organization

Create a new organization with an owner and initial wallet.

**POST** `/api/admin/organizations`

#### Request Body

```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "ownerId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Optional organization description"
}
```

#### Request Validation

- `name` (required): String, non-empty, must be unique (case-insensitive)
- `slug` (required): String, non-empty, must be unique
- `ownerId` (required): Valid UUID of existing user
- `description` (optional): String, stored in organization settings

#### Response

**Status: 201 Created**

```json
{
  "organization": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "settings": {
      "description": "Optional organization description"
    },
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "owner_name": "John Doe",
    "owner_email": "john@example.com",
    "member_count": 1,
    "members": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "userName": "John Doe",
        "userEmail": "john@example.com",
        "role": "owner",
        "userRole": "user",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

#### Error Responses

**Status: 400 Bad Request**
```json
{
  "error": "Organization name already exists"
}
```

```json
{
  "error": "Organization slug already exists"
}
```

```json
{
  "error": "Owner user not found"
}
```

**Status: 400 Bad Request - Validation Errors**
```json
{
  "errors": [
    {
      "field": "name",
      "message": "Organization name is required"
    }
  ]
}
```

#### Side Effects

1. Creates organization record
2. Adds owner as organization member with `owner` role
3. Creates initial wallet with $0.00 USD balance
4. Logs activity event `organization.create`

---

### Update Organization

Update organization details (name, slug, description).

**PUT** `/api/admin/organizations/:id`

#### Path Parameters

- `id` (required): UUID of the organization

#### Request Body

```json
{
  "name": "Updated Acme Corporation",
  "slug": "updated-acme-corp",
  "description": "Updated description"
}
```

#### Request Validation

- `name` (optional): String, non-empty, must be unique if changed
- `slug` (optional): String, non-empty, must be unique if changed  
- `description` (optional): String, updates organization settings

#### Response

**Status: 200 OK**

```json
{
  "organization": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Updated Acme Corporation",
    "slug": "updated-acme-corp",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "settings": {
      "description": "Updated description"
    },
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z",
    "owner_name": "John Doe",
    "owner_email": "john@example.com",
    "member_count": 3,
    "members": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "userName": "John Doe",
        "userEmail": "john@example.com",
        "role": "owner",
        "userRole": "user",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
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
  "error": "Organization name already exists"
}
```

#### Side Effects

1. Updates organization record
2. Logs activity event `organization.update`

---

### Delete Organization

Permanently delete an organization and all associated resources.

**DELETE** `/api/admin/organizations/:id`

#### Path Parameters

- `id` (required): UUID of the organization

#### Response

**Status: 204 No Content**

#### Error Responses

**Status: 404 Not Found**
```json
{
  "error": "Organization not found"
}
```

#### Side Effects (Cascading Deletion)

⚠️ **Warning**: This operation permanently deletes all organization data.

The following resources are deleted in order:

1. **VPS Instances** - All VPS instances owned by the organization
2. **Support System** - Support ticket replies and tickets
3. **Billing Data** - Payment transactions and wallet records
4. **Membership** - All organization member relationships
5. **Activity Logs** - All activity logs for the organization
6. **Organization** - The organization record itself

Resource counts are logged in the activity event for audit purposes.

#### Transaction Safety

The deletion is performed within a database transaction. If any step fails, all changes are rolled back and an error is returned.

---

## Activity Logging

All organization management operations generate activity log entries:

- **Event Types**: `organization.create`, `organization.update`, `organization.delete`
- **Entity Type**: `organization`
- **Metadata**: Includes organization details and operation-specific data

## Security Considerations

1. **Admin Only**: All endpoints require admin privileges
2. **Audit Trail**: All operations are logged with admin user details
3. **Validation**: Strict input validation prevents data corruption
4. **Uniqueness**: Organization names and slugs must be unique
5. **Cascading Deletion**: Proper cleanup of all related resources