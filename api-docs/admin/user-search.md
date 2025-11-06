# Admin User Search API

Admin endpoint for searching users, primarily used for organization member management.

## Authentication

Requires:
- Valid JWT token
- Admin role (`role: "admin"`)

## Endpoint

### Search Users

Search for users by name or email with pagination and organization membership context.

**GET** `/api/admin/users/search`

#### Query Parameters

- `q` (optional): Search query string to match against user name or email
- `organizationId` (optional): UUID of organization to check membership status
- `page` (optional): Page number for pagination (default: 1, min: 1)
- `limit` (optional): Results per page (default: 20, min: 1, max: 100)

#### Example Requests

```bash
# Basic search
GET /api/admin/users/search?q=john

# Search with organization context
GET /api/admin/users/search?q=smith&organizationId=123e4567-e89b-12d3-a456-426614174000

# Paginated search
GET /api/admin/users/search?q=admin&page=2&limit=10

# List all users (no search query)
GET /api/admin/users/search?page=1&limit=50
```

#### Response

**Status: 200 OK**

```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Smith",
      "email": "john.smith@example.com",
      "role": "user",
      "created_at": "2024-01-10T08:00:00.000Z",
      "isAlreadyMember": false,
      "organizations": [
        {
          "id": "789e4567-e89b-12d3-a456-426614174000",
          "name": "Other Corp",
          "role": "admin"
        }
      ]
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Jane Smith",
      "email": "jane.smith@example.com", 
      "role": "admin",
      "created_at": "2024-01-12T10:15:00.000Z",
      "isAlreadyMember": true,
      "organizations": [
        {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "Acme Corporation",
          "role": "member"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Response Fields

**User Object:**
- `id`: User's unique identifier
- `name`: User's display name
- `email`: User's email address
- `role`: User's system role (`user`, `admin`)
- `created_at`: User account creation timestamp
- `isAlreadyMember`: Boolean indicating if user is already a member of the specified organization
- `organizations`: Array of organizations the user belongs to

**Organization Object (in user.organizations):**
- `id`: Organization's unique identifier
- `name`: Organization's display name
- `role`: User's role within this organization (`owner`, `admin`, `member`)

**Pagination Object:**
- `page`: Current page number
- `limit`: Results per page
- `total`: Total number of matching users
- `totalPages`: Total number of pages
- `hasNext`: Boolean indicating if there are more pages
- `hasPrev`: Boolean indicating if there are previous pages

#### Search Behavior

1. **Text Search**: Searches both `name` and `email` fields using case-insensitive LIKE matching
2. **Membership Context**: When `organizationId` is provided, indicates which users are already members
3. **Result Ordering**: 
   - Existing members appear first (when organizationId provided)
   - Then ordered alphabetically by name
4. **Pagination**: Standard offset-based pagination

#### Error Responses

**Status: 400 Bad Request - Validation Errors**
```json
{
  "errors": [
    {
      "field": "organizationId",
      "message": "Organization ID must be a valid UUID"
    }
  ]
}
```

**Status: 500 Internal Server Error**
```json
{
  "error": "Failed to search users"
}
```

## Use Cases

### Organization Member Management

This endpoint is primarily designed for admin interfaces that need to:

1. **Add Members**: Search for users to add to an organization
2. **Membership Status**: Show which users are already members
3. **User Discovery**: Find users by partial name or email matches
4. **Bulk Operations**: Paginate through large user lists

### Example Integration

```javascript
// Search for users to add to organization
const searchUsers = async (query, organizationId) => {
  const response = await fetch(
    `/api/admin/users/search?q=${encodeURIComponent(query)}&organizationId=${organizationId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  
  // Filter out existing members for "add member" UI
  const availableUsers = data.users.filter(user => !user.isAlreadyMember);
  
  return {
    availableUsers,
    existingMembers: data.users.filter(user => user.isAlreadyMember),
    pagination: data.pagination
  };
};
```

## Performance Considerations

1. **Indexing**: Ensure database indexes on `users.name` and `users.email` for efficient searching
2. **Pagination**: Use reasonable page sizes to avoid large result sets
3. **Query Optimization**: The endpoint uses JOINs to fetch organization membership data efficiently
4. **Rate Limiting**: Standard admin rate limits apply (1000 requests per 15 minutes)

## Security Considerations

1. **Admin Only**: Endpoint requires admin privileges to prevent user enumeration
2. **Data Exposure**: Returns user email addresses (admin-appropriate level of access)
3. **Organization Context**: Only shows membership information, not sensitive organization data
4. **Input Validation**: All query parameters are validated to prevent injection attacks