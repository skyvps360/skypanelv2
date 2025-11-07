/**
 * PaaS Application Service
 * Manages customer applications and deployments
 */

import { query } from '../../lib/database.js';

export interface PaaSApplication {
  id: number;
  user_id: string;
  organization_id: string;
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
  port: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateApplicationData {
  user_id: string;
  organization_id: string;
  name: string;
  slug: string;
  runtime_id?: number;
  plan_id: number;
  region: string;
  system_domain?: string;
}

export interface UpdateApplicationData {
  name?: string;
  runtime_id?: number;
  plan_id?: number;
  node_id?: number;
  git_repo_url?: string;
  git_branch?: string;
  git_oauth_token?: string;
  auto_deploy?: boolean;
  status?: string;
  current_build_id?: number;
  instance_count?: number;
  custom_domains?: string[];
}

export class ApplicationService {
  /**
   * Get all applications for a user
   */
  static async getApplicationsByUser(userId: string): Promise<PaaSApplication[]> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Get all applications for an organization
   */
  static async getApplicationsByOrganization(organizationId: string): Promise<PaaSApplication[]> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    return result.rows;
  }

  /**
   * Get a single application by ID
   */
  static async getApplicationById(id: number): Promise<PaaSApplication | null> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get application by slug
   */
  static async getApplicationBySlug(slug: string): Promise<PaaSApplication | null> {
    const result = await query(
      'SELECT * FROM paas_applications WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if user owns application
   */
  static async isApplicationOwner(applicationId: number, userId: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM paas_applications WHERE id = $1 AND user_id = $2',
      [applicationId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Create a new application
   */
  static async createApplication(data: CreateApplicationData): Promise<PaaSApplication> {
    const result = await query(
      `INSERT INTO paas_applications 
       (user_id, organization_id, name, slug, runtime_id, plan_id, region, system_domain, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        data.user_id,
        data.organization_id,
        data.name,
        data.slug,
        data.runtime_id || null,
        data.plan_id,
        data.region,
        data.system_domain || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an application
   */
  static async updateApplication(id: number, data: UpdateApplicationData): Promise<PaaSApplication | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.runtime_id !== undefined) {
      updates.push(`runtime_id = $${paramCount++}`);
      values.push(data.runtime_id);
    }
    if (data.plan_id !== undefined) {
      updates.push(`plan_id = $${paramCount++}`);
      values.push(data.plan_id);
    }
    if (data.node_id !== undefined) {
      updates.push(`node_id = $${paramCount++}`);
      values.push(data.node_id);
    }
    if (data.git_repo_url !== undefined) {
      updates.push(`git_repo_url = $${paramCount++}`);
      values.push(data.git_repo_url);
    }
    if (data.git_branch !== undefined) {
      updates.push(`git_branch = $${paramCount++}`);
      values.push(data.git_branch);
    }
    if (data.git_oauth_token !== undefined) {
      updates.push(`git_oauth_token = $${paramCount++}`);
      values.push(data.git_oauth_token);
    }
    if (data.auto_deploy !== undefined) {
      updates.push(`auto_deploy = $${paramCount++}`);
      values.push(data.auto_deploy);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.current_build_id !== undefined) {
      updates.push(`current_build_id = $${paramCount++}`);
      values.push(data.current_build_id);
    }
    if (data.instance_count !== undefined) {
      updates.push(`instance_count = $${paramCount++}`);
      values.push(data.instance_count);
    }
    if (data.custom_domains !== undefined) {
      updates.push(`custom_domains = $${paramCount++}`);
      values.push(JSON.stringify(data.custom_domains));
    }

    if (updates.length === 0) {
      return this.getApplicationById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_applications SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Delete an application
   */
  static async deleteApplication(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_applications WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Generate a unique slug from name
   */
  static async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.getApplicationBySlug(slug);
      if (!existing) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Get application with plan and runtime details
   */
  static async getApplicationWithDetails(id: number): Promise<any> {
    const result = await query(
      `SELECT 
        a.*,
        p.name as plan_name,
        p.cpu_limit,
        p.memory_limit,
        p.storage_limit,
        p.hourly_rate,
        r.name as runtime_name,
        r.runtime_type,
        r.version as runtime_version,
        n.name as node_name,
        n.region as node_region,
        n.status as node_status
       FROM paas_applications a
       LEFT JOIN paas_plans p ON a.plan_id = p.id
       LEFT JOIN paas_runtimes r ON a.runtime_id = r.id
       LEFT JOIN paas_nodes n ON a.node_id = n.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}
