import { Router } from 'express'
import { requireAuth, ROLES } from '../services/auth.js'
import {
  assignLeads,
  createTelecaller,
  deleteTelecaller,
  getRoutingConfig,
  listTelecallers,
  resetTelecallerPasscode,
  setRoutingConfig,
  updateTelecaller,
} from '../services/telecallers.js'
import { logAudit } from '../services/audit.js'

const router = Router()

// Read-only telecaller directory & routing mode (Super Super Admin + Super Admin can view; Telecallers blocked)
router.get('/', requireAuth(ROLES.SUPER_SUPER_ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
  try {
    const [telecallers, routing] = await Promise.all([listTelecallers(), getRoutingConfig()])
    res.json({ success: true, telecallers, routing })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/routing', requireAuth(ROLES.SUPER_SUPER_ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
  try {
    res.json({ success: true, routing: await getRoutingConfig() })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// All mutations below are strictly Super Super Admin (developer) ONLY
router.put('/routing', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const routing = await setRoutingConfig(req.body?.mode, req.admin.username)
    await logAudit({ actor: req.admin.username, role: req.admin.role, action: 'TELECALLER_ROUTING_UPDATE', target: routing.mode, ip: req.ip })
    res.json({ success: true, routing })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.post('/', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const result = await createTelecaller({ ...(req.body || {}), createdBy: req.admin.username })
    await logAudit({ actor: req.admin.username, role: req.admin.role, action: 'TELECALLER_CREATE', target: result.telecaller.username, ip: req.ip })
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.post('/:id/reset-passcode', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const result = await resetTelecallerPasscode(req.params.id)
    await logAudit({ actor: req.admin.username, role: req.admin.role, action: 'TELECALLER_PASSCODE_RESET', target: result.telecaller.username, ip: req.ip })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.patch('/:id', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const telecaller = await updateTelecaller(req.params.id, req.body || {})
    res.json({ success: true, telecaller })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.delete('/:id', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    await deleteTelecaller(req.params.id)
    await logAudit({ actor: req.admin.username, role: req.admin.role, action: 'TELECALLER_DELETE', target: req.params.id, ip: req.ip })
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.post('/assign', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const result = await assignLeads({ ...(req.body || {}), actor: req.admin.username })
    await logAudit({
      actor: req.admin.username,
      role: req.admin.role,
      action: 'TELECALLER_ASSIGN',
      target: result.telecaller || 'round_robin',
      ip: req.ip,
    })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

export default router
