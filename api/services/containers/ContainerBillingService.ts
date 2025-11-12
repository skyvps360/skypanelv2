/**
 * Container Billing Service for SkyPanelV2
 * Handles automated container billing, hourly charges, and billing cycle management
 */

import { query, transaction } from '../../lib/database.js';
import { PayPalService } from '../paypalService.js';

export interface ContainerServiceBillingInfo {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
  lastBilledAt: Date | null;
  createdAt: Date;
}

export interface ContainerBillingCycle {
  id: string;
  serviceId: string;
  organizationId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  cpuHours: number;
  memoryGbHours: number;
  storageGbHours: number;
  networkGb: number;
  buildMinutes: number;
  totalAmount: number;
  status: 'pending' | 'billed' | 'failed' | 'refunded';
  paymentTransactionId?: string;
}

export interface ContainerBillingResult {
  success: boolean;
  billedServices: number;
  totalAmount: number;
  totalHours: number;
  failedServices: string[];
  errors: string[];
}

export interface ResourceCosts {
  cpuCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  buildCost: number;
  totalCost: number;
}

// Pricing configuration (per hour unless specified)
const PRICING = {
  CPU_PER_CORE_HOUR: 0.01,           // $0.01 per core-hour
  MEMORY_PER_GB_HOUR: 0.005,         // $0.005 per GB-hour
  STORAGE_PER_GB_HOUR: 0.000137,     // ~$0.10 per GB-month prorated hourly
  NETWORK_PER_GB: 0.01,              // $0.01 per GB transferred (outbound)
  BUILD_PER_MINUTE: 0.05,            // $0.05 per build minute
};

const MS_PER_HOUR = 60 * 60 * 1000;

export class ContainerBillingService {
  /**
   * Calculate resource costs for a container service
   */
  static calculateResourceCosts(
    service: ContainerServiceBillingInfo,
    hours: number,
    networkGb: number = 0,
    buildMinutes: number = 0
  ): ResourceCosts {
    const cpuCost = service.resourceLimits.cpuCores * PRICING.CPU_PER_CORE_HOUR * hours;
    const memoryCost = (service.resourceLimits.memoryMb / 1024) * PRICING.MEMORY_PER_GB_HOUR * hours;
    const storageCost = service.resourceLimits.diskGb * PRICING.STORAGE_PER_GB_HOUR * hours;
    const networkCost = networkGb * PRICING.NETWORK_PER_GB;
    const buildCost = buildMinutes * PRICING.BUILD_PER_MINUTE;

    const totalCost = cpuCost + memoryCost + storageCost + networkCost + buildCost;

    return {
      cpuCost: Number(cpuCost.toFixed(4)),
      memoryCost: Number(memoryCost.toFixed(4)),
      storageCost: Number(storageCost.toFixed(4)),
      networkCost: Number(networkCost.toFixed(4)),
      buildCost: Number(buildCost.toFixed(4)),
      totalCost: Number(totalCost.toFixed(4)),
    };
  }

