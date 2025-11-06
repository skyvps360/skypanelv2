# Admin API Endpoints

Administrative endpoints for SkyPanelV2 platform management.

## Authentication

All admin endpoints require:
- Valid JWT authentication token
- User role must be `admin`

## Rate Limiting

Admin users have elevated rate limits:
- **1000 requests per 15 minutes** (vs 100 for regular users)
- Custom rate limit overrides can be configured per user

## Available Endpoints

### Organization Management
- [Organization CRUD Operations](./organizations.md) - Create, update, and delete organizations
- [Organization Member Management](./organization-members.md) - Add, update, and remove organization members
- [User Search](./user-search.md) - Search users for organization management
- [API Error Responses](./error-responses.md) - Comprehensive error handling guide

### User Management
- **GET** `/api/admin/users` - List all users
- [**GET** `/api/admin/users/:id/detail`](./user-detail.md) - Get comprehensive user details
- **PUT** `/api/admin/users/:id` - Update user
- **DELETE** `/api/admin/users/:id` - Delete user
- **POST** `/api/admin/users/:id/impersonate` - Impersonate user

### VPS Plan Management
- **GET** `/api/admin/plans` - List VPS plans
- **POST** `/api/admin/plans` - Create VPS plan
- **PUT** `/api/admin/plans/:id` - Update VPS plan
- **DELETE** `/api/admin/plans/:id` - Delete VPS plan

### Provider Management
- **GET** `/api/admin/providers` - List service providers
- **POST** `/api/admin/providers` - Create provider
- **PUT** `/api/admin/providers/:id` - Update provider
- **DELETE** `/api/admin/providers/:id` - Delete provider

### Support Ticket Management
- **GET** `/api/admin/tickets` - List all support tickets
- **PATCH** `/api/admin/tickets/:id/status` - Update ticket status
- **DELETE** `/api/admin/tickets/:id` - Delete ticket
- **POST** `/api/admin/tickets/:id/replies` - Reply to ticket
- **GET** `/api/admin/tickets/:id/replies` - List ticket replies

### Platform Configuration
- **GET** `/api/admin/theme` - Get theme configuration
- **PUT** `/api/admin/theme` - Update theme configuration
- **GET** `/api/admin/settings` - Get platform settings
- **PUT** `/api/admin/settings` - Update platform settings

### Rate Limit Management
- **GET** `/api/admin/rate-limits/overrides` - List rate limit overrides
- **POST** `/api/admin/rate-limits/overrides` - Create rate limit override
- **DELETE** `/api/admin/rate-limits/overrides/:userId` - Delete rate limit override

## Security Features

### Audit Logging
All admin operations are automatically logged with:
- Admin user details
- Operation type and target
- Timestamp and metadata
- Request context (IP, user agent)

### Input Validation
- Comprehensive request validation using express-validator
- SQL injection prevention
- XSS protection
- Rate limiting

### Access Control
- JWT token validation
- Role-based access control
- Admin-only middleware enforcement
- Audit trail for all operations

## Error Handling

Admin endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "errors": [
    {
      "field": "fieldName", 
      "message": "Validation error"
    }
  ]
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (not admin)
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Best Practices

1. **Always validate input** - Use the provided validation schemas
2. **Handle errors gracefully** - Check response status and handle errors appropriately
3. **Respect rate limits** - Implement proper retry logic with exponential backoff
4. **Log operations** - Admin operations are automatically logged, but consider application-level logging
5. **Use transactions** - For operations affecting multiple resources, ensure atomicity