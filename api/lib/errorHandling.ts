/**
 * Backend error handling utilities
 * Provides structured error responses, retry logic, and error logging
 */

export interface StructuredError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

/**
 * Error codes for consistent error handling
 */
export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  
  // Provider errors
  PROVIDER_API_ERROR: 'PROVIDER_API_ERROR',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // SSH key errors
  SSH_KEY_INVALID: 'SSH_KEY_INVALID',
  SSH_KEY_DUPLICATE: 'SSH_KEY_DUPLICATE',
  SSH_KEY_SYNC_FAILED: 'SSH_KEY_SYNC_FAILED',
  
  // VPS errors
  VPS_CREATION_FAILED: 'VPS_CREATION_FAILED',
  VPS_ACTION_FAILED: 'VPS_ACTION_FAILED',
  MARKETPLACE_APP_INVALID: 'MARKETPLACE_APP_INVALID',
  REGION_INCOMPATIBLE: 'REGION_INCOMPATIBLE',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

/**
 * Create a structured error response
 */
export function createError(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
): StructuredError {
  return {
    code,
    message,
    statusCode,
    details
  };
}

/**
 * Check if an error is retryable (transient error)
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED') {
    return true;
  }
  
  // HTTP status codes that are retryable
  if (error.response?.status) {
    const status = error.response.status;
    // 408 Request Timeout, 429 Too Many Requests, 500+ Server Errors
    if (status === 408 || status === 429 || status >= 500) {
      return true;
    }
  }
  
  // Provider-specific timeout errors
  if (error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('timed out')) {
    return true;
  }
  
  return false;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors?: (error: any) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: isRetryableError
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic for transient errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    retryableErrors
  } = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  let lastError: any;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const shouldRetry = retryableErrors ? retryableErrors(error) : isRetryableError(error);
      
      // Don't retry if this was the last attempt or error is not retryable
      if (attempt === maxRetries || !shouldRetry) {
        break;
      }
      
      // Log retry attempt
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after error:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status
      });
      
      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError;
}

/**
 * Log error with context for debugging
 */
export function logError(
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
): void {
  const errorInfo = {
    context,
    message: error.message,
    code: error.code,
    stack: error.stack,
    statusCode: error.response?.status,
    responseData: error.response?.data,
    ...additionalInfo
  };
  
  console.error(`[ERROR] ${context}:`, errorInfo);
}

/**
 * Extract user-friendly error message from provider API error
 */
export function extractProviderErrorMessage(error: any, provider: string): string {
  // Check for response data with error message
  if (error.response?.data) {
    const data = error.response.data;
    
    // Common error message fields
    if (data.message) return data.message;
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (data.error.message) return data.error.message;
    }
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0].message || data.errors[0];
    }
  }
  
  // Check for error message directly
  if (error.message) {
    // Remove technical details from message
    const message = error.message;
    if (message.includes('Request failed with status code')) {
      return `${provider} API error: ${error.response?.status || 'Unknown error'}`;
    }
    return message;
  }
  
  // Fallback
  return `${provider} API request failed`;
}

/**
 * Handle provider API errors with structured response
 */
export function handleProviderError(
  error: any,
  provider: 'linode',
  operation: string
): StructuredError {
  logError(`${provider} ${operation}`, error);
  
  const message = extractProviderErrorMessage(error, provider);
  
  // Determine error code based on status
  let code: string = ErrorCodes.PROVIDER_API_ERROR;
  let statusCode = 500;
  
  if (error.response?.status) {
    statusCode = error.response.status;
    
    if (statusCode === 401 || statusCode === 403) {
      code = ErrorCodes.UNAUTHORIZED;
    } else if (statusCode === 404) {
      code = ErrorCodes.RESOURCE_NOT_FOUND;
    } else if (statusCode === 429) {
      code = ErrorCodes.PROVIDER_RATE_LIMIT;
    } else if (statusCode === 408 || statusCode >= 500) {
      code = ErrorCodes.PROVIDER_UNAVAILABLE;
    }
  } else if (isRetryableError(error)) {
    code = ErrorCodes.PROVIDER_TIMEOUT;
    statusCode = 504;
  }
  
  return createError(code, message, statusCode, {
    provider,
    operation,
    originalError: error.message
  });
}

/**
 * Validate SSH public key format
 */
export function validateSSHKeyFormat(publicKey: string): { valid: boolean; error?: string } {
  if (!publicKey || !publicKey.trim()) {
    return { valid: false, error: 'SSH public key is required' };
  }
  
  const trimmed = publicKey.trim();
  
  // Check format
  const sshKeyRegex = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-dss)\s+[A-Za-z0-9+/]+[=]{0,3}(\s+.*)?$/;
  
  if (!sshKeyRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid SSH public key format. Must start with ssh-rsa, ssh-ed25519, or ecdsa-sha2-*'
    };
  }
  
  // Check for common mistakes
  if (trimmed.includes('PRIVATE KEY')) {
    return {
      valid: false,
      error: 'This appears to be a private key. Please provide your public key instead.'
    };
  }
  
  if (trimmed.length < 100) {
    return {
      valid: false,
      error: 'SSH public key appears to be too short. Please provide a complete key.'
    };
  }
  
  return { valid: true };
}

/**
 * Wrap async route handler with error handling
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
