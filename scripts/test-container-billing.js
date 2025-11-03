#!/usr/bin/env node

/**
 * Container Billing Test Script
 * 
 * This script tests the container billing automation functionality
 * by creating test billing cycles and processing them.
 * 
 * Usage:
 *   node scripts/test-container-billing.js
 */

import { ContainerBillingService } from '../api/services/containerBillingService.js';
import { query, transaction } from '../api/lib/database.js';

/**
 * Create a test billing cycle for testing
 */
async function createTestBillingCycle() {
  try {
    return await transaction(async (client) => {
      // First, check if we have any active container subscriptions
      const subscriptionResult = await client.query(`
        SELECT cs.id, cs.organization_id, cp.price_monthly
        FROM container_subscriptions cs
        JOIN container_plans cp ON cs.plan_id = cp.id
        WHERE cs.status = 'active'
        LIMIT 1
      `);

      if (subscriptionResult.rows.length === 0) {
        console.log('⚠️ No active container subscriptions found. Creating test data...');
        
        // Create a test organization if none exists
        const orgResult = await client.query(`
          SELECT id FROM organizations LIMIT 1
        `);
        
        if (orgResult.rows.length === 0) {
          console.log('❌ No organizations found. Please create test data first.');
          return null;
        }

        const organizationId = orgResult.rows[0].id;

        // Create a test container plan
        const planResult = await client.query(`
          INSERT INTO container_plans (name, description, price_monthly, max_cpu_cores, max_memory_gb, max_storage_gb, max_containers, active)
          VALUES ('Test Plan', 'Test container plan for billing', 10.00, 2, 4, 20, 5, true)
          RETURNING id
        `);

        const planId = planResult.rows[0].id;

        // Create a test subscription
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() - 1); // Make it due for billing

        const subscriptionResult = await client.query(`
          INSERT INTO container_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
          VALUES ($1, $2, 'active', $3, $4)
          RETURNING id, organization_id
        `, [organizationId, planId, now, periodEnd]);

        const subscription = subscriptionResult.rows[0];
        console.log(`✅ Created test subscription: ${subscription.id}`);

        // Create a test billing cycle that's due
        const billingStart = new Date(periodEnd);
        const billingEnd = new Date(billingStart);
        billingEnd.setMonth(billingEnd.getMonth() + 1);

        const cycleResult = await client.query(`
          INSERT INTO container_billing_cycles (subscription_id, organization_id, billing_period_start, billing_period_end, monthly_rate, status)
          VALUES ($1, $2, $3, $4, 10.00, 'pending')
          RETURNING id
        `, [subscription.id, subscription.organization_id, billingStart, billingEnd]);

        console.log(`✅ Created test billing cycle: ${cycleResult.rows[0].id}`);
        return cycleResult.rows[0].id;
      } else {
        // Use existing subscription to create a test billing cycle
        const subscription = subscriptionResult.rows[0];
        
        // Create a test billing cycle that's due
        const now = new Date();
        const billingStart = new Date(now);
        billingStart.setDate(billingStart.getDate() - 1); // Make it due
        const billingEnd = new Date(billingStart);
        billingEnd.setMonth(billingEnd.getMonth() + 1);

        const cycleResult = await client.query(`
          INSERT INTO container_billing_cycles (subscription_id, organization_id, billing_period_start, billing_period_end, monthly_rate, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING id
        `, [subscription.id, subscription.organization_id, billingStart, billingEnd, subscription.price_monthly]);

        console.log(`✅ Created test billing cycle: ${cycleResult.rows[0].id}`);
        return cycleResult.rows[0].id;
      }
    });
  } catch (error) {
    console.error('❌ Error creating test billing cycle:', error);
    return null;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  try {
    // Remove test billing cycles
    await query(`
      DELETE FROM container_billing_cycles 
      WHERE monthly_rate = 10.00 AND status IN ('pending', 'failed')
    `);

    // Remove test subscriptions
    await query(`
      DELETE FROM container_subscriptions 
      WHERE plan_id IN (
        SELECT id FROM container_plans WHERE name = 'Test Plan'
      )
    `);

    // Remove test plans
    await query(`
      DELETE FROM container_plans WHERE name = 'Test Plan'
    `);

    console.log('🧹 Cleaned up test data');
  } catch (error) {
    console.error('⚠️ Error cleaning up test data:', error);
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Starting container billing automation test...');
  
  try {
    // Clean up any existing test data
    await cleanupTestData();

    // Create test billing cycle
    const testCycleId = await createTestBillingCycle();
    
    if (!testCycleId) {
      console.log('❌ Failed to create test billing cycle');
      process.exit(1);
    }

    console.log('\n📊 Testing billing cycle processing...');

    // Process billing cycles
    const result = await ContainerBillingService.processDueBillingCycles();

    // Display results
    console.log('\n📈 Test Results:');
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Processed Cycles: ${result.processedCycles}`);
    console.log(`   Total Amount: $${result.totalAmount.toFixed(2)}`);
    console.log(`   Failed Cycles: ${result.failedCycles.length}`);

    if (result.failedCycles.length > 0) {
      console.log('\n❌ Failed Cycles:');
      result.failedCycles.forEach((cycleId, index) => {
        console.log(`   ${index + 1}. ${cycleId}`);
      });
    }

    if (result.errors.length > 0) {
      console.log('\n🔍 Errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Clean up test data
    await cleanupTestData();

    console.log('\n✅ Container billing test completed');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Test failed with error:');
    console.error(error);
    
    // Clean up test data even on failure
    await cleanupTestData();
    process.exit(1);
  }
}

/**
 * Handle script execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error in container billing test:');
    console.error(error);
    process.exit(1);
  });
}

export { main };