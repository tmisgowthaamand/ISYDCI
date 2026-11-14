import { Router } from 'express'
import { requireAuth } from '../services/auth.js'
import {
  META_LIMITS,
  STATUS_LABEL,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate,
  syncTemplate,
  syncAllFromMeta,
  syncAllFromMetaIfStale,
  sendTemplateTo,
  validateTemplate,
  setTemplateStatus,
} from '../services/templates.js'
import { listLeads, leadPhone } from '../services/leads.js'

const router = Router()
router.use(requireAuth()) // both roles

router.get('/limits', (_req, res) => res.json({ success: true, limits: META_LIMITS, statusLabels: STATUS_LABEL }))

router.get('/', async (req, res) => {
  try {
    if (req.query.sync === 'true') {
      await syncAllFromMetaIfStale(6000)
    }
    res.json({ success: true, templates: await listTemplates({ status: req.query.status, q: req.query.q }), statusLabels: STATUS_LABEL })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/validate', (req, res) => res.json({ success: true, errors: validateTemplate(req.body || {}) }))

router.post('/', async (req, res) => {
  try {
    res.status(201).json({ success: true, template: await createTemplate(req.body || {}, req.admin.username) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/sync-all', async (_req, res) => {
  try {
    res.json({ success: true, ...(await syncAllFromMeta()) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const t = await getTemplate(req.params.id)
    if (!t) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, template: t })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    res.json({ success: true, template: await updateTemplate(req.params.id, req.body || {}, req.admin.username) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteTemplate(req.params.id, { alsoMeta: req.query.meta !== 'false' })
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/submit', async (req, res) => {
  try {
    const directApproval = req.query.direct === 'true' || req.body?.directApproval === true
    res.json({ success: true, template: await submitTemplate(req.params.id, req.admin.username, { directApproval }) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/sync', async (req, res) => {
  try {
    res.json({ success: true, template: await syncTemplate(req.params.id) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// Send to one number, or to a lead segment (status/source filters). Segment sends are capped per call.
router.post('/:id/send', async (req, res) => {
  try {
    const { to, params = {}, segment, limit } = req.body || {}
    if (to) {
      const r = await sendTemplateTo(leadPhone(to), req.params.id, params, req.admin.username)
      return res.json({ success: true, sent: 1, messageId: r.messageId })
    }
    if (segment) {
      const cap = Math.min(500, parseInt(limit) || 100)
      const { leads } = await listLeads({ ...segment, page: 1, limit: cap })
      let sent = 0
      let skippedOptOut = 0
      const failed = []
      for (const lead of leads) {
        if (lead.optedOut) {
          skippedOptOut++
          continue
        }
        try {
          await sendTemplateTo(lead.phone, req.params.id, params, req.admin.username)
          sent++
        } catch (err) {
          failed.push({ phone: lead.phone, error: err.message })
        }
      }
      return res.json({ success: true, sent, skippedOptOut, failed, note: 'Meta paces business-initiated messages by your daily messaging tier; large segments should be sent in batches.' })
    }
    res.status(400).json({ success: false, message: 'Provide "to" or a "segment"' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// Dev & testing status simulation: approve, reject, or reset template status on demand
router.post('/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body || {}
    const template = await setTemplateStatus(req.params.id, {
      status,
      reason,
      actor: req.admin?.username || 'admin',
    })
    res.json({
      success: true,
      message: `Template status changed to ${template.statusLabel}`,
      template,
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
