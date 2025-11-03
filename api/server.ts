/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { BillingService } from "./services/billingService.js";
import { ContainerBillingService } from "./services/containerBillingService.js";

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  // Initialize websocket SSH bridge on same HTTP server
  initSSHBridge(server);

  // Start hourly billing scheduler
  startBillingScheduler();
  
  // Start daily container billing scheduler
  startContainerBillingScheduler();
});

/**
 * Start the hourly billing scheduler
 */
function startBillingScheduler() {
  console.log("🕐 Starting hourly VPS billing scheduler...");

  // Run billing immediately on startup (for any missed billing)
  setTimeout(async () => {
    await runHourlyBilling("initial");
  }, 5000); // Wait 5 seconds after server start

  // Schedule hourly billing (every hour)
  setInterval(async () => {
    await runHourlyBilling("scheduled");
  }, 60 * 60 * 1000); // Run every hour (3600000 ms)
}

/**
 * Run hourly billing for all active VPS instances
 */
async function runHourlyBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🔄 Starting ${runType} hourly VPS billing process...`);
    const result = await BillingService.runHourlyBilling();
    console.log(
      `✅ Billing completed: ${
        result.billedInstances
      } instances billed, $${result.totalAmount.toFixed(2)} total`
    );

    if (result.failedInstances.length > 0) {
      console.warn(
        `⚠️ ${result.failedInstances.length} instances failed billing:`,
        result.errors
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} billing:`, error);
  }
}

/**
 * Start the daily container billing scheduler
 */
function startContainerBillingScheduler() {
  console.log("📅 Starting daily container billing scheduler...");

  // Run container billing immediately on startup (for any missed billing)
  setTimeout(async () => {
    await runDailyContainerBilling("initial");
  }, 10000); // Wait 10 seconds after server start

  // Schedule daily container billing (every 24 hours at 2 AM)
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(2, 0, 0, 0); // Set to 2:00 AM

  // If it's already past 2 AM today, schedule for tomorrow
  if (now > scheduledTime) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const timeUntilFirstRun = scheduledTime.getTime() - now.getTime();
  
  console.log(`📅 Next container billing scheduled for: ${scheduledTime.toLocaleString()}`);

  // Schedule the first run
  setTimeout(() => {
    runDailyContainerBilling("scheduled");
    
    // Then schedule it to run every 24 hours
    setInterval(async () => {
      await runDailyContainerBilling("scheduled");
    }, 24 * 60 * 60 * 1000); // Run every 24 hours (86400000 ms)
    
  }, timeUntilFirstRun);
}

/**
 * Run daily container billing for all due billing cycles
 */
async function runDailyContainerBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🔄 Starting ${runType} daily container billing process...`);
    const result = await ContainerBillingService.processDueBillingCycles();
    
    if (result.success) {
      console.log(
        `✅ Container billing completed: ${result.processedCycles} cycles processed, ${result.totalAmount.toFixed(2)} total charged`
      );
    } else {
      console.warn(
        `⚠️ Container billing completed with errors: ${result.processedCycles} cycles processed, ${result.failedCycles.length} failed`
      );
    }

    if (result.failedCycles.length > 0) {
      console.warn(
        `❌ Failed container billing cycles:`,
        result.failedCycles,
        result.errors
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} container billing:`, error);
  }
}

/**
 * close server
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