  /**
   * Run hourly billing for all active container services
   */
  static async runHourlyContainerBilling(): Promise<ContainerBillingResult> {
    console.log('🔄 Starting hourly container billing process...');

    const result: ContainerBillingResult = {
      success: true,
      billedServices: 0,
      totalAmount: 0,
      totalHours: 0,
      failedServices: [],
      errors: [],
    };

    try {
      // Get all active container services that need billing
      const activeServices = await this.getActiveContainerServices();
      console.log(`📊 Found ${activeServices.length} active container services to process`);

      for (const service of activeServices) {
        try {
          const billingOutcome = await this.billContainerService(service.id);
          
          if (!billingOutcome.success) {
            result.failedServices.push(service.id);
            result.errors.push(`Failed to bill service ${service.name} (${service.id})`);
            console.error(`❌ Failed to bill service ${service.name} (${service.id})`);
            continue;
          }

          if (billingOutcome.hoursCharged === 0) {
            console.log(`⏭️ No billable hours yet for service ${service.name} (${service.id}); skipping.`);
            continue;
          }

          result.billedServices++;
          result.totalAmount += billingOutcome.amountCharged;
          result.totalHours += billingOutcome.hoursCharged;
          console.log(
            `✅ Successfully billed service ${service.name} (${service.id}) - ${billingOutcome.hoursCharged}h (charged ${billingOutcome.amountCharged.toFixed(4)})`
          );
        } catch (error) {
          result.failedServices.push(service.id);
          result.errors.push(
            `Error billing service ${service.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          console.error(`❌ Error billing service ${service.name}:`, error);
        }
      }

      if (result.failedServices.length > 0) {
        result.success = false;
      }

      console.log(
        `🏁 Container billing completed: ${result.billedServices} billed, ${result.failedServices.length} failed, ${result.totalHours}h charged, ${result.totalAmount.toFixed(2)} total`
      );
      return result;
    } catch (error) {
      console.error('💥 Critical error in hourly container billing process:', error);
      result.success = false;
      result.errors.push(
        `Critical billing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return result;
    }
  }

  /**
   * Get all active container services that need billing
   */
  private static async getActiveContainerServices(): Promise<ContainerServiceBillingInfo[]> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);

    const result = await query(
      `SELECT 
        id,
        organization_id,
        name,
        slug,
        status,
        resource_limits,
        last_billed_at,
        created_at
      FROM container_services
      WHERE status IN ('running', 'deploying', 'building')
        AND (last_billed_at IS NULL OR last_billed_at <= $1)
      ORDER BY created_at ASC`,
      [oneHourAgo]
    );

    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      resourceLimits: row.resource_limits,
      lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Bill a specific container service for any fully elapsed hours since the last charge
   */
  static async billContainerService(
    serviceId: string
  ): Promise<{ success: boolean; amountCharged: number; hoursCharged: number }> {
    try {
      return await transaction(async (client) => {
        // Get service details
        const serviceResult = await client.query(
          `SELECT 
            id,
            organization_id,
            name,
            slug,
            status,
            resource_limits,
            last_billed_at,
            created_at
          FROM container_services
          WHERE id = $1`,
          [serviceId]
        );

        if (serviceResult.rows.length === 0) {
          console.error(`Service not found: ${serviceId}`);
          return { success: false, amountCharged: 0, hoursCharged: 0 };
        }

        const service: ContainerServiceBillingInfo = {
          id: serviceResult.rows[0].id,
          organizationId: serviceResult.rows[0].organization_id,
          name: serviceResult.rows[0].name,
          slug: serviceResult.rows[0].slug,
          status: serviceResult.rows[0].status,
          resourceLimits: serviceResult.rows[0].resource_limits,
          lastBilledAt: serviceResult.rows[0].last_billed_at
            ? new Date(serviceResult.rows[0].last_billed_at)
            : null,
          createdAt: new Date(serviceResult.rows[0].created_at),
        };

        const now = new Date();
        const billingPeriodStart = service.lastBilledAt ?? service.createdAt;
        const elapsedMs = Math.max(0, now.getTime() - billingPeriodStart.getTime());
        const rawHoursElapsed = elapsedMs / MS_PER_HOUR;
        const hoursToCharge = Math.floor(rawHoursElapsed);

        if (hoursToCharge < 1) {
          return { success: true, amountCharged: 0, hoursCharged: 0 };
        }

        const billingPeriodEnd = new Date(billingPeriodStart.getTime() + hoursToCharge * MS_PER_HOUR);

        // Get network usage and build time for this billing period
        const metricsResult = await client.query(
          `SELECT 
            COALESCE(SUM(network_gb), 0) as network_gb,
            COALESCE(SUM(build_minutes), 0) as build_minutes
          FROM (
            SELECT 0 as network_gb, 0 as build_minutes
            UNION ALL
            SELECT 
              0 as network_gb,
              COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60), 0) as build_minutes
            FROM container_builds
            WHERE service_id = $1
              AND build_status = 'success'
              AND completed_at >= $2
              AND completed_at < $3
          ) metrics`,
          [serviceId, billingPeriodStart, billingPeriodEnd]
        );

        const networkGb = parseFloat(metricsResult.rows[0].network_gb || '0');
        const buildMinutes = parseFloat(metricsResult.rows[0].build_minutes || '0');

        // Calculate costs
        const costs = this.calculateResourceCosts(service, hoursToCharge, networkGb, buildMinutes);

        // Check wallet balance
        const walletResult = await client.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [service.organizationId]
        );

        if (walletResult.rows.length === 0) {
          console.error(`No wallet found for organization ${service.organizationId}`);
          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);
        if (currentBalance < costs.totalCost) {
          console.warn(
            `Insufficient balance for service ${service.name}: required ${costs.totalCost.toFixed(4)}, available ${currentBalance.toFixed(2)}`
          );

          // Record failed billing cycle
          await client.query(
            `INSERT INTO container_billing_cycles (
              service_id, organization_id, billing_period_start, billing_period_end,
              cpu_hours, memory_gb_hours, storage_gb_hours, network_gb, build_minutes,
              total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              service.id,
              service.organizationId,
              billingPeriodStart,
              billingPeriodEnd,
              service.resourceLimits.cpuCores * hoursToCharge,
              (service.resourceLimits.memoryMb / 1024) * hoursToCharge,
              service.resourceLimits.diskGb * hoursToCharge,
              networkGb,
              buildMinutes,
              costs.totalCost,
              'failed',
              JSON.stringify({
                reason: 'insufficient_balance',
                hours_charged: hoursToCharge,
                elapsed_hours: rawHoursElapsed,
                cost_breakdown: costs,
              }),
            ]
          );

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Deduct funds from wallet
        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          service.organizationId,
          costs.totalCost,
          `Container Service - ${service.name} (${hoursToCharge}h)`
        );

        if (!deductionSuccess) {
          console.error(`Failed to deduct funds for service ${service.name}`);

          await client.query(
            `INSERT INTO container_billing_cycles (
              service_id, organization_id, billing_period_start, billing_period_end,
              cpu_hours, memory_gb_hours, storage_gb_hours, network_gb, build_minutes,
              total_amount, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              service.id,
              service.organizationId,
              billingPeriodStart,
              billingPeriodEnd,
              service.resourceLimits.cpuCores * hoursToCharge,
              (service.resourceLimits.memoryMb / 1024) * hoursToCharge,
              service.resourceLimits.diskGb * hoursToCharge,
              networkGb,
              buildMinutes,
              costs.totalCost,
              'failed',
              JSON.stringify({
                reason: 'wallet_deduction_failed',
                hours_charged: hoursToCharge,
                elapsed_hours: rawHoursElapsed,
                cost_breakdown: costs,
              }),
            ]
          );

          return { success: false, amountCharged: 0, hoursCharged: hoursToCharge };
        }

        // Get payment transaction ID
        const transactionResult = await client.query(
          `SELECT id FROM payment_transactions 
          WHERE organization_id = $1 
            AND description LIKE $2
            AND status = 'completed'
          ORDER BY created_at DESC 
          LIMIT 1`,
          [service.organizationId, `%${service.name}%`]
        );

        const paymentTransactionId = transactionResult.rows[0]?.id;

        // Record successful billing cycle
        await client.query(
          `INSERT INTO container_billing_cycles (
            service_id, organization_id, billing_period_start, billing_period_end,
            cpu_hours, memory_gb_hours, storage_gb_hours, network_gb, build_minutes,
            total_amount, status, payment_transaction_id, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            service.id,
            service.organizationId,
            billingPeriodStart,
            billingPeriodEnd,
            service.resourceLimits.cpuCores * hoursToCharge,
            (service.resourceLimits.memoryMb / 1024) * hoursToCharge,
            service.resourceLimits.diskGb * hoursToCharge,
            networkGb,
            buildMinutes,
            costs.totalCost,
            'billed',
            paymentTransactionId,
            JSON.stringify({
              hours_charged: hoursToCharge,
              elapsed_hours: rawHoursElapsed,
              cost_breakdown: costs,
              service_name: service.name,
            }),
          ]
        );

        // Update last_billed_at timestamp
        await client.query('UPDATE container_services SET last_billed_at = $1 WHERE id = $2', [
          billingPeriodEnd,
          service.id,
        ]);

        return { success: true, amountCharged: costs.totalCost, hoursCharged: hoursToCharge };
      });
    } catch (error) {
      console.error(`Error billing container service ${serviceId}:`, error);
      return { success: false, amountCharged: 0, hoursCharged: 0 };
    }
  }

  /**
   * Get billing history for an organization
   */
  static async getContainerBillingHistory(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ContainerBillingCycle[]> {
    try {
      const result = await query(
        `SELECT 
          id,
          service_id,
          organization_id,
          billing_period_start,
          billing_period_end,
          cpu_hours,
          memory_gb_hours,
          storage_gb_hours,
          network_gb,
          build_minutes,
          total_amount,
          status,
          payment_transaction_id
        FROM container_billing_cycles
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset]
      );

      return result.rows.map((row) => ({
        id: row.id,
        serviceId: row.service_id,
        organizationId: row.organization_id,
        billingPeriodStart: new Date(row.billing_period_start),
        billingPeriodEnd: new Date(row.billing_period_end),
        cpuHours: parseFloat(row.cpu_hours),
        memoryGbHours: parseFloat(row.memory_gb_hours),
        storageGbHours: parseFloat(row.storage_gb_hours),
        networkGb: parseFloat(row.network_gb),
        buildMinutes: parseInt(row.build_minutes),
        totalAmount: parseFloat(row.total_amount),
        status: row.status,
        paymentTransactionId: row.payment_transaction_id ?? undefined,
      }));
    } catch (error) {
      console.error('Error getting container billing history:', error);
      return [];
    }
  }

  /**
   * Get billing summary for an organization
   */
  static async getContainerBillingSummary(organizationId: string): Promise<{
    totalSpentThisMonth: number;
    totalSpentAllTime: number;
    activeServicesCount: number;
    monthlyEstimate: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get total spent this month
      const monthlyResult = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
        FROM container_billing_cycles
        WHERE organization_id = $1 
          AND status = 'billed'
          AND created_at >= $2`,
        [organizationId, startOfMonth]
      );

      // Get total spent all time
      const allTimeResult = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
        FROM container_billing_cycles
        WHERE organization_id = $1 AND status = 'billed'`,
        [organizationId]
      );

      // Get active services count and monthly estimate
      const activeServicesResult = await query(
        `SELECT 
          COUNT(*) as count,
          COALESCE(SUM(
            (resource_limits->>'cpuCores')::numeric * ${PRICING.CPU_PER_CORE_HOUR} * 730 +
            ((resource_limits->>'memoryMb')::numeric / 1024) * ${PRICING.MEMORY_PER_GB_HOUR} * 730 +
            (resource_limits->>'diskGb')::numeric * ${PRICING.STORAGE_PER_GB_HOUR} * 730
          ), 0) as monthly_estimate
        FROM container_services
        WHERE organization_id = $1
          AND status IN ('running', 'deploying', 'building')`,
        [organizationId]
      );

      return {
        totalSpentThisMonth: parseFloat(monthlyResult.rows[0].total),
        totalSpentAllTime: parseFloat(allTimeResult.rows[0].total),
        activeServicesCount: parseInt(activeServicesResult.rows[0].count),
        monthlyEstimate: parseFloat(activeServicesResult.rows[0].monthly_estimate || '0'),
      };
    } catch (error) {
      console.error('Error getting container billing summary:', error);
      return {
        totalSpentThisMonth: 0,
        totalSpentAllTime: 0,
        activeServicesCount: 0,
        monthlyEstimate: 0,
      };
    }
  }

