#!/usr/bin/env node
/**
 * Fix Provider API Token Encryption
 * 
 * This script re-encrypts provider API tokens with the correct SSH_CRED_SECRET.
 * Run this after setting SSH_CRED_SECRET in your .env file.
 */

import 'dotenv/config';
import pg from 'pg';
import { encryptSecret } from '../api/lib/crypto.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixProviderEncryption() {
  console.log('🔧 Fixing provider API token encryption...\n');

  try {
    // Check if SSH_CRED_SECRET is set
    if (!process.env.SSH_CRED_SECRET || process.env.SSH_CRED_SECRET.length < 16) {
      console.error('❌ SSH_CRED_SECRET is not set or too short in .env file!');
      console.error('   Please add: SSH_CRED_SECRET=your-strong-32-character-secret-key-here');
      process.exit(1);
    }

    console.log('✅ SSH_CRED_SECRET is configured\n');

    // Get all providers
    const result = await pool.query(
      'SELECT id, name, type, api_key_encrypted FROM service_providers WHERE active = true'
    );

    if (result.rows.length === 0) {
      console.log('⚠️  No active providers found in database');
      console.log('   Please configure providers in /admin#providers first');
      process.exit(0);
    }

    console.log(`Found ${result.rows.length} provider(s):\n`);

    for (const provider of result.rows) {
      console.log(`📦 ${provider.name} (${provider.type})`);

      if (provider.type !== 'linode') {
        console.log('   ⚠️  Unsupported provider type for this script - skipping');
        continue;
      }

      console.log(`   Using LINODE_API_TOKEN from environment...`);
      const envVar = 'LINODE_API_TOKEN';
      const token = process.env[envVar];

      if (!token) {
        console.log(`   ⚠️  ${envVar} not found in .env - skipping`);
        continue;
      }

      // Re-encrypt the token
      const encrypted = encryptSecret(token);

      // Update in database
      await pool.query(
        'UPDATE service_providers SET api_key_encrypted = $1 WHERE id = $2',
        [encrypted, provider.id]
      );

      console.log(`   ✅ Re-encrypted and updated\n`);
    }

    console.log('✨ All provider tokens have been re-encrypted successfully!');
    console.log('   You can now add SSH keys and they will sync to providers.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixProviderEncryption();
