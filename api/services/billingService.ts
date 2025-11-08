/**
 * Billing Service for SkyPanelV2
 * Handles automated VPS and PaaS billing, hourly charges, and billing cycle management
 */

import { query, transaction } from '../lib/database.js';
import { PayPalService } from './paypalService.js';

export interface VPSBillingInfo {
  id: string;
  organizationId: string;
  label: string;
  status: string;
  hourlyRate: number;
  lastBilledAt: Date | null;
  createdAt: Date;
}

export interface BillingCycle {
  id: string;
  vpsInstanceId: string;
  organizationId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  hourlyRate: number;
  totalAmount: number;
  status: 'pending' | 'billed' | 'failed' | 'refunded';
  paymentTransactionId?: string;
}

export interface BillingResult {
  success: boolean;
  billedInstances: number;
  totalAmount: number;
  totalHours: number;
  failedInstances: string[];
  errors: string[];
}

export interface PaaSBillingInfo {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  hourlyRate: number;
  lastBilledAt: Date | null;
  createdAt: Date;
}

export interface PaaSBillingResult {
  success: boolean;
  billedApps: number;
  totalAmount: number;
  totalHours: number;
  failedApps: string[];
  errors: string[];
}

const MS_PER_HOUR = 60 * 60 * 1000;

export class BillingService {
  /**
   * Ensure the vps_instances.last_billed_at column exists.
   * Creates it if missing to avoid errors during billing.
   */
  private static async ensureLastBilledColumnExists(): Promise<boolean> {
    try {
      const check = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'vps_instances' AND column_name = 'last_billed_at'
         ) AS exists`
      );
      const exists = Boolean(check.rows[0]?.exists);
      if (!exists) {
        await query(`ALTER TABLE vps_instances ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMP WITH TIME ZONE`);
        await query(`CREATE INDEX IF NOT EXISTS idx_vps_instances_last_billed_at ON vps_instances(last_billed_at)`);
        console.log('✅ Added missing column vps_instances.last_billed_at');
      }
      return true;
    } catch (err) {
      console.warn('⚠️ Could not verify or create last_billed_at column:', err);
      return false;
    }
  }

  /**
   * Ensure the PaaS tables have the last_billed_at column used by hourly billing.
   */
  private static async ensurePaaSLastBilledColumns(): Promise<boolean> {
    const tables = [
      { table: 'paas_apps', index: 'idx_paas_apps_last_billed_at' },
      { table: 'paas_addon_subscriptions', index: 'idx_paas_addon_subscriptions_last_billed_at' }
    ];

    try {
      for (const { table, index } of tables) {
        const check = await query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_name = $1 AND column_name = 'last_billed_at'
           ) AS exists`,
          [table]
        );
        const exists = Boolean(check.rows[0]?.exists);
        if (!exists) {
          await query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMP WITH TIME ZONE`);
          console.log(`✅ Added missing column ${table}.last_billed_at`);
        }
        await query(`CREATE INDEX IF NOT EXISTS ${index} ON ${table}(last_billed_at)`);
      }
      return true;
    } catch (err) {
      console.warn('⚠️ Could not verify or create PaaS last_billed_at columns:', err);
      return false;
    }
  }
  /**
   * Run hourly billing for all active VPS instances
   */
  static async runHourlyBilling(): Promise<BillingResult> {
    console.log('🔄 Starting hourly VPS billing process...');
    
    const result: BillingResult = {
      success: true,
      billedInstances: 0,
      totalAmount: 0,
      totalHours: 0,
      failedInstances: [],
      errors: []
    };

    try {
      // Ensure schema prerequisites
      const hasColumn = await this.ensureLastBilledColumnExists();
      if (!hasColumn) {
        console.warn('Skipping hourly billing because last_billed_at column is missing.');
        return result;
      }
      // Get all active VPS instances that need billing
      const activeInstances = await this.getActiveVPSInstances();
      console.log(`📊 Found ${activeInstances.length} active VPS instances to process`);

      for (const instance of activeInstances) {
        try {
          const billingOutcome = await this.billVPSInstance(instance);
          if (!billingOutcome.success) {
            result.failedInstances.push(instance.id);
            result.errors.push(`Failed to bill VPS ${instance.label} (${instance.id})`);
            console.error(`❌ Failed to bill VPS ${instance.label} (${instance.id})`);
            continue;
          }

          if (billingOutcome.hoursCharged === 0) {
            console.log(`⏭️ No billable hours yet for VPS ${instance.label} (${instance.id}); skipping.`);
            continue;
          }

          result.billedInstances++;
          result.totalAmount += billingOutcome.amountCharged;
          result.totalHours += billingOutcome.hoursCharged;
          console.log(
            `✅ Successfully billed VPS ${instance.label} (${instance.id}) - ${billingOutcome.hoursCharged}h @ $${instance.hourlyRate.toFixed(4)}/h (charged $${billingOutcome.amountCharged.toFixed(4)})`
          );
        } catch (error) {
          result.failedInstances.push(instance.id);
          result.errors.push(`Error billing VPS ${instance.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`❌ Error billing VPS ${instance.label}:`, error);
        }
      }

      if (result.failedInstances.length > 0) {
        result.success = false;
      }

      console.log(
        `🏁 Billing completed: ${result.billedInstances} billed, ${result.failedInstances.length} failed, ${result.totalHours}h charged, $${result.totalAmount.toFixed(2)} total`
      );
      return result;

    } catch (error) {
      console.error('💥 Critical error in hourly billing process:', error);
      result.success = false;
      result.errors.push(`Critical billing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get all active VPS instances that need billing
   */
  private static async getActiveVPSInstances(): Promise<VPSBillingInfo[]> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await query(`
      SELECT 
        vi.id,
        vi.organization_id,
        vi.label,
        vi.status,
        vi.last_billed_at,
        vi.created_at,
        vi.backup_frequency,
        COALESCE(
          -- Calculate total hourly rate including backup costs
          (SELECT 
            -- Base VPS hourly rate
            ((vp.base_price + vp.markup_price) / 730) +
            -- Backup hourly rate (if backups enabled)
            CASE 
              WHEN vi.backup_frequency = 'daily' THEN 
                ((vp.backup_price_hourly + vp.backup_upcharge_hourly) * 1.5)
              WHEN vi.backup_frequency = 'weekly' THEN 
                (vp.backup_price_hourly + vp.backup_upcharge_hourly)
              ELSE 0
            END
           FROM vps_plans vp
           WHERE vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id
           LIMIT 1),
          -- Fallback to a default rate if plan not found
          0.027
        ) as hourly_rate
      FROM vps_instances vi
      WHERE (
          vi.last_billed_at IS NULL 
          OR vi.last_billed_at <= $1
        )
      ORDER BY vi.created_at ASC
    `, [oneHourAgo]);

    return result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      label: row.label,
      status: row.status,
      hourlyRate: parseFloat(row.hourly_rate),
      lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : null,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Bill a specific VPS instance for any fully elapsed hours since the last charge.
   */
  private static async billVPSInstance(
    instance: VPSBillingInfo
  ): Promise<{ success: boolean; amountCharged: number; hoursCharged: number }> {
    try {
      return await transaction(async (client) => {
        const now = new Date();
        const billingPeriodStart = instance.lastBilledAt ?? instance.createdAt;
        const elapsedMs = Math.max(0, now.getTime() - billingPeriodStart.getTime());
        const rawHoursElapsed = elapsedMs / MS_PER_HOUR;
        const hoursToCharge = Math.floor(rawHoursElapsed);

        if (hoursToCharge < 1) {
          return { success: true, amountCharged: 0, hoursCharged: 0 };
        }

        const billingPeriodEnd = new Date(billingPeriodStart.getTime() + hoursToCharge * MS_PER_HOUR);
        
        // Fetch detailed pricing breakdown from plan
        const planResult = await client.query(`
          SELECT 
            vp.base_price,
            vp.markup_price,
            vp.backup_price_monthly,
            vp.backup_price_hourly,
            vp.backup_upcharge_monthly,
            vp.backup_upcharge_hourly,
            vi.backup_frequency
          FROM vps_plans vp
          JOIN vps_instances vi ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
          WHERE vi.id = $1
          LIMIT 1
        `, [instance.id]);

        const plan = planResult.rows[0];
        const baseHourlyRate = plan ? ((parseFloat(plan.base_price) + parseFloat(plan.markup_price)) / 730) : instance.hourlyRate;
        
  let backupHourlyRate = 0;
  const backupFrequency = plan?.backup_frequency || 'none';
        
        if (plan && backupFrequency !== 'none') {
          const baseBackupHourly = parseFloat(plan.backup_price_hourly || 0);
          const backupUpchargeHourly = parseFloat(plan.backup_upcharge_hourly || 0);
          
          if (backupFrequency === 'daily') {
            backupHourlyRate = (baseBackupHourly + backupUpchargeHourly) * 1.5;
          } else if (backupFrequency === 'weekly') {
            backupHourlyRate = baseBackupHourly + backupUpchargeHourly;
          }
        }
        
        const totalAmount = Number(((baseHourlyRate + backupHourlyRate) * hoursToCharge).toFixed(4));

        const walletResult = await client.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [instance.organizationId]
        );

        if (walletResult.rows.length === 0) {
          console.error(`No wallet found for organization ${instance.organizationId}`);
          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);
        if (currentBalance < totalAmount) {
          console.warn(
            `Insufficient balance for VPS ${instance.label}: required $${totalAmount.toFixed(4)}, available $${currentBalance.toFixed(2)}`
          );

          await client.query(`
            INSERT INTO vps_billing_cycles (
              vps_instance_id, organization_id, billing_period_start, billing_period_end,
              hourly_rate, total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            instance.id,
            instance.organizationId,
            billingPeriodStart,
            billingPeriodEnd,
            instance.hourlyRate,
            totalAmount,
            'failed',
            JSON.stringify({ 
              reason: 'insufficient_balance', 
              hours_charged: hoursToCharge, 
              elapsed_hours: rawHoursElapsed,
              base_hourly_rate: baseHourlyRate,
              backup_hourly_rate: backupHourlyRate,
              backup_frequency: backupFrequency
            })
          ]);

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          instance.organizationId,
          totalAmount,
          `VPS Hourly Billing - ${instance.label} (${hoursToCharge}h)`
        );

        if (!deductionSuccess) {
          console.error(`Failed to deduct funds for VPS ${instance.label}`);

          await client.query(`
            INSERT INTO vps_billing_cycles (
              vps_instance_id, organization_id, billing_period_start, billing_period_end,
              hourly_rate, total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            instance.id,
            instance.organizationId,
            billingPeriodStart,
            billingPeriodEnd,
            instance.hourlyRate,
            totalAmount,
            'failed',
            JSON.stringify({ 
              reason: 'wallet_deduction_failed', 
              hours_charged: hoursToCharge, 
              elapsed_hours: rawHoursElapsed,
              base_hourly_rate: baseHourlyRate,
              backup_hourly_rate: backupHourlyRate,
              backup_frequency: backupFrequency
            })
          ]);

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        const transactionResult = await client.query(`
          SELECT id FROM payment_transactions 
          WHERE organization_id = $1 
            AND description LIKE $2
            AND status = 'completed'
          ORDER BY created_at DESC 
          LIMIT 1
        `, [instance.organizationId, `%${instance.label}%`]);

        const paymentTransactionId = transactionResult.rows[0]?.id;

        await client.query(`
          INSERT INTO vps_billing_cycles (
            vps_instance_id, organization_id, billing_period_start, billing_period_end,
            hourly_rate, total_amount, status, payment_transaction_id, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          instance.id,
          instance.organizationId,
          billingPeriodStart,
          billingPeriodEnd,
          instance.hourlyRate,
          totalAmount,
          'billed',
          paymentTransactionId,
          JSON.stringify({ 
            hours_charged: hoursToCharge, 
            elapsed_hours: rawHoursElapsed,
            base_hourly_rate: baseHourlyRate,
            backup_hourly_rate: backupHourlyRate,
            backup_frequency: backupFrequency,
            vps_label: instance.label
          })
        ]);

        await client.query(
          'UPDATE vps_instances SET last_billed_at = $1 WHERE id = $2',
          [billingPeriodEnd, instance.id]
        );

        return { success: true, amountCharged: totalAmount, hoursCharged: hoursToCharge };
      });
    } catch (error) {
      console.error(`Error billing VPS instance ${instance.id}:`, error);
      return { success: false, amountCharged: 0, hoursCharged: 0 };
    }
  }

  /**
   * Get billing history for an organization
   */
  static async getBillingHistory(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BillingCycle[]> {
    try {
      const result = await query(`
        SELECT 
          bc.id,
          bc.vps_instance_id,
          bc.organization_id,
          bc.billing_period_start,
          bc.billing_period_end,
          bc.hourly_rate,
          bc.total_amount,
          bc.status,
          bc.payment_transaction_id
        FROM vps_billing_cycles bc
        WHERE bc.organization_id = $1
        ORDER BY bc.created_at DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        vpsInstanceId: row.vps_instance_id,
        organizationId: row.organization_id,
        billingPeriodStart: new Date(row.billing_period_start),
        billingPeriodEnd: new Date(row.billing_period_end),
        hourlyRate: parseFloat(row.hourly_rate),
        totalAmount: parseFloat(row.total_amount),
        status: row.status,
        paymentTransactionId: row.payment_transaction_id ?? undefined
      }));
    } catch (error) {
      console.error('Error getting billing history:', error);
      return [];
    }
  }

  /**
   * Get billing summary for an organization
   */
  static async getBillingSummary(organizationId: string): Promise<{
    totalSpentThisMonth: number;
    totalSpentAllTime: number;
    activeVPSCount: number;
    monthlyEstimate: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get total spent this month
      const monthlyResult = await query(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM vps_billing_cycles
        WHERE organization_id = $1 
          AND status = 'billed'
          AND created_at >= $2
      `, [organizationId, startOfMonth]);

      // Get total spent all time
      const allTimeResult = await query(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM vps_billing_cycles
        WHERE organization_id = $1 AND status = 'billed'
      `, [organizationId]);

      // Get active VPS count and monthly estimate
      // Note: All VPS instances are billed hourly regardless of status (running, stopped, etc.)
      // Only deleted instances (removed from table) stop billing
      const activeVPSResult = await query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(
            (vp.base_price + vp.markup_price) +
            CASE 
              WHEN vi.backup_frequency = 'daily' THEN 
                ((vp.backup_price_monthly + vp.backup_upcharge_monthly) * 1.5)
              WHEN vi.backup_frequency = 'weekly' THEN 
                (vp.backup_price_monthly + vp.backup_upcharge_monthly)
              ELSE 0
            END
          ), 0) as monthly_estimate
        FROM vps_instances vi
        LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
        WHERE vi.organization_id = $1
      `, [organizationId]);

      return {
        totalSpentThisMonth: parseFloat(monthlyResult.rows[0].total),
        totalSpentAllTime: parseFloat(allTimeResult.rows[0].total),
        activeVPSCount: parseInt(activeVPSResult.rows[0].count),
        monthlyEstimate: parseFloat(activeVPSResult.rows[0].monthly_estimate || '0')
      };
    } catch (error) {
      console.error('Error getting billing summary:', error);
      return {
        totalSpentThisMonth: 0,
        totalSpentAllTime: 0,
        activeVPSCount: 0,
        monthlyEstimate: 0
      };
    }
  }

  /**
   * Handle VPS creation billing (initial charge)
   */
  static async billVPSCreation(
    vpsInstanceId: string,
    organizationId: string,
    hourlyRate: number,
    label: string
  ): Promise<boolean> {
    try {
      console.log(`💳 Processing initial billing for VPS ${label} - $${hourlyRate.toFixed(4)}/hour`);

      const success = await PayPalService.deductFundsFromWallet(
        organizationId,
        hourlyRate,
        `VPS Creation - ${label} (Initial Hour)`
      );

      if (success) {
        // Update last_billed_at to current time, if column exists
        try {
          await this.ensureLastBilledColumnExists();
          await query('UPDATE vps_instances SET last_billed_at = NOW() WHERE id = $1', [vpsInstanceId]);
        } catch (updateErr) {
          // Do not fail initial billing if timestamp update fails
          console.warn(`Initial billing succeeded but timestamp update failed for VPS ${label}:`, updateErr);
        }

        console.log(`✅ Successfully charged initial hour for VPS ${label}`);
        return true;
      } else {
        console.error(`❌ Failed to charge initial hour for VPS ${label}`);
        return false;
      }
    } catch (error) {
      console.error(`Error billing VPS creation for ${label}:`, error);
      return false;
    }
  }

  /**
   * Stop billing for a VPS instance (when deleted)
   * Note: Stopping/powering off a VPS does NOT stop billing - you are charged for reserved resources
   * Billing only stops when the VPS is permanently deleted
   */
  static async stopVPSBilling(vpsInstanceId: string): Promise<void> {
    try {
      // Update the VPS instance to mark it as no longer billable
      try {
        await this.ensureLastBilledColumnExists();
        await query('UPDATE vps_instances SET last_billed_at = NOW() WHERE id = $1', [vpsInstanceId]);
      } catch (err) {
        console.warn('Failed to update last_billed_at when stopping billing:', err);
      }

      console.log(`🛑 Stopped billing for VPS instance ${vpsInstanceId}`);
    } catch (error) {
      console.error(`Error stopping billing for VPS ${vpsInstanceId}:`, error);
    }
  }

  // ============================================================
  // PaaS Billing Methods
  // ============================================================

  /**
   * Run hourly billing for all active PaaS applications
   */
  static async runPaaSHourlyBilling(): Promise<PaaSBillingResult> {
    console.log('🔄 Starting hourly PaaS billing process...');

    const result: PaaSBillingResult = {
      success: true,
      billedApps: 0,
      totalAmount: 0,
      totalHours: 0,
      failedApps: [],
      errors: []
    };

    try {
      const hasColumns = await this.ensurePaaSLastBilledColumns();
      if (!hasColumns) {
        console.warn('Skipping PaaS hourly billing because last_billed_at columns are missing.');
        return result;
      }

      // Get all active PaaS applications that need billing
      const activeApps = await this.getActivePaaSApps();
      console.log(`📊 Found ${activeApps.length} active PaaS applications to process`);

      for (const app of activeApps) {
        try {
          const billingOutcome = await this.billPaaSApp(app);
          if (!billingOutcome.success) {
            result.failedApps.push(app.id);
            result.errors.push(`Failed to bill PaaS app ${app.name} (${app.id})`);
            console.error(`❌ Failed to bill PaaS app ${app.name} (${app.id})`);
            continue;
          }

          if (billingOutcome.hoursCharged === 0) {
            console.log(`⏭️ No billable hours yet for PaaS app ${app.name} (${app.id}); skipping.`);
            continue;
          }

          result.billedApps++;
          result.totalAmount += billingOutcome.amountCharged;
          result.totalHours += billingOutcome.hoursCharged;
          console.log(
            `✅ Successfully billed PaaS app ${app.name} (${app.id}) - ${billingOutcome.hoursCharged}h @ $${app.hourlyRate.toFixed(4)}/h (charged $${billingOutcome.amountCharged.toFixed(4)})`
          );
        } catch (error) {
          result.failedApps.push(app.id);
          result.errors.push(`Error billing PaaS app ${app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`❌ Error billing PaaS app ${app.name}:`, error);
        }
      }

      // Also bill active add-on subscriptions
      const addOnResult = await this.runPaaSAddOnBilling();
      result.totalAmount += addOnResult.totalAmount;
      result.errors.push(...addOnResult.errors);

      if (result.failedApps.length > 0 || addOnResult.errors.length > 0) {
        result.success = false;
      }

      console.log(
        `🏁 PaaS billing completed: ${result.billedApps} apps billed, ${addOnResult.billedSubscriptions} add-ons billed, ${result.failedApps.length} apps failed, ${result.totalHours}h charged, $${result.totalAmount.toFixed(2)} total`
      );
      return result;

    } catch (error) {
      console.error('💥 Critical error in hourly PaaS billing process:', error);
      result.success = false;
      result.errors.push(`Critical PaaS billing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get all active PaaS applications that need billing
   */
  private static async getActivePaaSApps(): Promise<PaaSBillingInfo[]> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await query(`
      SELECT
        a.id,
        a.organization_id,
        a.name,
        a.status,
        a.last_billed_at,
        a.created_at,
        COALESCE(
          (SELECT price_hourly FROM paas_plans WHERE id = a.plan_id),
          0.008
        ) as hourly_rate
      FROM paas_apps a
      WHERE a.status IN ('deployed', 'building', 'error')
        AND (
          a.last_billed_at IS NULL
          OR a.last_billed_at <= $1
        )
      ORDER BY a.created_at ASC
    `, [oneHourAgo]);

    return result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      status: row.status,
      hourlyRate: parseFloat(row.hourly_rate),
      lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : null,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Bill a specific PaaS application for any fully elapsed hours since the last charge
   */
  private static async billPaaSApp(
    app: PaaSBillingInfo
  ): Promise<{ success: boolean; amountCharged: number; hoursCharged: number }> {
    try {
      return await transaction(async (client) => {
        const now = new Date();
        const billingPeriodStart = app.lastBilledAt ?? app.createdAt;
        const elapsedMs = Math.max(0, now.getTime() - billingPeriodStart.getTime());
        const rawHoursElapsed = elapsedMs / MS_PER_HOUR;
        const hoursToCharge = Math.floor(rawHoursElapsed);

        if (hoursToCharge < 1) {
          return { success: true, amountCharged: 0, hoursCharged: 0 };
        }

        const billingPeriodEnd = new Date(billingPeriodStart.getTime() + hoursToCharge * MS_PER_HOUR);
        const totalAmount = Number((app.hourlyRate * hoursToCharge).toFixed(4));

        // Check wallet balance
        const walletResult = await client.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [app.organizationId]
        );

        if (walletResult.rows.length === 0) {
          console.error(`No wallet found for organization ${app.organizationId}`);
          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);
        if (currentBalance < totalAmount) {
          console.warn(
            `Insufficient balance for PaaS app ${app.name}: required $${totalAmount.toFixed(4)}, available $${currentBalance.toFixed(2)}`
          );

          await client.query(`
            INSERT INTO paas_billing_cycles (
              app_id, organization_id, billing_period_start, billing_period_end,
              plan_hourly_rate, total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            app.id,
            app.organizationId,
            billingPeriodStart,
            billingPeriodEnd,
            app.hourlyRate,
            totalAmount,
            'failed',
            JSON.stringify({
              reason: 'insufficient_balance',
              hours_charged: hoursToCharge,
              elapsed_hours: rawHoursElapsed
            })
          ]);

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Deduct funds from wallet
        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          app.organizationId,
          totalAmount,
          `PaaS Hourly Billing - ${app.name} (${hoursToCharge}h)`
        );

        if (!deductionSuccess) {
          console.error(`Failed to deduct funds for PaaS app ${app.name}`);

          await client.query(`
            INSERT INTO paas_billing_cycles (
              app_id, organization_id, billing_period_start, billing_period_end,
              plan_hourly_rate, total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            app.id,
            app.organizationId,
            billingPeriodStart,
            billingPeriodEnd,
            app.hourlyRate,
            totalAmount,
            'failed',
            JSON.stringify({
              reason: 'wallet_deduction_failed',
              hours_charged: hoursToCharge,
              elapsed_hours: rawHoursElapsed
            })
          ]);

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Get payment transaction ID
        const transactionResult = await client.query(`
          SELECT id FROM payment_transactions
          WHERE organization_id = $1
            AND description LIKE $2
            AND status = 'completed'
          ORDER BY created_at DESC
          LIMIT 1
        `, [app.organizationId, `%${app.name}%`]);

        const paymentTransactionId = transactionResult.rows[0]?.id;

        // Create billing cycle record
        await client.query(`
          INSERT INTO paas_billing_cycles (
            app_id, organization_id, billing_period_start, billing_period_end,
            plan_hourly_rate, total_amount, status, payment_transaction_id, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          app.id,
          app.organizationId,
          billingPeriodStart,
          billingPeriodEnd,
          app.hourlyRate,
          totalAmount,
          'billed',
          paymentTransactionId,
          JSON.stringify({
            hours_charged: hoursToCharge,
            elapsed_hours: rawHoursElapsed,
            app_name: app.name
          })
        ]);

        // Update app last billed timestamp
        await client.query(
          'UPDATE paas_apps SET last_billed_at = $1 WHERE id = $2',
          [billingPeriodEnd, app.id]
        );

        return { success: true, amountCharged: totalAmount, hoursCharged: hoursToCharge };
      });
    } catch (error) {
      console.error(`Error billing PaaS app ${app.id}:`, error);
      return { success: false, amountCharged: 0, hoursCharged: 0 };
    }
  }

  /**
   * Run hourly billing for PaaS add-on subscriptions
   */
  private static async runPaaSAddOnBilling(): Promise<{
    billedSubscriptions: number;
    totalAmount: number;
    errors: string[];
  }> {
    const result = {
      billedSubscriptions: 0,
      totalAmount: 0,
      errors: [] as string[]
    };

    try {
      const hasColumns = await this.ensurePaaSLastBilledColumns();
      if (!hasColumns) {
        result.errors.push('Missing required PaaS add-on billing columns');
        return result;
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const activeSubscriptions = await query(`
        SELECT
          s.id,
          s.organization_id,
          s.name,
          s.last_billed_at,
          s.created_at,
          a.name as addon_name,
          a.service_type,
          a.price_hourly
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans a ON s.addon_plan_id = a.id
        WHERE s.status = 'active'
          AND (
            s.last_billed_at IS NULL
            OR s.last_billed_at <= $1
          )
        ORDER BY s.created_at ASC
      `, [oneHourAgo]);

      for (const subscription of activeSubscriptions.rows) {
        try {
          const billingOutcome = await this.billPaaSAddOnSubscription(subscription);
          if (billingOutcome.success) {
            result.billedSubscriptions++;
            result.totalAmount += billingOutcome.amountCharged;
            console.log(`✅ Billed add-on ${subscription.name} (${subscription.service_type}): $${billingOutcome.amountCharged.toFixed(4)}`);
          } else {
            result.errors.push(`Failed to bill add-on ${subscription.name}`);
          }
        } catch (error) {
          result.errors.push(`Error billing add-on ${subscription.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error in PaaS add-on billing:', error);
      result.errors.push(`Critical add-on billing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Bill a specific PaaS add-on subscription
   */
  private static async billPaaSAddOnSubscription(subscription: any): Promise<{
    success: boolean;
    amountCharged: number;
    hoursCharged: number;
  }> {
    try {
      return await transaction(async (client) => {
        const now = new Date();
        const billingPeriodStart = subscription.last_billed_at ? new Date(subscription.last_billed_at) : new Date(subscription.created_at);
        const elapsedMs = Math.max(0, now.getTime() - billingPeriodStart.getTime());
        const rawHoursElapsed = elapsedMs / MS_PER_HOUR;
        const hoursToCharge = Math.floor(rawHoursElapsed);

        if (hoursToCharge < 1) {
          return { success: true, amountCharged: 0, hoursCharged: 0 };
        }

        const billingPeriodEnd = new Date(billingPeriodStart.getTime() + hoursToCharge * MS_PER_HOUR);
        const hourlyRate = parseFloat(subscription.price_hourly);
        const totalAmount = Number((hourlyRate * hoursToCharge).toFixed(4));

        // Check wallet balance
        const walletResult = await client.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [subscription.organization_id]
        );

        if (walletResult.rows.length === 0 || parseFloat(walletResult.rows[0].balance) < totalAmount) {
          console.warn(`Insufficient balance for add-on ${subscription.name}: $${totalAmount.toFixed(4)}`);
          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Deduct funds
        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          subscription.organization_id,
          totalAmount,
          `Add-on Hourly Billing - ${subscription.name} (${hoursToCharge}h)`
        );

        if (!deductionSuccess) {
          console.error(`Failed to deduct funds for add-on ${subscription.name}`);
          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Update last billed timestamp
        await client.query(
          'UPDATE paas_addon_subscriptions SET last_billed_at = $1 WHERE id = $2',
          [billingPeriodEnd, subscription.id]
        );

        return { success: true, amountCharged: totalAmount, hoursCharged: hoursToCharge };
      });
    } catch (error) {
      console.error(`Error billing add-on subscription ${subscription.id}:`, error);
      return { success: false, amountCharged: 0, hoursCharged: 0 };
    }
  }

  /**
   * Handle PaaS app creation billing (initial charge)
   */
  static async billPaaSCreation(
    appId: string,
    organizationId: string,
    hourlyRate: number,
    appName: string
  ): Promise<boolean> {
    try {
      console.log(`💳 Processing initial billing for PaaS app ${appName} - $${hourlyRate.toFixed(4)}/hour`);

      const success = await PayPalService.deductFundsFromWallet(
        organizationId,
        hourlyRate,
        `PaaS App Creation - ${appName} (Initial Hour)`
      );

      if (success) {
        await query('UPDATE paas_apps SET last_billed_at = NOW() WHERE id = $1', [appId]);
        console.log(`✅ Successfully charged initial hour for PaaS app ${appName}`);
        return true;
      } else {
        console.error(`❌ Failed to charge initial hour for PaaS app ${appName}`);
        return false;
      }
    } catch (error) {
      console.error(`Error billing PaaS app creation for ${appName}:`, error);
      return false;
    }
  }

  /**
   * Stop billing for a PaaS application (when deleted)
   */
  static async stopPaaSBilling(appId: string): Promise<void> {
    try {
      await query('UPDATE paas_apps SET last_billed_at = NOW() WHERE id = $1', [appId]);
      console.log(`🛑 Stopped billing for PaaS app ${appId}`);
    } catch (error) {
      console.error(`Error stopping billing for PaaS app ${appId}:`, error);
    }
  }

  /**
   * Get PaaS billing history for an organization
   */
  static async getPaaSBillingHistory(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const result = await query(`
        SELECT
          bc.id,
          bc.app_id,
          bc.organization_id,
          bc.billing_period_start,
          bc.billing_period_end,
          bc.plan_hourly_rate,
          bc.total_amount,
          bc.status,
          bc.payment_transaction_id,
          a.name as app_name,
          bc.addon_hours
        FROM paas_billing_cycles bc
        LEFT JOIN paas_apps a ON bc.app_id = a.id
        WHERE bc.organization_id = $1
        ORDER BY bc.created_at DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        appId: row.app_id,
        organizationId: row.organization_id,
        appName: row.app_name,
        billingPeriodStart: new Date(row.billing_period_start),
        billingPeriodEnd: new Date(row.billing_period_end),
        hourlyRate: parseFloat(row.plan_hourly_rate),
        totalAmount: parseFloat(row.total_amount),
        status: row.status,
        paymentTransactionId: row.payment_transaction_id ?? undefined,
        addonHours: row.addon_hours || {}
      }));
    } catch (error) {
      console.error('Error getting PaaS billing history:', error);
      return [];
    }
  }

  /**
   * Get comprehensive billing summary for an organization (VPS + PaaS)
   */
  static async getComprehensiveBillingSummary(organizationId: string): Promise<{
    totalSpentThisMonth: number;
    totalSpentAllTime: number;
    activeVPSCount: number;
    activePaaSAppsCount: number;
    activeAddOnsCount: number;
    monthlyEstimate: number;
    breakdown: {
      vps: number;
      paas: number;
      addons: number;
    };
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get VPS stats
      const vpsStats = await this.getBillingSummary(organizationId);

      // Get PaaS app billing this month
      const paasMonthlyResult = await query(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM paas_billing_cycles
        WHERE organization_id = $1
          AND status = 'billed'
          AND created_at >= $2
          AND app_id IS NOT NULL
      `, [organizationId, startOfMonth]);

      // Get add-on billing this month
      const addonMonthlyResult = await query(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM paas_billing_cycles
        WHERE organization_id = $1
          AND status = 'billed'
          AND created_at >= $2
          AND app_id IS NULL
      `, [organizationId, startOfMonth]);

      // Get active PaaS apps count
      const paasAppsResult = await query(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(p.price_hourly * 24 * 30), 0) as monthly_estimate
        FROM paas_apps a
        JOIN paas_plans p ON a.plan_id = p.id
        WHERE a.organization_id = $1 AND a.status IN ('deployed', 'building', 'error')
      `, [organizationId]);

      // Get active add-ons count
      const addonsResult = await query(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(a.price_hourly * 24 * 30), 0) as monthly_estimate
        FROM paas_addon_subscriptions s
        JOIN paas_addon_plans a ON s.addon_plan_id = a.id
        WHERE s.organization_id = $1 AND s.status = 'active'
      `, [organizationId]);

      const paasMonthlySpent = parseFloat(paasMonthlyResult.rows[0].total);
      const addonMonthlySpent = parseFloat(addonMonthlyResult.rows[0].total);

      return {
        totalSpentThisMonth: vpsStats.totalSpentThisMonth + paasMonthlySpent + addonMonthlySpent,
        totalSpentAllTime: vpsStats.totalSpentAllTime, // Would need to calculate PaaS all-time separately
        activeVPSCount: vpsStats.activeVPSCount,
        activePaaSAppsCount: parseInt(paasAppsResult.rows[0].count),
        activeAddOnsCount: parseInt(addonsResult.rows[0].count),
        monthlyEstimate: vpsStats.monthlyEstimate +
                        parseFloat(paasAppsResult.rows[0].monthly_estimate || '0') +
                        parseFloat(addonsResult.rows[0].monthly_estimate || '0'),
        breakdown: {
          vps: vpsStats.totalSpentThisMonth,
          paas: paasMonthlySpent,
          addons: addonMonthlySpent
        }
      };
    } catch (error) {
      console.error('Error getting comprehensive billing summary:', error);
      return {
        totalSpentThisMonth: 0,
        totalSpentAllTime: 0,
        activeVPSCount: 0,
        activePaaSAppsCount: 0,
        activeAddOnsCount: 0,
        monthlyEstimate: 0,
        breakdown: {
          vps: 0,
          paas: 0,
          addons: 0
        }
      };
    }
  }
}
