# PaaS API Documentation

Complete REST API reference for SkyPanelV2 PaaS.

**Base URL:** `https://your-domain.com/api`

**Authentication:** Bearer token in `Authorization` header

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Applications

### List Applications

Get all applications for the authenticated user's organization.

```http
GET /api/paas/apps
```

**Response:**
```json
{
  "apps": [
    {
      "id": "uuid",
      "name": "My App",
      "slug": "my-app",
      "status": "running",
      "subdomain": "my-app-abc123",
      "replicas": 2,
      "plan_name": "Standard",
      "cpu_cores": 1,
      "ram_mb": 1024,
      "created_at": "2025-11-09T10:00:00Z"
    }
  ]
}
```

### Get Application Details

```http
GET /api/paas/apps/:id
```

**Response:**
```json
{
  "app": {
    "id": "uuid",
    "name": "My App",
    "slug": "my-app",
    "git_url": "https://github.com/user/repo",
    "git_branch": "main",
    "buildpack": "heroku/nodejs",
    "status": "running",
    "subdomain": "my-app-abc123",
    "replicas": 2,
    "plan_id": "uuid",
    "plan_name": "Standard",
    "cpu_cores": 1,
    "ram_mb": 1024,
    "disk_gb": 20,
    "created_at": "2025-11-09T10:00:00Z",
    "updated_at": "2025-11-09T11:00:00Z"
  }
}
```

### Create Application

```http
POST /api/paas/apps
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "My App",
  "slug": "my-app",
  "git_url": "https://github.com/user/repo",
  "git_branch": "main",
  "buildpack": "heroku/nodejs",
  "plan_id": "uuid"
}
```

**Response:**
```json
{
  "app": {
    "id": "uuid",
    "name": "My App",
    "slug": "my-app",
    "status": "inactive",
    "subdomain": "my-app-abc123",
    "created_at": "2025-11-09T10:00:00Z"
  }
}
```

### Update Application

```http
PATCH /api/paas/apps/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated App Name",
  "git_branch": "develop",
  "buildpack": "heroku/python"
}
```

### Delete Application

```http
DELETE /api/paas/apps/:id
```

**Response:**
```json
{
  "message": "Application deleted successfully"
}
```

---

## Deployments

### Trigger Deployment

```http
POST /api/paas/apps/:id/deploy
Content-Type: application/json
```

**Request Body:**
```json
{
  "git_commit": "abc123def" // Optional
}
```

**Response:**
```json
{
  "message": "Deployment started",
  "appId": "uuid"
}
```

### List Deployments

```http
GET /api/paas/apps/:id/deployments
```

**Response:**
```json
{
  "deployments": [
    {
      "id": "uuid",
      "version": 5,
      "git_commit": "abc123",
      "status": "deployed",
      "build_started_at": "2025-11-09T10:00:00Z",
      "build_completed_at": "2025-11-09T10:05:00Z",
      "deployed_at": "2025-11-09T10:06:00Z"
    }
  ]
}
```

### Rollback Deployment

```http
POST /api/paas/apps/:id/rollback
Content-Type: application/json
```

**Request Body:**
```json
{
  "version": 3
}
```

**Response:**
```json
{
  "message": "Rollback initiated",
  "version": 3
}
```

---

## Logs

### Get Application Logs

```http
GET /api/paas/apps/:id/logs?since=2025-11-09T00:00:00Z&limit=1000&search=error
```

**Query Parameters:**
- `since` (optional): ISO 8601 timestamp
- `limit` (optional): Max logs to return (1-10000)
- `search` (optional): Search term

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-11-09T10:30:45Z",
      "message": "Server started on port 5000",
      "source": "docker"
    }
  ]
}
```

### Stream Logs (SSE)

```http
GET /api/paas/apps/:id/logs/stream
```

**Response (Server-Sent Events):**
```
data: {"timestamp":"2025-11-09T10:30:45Z","message":"Log line","source":"docker"}

data: {"timestamp":"2025-11-09T10:30:46Z","message":"Another log","source":"docker"}
```

---

## Environment Variables

### List Environment Variables

```http
GET /api/paas/apps/:id/env
```

**Response:**
```json
{
  "env_vars": [
    {
      "id": "uuid",
      "key": "DATABASE_URL",
      "is_system": false,
      "created_at": "2025-11-09T10:00:00Z"
    }
  ]
}
```

Note: Values are not returned for security.

### Set Environment Variables

```http
PUT /api/paas/apps/:id/env
Content-Type: application/json
```

**Request Body:**
```json
{
  "vars": {
    "DATABASE_URL": "postgresql://user:pass@host:5432/db",
    "API_KEY": "secret123",
    "NODE_ENV": "production"
  }
}
```

**Response:**
```json
{
  "message": "Environment variables updated"
}
```

### Delete Environment Variable

```http
DELETE /api/paas/apps/:id/env/:key
```

**Response:**
```json
{
  "message": "Environment variable deleted"
}
```

---

## Scaling

### Scale Application

```http
POST /api/paas/apps/:id/scale
Content-Type: application/json
```

**Request Body:**
```json
{
  "replicas": 5
}
```

**Response:**
```json
{
  "message": "Application scaled",
  "replicas": 5
}
```

### Stop Application

```http
POST /api/paas/apps/:id/stop
```

**Response:**
```json
{
  "message": "Application stopped"
}
```

---

## Plans

### List Available Plans

```http
GET /api/paas/plans
```

**Response:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Hobby",
      "slug": "hobby",
      "cpu_cores": 0.5,
      "ram_mb": 512,
      "disk_gb": 10,
      "max_replicas": 1,
      "price_per_hour": 0.0069,
      "price_per_month": 5.00,
      "features": {
        "custom_domain": false,
        "auto_scaling": false,
        "ssl": true
      }
    }
  ]
}
```

