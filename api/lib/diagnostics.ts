/**
 * Diagnostic utilities for SSH key synchronization debugging
 * Provides tools to test provider connectivity and token status
 */

import { query } from "./database.js";
import { decryptSecret } from "./crypto.js";
import { linodeService } from "../services/linodeService.js";

/**
 * Mask sensitive token for safe logging
 * Shows only first 4 and last 4 characters
 */
export function maskToken(token: string): string {
  if (!token || token.length <= 8) {
    return "****";
  }
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

/**
 * Check provider token status and log details
 * Useful for debugging SSH key synchronization issues
 */
export async function checkProviderTokens(): Promise<{
  linode: { configured: boolean; valid?: boolean; error?: string; tokenPreview?: string };
}> {
  const result: { linode: { configured: boolean; valid?: boolean; error?: string; tokenPreview?: string } } = {
    linode: { configured: false },
  };

  try {
    console.log("🔍 Checking provider token configuration...");

    const dbResult = await query(
      `SELECT type, api_key_encrypted, active 
       FROM service_providers 
       WHERE type = 'linode'`
    );

    console.log(`📊 Found ${dbResult.rows.length} Linode provider(s) in database`);

    for (const row of dbResult.rows) {
      try {
        if (!row.active) {
          result.linode = {
            configured: true,
            valid: false,
            error: "Provider is not active",
          };
          console.log("⚠️ Linode: Provider exists but is not active");
          continue;
        }

        const decrypted = decryptSecret(row.api_key_encrypted);

        if (!decrypted || decrypted.trim().length === 0) {
          result.linode = {
            configured: true,
            valid: false,
            error: "Decrypted token is empty",
          };
          console.log("❌ Linode: Token decrypted but is empty");
          continue;
        }

        const tokenPreview = maskToken(decrypted);

        result.linode = {
          configured: true,
          valid: true,
          tokenPreview,
        };

        console.log(`✅ Linode: Token configured and decrypted successfully (${tokenPreview})`);
      } catch (error: any) {
        result.linode = {
          configured: true,
          valid: false,
          error: error.message,
        };
        console.error("❌ Linode: Failed to decrypt token:", error.message);
      }
    }

    if (!result.linode.configured) {
      console.log("⚠️ Linode: No provider configuration found in database");
    }
  } catch (error: any) {
    console.error("❌ Error checking provider tokens:", error.message);
  }

  return result;
}

/**
 * Test provider API connectivity
 * Makes actual API calls to verify tokens work
 */
export async function testProviderConnectivity(): Promise<{
  linode: { success: boolean; message: string };
}> {
  const result: { linode: { success: boolean; message: string } } = {
    linode: { success: false, message: "Not tested" },
  };

  try {
    console.log("🔍 Testing provider API connectivity...");

    const dbResult = await query(
      `SELECT api_key_encrypted 
       FROM service_providers 
       WHERE active = true AND type = 'linode'`
    );

    for (const row of dbResult.rows) {
      try {
        const token = decryptSecret(row.api_key_encrypted);
        console.log("🚀 Testing Linode API connection...");
        const testResult = await linodeService.testConnection(token);
        result.linode = testResult;

        if (testResult.success) {
          console.log("✅ Linode API: Connection successful");
        } else {
          console.error("❌ Linode API: Connection failed -", testResult.message);
        }
      } catch (error: any) {
        result.linode = {
          success: false,
          message: `Error: ${error.message}`,
        };
        console.error("❌ Linode: Test failed -", error.message);
      }
    }
  } catch (error: any) {
    console.error("❌ Error testing provider connectivity:", error.message);
  }

  return result;
}

/**
 * Run complete diagnostic check
 * Checks token configuration and API connectivity
 */
export async function runDiagnostics(): Promise<void> {
  console.log("\n========================================");
  console.log("🔧 SSH Key Synchronization Diagnostics");
  console.log("========================================\n");

  console.log("Step 1: Checking provider token configuration...\n");
  const tokenStatus = await checkProviderTokens();

  console.log("\n📊 Token Status Summary:");
  console.log(
    "  Linode:",
    tokenStatus.linode.configured
      ? tokenStatus.linode.valid
        ? `✅ Valid (${tokenStatus.linode.tokenPreview})`
        : `❌ Invalid: ${tokenStatus.linode.error}`
      : "⚠️ Not configured"
  );

  console.log("\n\nStep 2: Testing provider API connectivity...\n");
  const connectivity = await testProviderConnectivity();

  console.log("\n📊 Connectivity Status Summary:");
  console.log(
    "  Linode:",
    connectivity.linode.success ? "✅ Connected" : `❌ ${connectivity.linode.message}`
  );

  console.log("\n========================================");
  console.log("✅ Diagnostics Complete");
  console.log("========================================\n");
}
