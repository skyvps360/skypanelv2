import { pool, transaction } from '../../lib/database.js';
import { PayPalService } from '../paypalService.js';
import { DeployerService } from './deployerService.js';
import { logActivity } from '../activityLogger.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_LOW_BALANCE_THRESHOLD = 1; // USD

interface BillableApplication {
  id: string;
  name: string;
  organizationId: string;
  ownerId: string | null;
  replicas: number;
  hourlyRate: number;
  cpuCores: number;
  ramMb: number;
  lastBilledAt: Date | null;
  createdAt: Date;
}

export interface PaasBillingResult {
  success: boolean;
  billedInstances: number;
  totalAmount: number;
  totalHours: number;
  failedInstances: string[];
  errors: string[];
}

interface UsageRange {
  start: Date;
  end: Date;
}

const RANGE_WINDOWS: Record<string, number> = {
  '24h': 24,
  '48h': 48,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

const getRangeWindow = (range: string): UsageRange => {
  const hours = RANGE_WINDOWS[range] ?? RANGE_WINDOWS['7d'];
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
};

export class PaasBillingService {
  /**
   * Record hourly usage for all running applications and charge wallets.
   */
  static async recordHourlyUsage(): Promise<PaasBillingResult> {
    const result: PaasBillingResult = {
      success: true,
      billedInstances: 0,
      totalAmount: 0,
      totalHours: 0,
      failedInstances: [],
      errors: [],
    };

    try {
      const apps = await this.getBillableApplications();
      const suspendedOrgs = new Set<string>();

      for (const app of apps) {
        try {
          const billingOutcome = await this.billApplication(app);

          if (!billingOutcome.success) {
            result.failedInstances.push(app.id);
            if (billingOutcome.error) {
              result.errors.push(billingOutcome.error);
            }

            if (billingOutcome.reason === 'insufficient_balance' && !suspendedOrgs.has(app.organizationId)) {
              suspendedOrgs.add(app.organizationId);
              await this.suspendOrganizationApps(app.organizationId, app.ownerId, 'Wallet balance is insufficient for PaaS billing');
            }
            continue;
          }

          if (billingOutcome.hoursCharged === 0) {
            continue;
          }

          result.billedInstances += 1;
          result.totalAmount += billingOutcome.amountCharged;
          result.totalHours += billingOutcome.hoursCharged;
        } catch (error: any) {
          result.failedInstances.push(app.id);
          const message = `Error billing PaaS app ${app.name}: ${error?.message || error}`;
          result.errors.push(message);
        }
      }

      if (result.failedInstances.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Critical billing error: ${error?.message || error}`);
      return result;
    }
  }

  /**
   * Get usage summary for a specific organization.
   */
  static async getOrganizationUsage(organizationId: string, range = '7d') {
    const window = getRangeWindow(range);

    const usageResult = await pool.query(
      `SELECT
        u.application_id,
        a.name as application_name,
        MIN(u.period_start) as first_period,
        MAX(u.period_end) as last_period,
        COALESCE(SUM(u.cpu_hours), 0)::float as cpu_hours,
        COALESCE(SUM(u.ram_mb_hours), 0)::float as ram_mb_hours,
        COALESCE(SUM(u.total_cost), 0)::float as total_cost,
        COUNT(*) as samples
       FROM paas_resource_usage u
       LEFT JOIN paas_applications a ON a.id = u.application_id
       WHERE u.organization_id = $1
         AND u.recorded_at >= $2
       GROUP BY u.application_id, a.name
       ORDER BY total_cost DESC`,
      [organizationId, window.start]
    );

    const walletResult = await pool.query(
      'SELECT balance, currency FROM wallets WHERE organization_id = $1',
      [organizationId]
    );

    const wallet = walletResult.rows[0] || { balance: 0, currency: 'USD' };

    return {
      range: window,
      usage: usageResult.rows,
      totals: {
        applications: usageResult.rowCount,
        totalCost: usageResult.rows.reduce((sum, row) => sum + Number(row.total_cost || 0), 0),
        totalCpuHours: usageResult.rows.reduce((sum, row) => sum + Number(row.cpu_hours || 0), 0),
        totalRamMbHours: usageResult.rows.reduce((sum, row) => sum + Number(row.ram_mb_hours || 0), 0),
      },
      wallet: {
        balance: Number(wallet.balance || 0),
        currency: wallet.currency || 'USD',
      },
    };
  }

  /**
   * Admin overview across all organizations.
   */
  static async getAdminBillingOverview(range = '30d') {
    const window = getRangeWindow(range);

    const totalsResult = await pool.query(
      `SELECT
        COALESCE(SUM(total_cost), 0)::float as total_cost,
        COUNT(DISTINCT organization_id) as organizations_billed,
        COUNT(DISTINCT application_id) as applications_billed
       FROM paas_resource_usage
       WHERE recorded_at >= $1`,
      [window.start]
    );

    const perOrgResult = await pool.query(
      `SELECT
        o.id,
        o.name,
        COALESCE(SUM(u.total_cost), 0)::float as total_cost,
        COALESCE(MAX(u.recorded_at), NULL) as last_billed_at
       FROM organizations o
       JOIN paas_applications a ON a.organization_id = o.id
       LEFT JOIN paas_resource_usage u
         ON u.organization_id = o.id
        AND u.recorded_at >= $1
       GROUP BY o.id, o.name
       ORDER BY total_cost DESC
       LIMIT 50`,
      [window.start]
    );

    const failedCharges = await pool.query(
      `SELECT
        application_id,
        organization_id,
        metadata,
        period_start,
        period_end,
        total_cost,
        recorded_at
       FROM paas_resource_usage
       WHERE billed_at IS NULL
         AND recorded_at >= $1
       ORDER BY recorded_at DESC
       LIMIT 25`,
      [window.start]
    );

    const walletAlerts = await pool.query(
      `SELECT o.id, o.name, w.balance
       FROM organizations o
       JOIN wallets w ON w.organization_id = o.id
       WHERE w.balance <= $1
       ORDER BY w.balance ASC
       LIMIT 25`,
      [DEFAULT_LOW_BALANCE_THRESHOLD]
    );

    return {
      range: window,
      totals: totalsResult.rows[0],
      organizations: perOrgResult.rows,
      failedCharges: failedCharges.rows,
      walletAlerts: walletAlerts.rows.map((row) => ({
        organization_id: row.id,
        organization_name: row.name,
        balance: Number(row.balance || 0),
      })),
    };
  }

  private static async getBillableApplications(): Promise<BillableApplication[]> {
    const result = await pool.query(
      `SELECT
        a.id,
        a.name,
        a.organization_id,
        a.replicas,
        a.last_billed_at,
        a.created_at,
        p.price_per_hour,
        p.cpu_cores,
        p.ram_mb,
        o.owner_id
       FROM paas_applications a
       JOIN paas_plans p ON p.id = a.plan_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.status IN ('running', 'deploying', 'building')`
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      organizationId: row.organization_id,
      ownerId: row.owner_id || null,
      replicas: Math.max(1, Number(row.replicas) || 1),
      hourlyRate: Number(row.price_per_hour || 0),
      cpuCores: Number(row.cpu_cores || 0),
      ramMb: Number(row.ram_mb || 0),
      lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  private static async billApplication(app: BillableApplication) {
    return transaction(async (client) => {
      const baseline = app.lastBilledAt ?? app.createdAt;
      const elapsedMs = Date.now() - baseline.getTime();
      const hoursToCharge = Math.floor(elapsedMs / MS_PER_HOUR);

      if (hoursToCharge < 1) {
        return { success: true, amountCharged: 0, hoursCharged: 0 };
      }

      const billingPeriodEnd = new Date(baseline.getTime() + hoursToCharge * MS_PER_HOUR);
      const totalAmount = Number((app.hourlyRate * hoursToCharge * app.replicas).toFixed(4));

      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE organization_id = $1 FOR UPDATE',
        [app.organizationId]
      );

      if (walletResult.rows.length === 0) {
        await this.recordUsageRow(client, app, hoursToCharge, totalAmount, billingPeriodEnd, true, 'no_wallet');
        return { success: false, amountCharged: 0, hoursCharged: hoursToCharge, reason: 'no_wallet', error: 'Wallet not found' };
      }

      const currentBalance = Number(walletResult.rows[0].balance || 0);
      if (currentBalance < totalAmount) {
        await this.recordUsageRow(client, app, hoursToCharge, totalAmount, billingPeriodEnd, true, 'insufficient_balance', {
          balance: currentBalance,
        });
        return {
          success: false,
          amountCharged: 0,
          hoursCharged: hoursToCharge,
          reason: 'insufficient_balance',
          error: 'Insufficient wallet balance',
        };
      }

      const deductionSuccess = await PayPalService.deductFundsFromWallet(
        app.organizationId,
        totalAmount,
        `PaaS hourly billing - ${app.name} (${hoursToCharge}h)`
      );

      if (!deductionSuccess) {
        await this.recordUsageRow(client, app, hoursToCharge, totalAmount, billingPeriodEnd, true, 'deduction_failed');
        return {
          success: false,
          amountCharged: 0,
          hoursCharged: hoursToCharge,
          reason: 'deduction_failed',
          error: 'Failed to deduct funds from wallet',
        };
      }

      await this.recordUsageRow(client, app, hoursToCharge, totalAmount, billingPeriodEnd, false);
      await client.query('UPDATE paas_applications SET last_billed_at = $1 WHERE id = $2', [billingPeriodEnd, app.id]);

      if (app.ownerId) {
        await logActivity({
          userId: app.ownerId,
          organizationId: app.organizationId,
          eventType: 'paas.billing.charge',
          entityType: 'paas_app',
          entityId: app.id,
          message: `Charged $${totalAmount.toFixed(4)} for ${hoursToCharge}h of ${app.name}`,
          status: 'success',
        });
      }

      const updatedWallet = await client.query('SELECT balance FROM wallets WHERE organization_id = $1', [app.organizationId]);
      const newBalance = Number(updatedWallet.rows[0]?.balance || 0);

      if (newBalance <= DEFAULT_LOW_BALANCE_THRESHOLD) {
        await this.suspendOrganizationApps(app.organizationId, app.ownerId, 'Wallet balance depleted after billing run');
        return {
          success: true,
          amountCharged: totalAmount,
          hoursCharged: hoursToCharge,
          reason: 'balance_depleted',
        };
      }

      return {
        success: true,
        amountCharged: totalAmount,
        hoursCharged: hoursToCharge,
      };
    });
  }

  private static async recordUsageRow(
    client: any,
    app: BillableApplication,
    hoursCharged: number,
    amount: number,
    periodEnd: Date,
    failed: boolean,
    reason?: string,
    metadata: Record<string, unknown> = {}
  ) {
    await client.query(
      `INSERT INTO paas_resource_usage (
        application_id,
        organization_id,
        period_start,
        period_end,
        cpu_hours,
        ram_mb_hours,
        total_cost,
        recorded_at,
        billed_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${failed ? 'NULL' : 'NOW()'}, $9)`,
      [
        app.id,
        app.organizationId,
        app.lastBilledAt ?? app.createdAt,
        periodEnd,
        app.cpuCores * hoursCharged * app.replicas,
        app.ramMb * hoursCharged * app.replicas,
        amount,
        periodEnd,
        JSON.stringify({
          billing_failed: failed,
          reason,
          hours_charged: hoursCharged,
          replicas: app.replicas,
          ...metadata,
        }),
      ]
    );
  }

  private static async suspendOrganizationApps(organizationId: string, ownerId: string | null, reason: string) {
    const apps = await pool.query(
      `SELECT id, name FROM paas_applications
       WHERE organization_id = $1
         AND status IN ('running', 'deploying', 'building')`,
      [organizationId]
    );

    for (const app of apps.rows) {
      try {
        await DeployerService.stop(app.id);
      } catch (error) {
        // ignore stop errors; we'll still mark as suspended
      }

      await pool.query('UPDATE paas_applications SET status = $1 WHERE id = $2', ['suspended', app.id]);

      if (ownerId) {
        await logActivity({
          userId: ownerId,
          organizationId,
          eventType: 'paas.billing.suspended',
          entityType: 'paas_app',
          entityId: app.id,
          message: `${app.name} suspended: ${reason}`,
          status: 'warning',
        });
      }
    }
  }
}
