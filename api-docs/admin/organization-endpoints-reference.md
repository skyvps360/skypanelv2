# Organization Management API - Quick Reference

## Organization CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/organizations` | Create new organization |
| PUT | `/api/admin/organizations/:id` | Update organization |
| DELETE | `/api/admin/organizations/:id` | Delete organization |

## Organization Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/organizations/:id/members` | Add member to organization |
| PUT | `/api/admin/organizations/:id/members/:userId` | Update member role |
| DELETE | `/api/admin/organizations/:id/members/:userId` | Remove member from organization |

## User Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users/search` | Search users with organization context |

## Request Examples

### Create Organization
```bash
curl -X POST /api/admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp", 
    "ownerId": "550e8400-e29b-41d4-a716-446655440000",
    "description": "A sample organization"
  }'
```

### Add Organization Member
```bash
curl -X POST /api/admin/organizations/123e4567-e89b-12d3-a456-426614174000/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "role": "member"
  }'
```

### Search Users
```bash
curl -X GET "/api/admin/users/search?q=john&organizationId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Member Role
```bash
curl -X PUT /api/admin/organizations/123e4567-e89b-12d3-a456-426614174000/members/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

### Transfer Ownership
```bash
# Transfer ownership by setting role to "owner"
curl -X PUT /api/admin/organizations/123e4567-e89b-12d3-a456-426614174000/members/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "owner"
  }'
```

## Response Status Codes

| Code | Description |
|------|-------------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized |
| 403 | Forbidden (not admin) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Key Features

### Organization Creation
- ✅ Automatic owner membership
- ✅ Initial wallet creation
- ✅ Unique name/slug validation
- ✅ Activity logging

### Member Management  
- ✅ Role-based permissions (owner/admin/member)
- ✅ Ownership transfer support
- ✅ Duplicate membership prevention
- ✅ Owner removal protection

### User Search
- ✅ Name and email search
- ✅ Organization membership context
- ✅ Pagination support
- ✅ Existing member filtering

### Security & Auditing
- ✅ Admin-only access
- ✅ Comprehensive activity logging
- ✅ Input validation
- ✅ Transaction safety for ownership transfers