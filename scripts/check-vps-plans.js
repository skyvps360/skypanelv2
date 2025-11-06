import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function checkVPSPlans() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔍 Checking VPS plans...');
    
    const result = await pool.query('SELECT * FROM vps_plans LIMIT 10');
    
    if (result.rows.length === 0) {
      console.log('❌ No VPS plans found in database');
      console.log('💡 You need to create VPS plans first');
    } else {
      console.log(`✅ Found ${result.rows.length} VPS plans:`);
      result.rows.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.name} - $${plan.base_price} + $${plan.markup_price} (${plan.provider})`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkVPSPlans();