/**
 * Container Error Handling Utilities
 * Provides standardized error handling for CaaS (Container as a Service) integration
 */

// ============================================================
// Error Types and Interfaces
// ============================================================

export interface ContainerError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode?: number;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

// ============================================================
// Error Codes
// ============================================================

export const ERROR_CODES = {
  // Configuration Errors
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_UPDATE_FAILED: 'CONFIG_UPDATE_FAILED',
  
  // Authentication Errors
  CAAS_AUTH_FAILED: 'CAAS_AUTH_FAILED',
  CAAS_ACCESS_DENIED: 'CAAS_ACCESS_DENIED',
  CAAS_CONNECTION_FAILED: 'CAAS_CONNECTION_FAILED',
  
  // Legacy error codes (deprecated, kept for backward compatibility)
  EASYPANEL_AUTH_FAILED: 'CAAS_AUTH_FAILED',
  EASYPANEL_ACCESS_DENIED: 'CAAS_ACCESS_DENIED',
  EASYPANEL_CONNECTION_FAILED: 'CAAS_CONNECTION_FAILED',
  
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
} as const;

// ============================================================
// Error Classes
// ============================================================

export class ContainerServiceError extends Error {
  public code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(code: string, message: string, statusCode: number = 500, details?: Record<string, any>) {
    super(message);
    this.name = 'ContainerServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): ContainerError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

export class ValidationError extends ContainerServiceError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(message: string, validationErrors: ValidationErrorDetail[]) {
    super(ERROR_CODES.MISSING_REQUIRED_FIELDS, message, 400, { validationErrors });
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class QuotaExceededError extends ContainerServiceError {
  public readonly exceededQuotas: string[];
  public readonly currentUsage: Record<string, number>;
  public readonly limits: Record<string, number>;

  constructor(exceededQuotas: string[], currentUsage: Record<string, number>, limits: Record<string, number>) {
    const quotaList = exceededQuotas.join(', ');
    
    // Determine error code based on first exceeded quota
    let errorCode: string = ERROR_CODES.QUOTA_EXCEEDED_CPU;
    if (exceededQuotas.includes('cpu')) {
      errorCode = ERROR_CODES.QUOTA_EXCEEDED_CPU;
    } else if (exceededQuotas.includes('memory')) {
      errorCode = ERROR_CODES.QUOTA_EXCEEDED_MEMORY;
    } else if (exceededQuotas.includes('storage')) {
      errorCode = ERROR_CODES.QUOTA_EXCEEDED_STORAGE;
    } else if (exceededQuotas.includes('containers')) {
      errorCode = ERROR_CODES.QUOTA_EXCEEDED_CONTAINERS;
    }
    
    super(
      errorCode,
      `Resource quota exceeded: ${quotaList}`,
      400,
      { exceededQuotas, currentUsage, limits }
    );
    this.name = 'QuotaExceededError';
    this.exceededQuotas = exceededQuotas;
    this.currentUsage = currentUsage;
    this.limits = limits;
    this.code = errorCode;
  }
}

// ============================================================
// Error Factory Functions
// ============================================================

export function createConfigError(message: string, details?: Record<string, any>): ContainerServiceError {
  return new ContainerServiceError(ERROR_CODES.CONFIG_INVALID, message, 400, details);
}

export function createAuthError(message: string): ContainerServiceError {
  return new ContainerServiceError(ERROR_CODES.CAAS_AUTH_FAILED, message, 401);
}

export function createConnectionError(message: string): ContainerServiceError {
  return new ContainerServiceError(ERROR_CODES.CAAS_CONNECTION_FAILED, message, 503);
}

export function createNotFoundError(resource: string, id: string): ContainerServiceError {
  const code = resource === 'project' ? ERROR_CODES.PROJECT_NOT_FOUND :
               resource === 'service' ? ERROR_CODES.SERVICE_NOT_FOUND :
               resource === 'template' ? ERROR_CODES.TEMPLATE_NOT_FOUND :
               resource === 'plan' ? ERROR_CODES.PLAN_NOT_FOUND :
               ERROR_CODES.INTERNAL_ERROR;
  
  return new ContainerServiceError(code, `${resource} not found: ${id}`, 404, { resource, id });
}

export function createDeploymentError(message: string, details?: Record<string, any>): ContainerServiceError {
  return new ContainerServiceError(ERROR_CODES.DEPLOYMENT_FAILED, message, 400, details);
}

export function createBillingError(message: string, details?: Record<string, any>): ContainerServiceError {
  return new ContainerServiceError(ERROR_CODES.BILLING_FAILED, message, 400, details);
}

// ============================================================
// CaaS API Error Transformation
// ============================================================

export function transformCaasError(error: any): ContainerServiceError {
  const errorMessage = error.message || 'Unknown CaaS API error';
  
  // Check for specific HTTP status codes
  if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
    return createAuthError('Container platform authentication failed. Please check your API key.');
  }
  
  if (errorMessage.includes('403') || errorMessage.includes('access denied')) {
    return new ContainerServiceError(
      ERROR_CODES.CAAS_ACCESS_DENIED,
      'Container platform access denied. Please check your API key permissions.',
      403
    );
  }
  
  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return new ContainerServiceError(
      ERROR_CODES.EXTERNAL_API_ERROR,
      'Container platform endpoint not found. Please check your API URL.',
      404
    );
  }
  
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('timeout')) {
    return createConnectionError('Cannot connect to container platform. Please check your API URL and network connectivity.');
  }
  
  // Check for specific error messages
  if (errorMessage.includes('project already exists')) {
    return new ContainerServiceError(
      ERROR_CODES.DEPLOYMENT_FAILED,
      'Project name already exists. Please choose a different name.',
      409
    );
  }
  
  if (errorMessage.includes('service already exists')) {
    return new ContainerServiceError(
      ERROR_CODES.DEPLOYMENT_FAILED,
      'Service name already exists in this project. Please choose a different name.',
      409
    );
  }
  
  if (errorMessage.includes('invalid docker image')) {
    return new ContainerServiceError(
      ERROR_CODES.DEPLOYMENT_FAILED,
      'Invalid Docker image specified. Please check the image name and tag.',
      400
    );
  }
  
  if (errorMessage.includes('insufficient resources')) {
    return new ContainerServiceError(
      ERROR_CODES.DEPLOYMENT_FAILED,
      'Insufficient resources on container platform. Please try again later or contact support.',
      503
    );
  }
  
  // Generic external API error
  return new ContainerServiceError(
    ERROR_CODES.EXTERNAL_API_ERROR,
    `Container platform API error: ${errorMessage}`,
    500,
    { originalError: errorMessage }
  );
}

// Legacy function for backward compatibility
export function transformEasypanelError(error: any): ContainerServiceError {
  return transformCaasError(error);
}

// ============================================================
// Validation Helpers
// ============================================================

export function validateProjectName(name: string): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push({
      field: 'projectName',
      message: 'Project name is required',
      value: name,
    });
    return errors;
  }
  
  if (name.length < 2) {
    errors.push({
      field: 'projectName',
      message: 'Project name must be at least 2 characters long',
      value: name,
    });
  }
  
  if (name.length > 50) {
    errors.push({
      field: 'projectName',
      message: 'Project name must be less than 50 characters',
      value: name,
    });
  }
  
  if (!/^[a-z0-9-_]+$/.test(name)) {
    errors.push({
      field: 'projectName',
      message: 'Project name can only contain lowercase letters, numbers, hyphens, and underscores',
      value: name,
    });
  }
  
  if (name.startsWith('-') || name.endsWith('-') || name.startsWith('_') || name.endsWith('_')) {
    errors.push({
      field: 'projectName',
      message: 'Project name cannot start or end with hyphens or underscores',
      value: name,
    });
  }
  
  return errors;
}

