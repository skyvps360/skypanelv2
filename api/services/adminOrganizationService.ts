/**
 * Admin Organization Service for SkyPanelV2
 * Handles comprehensive organization and member management for administrators
 */

import { query, transaction } from '../lib/database.js';
import { 
  ContainerServiceError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';

// ============================================================
// Type Definitions
// ============================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDetail extends Organization {
  memberCount: number;
  subscriptionStatus?: string;
  subscriptionPlanId?: string;
  walletBalance?: number;
  resourceUsage: {
    cpuCores: number;
    memoryGb: number;
    storageGb: number;
    containerCount: number;
  };
  billingInfo?: {
    totalSpent: number;
    lastPayment?: {
      amount: number;
      date: string;
    };
  };
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
}

export interface MemberConfig {
  email: string;
  role: string;
}

export interface OrganizationFilters {
  status?: string;
  search?: string;
  hasSubscription?: boolean;
}

export interface BulkOrganizationUpdate {
  organizationId: string;
  updates: {
    status?: string;
    name?: string;
  };
}

export interface BulkResult {
  successful: number;
  failed: number;
  errors: Array<{ organizationId: string; error: string }>;
}

// ============================================================
// Admin Organization Service Class
// ============================================================

class AdminOrganizationService {
  /**
   * List organizations with optional filtering
   */
  async listOrganizations(filters?: OrganizationFilters): Promise<Organization[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.status) {
        whereClause += ` AND o.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters?.search) {
        whereClause += ` AND (o.name ILIKE $${paramIndex} OR o.slug ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters?.hasSubscription !== undefined) {
        if (filters.hasSubscription) {
          whereClause += ` AND EXISTS (SELECT 1 FROM container_subscriptions WHERE organization_id = o.id AND status = 'active')`;
        } else {
          whereClause += ` AND NOT EXISTS (SELECT 1 FROM container_subscriptions WHERE organization_id = o.id AND status = 'active')`;
        }
      }

      const result = await query(
        `SELECT id, name, slug, status, created_at, updated_at
         FROM organizations o
         ${whereClause}
         ORDER BY created_at DESC`,
        params
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing organizations:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to list organizations',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get detailed organization information
   */
  async getOrganization(organizationId: string): Promise<OrganizationDetail | null> {
    try {
      // Get organization basic info
      const orgResult = await query(
        'SELECT id, name, slug, status, created_at, updated_at FROM organizations WHERE id = $1',
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        return null;
      }

      const org = orgResult.rows[0];

      // Get member count
      const memberResult = await query(
        'SELECT COUNT(*) as count FROM user_organizations WHERE organization_id = $1',
        [organizationId]
      );
      const memberCount = parseInt(memberResult.rows[0].count) || 0;

      // Get subscription info
      const subResult = await query(
        `SELECT status, container_plan_id 
         FROM container_subscriptions 
         WHERE organization_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [organizationId]
      );
      const subscription = subResult.rows[0];

      // Get wallet balance
      const walletResult = await query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [organizationId]
      );
      const walletBalance = walletResult.rows[0]?.balance || 0;

      // Get resource usage
      const usageResult = await query(
        `SELECT 
          COALESCE(SUM(cs.cpu_limit), 0) as total_cpu,
          COALESCE(SUM(cs.memory_limit_gb), 0) as total_memory,
          COALESCE(SUM(cs.storage_limit_gb), 0) as total_storage,
          COUNT(cs.id) as total_containers
         FROM container_services cs
         INNER JOIN container_projects cp ON cs.project_id = cp.id
         WHERE cp.organization_id = $1
           AND cs.status != 'deleted'`,
        [organizationId]
      );

      const usage = usageResult.rows[0];

      // Get billing info
      const billingResult = await query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total_spent,
          MAX(created_at) as last_payment_date
         FROM invoices
         WHERE organization_id = $1 AND status = 'paid'`,
        [organizationId]
      );
      const billing = billingResult.rows[0];

      const lastPaymentResult = await query(
        `SELECT amount, created_at
         FROM invoices
         WHERE organization_id = $1 AND status = 'paid'
         ORDER BY created_at DESC
         LIMIT 1`,
        [organizationId]
      );
      const lastPayment = lastPaymentResult.rows[0];

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
        memberCount,
        subscriptionStatus: subscription?.status,
        subscriptionPlanId: subscription?.container_plan_id,
        walletBalance: parseFloat(walletBalance) || 0,
        resourceUsage: {
          cpuCores: parseFloat(usage.total_cpu) || 0,
          memoryGb: parseFloat(usage.total_memory) || 0,
          storageGb: parseFloat(usage.total_storage) || 0,
          containerCount: parseInt(usage.total_containers) || 0
        },
        billingInfo: {
          totalSpent: parseFloat(billing.total_spent) || 0,
          lastPayment: lastPayment ? {
            amount: parseFloat(lastPayment.amount),
            date: lastPayment.created_at
          } : undefined
        }
      };
    } catch (error) {
      console.error('Error getting organization:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to get organization details',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update organization details
   */
  async updateOrganization(organizationId: string, updates: { name?: string; status?: string }): Promise<Organization> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.name) {
        updateFields.push(`name = $${paramIndex}`);
        params.push(updates.name);
        paramIndex++;
      }

      if (updates.status) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(updates.status);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new Error('No updates provided');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(organizationId);

      const result = await query(
        `UPDATE organizations 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, slug, status, created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Organization not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error updating organization:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to update organization',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List members of an organization
   */
  async listMembers(organizationId: string): Promise<Member[]> {
    try {
      const result = await query(
        `SELECT u.id, u.email, u.name, uo.role, uo.created_at
         FROM users u
         INNER JOIN user_organizations uo ON u.id = uo.user_id
         WHERE uo.organization_id = $1
         ORDER BY uo.created_at ASC`,
        [organizationId]
      );

      return result.rows.map(row => ({
        userId: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        joinedAt: row.created_at
      }));
    } catch (error) {
      console.error('Error listing members:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to list organization members',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Add member to organization
   */
  async addMember(organizationId: string, memberConfig: MemberConfig): Promise<Member> {
    try {
      return await transaction(async (client) => {
        // Check if user exists
        const userResult = await client.query(
          'SELECT id, email, name FROM users WHERE email = $1',
          [memberConfig.email]
        );

        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Check if already a member
        const existingResult = await client.query(
          'SELECT id FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
          [user.id, organizationId]
        );

        if (existingResult.rows.length > 0) {
          throw new Error('User is already a member of this organization');
        }

        // Add to organization
        const result = await client.query(
          `INSERT INTO user_organizations (user_id, organization_id, role, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING created_at`,
          [user.id, organizationId, memberConfig.role]
        );

        return {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: memberConfig.role,
          joinedAt: result.rows[0].created_at
        };
      });
    } catch (error) {
      console.error('Error adding member:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to add member to organization',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(organizationId: string, userId: string, role: string): Promise<void> {
    try {
      const result = await query(
        `UPDATE user_organizations 
         SET role = $1
         WHERE organization_id = $2 AND user_id = $3`,
        [role, organizationId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Member not found in organization');
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to update member role',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        'DELETE FROM user_organizations WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Member not found in organization');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      throw new ContainerServiceError(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to remove member from organization',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Bulk update organizations
   */
  async bulkUpdateOrganizations(updates: BulkOrganizationUpdate[]): Promise<BulkResult> {
    const result: BulkResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const update of updates) {
      try {
        await this.updateOrganization(update.organizationId, update.updates);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          organizationId: update.organizationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }
}

// Export singleton instance
export const adminOrganizationService = new AdminOrganizationService();
