import { query, transaction } from '../../lib/database.js';
import { applicationService } from '../paas/ApplicationService.js';
import { databaseService } from '../paas/DatabaseService.js';
import { planService } from '../paas/PlanService.js';

export interface PaaSBillingRecord {
  id: number;
  user_id: string;
  organization_id: string | null;
  resource_type: 'application' | 'database';
  resource_id: number;
  plan_id: number;
  instance_count: number;
  hourly_rate: number;
  hours_used: number;
  total_cost: number;
  billing_period_start: Date;
  billing_period_end: Date;
  created_at: Date;
}

export class PaaSBillingService {
  /**
   * Calculate hourly charges for all running PaaS resources
   */
  async processHourlyBilling(): Promise<{
    success: boolean;
    processed: number;
    totalCharges: number;
    errors: string[];
  }> {
    console.log('⏰ Processing PaaS hourly billing...');
    
    const errors: string[] = [];
    let processed = 0;
    let totalCharges = 0;
    
    try {
      // Get all running applications
      const applications = await query(
        `SELECT a.*, p.hourly_rate
         FROM paas_applications a
         JOIN paas_plans p ON a.plan_id = p.id
         WHERE a.status = 'running'`
      );
      
      for (const app of applications.rows) {
        try {
          const charge = parseFloat(app.hourly_rate) * app.instance_count;
          
          // Check wallet balance
          const wallet = await query(
            'SELECT balance FROM wallets WHERE user_id = $1',
            [app.user_id]
          );
          
          if (wallet.rows.length === 0 || wallet.rows[0].balance < charge) {
            // Insufficient balance - suspend application
            await this.suspendApplication(app.id, 'Insufficient wallet balance');
            errors.push(`Application ${app.id} suspended due to insufficient balance`);
            continue;
          }
          
          // Deduct from wallet
          await transaction(async (client) => {
            await client.query(
              'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
              [charge, app.user_id]
            );
            
            // Record billing
            await client.query(
              `INSERT INTO paas_billing_records 
               (user_id, organization_id, resource_type, resource_id, plan_id, 
                instance_count, hourly_rate, hours_used, total_cost,
                billing_period_start, billing_period_end)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 
                       NOW() - INTERVAL '1 hour', NOW())`,
              [
                app.user_id,
                app.organization_id,
                'application',
                app.id,
                app.plan_id,
                app.instance_count,
                app.hourly_rate,
                1.0,
                charge
              ]
            );
            
            // Add to invoice
            await client.query(
              `INSERT INTO invoice_items 
               (invoice_id, description, quantity, unit_price, total_price)
               SELECT 
                 i.id,
                 $1,
                 $2,
                 $3,
                 $4
               FROM invoices i
               WHERE i.user_id = $5 
                 AND i.status = 'open'
                 AND DATE_TRUNC('month', i.created_at) = DATE_TRUNC('month', NOW())
               LIMIT 1`,
              [
                `PaaS Application: ${app.name}`,
                1.0,
                charge,
                charge,
                app.user_id
              ]
            );
          });
          
          processed++;
          totalCharges += charge;
        } catch (error: any) {
          errors.push(`Application ${app.id}: ${error.message}`);
        }
      }
      
      // Get all running databases
      const databases = await query(
        `SELECT d.*, p.hourly_rate
         FROM paas_databases d
         JOIN paas_plans p ON d.plan_id = p.id
         WHERE d.status = 'running'`
      );
      
      for (const db of databases.rows) {
        try {
          const charge = parseFloat(db.hourly_rate);
          
          // Check wallet balance
          const wallet = await query(
            'SELECT balance FROM wallets WHERE user_id = $1',
            [db.user_id]
          );
          
          if (wallet.rows.length === 0 || wallet.rows[0].balance < charge) {
            // Insufficient balance - stop database
            await this.suspendDatabase(db.id, 'Insufficient wallet balance');
            errors.push(`Database ${db.id} suspended due to insufficient balance`);
            continue;
          }
          
          // Deduct from wallet
          await transaction(async (client) => {
            await client.query(
              'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
              [charge, db.user_id]
            );
            
            // Record billing
            await client.query(
              `INSERT INTO paas_billing_records 
               (user_id, organization_id, resource_type, resource_id, plan_id, 
                instance_count, hourly_rate, hours_used, total_cost,
                billing_period_start, billing_period_end)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 
                       NOW() - INTERVAL '1 hour', NOW())`,
              [
                db.user_id,
                db.organization_id,
                'database',
                db.id,
                db.plan_id,
                1,
                db.hourly_rate,
                1.0,
                charge
              ]
            );
            
            // Add to invoice
            await client.query(
              `INSERT INTO invoice_items 
               (invoice_id, description, quantity, unit_price, total_price)
               SELECT 
                 i.id,
                 $1,
                 $2,
                 $3,
                 $4
               FROM invoices i
               WHERE i.user_id = $5 
                 AND i.status = 'open'
                 AND DATE_TRUNC('month', i.created_at) = DATE_TRUNC('month', NOW())
               LIMIT 1`,
              [
                `PaaS Database: ${db.name} (${db.db_type})`,
                1.0,
                charge,
                charge,
                db.user_id
              ]
            );
          });
          
          processed++;
          totalCharges += charge;
        } catch (error: any) {
          errors.push(`Database ${db.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Processed ${processed} resources, total charges: $${totalCharges.toFixed(2)}`);
      
      return {
        success: true,
        processed,
        totalCharges,
        errors
      };
    } catch (error: any) {
      console.error('❌ Billing processing failed:', error);
      return {
        success: false,
        processed,
        totalCharges,
        errors: [error.message, ...errors]
      };
    }
  }
  
  /**
   * Suspend an application due to insufficient funds
   */
  async suspendApplication(appId: number, reason: string): Promise<void> {
    console.log(`⏸️  Suspending application ${appId}: ${reason}`);
    
    await applicationService.update(appId, {
      status: 'stopped'
    });
    
    // TODO: Send notification to user
    // TODO: Create task to stop container on agent
  }
  
  /**
   * Suspend a database due to insufficient funds
   */
  async suspendDatabase(dbId: number, reason: string): Promise<void> {
    console.log(`⏸️  Suspending database ${dbId}: ${reason}`);
    
    await databaseService.update(dbId, {
      status: 'stopped'
    });
    
    // TODO: Send notification to user
    // TODO: Create task to stop database container on agent
  }
  
  /**
   * Check if user has sufficient balance for a deployment
   */
  async checkSufficientBalance(userId: string, planId: number, instanceCount = 1): Promise<{
    sufficient: boolean;
    balance: number;
    required: number;
  }> {
    const plan = await planService.getById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    const required = parseFloat(plan.hourly_rate.toString()) * instanceCount;
    
    const wallet = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    const balance = wallet.rows.length > 0 ? parseFloat(wallet.rows[0].balance) : 0;
    
    return {
      sufficient: balance >= required,
      balance,
      required
    };
  }
  
  /**
   * Get billing records for a user
   */
  async getBillingRecords(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<PaaSBillingRecord[]> {
    let sql = `
      SELECT * FROM paas_billing_records
      WHERE user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (startDate) {
      params.push(startDate);
      sql += ` AND billing_period_start >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      sql += ` AND billing_period_end <= $${params.length}`;
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await query(sql, params);
    return result.rows;
  }
  
  /**
   * Get current month spending for a user
   */
  async getCurrentMonthSpending(userId: string): Promise<{
    applications: number;
    databases: number;
    total: number;
  }> {
    const result = await query(
      `SELECT 
         resource_type,
         SUM(total_cost) as total
       FROM paas_billing_records
       WHERE user_id = $1
         AND DATE_TRUNC('month', billing_period_start) = DATE_TRUNC('month', NOW())
       GROUP BY resource_type`,
      [userId]
    );
    
    let applications = 0;
    let databases = 0;
    
    for (const row of result.rows) {
      if (row.resource_type === 'application') {
        applications = parseFloat(row.total);
      } else if (row.resource_type === 'database') {
        databases = parseFloat(row.total);
      }
    }
    
    return {
      applications,
      databases,
      total: applications + databases
    };
  }
  
  /**
   * Get spending by resource
   */
  async getResourceSpending(
    resourceType: 'application' | 'database',
    resourceId: number
  ): Promise<{
    currentMonth: number;
    allTime: number;
  }> {
    const result = await query(
      `SELECT 
         SUM(CASE 
           WHEN DATE_TRUNC('month', billing_period_start) = DATE_TRUNC('month', NOW())
           THEN total_cost ELSE 0
         END) as current_month,
         SUM(total_cost) as all_time
       FROM paas_billing_records
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId]
    );
    
    const row = result.rows[0];
    
    return {
      currentMonth: parseFloat(row.current_month || 0),
      allTime: parseFloat(row.all_time || 0)
    };
  }
}

export const paasBillingService = new PaaSBillingService();
