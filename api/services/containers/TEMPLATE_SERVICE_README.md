# Template Service Implementation

## Overview

The Template Service provides comprehensive application template management for the Container Platform, including CRUD operations, single-service deployment, and multi-service template support with automatic dependency resolution.

## Features Implemented

### 1. Template CRUD Operations (Task 8.1)

**Service**: `api/services/containers/TemplateService.ts`
**Routes**: `api/routes/containers/templates.ts`

#### Endpoints

- `GET /api/containers/templates` - List all templates with filtering
  - Query params: `category`, `isActive`, `search`
  - Returns: Array of templates ordered by display_order and name

- `GET /api/containers/templates/:id` - Get template details
  - Returns: Full template configuration including Nix expression and defaults

- `POST /api/containers/templates` - Create new template (admin only)
  - Validates Nix expression syntax (balanced braces, parentheses, brackets)
  - Validates resource limits (CPU: 0.5-16 cores, Memory: 256MB-32GB, Disk: 1-500GB)
  - Validates multi-service configuration if applicable
  - Detects circular dependencies in multi-service templates

- `PATCH /api/containers/templates/:id` - Update template (admin only)
  - Supports partial updates
  - Re-validates Nix expression and resource limits if changed

- `DELETE /api/containers/templates/:id` - Delete template (admin only)
  - Prevents deletion if template is in use by any services
  - Returns error with count of services using the template

#### Validation Features

**Nix Expression Validation**:
- Checks for balanced braces, parentheses, and brackets
- Warns if no common Nix keywords found (with, let, in, rec, inherit, import, pkgs)
- Prevents empty expressions

**Resource Limits Validation**:
- CPU cores: 0.5 - 16
- Memory: 256 MB - 32 GB (32768 MB)
- Disk: 1 GB - 500 GB

**Multi-Service Validation**:
- Ensures at least one service defined
- Checks for duplicate service names
- Validates dependencies reference existing services
- Detects circular dependencies using graph traversal

### 2. Template Deployment (Task 8.2)

**Service**: `api/services/containers/ContainerService.ts` (added `deployFromTemplate` method)
**Routes**: `api/routes/containers/templates.ts` (POST `/:id/deploy`)

#### Single-Service Deployment

Endpoint: `POST /api/containers/templates/:id/deploy`

Request body:
```json
{
  "name": "my-app",
  "environmentVars": {
    "NODE_ENV": "production",
    "PORT": "3000"
  },
  "resourceLimits": {
    "cpuCores": 2,
    "memoryMb": 2048,
    "diskGb": 20
  }
}
```

Features:
- Pre-populates service configuration from template
- Applies template's Nix expression and default environment variables
- Merges custom environment variables with template defaults
- Uses custom resource limits or falls back to template defaults
- Validates organization quotas before deployment
- Creates service in 'pending' state ready for build

### 3. Multi-Service Template Support (Task 8.3)

**Service**: `api/services/containers/TemplateService.ts` (added multi-service methods)
**Routes**: `api/routes/containers/templates.ts`

#### Multi-Service Deployment

Endpoint: `POST /api/containers/templates/:id/deploy` (with `groupName`)

Request body:
```json
{
  "groupName": "my-stack",
  "environmentVars": {
    "database": {
      "POSTGRES_PASSWORD": "secret123"
    },
    "app": {
      "NODE_ENV": "production"
    }
  },
  "resourceLimits": {
    "database": {
      "cpuCores": 2,
      "memoryMb": 4096,
      "diskGb": 50
    },
    "app": {
      "cpuCores": 1,
      "memoryMb": 1024,
      "diskGb": 10
    }
  }
}
```

Features:
- **Dependency-Aware Deployment**: Uses topological sort to deploy services in correct order
- **Automatic Networking**: Configures internal networking between services
- **Connection Details Injection**: Automatically injects environment variables for service connections
  - `{SERVICE}_HOST`: Service hostname (e.g., `my-stack-database`)
  - `{SERVICE}_URL`: Full connection URL with default port (e.g., `my-stack-database:5432`)
- **Service Grouping**: All services share a common prefix for unified management
- **Default Port Detection**: Automatically determines ports for common services:
  - PostgreSQL: 5432
  - MySQL/MariaDB: 3306
  - MongoDB: 27017
  - Redis: 6379
  - Web/App: 3000
  - API: 8080

