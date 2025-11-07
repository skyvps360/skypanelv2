import { query, transaction } from '../../lib/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

export interface PaaSApplication {
  id: number;
  user_id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  runtime_id: number | null;
  plan_id: number | null;
  node_id: number | null;
  region: string;
  git_repo_url: string | null;
  git_branch: string;
  git_oauth_token: string | null;
  auto_deploy: boolean;
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
  current_build_id: number | null;
  instance_count: number;
  system_domain: string | null;
  custom_domains: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateApplicationData {
  user_id: string;
  organization_id?: string;
  name: string;
  runtime_id: number;
  plan_id: number;
  region: string;
}

export class ApplicationService {
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async generateUniqueSlug(baseName: string): Promise<string> {
    let slug = this.generateSlug(baseName);
    let counter = 1;
    
    while (true) {
      const existing = await query(
        'SELECT id FROM paas_applications WHERE slug = $1',
        [slug]
      );
      
      if (existing.rows.length === 0) {
        return slug;
      }
      
      slug = `${this.generateSlug(baseName)}-${counter}`;
      counter++;
    }
  }

  async generateSystemDomain(slug: string, platformDomain: string): Promise<string> {
    return `${slug}.${platformDomain}`;
  }

  async getAll(userId?: string, organizationId?: string): Promise<PaaSApplication[]> {
    let sql = 'SELECT * FROM paas_applications';
    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(userId);
    }

    if (organizationId) {
      conditions.push(`organization_id = $${params.length + 1}`);
      params.push(organizationId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  async getById(id: number): Promise<PaaSApplication | null> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getBySlug(slug: string): Promise<PaaSApplication | null> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateApplicationData): Promise<PaaSApplication> {
    const slug = await this.generateUniqueSlug(data.name);
    const platformDomain = process.env.PAAS_PLATFORM_DOMAIN || 'paas.example.com';
    const systemDomain = await this.generateSystemDomain(slug, platformDomain);

    const result = await query(
      `INSERT INTO paas_applications 
       (user_id, organization_id, name, slug, runtime_id, plan_id, region, system_domain, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.user_id,
        data.organization_id || null,
        data.name,
        slug,
        data.runtime_id,
        data.plan_id,
        data.region,
        systemDomain,
        'pending'
      ]
    );

    return result.rows[0];
  }

  async update(id: number, data: Partial<PaaSApplication>): Promise<PaaSApplication | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'runtime_id', 'plan_id', 'node_id', 'git_repo_url', 'git_branch',
      'git_oauth_token', 'auto_deploy', 'status', 'current_build_id',
      'instance_count', 'custom_domains'
    ];

    for (const field of allowedFields) {
      if (data[field as keyof PaaSApplication] !== undefined) {
        fields.push(`${field} = $${paramCount++}`);
        
        if (field === 'custom_domains') {
          values.push(JSON.stringify(data[field]));
        } else if (field === 'git_oauth_token' && data[field]) {
          values.push(encrypt(data[field] as string));
        } else {
          values.push(data[field as keyof PaaSApplication]);
        }
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_applications SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async updateStatus(id: number, status: PaaSApplication['status']): Promise<void> {
    await query(
      'UPDATE paas_applications SET status = $1 WHERE id = $2',
      [status, id]
    );
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_applications WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getDecryptedOAuthToken(app: PaaSApplication): Promise<string | null> {
    if (!app.git_oauth_token) {
      return null;
    }
    try {
      return decrypt(app.git_oauth_token);
    } catch (error) {
      console.error('Failed to decrypt OAuth token:', error);
      return null;
    }
  }

  async scale(id: number, instanceCount: number): Promise<PaaSApplication | null> {
    if (instanceCount < 1 || instanceCount > 10) {
      throw new Error('Instance count must be between 1 and 10');
    }

    const result = await query(
      'UPDATE paas_applications SET instance_count = $1 WHERE id = $2 RETURNING *',
      [instanceCount, id]
    );

    return result.rows[0] || null;
  }

  async getByNodeId(nodeId: number): Promise<PaaSApplication[]> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE node_id = $1',
      [nodeId]
    );
    return result.rows;
  }

  async countByUser(userId: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM paas_applications WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const applicationService = new ApplicationService();
