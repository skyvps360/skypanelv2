#!/usr/bin/env node

/**
 * Manual Container Billing Processing Script
 * 
 * This script can be used to manually process container billing cycles
 * or run as a standalone cron job for container billing automation.
 * 
 * Usage:
 *   node scripts/process-container-billing.js
 *   
 * Environment Variables:
 *   - All standard database and application environment variables
 */

import { ContainerBillingService } from '../api/services/containerBillingService.js';

/**
 * Main function to process container billing
 */
async function main() {
  console.log('🚀 Starting manual container billing processing...');
  console.log(`📅 Current time: ${new Date().toLocaleString()}`);
  
  try {
    // Process all due billing cycles
    const result = await ContainerBillingService.processDueBillingCycles();
    
    // Display results
    console.log('\n📊 Billing Processing Results:');
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Processed Cycles: ${result.processedCycles}`);
    console.log(`   Total Amount Charged: $${result.totalAmount.toFixed(2)}`);
    console.log(`   Failed Cycles: ${result.failedCycles.length}`);
    
    if (result.failedCycles.length > 0) {
      console.log('\n❌ Failed Billing Cycles:');
      result.failedCycles.forEach((cycleId, index) => {
        console.log(`   ${index + 1}. Cycle ID: ${cycleId}`);
        if (result.errors[index]) {
          console.log(`      Error: ${result.errors[index]}`);
        }
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\n🔍 All Errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    // Exit with appropriate code
    if (result.success) {
      console.log('\n✅ Container billing processing completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️ Container billing processing completed with errors');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Critical error during container billing processing:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Handle script execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error in container billing script:');
    console.error(error);
    process.exit(1);
  });
}

export { main };