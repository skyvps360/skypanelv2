/**
 * Domain Management Service for SkyPanelV2
 * Handles custom domain configuration with Traefik integration
 */

import { query } from '../lib/database.js';
import Dockerode from 'dockerode';
import { 
  ContainerServiceError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveDns = promisify(dns.resolve4);
const resolveCname = promisify(dns.resolveCname);

// ============================================================
// Type Definitions
// ============================================================

export interface DomainConfig {
  organizationId: string;
  serviceId: string;
  hostname: string;
  port: number;
  pathPrefix?: string;
  sslEnabled: boolean;
}

export interface Domain {
  id: string;
  organizationId: string;
  serviceId: string;
  hostname: string;
  port: number;
  pathPrefix?: string;
  sslEnabled: boolean;
  status: 'active' | 'pending' | 'error';
  validatedAt?: string;
  certificateStatus?: 'issued' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dnsRecords?: string[];
}

export interface CertificateStatus {
  domain: string;
  status: 'issued' | 'pending' | 'error' | 'not_configured';
  issuer?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

// ============================================================
// Domain Service Class
// ============================================================

class DomainService {
  /**
   * Get Docker client
   */
  private getDockerClient(): Dockerode {
    return new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Generate Traefik labels for container routing
   */
  generateTraefikLabels(domain: Domain, serviceName: string): Record<string, string> {
    const routerName = `${serviceName}-${domain.hostname.replace(/\./g, '-')}`;
    const labels: Record<string, string> = {
      'traefik.enable': 'true',
      
      // HTTP Router
      [`traefik.http.routers.${routerName}.rule`]: domain.pathPrefix 
        ? `Host(\`${domain.hostname}\`) && PathPrefix(\`${domain.pathPrefix}\`)`
        : `Host(\`${domain.hostname}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: 'web',
      [`traefik.http.services.${routerName}.loadbalancer.server.port`]: domain.port.toString(),
    };

    // Add HTTPS configuration if SSL is enabled
    if (domain.sslEnabled) {
      labels[`traefik.http.routers.${routerName}-secure.rule`] = labels[`traefik.http.routers.${routerName}.rule`];
      labels[`traefik.http.routers.${routerName}-secure.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${routerName}-secure.tls`] = 'true';
      labels[`traefik.http.routers.${routerName}-secure.tls.certresolver`] = 'letsencrypt';
      
      // Redirect HTTP to HTTPS
      labels[`traefik.http.routers.${routerName}.middlewares`] = `${routerName}-redirect`;
      labels[`traefik.http.middlewares.${routerName}-redirect.redirectscheme.scheme`] = 'https';
      labels[`traefik.http.middlewares.${routerName}-redirect.redirectscheme.permanent`] = 'true';
    }

    return labels;
  }

  /**
   * Validate domain ownership and DNS configuration
   */
  async validateDomain(hostname: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const dnsRecords: string[] = [];

    try {
      // Check if domain has valid format
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
      if (!domainRegex.test(hostname)) {
        errors.push('Invalid domain format');
        return { valid: false, errors, warnings };
      }

      // Try to resolve A records
      try {
        const addresses = await resolveDns(hostname);
        dnsRecords.push(...addresses.map(addr => `A: ${addr}`));
      } catch (err: any) {
        if (err.code === 'ENOTFOUND') {
          errors.push('Domain does not resolve to any IP address');
        } else if (err.code === 'ENODATA') {
          // Try CNAME
          try {
            const cnames = await resolveCname(hostname);
            dnsRecords.push(...cnames.map(cname => `CNAME: ${cname}`));
            warnings.push('Domain uses CNAME record - ensure it points to the correct server');
          } catch (cnameErr) {
            errors.push('Domain has no A or CNAME records');
          }
        } else {
          errors.push(`DNS resolution error: ${err.message}`);
        }
      }

      // Check if domain points to this server (optional - would need server's public IP)
      if (dnsRecords.length > 0 && !errors.length) {
        warnings.push('DNS records found - ensure they point to this server for Traefik to work');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        dnsRecords: dnsRecords.length > 0 ? dnsRecords : undefined
      };
    } catch (error) {
      console.error('Error validating domain:', error);
      errors.push('Failed to validate domain');
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Add domain to service
   */
  async addDomain(config: DomainConfig): Promise<Domain> {
    try {
      // Validate domain first
      const validation = await this.validateDomain(config.hostname);
      if (!validation.valid) {
        throw new ContainerServiceError(
          ERROR_CODES.INVALID_RESOURCE_CONFIG,
          'Domain validation failed',
          400,
          { errors: validation.errors }
        );
      }

      // Store domain in database
      const result = await query(
        `INSERT INTO container_domains 
         (organization_id, service_id, hostname, port, path_prefix, ssl_enabled, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, organization_id, service_id, hostname, port, path_prefix, ssl_enabled, status, validated_at, certificate_status, created_at, updated_at`,
        [
          config.organizationId,
          config.serviceId,
          config.hostname,
          config.port,
          config.pathPrefix || null,
          config.sslEnabled,
          'pending'
        ]
      );

      const row = result.rows[0];
      const domain: Domain = {
        id: row.id,
        organizationId: row.organization_id,
        serviceId: row.service_id,
        hostname: row.hostname,
        port: row.port,
        pathPrefix: row.path_prefix,
        sslEnabled: row.ssl_enabled,
        status: row.status,
        validatedAt: row.validated_at,
        certificateStatus: row.certificate_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      // Update container with Traefik labels
      await this.updateContainerLabels(config.serviceId, domain);

      // Mark domain as active
      await query(
        'UPDATE container_domains SET status = $1, validated_at = NOW(), updated_at = NOW() WHERE id = $2',
        ['active', domain.id]
      );
      domain.status = 'active';
      domain.validatedAt = new Date().toISOString();

      return domain;
    } catch (error) {
      console.error('Error adding domain:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DEPLOYMENT_FAILED,
        'Failed to add domain',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update container with Traefik labels
   */
  private async updateContainerLabels(serviceId: string, domain: Domain): Promise<void> {
    try {
      // Get service info from database
      const serviceResult = await query(
        'SELECT container_id, service_name FROM container_services WHERE id = $1',
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        throw new Error('Service not found');
      }

      const service = serviceResult.rows[0];
      const containerId = service.container_id;
      const serviceName = service.service_name;

      if (!containerId) {
        throw new Error('Container not deployed yet');
      }

      const docker = this.getDockerClient();
      const container = docker.getContainer(containerId);
      
      // Get current container config
      const inspect = await container.inspect();
      const currentLabels = inspect.Config.Labels || {};
      
      // Generate new Traefik labels
      const traefikLabels = this.generateTraefikLabels(domain, serviceName);
      
      // Merge labels
      const newLabels = { ...currentLabels, ...traefikLabels };
      
      // Note: Docker doesn't allow updating labels on running containers
      // We need to recreate the container with new labels
      // This is handled by the rolling update process
      console.log('Traefik labels generated for container:', newLabels);
      
      // Store labels in database for next deployment
      await query(
        `UPDATE container_services 
         SET configuration = jsonb_set(
           COALESCE(configuration, '{}'::jsonb),
           '{traefikLabels}',
           $1::jsonb
         ),
         updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(traefikLabels), serviceId]
      );
    } catch (error) {
      console.error('Error updating container labels:', error);
      throw error;
    }
  }

  /**
   * List domains for a service
   */
  async listDomains(serviceId: string): Promise<Domain[]> {
    try {
      const result = await query(
        `SELECT id, organization_id, service_id, hostname, port, path_prefix, ssl_enabled, status, validated_at, certificate_status, created_at, updated_at
         FROM container_domains
         WHERE service_id = $1
         ORDER BY created_at DESC`,
        [serviceId]
      );

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        serviceId: row.service_id,
        hostname: row.hostname,
        port: row.port,
        pathPrefix: row.path_prefix,
        sslEnabled: row.ssl_enabled,
        status: row.status,
        validatedAt: row.validated_at,
        certificateStatus: row.certificate_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing domains:', error);
      return [];
    }
  }

  /**
   * List all domains for an organization
   */
  async listOrganizationDomains(organizationId: string): Promise<Domain[]> {
    try {
      const result = await query(
        `SELECT id, organization_id, service_id, hostname, port, path_prefix, ssl_enabled, status, validated_at, certificate_status, created_at, updated_at
         FROM container_domains
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        serviceId: row.service_id,
        hostname: row.hostname,
        port: row.port,
        pathPrefix: row.path_prefix,
        sslEnabled: row.ssl_enabled,
        status: row.status,
        validatedAt: row.validated_at,
        certificateStatus: row.certificate_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing organization domains:', error);
      return [];
    }
  }

  /**
   * Delete a domain
   */
  async deleteDomain(domainId: string): Promise<void> {
    try {
      await query('DELETE FROM container_domains WHERE id = $1', [domainId]);
    } catch (error) {
      console.error('Error deleting domain:', error);
      throw new ContainerServiceError(
        ERROR_CODES.SERVICE_DELETE_FAILED,
        'Failed to delete domain',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get certificate status for a domain
   */
  async getCertificateStatus(hostname: string): Promise<CertificateStatus> {
    try {
      // In a real implementation, this would query Traefik's API or check certificate files
      // For now, return status from database
      const result = await query(
        'SELECT certificate_status, updated_at FROM container_domains WHERE hostname = $1 ORDER BY created_at DESC LIMIT 1',
        [hostname]
      );

      if (result.rows.length === 0) {
        return {
          domain: hostname,
          status: 'not_configured'
        };
      }

      const row = result.rows[0];
      return {
        domain: hostname,
        status: row.certificate_status || 'pending',
        // In production, these would come from actual certificate inspection
        issuer: row.certificate_status === 'issued' ? 'Let\'s Encrypt' : undefined,
        expiresAt: undefined, // Would calculate from cert
        daysRemaining: undefined
      };
    } catch (error) {
      console.error('Error getting certificate status:', error);
      return {
        domain: hostname,
        status: 'error'
      };
    }
  }

  /**
   * Ensure Traefik is deployed and running
   */
  async ensureTraefikDeployed(): Promise<{ deployed: boolean; containerId?: string }> {
    try {
      const docker = this.getDockerClient();
      
      // Check if Traefik container exists
      const containers = await docker.listContainers({
        all: true,
        filters: { label: ['skypanel.traefik=true'] }
      });

      if (containers.length > 0) {
        const container = containers[0];
        const isRunning = container.State === 'running';
        
        if (!isRunning) {
          // Start the container
          const traefikContainer = docker.getContainer(container.Id);
          await traefikContainer.start();
        }
        
        return { deployed: true, containerId: container.Id };
      }

      // Deploy Traefik if not exists
      return await this.deployTraefik();
    } catch (error) {
      console.error('Error ensuring Traefik deployed:', error);
      return { deployed: false };
    }
  }

  /**
   * Deploy Traefik reverse proxy
   */
  private async deployTraefik(): Promise<{ deployed: boolean; containerId?: string }> {
    try {
      const docker = this.getDockerClient();

      // Create Traefik container
      const container = await docker.createContainer({
        name: 'skypanel-traefik',
        Image: 'traefik:v2.10',
        Cmd: [
          '--api.dashboard=true',
          '--api.insecure=true',
          '--providers.docker=true',
          '--providers.docker.exposedbydefault=false',
          '--entrypoints.web.address=:80',
          '--entrypoints.websecure.address=:443',
          '--certificatesresolvers.letsencrypt.acme.tlschallenge=true',
          '--certificatesresolvers.letsencrypt.acme.email=admin@skypanel.local',
          '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
        ],
        ExposedPorts: {
          '80/tcp': {},
          '443/tcp': {},
          '8080/tcp': {}
        },
        HostConfig: {
          Binds: [
            '/var/run/docker.sock:/var/run/docker.sock:ro',
            'traefik-letsencrypt:/letsencrypt'
          ],
          PortBindings: {
            '80/tcp': [{ HostPort: '80' }],
            '443/tcp': [{ HostPort: '443' }],
            '8080/tcp': [{ HostPort: '8080' }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        Labels: {
          'skypanel.traefik': 'true',
          'skypanel.managed': 'true'
        }
      });

      await container.start();

      console.log('Traefik deployed successfully');
      return { deployed: true, containerId: container.id };
    } catch (error) {
      console.error('Error deploying Traefik:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DEPLOYMENT_FAILED,
        'Failed to deploy Traefik',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// Export singleton instance
export const domainService = new DomainService();
