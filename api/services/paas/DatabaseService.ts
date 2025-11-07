import crypto from 'crypto'
import { query } from '../../lib/database.js'
import { encryptSecret, decryptSecret } from '../../lib/crypto.js'
import { SchedulerService } from './SchedulerService.js'
import { sendTaskToNode, isNodeOnline } from './AgentWs.js'

function randomString(len = 16) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

export const DatabaseService = {
  async listByOrg(organizationId: string) {
    const res = await query('SELECT * FROM paas_databases WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId])
    return res.rows.map(mapDbRow)
  },
  async listForApplication(applicationId: string, organizationId: string) {
    const res = await query(
      `SELECT d.*, ad.env_var_prefix, ad.created_at AS linked_at, ad.id AS link_id
       FROM paas_app_databases ad
       JOIN paas_databases d ON d.id = ad.database_id
       WHERE ad.application_id = $1 AND d.organization_id = $2
       ORDER BY ad.created_at DESC`,
      [applicationId, organizationId]
    )
    return res.rows.map((row: any) => {
      const db = mapDbRow(row)
      return {
        ...db,
        env_var_prefix: row.env_var_prefix,
        linked_at: row.linked_at,
        link_id: row.link_id,
      }
    })
  },
  async getForOrg(id: string, organizationId: string) {
    const res = await query('SELECT * FROM paas_databases WHERE id = $1 AND organization_id = $2', [id, organizationId])
    return res.rows[0] ? mapDbRow(res.rows[0]) : null
  },
  async create(organizationId: string, input: { name: string; db_type: 'mysql' | 'postgresql'; version: string; plan_id?: string; region: string }) {
    let plan: any = null
    if (input.plan_id) {
      const planRes = await query('SELECT * FROM paas_plans WHERE id = $1', [input.plan_id])
      plan = planRes.rows[0] || null
    }
    const requirements = plan
      ? {
          cpuMillicores: Number(plan.cpu_millicores) || undefined,
          memoryMb: Number(plan.memory_mb) || undefined,
          diskMb: plan.storage_gb ? Number(plan.storage_gb) * 1024 : undefined,
        }
      : {
          cpuMillicores: 250,
          memoryMb: 512,
          diskMb: 10 * 1024,
        }
    const node = await SchedulerService.selectNodeForRegion(input.region, requirements)
    if (!node) throw new Error('no_capacity')
    const username = `u_${randomString(8)}`
    const passwordPlain = randomString(24)
    const password = encryptSecret(passwordPlain)
    const database = `db_${randomString(6)}`
    const port = input.db_type === 'postgresql' ? 5432 : 3306
    const ins = await query(
      `INSERT INTO paas_databases (organization_id, name, db_type, version, plan_id, node_id, status, username, password, database_name, host, port)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11)
       RETURNING *`,
      [organizationId, input.name, input.db_type, input.version, input.plan_id ?? null, node.id, username, password, database, node.host_address ?? null, port]
    )
    const row = mapDbRow(ins.rows[0])
    if (isNodeOnline(node.id)) {
      const task = {
        taskId: row.id,
        type: 'db_create',
        db: {
          id: row.id,
          type: row.db_type,
          version: row.version,
          username,
          password: passwordPlain,
          database,
          port,
        }
      }
      sendTaskToNode(node.id, task)
    }
    return row
  },
  async removeForOrg(id: string, organizationId: string) {
    const rowRes = await query('SELECT * FROM paas_databases WHERE id = $1 AND organization_id = $2', [id, organizationId])
    const row = rowRes.rows[0]
    if (!row) return false
    if (row.node_id && isNodeOnline(row.node_id)) {
      sendTaskToNode(row.node_id, { taskId: id, type: 'db_delete', db: { id, type: row.db_type } })
    }
    await query('DELETE FROM paas_databases WHERE id = $1 AND organization_id = $2', [id, organizationId])
    return true
  },
  async linkApp(appId: string, dbId: string, organizationId: string) {
    // load db and create env vars
    const dbRes = await query('SELECT * FROM paas_databases WHERE id = $1 AND organization_id = $2', [dbId, organizationId])
    if (dbRes.rows.length === 0) throw new Error('db_not_found')
    const db = dbRes.rows[0]
    const plainPassword = db.password ? decryptSecret(db.password) : ''
    const url = db.db_type === 'postgresql'
      ? `postgresql://${db.username}:${'${PASSWORD}'}@${db.host || '127.0.0.1'}:${db.port}/${db.database_name}`
      : `mysql://${db.username}:${'${PASSWORD}'}@${db.host || '127.0.0.1'}:${db.port}/${db.database_name}`

    await query('INSERT INTO paas_app_databases (application_id, database_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [appId, dbId])
    const { encryptSecret } = await import('../../lib/crypto.js')
    await query(
      'INSERT INTO paas_environment_vars (application_id, key, value) VALUES ($1,$2,$3) ON CONFLICT (application_id, key) DO UPDATE SET value = EXCLUDED.value',
      [appId, 'DATABASE_URL', encryptSecret(url.replace('${PASSWORD}', plainPassword))]
    )
    await query('UPDATE paas_applications SET needs_redeploy = TRUE, last_env_updated_at = NOW(), updated_at = NOW() WHERE id = $1', [appId])
    return true
  },
  async unlinkApp(appId: string, dbId: string, organizationId: string) {
    const dbRes = await query('SELECT 1 FROM paas_databases WHERE id = $1 AND organization_id = $2', [dbId, organizationId])
    if (!dbRes.rowCount) throw new Error('db_not_found')
    await query('DELETE FROM paas_app_databases WHERE application_id = $1 AND database_id = $2', [appId, dbId])
    await query('DELETE FROM paas_environment_vars WHERE application_id = $1 AND key = $2', [appId, 'DATABASE_URL'])
    await query('UPDATE paas_applications SET needs_redeploy = TRUE, last_env_updated_at = NOW(), updated_at = NOW() WHERE id = $1', [appId])
    return true
  }
}

function mapDbRow(row: any) {
  if (!row) return row
  return {
    ...row,
    password: row.password ? decryptSecret(row.password) : null,
  }
}
