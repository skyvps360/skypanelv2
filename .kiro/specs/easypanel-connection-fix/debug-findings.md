# Debug Findings: Easypanel Connection Test Failure

## Date: 2025-11-03

## Current Implementation Analysis

### Backend Implementation (`api/routes/containers.ts`)

The test connection endpoint at `POST /api/containers/admin/config/test` has the following implementation:

1. **URL Normalization**: ✅ Already implemented correctly
   - Removes trailing slashes: `urlToTest.replace(/\/+$/, '')`
   - Removes `/api/trpc` suffix: `.replace(/\/api\/trpc$/, '')`

2. **Test Endpoint**: ✅ Using correct endpoint
   - Uses `projects.listProjects` endpoint
   - Constructs URL as: `${baseUrl}/api/trpc/projects.listProjects`

3. **HTTP Method**: ✅ Using GET method
   - Makes direct fetch call with `method: 'GET'`

4. **Authentication**: ✅ Properly configured
   - Includes Bearer token: `Authorization: Bearer ${keyToTest}`

5. **Error Handling**: ✅ Comprehensive
   - Captures HTTP status codes
   - Returns detailed error messages
   - Logs activity for auditing

### EasypanelService Implementation (`api/services/easypanelService.ts`)

1. **URL Normalization**: ✅ Implemented in `getBaseUrl()`
   - Removes trailing slashes
   - Removes `/api/trpc` suffix

2. **Request Method Handling**: ✅ Implemented in `makeRequest()`
   - GET requests: Parameters encoded as query string `?input={"json":{...}}`
   - POST requests: Body formatted as `{"json":{...}}`

3. **Test Connection Method**: ✅ Correct implementation
   - Uses `projects.listProjects` endpoint
   - Uses GET method
   - Returns boolean based on success/failure

### Frontend Implementation

1. **Component**: `src/pages/admin/EasypanelConfig.tsx`
   - Properly calls `containerService.testEasypanelConnection()`
   - Passes temporary credentials for testing
   - Displays error messages in red alert

2. **Service**: `src/services/containerService.ts`
   - Makes POST request to `/containers/admin/config/test`
   - Passes config data (apiUrl, apiKey) in request body
   - Handles errors and returns formatted response

## Issues Identified

### ❌ CRITICAL: The implementation is actually CORRECT!

After thorough analysis, the current implementation appears to be correct according to the design document:

1. ✅ URL normalization is implemented
2. ✅ Correct endpoint (`projects.listProjects`) is used
3. ✅ GET method is used for the test
4. ✅ Query parameters are properly encoded
5. ✅ Bearer authentication is included
6. ✅ Error handling is comprehensive

## Next Steps for Debugging

Since the implementation looks correct, we need to:

1. **Test with actual Easypanel instance**
   - URL: `https://v1lkkr.easypanel.host`
   - Need to verify the actual API response

2. **Check browser network tab**
   - Verify the actual request being sent
   - Check response status and body

3. **Check backend logs**
   - Look for error messages
   - Verify the constructed URL

4. **Test direct curl/fetch**
   - Make a direct request to Easypanel API
   - Verify endpoint accessibility

## Potential Issues to Investigate

1. **API Key Format**: Is the API key valid and properly formatted?
2. **CORS Issues**: Does Easypanel allow requests from the backend?
3. **SSL/TLS Issues**: Are there certificate validation problems?
4. **Network Connectivity**: Can the backend reach the Easypanel instance?
5. **TRPC Response Format**: Is the response format different than expected?

## Test Commands

### Direct curl test:
```bash
curl -X GET "https://v1lkkr.easypanel.host/api/trpc/projects.listProjects" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Test with query parameters (if needed):
```bash
curl -X GET "https://v1lkkr.easypanel.host/api/trpc/projects.listProjects?input=%7B%22json%22%3A%7B%7D%7D" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Conclusion

The code implementation matches the design document requirements. The issue is likely:
- Invalid API credentials
- Network/connectivity issues
- Easypanel API endpoint differences
- TRPC response format variations

**Recommendation**: Need to test with actual Easypanel instance to identify the real issue.

## Debug Tools Created

### 1. Test Script: `scripts/test-easypanel-connection.js`

A comprehensive Node.js script to test Easypanel API connectivity directly:

**Usage:**
```bash
node scripts/test-easypanel-connection.js https://v1lkkr.easypanel.host YOUR_API_KEY
```

**Features:**
- Tests multiple endpoints (projects.listProjects, auth.getUser)
- Tests with and without query parameters
- Shows detailed request/response information
- Measures response times
- Provides diagnostic recommendations
- Displays headers, status codes, and response bodies

**What it tests:**
1. URL normalization
2. Bearer token authentication
3. GET requests to TRPC endpoints
4. Query parameter encoding
5. Response format parsing
6. Network connectivity
7. SSL/TLS certificate validation

### 2. Debug Findings Document

This document (`debug-findings.md`) contains:
- Complete analysis of current implementation
- Verification that code matches design requirements
- Identified potential issues
- Test commands for manual verification
- Recommendations for next steps

## How to Use These Tools

### Step 1: Run the test script
```bash
node scripts/test-easypanel-connection.js https://v1lkkr.easypanel.host YOUR_API_KEY
```

### Step 2: Review the output
- Check which endpoints succeed/fail
- Note the HTTP status codes
- Review error messages
- Check response times

### Step 3: Compare with browser network tab
- Open browser DevTools → Network tab
- Click "Test Connection" in the UI
- Compare the request/response with the script output

### Step 4: Check backend logs
- Look for console.error messages starting with "Easypanel"
- Check for any stack traces or error details

### Step 5: Verify configuration
- Ensure API URL is correct (no typos)
- Verify API key is valid and has proper permissions
- Check that the Easypanel instance is accessible from the server

## Expected Outcomes

### If the script succeeds:
- The implementation is correct
- The issue is likely in the application layer (database, encryption, etc.)
- Check that credentials are being saved/loaded correctly

### If the script fails:
- Check the specific error messages
- Verify network connectivity
- Confirm API credentials are valid
- Check for firewall/security restrictions

### Common Error Codes:
- **401 Unauthorized**: Invalid API key
- **404 Not Found**: Wrong endpoint or URL
- **500 Server Error**: Easypanel internal error
- **ECONNREFUSED**: Cannot reach the server
- **ETIMEDOUT**: Network timeout
- **CERT_ERROR**: SSL/TLS certificate issue