#### Multi-Service Group Deletion

Endpoint: `DELETE /api/containers/templates/groups/:groupName?confirmed=true`

Features:
- **Cascading Deletion**: Deletes all services in a group
- **User Confirmation**: Requires explicit confirmation to prevent accidental deletion
- **Two-Step Process**:
  1. First call without `confirmed=true` returns list of services to be deleted
  2. Second call with `confirmed=true` performs the deletion

#### Deployment Order Calculation

The system uses topological sort to ensure dependencies are deployed first:

Example template:
```json
{
  "services": [
    {
      "name": "database",
      "dependencies": []
    },
    {
      "name": "cache",
      "dependencies": []
    },
    {
      "name": "app",
      "dependencies": ["database", "cache"]
    }
  ]
}
```

Deployment order: `database → cache → app`

## Template Schema

```typescript
interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'api' | 'worker' | 'database' | 'static' | 'custom';
  iconUrl?: string;
  nixExpression: string;
  defaultEnvVars: Record<string, string>;
  defaultResourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  isActive: boolean;
  displayOrder: number;
  isMultiService: boolean;
  services?: {
    name: string;
    nixExpression: string;
    resourceLimits: {
      cpuCores: number;
      memoryMb: number;
      diskGb: number;
    };
    dependencies: string[];
    environmentVars: Record<string, string>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Example Multi-Service Templates

### MERN Stack
```json
{
  "name": "MERN Stack",
  "category": "web",
  "isMultiService": true,
  "services": [
    {
      "name": "mongodb",
      "nixExpression": "...",
      "dependencies": [],
      "resourceLimits": { "cpuCores": 1, "memoryMb": 2048, "diskGb": 20 }
    },
    {
      "name": "api",
      "nixExpression": "...",
      "dependencies": ["mongodb"],
      "resourceLimits": { "cpuCores": 1, "memoryMb": 1024, "diskGb": 10 }
    },
    {
      "name": "frontend",
      "nixExpression": "...",
      "dependencies": ["api"],
      "resourceLimits": { "cpuCores": 0.5, "memoryMb": 512, "diskGb": 5 }
    }
  ]
}
```

### WordPress Stack
```json
{
  "name": "WordPress",
  "category": "web",
  "isMultiService": true,
  "services": [
    {
      "name": "mysql",
      "nixExpression": "...",
      "dependencies": [],
      "resourceLimits": { "cpuCores": 1, "memoryMb": 2048, "diskGb": 20 }
    },
    {
      "name": "redis",
      "nixExpression": "...",
      "dependencies": [],
      "resourceLimits": { "cpuCores": 0.5, "memoryMb": 512, "diskGb": 5 }
    },
    {
      "name": "wordpress",
      "nixExpression": "...",
      "dependencies": ["mysql", "redis"],
      "resourceLimits": { "cpuCores": 1, "memoryMb": 1024, "diskGb": 10 }
    }
  ]
}
```

## Error Handling

### Validation Errors (400)
- Missing required fields
- Invalid category
- Invalid Nix expression syntax
- Invalid resource limits
- Circular dependencies in multi-service templates
- Missing groupName for multi-service deployment

### Authorization Errors (403)
- Non-admin users attempting to create/update/delete templates

### Not Found Errors (404)
- Template not found
- Multi-service group not found

### Conflict Errors (409)
- Template in use (cannot delete)

### Capacity Errors (507)
- Organization quota exceeded

## Security

- **Admin-Only Operations**: Create, update, and delete operations require admin role
- **Organization Isolation**: All deployments are scoped to user's organization
- **Quota Enforcement**: Validates organization quotas before deployment
- **Input Validation**: Comprehensive validation of all inputs including Nix expressions

## Integration Points

- **ContainerService**: Uses `ContainerServiceManager.createService()` for service creation
- **Database**: Queries `application_templates` and `container_services` tables
- **Authentication**: Uses `authenticateToken` middleware and checks `req.user.role`
- **Activity Logging**: Logs all template operations for audit trail

## Future Enhancements

- Template versioning
- Template marketplace/sharing
- Template preview/dry-run
- Cost estimation before deployment
- Health check configuration per service
- Custom port mapping
- Volume mount configuration
- Network policy configuration