  /**
   * Estimate costs for a container service before deployment
   */
  static estimateServiceCosts(
    cpuCores: number,
    memoryMb: number,
    diskGb: number,
    estimatedBuildMinutesPerDay: number = 0,
    estimatedNetworkGbPerDay: number = 0
  ): {
    hourly: number;
    daily: number;
    monthly: number;
    breakdown: {
      cpu: { hourly: number; daily: number; monthly: number };
      memory: { hourly: number; daily: number; monthly: number };
      storage: { hourly: number; daily: number; monthly: number };
      network: { hourly: number; daily: number; monthly: number };
      build: { hourly: number; daily: number; monthly: number };
    };
  } {
    const cpuHourly = cpuCores * PRICING.CPU_PER_CORE_HOUR;
    const memoryHourly = (memoryMb / 1024) * PRICING.MEMORY_PER_GB_HOUR;
    const storageHourly = diskGb * PRICING.STORAGE_PER_GB_HOUR;
    const networkHourly = (estimatedNetworkGbPerDay / 24) * PRICING.NETWORK_PER_GB;
    const buildHourly = (estimatedBuildMinutesPerDay / 60) * PRICING.BUILD_PER_MINUTE;

    const hourly = cpuHourly + memoryHourly + storageHourly + networkHourly + buildHourly;
    const daily = hourly * 24;
    const monthly = hourly * 730; // Average hours per month

    return {
      hourly: Number(hourly.toFixed(4)),
      daily: Number(daily.toFixed(4)),
      monthly: Number(monthly.toFixed(2)),
      breakdown: {
        cpu: {
          hourly: Number(cpuHourly.toFixed(4)),
          daily: Number((cpuHourly * 24).toFixed(4)),
          monthly: Number((cpuHourly * 730).toFixed(2)),
        },
        memory: {
          hourly: Number(memoryHourly.toFixed(4)),
          daily: Number((memoryHourly * 24).toFixed(4)),
          monthly: Number((memoryHourly * 730).toFixed(2)),
        },
        storage: {
          hourly: Number(storageHourly.toFixed(4)),
          daily: Number((storageHourly * 24).toFixed(4)),
          monthly: Number((storageHourly * 730).toFixed(2)),
        },
        network: {
          hourly: Number(networkHourly.toFixed(4)),
          daily: Number((networkHourly * 24).toFixed(4)),
          monthly: Number((networkHourly * 730).toFixed(2)),
        },
        build: {
          hourly: Number(buildHourly.toFixed(4)),
          daily: Number((buildHourly * 24).toFixed(4)),
          monthly: Number((buildHourly * 730).toFixed(2)),
        },
      },
    };
  }
}
