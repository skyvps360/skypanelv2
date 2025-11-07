import { query } from '../../lib/database.js'
import { logActivity } from '../activityLogger.js'

interface AlertOptions {
  entityType: string
  entityId?: string | null
  message: string
  status?: 'success' | 'warning' | 'error' | 'info'
  metadata?: Record<string, any>
  suppressNotification?: boolean
}

async function getAdminUserIds(): Promise<string[]> {
  const res = await query("SELECT id FROM users WHERE role = 'admin'")
  return res.rows.map((row: any) => row.id)
}

async function getOrgRecipientIds(organizationId: string): Promise<string[]> {
  const res = await query(
    `SELECT user_id FROM organization_members
     WHERE organization_id = $1 AND role IN ('owner','admin')`,
    [organizationId]
  )
  return res.rows.map((row: any) => row.user_id)
}

export const PaasAlertService = {
  async notifyAdmins(eventType: string, options: AlertOptions) {
    const ids = await getAdminUserIds()
    await Promise.all(
      ids.map((userId) =>
        logActivity({
          userId,
          organizationId: null,
          eventType,
          entityType: options.entityType,
          entityId: options.entityId ?? null,
          message: options.message,
          status: options.status ?? 'info',
          metadata: options.metadata ?? {},
          suppressNotification: options.suppressNotification ?? false,
        })
      )
    )
  },

  async notifyOrganization(organizationId: string, eventType: string, options: AlertOptions) {
    const ids = await getOrgRecipientIds(organizationId)
    await Promise.all(
      ids.map((userId) =>
        logActivity({
          userId,
          organizationId,
          eventType,
          entityType: options.entityType,
          entityId: options.entityId ?? null,
          message: options.message,
          status: options.status ?? 'info',
          metadata: options.metadata ?? {},
          suppressNotification: options.suppressNotification ?? false,
        })
      )
    )
  },
}
