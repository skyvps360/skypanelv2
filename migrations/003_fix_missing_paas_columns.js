/**
 * Fix Missing PaaS Columns Migration
 *
 * This script adds missing columns to the paas_apps table that were
 * not created due to the IF NOT EXISTS clause in the main migration.
 *
 * Run this with: node migrations/003_fix_missing_paas_columns.js
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple query function
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function fixMissingPaaSColumns() {
  console.log('🔧 Fixing missing PaaS columns in paas_apps table...');

  try {
    // Check if paas_apps table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'paas_apps'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      console.error('❌ paas_apps table does not exist. Please run the main migration first.');
      process.exit(1);
    }

    console.log('✅ paas_apps table exists');

    // Get current columns
    const currentColumns = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'paas_apps'
      ORDER BY ordinal_position
    `);

    const existingColumns = currentColumns.rows.map(row => row.column_name);
    console.log('📋 Current columns:', existingColumns.join(', '));

    // Columns that should be in paas_apps table (from migration 003)
    const requiredColumns = [
      { name: 'last_billed_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'last_deployed_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'last_built_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'assigned_worker_id', type: 'UUID REFERENCES paas_worker_nodes(id) ON DELETE SET NULL' },
      { name: 'resource_usage', type: 'JSONB DEFAULT \'{"cpu": 0, "memory": 0, "storage": 0}\'::jsonb' },
      { name: 'health_check_url', type: 'VARCHAR(1000)' },
      { name: 'health_check_interval', type: 'INTEGER DEFAULT 60' },
      { name: 'custom_domains', type: 'JSONB DEFAULT \'[]\'::jsonb' },
      { name: 'metadata', type: 'JSONB DEFAULT \'{}\'' }
    ];

    // Add missing columns
    let addedCount = 0;
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);

        let alterSQL = `ALTER TABLE paas_apps ADD COLUMN ${column.name} ${column.type}`;

        await query(alterSQL);
        console.log(`✅ Added column: ${column.name}`);
        addedCount++;
      } else {
        console.log(`⚡ Column already exists: ${column.name}`);
      }
    }

    // Also check if paas_addon_subscriptions table needs last_billed_at column
    const addonTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'paas_addon_subscriptions'
      ) as exists
    `);

    if (addonTableExists.rows[0].exists) {
      const addonColumns = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'paas_addon_subscriptions'
      `);

      const existingAddonColumns = addonColumns.rows.map(row => row.column_name);

      if (!existingAddonColumns.includes('last_billed_at')) {
        console.log('➕ Adding last_billed_at column to paas_addon_subscriptions table');
        await query(`
          ALTER TABLE paas_addon_subscriptions
          ADD COLUMN last_billed_at TIMESTAMP WITH TIME ZONE
        `);
        console.log('✅ Added last_billed_at column to paas_addon_subscriptions');
        addedCount++;
      }
    }

    console.log(`\n🎉 Migration completed successfully! Added ${addedCount} missing columns.`);

    // Verify the critical last_billed_at column exists
    const verifyResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'paas_apps' AND column_name = 'last_billed_at'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful: last_billed_at column exists in paas_apps table');
    } else {
      console.log('❌ Verification failed: last_billed_at column still missing');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the migration
fixMissingPaaSColumns()
  .then(() => {
    console.log('🏁 Fix migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });