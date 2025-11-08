/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { BillingService } from "./services/billingService.js";
import { BuildService } from "./services/buildService.js";
import { WorkerNodeService } from "./services/workerNodeService.js";

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

  // Schedule PaaS maintenance tasks (every 5 minutes)
  setInterval(async () => {
    await runPaaSMaintenance();
  }, 5 * 60 * 1000); // Run every 5 minutes (300000 ms)
}

/**
 * Run hourly billing for all active VPS and PaaS instances
 */
async function runHourlyBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🔄 Starting ${runType} hourly billing process...`);

    // Run VPS billing
    console.log(`📊 Running VPS billing...`);
    const vpsResult = await BillingService.runHourlyBilling();
    console.log(
      `✅ VPS billing completed: ${
        vpsResult.billedInstances
      } instances billed, $${vpsResult.totalAmount.toFixed(2)} total`
    );

    // Run PaaS billing
    console.log(`🚀 Running PaaS billing...`);
    const paasResult = await BillingService.runPaaSHourlyBilling();
    console.log(
      `✅ PaaS billing completed: ${
        paasResult.billedApps
      } apps billed, $${paasResult.totalAmount.toFixed(2)} total`
    );

    const totalBilled = vpsResult.totalAmount + paasResult.totalAmount;
    const totalInstances = vpsResult.billedInstances + paasResult.billedApps;
    const allErrors = [...vpsResult.errors, ...paasResult.errors];
    const allFailedInstances = [...vpsResult.failedInstances, ...paasResult.failedApps];

    console.log(
      `🏁 Combined billing completed: ${totalInstances} services billed, $${totalBilled.toFixed(2)} total`
    );

    if (allErrors.length > 0) {
      console.warn(
        `⚠️ ${allErrors.length} services failed billing:`,
        allErrors
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} billing:`, error);
  }
}

/**
 * Run PaaS maintenance tasks
 */
async function runPaaSMaintenance() {
  try {
    // Process queued builds
    await BuildService.processQueuedBuilds();

    // Mark offline worker nodes (after 5 minutes of no heartbeat)
    await WorkerNodeService.markOfflineNodes(5);

  } catch (error) {
    console.error('❌ Error in PaaS maintenance:', error);
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
