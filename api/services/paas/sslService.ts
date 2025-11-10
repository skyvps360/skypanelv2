import crypto from 'crypto';
import { pool, PaasDomain } from '../../lib/database.js';
import { DnsCache } from './dnsCache.js';

const TXT_PREFIX = '_paas-verify';

export class SSLService {
  static generateVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static async validateDomainOwnership(domain: PaasDomain): Promise<boolean> {
    if (!domain.dns_verification_token) {
      return false;
    }

    const recordName = `${TXT_PREFIX}.${domain.domain}`;

    try {
      const records = await DnsCache.resolveTxt(recordName);
      const flattened = records.flat().map((entry) => entry.toString());
      return flattened.some((entry) => entry.includes(domain.dns_verification_token!));
    } catch {
      return false;
    }
  }

  static async markDomainVerified(domainId: string): Promise<void> {
    await pool.query(
      `UPDATE paas_domains
         SET is_verified = true,
             verification_status = 'verified',
             verified_at = NOW()
       WHERE id = $1`,
      [domainId]
    );
  }

  static async beginCertificateProvision(domainId: string): Promise<void> {
    await pool.query(
      `UPDATE paas_domains
         SET ssl_status = 'provisioning',
             ssl_last_checked_at = NOW()
       WHERE id = $1`,
      [domainId]
    );
  }

  static async markCertificateActive(domainId: string): Promise<void> {
    await pool.query(
      `UPDATE paas_domains
         SET ssl_status = 'active',
             ssl_enabled = true,
             ssl_last_checked_at = NOW()
       WHERE id = $1`,
      [domainId]
    );
  }
}
