# Admin API Error Responses

Comprehensive error response documentation for SkyPanelV2 admin endpoints.

## Standard Error Format

All admin endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific validation error"
    }
  ]
}
```

- `error`: Main error message (always present)
- `errors`: Array of field-specific validation errors (optional, for 400 Bad Request)

## HTTP Status Codes

### 400 Bad Request

Returned when request data is invalid or fails validation.

#### Validation Errors

```json
{
  "errors": [
    {
      "field": "name",
      "message": "Organization name is required"
    },
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ]
}
```

#### Business Logic Errors

```json
{
  "error": "Organization name already exists"
}
```

```json
{
  "error": "User is already a member of this organization"
}
```

```json
{
  "error": "Cannot remove organization owner. Transfer ownership first."
}
```

### 401 Unauthorized

Returned when JWT token is missing, invalid, or expired.

```json
{
  "error": "Unauthorized"
}
```

```json
{
  "error": "Token expired"
}
```

```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden

Returned when user lacks admin privileges.

```json
{
  "error": "Admin access required"
}
```

```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found

Returned when requested resource doesn't exist.

```json
{
  "error": "Organization not found"
}
```

```json
{
  "error": "User not found"
}
```

```json
{
  "error": "Member not found in organization"
}
```

### 409 Conflict

Returned when operation conflicts with current state.

```json
{
  "error": "Organization slug already exists"
}
```

```json
{
  "error": "Email address already in use"
}
```

### 429 Too Many Requests

Returned when rate limit is exceeded.

```json
{
  "error": "Rate limit exceeded. Try again in 15 minutes."
}
```

### 500 Internal Server Error

Returned when an unexpected server error occurs.

```json
{
  "error": "Internal server error"
}
```

```json
{
  "error": "Database connection failed"
}
```

```json
{
  "error": "Failed to create organization"
}
```

## Endpoint-Specific Errors

### Organization Management

#### Create Organization (POST /api/admin/organizations)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Organization name is required" | Missing name field |
| 400 | "Organization slug is required" | Missing slug field |
| 400 | "Owner ID is required" | Missing ownerId field |
| 400 | "Invalid owner ID format" | ownerId is not a valid UUID |
| 400 | "Organization name already exists" | Name uniqueness violation |
| 400 | "Organization slug already exists" | Slug uniqueness violation |
| 400 | "Owner user not found" | ownerId references non-existent user |
| 500 | "Failed to create organization" | Database or system error |

#### Update Organization (PUT /api/admin/organizations/:id)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | ID parameter is not a valid UUID |
| 400 | "Organization name already exists" | Name uniqueness violation |
| 400 | "Organization slug already exists" | Slug uniqueness violation |
| 404 | "Organization not found" | Organization ID doesn't exist |
| 500 | "Failed to update organization" | Database or system error |

#### Delete Organization (DELETE /api/admin/organizations/:id)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | ID parameter is not a valid UUID |
| 404 | "Organization not found" | Organization ID doesn't exist |
| 500 | "Failed to delete organization" | Database or system error |

### Organization Member Management

#### Add Member (POST /api/admin/organizations/:id/members)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | Organization ID is not a valid UUID |
| 400 | "User ID is required" | Missing userId field |
| 400 | "Role is required" | Missing role field |
| 400 | "Invalid user ID format" | userId is not a valid UUID |
| 400 | "Invalid role" | Role is not owner/admin/member |
| 400 | "User not found" | userId references non-existent user |
| 400 | "User is already a member of this organization" | Duplicate membership |
| 404 | "Organization not found" | Organization ID doesn't exist |
| 500 | "Failed to add member" | Database or system error |

#### Update Member Role (PUT /api/admin/organizations/:id/members/:userId)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | Organization ID is not a valid UUID |
| 400 | "Invalid user ID format" | User ID is not a valid UUID |
| 400 | "Role is required" | Missing role field |
| 400 | "Invalid role" | Role is not owner/admin/member |
| 404 | "Organization not found" | Organization ID doesn't exist |
| 404 | "Member not found in organization" | User is not a member |
| 500 | "Failed to update member role" | Database or system error |

#### Remove Member (DELETE /api/admin/organizations/:id/members/:userId)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | Organization ID is not a valid UUID |
| 400 | "Invalid user ID format" | User ID is not a valid UUID |
| 400 | "Cannot remove organization owner. Transfer ownership first." | Attempting to remove owner |
| 404 | "Organization not found" | Organization ID doesn't exist |
| 404 | "Member not found in organization" | User is not a member |
| 500 | "Failed to remove member" | Database or system error |

### User Search

#### Search Users (GET /api/admin/users/search)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid organization ID format" | organizationId parameter is not a valid UUID |
| 400 | "Page must be a positive integer" | Invalid page parameter |
| 400 | "Limit must be between 1 and 100" | Invalid limit parameter |
| 500 | "Failed to search users" | Database or system error |

### User Detail

#### Get User Detail (GET /api/admin/users/:id/detail)

| Status | Error | Description |
|--------|-------|-------------|
| 400 | "Invalid user ID format" | User ID is not a valid UUID |
| 404 | "User not found" | User ID doesn't exist |
| 500 | "Failed to retrieve user details" | Database or system error |

## Error Handling Best Practices

### Client-Side Handling

```javascript
const handleApiError = async (response) => {
  const data = await response.json();
  
  switch (response.status) {
    case 400:
      if (data.errors) {
        // Handle validation errors
        data.errors.forEach(error => {
          console.error(`${error.field}: ${error.message}`);
        });
      } else {
        // Handle business logic error
        console.error(data.error);
      }
      break;
      
    case 401:
      // Redirect to login
      window.location.href = '/login';
      break;
      
    case 403:
      // Show access denied message
      console.error('Access denied: Admin privileges required');
      break;
      
    case 404:
      // Show not found message
      console.error(`Resource not found: ${data.error}`);
      break;
      
    case 429:
      // Show rate limit message and retry after delay
      console.error('Rate limit exceeded. Please try again later.');
      break;
      
    case 500:
      // Show generic error message
      console.error('Server error. Please try again or contact support.');
      break;
      
    default:
      console.error(`Unexpected error: ${data.error}`);
  }
};

