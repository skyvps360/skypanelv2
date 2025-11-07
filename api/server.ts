/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { initPaasAgentWs } from "./services/paas/AgentWs.js";
import { PaasBillingService } from "./services/paas/BillingService.js";
import { PaasBackupService } from "./services/paas/BackupService.js";
import { BillingService } from "./services/billingService.js";

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  // Initialize websocket SSH bridge on same HTTP server
  initSSHBridge(server);
  initPaasAgentWs(server);

  // Start hourly billing scheduler
  startBillingScheduler();
  startBackupScheduler();
});

/**
 * Start the hourly billing scheduler
 */
function startBillingScheduler() {
  console.log("🕐 Starting hourly VPS billing scheduler...");

  // Run billing immediately on startup (for any missed billing)
  setTimeout(async () => {
    await runHourlyBilling("initial");
    await runHourlyPaasBilling("initial");
  }, 5000); // Wait 5 seconds after server start

  // Schedule hourly billing (every hour)
  setInterval(async () => {
    await runHourlyBilling("scheduled");
    await runHourlyPaasBilling("scheduled");
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

function startBackupScheduler() {
  console.log("🗄️  Starting PaaS backup scheduler...");
  setInterval(async () => {
    try {
      await PaasBackupService.tickScheduler();
    } catch (err) {
      console.error("❌ Error running PaaS backup scheduler:", err);
    }
  }, 5 * 60 * 1000);
}

async function runHourlyPaasBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🔄 Starting ${runType} hourly PaaS billing process...`);
    const result = await PaasBillingService.runHourlyBilling();
    console.log(`✅ PaaS billing completed: ${result.billedResources} resources billed, $${result.totalAmount.toFixed(2)} total`);
    if (result.errors.length) {
      console.warn(`⚠️ PaaS billing had ${result.errors.length} issues`, result.errors);
    }
  } catch (err) {
    console.error(`❌ Error in ${runType} PaaS billing:`, err);
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
