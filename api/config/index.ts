/**
 * Configuration module for SkyPanelV2 API
 */

export interface RateLimitConfig {
  // Anonymous user limits
  anonymousWindowMs: number;
  anonymousMaxRequests: number;
  
  // Authenticated user limits  
  authenticatedWindowMs: number;
  authenticatedMaxRequests: number;
  
  // Admin user limits
  adminWindowMs: number;
  adminMaxRequests: number;
  
  // Trust proxy configuration
  trustProxy: boolean | string | number;
}

export interface Config {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DATABASE_URL: string;
  CLIENT_URL: string;
  // Legacy rate limiting (deprecated)
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  // Enhanced rate limiting configuration
  rateLimiting: RateLimitConfig;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_MODE: string;
  SMTP2GO_API_KEY?: string;
  SMTP2GO_USERNAME?: string;
  SMTP2GO_PASSWORD?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  LINODE_API_TOKEN?: string;
  SSH_CRED_SECRET?: string;
  CONTACT_FORM_RECIPIENT?: string;
  COMPANY_BRAND_NAME: string;
}

/**
 * Parse trust proxy configuration from environment variable
 */
function parseTrustProxy(value?: string): boolean | string | number {
  if (!value) return true; // Default to true for development
  
  // Handle boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // Handle numeric values (number of hops)
  const numValue = parseInt(value, 10);
  if (!isNaN(numValue)) return numValue;
  
  // Handle string values (subnet, loopback, etc.)
  return value;
}

/**
 * Validate and parse rate limiting configuration
 */
function parseRateLimitConfig(): RateLimitConfig {
  const config: RateLimitConfig = {
    // Anonymous user limits (default: 200 requests per 15 minutes)
    anonymousWindowMs: parseInt(process.env.RATE_LIMIT_ANONYMOUS_WINDOW_MS || '900000', 10),
    anonymousMaxRequests: parseInt(process.env.RATE_LIMIT_ANONYMOUS_MAX || '200', 10),
    
    // Authenticated user limits (default: 500 requests per 15 minutes)
    authenticatedWindowMs: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW_MS || '900000', 10),
    authenticatedMaxRequests: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_MAX || '500', 10),
    
    // Admin user limits (default: 1000 requests per 15 minutes)
    adminWindowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || '900000', 10),
    adminMaxRequests: parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '1000', 10),
    
    // Trust proxy configuration
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  };

  // Validate rate limiting configuration
  const validationErrors: string[] = [];
  
  if (config.anonymousWindowMs < 60000) { // Minimum 1 minute
    validationErrors.push('RATE_LIMIT_ANONYMOUS_WINDOW_MS must be at least 60000 (1 minute)');
  }
  
  if (config.authenticatedWindowMs < 60000) {
    validationErrors.push('RATE_LIMIT_AUTHENTICATED_WINDOW_MS must be at least 60000 (1 minute)');
  }
  
  if (config.adminWindowMs < 60000) {
    validationErrors.push('RATE_LIMIT_ADMIN_WINDOW_MS must be at least 60000 (1 minute)');
  }
  
  if (config.anonymousMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_ANONYMOUS_MAX must be at least 1');
  }
  
  if (config.authenticatedMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_AUTHENTICATED_MAX must be at least 1');
  }
  
  if (config.adminMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_ADMIN_MAX must be at least 1');
  }
  
  // Log validation errors but use defaults
  if (validationErrors.length > 0) {
    console.warn('Rate limiting configuration validation warnings:');
    validationErrors.forEach(error => console.warn(`  - ${error}`));
    console.warn('Using default values for invalid configurations.');
    
    // Reset to defaults if invalid
    if (config.anonymousWindowMs < 60000) config.anonymousWindowMs = 900000;
    if (config.authenticatedWindowMs < 60000) config.authenticatedWindowMs = 900000;
    if (config.adminWindowMs < 60000) config.adminWindowMs = 900000;
    if (config.anonymousMaxRequests < 1) config.anonymousMaxRequests = 200;
    if (config.authenticatedMaxRequests < 1) config.authenticatedMaxRequests = 500;
    if (config.adminMaxRequests < 1) config.adminMaxRequests = 1000;
  }
  
  return config;
}

