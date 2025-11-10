/**
 * PaaS Plan Service
 * Centralizes plan defaults, pricing calculations, and helpers for admin/user APIs
 */

import { pool } from '../../lib/database.js';

interface PlanDefinition {
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  max_replicas: number;
  disk_gb: number;
  price_per_hour: number;
  features: Record<string, any>;
  metadata?: Record<string, any>;
}

const DEFAULT_PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    name: 'Hobby',
    slug: 'hobby',
    cpu_cores: 0.5,
    ram_mb: 512,
    max_replicas: 1,
    disk_gb: 10,
    price_per_hour: 0.0069,
    features: { custom_domain: false, auto_scaling: false, ssl: true },
  },
  {
    name: 'Standard',
    slug: 'standard',
    cpu_cores: 1,
    ram_mb: 1024,
    max_replicas: 3,
    disk_gb: 20,
    price_per_hour: 0.0347,
    features: { custom_domain: true, auto_scaling: true, ssl: true },
  },
  {
    name: 'Pro',
    slug: 'pro',
    cpu_cores: 2,
    ram_mb: 2048,
    max_replicas: 10,
    disk_gb: 50,
    price_per_hour: 0.0694,
    features: {
      custom_domain: true,
      auto_scaling: true,
      ssl: true,
      priority_support: true,
    },
  },
  {
    name: 'Business',
    slug: 'business',
    cpu_cores: 4,
    ram_mb: 4096,
    max_replicas: 20,
    disk_gb: 100,
    price_per_hour: 0.1389,
    features: {
      custom_domain: true,
      auto_scaling: true,
      ssl: true,
      priority_support: true,
      dedicated_resources: true,
    },
  },
];

export class PaasPlanService {
  /**
   * Ensure default plans exist in the database (idempotent)
   */
  static async ensureDefaultPlans(): Promise<void> {
    for (const definition of DEFAULT_PLAN_DEFINITIONS) {
      const pricing = this.calculatePricing(definition.price_per_hour);
      await pool.query(
        `INSERT INTO paas_plans
          (name, slug, cpu_cores, ram_mb, max_replicas, disk_gb, price_per_hour, price_per_month, hourly_rate, features, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (slug) DO NOTHING`,
        [
          definition.name,
          definition.slug,
          definition.cpu_cores,
          definition.ram_mb,
          definition.max_replicas,
          definition.disk_gb,
          pricing.price_per_hour,
          pricing.price_per_month,
          pricing.hourly_rate,
          definition.features,
          definition.metadata || {},
        ]
      );
    }
  }

  /**
   * Fetch plans for admin usage (includes usage counts)
   */
  static async getAdminPlans(): Promise<any[]> {
    const result = await pool.query(
      `SELECT p.*, COALESCE(COUNT(a.id), 0)::int AS application_count
       FROM paas_plans p
       LEFT JOIN paas_applications a ON a.plan_id = p.id
       GROUP BY p.id
       ORDER BY p.price_per_hour ASC`
    );

    return result.rows.map((row) =>
      this.formatPlanRow({
        ...row,
        application_count: Number(row.application_count ?? 0),
      })
    );
  }

  /**
   * Fetch plans for user-facing APIs
   */
  static async getActivePlans(): Promise<any[]> {
    const result = await pool.query('SELECT * FROM paas_plans WHERE is_active = true ORDER BY price_per_hour ASC');
    return result.rows.map((row) => this.formatPlanRow(row));
  }

  /**
   * Calculate pricing figures based on hourly rate
   */
  static calculatePricing(pricePerHour: number): {
    price_per_hour: number;
    price_per_month: number;
    hourly_rate: number;
  } {
    const hourly = Number(pricePerHour.toFixed(4));
    const monthly = Number((hourly * 730).toFixed(2));
    return {
      price_per_hour: hourly,
      price_per_month: monthly,
      hourly_rate: hourly,
    };
  }

  /**
   * Ensure plan rows always contain derived values
   */
  static formatPlanRow(row: any): any {
    const resolvedRow = { ...row };

    // Convert all numeric fields from PostgreSQL DECIMAL strings to numbers
    if (resolvedRow.price_per_hour !== undefined && resolvedRow.price_per_hour !== null) {
      resolvedRow.price_per_hour = Number(resolvedRow.price_per_hour);
    }
    if (resolvedRow.price_per_month !== undefined && resolvedRow.price_per_month !== null) {
      resolvedRow.price_per_month = Number(resolvedRow.price_per_month);
    }
    if (resolvedRow.hourly_rate !== undefined && resolvedRow.hourly_rate !== null) {
      resolvedRow.hourly_rate = Number(resolvedRow.hourly_rate);
    }
    if (resolvedRow.cpu_cores !== undefined && resolvedRow.cpu_cores !== null) {
      resolvedRow.cpu_cores = Number(resolvedRow.cpu_cores);
    }

    // Set default values for derived fields
    if (!resolvedRow.hourly_rate) {
      resolvedRow.hourly_rate = resolvedRow.price_per_hour;
    }
    if (!resolvedRow.price_per_month && resolvedRow.price_per_hour !== undefined) {
      const pricing = this.calculatePricing(resolvedRow.price_per_hour);
      resolvedRow.price_per_month = pricing.price_per_month;
      resolvedRow.hourly_rate = pricing.hourly_rate;
    }
    if (Object.prototype.hasOwnProperty.call(resolvedRow, 'application_count')) {
      resolvedRow.application_count = Number(resolvedRow.application_count ?? 0);
    }
    return resolvedRow;
  }
}
