/**
 * Provider Error Handling Utilities
 * Provides user-friendly error messages and handling for provider-specific errors
 */

export interface ProviderError {
  code: string;
  message: string;
  field?: string;
  provider?: string;
  originalError?: any;
}

/**
 * Map provider error codes to user-friendly messages
 */
export function getUserFriendlyErrorMessage(error: any, _provider?: string): string {
  // Handle ProviderError format
  if (error && typeof error === 'object' && 'code' in error) {
    const providerError = error as ProviderError;
    return getUserFriendlyMessage(providerError);
  }

  // Handle API response errors
  if (error && typeof error === 'object' && 'error' in error) {
    return String(error.error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get user-friendly message from ProviderError
 */
function getUserFriendlyMessage(error: ProviderError): string {
  const providerName = getProviderDisplayName(error.provider);

  const codeMap: Record<string, string> = {
    // Authentication errors
    'MISSING_CREDENTIALS': `${providerName} API credentials are not configured. Please contact your administrator.`,
    'INVALID_CREDENTIALS': `${providerName} API credentials are invalid. Please contact your administrator.`,
    'HTTP_401': `${providerName} authentication failed. Please contact your administrator.`,
    'UNAUTHORIZED': `${providerName} authentication failed. Please contact your administrator.`,
    
    // Permission errors
    'HTTP_403': `Access forbidden. Your ${providerName} account may not have sufficient permissions.`,
    'FORBIDDEN': `Access forbidden. Your ${providerName} account may not have sufficient permissions.`,
    
    // Resource errors
    'HTTP_404': 'The requested resource was not found.',
    'NOT_FOUND': 'The requested resource was not found.',
    'RESOURCE_NOT_FOUND': 'The requested resource was not found.',
    
    // Rate limiting
    'HTTP_429': `${providerName} rate limit exceeded. Please wait a moment and try again.`,
    'RATE_LIMIT_EXCEEDED': `${providerName} rate limit exceeded. Please wait a moment and try again.`,
    
    // Server errors
    'HTTP_500': `${providerName} is experiencing technical difficulties. Please try again later.`,
    'HTTP_502': `${providerName} service is temporarily unavailable. Please try again later.`,
    'HTTP_503': `${providerName} service is temporarily unavailable. Please try again later.`,
    'HTTP_504': `${providerName} request timed out. Please try again.`,
    'SERVICE_UNAVAILABLE': `${providerName} service is temporarily unavailable. Please try again later.`,
    'PROVIDER_UNAVAILABLE': `${providerName} is currently unavailable. Please try again later.`,
    
    // Validation errors
    'VALIDATION_ERROR': error.message || 'Invalid input. Please check your data and try again.',
    'HTTP_400': 'Invalid request. Please check your input and try again.',
    'HTTP_422': 'Invalid data provided. Please check your input and try again.',
    
    // Network errors
    'NETWORK_ERROR': `Unable to connect to ${providerName}. Please check your internet connection.`,
    'TIMEOUT': `Request to ${providerName} timed out. Please try again.`,
    
    // Generic errors
    'API_ERROR': error.message || `An error occurred while communicating with ${providerName}.`,
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
  };

  return codeMap[error.code] || error.message || `An error occurred with ${providerName}. Please try again.`;
}

/**
 * Get display name for provider
 */
function getProviderDisplayName(provider?: string): string {
  if (!provider) return 'Provider';
  
  const displayNames: Record<string, string> = {
    'linode': 'Linode',
    'aws': 'AWS',
    'gcp': 'Google Cloud',
  };
  
  return displayNames[provider.toLowerCase()] || provider;
}

/**
 * Check if error is a credential/authentication issue
 */
export function isCredentialError(error: any): boolean {
  if (!error) return false;
  
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  
  return (
    code === 'MISSING_CREDENTIALS' ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'HTTP_401' ||
    code === 'UNAUTHORIZED' ||
    message.includes('credential') ||
    message.includes('authentication') ||
    message.includes('unauthorized')
  );
}

/**
 * Check if error is a provider unavailability issue
 */
export function isProviderUnavailable(error: any): boolean {
  if (!error) return false;
  
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  
  return (
    code === 'HTTP_502' ||
    code === 'HTTP_503' ||
    code === 'HTTP_504' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'PROVIDER_UNAVAILABLE' ||
    code === 'TIMEOUT' ||
    message.includes('unavailable') ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
}

/**
 * Check if error is a rate limit issue
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  
  return (
    code === 'HTTP_429' ||
    code === 'RATE_LIMIT_EXCEEDED' ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

/**
 * Get retry suggestion based on error type
 */
export function getRetrySuggestion(error: any): string | null {
  if (isCredentialError(error)) {
    return 'Please contact your administrator to verify API credentials.';
  }
  
  if (isRateLimitError(error)) {
    return 'Please wait a few moments before trying again.';
  }
  
  if (isProviderUnavailable(error)) {
    return 'The service may be temporarily down. Please try again in a few minutes.';
  }
  
  return 'Please try again or contact support if the problem persists.';
}

/**
 * Format error for display with optional retry suggestion
 */
export function formatErrorDisplay(error: any, provider?: string): {
  message: string;
  suggestion: string | null;
  isRetryable: boolean;
} {
  const message = getUserFriendlyErrorMessage(error, provider);
  const suggestion = getRetrySuggestion(error);
  const isRetryable = !isCredentialError(error);
  
  return { message, suggestion, isRetryable };
}
