import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import logger from './logger.js';

const NGINX_CONF_DIR = process.env.NGINX_CONF_DIR || '/etc/nginx/sites-available';
const NGINX_ENABLED_DIR = process.env.NGINX_ENABLED_DIR || '/etc/nginx/sites-enabled';
const SSL_CERT_DIR = process.env.SSL_CERT_DIR || '/etc/letsencrypt/live';

export function isNginxInstalled() {
  try {
    execSync('which nginx', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

export function ensureNginxDirs() {
  if (!existsSync(NGINX_CONF_DIR)) {
    mkdirSync(NGINX_CONF_DIR, { recursive: true });
  }
  if (!existsSync(NGINX_ENABLED_DIR)) {
    mkdirSync(NGINX_ENABLED_DIR, { recursive: true });
  }
}

export function generateNginxConfig(app) {
  const { slug, systemDomain, customDomains = [], port = 3000, instanceCount = 1 } = app;
  
  const allDomains = [systemDomain, ...customDomains].filter(Boolean);
  const serverNames = allDomains.join(' ');
  
  // Check if SSL certificates exist
  const hasSsl = existsSync(join(SSL_CERT_DIR, systemDomain));
  
  let config = '';
  
  // HTTP config (always present for ACME challenge and redirect)
  config += `server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};
    
    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }
    
`;

  if (hasSsl) {
    // Redirect HTTP to HTTPS if SSL is available
    config += `    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

`;
    
    // HTTPS config
    config += `server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${serverNames};
    
    # SSL certificates
    ssl_certificate ${join(SSL_CERT_DIR, systemDomain, 'fullchain.pem')};
    ssl_certificate_key ${join(SSL_CERT_DIR, systemDomain, 'privkey.pem')};
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
`;
  } else {
    // Serve HTTP directly if no SSL yet
    config += `    # Proxy settings (HTTP only - SSL pending)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
`;
  }
  
  // Upstream configuration for load balancing
  if (instanceCount > 1) {
    const upstreamName = `app_${slug}`;
    let upstreamConfig = `upstream ${upstreamName} {
`;
    for (let i = 0; i < instanceCount; i++) {
      const containerName = instanceCount === 1 ? `paas-${slug}` : `paas-${slug}-${i}`;
      upstreamConfig += `    server ${containerName}:${port};\n`;
    }
    upstreamConfig += `    least_conn;
    keepalive 16;
}

`;
    
    config = upstreamConfig + config;
    
    config += `    location / {
        proxy_pass http://${upstreamName};
    }
}
`;
  } else {
    // Single instance - direct proxy
    const containerName = `paas-${slug}`;
    config += `    location / {
        proxy_pass http://${containerName}:${port};
    }
}
`;
  }
  
  return config;
}

export function writeNginxConfig(appSlug, config) {
  const confPath = join(NGINX_CONF_DIR, `paas-${appSlug}.conf`);
  const enabledPath = join(NGINX_ENABLED_DIR, `paas-${appSlug}.conf`);
  
  logger.info(`📝 Writing Nginx config for ${appSlug}`);
  
  // Ensure directories exist
  ensureNginxDirs();
  
  // Write config file
  writeFileSync(confPath, config);
  
  // Create symlink to enabled directory
  if (!existsSync(enabledPath)) {
    try {
      execSync(`ln -s ${confPath} ${enabledPath}`);
    } catch (error) {
      logger.warn(`Failed to create symlink: ${error.message}`);
    }
  }
  
  logger.info(`✅ Nginx config written: ${confPath}`);
}

export function removeNginxConfig(appSlug) {
  const confPath = join(NGINX_CONF_DIR, `paas-${appSlug}.conf`);
  const enabledPath = join(NGINX_ENABLED_DIR, `paas-${appSlug}.conf`);
  
  logger.info(`🗑️  Removing Nginx config for ${appSlug}`);
  
  try {
    if (existsSync(enabledPath)) {
      execSync(`rm ${enabledPath}`);
    }
    if (existsSync(confPath)) {
      execSync(`rm ${confPath}`);
    }
    logger.info(`✅ Nginx config removed: ${appSlug}`);
  } catch (error) {
    logger.error(`Failed to remove Nginx config: ${error.message}`);
  }
}

export function reloadNginx() {
  try {
    logger.info('🔄 Reloading Nginx...');
    
    // Test config first
    execSync('nginx -t', { stdio: 'pipe' });
    
    // Reload
    execSync('nginx -s reload', { stdio: 'pipe' });
    
    logger.info('✅ Nginx reloaded successfully');
    return true;
  } catch (error) {
    logger.error(`❌ Nginx reload failed: ${error.message}`);
    return false;
  }
}

export function updateAppConfig(app) {
  try {
    const config = generateNginxConfig(app);
    writeNginxConfig(app.slug, config);
    return reloadNginx();
  } catch (error) {
    logger.error(`Failed to update Nginx config for ${app.slug}:`, error.message);
    return false;
  }
}

export function removeAppConfig(appSlug) {
  try {
    removeNginxConfig(appSlug);
    return reloadNginx();
  } catch (error) {
    logger.error(`Failed to remove Nginx config for ${appSlug}:`, error.message);
    return false;
  }
}
