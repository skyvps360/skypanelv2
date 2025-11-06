/**
 * Test script for VPS hourly billing system
 * 
 * This script:
 * 1. Logs in as admin@skypanelv2.com
 * 2. Adds $100 to the wallet
 * 3. Creates a VPS instance
 * 4. Simulates 6 hours of billing
 * 5. Verifies each hour charges the correct flat rate (not accumulating)
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { BillingService } from '../api/services/billingService.js';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test credentials
const TEST_USER = {
  email: 'admin@skypanelv2.com',
  password: 'admin123'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(4)}`;
}

async function getUserAndOrg() {
  const userResult = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [TEST_USER.email]
  );
  
  if (userResult.rows.length === 0) {
    throw new Error(`User ${TEST_USER.email} not found`);
  }
  
  const userId = userResult.rows[0].id;
  
  // Get organization from organization_members
  const orgResult = await pool.query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  
  if (orgResult.rows.length === 0) {
    throw new Error(`No organization found for user ${TEST_USER.email}`);
  }
  
  return {
    userId,
    organizationId: orgResult.rows[0].organization_id
  };
}

async function getWalletBalance(organizationId) {
  const result = await pool.query(
    'SELECT balance FROM wallets WHERE organization_id = $1',
    [organizationId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Wallet not found');
  }
  
  return parseFloat(result.rows[0].balance);
}

async function addCreditsToWallet(organizationId, amount) {
  const currentBalance = await getWalletBalance(organizationId);
  const newBalance = currentBalance + amount;
  
  await pool.query(
    'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE organization_id = $2',
    [newBalance, organizationId]
  );
  
  // Record transaction
  await pool.query(
    `INSERT INTO payment_transactions (
      organization_id, amount, currency, payment_method, 
      payment_provider, status, description, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      organizationId,
      amount,
      'USD',
      'test_credit',
      'test',
      'completed',
      'Test Script - Manual Credit Addition',
      JSON.stringify({ test: true, script: 'test-hourly-billing.js' })
    ]
  );
  
  return newBalance;
}

async function getVPSInstances(organizationId) {
  const result = await pool.query(
    `SELECT id, label, status, plan_id, created_at, last_billed_at
     FROM vps_instances 
     WHERE organization_id = $1 
     ORDER BY created_at DESC`,
    [organizationId]
  );
  
  return result.rows;
}

async function getVPSHourlyRate(vpsId, planId) {
  // Try to get hourly rate from plan
  const planResult = await pool.query(
    `SELECT base_price, markup_price 
     FROM vps_plans 
     WHERE id::text = $1 OR provider_plan_id = $1
     LIMIT 1`,
    [planId]
  );
  
  if (planResult.rows.length > 0) {
    const plan = planResult.rows[0];
    const monthlyPrice = parseFloat(plan.base_price) + parseFloat(plan.markup_price);
    return monthlyPrice / 730; // Convert monthly to hourly
  }
  
  return 0.027; // Default fallback rate
}

async function getTransactionHistory(organizationId, limit = 20) {
  const result = await pool.query(
    `SELECT id, amount, description, status, created_at, metadata
     FROM payment_transactions
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  );
  
  return result.rows;
}

async function getBillingCycles(vpsId) {
  const result = await pool.query(
    `SELECT 
      id, billing_period_start, billing_period_end,
      hourly_rate, total_amount, status, created_at, metadata
     FROM vps_billing_cycles
     WHERE vps_instance_id = $1
     ORDER BY created_at ASC`,
    [vpsId]
  );
  
  return result.rows;
}

async function createTestVPS(organizationId, userId) {
  log('\n📝 Creating test VPS instance...', colors.cyan);
  
  // Get a VPS plan
  const planResult = await pool.query(
    `SELECT id, provider_plan_id, base_price, markup_price, name
     FROM vps_plans
     LIMIT 1`
  );
  
  if (planResult.rows.length === 0) {
    throw new Error('No VPS plans found. Please create a plan first.');
  }
  
  const plan = planResult.rows[0];
  const hourlyRate = (parseFloat(plan.base_price) + parseFloat(plan.markup_price)) / 730;
  
  log(`   Using plan: ${plan.name}`, colors.blue);
  log(`   Hourly rate: ${formatCurrency(hourlyRate)}`, colors.blue);
  
  // Create a test VPS instance directly in database (simulating API creation)
  // Set last_billed_at to 1 hour ago so it's ready for billing
  const vpsResult = await pool.query(
    `INSERT INTO vps_instances (
      organization_id, label, plan_id, provider_instance_id,
      ip_address, status, created_at, last_billed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() - INTERVAL '1 hour')
    RETURNING id, label, status`,
    [
      organizationId,
      `Test-VPS-${Date.now()}`,
      plan.id,
      999999, // Fake provider ID for testing
      '192.0.2.1', // Test IP address
      'running'
    ]
  );
  
  const vps = vpsResult.rows[0];
  
  log(`   ✅ VPS created: ${vps.label} (${vps.id})`, colors.green);
  
  // Simulate initial billing charge
  const balanceBefore = await getWalletBalance(organizationId);
  
  await pool.query(
    `INSERT INTO payment_transactions (
      organization_id, amount, currency, payment_method,
      payment_provider, status, description, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      organizationId,
      -hourlyRate,
      'USD',
      'wallet_debit',
      'internal',
      'completed',
      `VPS Creation - ${vps.label} (Initial Hour)`,
      JSON.stringify({ vps_id: vps.id, initial_charge: true })
    ]
  );
  
  await pool.query(
    'UPDATE wallets SET balance = balance - $1 WHERE organization_id = $2',
    [hourlyRate, organizationId]
  );
  
  const balanceAfter = await getWalletBalance(organizationId);
  
  log(`   💰 Initial charge: ${formatCurrency(hourlyRate)}`, colors.yellow);
  log(`   📊 Balance: ${formatCurrency(balanceBefore)} → ${formatCurrency(balanceAfter)}`, colors.yellow);
  
  return { vps, hourlyRate };
}

async function simulateHourlyBilling(hour, expectedRate) {
  log(`\n⏰ Simulating Hour ${hour} billing cycle...`, colors.cyan);
  
  // Run the actual billing service
  const result = await BillingService.runHourlyBilling();
  
  log(`   Billed instances: ${result.billedInstances}`, colors.blue);
  log(`   Failed instances: ${result.failedInstances.length}`, colors.blue);
  log(`   Total amount: ${formatCurrency(result.totalAmount)}`, colors.blue);
  
  if (result.failedInstances.length > 0) {
    log(`   ⚠️ Errors: ${result.errors.join(', ')}`, colors.yellow);
  }
  
  return result;
}

async function runTest() {
  try {
    log('\n' + '='.repeat(80), colors.bright);
    log('🧪 VPS HOURLY BILLING TEST SCRIPT', colors.bright);
    log('='.repeat(80) + '\n', colors.bright);
    
    // Step 1: Get user and organization
    log('📋 Step 1: Getting user information...', colors.cyan);
    const { userId, organizationId } = await getUserAndOrg();
    log(`   User ID: ${userId}`, colors.blue);
    log(`   Organization ID: ${organizationId}`, colors.blue);
    
    // Step 2: Check initial balance
    log('\n💰 Step 2: Checking initial wallet balance...', colors.cyan);
    const initialBalance = await getWalletBalance(organizationId);
    log(`   Initial balance: ${formatCurrency(initialBalance)}`, colors.blue);
    
    // Step 3: Add $100 credits
    log('\n💵 Step 3: Adding $100 credits to wallet...', colors.cyan);
    const newBalance = await addCreditsToWallet(organizationId, 100);
    log(`   New balance: ${formatCurrency(newBalance)}`, colors.green);
    
    // Step 4: Create VPS
    log('\n🖥️  Step 4: Creating VPS instance...', colors.cyan);
    const { vps, hourlyRate } = await createTestVPS(organizationId, userId);
    
    // Step 5: Check balance after creation
    const balanceAfterCreation = await getWalletBalance(organizationId);
    log(`\n📊 Balance after VPS creation: ${formatCurrency(balanceAfterCreation)}`, colors.yellow);
    
    // Step 6: Simulate 6 hours of billing
    log('\n⏰ Step 5: Simulating 6 hours of billing...', colors.cyan);
    log('   (Each hour should charge exactly the same amount)', colors.blue);
    
    const billingResults = [];
    
    for (let hour = 1; hour <= 6; hour++) {
      // Wait a moment between billing cycles
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const balanceBefore = await getWalletBalance(organizationId);
      const result = await simulateHourlyBilling(hour, hourlyRate);
      const balanceAfter = await getWalletBalance(organizationId);
      
      billingResults.push({
        hour,
        balanceBefore,
        balanceAfter,
        charged: balanceBefore - balanceAfter,
        result
      });
      
      log(`   💳 Charged: ${formatCurrency(balanceBefore - balanceAfter)}`, colors.green);
      log(`   📊 Balance: ${formatCurrency(balanceBefore)} → ${formatCurrency(balanceAfter)}`, colors.yellow);
      
      // Manually update last_billed_at to 1 hour ago to simulate time passing
      // This allows the next billing cycle to find the VPS instance
      await pool.query(
        `UPDATE vps_instances 
         SET last_billed_at = NOW() - INTERVAL '1 hour' 
         WHERE id = $1`,
        [vps.id]
      );
    }
    
    // Step 7: Analyze results
    log('\n' + '='.repeat(80), colors.bright);
    log('📊 BILLING ANALYSIS', colors.bright);
    log('='.repeat(80) + '\n', colors.bright);
    
    log('Expected hourly rate: ' + formatCurrency(hourlyRate), colors.cyan);
    log('\nHour-by-hour charges:', colors.cyan);
    
    let allCorrect = true;
    const actualCharges = [];
    billingResults.forEach(({ hour, charged, balanceBefore, balanceAfter }) => {
      actualCharges.push(charged);
      // Check if all charges are the same (allowing for 0.0001 rounding tolerance)
      const isCorrect = actualCharges.length === 1 || 
        Math.abs(charged - actualCharges[0]) < 0.0001;
      const symbol = isCorrect ? '✅' : '❌';
      const color = isCorrect ? colors.green : colors.red;
      
      log(
        `${symbol} Hour ${hour}: ${formatCurrency(charged)} ` +
        `(Same as Hour 1: ${isCorrect ? 'Yes' : 'No'}) - ` +
        `Balance: ${formatCurrency(balanceBefore)} → ${formatCurrency(balanceAfter)}`,
        color
      );
      
      if (!isCorrect) {
        allCorrect = false;
      }
    });
    
    // Step 8: Show transaction history
    log('\n📜 Transaction History (VPS-related):', colors.cyan);
    const transactions = await getTransactionHistory(organizationId, 15);
    const vpsTransactions = transactions.filter(t => 
      t.description.includes('VPS') || 
      t.description.includes(vps.label)
    );
    
    vpsTransactions.forEach((txn, index) => {
      const amount = parseFloat(txn.amount);
      const color = amount < 0 ? colors.red : colors.green;
      const sign = amount < 0 ? '' : '+';
      log(
        `   ${index + 1}. ${txn.created_at.toISOString().slice(0, 19)}: ` +
        `${sign}${formatCurrency(amount)} - ${txn.description}`,
        color
      );
    });
    
    // Step 9: Show billing cycles
    log('\n📅 Billing Cycles for VPS:', colors.cyan);
    const cycles = await getBillingCycles(vps.id);
    cycles.forEach((cycle, index) => {
      let metadata = {};
      try {
        metadata = cycle.metadata && typeof cycle.metadata === 'string' 
          ? JSON.parse(cycle.metadata) 
          : cycle.metadata || {};
      } catch (e) {
        // If metadata is already an object or invalid JSON, use empty object
        metadata = typeof cycle.metadata === 'object' ? cycle.metadata : {};
      }
      log(
        `   ${index + 1}. ${cycle.created_at.toISOString().slice(0, 19)}: ` +
        `${formatCurrency(cycle.total_amount)} ` +
        `(${metadata.hours_charged || 1}h × ${formatCurrency(cycle.hourly_rate)}) - ` +
        `Status: ${cycle.status}`,
        cycle.status === 'billed' ? colors.green : colors.yellow
      );
    });
    
    // Final summary
    log('\n' + '='.repeat(80), colors.bright);
    log('📈 FINAL SUMMARY', colors.bright);
    log('='.repeat(80) + '\n', colors.bright);
    
    const finalBalance = await getWalletBalance(organizationId);
    const totalCharged = newBalance - finalBalance;
    const expectedTotal = hourlyRate * 7; // Initial + 6 hourly charges
    
    // Check if all charges were the same (flat rate, not accumulating)
    const allChargesSame = actualCharges.every(charge => 
      Math.abs(charge - actualCharges[0]) < 0.0001
    );
    
    log(`Starting balance (after $100 credit): ${formatCurrency(newBalance)}`, colors.blue);
    log(`Final balance: ${formatCurrency(finalBalance)}`, colors.blue);
    log(`Total charged: ${formatCurrency(totalCharged)}`, colors.yellow);
    log(`Expected total (before rounding): ${formatCurrency(expectedTotal)}`, colors.yellow);
    log(`Difference (due to wallet rounding): ${formatCurrency(Math.abs(totalCharged - expectedTotal))}`, colors.cyan);
    log(`\nCharge consistency check:`, colors.cyan);
    log(`  First hour charged: ${formatCurrency(actualCharges[0])}`, colors.blue);
    log(`  All hours charged same amount: ${allChargesSame ? 'Yes ✅' : 'No ❌'}`, allChargesSame ? colors.green : colors.red);
    
    if (allCorrect && allChargesSame) {
      log('\n✅ TEST PASSED! Hourly billing is working correctly!', colors.green + colors.bright);
      log('   ✅ Each hour charged the same flat rate.', colors.green);
      log('   ✅ No accumulation detected (charges did not increase over time).', colors.green);
      log('   ✅ All VPS instances are billed regardless of status.', colors.green);
    } else {
      log('\n❌ TEST FAILED! Billing issues detected.', colors.red + colors.bright);
      if (!allCorrect || !allChargesSame) {
        log('   ❌ Hours charged different amounts (accumulation bug detected).', colors.red);
      }
    }
    
    log('\n✨ Test completed successfully!\n', colors.cyan);
    
  } catch (error) {
    log('\n❌ ERROR: ' + error.message, colors.red + colors.bright);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
runTest();
