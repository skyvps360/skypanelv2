/**
 * Frontend Container Error Handling Utilities
 * Provides user-friendly error messages and error handling for container operations
 */

// ============================================================
// Error Types
// ============================================================

export interface ContainerError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ============================================================
// Error Code Constants
// ============================================================

export const ERROR_CODES = {
  // Configuration Errors
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_UPDATE_FAILED: 'CONFIG_UPDATE_FAILED',
  
  // Authentication Errors
  EASYPANEL_AUTH_FAILED: 'EASYPANEL_AUTH_FAILED',
  EASYPANEL_ACCESS_DENIED: 'EASYPANEL_ACCESS_DENIED',
  EASYPANEL_CONNECTION_FAILED: 'EASYPANEL_CONNECTION_FAILED',
  
  // Validation Errors
  INVALID_PROJECT_NAME: 'INVALID_PROJECT_NAME',
  INVALID_SERVICE_NAME: 'INVALID_SERVICE_NAME',
  INVALID_RESOURCE_CONFIG: 'INVALID_RESOURCE_CONFIG',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  
  // Quota Errors
  QUOTA_EXCEEDED_CPU: 'QUOTA_EXCEEDED_CPU',
  QUOTA_EXCEEDED_MEMORY: 'QUOTA_EXCEEDED_MEMORY',
  QUOTA_EXCEEDED_STORAGE: 'QUOTA_EXCEEDED_STORAGE',
  QUOTA_EXCEEDED_CONTAINERS: 'QUOTA_EXCEEDED_CONTAINERS',
  
  // Billing Errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_SUSPENDED: 'SUBSCRIPTION_SUSPENDED',
  BILLING_FAILED: 'BILLING_FAILED',
  
  // Resource Errors
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  
  // Operation Errors
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED',
  SERVICE_ACTION_FAILED: 'SERVICE_ACTION_FAILED',
  PROJECT_DELETE_FAILED: 'PROJECT_DELETE_FAILED',
  SERVICE_DELETE_FAILED: 'SERVICE_DELETE_FAILED',
  
  // Generic Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// ============================================================
// User-Friendly Error Messages
// ============================================================

export const ERROR_MESSAGES: Record<string, string> = {
  // Configuration Errors
  [ERROR_CODES.CONFIG_NOT_FOUND]: 'Easypanel is not configured. Please contact your administrator.',
  [ERROR_CODES.CONFIG_INVALID]: 'Easypanel configuration is invalid. Please check your settings.',
  [ERROR_CODES.CONFIG_UPDATE_FAILED]: 'Failed to update Easypanel configuration. Please try again.',
  
  // Authentication Errors
  [ERROR_CODES.EASYPANEL_AUTH_FAILED]: 'Authentication with Easypanel failed. Please check your API credentials.',
  [ERROR_CODES.EASYPANEL_ACCESS_DENIED]: 'Access denied by Easypanel. Please check your API key permissions.',
  [ERROR_CODES.EASYPANEL_CONNECTION_FAILED]: 'Cannot connect to Easypanel. Please check your network connection.',
  
  // Validation Errors
  [ERROR_CODES.INVALID_PROJECT_NAME]: 'Project name is invalid. Use only lowercase letters, numbers, hyphens, and underscores.',
  [ERROR_CODES.INVALID_SERVICE_NAME]: 'Service name is invalid. Use only lowercase letters, numbers, hyphens, and underscores.',
  [ERROR_CODES.INVALID_RESOURCE_CONFIG]: 'Resource configuration is invalid. Please check your CPU, memory, and storage settings.',
  [ERROR_CODES.MISSING_REQUIRED_FIELDS]: 'Please fill in all required fields.',
  
  // Quota Errors
  [ERROR_CODES.QUOTA_EXCEEDED_CPU]: 'CPU quota exceeded. Please upgrade your plan or reduce resource usage.',
  [ERROR_CODES.QUOTA_EXCEEDED_MEMORY]: 'Memory quota exceeded. Please upgrade your plan or reduce resource usage.',
  [ERROR_CODES.QUOTA_EXCEEDED_STORAGE]: 'Storage quota exceeded. Please upgrade your plan or reduce resource usage.',
  [ERROR_CODES.QUOTA_EXCEEDED_CONTAINERS]: 'Container limit reached. Please upgrade your plan or delete unused containers.',
  
  // Billing Errors
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Insufficient wallet balance. Please add funds to your account.',
  [ERROR_CODES.SUBSCRIPTION_NOT_FOUND]: 'No active container subscription found. Please subscribe to a plan first.',
  [ERROR_CODES.SUBSCRIPTION_SUSPENDED]: 'Your container subscription is suspended. Please contact support.',
  [ERROR_CODES.BILLING_FAILED]: 'Billing failed. Please check your payment method and try again.',
  
  // Resource Errors
  [ERROR_CODES.PROJECT_NOT_FOUND]: 'Project not found. It may have been deleted.',
  [ERROR_CODES.SERVICE_NOT_FOUND]: 'Service not found. It may have been deleted.',
  [ERROR_CODES.TEMPLATE_NOT_FOUND]: 'Template not found. Please select a different template.',
  [ERROR_CODES.PLAN_NOT_FOUND]: 'Plan not found. Please select a different plan.',
  
  // Operation Errors
  [ERROR_CODES.DEPLOYMENT_FAILED]: 'Deployment failed. Please check your configuration and try again.',
  [ERROR_CODES.SERVICE_ACTION_FAILED]: 'Service action failed. Please try again in a few moments.',
  [ERROR_CODES.PROJECT_DELETE_FAILED]: 'Failed to delete project. Please ensure all services are deleted first.',
  [ERROR_CODES.SERVICE_DELETE_FAILED]: 'Failed to delete service. Please try again.',
  
  // Generic Errors
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again or contact support.',
  [ERROR_CODES.EXTERNAL_API_ERROR]: 'External service error. Please try again later.',
  [ERROR_CODES.DATABASE_ERROR]: 'Database error. Please try again or contact support.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
};

// ============================================================
// Error Handling Functions
// ============================================================

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(code: string, fallbackMessage?: string): string {
  return ERROR_MESSAGES[code] || fallbackMessage || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
}

/**
 * Extract error information from API response
 */
export function extractErrorInfo(error: any): {
  code: string;
  message: string;
  details?: Record<string, any>;
  validationErrors?: ValidationError[];
} {
  // Handle network errors
  if (!error.response) {
    return {
      code: ERROR_CODES.NETWORK_ERROR,
      message: getErrorMessage(ERROR_CODES.NETWORK_ERROR),
    };
  }

  // Handle API error responses
  const errorData = error.response?.data?.error;
  if (errorData) {
    return {
      code: errorData.code || ERROR_CODES.INTERNAL_ERROR,
      message: errorData.message || getErrorMessage(errorData.code),
      details: errorData.details,
      validationErrors: errorData.details?.validationErrors,
    };
  }

  // Handle HTTP status codes
  const status = error.response?.status;
  if (status === 401) {
    return {
      code: ERROR_CODES.EASYPANEL_AUTH_FAILED,
      message: getErrorMessage(ERROR_CODES.EASYPANEL_AUTH_FAILED),
    };
  }

  if (status === 403) {
    return {
      code: ERROR_CODES.EASYPANEL_ACCESS_DENIED,
      message: getErrorMessage(ERROR_CODES.EASYPANEL_ACCESS_DENIED),
    };
  }

  if (status === 404) {
    return {
      code: ERROR_CODES.PROJECT_NOT_FOUND,
      message: 'Resource not found',
    };
  }

  if (status === 409) {
    return {
      code: ERROR_CODES.DEPLOYMENT_FAILED,
      message: 'Resource already exists with that name',
    };
  }

  if (status >= 500) {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: getErrorMessage(ERROR_CODES.INTERNAL_ERROR),
    };
  }

  // Fallback for unknown errors
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: error.message || getErrorMessage(ERROR_CODES.INTERNAL_ERROR),
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(validationErrors: ValidationError[]): string {
  if (!validationErrors || validationErrors.length === 0) {
    return 'Validation failed';
  }

  if (validationErrors.length === 1) {
    return validationErrors[0].message;
  }

  return validationErrors.map(error => `${error.field}: ${error.message}`).join(', ');
}

/**
 * Check if error is a quota exceeded error
 */
export function isQuotaError(code: string): boolean {
  return [
    ERROR_CODES.QUOTA_EXCEEDED_CPU,
    ERROR_CODES.QUOTA_EXCEEDED_MEMORY,
    ERROR_CODES.QUOTA_EXCEEDED_STORAGE,
    ERROR_CODES.QUOTA_EXCEEDED_CONTAINERS,
  ].includes(code as any);
}

/**
 * Check if error is a billing related error
 */
export function isBillingError(code: string): boolean {
  return [
    ERROR_CODES.INSUFFICIENT_BALANCE,
    ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
    ERROR_CODES.SUBSCRIPTION_SUSPENDED,
    ERROR_CODES.BILLING_FAILED,
  ].includes(code as any);
}

/**
 * Check if error is a configuration error
 */
export function isConfigError(code: string): boolean {
  return [
    ERROR_CODES.CONFIG_NOT_FOUND,
    ERROR_CODES.CONFIG_INVALID,
    ERROR_CODES.CONFIG_UPDATE_FAILED,
    ERROR_CODES.EASYPANEL_AUTH_FAILED,
    ERROR_CODES.EASYPANEL_ACCESS_DENIED,
    ERROR_CODES.EASYPANEL_CONNECTION_FAILED,
  ].includes(code as any);
}

/**
 * Get suggested actions for error codes
 */
export function getSuggestedActions(code: string): string[] {
  const actions: Record<string, string[]> = {
    [ERROR_CODES.CONFIG_NOT_FOUND]: [
      'Contact your administrator to configure Easypanel',
    ],
    [ERROR_CODES.EASYPANEL_CONNECTION_FAILED]: [
      'Check your internet connection',
      'Verify the Easypanel URL is correct',
      'Contact your administrator if the problem persists',
    ],
    [ERROR_CODES.QUOTA_EXCEEDED_CPU]: [
      'Upgrade to a higher plan',
      'Delete unused services to free up CPU',
      'Reduce CPU limits on existing services',
    ],
    [ERROR_CODES.QUOTA_EXCEEDED_MEMORY]: [
      'Upgrade to a higher plan',
      'Delete unused services to free up memory',
      'Reduce memory limits on existing services',
    ],
    [ERROR_CODES.QUOTA_EXCEEDED_STORAGE]: [
      'Upgrade to a higher plan',
      'Delete unused services to free up storage',
      'Clean up service data and logs',
    ],
    [ERROR_CODES.QUOTA_EXCEEDED_CONTAINERS]: [
      'Upgrade to a higher plan',
      'Delete unused services',
      'Combine multiple services into fewer containers',
    ],
    [ERROR_CODES.INSUFFICIENT_BALANCE]: [
      'Add funds to your wallet',
      'Check your payment method',
      'Contact support if you believe this is an error',
    ],
    [ERROR_CODES.DEPLOYMENT_FAILED]: [
      'Check your configuration settings',
      'Verify the Docker image exists and is accessible',
      'Try a different service name',
      'Contact support if the problem persists',
    ],
  };

  return actions[code] || ['Try again later', 'Contact support if the problem persists'];
}

/**
 * Create a user-friendly error object for display
 */
export function createDisplayError(error: any): {
  title: string;
  message: string;
  code: string;
  actions: string[];
  details?: Record<string, any>;
  validationErrors?: ValidationError[];
} {
  const errorInfo = extractErrorInfo(error);
  
  let title = 'Error';
  if (isQuotaError(errorInfo.code)) {
    title = 'Quota Exceeded';
  } else if (isBillingError(errorInfo.code)) {
    title = 'Billing Issue';
  } else if (isConfigError(errorInfo.code)) {
    title = 'Configuration Error';
  } else if (errorInfo.code === ERROR_CODES.DEPLOYMENT_FAILED) {
    title = 'Deployment Failed';
  } else if (errorInfo.code === ERROR_CODES.SERVICE_ACTION_FAILED) {
    title = 'Service Action Failed';
  }

  return {
    title,
    message: errorInfo.message,
    code: errorInfo.code,
    actions: getSuggestedActions(errorInfo.code),
    details: errorInfo.details,
    validationErrors: errorInfo.validationErrors,
  };
}