/**
 * Seed script for PaaS default plans and runtimes
 * Run with: node --import tsx scripts/seed-paas-defaults.js
 */

import { query } from '../api/lib/database.js';

async function seedPaaSDefaults() {
  console.log('Seeding PaaS default plans and runtimes...');

  try {
    // Seed default runtimes
    console.log('Seeding runtimes...');
    
    const runtimes = [
      {
        name: 'Node.js 20',
        runtime_type: 'node',
        version: '20',
        base_image: 'node:20-alpine',
        default_build_cmd: 'npm install && npm run build',
        default_start_cmd: 'npm start'
      },
      {
        name: 'Node.js 18',
        runtime_type: 'node',
        version: '18',
        base_image: 'node:18-alpine',
        default_build_cmd: 'npm install && npm run build',
        default_start_cmd: 'npm start'
      },
      {
        name: 'Python 3.11',
        runtime_type: 'python',
        version: '3.11',
        base_image: 'python:3.11-slim',
        default_build_cmd: 'pip install -r requirements.txt',
        default_start_cmd: 'gunicorn app:app'
      },
      {
        name: 'Python 3.10',
        runtime_type: 'python',
        version: '3.10',
        base_image: 'python:3.10-slim',
        default_build_cmd: 'pip install -r requirements.txt',
        default_start_cmd: 'gunicorn app:app'
      },
      {
        name: 'PHP 8.2',
        runtime_type: 'php',
        version: '8.2',
        base_image: 'php:8.2-fpm-alpine',
        default_build_cmd: 'composer install',
        default_start_cmd: 'php-fpm'
      }
    ];

    for (const runtime of runtimes) {
      // Check if runtime already exists
      const existing = await query(
        'SELECT id FROM paas_runtimes WHERE runtime_type = $1 AND version = $2',
        [runtime.runtime_type, runtime.version]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO paas_runtimes 
           (name, runtime_type, version, base_image, default_build_cmd, default_start_cmd, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [
            runtime.name,
            runtime.runtime_type,
            runtime.version,
            runtime.base_image,
            runtime.default_build_cmd,
            runtime.default_start_cmd
          ]
        );
        console.log(`  ✓ Created runtime: ${runtime.name}`);
      } else {
        console.log(`  - Runtime already exists: ${runtime.name}`);
      }
    }

    // Get all runtime IDs for plan associations
    const allRuntimesResult = await query('SELECT id FROM paas_runtimes');
    const allRuntimeIds = allRuntimesResult.rows.map((r: any) => r.id);

    // Seed default plans
    console.log('\nSeeding plans...');
    
    const plans = [
      {
        name: 'Starter',
        cpu_limit: 500,      // 0.5 CPU cores
        memory_limit: 512,    // 512 MB
        storage_limit: 5120,  // 5 GB
        monthly_price: 5.00,
        hourly_rate: 0.0069,  // ~$5/month
        supported_runtimes: allRuntimeIds
      },
      {
        name: 'Basic',
        cpu_limit: 1000,     // 1 CPU core
        memory_limit: 1024,   // 1 GB
        storage_limit: 10240, // 10 GB
        monthly_price: 10.00,
        hourly_rate: 0.0139,  // ~$10/month
        supported_runtimes: allRuntimeIds
      },
      {
        name: 'Professional',
        cpu_limit: 2000,      // 2 CPU cores
        memory_limit: 2048,    // 2 GB
        storage_limit: 20480,  // 20 GB
        monthly_price: 20.00,
        hourly_rate: 0.0278,   // ~$20/month
        supported_runtimes: allRuntimeIds
      },
      {
        name: 'Business',
        cpu_limit: 4000,      // 4 CPU cores
        memory_limit: 4096,    // 4 GB
        storage_limit: 40960,  // 40 GB
        monthly_price: 40.00,
        hourly_rate: 0.0556,   // ~$40/month
        supported_runtimes: allRuntimeIds
      },
      {
        name: 'Enterprise',
        cpu_limit: 8000,      // 8 CPU cores
        memory_limit: 8192,    // 8 GB
        storage_limit: 81920,  // 80 GB
        monthly_price: 80.00,
        hourly_rate: 0.1111,   // ~$80/month
        supported_runtimes: allRuntimeIds
      }
    ];

    for (const plan of plans) {
      // Check if plan already exists
      const existing = await query(
        'SELECT id FROM paas_plans WHERE name = $1',
        [plan.name]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO paas_plans 
           (name, cpu_limit, memory_limit, storage_limit, monthly_price, hourly_rate, supported_runtimes, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [
            plan.name,
            plan.cpu_limit,
            plan.memory_limit,
            plan.storage_limit,
            plan.monthly_price,
            plan.hourly_rate,
            JSON.stringify(plan.supported_runtimes)
          ]
        );
        console.log(`  ✓ Created plan: ${plan.name} ($${plan.monthly_price}/month)`);
      } else {
        console.log(`  - Plan already exists: ${plan.name}`);
      }
    }

    console.log('\n✅ PaaS default data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding PaaS defaults:', error);
    process.exit(1);
  }
}

seedPaaSDefaults();
