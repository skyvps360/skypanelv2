/**
 * PaaS Scaler Service
 * Handles horizontal scaling of applications (replica management)
 */

import { pool, PaasApplication } from '../../lib/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ScaleOptions {
  applicationId: string;
  replicas: number;
}

export interface ScaleResult {
  success: boolean;
  currentReplicas?: number;
  previousReplicas?: number;
  hourlyCostBefore?: number;
  hourlyCostAfter?: number;
  walletBalance?: number;
  error?: string;
}

export class ScalerService {
  /**
   * Scale an application to the specified number of replicas
   */
  static async scale(options: ScaleOptions): Promise<ScaleResult> {
    try {
      // Get application
      const appResult = await pool.query<PaasApplication>(
        'SELECT * FROM paas_applications WHERE id = $1',
        [options.applicationId]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }

      const app = appResult.rows[0];

      // Get plan limits and pricing
      const planResult = await pool.query(
        'SELECT max_replicas, price_per_hour FROM paas_plans WHERE id = $1',
        [app.plan_id]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }

      const plan = planResult.rows[0];

      // Validate replica count
      if (options.replicas < 0) {
        throw new Error('Replica count must be >= 0');
      }

      if (options.replicas > plan.max_replicas) {
        throw new Error(`Plan limit: maximum ${plan.max_replicas} replicas`);
      }

      const pricePerHour = Number(plan.price_per_hour || 0);
      const currentHourlyCost = pricePerHour * app.replicas;
      const requestedHourlyCost = pricePerHour * options.replicas;

      // Ensure wallet can support requested replicas (only apply when scaling up)
      let walletBalance: number | undefined;

      if (options.replicas > app.replicas && pricePerHour > 0) {
        const walletResult = await pool.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [app.organization_id]
        );

        walletBalance = Number(walletResult.rows[0]?.balance ?? 0);
        if (walletBalance < requestedHourlyCost) {
          throw new Error(
            'Wallet balance is too low to support the requested replica count. Add funds before scaling up.'
          );
        }
      }

      // Scale the service
      const serviceName = `paas-${app.slug}`;

      await execAsync(`docker service scale ${serviceName}=${options.replicas}`);

      // Update database
      await pool.query(
        `UPDATE paas_applications SET
          replicas = $1,
          status = CASE
            WHEN $1 = 0 THEN 'stopped'
            ELSE 'running'
          END
        WHERE id = $2`,
        [options.replicas, options.applicationId]
      );

      return {
        success: true,
        currentReplicas: options.replicas,
        previousReplicas: app.replicas,
        hourlyCostBefore: Number(currentHourlyCost.toFixed(4)),
        hourlyCostAfter: Number(requestedHourlyCost.toFixed(4)),
        walletBalance,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current replica count for an application
   */
  static async getCurrentReplicas(applicationId: string): Promise<number> {
    const result = await pool.query<PaasApplication>(
      'SELECT replicas FROM paas_applications WHERE id = $1',
      [applicationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Application not found');
    }

    return result.rows[0].replicas;
  }

  /**
   * Auto-scale based on resource usage (future feature)
   */
  static async autoScale(applicationId: string): Promise<ScaleResult> {
    // TODO: Implement auto-scaling logic based on CPU/RAM metrics
    // This would query metrics from Docker/Prometheus and adjust replicas
    throw new Error('Auto-scaling not yet implemented');
  }

  /**
   * Get scaling recommendations based on usage patterns
   */
  static async getScalingRecommendations(applicationId: string): Promise<{
    currentReplicas: number;
    recommendedReplicas: number;
    reason: string;
  }> {
    // TODO: Analyze historical resource usage and provide recommendations
    const currentReplicas = await this.getCurrentReplicas(applicationId);

    return {
      currentReplicas,
      recommendedReplicas: currentReplicas,
      reason: 'Scaling recommendations not yet available',
    };
  }
}
