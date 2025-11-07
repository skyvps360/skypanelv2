import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import logger from './logger.js';

export function detectBuildpack(workspacePath) {
  // Check for package.json (Node.js)
  if (existsSync(join(workspacePath, 'package.json'))) {
    return 'node';
  }

  // Check for requirements.txt (Python)
  if (existsSync(join(workspacePath, 'requirements.txt'))) {
    return 'python';
  }

  // Check for composer.json (PHP)
  if (existsSync(join(workspacePath, 'composer.json'))) {
    return 'php';
  }

  // Check for Dockerfile
  if (existsSync(join(workspacePath, 'Dockerfile'))) {
    return 'docker';
  }

  return null;
}

export function generateDockerfile(workspacePath, runtime) {
  const dockerfilePath = join(workspacePath, 'Dockerfile');
  
  // Don't overwrite existing Dockerfile
  if (existsSync(dockerfilePath)) {
    logger.info('📄 Using existing Dockerfile');
    return dockerfilePath;
  }

  logger.info(`📄 Generating Dockerfile for runtime: ${runtime.name}`);

  let dockerfile = '';

  switch (runtime.runtime_type) {
    case 'node':
      dockerfile = `FROM ${runtime.docker_image || 'node:20-alpine'}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ${runtime.start_command || '["npm", "start"]'}
`;
      break;

    case 'python':
      dockerfile = `FROM ${runtime.docker_image || 'python:3.11-slim'}

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start command
CMD ${runtime.start_command || '["python", "main.py"]'}
`;
      break;

    case 'php':
      dockerfile = `FROM ${runtime.docker_image || 'php:8.2-apache'}

WORKDIR /var/www/html

# Install dependencies if composer.json exists
COPY composer.* ./
RUN if [ -f "composer.json" ]; then \\
      curl -sS https://getcomposer.org/installer | php && \\
      php composer.phar install --no-dev; \\
    fi

# Copy application code
COPY . .

# Apache is already exposed on port 80
EXPOSE 80

# Apache starts automatically
`;
      break;

    default:
      throw new Error(`Unsupported runtime type: ${runtime.runtime_type}`);
  }

  writeFileSync(dockerfilePath, dockerfile);
  logger.info('✅ Dockerfile generated');
  
  return dockerfilePath;
}
