# EasyPanel OpenAPI Operations Reference

## 1. Overview

This document provides a comprehensive reference for all EasyPanel OpenAPI operations used in the SkyPANEL subscription workflow integration. Each operation includes request/response examples, error codes, and implementation details.

## 2. Authentication

All EasyPanel API requests require a Bearer token for authentication:

```http
Authorization: Bearer ${EASYPANEL_API_KEY}
```

## 3. User Management Operations

### 3.1 Create User

**Operation:** `users.createUser`
**Endpoint:** `POST /api/trpc/users.createUser`
**Purpose:** Create a new EasyPanel user account

#### Request
```json
{
  "email": "user@example.com",
  "password": "secure-random-password",
  "admin": false
}
```

#### Response (Success - 200)
```json
{
  "id": "user-123456",
  "email": "user@example.com",
  "admin": false,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Response (Error - 409)
```json
{
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "User with this email already exists"
  }
}
```

#### Implementation Notes
- Password must be at least 8 characters
- Email must be unique across the EasyPanel instance
- Admin flag determines if user has administrative privileges

### 3.2 List Users

**Operation:** `users.listUsers`
**Endpoint:** `POST /api/trpc/users.listUsers`
**Purpose:** Retrieve all users in the EasyPanel instance

#### Request
```json
{}
```

#### Response (Success - 200)
```json
{
  "users": [
    {
      "id": "user-123456",
      "email": "user@example.com",
      "admin": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Implementation Notes
- Used to check if user already exists before creation
- Returns array of all users in the system

### 3.3 Update User

**Operation:** `users.updateUser`
**Endpoint:** `POST /api/trpc/users.updateUser`
**Purpose:** Update user details

#### Request
```json
{
  "userId": "user-123456",
  "email": "newemail@example.com",
  "admin": true
}
```

#### Response (Success - 200)
```json
{
  "id": "user-123456",
  "email": "newemail@example.com",
  "admin": true,
  "updatedAt": "2024-01-16T10:30:00Z"
}
```

## 4. Project Management Operations

### 4.1 Create Project

**Operation:** `projects.createProject`
**Endpoint:** `POST /api/trpc/projects.createProject`
**Purpose:** Create a new EasyPanel project

#### Request
```json
{
  "name": "my-awesome-project"
}
```

#### Response (Success - 201)
```json
{
  "name": "my-awesome-project",
  "createdAt": "2024-01-15T10:35:00Z",
  "status": "active",
  "owner": "system"
}
```

#### Response (Error - 409)
```json
{
  "error": {
    "code": "PROJECT_ALREADY_EXISTS",
    "message": "Project with this name already exists"
  }
}
```

#### Implementation Notes
- Project name must be unique
- Name should be alphanumeric with hyphens/underscores only
- Maximum 50 characters

### 4.2 List Projects

**Operation:** `projects.listProjects`
**Endpoint:** `POST /api/trpc/projects.listProjects`
**Purpose:** Retrieve all projects

#### Request
```json
{}
```

#### Response (Success - 200)
```json
{
  "projects": [
    {
      "name": "my-awesome-project",
      "createdAt": "2024-01-15T10:35:00Z",
      "status": "active",
      "owner": "system"
    }
  ]
}
```

### 4.3 Inspect Project

**Operation:** `projects.inspectProject`
**Endpoint:** `POST /api/trpc/projects.inspectProject`
**Purpose:** Get detailed project information

#### Request
```json
{
  "projectName": "my-awesome-project"
}
```

#### Response (Success - 200)
```json
{
  "name": "my-awesome-project",
  "createdAt": "2024-01-15T10:35:00Z",
  "status": "active",
  "owner": "system",
  "services": [
    {
      "name": "web-app",
      "type": "app",
      "status": "running"
    }
  ],
  "users": [
    {
      "id": "user-123456",
      "email": "user@example.com",
      "access": "read-write"
    }
  ]
}
```

### 4.4 Destroy Project

**Operation:** `projects.destroyProject`
**Endpoint:** `POST /api/trpc/projects.destroyProject`
**Purpose:** Delete a project and all its resources

#### Request
```json
{
  "projectName": "my-awesome-project"
}
```

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Project 'my-awesome-project' has been deleted",
  "deletedServices": 3,
  "deletedResources": 5
}
```

#### Response (Error - 404)
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project 'my-awesome-project' not found"
  }
}
```

#### Implementation Notes
- This is a destructive operation
- All services and resources within the project are deleted
- Cannot be undone

### 4.5 Update Project Access

**Operation:** `projects.updateAccess`
**Endpoint:** `POST /api/trpc/projects.updateAccess`
**Purpose:** Grant or revoke user access to a project

#### Request
```json
{
  "projectName": "my-awesome-project",
  "userId": "user-123456",
  "access": true
}
```

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "User access updated",
  "projectName": "my-awesome-project",
  "userId": "user-123456",
  "access": "granted"
}
```

#### Implementation Notes
- `access: true` grants read-write access
- `access: false` revokes all access
- User must exist in the system

## 5. Service Management Operations

### 5.1 Get Docker Containers

**Operation:** `projects.getDockerContainers`
**Endpoint:** `POST /api/trpc/projects.getDockerContainers`
**Purpose:** List Docker containers in a project

#### Request
```json
{
  "projectName": "my-awesome-project"
}
```

#### Response (Success - 200)
```json
{
  "containers": [
    {
      "id": "container-123",
      "name": "web-app",
      "image": "nginx:latest",
      "status": "running",
      "ports": ["80:8080"],
      "createdAt": "2024-01-15T10:36:00Z"
    }
  ]
}
```

### 5.2 Get Service Error

**Operation:** `services.getServiceError`
**Endpoint:** `POST /api/trpc/services.getServiceError`
**Purpose:** Get error details for a failed service

#### Request
```json
{
  "projectName": "my-awesome-project",
  "serviceName": "web-app"
}
```

#### Response (Success - 200)
```json
{
  "serviceName": "web-app",
  "error": {
    "message": "Container failed to start",
    "code": "CONTAINER_START_FAILED",
    "timestamp": "2024-01-15T10:40:00Z",
    "logs": [
      "Error: Cannot connect to database",
      "at startup (/app/server.js:45:15)"
    ]
  }
}
```

## 6. Error Codes Reference

### 6.1 Common Error Codes

| Error Code | HTTP Status | Description | Resolution |
|------------|-------------|-------------|------------|
| `INVALID_API_KEY` | 401 | Invalid or expired API key | Check API key configuration |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions | Verify user roles and permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist | Check resource name/ID |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource with same identifier exists | Use different name or check existing resources |
| `VALIDATION_ERROR` | 400 | Invalid request parameters | Validate input data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Implement rate limiting and retry logic |
| `INTERNAL_SERVER_ERROR` | 500 | EasyPanel server error | Retry request or contact support |
| `SERVICE_UNAVAILABLE` | 503 | EasyPanel temporarily unavailable | Implement exponential backoff retry |

### 6.2 User-Specific Error Codes

| Error Code | Description |
|------------|-------------|
| `USER_ALREADY_EXISTS` | User with this email already exists |
| `USER_NOT_FOUND` | User does not exist |
| `INVALID_EMAIL_FORMAT` | Email format is invalid |
| `WEAK_PASSWORD` | Password does not meet security requirements |

### 6.3 Project-Specific Error Codes

| Error Code | Description |
|------------|-------------|
| `PROJECT_ALREADY_EXISTS` | Project with this name already exists |
| `PROJECT_NOT_FOUND` | Project does not exist |
| `INVALID_PROJECT_NAME` | Project name format is invalid |
| `PROJECT_HAS_SERVICES` | Cannot delete project with active services |

## 7. Rate Limiting

### 7.1 Rate Limits
- **User operations:** 100 requests per minute
- **Project operations:** 50 requests per minute
- **Service operations:** 200 requests per minute

### 7.2 Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642257600
```

## 8. Idempotency Implementation

### 8.1 Idempotency Key Format
```typescript
// Format: skypanel-{operation}-{organizationId}-{timestamp}-{random}
const idempotencyKey = `skypanel-subscribe-${organizationId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
```

### 8.2 Idempotency Key Usage
```typescript
// Add to request headers
const headers = {
  'Authorization': `Bearer ${EASYPANEL_API_KEY}`,
  'X-Idempotency-Key': idempotencyKey
};
```

### 8.3 Idempotency Key Lifetime
- Keys are valid for 24 hours
- After expiration, operations are treated as new requests
- Same key with different parameters returns an error

## 9. Request/Response Examples

### 9.1 Complete Subscription Workflow Example

```typescript
// Step 1: Check if user exists
const existingUsers = await easypanelService.listUsers();
const existingUser = existingUsers.find(u => u.email === userEmail);

if (!existingUser) {
  // Step 2: Create new user
  const newUser = await easypanelService.createUser(userEmail, generatedPassword, false);
  userId = newUser.id;
} else {
  userId = existingUser.id;
}

// Step 3: Create project
const projectName = sanitizeProjectName(organizationName);
const newProject = await easypanelService.createProject(projectName);

// Step 4: Grant user access to project
await easypanelService.updateProjectAccess(projectName, userId, true);

// Step 5: Verify project creation
const projectDetails = await easypanelService.inspectProject(projectName);
```

### 9.2 Complete Cancellation Workflow Example

```typescript
// Step 1: Get all organization projects
const projects = await getOrganizationProjects(organizationId);

// Step 2: Delete each project (cascading delete)
for (const project of projects) {
  try {
    await easypanelService.destroyProject(project.easypanelProjectName);
    
    // Remove from database
    await deleteProjectRecord(project.id);
    
    logger.info('Project deleted successfully', {
      projectName: project.easypanelProjectName,
      projectId: project.id
    });
  } catch (error) {
    logger.error('Failed to delete project', {
      projectName: project.easypanelProjectName,
      error: error.message
    });
    // Continue with other projects
  }
}
```

## 10. Implementation Checklist

### 10.1 Pre-Implementation
- [ ] Review EasyPanel OpenAPI documentation
- [ ] Set up EasyPanel API key with appropriate permissions
- [ ] Configure rate limiting in application
- [ ] Set up structured logging for API calls
- [ ] Implement idempotency key generation

### 10.2 User Creation
- [ ] Implement user existence check
- [ ] Handle user creation with retry logic
- [ ] Handle "user already exists" scenario
- [ ] Store EasyPanel user ID in database
- [ ] Log user creation attempts and results

### 10.3 Project Creation
- [ ] Implement project name sanitization
- [ ] Handle project name collisions
- [ ] Implement project creation retry logic
- [ ] Grant user access to project
- [ ] Store project details in database
- [ ] Log project creation attempts and results

### 10.4 Error Handling
- [ ] Implement comprehensive error handling
- [ ] Add retry logic for transient failures
- [ ] Implement exponential backoff for retries
- [ ] Log all errors with context
- [ ] Transform EasyPanel errors to application errors

### 10.5 Transaction Management
- [ ] Wrap operations in database transactions
- [ ] Implement rollback on failure
- [ ] Ensure data consistency
- [ ] Handle partial failures gracefully

### 10.6 Testing
- [ ] Unit tests for all service methods
- [ ] Integration tests with mocked EasyPanel API
- [ ] Error scenario testing
- [ ] Performance testing
- [ ] Load testing for concurrent operations

### 10.7 Monitoring and Logging
- [ ] Implement structured JSON logging
- [ ] Add request/response logging
- [ ] Log elapsed time for operations
- [ ] Add error tracking and alerting
- [ ] Set up performance monitoring

### 10.8 Documentation
- [ ] Document all API operations used
- [ ] Create troubleshooting guide
- [ ] Document error codes and resolutions
- [ ] Create deployment checklist
- [ ] Document rollback procedures

This reference document serves as the authoritative source for all EasyPanel API operations used in the SkyPANEL subscription workflow integration. All implementations should follow these specifications to ensure consistency and reliability.