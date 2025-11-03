# Design Document: Easypanel Connection Test Fix

## Overview

This design document outlines the technical approach to fix the Easypanel API connection test functionality. The current implementation has several issues preventing successful connection tests:

1. Incorrect HTTP methods (using POST for GET endpoints)
2. Invalid test endpoint (auth.getUser doesn't exist)
3. Improper query parameter encoding for GET requests
4. URL normalization issues
5. Missing support for testing temporary credentials

The fix will update the EasypanelService class and the test connection API route to properly communicate with the Easypanel TRPC API.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         EasypanelConfig Component                     │  │
│  │  - API URL Input                                      │  │
│  │  - API Key Input                                      │  │
│  │  - Test Connection Button                            │  │
│  │  - Status Display                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/containers/admin/config/test
                            │ { apiUrl, apiKey }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Route                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   POST /api/containers/admin/config/test             │  │
│  │   - Accept temporary credentials                     │  │
│  │   - Normalize URL                                    │  │
│  │   - Make direct fetch call to Easypanel              │  │
│  │   - Return success/failure                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ GET {baseUrl}/api/trpc/projects.listProjects
                            │ Authorization: Bearer {apiKey}
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Easypanel API                           │
│  - TRPC-based endpoints                                     │
│  - Bearer token authentication                              │
│  - JSON responses with result.data wrapper                  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. EasypanelService Updates

#### URL Normalization

```typescript
private async getBaseUrl(): Promise<string> {
  const config = await this.loadConfig();
  if (!config) {
    throw createConfigError('Easypanel not configured');
  }

  // Remove trailing slashes and ensure we have the base URL
  let baseUrl = config.apiUrl.replace(/\/+$/, '');
  
  // Remove /api/trpc if it's already in the URL
  baseUrl = baseUrl.replace(/\/api\/trpc$/, '');
  
  return baseUrl;
}
```

**Logic:**
1. Remove all trailing slashes using regex `/\/+$/`
2. Remove `/api/trpc` suffix if present using regex `/\/api\/trpc$/`
3. Return clean base URL (e.g., `https://v1lkkr.easypanel.host`)

#### Request Method Handling

```typescript
private async makeRequest(endpoint: string, options: {
  method?: string;
  body?: any;
} = {}): Promise<any> {
  const baseUrl = await this.getBaseUrl();
  const apiKey = await this.getApiKey();

  const { method = 'POST', body } = options;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  let url = `${baseUrl}/api/trpc/${endpoint}`;
  const requestOptions: RequestInit = {
    method,
    headers,
  };

  // For GET requests with parameters, add to query string
  if (method === 'GET' && body) {
    const params = new URLSearchParams();
    params.append('input', JSON.stringify({ json: body }));
    url += `?${params.toString()}`;
  }
  // For POST requests, wrap body in json property
  else if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify({ json: body });
  }

  // ... fetch and response handling
}
```

**Key Changes:**
1. Build full URL with `/api/trpc/` prefix
2. For GET requests: encode body as query parameter `?input={"json":{...}}`
3. For POST requests: include body as `{"json":{...}}`
4. Never include body in GET requests

#### Connection Test Method

```typescript
async testConnection(): Promise<boolean> {
  try {
    // Use listProjects as a simple test endpoint
    await this.makeRequest('projects.listProjects', { method: 'GET' });
    return true;
  } catch (error) {
    console.error('Easypanel connection test failed:', error);
    return false;
  }
}
```

**Rationale:**
- `projects.listProjects` is a valid, simple endpoint that requires authentication
- Returns quickly without side effects
- Confirms both authentication and API accessibility

### 2. Test Connection API Route

#### Enhanced Route Handler

```typescript
router.post('/admin/config/test', requireAdminRole, async (req: AuthenticatedRequest, res: Response, next: any) => {
  const { apiUrl: testApiUrl, apiKey: testApiKey } = req.body;

  try {
    // If test credentials are provided, test them directly
    if (testApiUrl || testApiKey) {
      const currentConfig = await easypanelService.getActiveConfig();
      
      const urlToTest = testApiUrl || currentConfig?.apiUrl;
      const keyToTest = testApiKey || getCurrentApiKey(currentConfig);
      
      if (!urlToTest || !keyToTest) {
        return res.status(400).json({
          error: {
            code: ERROR_CODES.CONFIG_NOT_FOUND,
            message: 'API URL and API Key are required for testing'
          }
        });
      }

      // Normalize URL
      let baseUrl = urlToTest.replace(/\/+$/, '').replace(/\/api\/trpc$/, '');
      const testUrl = `${baseUrl}/api/trpc/projects.listProjects`;
      
      // Make direct fetch call
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${keyToTest}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return res.status(400).json({
          error: {
            code: ERROR_CODES.EASYPANEL_CONNECTION_FAILED,
            message: `Failed to connect to Easypanel: ${response.status} ${response.statusText}`,
            details: { 
              status: 'failed',
              statusCode: response.status,
              error: errorText
            }
          }
        });
      }

      // Success
      await logActivity({
        userId: req.user!.id,
        organizationId: req.user!.organizationId!,
        eventType: 'container.config.test',
        entityType: 'easypanel_config',
        entityId: null,
        status: 'success',
        metadata: { status: 'success', apiUrl: urlToTest, testMode: true }
      });

      return res.json({
        success: true,
        message: 'Connection to Easypanel successful',
        status: 'success'
      });
    }

    // Otherwise, test saved configuration
    // ... existing logic
  } catch (error) {
    // ... error handling
  }
});
```

**Key Features:**
1. Accepts temporary credentials in request body
2. Falls back to saved config if no credentials provided
3. Makes direct fetch call for testing (bypasses service layer)
4. Returns detailed error information
5. Logs test attempts for auditing

## Data Models

### Request/Response Types

```typescript
// Test connection request
interface TestConnectionRequest {
  apiUrl?: string;
  apiKey?: string;
}

// Test connection response (success)
interface TestConnectionSuccess {
  success: true;
  message: string;
  status: 'success';
}

// Test connection response (failure)
interface TestConnectionFailure {
  error: {
    code: string;
    message: string;
    details: {
      status: 'failed';
      statusCode?: number;
      error?: string;
    };
  };
}
```

## Error Handling

### Error Categories and Messages

| HTTP Status | Error Code | User Message | Technical Details |
|------------|------------|--------------|-------------------|
| 401 | EASYPANEL_AUTH_FAILED | Invalid API key. Please check your credentials. | Unauthorized - Bearer token rejected |
| 404 | EASYPANEL_ENDPOINT_NOT_FOUND | Invalid API URL or endpoint not found. | Endpoint does not exist |
| 500 | EASYPANEL_SERVER_ERROR | Easypanel server error. Please try again later. | Internal server error |
| ECONNREFUSED | EASYPANEL_CONNECTION_REFUSED | Cannot reach Easypanel instance. Check URL and network. | Connection refused |
| ETIMEDOUT | EASYPANEL_TIMEOUT | Connection timed out. Check URL and network. | Request timeout |

### Error Response Format

```typescript
{
  error: {
    code: 'EASYPANEL_CONNECTION_FAILED',
    message: 'Failed to connect to Easypanel: 401 Unauthorized',
    details: {
      status: 'failed',
      statusCode: 401,
      error: 'Invalid bearer token'
    }
  }
}
```

## Testing Strategy

### Manual Testing Checklist

- [ ] Test with URL: `https://v1lkkr.easypanel.host`
- [ ] Test with URL: `https://v1lkkr.easypanel.host/`
- [ ] Test with URL: `https://v1lkkr.easypanel.host/api/trpc`
- [ ] Test with valid API key
- [ ] Test with invalid API key (should show 401 error)
- [ ] Test with invalid URL (should show connection error)
- [ ] Test with empty API key (should show validation error)
- [ ] Test with empty URL (should show validation error)
- [ ] Verify success message displays in green
- [ ] Verify error message displays in red
- [ ] Verify button shows "Testing..." during test
- [ ] Verify button is disabled during test
- [ ] Verify test result clears when URL changes
- [ ] Verify test result clears when API key changes
- [ ] Verify activity log records test attempts
- [ ] Verify saved config can be tested
- [ ] Verify temporary credentials can be tested

### Integration Test Scenarios

```typescript
describe('Easypanel Connection Test', () => {
  it('should successfully test valid credentials', async () => {
    const response = await request(app)
      .post('/api/containers/admin/config/test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apiUrl: 'https://v1lkkr.easypanel.host',
        apiKey: 'valid-api-key'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should fail with invalid API key', async () => {
    const response = await request(app)
      .post('/api/containers/admin/config/test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apiUrl: 'https://v1lkkr.easypanel.host',
        apiKey: 'invalid-key'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('EASYPANEL_CONNECTION_FAILED');
  });

  it('should normalize URLs correctly', async () => {
    const urls = [
      'https://v1lkkr.easypanel.host',
      'https://v1lkkr.easypanel.host/',
      'https://v1lkkr.easypanel.host/api/trpc',
      'https://v1lkkr.easypanel.host/api/trpc/'
    ];

    for (const url of urls) {
      const response = await request(app)
        .post('/api/containers/admin/config/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          apiUrl: url,
          apiKey: 'valid-api-key'
        });
      
      expect(response.status).toBe(200);
    }
  });
});
```

## Security Considerations

1. **API Key Protection**: API keys are never logged or exposed in error messages
2. **Admin-Only Access**: Test endpoint requires admin role
3. **Rate Limiting**: Test endpoint subject to admin rate limits
4. **Audit Logging**: All test attempts logged with user ID and timestamp
5. **Temporary Testing**: Credentials can be tested without persisting to database

## Performance Considerations

1. **Direct Fetch**: Test route uses direct fetch instead of service layer for faster response
2. **Timeout Handling**: Implement 10-second timeout for connection tests
3. **No Caching**: Test results not cached to ensure fresh validation
4. **Minimal Payload**: Use lightweight `projects.listProjects` endpoint

## Migration Strategy

### Deployment Steps

1. Deploy updated `easypanelService.ts` with fixed HTTP methods
2. Deploy updated `containers.ts` route with test credential support
3. No database changes required
4. No frontend changes required (already supports test functionality)
5. Clear any cached Easypanel configurations

### Rollback Plan

If issues occur:
1. Revert `easypanelService.ts` to previous version
2. Revert `containers.ts` route to previous version
3. Restart backend server

## Success Criteria

The fix is successful when:
1. Connection test succeeds with valid Easypanel credentials
2. Connection test fails gracefully with invalid credentials
3. All URL formats are normalized correctly
4. Error messages provide actionable feedback
5. Activity logs record test attempts
6. No regression in existing Easypanel functionality
