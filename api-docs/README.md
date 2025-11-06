# SkyPanelV2 API Documentation

This directory contains comprehensive API documentation for SkyPanelV2's REST API endpoints.

## Documentation Structure

- **admin/** - Admin-only endpoints for platform management
  - [Organization Management](./admin/organizations.md) - Organization CRUD operations
  - [Organization Members](./admin/organization-members.md) - Member management
  - [User Search](./admin/user-search.md) - User search for admin operations
- **auth/** - Authentication and authorization endpoints
- **billing/** - Billing, wallets, and payment endpoints
- **vps/** - VPS instance management endpoints
- **support/** - Support ticket system endpoints

## Authentication

All API endpoints require authentication via JWT tokens, except for registration and login endpoints.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Admin Endpoints

Admin endpoints require the user to have `admin` role in addition to valid authentication.

## Rate Limiting

- **Standard users**: 100 requests per 15 minutes
- **Admin users**: 1000 requests per 15 minutes
- **Rate limit overrides**: Admins can configure custom rate limits per user

## Error Responses

All endpoints return consistent error response format:

```json
{
  "error": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`

## Recent Updates

See [CHANGELOG.md](./CHANGELOG.md) for the latest API changes and additions.

### Latest: Organization Management API (2024-01-15)
- Complete organization CRUD endpoints with validation
- Organization member management with role controls
- Real-time user search functionality for admin operations
- Modal-based UI components with form validation
- Comprehensive admin controls with audit logging