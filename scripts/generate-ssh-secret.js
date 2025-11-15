#!/usr/bin/env node
/**
 * Generate SSH_CRED_SECRET and add it to .env file
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');

// Generate a secure random key
const secret = crypto.randomBytes(32).toString('hex');

console.log('🔑 Generated SSH_CRED_SECRET:', secret);

try {
  // Check if .env exists
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('   Creating .env file...');
    fs.writeFileSync(envPath, `SSH_CRED_SECRET=${secret}\n`);
    console.log('✅ Created .env with SSH_CRED_SECRET');
    process.exit(0);
  }

  // Read existing .env
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Check if SSH_CRED_SECRET already exists
  if (envContent.includes('SSH_CRED_SECRET=')) {
    console.log('⚠️  SSH_CRED_SECRET already exists in .env');
    console.log('   Do you want to replace it? (This will require re-saving provider tokens)');
    console.log('   To replace, manually edit .env or delete the existing SSH_CRED_SECRET line and run this script again.');
    process.exit(0);
  }

  // Add SSH_CRED_SECRET to .env
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `\n# Encryption Key for Provider API Tokens\nSSH_CRED_SECRET=${secret}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Added SSH_CRED_SECRET to .env file');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your dev server');
  console.log('   2. Go to /admin#providers');
  console.log('   3. Re-save your Linode API tokens');
  console.log('   4. SSH keys will now sync to providers!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
