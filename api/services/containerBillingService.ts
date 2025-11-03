/**
 * Container Billing Service for SkyPanelV2
 * Handles automated container billing, monthly charges, and billing cycle management
 */

import { query, transaction } from '../lib/database.js';
import { PayPalService } from './paypalService.js';
import { logActivity } from './activityLogger.js';

export interface ContainerBillingCycle {
  id: string;
  subscriptionId: string;
  organizationId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  monthlyRate: number;
  status: 'pending' | 'billed' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContainerSubscriptionInfo {
  id: string;
  organizationId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  monthlyRate: number;
}

export interface BillingProcessResult {
  success: boolean;
  processedCycles: number;
  totalAmount: number;
  failedCycles: string[];
  errors: string[];
}

export class ContainerBillingService {
  /**
   * Create a new billing cycle for a subscription
   */
  static async createBillingCycle(subscriptionId: string): Promise<ContainerBillingCycle | null> {
    try {
      return await transaction(async (client) => {
        // Get subscription details with plan information
        const subscriptionResult = await client.query(`
          SELECT 
            cs.id,
            cs.organization_id,
            cs.plan_id,
            cs.status,
            cs.current_period_start,
            cs.current_period_end,
            cp.price_monthly
          FROM container_subscriptions cs
          JOIN container_plans cp ON cs.plan_id = cp.id
          WHERE cs.id = $1 AND cs.status = 'active'
        `, [subscriptionId]);

        if (subscriptionResult.rows.length === 0) {
          console.error(`Active subscription not found: ${subscriptionId}`);
          return null;
        }

        const subscription = subscriptionResult.rows[0];
        const now = new Date();
        const billingPeriodStart = new Date(subscription.current_period_end);
        const billingPeriodEnd = new Date(billingPeriodStart);
        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

        // Create the billing cycle
        const billingCycleResult = await client.query(`
          INSERT INTO container_billing_cycles (
            subscription_id, organization_id, billing_period_start, 
            billing_period_end, monthly_rate, status
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, subscription_id, organization_id, billing_period_start, 
                    billing_period_end, monthly_rate, status, payment_transaction_id,
                    created_at, updated_at
        `, [
          subscriptionId,
          subscription.organization_id,
          billingPeriodStart,
          billingPeriodEnd,
          subscription.price_monthly,
          'pending'
        ]);

        // Update subscription period
        await client.query(`
          UPDATE container_subscriptions 
          SET current_period_start = $1, current_period_end = $2, updated_at = NOW()
          WHERE id = $3
        `, [billingPeriodStart, billingPeriodEnd, subscriptionId]);

        const cycle = billingCycleResult.rows[0];
        return {
          id: cycle.id,
          subscriptionId: cycle.subscription_id,
          organizationId: cycle.organization_id,
          billingPeriodStart: new Date(cycle.billing_period_start),
          billingPeriodEnd: new Date(cycle.billing_period_end),
          monthlyRate: parseFloat(cycle.monthly_rate),
          status: cycle.status,
          paymentTransactionId: cycle.payment_transaction_id || undefined,
          createdAt: new Date(cycle.created_at),
          updatedAt: new Date(cycle.updated_at)
        };
      });
    } catch (error) {
      console.error('Error creating billing cycle:', error);
      return null;
    }
  }

