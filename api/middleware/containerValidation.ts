/**
 * Container Validation Middleware
 * Provides input validation for container API routes
 */

import { Request, Response, NextFunction } from 'express';
import {
  ValidationErrorDetail,
  validateProjectName,
  validateServiceName,
  validateResourceConfig,
  validateEnvironmentVariables,
  formatValidationErrorResponse,
  ERROR_CODES,
} from '../lib/containerErrors.js';
import { query } from '../lib/database.js';

// ============================================================
// Validation Middleware Functions
// ============================================================

/**
 * Validate project creation request
 */
export function validateCreateProject(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { projectName } = req.body;

  // Validate project name
  errors.push(...validateProjectName(projectName));

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate project name parameter
 */
export function validateProjectNameParam(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { projectName } = req.params;

  // Validate project name
  errors.push(...validateProjectName(projectName));

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate service name parameter
 */
export function validateServiceNameParam(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { serviceName } = req.params;

  // Validate service name
  errors.push(...validateServiceName(serviceName));

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate app service deployment request
 */
export function validateDeployAppService(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { serviceName, source, env, resources } = req.body;

  // Validate service name
  errors.push(...validateServiceName(serviceName));

  // Validate source configuration
  if (!source || typeof source !== 'object') {
    errors.push({
      field: 'source',
      message: 'Source configuration is required',
      value: source,
    });
  } else {
    if (!source.type || typeof source.type !== 'string') {
      errors.push({
        field: 'source.type',
        message: 'Source type is required',
        value: source.type,
      });
    } else if (!['image', 'github', 'git', 'upload', 'dockerfile'].includes(source.type)) {
      errors.push({
        field: 'source.type',
        message: 'Source type must be one of: image, github, git, upload, dockerfile',
        value: source.type,
      });
    }

    // Validate source-specific fields
    if (source.type === 'image' && (!source.image || typeof source.image !== 'string')) {
      errors.push({
        field: 'source.image',
        message: 'Docker image name is required for image source type',
        value: source.image,
      });
    }

    if (source.type === 'github') {
      if (!source.owner || typeof source.owner !== 'string') {
        errors.push({
          field: 'source.owner',
          message: 'GitHub owner is required for github source type',
          value: source.owner,
        });
      }
      if (!source.repo || typeof source.repo !== 'string') {
        errors.push({
          field: 'source.repo',
          message: 'GitHub repository is required for github source type',
          value: source.repo,
        });
      }
    }

    if (source.type === 'git' && (!source.repo || typeof source.repo !== 'string')) {
      errors.push({
        field: 'source.repo',
        message: 'Git repository URL is required for git source type',
        value: source.repo,
      });
    }

    if (source.type === 'dockerfile' && (!source.dockerfile || typeof source.dockerfile !== 'string')) {
      errors.push({
        field: 'source.dockerfile',
        message: 'Dockerfile content is required for dockerfile source type',
        value: source.dockerfile,
      });
    }
  }

  // Validate environment variables
  errors.push(...validateEnvironmentVariables(env));

  // Validate resource configuration
  errors.push(...validateResourceConfig(resources));

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate database service deployment request
 */
export function validateDeployDatabaseService(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { serviceName, databaseType, version, credentials, resources } = req.body;

  // Validate service name
  errors.push(...validateServiceName(serviceName));

  // Validate database type
  if (!databaseType || typeof databaseType !== 'string') {
    errors.push({
      field: 'databaseType',
      message: 'Database type is required',
      value: databaseType,
    });
  } else if (!['postgres', 'mysql', 'mariadb', 'mongo', 'redis'].includes(databaseType)) {
    errors.push({
      field: 'databaseType',
      message: 'Database type must be one of: postgres, mysql, mariadb, mongo, redis',
      value: databaseType,
    });
  }

  // Validate version (optional)
  if (version !== undefined && (typeof version !== 'string' || version.trim() === '')) {
    errors.push({
      field: 'version',
      message: 'Database version must be a non-empty string if provided',
      value: version,
    });
  }

  // Validate credentials (optional)
  if (credentials !== undefined) {
    if (typeof credentials !== 'object' || Array.isArray(credentials)) {
      errors.push({
        field: 'credentials',
        message: 'Credentials must be an object',
        value: credentials,
      });
    } else {
      if (credentials.username !== undefined && (typeof credentials.username !== 'string' || credentials.username.trim() === '')) {
        errors.push({
          field: 'credentials.username',
          message: 'Username must be a non-empty string if provided',
          value: credentials.username,
        });
      }

      if (credentials.password !== undefined && (typeof credentials.password !== 'string' || credentials.password.length < 8)) {
        errors.push({
          field: 'credentials.password',
          message: 'Password must be at least 8 characters long if provided',
          value: credentials.password ? '[REDACTED]' : credentials.password,
        });
      }
    }
  }

  // Validate resource configuration
  errors.push(...validateResourceConfig(resources));

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate template deployment request
 */
export function validateDeployTemplateService(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { serviceName, templateName, configuration } = req.body;

  // Validate service name
  errors.push(...validateServiceName(serviceName));

  // Validate template name
  if (!templateName || typeof templateName !== 'string') {
    errors.push({
      field: 'templateName',
      message: 'Template name is required',
      value: templateName,
    });
  }

  // Validate configuration (optional)
  if (configuration !== undefined && (typeof configuration !== 'object' || Array.isArray(configuration))) {
    errors.push({
      field: 'configuration',
      message: 'Configuration must be an object',
      value: configuration,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate environment variables update request
 */
export function validateUpdateEnvironment(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { env } = req.body;

  if (!env) {
    errors.push({
      field: 'env',
      message: 'Environment variables object is required',
      value: env,
    });
  } else {
    // Validate environment variables
    errors.push(...validateEnvironmentVariables(env));
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate resource update request
 */
export function validateUpdateResources(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { resources } = req.body;

  if (!resources) {
    errors.push({
      field: 'resources',
      message: 'Resources configuration is required',
      value: resources,
    });
  } else {
    // Validate resource configuration
    errors.push(...validateResourceConfig(resources));
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate container plan creation request
 */
export function validateCreateContainerPlan(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { name, description, priceMonthly, maxCpuCores, maxMemoryGb, maxStorageGb, maxContainers } = req.body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Plan name is required',
      value: name,
    });
  } else if (name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Plan name must be less than 100 characters',
      value: name,
    });
  }

  // Validate description (optional)
  if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
    errors.push({
      field: 'description',
      message: 'Plan description must be a string less than 500 characters',
      value: description,
    });
  }

  // Validate price
  if (typeof priceMonthly !== 'number' || priceMonthly < 0) {
    errors.push({
      field: 'priceMonthly',
      message: 'Monthly price must be a non-negative number',
      value: priceMonthly,
    });
  } else if (priceMonthly > 10000) {
    errors.push({
      field: 'priceMonthly',
      message: 'Monthly price cannot exceed $10,000',
      value: priceMonthly,
    });
  }

  // Validate resource limits
  if (typeof maxCpuCores !== 'number' || maxCpuCores < 0.1) {
    errors.push({
      field: 'maxCpuCores',
      message: 'Maximum CPU cores must be at least 0.1',
      value: maxCpuCores,
    });
  } else if (maxCpuCores > 64) {
    errors.push({
      field: 'maxCpuCores',
      message: 'Maximum CPU cores cannot exceed 64',
      value: maxCpuCores,
    });
  }

  if (typeof maxMemoryGb !== 'number' || maxMemoryGb < 0.1) {
    errors.push({
      field: 'maxMemoryGb',
      message: 'Maximum memory must be a positive number',
      value: maxMemoryGb,
    });
  } else if (maxMemoryGb > 512) {
    errors.push({
      field: 'maxMemoryGb',
      message: 'Maximum memory cannot exceed 512GB',
      value: maxMemoryGb,
    });
  }

  if (typeof maxStorageGb !== 'number' || maxStorageGb <= 0) {
    errors.push({
      field: 'maxStorageGb',
      message: 'Maximum storage must be a positive number',
      value: maxStorageGb,
    });
  } else if (maxStorageGb > 10000) {
    errors.push({
      field: 'maxStorageGb',
      message: 'Maximum storage cannot exceed 10TB (10000GB)',
      value: maxStorageGb,
    });
  }

  if (typeof maxContainers !== 'number' || maxContainers <= 0 || !Number.isInteger(maxContainers)) {
    errors.push({
      field: 'maxContainers',
      message: 'Maximum containers must be a positive integer',
      value: maxContainers,
    });
  } else if (maxContainers > 1000) {
    errors.push({
      field: 'maxContainers',
      message: 'Maximum containers cannot exceed 1000',
      value: maxContainers,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate container template creation request
 */
export function validateCreateContainerTemplate(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { templateName, displayName, description, category, templateSchema } = req.body;

  // Validate template name
  if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
    errors.push({
      field: 'templateName',
      message: 'Template name is required',
      value: templateName,
    });
  } else if (!/^[a-z0-9-_]+$/.test(templateName)) {
    errors.push({
      field: 'templateName',
      message: 'Template name can only contain lowercase letters, numbers, hyphens, and underscores',
      value: templateName,
    });
  }

  // Validate display name
  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    errors.push({
      field: 'displayName',
      message: 'Display name is required',
      value: displayName,
    });
  } else if (displayName.length > 100) {
    errors.push({
      field: 'displayName',
      message: 'Display name must be less than 100 characters',
      value: displayName,
    });
  }

  // Validate description (optional)
  if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
    errors.push({
      field: 'description',
      message: 'Description must be a string less than 500 characters',
      value: description,
    });
  }

  // Validate category (optional)
  if (category !== undefined && (typeof category !== 'string' || category.length > 50)) {
    errors.push({
      field: 'category',
      message: 'Category must be a string less than 50 characters',
      value: category,
    });
  }

  // Validate template schema
  if (!templateSchema || typeof templateSchema !== 'object') {
    errors.push({
      field: 'templateSchema',
      message: 'Template schema is required and must be an object',
      value: templateSchema,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}

/**
 * Validate Easypanel configuration request
 * API key is optional when updating existing config, required for new configs
 */
export async function validateEasypanelConfig(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationErrorDetail[] = [];
  const { apiUrl, apiKey } = req.body;

  // Validate API URL
  if (!apiUrl || typeof apiUrl !== 'string' || apiUrl.trim() === '') {
    errors.push({
      field: 'apiUrl',
      message: 'API URL is required',
      value: apiUrl,
    });
  } else {
    try {
      new URL(apiUrl);
    } catch {
      errors.push({
        field: 'apiUrl',
        message: 'API URL must be a valid URL',
        value: apiUrl,
      });
    }
  }

  // Check if configuration exists to determine if API key is required
  let existingConfig = null;
  
  try {
    const existingResult = await query(
      'SELECT id, api_key_encrypted FROM easypanel_config WHERE active = true LIMIT 1'
    );
    existingConfig = existingResult.rows.length > 0 ? existingResult.rows[0] : null;
  } catch (error) {
    // If we can't check, require API key to be safe
    console.error('Error checking existing config in validation:', error);
  }

  // Validate API key - only required if:
  // 1. No existing config exists (new configuration)
  // 2. User provided one (validate it)
  const isNewConfig = !existingConfig;
  const hasProvidedApiKey = apiKey && typeof apiKey === 'string' && apiKey.trim() !== '';

  if (isNewConfig && !hasProvidedApiKey) {
    errors.push({
      field: 'apiKey',
      message: 'API key is required for new configuration',
      value: '[REDACTED]',
    });
  } else if (hasProvidedApiKey && apiKey.trim().length < 10) {
    errors.push({
      field: 'apiKey',
      message: 'API key must be at least 10 characters long',
      value: '[REDACTED]',
    });
  }

  if (errors.length > 0) {
    return res.status(400).json(formatValidationErrorResponse(errors));
  }

  next();
}