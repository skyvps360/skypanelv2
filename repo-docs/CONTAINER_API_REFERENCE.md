# Container API Reference

This document provides a comprehensive reference for all Container as a Service (CaaS) API endpoints in SkyPanelV2.

## Base URL

All container API endpoints are prefixed with `/api/containers`.

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Most endpoints also require organization membership, which is validated automatically.

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

## Configuration Endpoints

### Get Easypanel Configuration
**Admin Only**

```http
GET /api/containers/admin/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "apiUrl": "https://easypanel.example.com",
    "connectionStatus": "connected",
    "lastConnectionTest": "2024-01-15T10:30:00Z"
  }
}
```

### Update Easypanel Configuration
**Admin Only**

```http
POST /api/containers/admin/config
```

**Request Body:**
```json
{
  "apiUrl": "https://easypanel.example.com",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Configuration updated successfully"
  }
}
```

### Test Easypanel Connection
**Admin Only**

```http
POST /api/containers/admin/config/test
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "user": {
      "id": "user-id",
      "email": "admin@easypanel.com"
    }
  }
}
```

## Plan Management Endpoints

### List Container Plans (User)

```http
GET /api/containers/plans
```

Returns only active plans available for subscription.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Starter Plan",
      "description": "Perfect for small applications",
      "priceMonthly": 15.00,
      "maxCpuCores": 2,
      "maxMemoryGb": 4,
      "maxStorageGb": 20,
      "maxContainers": 5,
      "active": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### List All Container Plans (Admin)
**Admin Only**

```http
GET /api/containers/admin/plans
```

Returns all plans including inactive ones.

### Create Container Plan (Admin)
**Admin Only**

```http
POST /api/containers/admin/plans
```

**Request Body:**
```json
{
  "name": "Professional Plan",
  "description": "For growing applications",
  "priceMonthly": 50.00,
  "maxCpuCores": 8,
  "maxMemoryGb": 16,
  "maxStorageGb": 100,
  "maxContainers": 20
}
```

### Update Container Plan (Admin)
**Admin Only**

```http
PUT /api/containers/admin/plans/:id
```

**Request Body:** Same as create, all fields optional.

### Activate/Deactivate Plan (Admin)
**Admin Only**

```http
POST /api/containers/admin/plans/:id/activate
POST /api/containers/admin/plans/:id/deactivate
```

## Subscription Management Endpoints

### Get Current Subscription

```http
GET /api/containers/subscription
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organizationId": "uuid",
    "planId": "uuid",
    "plan": {
      "name": "Starter Plan",
      "priceMonthly": 15.00,
      "maxCpuCores": 2,
      "maxMemoryGb": 4,
      "maxStorageGb": 20,
      "maxContainers": 5
    },
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Subscribe to Plan

```http
POST /api/containers/subscription
```

**Request Body:**
```json
{
  "planId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": { ... },
    "billingCycle": {
      "id": "uuid",
      "billingPeriodStart": "2024-01-01T00:00:00Z",
      "billingPeriodEnd": "2024-02-01T00:00:00Z",
      "monthlyRate": 15.00,
      "status": "billed"
    }
  }
}
```

### Cancel Subscription

```http
DELETE /api/containers/subscription
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Subscription cancelled successfully"
  }
}
```

### Get Resource Usage

```http
GET /api/containers/subscription/usage
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "cpuCores": 1.5,
      "memoryGb": 2.8,
      "storageGb": 15.2,
      "containerCount": 3
    },
    "limits": {
      "cpuCores": 2,
      "memoryGb": 4,
      "storageGb": 20,
      "containerCount": 5
    },
    "percentages": {
      "cpu": 75,
      "memory": 70,
      "storage": 76,
      "containers": 60
    }
  }
}
```

## Project Management Endpoints

### List Projects

```http
GET /api/containers/projects
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "subscriptionId": "uuid",
      "projectName": "my-app",
      "easypanelProjectName": "org123-my-app",
      "status": "active",
      "metadata": {},
      "serviceCount": 3,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Project

```http
POST /api/containers/projects
```

**Request Body:**
```json
{
  "projectName": "my-new-app"
}
```

**Validation:** Project name must match pattern `^[a-z0-9-_]+$`

### Get Project Details

