import { Request, Response, NextFunction } from 'express';

// Validate application name
export function validateApplicationName(req: Request, res: Response, next: NextFunction) {
  const { name } = req.body;
  
  if (!name) {
    return next();
  }
  
  // Must be alphanumeric with hyphens, underscores, and spaces
  // Length: 3-100 characters
  const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{1,98}[a-zA-Z0-9]$/;
  
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      success: false,
      error: 'Application name must be 3-100 characters and contain only letters, numbers, spaces, hyphens, and underscores'
    });
  }
  
  next();
}

// Validate environment variable keys
export function validateEnvVarKeys(req: Request, res: Response, next: NextFunction) {
  const { key, keys } = req.body;
  
  const keysToValidate = key ? [key] : (keys || []);
  
  if (keysToValidate.length === 0) {
    return next();
  }
  
  // Environment variable keys must be uppercase alphanumeric with underscores
  const keyRegex = /^[A-Z][A-Z0-9_]{0,254}$/;
  
  for (const k of keysToValidate) {
    if (!keyRegex.test(k)) {
      return res.status(400).json({
        success: false,
        error: `Invalid environment variable key: ${k}. Must be uppercase alphanumeric with underscores, starting with a letter, max 255 characters`
      });
    }
  }
  
  next();
}

// Validate environment variable values
export function validateEnvVarValues(req: Request, res: Response, next: NextFunction) {
  const { value, values } = req.body;
  
  const valuesToValidate = value !== undefined ? [value] : (values || []);
  
  if (valuesToValidate.length === 0) {
    return next();
  }
  
  for (const v of valuesToValidate) {
    // Max 32KB per value
    if (typeof v === 'string' && v.length > 32768) {
      return res.status(400).json({
        success: false,
        error: 'Environment variable value too large (max 32KB)'
      });
    }
  }
  
  next();
}

// Validate Git repository URL
export function validateGitUrl(req: Request, res: Response, next: NextFunction) {
  const { git_repo_url } = req.body;
  
  if (!git_repo_url) {
    return next();
  }
  
  // Must be a valid Git URL (HTTPS or SSH)
  const httpsRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+(?:\.git)?$/;
  const sshRegex = /^git@github\.com:[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+(?:\.git)?$/;
  
  if (!httpsRegex.test(git_repo_url) && !sshRegex.test(git_repo_url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Git repository URL. Must be a GitHub HTTPS or SSH URL'
    });
  }
  
  next();
}

// Validate Git branch name
export function validateGitBranch(req: Request, res: Response, next: NextFunction) {
  const { git_branch } = req.body;
  
  if (!git_branch) {
    return next();
  }
  
  // Branch names can contain alphanumeric, hyphens, underscores, slashes, dots
  // Cannot start with a dot or slash
  const branchRegex = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,254}$/;
  
  if (!branchRegex.test(git_branch)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid branch name. Must be 1-255 characters, alphanumeric with -, _, /, .'
    });
  }
  
  next();
}

// Validate database name
export function validateDatabaseName(req: Request, res: Response, next: NextFunction) {
  const { name } = req.body;
  
  if (!name) {
    return next();
  }
  
  // Database names must be lowercase alphanumeric with underscores
  // Length: 3-63 characters
  const nameRegex = /^[a-z][a-z0-9_]{1,61}[a-z0-9]$/;
  
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      success: false,
      error: 'Database name must be 3-63 characters, lowercase alphanumeric with underscores'
    });
  }
  
  next();
}

// Validate instance count for scaling
export function validateInstanceCount(req: Request, res: Response, next: NextFunction) {
  const { instance_count } = req.body;
  
  if (instance_count === undefined) {
    return next();
  }
  
  const count = parseInt(instance_count);
  
  if (isNaN(count) || count < 1 || count > 10) {
    return res.status(400).json({
      success: false,
      error: 'Instance count must be between 1 and 10'
    });
  }
  
  next();
}

// Sanitize slug (used for URLs and container names)
export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63); // Max 63 chars for DNS compatibility
}

// Validate domain name
export function validateDomain(req: Request, res: Response, next: NextFunction) {
  const { domain, domains } = req.body;
  
  const domainsToValidate = domain ? [domain] : (domains || []);
  
  if (domainsToValidate.length === 0) {
    return next();
  }
  
  // Basic domain validation
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  
  for (const d of domainsToValidate) {
    if (!domainRegex.test(d)) {
      return res.status(400).json({
        success: false,
        error: `Invalid domain name: ${d}`
      });
    }
  }
  
  next();
}

// Prevent command injection in build/start commands
export function validateCommands(req: Request, res: Response, next: NextFunction) {
  const { build_command, start_command, default_build_cmd, default_start_cmd } = req.body;
  
  const commands = [build_command, start_command, default_build_cmd, default_start_cmd].filter(Boolean);
  
  if (commands.length === 0) {
    return next();
  }
  
  // Disallow dangerous characters and sequences
  const dangerousPatterns = [
    /[;&|`$()]/,  // Shell operators
    /\$\{/,       // Variable substitution
    /\.\./,       // Path traversal
    /\/dev\//,    // Device files
    /\/proc\//,   // Proc filesystem
  ];
  
  for (const cmd of commands) {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        return res.status(400).json({
          success: false,
          error: 'Command contains potentially dangerous characters or sequences'
        });
      }
    }
    
    // Max command length
    if (cmd.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Command too long (max 1000 characters)'
      });
    }
  }
  
  next();
}