// Use getter functions to read env vars at runtime, not at import time
function getConfig(): Config {
  const rateLimitingConfig = parseRateLimitConfig();
  
  const config = {
    PORT: parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    DATABASE_URL: process.env.DATABASE_URL || '',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    // Legacy rate limiting (deprecated, kept for backward compatibility)
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    // Enhanced rate limiting configuration
    rateLimiting: rateLimitingConfig,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
    PAYPAL_MODE: process.env.PAYPAL_MODE || 'sandbox',
    SMTP2GO_API_KEY: process.env.SMTP2GO_API_KEY,
    SMTP2GO_USERNAME: process.env.SMTP2GO_USERNAME,
    SMTP2GO_PASSWORD: process.env.SMTP2GO_PASSWORD,
    FROM_EMAIL: process.env.FROM_EMAIL,
    FROM_NAME: process.env.FROM_NAME,
    LINODE_API_TOKEN: process.env.LINODE_API_TOKEN,
    SSH_CRED_SECRET: process.env.SSH_CRED_SECRET,
    CONTACT_FORM_RECIPIENT: process.env.CONTACT_FORM_RECIPIENT,
    COMPANY_BRAND_NAME:
      process.env.COMPANY_BRAND_NAME?.trim() ||
      process.env.COMPANY_NAME?.trim() ||
      'SkyPanelV2',
  };

  // Debug logging
  console.log('Config loaded:', {
    hasPayPalClientId: !!config.PAYPAL_CLIENT_ID,
    hasPayPalClientSecret: !!config.PAYPAL_CLIENT_SECRET,
    paypalMode: config.PAYPAL_MODE,
    hasSmtpCredentials: !!config.SMTP2GO_USERNAME && !!config.SMTP2GO_PASSWORD,
    hasFromEmail: !!config.FROM_EMAIL,
    rateLimiting: {
      anonymous: `${config.rateLimiting.anonymousMaxRequests}/${config.rateLimiting.anonymousWindowMs}ms`,
      authenticated: `${config.rateLimiting.authenticatedMaxRequests}/${config.rateLimiting.authenticatedWindowMs}ms`,
      admin: `${config.rateLimiting.adminMaxRequests}/${config.rateLimiting.adminWindowMs}ms`,
      trustProxy: config.rateLimiting.trustProxy
    },
    companyBrandName: config.COMPANY_BRAND_NAME
  });

  return config;
}

// Export a proxy that reads config values dynamically
export const config = new Proxy({} as Config, {
  get(target, prop: keyof Config) {
    return getConfig()[prop];
  }
});

/**
 * Validate rate limiting configuration values
 */
export function validateRateLimitConfig(rateLimitConfig: RateLimitConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate window times (minimum 1 minute, maximum 24 hours)
  const minWindow = 60000; // 1 minute
  const maxWindow = 86400000; // 24 hours
  
  if (rateLimitConfig.anonymousWindowMs < minWindow || rateLimitConfig.anonymousWindowMs > maxWindow) {
    errors.push(`Anonymous window must be between ${minWindow} and ${maxWindow} ms`);
  }
  
  if (rateLimitConfig.authenticatedWindowMs < minWindow || rateLimitConfig.authenticatedWindowMs > maxWindow) {
    errors.push(`Authenticated window must be between ${minWindow} and ${maxWindow} ms`);
  }
  
  if (rateLimitConfig.adminWindowMs < minWindow || rateLimitConfig.adminWindowMs > maxWindow) {
    errors.push(`Admin window must be between ${minWindow} and ${maxWindow} ms`);
  }
  
  // Validate request limits (minimum 1, maximum 10000)
  const minRequests = 1;
  const maxRequests = 10000;
  
  if (rateLimitConfig.anonymousMaxRequests < minRequests || rateLimitConfig.anonymousMaxRequests > maxRequests) {
    errors.push(`Anonymous max requests must be between ${minRequests} and ${maxRequests}`);
  }
  
  if (rateLimitConfig.authenticatedMaxRequests < minRequests || rateLimitConfig.authenticatedMaxRequests > maxRequests) {
    errors.push(`Authenticated max requests must be between ${minRequests} and ${maxRequests}`);
  }
  
  if (rateLimitConfig.adminMaxRequests < minRequests || rateLimitConfig.adminMaxRequests > maxRequests) {
    errors.push(`Admin max requests must be between ${minRequests} and ${maxRequests}`);
  }
  
  // Validate logical hierarchy (admin >= authenticated >= anonymous)
  if (rateLimitConfig.authenticatedMaxRequests < rateLimitConfig.anonymousMaxRequests) {
    errors.push('Authenticated user limits should be higher than or equal to anonymous user limits');
  }
  
  if (rateLimitConfig.adminMaxRequests < rateLimitConfig.authenticatedMaxRequests) {
    errors.push('Admin user limits should be higher than or equal to authenticated user limits');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateConfig(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    console.error('Please check your .env file and ensure all required variables are set.');
    // Don't exit in development, just warn
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Validate JWT secret in production
  if (process.env.NODE_ENV === 'production' && config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    console.error('JWT_SECRET must be changed in production!');
    process.exit(1);
  }

  // Validate rate limiting configuration
  const rateLimitValidation = validateRateLimitConfig(config.rateLimiting);
  if (!rateLimitValidation.isValid) {
    console.warn('Rate limiting configuration issues detected:');
    rateLimitValidation.errors.forEach(error => console.warn(`  - ${error}`));
    console.warn('Please review your rate limiting environment variables.');
  }

  console.log('Configuration validated successfully');
}