```http
GET /api/containers/projects/:projectName
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectName": "my-app",
    "easypanelProjectName": "org123-my-app",
    "status": "active",
    "metadata": {},
    "services": [
      {
        "id": "uuid",
        "serviceName": "web-server",
        "serviceType": "app",
        "status": "running",
        "cpuLimit": 1.0,
        "memoryLimitGb": 2.0,
        "configuration": {}
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Delete Project

```http
DELETE /api/containers/projects/:projectName
```

**Note:** Project must be empty (no services) before deletion.

### Update Project Environment

```http
PUT /api/containers/projects/:projectName/env
```

**Request Body:**
```json
{
  "environment": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com"
  }
}
```

## Service Management Endpoints

### List Services

```http
GET /api/containers/projects/:projectName/services
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "serviceName": "web-server",
      "easypanelServiceName": "web-server",
      "serviceType": "app",
      "status": "running",
      "cpuLimit": 1.0,
      "memoryLimitGb": 2.0,
      "storageLimitGb": 10.0,
      "configuration": {
        "image": "nginx:latest",
        "ports": [80, 443]
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Deploy App Service

```http
POST /api/containers/projects/:projectName/services/app
```

**Request Body:**
```json
{
  "serviceName": "my-app",
  "source": {
    "type": "image",
    "image": "nginx:latest"
  },
  "env": {
    "NODE_ENV": "production"
  },
  "resources": {
    "cpuLimit": 1.0,
    "memoryLimit": 2048
  },
  "domains": [
    {
      "host": "myapp.example.com",
      "port": 80,
      "https": true
    }
  ]
}
```

**Source Types:**
- `image`: Deploy from Docker image
- `github`: Deploy from GitHub repository
- `git`: Deploy from Git repository
- `dockerfile`: Deploy using custom Dockerfile

### Deploy Database Service

```http
POST /api/containers/projects/:projectName/services/database
```

**Request Body:**
```json
{
  "serviceName": "my-database",
  "databaseType": "postgres",
  "version": "15",
  "credentials": {
    "username": "dbuser",
    "password": "secure-password"
  },
  "resources": {
    "memoryLimit": 1024,
    "storageLimit": 10240
  }
}
```

**Database Types:** `postgres`, `mysql`, `mariadb`, `mongo`, `redis`

### Deploy from Template

```http
POST /api/containers/projects/:projectName/services/template
```

**Request Body:**
```json
{
  "serviceName": "wordpress-site",
  "templateName": "wordpress",
  "configuration": {
    "WORDPRESS_DB_PASSWORD": "secure-password",
    "WORDPRESS_ADMIN_USER": "admin",
    "WORDPRESS_ADMIN_PASSWORD": "admin-password"
  }
}
```

### Get Service Details

```http
GET /api/containers/projects/:projectName/services/:serviceName
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "serviceName": "web-server",
    "serviceType": "app",
    "status": "running",
    "configuration": {
      "image": "nginx:latest",
      "env": {
        "NODE_ENV": "production"
      },
      "resources": {
        "cpuLimit": 1.0,
        "memoryLimit": 2048
      }
    },
    "easypanelData": {
      "containers": [
        {
          "id": "container-id",
          "status": "running",
          "uptime": "2 days"
        }
      ]
    }
  }
}
```

### Service Lifecycle Operations

#### Start Service
```http
POST /api/containers/projects/:projectName/services/:serviceName/start
```

#### Stop Service
```http
POST /api/containers/projects/:projectName/services/:serviceName/stop
```

#### Restart Service
```http
POST /api/containers/projects/:projectName/services/:serviceName/restart
```

#### Delete Service
```http
DELETE /api/containers/projects/:projectName/services/:serviceName
```

### Update Service Environment

```http
PUT /api/containers/projects/:projectName/services/:serviceName/env
```

**Request Body:**
```json
{
  "environment": {
    "NODE_ENV": "production",
    "API_KEY": "new-api-key"
  }
}
```

### Update Service Resources

```http
PUT /api/containers/projects/:projectName/services/:serviceName/resources
```

**Request Body:**
```json
{
  "cpuLimit": 2.0,
  "memoryLimit": 4096,
  "memoryReservation": 2048
}
```

### Get Service Logs

```http
GET /api/containers/projects/:projectName/services/:serviceName/logs
```

**Query Parameters:**
- `lines` (optional): Number of log lines to return (default: 100)
- `since` (optional): Return logs since timestamp
- `level` (optional): Filter by log level

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-01-01T12:00:00Z",
        "level": "info",
        "message": "Server started on port 3000",
        "source": "stdout"
      }
    ],
    "totalLines": 150,
    "truncated": true
  }
}
```

## Template Management Endpoints

### List Enabled Templates (User)

```http
GET /api/containers/templates
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "templateName": "wordpress",
      "displayName": "WordPress",
      "description": "Popular content management system",
      "category": "Web Applications",
      "templateSchema": {
        "services": [
          {
            "type": "app",
            "data": {
              "serviceName": "wordpress",
              "source": {
                "type": "image",
                "image": "wordpress:latest"
              }
            }
          }
        ]
      },
      "enabled": true,
      "displayOrder": 1
    }
  ]
}
```

### List All Templates (Admin)
**Admin Only**

```http
GET /api/containers/admin/templates
```

### Create Template (Admin)
**Admin Only**

```http
POST /api/containers/admin/templates
```

**Request Body:**
```json
{
  "templateName": "custom-app",
  "displayName": "Custom Application",
  "description": "Custom application template",
  "category": "Custom",
  "templateSchema": {
    "services": [...]
  }
}
```

### Update Template (Admin)
**Admin Only**

```http
PUT /api/containers/admin/templates/:id
```

### Enable/Disable Template (Admin)
**Admin Only**

```http
POST /api/containers/admin/templates/:id/enable
POST /api/containers/admin/templates/:id/disable
```

## Admin Monitoring Endpoints

### Platform Overview
**Admin Only**

```http
GET /api/containers/admin/overview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubscriptions": 25,
    "activeSubscriptions": 23,
    "totalProjects": 45,
    "totalServices": 128,
    "resourceUsage": {
      "totalCpuCores": 45.5,
      "totalMemoryGb": 128.2,
      "totalStorageGb": 1024.8,
      "totalContainers": 128
    },
    "monthlyRevenue": 1250.00
  }
}
```

### List All Subscriptions (Admin)
**Admin Only**

```http
GET /api/containers/admin/subscriptions
```

**Query Parameters:**
- `status` (optional): Filter by subscription status
- `planId` (optional): Filter by plan ID
- `limit` (optional): Number of results per page
- `offset` (optional): Pagination offset

### List All Services (Admin)
**Admin Only**

```http
GET /api/containers/admin/services
```

**Query Parameters:**
- `status` (optional): Filter by service status
- `serviceType` (optional): Filter by service type
- `organizationId` (optional): Filter by organization

## Error Codes

### Authentication Errors
- `UNAUTHORIZED`: Missing or invalid JWT token
- `FORBIDDEN`: Insufficient permissions
- `ORGANIZATION_REQUIRED`: User not member of any organization

### Validation Errors
- `INVALID_INPUT`: Request body validation failed
- `INVALID_PROJECT_NAME`: Project name doesn't match required pattern
- `INVALID_SERVICE_NAME`: Service name doesn't match required pattern

### Resource Errors
- `QUOTA_EXCEEDED`: Deployment would exceed plan quotas
- `INSUFFICIENT_BALANCE`: Organization wallet balance too low
- `PLAN_NOT_FOUND`: Specified plan doesn't exist
- `SUBSCRIPTION_NOT_FOUND`: No active subscription found

### Easypanel Errors
- `EASYPANEL_CONNECTION_FAILED`: Cannot connect to Easypanel API
- `EASYPANEL_API_ERROR`: Easypanel API returned an error
- `PROJECT_NOT_FOUND`: Project doesn't exist in Easypanel
- `SERVICE_NOT_FOUND`: Service doesn't exist in Easypanel

### Business Logic Errors
- `SUBSCRIPTION_EXISTS`: Organization already has active subscription
- `PROJECT_NOT_EMPTY`: Cannot delete project with services
- `SERVICE_DEPLOYMENT_FAILED`: Service deployment failed
- `BILLING_FAILED`: Billing cycle processing failed

## Rate Limiting

All endpoints are subject to rate limiting:
- **User endpoints**: 100 requests per minute per user
- **Admin endpoints**: 200 requests per minute per admin
- **Deployment endpoints**: 10 requests per minute per organization

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks (Future Enhancement)

Future versions may include webhook support for:
- Service status changes
- Deployment completions
- Billing events
- Resource quota warnings

---

For implementation examples and integration guides, see:
- [Easypanel Admin Guide](./EASYPANEL_ADMIN_GUIDE.md)
- [Easypanel User Guide](./EASYPANEL_USER_GUIDE.md)
- [Main API Reference](./API_REFERENCE.md)