---

## Admin API

Admin-only endpoints (requires admin role).

### Get PaaS Overview

```http
GET /api/admin/paas/overview
```

**Response:**
```json
{
  "applications": [
    {"status": "running", "count": 45},
    {"status": "stopped", "count": 10}
  ],
  "deployments": {"total": 150},
  "resource_usage": {
    "total_cpu": 45.5,
    "total_ram_mb": 46080,
    "total_cost_today": 12.50
  },
  "worker_nodes": [
    {"status": "active", "count": 3}
  ]
}
```

### List All Applications

```http
GET /api/admin/paas/apps
```

### Suspend Application

```http
POST /api/admin/paas/apps/:id/suspend
```

### Resume Application

```http
POST /api/admin/paas/apps/:id/resume
```

### List Worker Nodes

```http
GET /api/admin/paas/workers
```

**Response:**
```json
{
  "workers": [
    {
      "id": "uuid",
      "name": "worker-1",
      "status": "active",
      "cpu": {
        "total": 4,
        "used": 2.5,
        "available": 1.5
      },
      "ram": {
        "total": 8192,
        "used": 4096,
        "available": 4096
      },
      "containers": 12,
      "lastHeartbeat": "2025-11-09T10:30:00Z"
    }
  ]
}
```

### Add Worker Node

```http
POST /api/admin/paas/workers
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "worker-2",
  "ip_address": "192.168.1.102",
  "ssh_port": 22,
  "ssh_user": "root",
  "ssh_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
  "auto_provision": true
}
```

### Remove Worker Node

```http
DELETE /api/admin/paas/workers/:id
```

### Initialize Swarm

```http
POST /api/admin/paas/swarm/init
```

**Response:**
```json
{
  "message": "Swarm initialized",
  "managerIp": "192.168.1.100"
}
```

### Get PaaS Settings

```http
GET /api/admin/paas/settings
```

### Update PaaS Settings

```http
PUT /api/admin/paas/settings
Content-Type: application/json
```

**Request Body:**
```json
{
  "settings": {
    "default_domain": "apps.example.com",
    "storage_type": "s3",
    "s3_bucket": "my-paas-builds",
    "loki_retention_days": 14
  }
}
```

### Manage Plans

**List All Plans (including inactive):**
```http
GET /api/admin/paas/plans
```

**Create Plan:**
```http
POST /api/admin/paas/plans
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Enterprise",
  "slug": "enterprise",
  "cpu_cores": 8,
  "ram_mb": 16384,
  "disk_gb": 200,
  "max_replicas": 50,
  "price_per_hour": 0.50,
  "features": {
    "custom_domain": true,
    "auto_scaling": true,
    "ssl": true,
    "priority_support": true,
    "dedicated_resources": true
  }
}
```

**Update Plan:**
```http
PATCH /api/admin/paas/plans/:id
```

**Delete Plan:**
```http
DELETE /api/admin/paas/plans/:id
```

### Get Resource Usage Statistics

```http
GET /api/admin/paas/usage
```

**Response:**
```json
{
  "usage": [
    {
      "hour": "2025-11-09T10:00:00Z",
      "total_cpu": 45.5,
      "total_ram_mb": 46080,
      "total_cost": 3.25
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API requests are rate limited based on user role:

- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Admin**: 1000 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699520000
```

---

## Webhooks (Coming Soon)

Future support for webhooks on events:
- `app.deployed`
- `app.failed`
- `app.scaled`
- `deployment.started`
- `deployment.completed`

---

## SDKs & Client Libraries

Official SDKs coming soon:
- Node.js
- Python
- Go
- Ruby

---

## Examples

### Deploy an App (cURL)

```bash
# 1. Create application
curl -X POST https://your-domain.com/api/paas/apps \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "slug": "my-app",
    "git_url": "https://github.com/user/repo",
    "git_branch": "main",
    "plan_id": "PLAN_UUID"
  }'

# 2. Deploy
curl -X POST https://your-domain.com/api/paas/apps/APP_ID/deploy \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check logs
curl https://your-domain.com/api/paas/apps/APP_ID/logs \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Scale to 3 replicas
curl -X POST https://your-domain.com/api/paas/apps/APP_ID/scale \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"replicas": 3}'
```

### Monitor with JavaScript

```javascript
// Stream logs in real-time
const eventSource = new EventSource(
  'https://your-domain.com/api/paas/apps/APP_ID/logs/stream',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(`[${log.timestamp}] ${log.message}`);
};
```

---

**Version**: 1.0.0
**Last Updated**: 2025-11-09
