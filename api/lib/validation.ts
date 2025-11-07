/**
 * Server-side validation utilities for admin user management
 */
import { body, param, query as queryValidator } from 'express-validator';

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  slug: /^[a-z0-9-]+$/,
   phone: /^\+?[1-9]\d{0,15}$/,
  timezone: /^[A-Za-z_]+\/[A-Za-z_]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

/**
 * Organization validation schemas
 */
export const OrganizationValidation = {
  create: [
    body('name')
      .isString()
      .withMessage('Organization name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Organization name must be between 2 and 100 characters')
      .notEmpty()
      .withMessage('Organization name is required'),
    
    body('slug')
      .isString()
      .withMessage('Organization slug must be a string')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Organization slug must be between 2 and 50 characters')
      .matches(ValidationPatterns.slug)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
      .notEmpty()
      .withMessage('Organization slug is required'),
    
    body('ownerId')
      .isUUID()
      .withMessage('Owner ID must be a valid UUID'),
    
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string')
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
    
    body('name')
      .optional()
      .isString()
      .withMessage('Organization name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Organization name must be between 2 and 100 characters')
      .notEmpty()
      .withMessage('Organization name cannot be empty'),
    
    body('slug')
      .optional()
      .isString()
      .withMessage('Organization slug must be a string')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Organization slug must be between 2 and 50 characters')
      .matches(ValidationPatterns.slug)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
      .notEmpty()
      .withMessage('Organization slug cannot be empty'),
    
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string')
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],

  delete: [
    param('id')
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
  ],
};

/**
 * Organization member validation schemas
 */
export const MemberValidation = {
  add: [
    param('id')
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
    
    body('userId')
      .isUUID()
      .withMessage('User ID must be a valid UUID'),
    
    body('role')
      .isIn(['owner', 'admin', 'member'])
      .withMessage('Role must be owner, admin, or member'),
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
    
    param('userId')
      .isUUID()
      .withMessage('User ID must be a valid UUID'),
    
    body('role')
      .isIn(['owner', 'admin', 'member'])
      .withMessage('Role must be owner, admin, or member'),
  ],

  remove: [
    param('id')
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
    
    param('userId')
      .isUUID()
      .withMessage('User ID must be a valid UUID'),
  ],
};

/**
 * User validation schemas
 */
export const UserValidation = {
  update: [
    param('id')
      .isUUID()
      .withMessage('User ID must be a valid UUID'),
    
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .notEmpty()
      .withMessage('Name cannot be empty'),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please enter a valid email address')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email must be less than 255 characters'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be user or admin'),
    
    body('phone')
      .optional()
      .custom((value) => {
        if (!value || !value.trim()) return true;
          const cleanPhone = value.replace(/[\s-()]/g, '');
        if (!ValidationPatterns.phone.test(cleanPhone)) {
          throw new Error('Please enter a valid phone number');
        }
        return true;
      }),
    
    body('timezone')
      .optional()
      .custom((value) => {
        if (!value || !value.trim()) return true;
        if (!ValidationPatterns.timezone.test(value)) {
          throw new Error('Please enter a valid timezone (e.g., America/New_York)');
        }
        return true;
      }),
  ],

  search: [
    queryValidator('q')
      .optional()
      .isString()
      .withMessage('Search query must be a string')
      .trim(),
    
    queryValidator('organizationId')
      .optional()
      .isUUID()
      .withMessage('Organization ID must be a valid UUID'),
    
    queryValidator('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    queryValidator('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
};

/**
 * Enhanced error response formatter
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorResponse {
  error: string;
  errors?: ValidationError[];
  code?: string;
  timestamp: string;
}

export function formatValidationErrors(errors: any[]): ErrorResponse {
  const validationErrors: ValidationError[] = errors.map(err => ({
    field: err.path || err.param || 'unknown',
    message: err.msg || 'Invalid value',
    value: err.value,
  }));

  return {
    error: 'Validation failed',
    errors: validationErrors,
    code: 'VALIDATION_ERROR',
    timestamp: new Date().toISOString(),
  };
}

export function formatBusinessLogicError(message: string, code?: string): ErrorResponse {
  return {
    error: message,
    code: code || 'BUSINESS_LOGIC_ERROR',
    timestamp: new Date().toISOString(),
  };
}

export function formatServerError(message: string, code?: string): ErrorResponse {
  return {
    error: message,
    code: code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Business logic validation functions
 */
export class BusinessValidation {
  /**
   * Check if organization name is unique
   */
  static async isOrganizationNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    let sql = 'SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)';
    const params: any[] = [name];
    
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return result.rows.length === 0;
  }

  /**
   * Check if organization slug is unique
   */
  static async isOrganizationSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    let sql = 'SELECT id FROM organizations WHERE slug = $1';
    const params: any[] = [slug];
    
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return result.rows.length === 0;
  }

  /**
   * Check if user email is unique
   */
  static async isUserEmailUnique(email: string, excludeId?: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    let sql = 'SELECT id FROM users WHERE LOWER(email) = LOWER($1)';
    const params: any[] = [email];
    
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return result.rows.length === 0;
  }

  /**
   * Check if user exists
   */
  static async userExists(userId: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
    return result.rows.length > 0;
  }

  /**
   * Check if organization exists
   */
  static async organizationExists(organizationId: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    const result = await query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
    return result.rows.length > 0;
  }

  /**
   * Check if user is already a member of organization
   */
  static async isUserMemberOfOrganization(userId: string, organizationId: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    const result = await query(
      'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
      [userId, organizationId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user is organization owner
   */
  static async isUserOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
    const { query } = await import('./database.js');
    
    const result = await query(
      'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2 AND role = $3',
      [userId, organizationId, 'owner']
    );
    return result.rows.length > 0;
  }
}