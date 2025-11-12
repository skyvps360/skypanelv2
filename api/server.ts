/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { BillingService } from "./services/billingService.js";
import { ContainerBillingService } from "./services/containers/ContainerBillingService.js";
import { config } from "./config/index.js";
import { startQuotaRecalculationJob, stopQuotaRecalculationJob } from "./jobs/quotaRecalculation.js";

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

  // Start quota recalculation job (every 30 seconds)
  startQuotaRecalculationJob();
});

/**
 * Start the hourly billing scheduler
 */
function startBillingScheduler() {
  console.log("🕐 Starting hourly billing scheduler...");

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
 * Run hourly billing for all active VPS instances and container services
 */
async function runHourlyBilling(runType: "initial" | "scheduled") {
  try {
    // Run VPS billing
    console.log(`🔄 Starting ${runType} hourly VPS billing process...`);
    const vpsResult = await BillingService.runHourlyBilling();
    console.log(
      `✅ VPS Billing completed: ${
        vpsResult.billedInstances
      } instances billed, ${vpsResult.totalAmount.toFixed(2)} total`
    );

    if (vpsResult.failedInstances.length > 0) {
      console.warn(
        `⚠️ ${vpsResult.failedInstances.length} VPS instances failed billing:`,
        vpsResult.errors
      );
    }

    // Run container billing if enabled
    const containerBillingEnabled = config.CONTAINER_BILLING_ENABLED !== 'false';
    if (containerBillingEnabled) {
      console.log(`🔄 Starting ${runType} hourly container billing process...`);
      const containerResult = await ContainerBillingService.runHourlyContainerBilling();
      console.log(
        `✅ Container Billing completed: ${
          containerResult.billedServices
        } services billed, ${containerResult.totalAmount.toFixed(2)} total`
      );

      if (containerResult.failedServices.length > 0) {
        console.warn(
          `⚠️ ${containerResult.failedServices.length} container services failed billing:`,
          containerResult.errors
        );
      }
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} billing:`, error);
  }
}

/**
 * close server
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  stopQuotaRecalculationJob();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  stopQuotaRecalculationJob();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