export function validateServiceName(name: string): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push({
      field: 'serviceName',
      message: 'Service name is required',
      value: name,
    });
    return errors;
  }
  
  if (name.length < 2) {
    errors.push({
      field: 'serviceName',
      message: 'Service name must be at least 2 characters long',
      value: name,
    });
  }
  
  if (name.length > 50) {
    errors.push({
      field: 'serviceName',
      message: 'Service name must be less than 50 characters',
      value: name,
    });
  }
  
  if (!/^[a-z0-9-_]+$/.test(name)) {
    errors.push({
      field: 'serviceName',
      message: 'Service name can only contain lowercase letters, numbers, hyphens, and underscores',
      value: name,
    });
  }
  
  if (name.startsWith('-') || name.endsWith('-') || name.startsWith('_') || name.endsWith('_')) {
    errors.push({
      field: 'serviceName',
      message: 'Service name cannot start or end with hyphens or underscores',
      value: name,
    });
  }
  
  return errors;
}

export function validateResourceConfig(resources: any): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  
  if (!resources || typeof resources !== 'object') {
    return errors; // Resources are optional
  }
  
  if (resources.cpuLimit !== undefined) {
    if (typeof resources.cpuLimit !== 'number' || resources.cpuLimit <= 0) {
      errors.push({
        field: 'resources.cpuLimit',
        message: 'CPU limit must be a positive number',
        value: resources.cpuLimit,
      });
    }
    
    if (resources.cpuLimit > 32) {
      errors.push({
        field: 'resources.cpuLimit',
        message: 'CPU limit cannot exceed 32 cores',
        value: resources.cpuLimit,
      });
    }
  }
  
  if (resources.memoryLimit !== undefined) {
    if (typeof resources.memoryLimit !== 'number' || resources.memoryLimit <= 0) {
      errors.push({
        field: 'resources.memoryLimit',
        message: 'Memory limit must be a positive number (in MB)',
        value: resources.memoryLimit,
      });
    }
    
    if (resources.memoryLimit > 128000) { // 128GB in MB
      errors.push({
        field: 'resources.memoryLimit',
        message: 'Memory limit cannot exceed 128GB (128000MB)',
        value: resources.memoryLimit,
      });
    }
  }
  
  if (resources.memoryReservation !== undefined) {
    if (typeof resources.memoryReservation !== 'number' || resources.memoryReservation <= 0) {
      errors.push({
        field: 'resources.memoryReservation',
        message: 'Memory reservation must be a positive number (in MB)',
        value: resources.memoryReservation,
      });
    }
    
    if (resources.memoryLimit && resources.memoryReservation > resources.memoryLimit) {
      errors.push({
        field: 'resources.memoryReservation',
        message: 'Memory reservation cannot exceed memory limit',
        value: resources.memoryReservation,
      });
    }
  }
  
  return errors;
}

export function validateEnvironmentVariables(env: any): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  
  if (!env) {
    return errors; // Environment variables are optional
  }
  
  if (typeof env !== 'object' || Array.isArray(env)) {
    errors.push({
      field: 'env',
      message: 'Environment variables must be an object with key-value pairs',
      value: env,
    });
    return errors;
  }
  
  for (const [key, value] of Object.entries(env)) {
    if (typeof key !== 'string' || key.trim() === '') {
      errors.push({
        field: `env.${key}`,
        message: 'Environment variable key must be a non-empty string',
        value: key,
      });
      continue;
    }
    
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      errors.push({
        field: `env.${key}`,
        message: 'Environment variable key must contain only uppercase letters, numbers, and underscores, and start with a letter or underscore',
        value: key,
      });
    }
    
    if (typeof value !== 'string') {
      errors.push({
        field: `env.${key}`,
        message: 'Environment variable value must be a string',
        value: value,
      });
    }
  }
  
  return errors;
}

// ============================================================
// Error Response Helpers
// ============================================================

export function formatErrorResponse(error: ContainerServiceError): {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
} {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

export function formatValidationErrorResponse(validationErrors: ValidationErrorDetail[]): {
  error: {
    code: string;
    message: string;
    details: {
      validationErrors: ValidationErrorDetail[];
    };
  };
} {
  return {
    error: {
      code: ERROR_CODES.MISSING_REQUIRED_FIELDS,
      message: 'Validation failed',
      details: {
        validationErrors,
      },
    },
  };
}