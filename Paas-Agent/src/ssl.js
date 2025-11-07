import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import logger from './logger.js';

const SSL_CERT_DIR = process.env.SSL_CERT_DIR || '/etc/letsencrypt/live';
const CERTBOT_EMAIL = process.env.CERTBOT_EMAIL || 'admin@skypanel.local';
const WEBROOT_PATH = process.env.WEBROOT_PATH || '/var/www/certbot';

export function isCertbotInstalled() {
  try {
    execSync('which certbot', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

export function hasCertificate(domain) {
  const certPath = join(SSL_CERT_DIR, domain, 'fullchain.pem');
  return existsSync(certPath);
}

export async function requestCertificate(domain, additionalDomains = []) {
  logger.info(`🔐 Requesting SSL certificate for ${domain}`);
  
  if (!isCertbotInstalled()) {
    logger.error('❌ Certbot is not installed. Install with: apt-get install certbot');
    return false;
  }
  
  try {
    // Build domain list
    const domains = [domain, ...additionalDomains].filter(Boolean);
    const domainArgs = domains.map(d => `-d ${d}`).join(' ');
    
    // Request certificate using webroot method
    const command = `certbot certonly --webroot -w ${WEBROOT_PATH} ${domainArgs} --email ${CERTBOT_EMAIL} --agree-tos --non-interactive --keep-until-expiring`;
    
    logger.info(`Running: ${command}`);
    const output = execSync(command, { encoding: 'utf-8' });
    
    logger.info('✅ SSL certificate obtained successfully');
    logger.debug(output);
    
    return true;
  } catch (error) {
    logger.error(`❌ Failed to obtain SSL certificate: ${error.message}`);
    if (error.stdout) logger.error(error.stdout.toString());
    if (error.stderr) logger.error(error.stderr.toString());
    return false;
  }
}

export async function renewCertificate(domain) {
  logger.info(`🔄 Renewing SSL certificate for ${domain}`);
  
  if (!isCertbotInstalled()) {
    logger.error('❌ Certbot is not installed');
    return false;
  }
  
  try {
    const command = `certbot renew --cert-name ${domain} --non-interactive`;
    const output = execSync(command, { encoding: 'utf-8' });
    
    logger.info('✅ SSL certificate renewed successfully');
    logger.debug(output);
    
    return true;
  } catch (error) {
    logger.error(`❌ Failed to renew SSL certificate: ${error.message}`);
    return false;
  }
}

export async function revokeCertificate(domain) {
  logger.info(`🗑️  Revoking SSL certificate for ${domain}`);
  
  if (!isCertbotInstalled()) {
    logger.error('❌ Certbot is not installed');
    return false;
  }
  
  try {
    const command = `certbot revoke --cert-name ${domain} --delete-after-revoke --non-interactive`;
    const output = execSync(command, { encoding: 'utf-8' });
    
    logger.info('✅ SSL certificate revoked successfully');
    logger.debug(output);
    
    return true;
  } catch (error) {
    logger.error(`❌ Failed to revoke SSL certificate: ${error.message}`);
    return false;
  }
}

export async function setupAutoRenewal() {
  logger.info('⏰ Setting up automatic certificate renewal');
  
  try {
    // Create systemd timer for renewal (runs twice daily)
    const timerContent = `[Unit]
Description=Certbot Renewal Timer

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
`;
    
    const serviceContent = `[Unit]
Description=Certbot Renewal

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "nginx -s reload"
`;
    
    // Note: This requires root permissions
    logger.info('💡 Auto-renewal timer configuration ready');
    logger.info('To enable, run as root:');
    logger.info('  echo \'[timer content]\' > /etc/systemd/system/certbot-renewal.timer');
    logger.info('  echo \'[service content]\' > /etc/systemd/system/certbot-renewal.service');
    logger.info('  systemctl enable certbot-renewal.timer');
    logger.info('  systemctl start certbot-renewal.timer');
    
    return { timerContent, serviceContent };
  } catch (error) {
    logger.error(`Failed to setup auto-renewal: ${error.message}`);
    return null;
  }
}

export function getCertificateInfo(domain) {
  const certPath = join(SSL_CERT_DIR, domain, 'fullchain.pem');
  
  if (!existsSync(certPath)) {
    return null;
  }
  
  try {
    const output = execSync(`openssl x509 -in ${certPath} -noout -dates -subject`, { encoding: 'utf-8' });
    
    const lines = output.split('\n');
    const info = {};
    
    for (const line of lines) {
      if (line.startsWith('notBefore=')) {
        info.notBefore = line.substring('notBefore='.length);
      } else if (line.startsWith('notAfter=')) {
        info.notAfter = line.substring('notAfter='.length);
      } else if (line.startsWith('subject=')) {
        info.subject = line.substring('subject='.length);
      }
    }
    
    return info;
  } catch (error) {
    logger.error(`Failed to get certificate info: ${error.message}`);
    return null;
  }
}

export async function ensureCertificateForApp(app) {
  const { systemDomain, customDomains = [] } = app;
  
  if (!systemDomain) {
    logger.warn('No system domain configured for app');
    return false;
  }
  
  // Check if certificate already exists
  if (hasCertificate(systemDomain)) {
    logger.info(`Certificate already exists for ${systemDomain}`);
    return true;
  }
  
  // Request new certificate
  const success = await requestCertificate(systemDomain, customDomains);
  
  if (success) {
    logger.info(`✅ SSL certificate provisioned for ${systemDomain}`);
  } else {
    logger.error(`❌ Failed to provision SSL certificate for ${systemDomain}`);
  }
  
  return success;
}
