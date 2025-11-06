/**
 * Comprehensive error handling utilities for consistent error display
 */
import { toast } from 'sonner';

export interface ApiError {
  error: string;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  code?: string;
  timestamp?: string;
}

export interface ErrorDisplayOptions {
  showToast?: boolean;
  toastDuration?: number;
  fallbackMessage?: string;
}

/**
 * Error types for categorization
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC_ERROR',
  NETWORK = 'NETWORK_ERROR',
  SERVER = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Categorizes error based on HTTP status code and error code
 */
export function categorizeError(status: number, errorCode?: string): ErrorType {
  if (errorCode) {
    switch (errorCode) {
      case 'VALIDATION_ERROR':
        return ErrorType.VALIDATION;
      case 'BUSINESS_LOGIC_ERROR':
      case 'NAME_NOT_UNIQUE':
      case 'SLUG_NOT_UNIQUE':
      case 'EMAIL_NOT_UNIQUE':
      case 'USER_ALREADY_MEMBER':
      case 'CANNOT_REMOVE_OWNER':
        return ErrorType.BUSINESS_LOGIC;
      case 'USER_NOT_FOUND':
      case 'ORGANIZATION_NOT_FOUND':
      case 'MEMBER_NOT_FOUND':
        return ErrorType.NOT_FOUND;
      default:
        break;
    }
  }

  switch (status) {
    case 400:
      return ErrorType.VALIDATION;
    case 401:
      return ErrorType.UNAUTHORIZED;
    case 403:
      return ErrorType.FORBIDDEN;
    case 404:
      return ErrorType.NOT_FOUND;
    case 422:
      return ErrorType.BUSINESS_LOGIC;
    case 500:
    case 502:
    case 503:
    case 504:
      return ErrorType.SERVER;
    default:
      if (status >= 400 && status < 500) {
        return ErrorType.VALIDATION;
      } else if (status >= 500) {
        return ErrorType.SERVER;
      }
      return ErrorType.UNKNOWN;
  }
}

/**
 * Determines error severity based on type and context
 */
export function getErrorSeverity(errorType: ErrorType, isUserAction: boolean = true): ErrorSeverity {
  switch (errorType) {
    case ErrorType.VALIDATION:
    case ErrorType.BUSINESS_LOGIC:
      return isUserAction ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM;
    case ErrorType.NOT_FOUND:
      return ErrorSeverity.MEDIUM;
    case ErrorType.UNAUTHORIZED:
    case ErrorType.FORBIDDEN:
      return ErrorSeverity.HIGH;
    case ErrorType.SERVER:
    case ErrorType.NETWORK:
      return ErrorSeverity.HIGH;
    case ErrorType.UNKNOWN:
    default:
      return ErrorSeverity.CRITICAL;
  }
}

/**
 * Formats error message for user display
 */
export function formatErrorMessage(error: ApiError, errorType: ErrorType): string {
  // Handle validation errors with field-specific messages
  if (errorType === ErrorType.VALIDATION && error.errors && error.errors.length > 0) {
    if (error.errors.length === 1) {
      return error.errors[0].message;
    } else {
      return `Please fix the following errors: ${error.errors.map(e => e.message).join(', ')}`;
    }
  }

  // Handle business logic errors with user-friendly messages
  if (errorType === ErrorType.BUSINESS_LOGIC) {
    switch (error.code) {
      case 'NAME_NOT_UNIQUE':
        return 'This name is already taken. Please choose a different name.';
      case 'SLUG_NOT_UNIQUE':
        return 'This slug is already taken. Please choose a different slug.';
      case 'EMAIL_NOT_UNIQUE':
        return 'This email address is already registered. Please use a different email.';
      case 'USER_ALREADY_MEMBER':
        return 'This user is already a member of the organization.';
      case 'CANNOT_REMOVE_OWNER':
        return 'Cannot remove the organization owner. Please transfer ownership first.';
      case 'USER_NOT_FOUND':
        return 'The selected user could not be found.';
      case 'ORGANIZATION_NOT_FOUND':
        return 'The organization could not be found.';
      case 'MEMBER_NOT_FOUND':
        return 'The member could not be found in this organization.';
      default:
        return error.error || 'An error occurred while processing your request.';
    }
  }

  // Handle other error types
  switch (errorType) {
    case ErrorType.NOT_FOUND:
      return 'The requested resource could not be found.';
    case ErrorType.UNAUTHORIZED:
      return 'You are not authorized to perform this action. Please log in and try again.';
    case ErrorType.FORBIDDEN:
      return 'You do not have permission to perform this action.';
    case ErrorType.NETWORK:
      return 'Network error. Please check your connection and try again.';
    case ErrorType.SERVER:
      return 'A server error occurred. Please try again later.';
    default:
      return error.error || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Displays error using appropriate UI method
 */
export function displayError(
  error: ApiError,
  status: number = 500,
  options: ErrorDisplayOptions = {}
): void {
  const {
    showToast = true,
    toastDuration = 5000,
    fallbackMessage = 'An error occurred',
  } = options;

  const errorType = categorizeError(status, error.code);
  const severity = getErrorSeverity(errorType);
  const message = formatErrorMessage(error, errorType);

  if (showToast) {
    // Use different toast types based on severity
    switch (severity) {
      case ErrorSeverity.LOW:
        toast.error(message, { duration: toastDuration });
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message, { duration: toastDuration * 1.5 });
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        toast.error(message, { 
          duration: toastDuration * 2,
          action: {
            label: 'Dismiss',
            onClick: () => {},
          },
        });
        break;
    }
  }

  // Log error for debugging
  console.error('Error displayed to user:', {
    originalError: error,
    status,
    errorType,
    severity,
    displayMessage: message,
  });
}

/**
 * Handles API response errors consistently
 */
export async function handleApiError(response: Response, fallbackMessage?: string): Promise<never> {
  let errorData: ApiError;
  
  try {
    errorData = await response.json();
  } catch {
    // If response is not JSON, create a generic error
    errorData = {
      error: fallbackMessage || 'An error occurred',
      code: 'PARSE_ERROR',
    };
  }

  displayError(errorData, response.status, { fallbackMessage });
  throw new Error(formatErrorMessage(errorData, categorizeError(response.status, errorData.code)));
}

/**
 * Handles network errors (fetch failures)
 */
export function handleNetworkError(error: Error, fallbackMessage?: string): never {
  const networkError: ApiError = {
    error: fallbackMessage || 'Network error occurred',
    code: 'NETWORK_ERROR',
  };

  displayError(networkError, 0, { fallbackMessage });
  throw error;
}

/**
 * Generic error handler for async operations
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  fallbackMessage?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        handleNetworkError(error, fallbackMessage);
      }
      throw error;
    }
  };
}

/**
 * Retry mechanism for failed operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = (error, attempt) => attempt < maxAttempts && !error.message.includes('4'),
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!shouldRetry(lastError, attempt)) {
        break;
      }
      
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Success message display utility
 */
export function displaySuccess(message: string, duration: number = 3000): void {
  toast.success(message, { duration });
}

/**
 * Info message display utility
 */
export function displayInfo(message: string, duration: number = 3000): void {
  toast.info(message, { duration });
}

/**
 * Warning message display utility
 */
export function displayWarning(message: string, duration: number = 4000): void {
  toast.warning(message, { duration });
}