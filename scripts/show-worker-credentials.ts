#!/usr/bin/env tsx
import { query } from '../api/lib/database.js';

async function main() {
  try {
    const result = await query(`
      SELECT id,
             encode(decode(auth_token_encrypted, 'base64'), 'escape') AS auth_token,
             name,
             hostname,
             ip_address,
             last_heartbeat,
             updated_at
      FROM paas_worker_nodes
      ORDER BY updated_at DESC
      LIMIT 5;
    `);

    if (result.rows.length === 0) {
      console.log('No worker nodes found.');
      return;
    }

    console.log('Latest worker nodes (most recent first):\n');
    for (const row of result.rows) {
      console.log(`Node Name   : ${row.name}`);
      console.log(`Node ID     : ${row.id}`);
      console.log(`Auth Token  : ${row.auth_token}`);
      console.log(`Hostname    : ${row.hostname}`);
      console.log(`IP Address  : ${row.ip_address}`);
      console.log(`Last Beat   : ${row.last_heartbeat}`);
      console.log(`Updated At  : ${row.updated_at}`);
      console.log('---');
    }
  } catch (error) {
    console.error('Failed to fetch worker credentials:', error);
    process.exit(1);
  }
}

main();
