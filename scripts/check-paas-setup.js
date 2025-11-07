#!/usr/bin/env node

/**
 * SkyPanel PaaS Setup Helper
 * 
 * This script helps verify and set up the PaaS integration
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🚀 SkyPanel PaaS Integration Setup\n');

// Check if migration exists
const migrationPath = join(__dirname, '../migrations/003_paas_integration.sql');
if (existsSync(migrationPath)) {
  console.log('✅ Migration file found: migrations/003_paas_integration.sql');
} else {
  console.log('❌ Migration file NOT found!');
  process.exit(1);
}

// Check service files
const servicePath = join(__dirname, '../api/services/paas');
if (existsSync(servicePath)) {
  console.log('✅ PaaS services directory found');
} else {
  console.log('❌ PaaS services directory NOT found!');
  process.exit(1);
}

// Check routes
const routesPath = join(__dirname, '../api/routes/paas');
if (existsSync(routesPath)) {
  console.log('✅ PaaS routes directory found');
} else {
  console.log('❌ PaaS routes directory NOT found!');
  process.exit(1);
}

// Check frontend pages
const paasPagePath = join(__dirname, '../src/pages/PaaS.tsx');
if (existsSync(paasPagePath)) {
  console.log('✅ PaaS customer page found');
} else {
  console.log('❌ PaaS customer page NOT found!');
}

// Check admin components
const adminComponentsPath = join(__dirname, '../src/components/admin/PaaSPlansModal.tsx');
if (existsSync(adminComponentsPath)) {
  console.log('✅ PaaS admin components found');
} else {
  console.log('❌ PaaS admin components NOT found!');
}

console.log('\n📋 Next Steps:\n');
console.log('1. Run the migration:');
console.log('   psql -U your_user -d your_database -f migrations/003_paas_integration.sql\n');
console.log('2. Set environment variables in .env:');
console.log('   PAAS_PLATFORM_DOMAIN=apps.yourdomain.com');
console.log('   CONTROL_PLANE_URL=https://panel.yourdomain.com');
console.log('   SSH_CRED_SECRET=your-32-char-secret\n');
console.log('3. Start the server:');
console.log('   npm run dev\n');
console.log('4. Wire admin components into Admin dashboard');
console.log('5. Add /paas link to main navigation\n');
console.log('6. Build and deploy the PaaS Agent (see agent/README.md)\n');

console.log('📚 Documentation:');
console.log('   - Quick Start: .kiro/specs/paas-integration/QUICKSTART.md');
console.log('   - Progress: .kiro/specs/paas-integration/IMPLEMENTATION_PROGRESS.md');
console.log('   - Summary: .kiro/specs/paas-integration/IMPLEMENTATION_SUMMARY.md\n');

console.log('✨ PaaS Integration setup check complete!\n');