  /**
   * Process all due billing cycles for automated billing
   */
  static async processDueBillingCycles(): Promise<BillingProcessResult> {
    console.log('🔄 Starting container billing cycle processing...');
    
    const result: BillingProcessResult = {
      success: true,
      processedCycles: 0,
      totalAmount: 0,
      failedCycles: [],
      errors: []
    };

    try {
      // Get all pending billing cycles that are due (current time >= billing_period_start)
      const dueCycles = await this.getDueBillingCycles();
      console.log(`📊 Found ${dueCycles.length} due billing cycles to process`);

      for (const cycle of dueCycles) {
        try {
          const success = await this.chargeBillingCycle(cycle.id);
          
          if (success) {
            result.processedCycles++;
            result.totalAmount += cycle.monthlyRate;
            console.log(
              `✅ Successfully charged billing cycle ${cycle.id} - ${cycle.monthlyRate.toFixed(2)} for organization ${cycle.organizationId}`
            );
          } else {
            result.failedCycles.push(cycle.id);
            result.errors.push(`Failed to charge billing cycle ${cycle.id}`);
            console.error(`❌ Failed to charge billing cycle ${cycle.id}`);
          }
        } catch (error) {
          result.failedCycles.push(cycle.id);
          result.errors.push(`Error processing billing cycle ${cycle.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`❌ Error processing billing cycle ${cycle.id}:`, error);
        }
      }

      if (result.failedCycles.length > 0) {
        result.success = false;
      }

      console.log(
        `🏁 Billing processing completed: ${result.processedCycles} processed, ${result.failedCycles.length} failed, ${result.totalAmount.toFixed(2)} total charged`
      );
      return result;

    } catch (error) {
      console.error('💥 Critical error in billing cycle processing:', error);
      result.success = false;
      result.errors.push(`Critical billing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Charge a specific billing cycle with wallet deduction
   */
  static async chargeBillingCycle(cycleId: string): Promise<boolean> {
    try {
      return await transaction(async (client) => {
        // Get billing cycle details
        const cycleResult = await client.query(`
          SELECT 
            cbc.id,
            cbc.subscription_id,
            cbc.organization_id,
            cbc.billing_period_start,
            cbc.billing_period_end,
            cbc.monthly_rate,
            cbc.status,
            cs.status as subscription_status
          FROM container_billing_cycles cbc
          JOIN container_subscriptions cs ON cbc.subscription_id = cs.id
          WHERE cbc.id = $1 AND cbc.status = 'pending'
        `, [cycleId]);

        if (cycleResult.rows.length === 0) {
          console.error(`Pending billing cycle not found: ${cycleId}`);
          return false;
        }

        const cycle = cycleResult.rows[0];
        
        // Check if subscription is still active
        if (cycle.subscription_status !== 'active') {
          console.warn(`Skipping billing for inactive subscription: ${cycle.subscription_id}`);
          
          // Mark cycle as failed due to inactive subscription
          await client.query(`
            UPDATE container_billing_cycles 
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [cycleId]);

          // Log billing failure due to inactive subscription
          await logActivity({
            userId: null, // System event
            organizationId: cycle.organization_id,
            eventType: 'container.billing.failed',
            entityType: 'container_billing_cycle',
            entityId: cycleId,
            message: `Container billing failed: subscription ${cycle.subscription_id} is inactive`,
            status: 'error',
            metadata: {
              subscriptionId: cycle.subscription_id,
              reason: 'inactive_subscription',
              subscriptionStatus: cycle.subscription_status
            },
            suppressNotification: true
          });
          
          return false;
        }

        const amount = parseFloat(cycle.monthly_rate);
        
        // Check wallet balance
        const walletResult = await client.query(
          'SELECT balance FROM wallets WHERE organization_id = $1',
          [cycle.organization_id]
        );

        if (walletResult.rows.length === 0) {
          console.error(`No wallet found for organization ${cycle.organization_id}`);
          
          await client.query(`
            UPDATE container_billing_cycles 
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [cycleId]);

          // Log billing failure due to missing wallet
          await logActivity({
            userId: null, // System event
            organizationId: cycle.organization_id,
            eventType: 'container.billing.failed',
            entityType: 'container_billing_cycle',
            entityId: cycleId,
            message: `Container billing failed: no wallet found for organization ${cycle.organization_id}`,
            status: 'error',
            metadata: {
              subscriptionId: cycle.subscription_id,
              reason: 'no_wallet_found'
            },
            suppressNotification: true
          });
          
          return false;
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);
        if (currentBalance < amount) {
          console.warn(
            `Insufficient balance for billing cycle ${cycleId}: required ${amount.toFixed(2)}, available ${currentBalance.toFixed(2)}`
          );

          // Mark cycle as failed and suspend subscription
          await client.query(`
            UPDATE container_billing_cycles 
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [cycleId]);

          // Log billing failure due to insufficient funds
          await logActivity({
            userId: null, // System event
            organizationId: cycle.organization_id,
            eventType: 'container.billing.failed',
            entityType: 'container_billing_cycle',
            entityId: cycleId,
            message: `Container billing failed: insufficient wallet balance (required $${amount.toFixed(2)}, available $${currentBalance.toFixed(2)})`,
            status: 'error',
            metadata: {
              subscriptionId: cycle.subscription_id,
              reason: 'insufficient_funds',
              requiredAmount: amount,
              availableBalance: currentBalance
            },
            suppressNotification: true
          });

          // Suspend the subscription for non-payment
          await this.suspendSubscriptionForNonPayment(cycle.subscription_id);
          
          return false;
        }

        // Deduct funds from wallet
        const deductionSuccess = await PayPalService.deductFundsFromWallet(
          cycle.organization_id,
          amount,
          `Container Subscription - Monthly Billing (${new Date(cycle.billing_period_start).toLocaleDateString()} - ${new Date(cycle.billing_period_end).toLocaleDateString()})`
        );

        if (!deductionSuccess) {
          console.error(`Failed to deduct funds for billing cycle ${cycleId}`);

          await client.query(`
            UPDATE container_billing_cycles 
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [cycleId]);

          // Log billing failure due to wallet deduction failure
          await logActivity({
            userId: null, // System event
            organizationId: cycle.organization_id,
            eventType: 'container.billing.failed',
            entityType: 'container_billing_cycle',
            entityId: cycleId,
            message: `Container billing failed: wallet deduction failed for $${amount.toFixed(2)}`,
            status: 'error',
            metadata: {
              subscriptionId: cycle.subscription_id,
              reason: 'wallet_deduction_failed',
              amount: amount
            },
            suppressNotification: true
          });

          return false;
        }

        // Get the payment transaction ID
        const transactionResult = await client.query(`
          SELECT id FROM payment_transactions 
          WHERE organization_id = $1 
            AND description LIKE '%Container Subscription%'
            AND status = 'completed'
          ORDER BY created_at DESC 
          LIMIT 1
        `, [cycle.organization_id]);

        const paymentTransactionId = transactionResult.rows[0]?.id;

        // Mark billing cycle as billed
        await client.query(`
          UPDATE container_billing_cycles 
          SET status = 'billed', payment_transaction_id = $2, updated_at = NOW()
          WHERE id = $1
        `, [cycleId, paymentTransactionId]);

        // Log successful billing charge
        await logActivity({
          userId: null, // System event
          organizationId: cycle.organization_id,
          eventType: 'container.billing.charge',
          entityType: 'container_billing_cycle',
          entityId: cycleId,
          message: `Container subscription charged $${amount.toFixed(2)} for billing period ${new Date(cycle.billing_period_start).toLocaleDateString()} - ${new Date(cycle.billing_period_end).toLocaleDateString()}`,
          status: 'success',
          metadata: {
            subscriptionId: cycle.subscription_id,
            amount: amount,
            billingPeriodStart: cycle.billing_period_start,
            billingPeriodEnd: cycle.billing_period_end,
            paymentTransactionId: paymentTransactionId
          },
          suppressNotification: true
        });

        return true;
      });
    } catch (error) {
      console.error(`Error charging billing cycle ${cycleId}:`, error);
      return false;
    }
  }

  /**
   * Suspend subscription for non-payment
   */
  static async suspendSubscriptionForNonPayment(subscriptionId: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE container_subscriptions 
        SET status = 'suspended', updated_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING id, organization_id
      `, [subscriptionId]);

      if (result.rows.length === 0) {
        console.warn(`Subscription ${subscriptionId} not found or already suspended`);
        return false;
      }

      const subscription = result.rows[0];
      console.log(`🚫 Suspended container subscription ${subscriptionId} for organization ${subscription.organization_id} due to non-payment`);

      // Log subscription suspension
      await logActivity({
        userId: null, // System event
        organizationId: subscription.organization_id,
        eventType: 'container.subscription.suspend',
        entityType: 'container_subscription',
        entityId: subscriptionId,
        message: 'Container subscription suspended due to non-payment',
        status: 'warning',
        metadata: {
          reason: 'non_payment',
          previousStatus: 'active'
        },
        suppressNotification: false // This should notify the user
      });
      
      return true;
    } catch (error) {
      console.error(`Error suspending subscription ${subscriptionId}:`, error);
      return false;
    }
  }

  /**
   * List billing cycles for an organization
   */
  static async listBillingCycles(
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ContainerBillingCycle[]> {
    try {
      const result = await query(`
        SELECT 
          cbc.id,
          cbc.subscription_id,
          cbc.organization_id,
          cbc.billing_period_start,
          cbc.billing_period_end,
          cbc.monthly_rate,
          cbc.status,
          cbc.payment_transaction_id,
          cbc.created_at,
          cbc.updated_at
        FROM container_billing_cycles cbc
        WHERE cbc.organization_id = $1
        ORDER BY cbc.created_at DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        subscriptionId: row.subscription_id,
        organizationId: row.organization_id,
        billingPeriodStart: new Date(row.billing_period_start),
        billingPeriodEnd: new Date(row.billing_period_end),
        monthlyRate: parseFloat(row.monthly_rate),
        status: row.status,
        paymentTransactionId: row.payment_transaction_id || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error listing billing cycles:', error);
      return [];
    }
  }

  /**
   * Get due billing cycles that need to be processed
   */
  private static async getDueBillingCycles(): Promise<ContainerBillingCycle[]> {
    try {
      const now = new Date();
      
      const result = await query(`
        SELECT 
          cbc.id,
          cbc.subscription_id,
          cbc.organization_id,
          cbc.billing_period_start,
          cbc.billing_period_end,
          cbc.monthly_rate,
          cbc.status,
          cbc.payment_transaction_id,
          cbc.created_at,
          cbc.updated_at
        FROM container_billing_cycles cbc
        JOIN container_subscriptions cs ON cbc.subscription_id = cs.id
        WHERE cbc.status = 'pending' 
          AND cbc.billing_period_start <= $1
          AND cs.status = 'active'
        ORDER BY cbc.billing_period_start ASC
      `, [now]);

      return result.rows.map(row => ({
        id: row.id,
        subscriptionId: row.subscription_id,
        organizationId: row.organization_id,
        billingPeriodStart: new Date(row.billing_period_start),
        billingPeriodEnd: new Date(row.billing_period_end),
        monthlyRate: parseFloat(row.monthly_rate),
        status: row.status,
        paymentTransactionId: row.payment_transaction_id || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting due billing cycles:', error);
      return [];
    }
  }

  /**
   * Get billing summary for an organization's container subscriptions
   */
  static async getBillingSummary(organizationId: string): Promise<{
    totalSpentThisMonth: number;
    totalSpentAllTime: number;
    activeSubscriptions: number;
    monthlyEstimate: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get total spent this month
      const monthlyResult = await query(`
        SELECT COALESCE(SUM(monthly_rate), 0) as total
        FROM container_billing_cycles
        WHERE organization_id = $1 
          AND status = 'billed'
          AND created_at >= $2
      `, [organizationId, startOfMonth]);

      // Get total spent all time
      const allTimeResult = await query(`
        SELECT COALESCE(SUM(monthly_rate), 0) as total
        FROM container_billing_cycles
        WHERE organization_id = $1 AND status = 'billed'
      `, [organizationId]);

      // Get active subscriptions count and monthly estimate
      const subscriptionsResult = await query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(cp.price_monthly), 0) as monthly_estimate
        FROM container_subscriptions cs
        JOIN container_plans cp ON cs.plan_id = cp.id
        WHERE cs.organization_id = $1 AND cs.status = 'active'
      `, [organizationId]);

      return {
        totalSpentThisMonth: parseFloat(monthlyResult.rows[0].total),
        totalSpentAllTime: parseFloat(allTimeResult.rows[0].total),
        activeSubscriptions: parseInt(subscriptionsResult.rows[0].count),
        monthlyEstimate: parseFloat(subscriptionsResult.rows[0].monthly_estimate || '0')
      };
    } catch (error) {
      console.error('Error getting container billing summary:', error);
      return {
        totalSpentThisMonth: 0,
        totalSpentAllTime: 0,
        activeSubscriptions: 0,
        monthlyEstimate: 0
      };
    }
  }
}