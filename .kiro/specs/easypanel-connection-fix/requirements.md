# Requirements Document: Easypanel Connection Test Fix

## Introduction

This document specifies the requirements for fixing the Easypanel API connection test functionality in SkyPanelV2. The current implementation fails to successfully test connections to Easypanel instances, preventing administrators from validating their API credentials before saving. This fix addresses API endpoint compatibility, request formatting, and error handling to ensure reliable connection testing.

## Glossary

- **Easypanel**: A container management platform that provides a TRPC-based API for deploying and managing Docker containers
- **TRPC**: TypeScript Remote Procedure Call - a framework for building type-safe APIs
- **Bearer Token**: An authentication token passed in the Authorization header as "Bearer {token}"
- **Connection Test**: A validation check that verifies API credentials can successfully communicate with the Easypanel instance
- **API Endpoint**: A specific URL path that accepts requests (e.g., `/api/trpc/projects.listProjects`)
- **Query Parameter Encoding**: The process of converting request parameters into URL query string format for GET requests
- **SkyPanelV2**: The platform application integrating Easypanel CaaS
- **Admin Dashboard**: The administrative interface for managing platform settings

## Requirements

### Requirement 1

**User Story:** As a platform administrator, I want to test Easypanel API credentials before saving them, so that I can verify connectivity without committing invalid configuration

#### Acceptance Criteria

1. WHEN the administrator enters an API URL and API key, THE SkyPanelV2 SHALL enable the "Test Connection" button
2. WHEN the administrator clicks "Test Connection", THE SkyPanelV2 SHALL send the credentials to the backend test endpoint
3. THE SkyPanelV2 SHALL display a loading indicator while the test is in progress
4. WHEN the test succeeds, THE SkyPanelV2 SHALL display a success message with green styling
5. WHEN the test fails, THE SkyPanelV2 SHALL display an error message with red styling and include failure details
6. THE SkyPanelV2 SHALL allow testing credentials multiple times without saving
7. THE SkyPanelV2 SHALL clear previous test results when the user modifies the API URL or API key

### Requirement 2

**User Story:** As the backend API, I want to accept temporary credentials for connection testing, so that administrators can validate credentials before persisting them to the database

#### Acceptance Criteria

1. WHEN the test endpoint receives a request with apiUrl in the body, THE SkyPanelV2 SHALL use the provided URL for testing
2. WHEN the test endpoint receives a request with apiKey in the body, THE SkyPanelV2 SHALL use the provided key for testing
3. WHEN the test endpoint receives a request without credentials, THE SkyPanelV2 SHALL fall back to testing saved configuration
4. THE SkyPanelV2 SHALL normalize the API URL by removing trailing slashes and duplicate path segments
5. THE SkyPanelV2 SHALL construct the test request URL as `{baseUrl}/api/trpc/projects.listProjects`
6. THE SkyPanelV2 SHALL include the Bearer token in the Authorization header
7. WHEN the Easypanel API returns a 200 status, THE SkyPanelV2 SHALL consider the test successful
8. WHEN the Easypanel API returns a non-200 status, THE SkyPanelV2 SHALL return an error with the status code and response text

### Requirement 3

**User Story:** As the Easypanel service, I want to use the correct HTTP method for GET endpoints, so that API requests conform to the Easypanel API specification

#### Acceptance Criteria

1. WHEN calling the projects.listProjects endpoint, THE EasypanelService SHALL use the GET HTTP method
2. WHEN calling the projects.inspectProject endpoint, THE EasypanelService SHALL use the GET HTTP method
3. WHEN calling the services.app.inspectService endpoint, THE EasypanelService SHALL use the GET HTTP method
4. WHEN calling the projects.getDockerContainers endpoint, THE EasypanelService SHALL use the GET HTTP method
5. WHEN calling the services.common.getServiceError endpoint, THE EasypanelService SHALL use the GET HTTP method
6. WHEN making a GET request with parameters, THE EasypanelService SHALL encode parameters as a query string
7. THE EasypanelService SHALL format query parameters as `?input={"json":{...parameters...}}`
8. WHEN making a POST request, THE EasypanelService SHALL include parameters in the request body as `{"json":{...parameters...}}`

### Requirement 4

**User Story:** As the Easypanel service, I want to construct API URLs correctly, so that requests reach the proper Easypanel endpoints

#### Acceptance Criteria

