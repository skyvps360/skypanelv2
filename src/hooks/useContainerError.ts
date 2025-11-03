/**
 * React Hook for Container Error Handling
 * Provides utilities for displaying and handling container-related errors
 */

import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
  createDisplayError, 
  isQuotaError, 
  isBillingError, 
  isConfigError,
  formatValidationErrors,
  type ValidationError 
} from '@/lib/containerErrors';

export interface UseContainerErrorReturn {
  handleError: (error: any, options?: ErrorHandlingOptions) => void;
  showQuotaError: (error: any) => void;
  showBillingError: (error: any) => void;
  showConfigError: (error: any) => void;
  showValidationErrors: (validationErrors: ValidationError[]) => void;
}

export interface ErrorHandlingOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (errorDetails: any) => void;
}

export function useContainerError(): UseContainerErrorReturn {
  const handleError = useCallback((error: any, options: ErrorHandlingOptions = {}) => {
    const { showToast = true, customMessage, onError } = options;
    
    const errorDetails = createDisplayError(error);
    
    // Call custom error handler if provided
    if (onError) {
      onError(errorDetails);
    }
    
    // Show toast notification if enabled
    if (showToast) {
      const message = customMessage || errorDetails.message;
      
      if (isQuotaError(errorDetails.code)) {
        toast.error(message, {
          duration: 6000,
          icon: '⚠️',
        });
      } else if (isBillingError(errorDetails.code)) {
        toast.error(message, {
          duration: 6000,
          icon: '💳',
        });
      } else if (isConfigError(errorDetails.code)) {
        toast.error(message, {
          duration: 8000,
          icon: '⚙️',
        });
      } else {
        toast.error(message, {
          duration: 4000,
        });
      }
    }
    
    // Log error for debugging
    console.error('Container error:', errorDetails);
  }, []);

  const showQuotaError = useCallback((error: any) => {
    const errorDetails = createDisplayError(error);
    
    const message = `${errorDetails.title}\n${errorDetails.message}\n\nSuggested actions:\n${errorDetails.actions.slice(0, 2).join('\n')}`;
    
    toast.error(message, {
      duration: 8000,
      icon: '⚠️',
    });
  }, []);

  const showBillingError = useCallback((error: any) => {
    const errorDetails = createDisplayError(error);
    
    const message = `${errorDetails.title}\n${errorDetails.message}\n\n${errorDetails.actions[0]}`;
    
    toast.error(message, {
      duration: 8000,
      icon: '💳',
    });
  }, []);

  const showConfigError = useCallback((error: any) => {
    const errorDetails = createDisplayError(error);
    
    const message = `${errorDetails.title}\n${errorDetails.message}\n\nContact your administrator for assistance.`;
    
    toast.error(message, {
      duration: 10000,
      icon: '⚙️',
    });
  }, []);

  const showValidationErrors = useCallback((validationErrors: ValidationError[]) => {
    const message = formatValidationErrors(validationErrors);
    
    let fullMessage = `Validation Error\n${message}`;
    
    if (validationErrors.length > 1) {
      const fieldErrors = validationErrors.slice(0, 3).map(error => `${error.field}: ${error.message}`);
      if (validationErrors.length > 3) {
        fieldErrors.push(`... and ${validationErrors.length - 3} more`);
      }
      fullMessage += `\n\nPlease correct the following fields:\n${fieldErrors.join('\n')}`;
    }
    
    toast.error(fullMessage, {
      duration: 6000,
      icon: '❌',
    });
  }, []);

  return {
    handleError,
    showQuotaError,
    showBillingError,
    showConfigError,
    showValidationErrors,
  };
}

// Utility hook for handling async operations with error handling
export function useContainerOperation() {
  const { handleError } = useContainerError();

  const executeOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      onSuccess?: (result: T) => void;
      onError?: (error: any) => void;
      successMessage?: string;
      errorMessage?: string;
    } = {}
  ): Promise<T | null> => {
    try {
      const result = await operation();
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      
      return result;
    } catch (error) {
      handleError(error, {
        customMessage: options.errorMessage,
        onError: options.onError,
      });
      
      return null;
    }
  }, [handleError]);

  return { executeOperation };
}