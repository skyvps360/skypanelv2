/**
 * Comprehensive form validation utilities for admin user management
 */

import { useState, useCallback } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a single field against its rules
 */
export function validateField(value: any, rules: ValidationRule, fieldName: string): string | null {
  const stringValue = typeof value === 'string' ? value : String(value || '');
  const trimmedValue = stringValue.trim();

  // Required validation
  if (rules.required && !trimmedValue) {
    return `${fieldName} is required`;
  }

  // Skip other validations if field is empty and not required
  if (!trimmedValue && !rules.required) {
    return null;
  }

  // Min length validation
  if (rules.minLength && trimmedValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters`;
  }

  // Max length validation
  if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    return `${fieldName} must be less than ${rules.maxLength} characters`;
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(trimmedValue)) {
    return getPatternErrorMessage(fieldName, rules.pattern);
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(trimmedValue);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Validates an entire form against a schema
 */
export function validateForm(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [fieldName, rules] of Object.entries(schema)) {
    const error = validateField(data[fieldName], rules, fieldName);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Gets appropriate error message for pattern validation
 */
function getPatternErrorMessage(fieldName: string, pattern: RegExp): string {
  const patternString = pattern.toString();
  
  // Email pattern
  if (patternString.includes('@')) {
    return 'Please enter a valid email address';
  }
  
  // Slug pattern (lowercase letters, numbers, hyphens)
  if (patternString.includes('[a-z0-9-]')) {
    return 'Only lowercase letters, numbers, and hyphens are allowed';
  }
  
  // Phone pattern
  if (patternString.includes('\\d') && (patternString.includes('{') || patternString.includes('+'))) {
    return 'Please enter a valid phone number';
  }
  
  // Timezone pattern
  if (patternString.includes('\\/')) {
    return 'Please enter a valid timezone (e.g., America/New_York)';
  }
  
  return `${fieldName} format is invalid`;
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  slug: /^[a-z0-9-]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  timezone: /^[A-Za-z_]+\/[A-Za-z_]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

/**
 * Validation schemas for admin forms
 */
export const ValidationSchemas = {
  organizationCreate: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    slug: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: ValidationPatterns.slug,
    },
    ownerId: {
      required: true,
      pattern: ValidationPatterns.uuid,
    },
    description: {
      maxLength: 500,
    },
  },

  organizationEdit: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    slug: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: ValidationPatterns.slug,
    },
    description: {
      maxLength: 500,
    },
  },

  memberAdd: {
    userId: {
      required: true,
      pattern: ValidationPatterns.uuid,
    },
    role: {
      required: true,
      custom: (value: string) => {
        const validRoles = ['owner', 'admin', 'member'];
        return validRoles.includes(value) ? null : 'Please select a valid role';
      },
    },
  },

  memberEdit: {
    role: {
      required: true,
      custom: (value: string) => {
        const validRoles = ['owner', 'admin', 'member'];
        return validRoles.includes(value) ? null : 'Please select a valid role';
      },
    },
  },

  userEdit: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    email: {
      required: true,
      maxLength: 255,
      pattern: ValidationPatterns.email,
    },
    role: {
      required: true,
      custom: (value: string) => {
        const validRoles = ['user', 'admin'];
        return validRoles.includes(value) ? null : 'Please select a valid role';
      },
    },
    phone: {
      custom: (value: string) => {
        if (!value || !value.trim()) return null;
        const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
        return ValidationPatterns.phone.test(cleanPhone) ? null : 'Please enter a valid phone number';
      },
    },
    timezone: {
      custom: (value: string) => {
        if (!value || !value.trim()) return null;
        return ValidationPatterns.timezone.test(value) ? null : 'Please enter a valid timezone (e.g., America/New_York)';
      },
    },
  },
} as const;

/**
 * Validates SSH public key format
 */
export function validateSSHPublicKey(key: string): { valid: boolean; error?: string } {
  if (!key || !key.trim()) {
    return { valid: false, error: 'SSH public key is required' };
  }

  const trimmedKey = key.trim();
  
  // Basic SSH key format validation
  const sshKeyPattern = /^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}(\s+.*)?$/;
  
  if (!sshKeyPattern.test(trimmedKey)) {
    return { valid: false, error: 'Invalid SSH public key format. Key should start with ssh-rsa, ssh-ed25519, etc.' };
  }

  // Check key length (reasonable bounds)
  if (trimmedKey.length < 100) {
    return { valid: false, error: 'SSH public key appears to be too short' };
  }

  if (trimmedKey.length > 8192) {
    return { valid: false, error: 'SSH public key is too long (max 8192 characters)' };
  }

  return { valid: true };
}

/**
 * Validates marketplace application configuration
 */
export function validateMarketplaceApp(
  appSlug: string, 
  region?: string, 
  availableApps?: any[]
): { valid: boolean; error?: string; errorCode?: string } {
  if (!appSlug || typeof appSlug !== 'string' || appSlug.trim().length === 0) {
    return { valid: false, error: 'Application slug is required' };
  }

  if (!/^[a-z0-9-]+$/.test(appSlug)) {
    return { 
      valid: false, 
      error: 'Application slug must contain only lowercase letters, numbers, and hyphens' 
    };
  }

  // If region and available apps are provided, check compatibility
  if (region && availableApps) {
    const app = availableApps.find(a => a.slug === appSlug);
    if (!app) {
      return { valid: false, error: 'Application not found' };
    }

    // Check if app is compatible with the region
    if (app.regions && !app.regions.includes(region)) {
      return { 
        valid: false, 
        error: `Application "${app.name}" is not available in region "${region}"`,
        errorCode: 'REGION_INCOMPATIBLE'
      };
    }
  }

  return { valid: true };
}

/**
 * Real-time validation hook for forms
 */
export function useFormValidation(schema: ValidationSchema, initialData: Record<string, any> = {}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateFieldValue = useCallback((fieldName: string, value: any) => {
    const rules = schema[fieldName];
    if (!rules) return;

    const error = validateField(value, rules, fieldName);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error || '',
    }));
  }, [schema]);

  const validateAll = useCallback((data: Record<string, any>) => {
    const result = validateForm(data, schema);
    setErrors(result.errors);
    return result;
  }, [schema]);

  const markFieldTouched = useCallback((fieldName: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true,
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback((fieldName: string) => {
    return touched[fieldName] ? errors[fieldName] : '';
  }, [errors, touched]);

  return {
    errors,
    touched,
    validateField: validateFieldValue,
    validateAll,
    markFieldTouched,
    clearErrors,
    getFieldError,
    hasErrors: Object.values(errors).some(error => error),
  };
}