1. WHEN the configured API URL ends with a trailing slash, THE EasypanelService SHALL remove it
2. WHEN the configured API URL ends with `/api/trpc`, THE EasypanelService SHALL remove it
3. WHEN constructing a request URL, THE EasypanelService SHALL format it as `{baseUrl}/api/trpc/{endpoint}`
4. THE EasypanelService SHALL accept API URLs in the format `https://example.easypanel.host`
5. THE EasypanelService SHALL accept API URLs in the format `https://example.easypanel.host/`
6. THE EasypanelService SHALL accept API URLs in the format `https://example.easypanel.host/api/trpc`
7. THE EasypanelService SHALL produce the same normalized URL regardless of input format

### Requirement 5

**User Story:** As the Easypanel service, I want to use a valid endpoint for connection testing, so that the test accurately reflects API accessibility

#### Acceptance Criteria

1. WHEN testing the connection, THE EasypanelService SHALL call the projects.listProjects endpoint
2. THE EasypanelService SHALL NOT call the auth.getUser endpoint as it does not exist in the Easypanel API
3. WHEN the projects.listProjects endpoint returns successfully, THE EasypanelService SHALL return true from testConnection
4. WHEN the projects.listProjects endpoint fails, THE EasypanelService SHALL return false from testConnection
5. THE EasypanelService SHALL log connection test failures with error details

### Requirement 6

**User Story:** As the Easypanel service, I want to correctly encode parameters for GET requests, so that the Easypanel API can parse them

#### Acceptance Criteria

1. WHEN making a GET request with a body parameter, THE EasypanelService SHALL convert the body to a query string
2. THE EasypanelService SHALL create a URLSearchParams object with key "input"
3. THE EasypanelService SHALL set the input value to `JSON.stringify({ json: body })`
4. THE EasypanelService SHALL append the query string to the URL with a `?` separator
5. THE EasypanelService SHALL NOT include a request body for GET requests
6. WHEN making a POST request, THE EasypanelService SHALL include the body as `JSON.stringify({ json: body })`

### Requirement 7

**User Story:** As the backend API, I want to provide detailed error messages for connection failures, so that administrators can diagnose configuration issues

#### Acceptance Criteria

1. WHEN the Easypanel API returns a 401 status, THE SkyPanelV2 SHALL indicate invalid API key
2. WHEN the Easypanel API returns a 404 status, THE SkyPanelV2 SHALL indicate invalid API URL or endpoint
3. WHEN the Easypanel API returns a 500 status, THE SkyPanelV2 SHALL indicate server error
4. WHEN the connection times out, THE SkyPanelV2 SHALL indicate network connectivity issue
5. WHEN the connection is refused, THE SkyPanelV2 SHALL indicate the Easypanel instance is not reachable
6. THE SkyPanelV2 SHALL include the HTTP status code in error responses
7. THE SkyPanelV2 SHALL include the error response text from Easypanel in error details

### Requirement 8

**User Story:** As a platform administrator, I want clear visual feedback during connection testing, so that I understand the test status

#### Acceptance Criteria

1. WHEN the test is in progress, THE SkyPanelV2 SHALL disable the "Test Connection" button
2. WHEN the test is in progress, THE SkyPanelV2 SHALL display "Testing..." as the button text
3. WHEN the test completes, THE SkyPanelV2 SHALL re-enable the "Test Connection" button
4. WHEN the test completes, THE SkyPanelV2 SHALL restore the button text to "Test Connection"
5. WHEN the test succeeds, THE SkyPanelV2 SHALL display a green alert with success message
6. WHEN the test fails, THE SkyPanelV2 SHALL display a red alert with error message
7. THE SkyPanelV2 SHALL display the alert below the API key input field

### Requirement 9

**User Story:** As the backend API, I want to log connection test attempts, so that administrators can audit configuration changes

#### Acceptance Criteria

1. WHEN a connection test is performed, THE SkyPanelV2 SHALL log an activity event
2. THE SkyPanelV2 SHALL set the event type to "container.config.test"
3. THE SkyPanelV2 SHALL include the test status (success or failed) in the activity metadata
4. THE SkyPanelV2 SHALL include the API URL in the activity metadata
5. THE SkyPanelV2 SHALL include whether the test used temporary credentials in the activity metadata
6. THE SkyPanelV2 SHALL NOT include the API key in the activity log
7. THE SkyPanelV2 SHALL associate the activity with the admin user who performed the test

### Requirement 10

**User Story:** As the Easypanel service, I want to handle TRPC response format correctly, so that I can extract data from API responses

#### Acceptance Criteria

1. WHEN the Easypanel API returns a response, THE EasypanelService SHALL check for a result.data property
2. WHEN result.data exists, THE EasypanelService SHALL return result.data
3. WHEN result.data does not exist, THE EasypanelService SHALL return the entire response object
4. THE EasypanelService SHALL handle responses that are arrays
5. THE EasypanelService SHALL handle responses that are objects
6. THE EasypanelService SHALL handle empty responses gracefully