// Usage example
try {
  const response = await fetch('/api/admin/organizations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(organizationData)
  });
  
  if (!response.ok) {
    await handleApiError(response);
    return;
  }
  
  const result = await response.json();
  // Handle success
  
} catch (error) {
  console.error('Network error:', error.message);
}
```

### Form Validation Integration

```javascript
const displayValidationErrors = (errors) => {
  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(el => el.remove());
  
  errors.forEach(error => {
    const field = document.querySelector(`[name="${error.field}"]`);
    if (field) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message text-red-500 text-sm mt-1';
      errorElement.textContent = error.message;
      field.parentNode.appendChild(errorElement);
    }
  });
};
```

### Toast Notifications

```javascript
const showErrorToast = (message) => {
  // Using a toast library like react-hot-toast
  toast.error(message, {
    duration: 5000,
    position: 'top-right'
  });
};

const showSuccessToast = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right'
  });
};
```

## Debugging Tips

### Common Issues

1. **401 Unauthorized**: Check JWT token validity and expiration
2. **403 Forbidden**: Verify user has admin role
3. **400 Validation**: Check request body format and required fields
4. **404 Not Found**: Verify resource IDs exist and are correct format
5. **500 Server Error**: Check server logs for detailed error information

### Request Debugging

```bash
# Test with curl to isolate client-side issues
curl -X POST /api/admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","slug":"test-org","ownerId":"550e8400-e29b-41d4-a716-446655440000"}' \
  -v
```

### Server-Side Logging

Admin endpoints automatically log errors with context:

```javascript
// Example log entry for debugging
{
  "level": "error",
  "message": "Failed to create organization",
  "error": "duplicate key value violates unique constraint",
  "userId": "admin-user-id",
  "endpoint": "POST /api/admin/organizations",
  "requestBody": { "name": "Duplicate Org", "slug": "duplicate" },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Rate Limiting Details

Admin endpoints have elevated rate limits:

- **Standard Rate Limit**: 1000 requests per 15 minutes
- **Burst Allowance**: Up to 100 requests in first minute
- **Reset Time**: Rate limit window resets every 15 minutes
- **Headers**: Rate limit information included in response headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
```

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded. Try again in 15 minutes.",
  "retryAfter": 900
}
```