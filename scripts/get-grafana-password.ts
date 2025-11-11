#!/usr/bin/env tsx

import { PaasSettingsService } from '../api/services/paas/settingsService.js';

async function main(): Promise<void> {
  await PaasSettingsService.initializeDefaults();

  const [userRaw, passwordRaw] = await Promise.all([
    PaasSettingsService.get('grafana_admin_user'),
    PaasSettingsService.get('grafana_admin_password'),
  ]);

  const username = (userRaw as string) || 'admin';
  const password = (passwordRaw as string) || '';

  if (!password) {
    throw new Error('Grafana admin password has not been set. Run npm run paas:init first.');
  }

  console.log('Grafana admin credentials:');
  console.log(`  • Username : ${username}`);
  console.log(`  • Password : ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to fetch Grafana credentials:');
    console.error(error?.message || error);
    process.exit(1);
  });
