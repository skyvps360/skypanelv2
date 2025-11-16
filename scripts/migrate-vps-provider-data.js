#!/usr/bin/env node

/**
 * VPS Provider Data Migration Script
 * This script migrates existing VPS instances to use provider_id references
 * and ensures data integrity for multi-provider support
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

async function migrateProviderData() {
  console.log('🚀 Starting VPS Provider Data Migration...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Check current state
    console.log('📊 Analyzing current VPS instances...');
    const statsResult = await client.query(`
      SELECT 
        provider_type,
        COUNT(*) as count,
        COUNT(provider_id) as with_provider_id,
        COUNT(*) - COUNT(provider_id) as without_provider_id
      FROM vps_instances
      GROUP BY provider_type
      ORDER BY provider_type NULLS FIRST
    `);

    console.log('\nCurrent state:');
    statsResult.rows.forEach(row => {
      const providerType = row.provider_type || 'NULL (legacy)';
      console.log(`  ${providerType}:`);
      console.log(`    Total: ${row.count}`);
      console.log(`    With provider_id: ${row.with_provider_id}`);
      console.log(`    Without provider_id: ${row.without_provider_id}`);
    });

    // Step 2: Get provider IDs
    console.log('\n🔍 Fetching service providers...');
    const providersResult = await client.query(`
      SELECT id, name, type, active
      FROM service_providers
      ORDER BY type
    `);

    if (providersResult.rows.length === 0) {
      console.warn('⚠️  No service providers found in database!');
      console.log('Please configure at least one provider before running this migration.');
      await client.query('ROLLBACK');
      client.release();
      process.exit(1);
    }

    console.log('\nAvailable providers:');
    const providerMap = {};
    providersResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type}): ${row.active ? 'Active' : 'Inactive'}`);
      providerMap[row.type] = row.id;
    });

    // Step 3: Migrate instances with provider_type='linode'
    if (providerMap.linode) {
      console.log('\n🔄 Migrating Linode instances...');
      const linodeResult = await client.query(`
        UPDATE vps_instances
        SET provider_id = $1
        WHERE provider_type = 'linode' AND provider_id IS NULL
        RETURNING id, label
      `, [providerMap.linode]);

      console.log(`✅ Updated ${linodeResult.rowCount} Linode instances with provider_id`);
      if (linodeResult.rowCount > 0 && linodeResult.rowCount <= 5) {
        linodeResult.rows.forEach(row => {
          console.log(`   - ${row.label} (${row.id})`);
        });
      }
    }

    // Step 4: Handle legacy instances (NULL provider_type)
    if (providerMap.linode) {
      console.log('\n🔄 Migrating legacy instances (assuming Linode)...');
      const legacyResult = await client.query(`
        UPDATE vps_instances
        SET 
          provider_id = $1,
          provider_type = 'linode'
        WHERE provider_type IS NULL AND provider_id IS NULL
        RETURNING id, label
      `, [providerMap.linode]);

      console.log(`✅ Updated ${legacyResult.rowCount} legacy instances`);
      if (legacyResult.rowCount > 0 && legacyResult.rowCount <= 5) {
        legacyResult.rows.forEach(row => {
          console.log(`   - ${row.label} (${row.id})`);
        });
      }
    }

    // Step 5: Verify data integrity
    console.log('\n🔍 Verifying data integrity...');
    
    // Check for orphaned instances (provider_type set but provider doesn't exist)
    const orphanedResult = await client.query(`
      SELECT vi.id, vi.label, vi.provider_type
      FROM vps_instances vi
      LEFT JOIN service_providers sp ON vi.provider_id = sp.id
      WHERE vi.provider_id IS NOT NULL AND sp.id IS NULL
    `);

    if (orphanedResult.rowCount > 0) {
      console.warn(`⚠️  Found ${orphanedResult.rowCount} orphaned instances (provider_id references non-existent provider):`);
      orphanedResult.rows.forEach(row => {
        console.log(`   - ${row.label} (${row.id}): provider_type=${row.provider_type}`);
      });
    }

    // Check for instances without provider_id
    const missingProviderResult = await client.query(`
      SELECT id, label, provider_type
      FROM vps_instances
      WHERE provider_id IS NULL
    `);

    if (missingProviderResult.rowCount > 0) {
      console.warn(`⚠️  Found ${missingProviderResult.rowCount} instances without provider_id:`);
      missingProviderResult.rows.forEach(row => {
        console.log(`   - ${row.label} (${row.id}): provider_type=${row.provider_type || 'NULL'}`);
      });
    }

    // Step 6: Final statistics
    console.log('\n📊 Final statistics:');
    const finalStatsResult = await client.query(`
      SELECT 
        COALESCE(sp.name, 'Unknown') as provider_name,
        vi.provider_type,
        COUNT(*) as count
      FROM vps_instances vi
      LEFT JOIN service_providers sp ON vi.provider_id = sp.id
      GROUP BY sp.name, vi.provider_type
      ORDER BY provider_name, vi.provider_type
    `);

    finalStatsResult.rows.forEach(row => {
      console.log(`  ${row.provider_name} (${row.provider_type || 'NULL'}): ${row.count} instances`);
    });

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');

    client.release();
    console.log('\n🎉 VPS Provider Data Migration completed!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateProviderData().catch(console.error);
