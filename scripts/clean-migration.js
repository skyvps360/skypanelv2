#!/usr/bin/env node

/**
 * Clean Migration Runner for SkyPanelV2 PostgreSQL
 * This script drops existing tables and runs a fresh migration
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "..", ".env") });

const { Pool } = pg;

async function cleanMigration() {
    console.log("🧹 Starting Clean SkyPanelV2 PostgreSQL Migration...\n");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL environment variable is not set!");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        // Test connection
        console.log("🔌 Testing database connection...");
        const client = await pool.connect();
        console.log("✅ Database connection successful!");

        // Drop existing tables in reverse order to handle foreign keys
        console.log("🗑️  Dropping existing tables...");
        await client.query(`
      DROP TABLE IF EXISTS payment_transactions CASCADE;
      DROP TABLE IF EXISTS support_ticket_replies CASCADE;
      DROP TABLE IF EXISTS support_tickets CASCADE;
      DROP TABLE IF EXISTS vps_instances CASCADE;
      DROP TABLE IF EXISTS vps_plans CASCADE;
      DROP TABLE IF EXISTS user_api_keys CASCADE;
      DROP TABLE IF EXISTS wallets CASCADE;
      DROP TABLE IF EXISTS organization_members CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `);
        console.log("✅ Existing tables dropped successfully!");

        // Read and run migration
        const migrationPath = join(
            __dirname,
            "..",
            "migrations",
            "001_initial_schema.sql",
        );
        console.log("📄 Reading migration file...");
        const migrationSQL = readFileSync(migrationPath, "utf8");

        console.log("🚀 Running fresh migration...");
        await client.query(migrationSQL);
        console.log("✅ Migration completed successfully!");

        // Verify tables were created
        console.log("🔍 Verifying table creation...");
        const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log("📋 Created tables:");
        result.rows.forEach((row) => {
            console.log(`  - ${row.table_name}`);
        });

        // Verify admin user
        const adminCheck = await client.query(
            "SELECT email, role FROM users WHERE role = $1",
            ["admin"],
        );
        if (adminCheck.rows.length > 0) {
            console.log("👤 Admin user created successfully:");
            console.log(`  Email: ${adminCheck.rows[0].email}`);
            console.log(`  Role: ${adminCheck.rows[0].role}`);
        }

        client.release();
        await pool.end();

        console.log("\n🎉 Clean migration completed successfully!");
        console.log("\n📝 Next steps:");
        console.log("1. Start the application: npm run dev");
        console.log("2. Login with admin credentials:");
        console.log("   Email: admin@skypanelv2.com");
        console.log("   Password: admin123");
    } catch (error) {
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    }
}

cleanMigration().catch(console.error);
