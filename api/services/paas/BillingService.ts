import { query, transaction } from '../../lib/database.js'
import { PayPalService } from '../paypalService.js'
import { PaasAlertService } from './AlertService.js'

const MS_PER_HOUR = 60 * 60 * 1000

export interface PaasBillingResult {
  success: boolean
  billedResources: number
  totalAmount: number
  totalHours: number
  errors: string[]
}

export const PaasBillingService = {
  async runHourlyBilling(): Promise<PaasBillingResult> {
    const result: PaasBillingResult = { success: true, billedResources: 0, totalAmount: 0, totalHours: 0, errors: [] }
    // Applications in running state with plan
    const appsRes = await query(`
      SELECT a.*, p.price_hourly, COALESCE(a.instance_count,1) AS instances
      FROM paas_applications a
      JOIN paas_plans p ON p.id = a.plan_id
      WHERE a.plan_id IS NOT NULL AND a.status IN ('running','suspended')
    `)
    const dbRes = await query(`
      SELECT d.*, p.price_hourly
      FROM paas_databases d
      LEFT JOIN paas_plans p ON p.id = d.plan_id
      WHERE d.status IN ('running','suspended')
    `)

    const resources = [
      ...appsRes.rows.map((app) => ({
        kind: 'application' as const,
        data: app,
        rate: parseFloat(app.price_hourly),
        instances: parseInt(app.instances),
      })),
      ...dbRes.rows.map((db) => ({
        kind: 'database' as const,
        data: db,
        rate: parseFloat(db.price_hourly ?? 0.0125), // fallback rate
        instances: 1,
      })),
    ]

    for (const resource of resources) {
      try {
        const billed = await this.billResourceHourly({
          organizationId: resource.data.organization_id,
          resourceType: resource.kind,
          resourceId: resource.data.id,
          planId: resource.data.plan_id,
          hourlyRate: resource.rate,
          instanceCount: resource.instances,
          createdAt: new Date(resource.data.created_at),
        })
        if (billed.resumed) {
          await this.resumeResource(resource.kind, resource.data.id)
        }
        if (billed.suspended) {
          await this.suspendResource(resource.kind, resource.data.id)
        }
        result.billedResources += billed.units
        result.totalAmount += billed.amount
        result.totalHours += billed.hours
      } catch (err: any) {
        result.success = false
        result.errors.push(`${resource.kind} ${resource.data.id}: ${err?.message || 'unknown error'}`)
      }
    }
    return result
  },

  async billResourceHourly(input: {
    organizationId: string
    resourceType: 'application' | 'database'
    resourceId: string
    planId: string
    hourlyRate: number
    instanceCount: number
    createdAt: Date
  }): Promise<{ amount: number; hours: number; units: number; suspended?: boolean; resumed?: boolean }> {
    return await transaction(async (client) => {
      const lastRes = await client.query(
        `SELECT billing_period_end FROM paas_billing_records
         WHERE organization_id = $1 AND resource_type = $2 AND resource_id = $3
         ORDER BY billing_period_end DESC LIMIT 1`,
        [input.organizationId, input.resourceType, input.resourceId]
      )
      const lastEnd: Date | null = lastRes.rows[0]?.billing_period_end ? new Date(lastRes.rows[0].billing_period_end) : null
      const periodStart = lastEnd || input.createdAt
      const now = new Date()
      const elapsedMs = Math.max(0, now.getTime() - periodStart.getTime())
      const rawHours = elapsedMs / MS_PER_HOUR
      const hoursToCharge = Math.floor(rawHours)
      if (hoursToCharge < 1) return { amount: 0, hours: 0, units: 0 }
      const periodEnd = new Date(periodStart.getTime() + hoursToCharge * MS_PER_HOUR)

      const amount = Number((input.hourlyRate * input.instanceCount * hoursToCharge).toFixed(4))
      // Check wallet balance
      const walletRes = await client.query('SELECT balance FROM wallets WHERE organization_id = $1', [input.organizationId])
      const balance = walletRes.rows[0] ? parseFloat(walletRes.rows[0].balance) : 0
      if (balance < amount) {
        await client.query(
          `INSERT INTO paas_billing_records (
            organization_id, resource_type, resource_id, plan_id, instance_count,
            hourly_rate, hours_used, total_cost, billing_period_start, billing_period_end
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            input.organizationId,
            input.resourceType,
            input.resourceId,
            input.planId,
            input.instanceCount,
            input.hourlyRate,
            hoursToCharge,
            amount,
            periodStart,
            periodEnd,
          ]
        )
        await PaasAlertService.notifyOrganization(input.organizationId, 'paas.billing.insufficient', {
          entityType: `paas_${input.resourceType}`,
          entityId: input.resourceId,
          message: `Billing failed for ${input.resourceType} ${input.resourceId} due to insufficient funds`,
          status: 'warning',
        })
        return { amount: 0, hours: hoursToCharge, units: 0, suspended: true }
      }

      const ok = await PayPalService.deductFundsFromWallet(
        input.organizationId,
        amount,
        `PaaS ${input.resourceType} hourly - ${hoursToCharge}h @ $${input.hourlyRate.toFixed(4)}/h x ${input.instanceCount}`
      )
      if (!ok) throw new Error('wallet deduction failed')

      await client.query(
        `INSERT INTO paas_billing_records (
          organization_id, resource_type, resource_id, plan_id, instance_count,
          hourly_rate, hours_used, total_cost, billing_period_start, billing_period_end
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.organizationId,
          input.resourceType,
          input.resourceId,
          input.planId,
          input.instanceCount,
          input.hourlyRate,
          hoursToCharge,
          amount,
          periodStart,
          periodEnd,
        ]
      )

      await checkSpendingAlert(client, input.organizationId)

      return { amount, hours: hoursToCharge, units: 1, resumed: true }
    })
  },

  async suspendResource(resourceType: 'application' | 'database', resourceId: string) {
    const table = resourceType === 'application' ? 'paas_applications' : 'paas_databases'
    const column = resourceType === 'application' ? 'suspended_at' : 'suspended_at'
    await query(
      `UPDATE ${table} SET status = 'suspended', ${column} = COALESCE(${column}, NOW()) WHERE id = $1`,
      [resourceId]
    )
  },

  async resumeResource(resourceType: 'application' | 'database', resourceId: string) {
    const table = resourceType === 'application' ? 'paas_applications' : 'paas_databases'
    const column = resourceType === 'application' ? 'suspended_at' : 'suspended_at'
    await query(
      `UPDATE ${table} SET status = 'running', ${column} = NULL WHERE id = $1 AND status = 'suspended'`,
      [resourceId]
    )
  },

  async getUsageSummary(organizationId: string) {
    const res = await query(
      `SELECT resource_type, SUM(total_cost) AS total, SUM(hours_used) AS hours
       FROM paas_billing_records
       WHERE organization_id = $1
         AND date_trunc('month', billing_period_start) = date_trunc('month', NOW())
       GROUP BY resource_type`,
      [organizationId]
    )
    const totals: Record<string, { total: number; hours: number }> = {}
    let grand = 0
    for (const row of res.rows) {
      totals[row.resource_type] = { total: parseFloat(row.total), hours: parseFloat(row.hours) }
      grand += parseFloat(row.total)
    }
    return { totals, grand }
  },

  async listRecords(organizationId: string, options?: { limit?: number; resourceId?: string; resourceType?: 'application' | 'database' }) {
    const limit = Math.max(1, Math.min(200, Number(options?.limit) || 25))
    const params: any[] = [organizationId]
    const where: string[] = ['organization_id = $1']
    if (options?.resourceType) {
      params.push(options.resourceType)
      where.push(`resource_type = $${params.length}`)
    }
    if (options?.resourceId) {
      params.push(options.resourceId)
      where.push(`resource_id = $${params.length}`)
    }
    const sql = `
      SELECT id, resource_type, resource_id, plan_id, instance_count, hourly_rate, hours_used,
             total_cost, billing_period_start, billing_period_end
      FROM paas_billing_records
      WHERE ${where.join(' AND ')}
      ORDER BY billing_period_end DESC
      LIMIT ${limit}`
    const res = await query(sql, params)
    return res.rows
  },

  async getApplicationCharges(applicationId: string) {
    const res = await query(
      `SELECT
         date_trunc('month', billing_period_start) AS month,
         SUM(total_cost) AS total,
         SUM(hours_used) AS hours
       FROM paas_billing_records
       WHERE resource_type = 'application' AND resource_id = $1
       GROUP BY month
       ORDER BY month DESC
       LIMIT 6`,
      [applicationId]
    )
    const monthToDate = await query(
      `SELECT COALESCE(SUM(total_cost),0) AS total
         FROM paas_billing_records
         WHERE resource_type = 'application'
           AND resource_id = $1
           AND date_trunc('month', billing_period_start) = date_trunc('month', NOW())`,
      [applicationId]
    )
    return {
      history: res.rows,
      currentMonthTotal: parseFloat(monthToDate.rows[0]?.total ?? 0),
    }
  },

  async upsertSpendingAlert(organizationId: string, threshold: number) {
    const res = await query(
      `INSERT INTO paas_spending_alerts (organization_id, threshold_amount)
       VALUES ($1, $2)
       ON CONFLICT (organization_id) DO UPDATE SET threshold_amount = EXCLUDED.threshold_amount, notified_at = NULL
       RETURNING *`,
      [organizationId, threshold]
    )
    return res.rows[0]
  },

  async getSpendingAlert(organizationId: string) {
    const res = await query('SELECT * FROM paas_spending_alerts WHERE organization_id = $1', [organizationId])
    return res.rows[0] || null
  },
}

async function checkSpendingAlert(client: any, organizationId: string) {
  const alertRes = await client.query('SELECT * FROM paas_spending_alerts WHERE organization_id = $1', [organizationId])
  const alert = alertRes.rows[0]
  if (!alert) return
  const usage = await client.query(
    `SELECT COALESCE(SUM(total_cost),0) AS total
     FROM paas_billing_records
     WHERE organization_id = $1
       AND date_trunc('month', billing_period_start) = date_trunc('month', NOW())`,
    [organizationId]
  )
  const total = parseFloat(usage.rows[0].total)
  const alreadyNotifiedThisMonth =
    alert.notified_at && new Date(alert.notified_at).getMonth() === new Date().getMonth()
  if (total >= parseFloat(alert.threshold_amount) && !alreadyNotifiedThisMonth) {
    await client.query('UPDATE paas_spending_alerts SET notified_at = NOW() WHERE id = $1', [alert.id])
    await PaasAlertService.notifyOrganization(organizationId, 'paas.billing.threshold', {
      entityType: 'wallet',
      message: `PaaS spending reached $${total.toFixed(2)}, exceeding your alert threshold of $${parseFloat(alert.threshold_amount).toFixed(2)}`,
      status: 'warning',
    })
  }
}
