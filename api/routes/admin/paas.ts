import express from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { PlanService } from '../../services/paas/PlanService.js'
import { RuntimeService } from '../../services/paas/RuntimeService.js'
import { NodeService } from '../../services/paas/NodeService.js'
import { PaasBackupService } from '../../services/paas/BackupService.js'

const router = express.Router()

// All routes here require admin auth
router.use(authenticateToken, requireAdmin)

// Plans
router.get('/plans', async (_req, res) => {
  const items = await PlanService.list()
  res.json({ success: true, data: items })
})

router.post('/plans', async (req, res) => {
  try {
    const created = await PlanService.create(req.body)
    res.json({ success: true, data: created })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to create plan' })
  }
})

router.put('/plans/:id', async (req, res) => {
  const updated = await PlanService.update(req.params.id, req.body)
  if (!updated) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: updated })
})

router.delete('/plans/:id', async (req, res) => {
  const ok = await PlanService.remove(req.params.id)
  res.json({ success: ok })
})

// Runtimes
router.get('/runtimes', async (_req, res) => {
  const items = await RuntimeService.list()
  res.json({ success: true, data: items })
})

router.post('/runtimes', async (req, res) => {
  try {
    const created = await RuntimeService.create(req.body)
    res.json({ success: true, data: created })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to create runtime' })
  }
})

router.put('/runtimes/:id', async (req, res) => {
  const updated = await RuntimeService.update(req.params.id, req.body)
  if (!updated) return res.status(404).json({ success: false, error: 'Not found' })
  res.json({ success: true, data: updated })
})

router.delete('/runtimes/:id', async (req, res) => {
  const ok = await RuntimeService.remove(req.params.id)
  res.json({ success: ok })
})

// Nodes
router.get('/nodes', async (_req, res) => {
  const items = await NodeService.list()
  res.json({ success: true, data: items })
})

router.post('/nodes/register', async (req, res) => {
  const { name, region, host_address } = req.body || {}
  if (!name || !region) {
    return res.status(400).json({ success: false, error: 'name and region are required' })
  }
  const token = await NodeService.generateRegistrationToken({ name, region, host_address })
  res.json({ success: true, data: token })
})

router.get('/backup-policies', async (req, res) => {
  const items = await PaasBackupService.listPolicies(req.query.organizationId as string | undefined)
  res.json({ success: true, data: items })
})

router.post('/backup-policies', async (req, res) => {
  const { organization_id, database_id, frequency_minutes, retention_days } = req.body || {}
  if (!organization_id || !frequency_minutes) return res.status(400).json({ success: false, error: 'organization_id and frequency required' })
  const policy = await PaasBackupService.upsertPolicy({
    organizationId: organization_id,
    databaseId: database_id,
    frequencyMinutes: Number(frequency_minutes),
    retentionDays: Number(retention_days) || 7,
  })
  res.json({ success: true, data: policy })
})

export default router
