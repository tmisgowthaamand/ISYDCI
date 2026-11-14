import fs from 'fs'
import { Router } from 'express'
import { col } from '../db/mongo.js'
import { requireAuth, ROLES } from '../services/auth.js'
import { leadPhone } from '../services/leads.js'
import {
  acceptCall,
  callEvents,
  canAdminReceiveCall,
  getCallPermission,
  getCallingSettings,
  initiateOutboundCall,
  listActiveCalls,
  listCallLogs,
  listCallsForLead,
  preAcceptCall,
  rejectCall,
  resolveRecordingFile,
  saveCallRecording,
  sendCallPermissionRequest,
  terminateCall,
  updateCallingSettings,
} from '../services/calling.js'
import { exportCallsCsv } from '../services/callReports.js'

const router = Router()
router.use(requireAuth())

async function assertTelecallerLeadAccess(rawPhone, admin) {
  if (admin?.role !== ROLES.TELECALLER) return
  const waId = leadPhone(rawPhone)
  const lead = waId ? await col('leads').findOne({ phone: waId }, { projection: { assignedTo: 1 } }) : null
  const assigned = String(lead?.assignedTo || '').trim().toLowerCase()
  const username = String(admin?.username || '').trim().toLowerCase()
  if (!assigned || !username || assigned !== username) {
    const err = new Error('Forbidden: this lead is not assigned to you')
    err.status = 403
    throw err
  }
}

async function assertTelecallerCallAccess(callId, admin) {
  if (admin?.role !== ROLES.TELECALLER) return
  const call = await col('whatsapp_calls').findOne({ callId }, { projection: { telecaller_id: 1, waId: 1 } })
  if (call && !canAdminReceiveCall(call, admin)) {
    const err = new Error('Forbidden: this call is assigned to another telecaller')
    err.status = 403
    throw err
  }
}

// GET /api/calls/settings — inspect current calling & SIP configuration
router.get('/settings', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const includeSip = req.query.includeSip === '1' || req.query.includeSip === 'true'
    const settings = await getCallingSettings({ includeSip })
    res.json({ success: true, settings })
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/settings — enable/configure calling, call_hours, and optional SIP trunking
router.post('/settings', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const result = await updateCallingSettings(req.body || {})
    res.json({ success: true, result })
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// GET /api/calls/active — list ringing/active calls routed to the signed-in telecaller (or all for admin ?scope=all)
router.get('/active', async (req, res) => {
  try {
    const scopeAll =
      req.query.scope === 'all' &&
      [ROLES.SUPER_SUPER_ADMIN, ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.admin?.role)
    const calls = await listActiveCalls({ admin: req.admin, scopeAll })
    res.json({ success: true, calls })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/calls/events — Server-Sent Events stream filtered by telecaller routing (admins receive live monitor & recording updates)
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const scopeAll =
    req.query.scope === 'all' &&
    [ROLES.SUPER_SUPER_ADMIN, ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.admin?.role)
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, telecaller: req.admin?.username || null })}\n\n`)

  const onEvent = evt => {
    if (!scopeAll && evt?.call && !canAdminReceiveCall(evt.call, req.admin, { allowAdminMonitor: true })) return
    res.write(`event: call\ndata: ${JSON.stringify(evt)}\n\n`)
  }
  callEvents.on('call_event', onEvent)

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n')
  }, 25000)

  req.on('close', () => {
    clearInterval(keepAlive)
    callEvents.off('call_event', onEvent)
  })
})

// GET /api/calls/export — CSV export of filtered call logs (scoped for telecallers)
router.get('/export', async (req, res) => {
  try {
    const { from, to, days, telecaller_id: telecallerId, direction, district } = req.query
    const scopedTelecaller = req.admin?.role === ROLES.TELECALLER ? req.admin.username : (telecallerId || undefined)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="isydci-calls-${new Date().toISOString().slice(0, 10)}.csv"`)
    for await (const chunk of exportCallsCsv({
      from,
      to,
      days,
      telecallerId: scopedTelecaller,
      direction,
      district,
    })) {
      res.write(chunk)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/calls — list call logs with optional telecaller_id, direction, attended, phone filters
router.get('/', async (req, res) => {
  try {
    const { phone, telecaller_id: telecallerId, direction, attended, limit } = req.query
    const scopedTelecaller = req.admin?.role === ROLES.TELECALLER ? req.admin.username : telecallerId
    const calls = await listCallLogs({
      phone,
      telecallerId: scopedTelecaller,
      direction,
      attended: attended === 'true' ? true : attended === 'false' ? false : undefined,
      limit: parseInt(limit, 10) || 100,
    })
    res.json({ success: true, calls })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/calls/lead/:phone — call history + current 72h call permission for a CRM contact
router.get('/lead/:phone', async (req, res) => {
  try {
    await assertTelecallerLeadAccess(req.params.phone, req.admin)
    const { telecaller_id: telecallerId, direction } = req.query
    const scopedTelecaller = req.admin?.role === ROLES.TELECALLER ? req.admin.username : telecallerId
    const [calls, permission] = await Promise.all([
      listCallsForLead(req.params.phone, { telecallerId: scopedTelecaller, direction }),
      getCallPermission(req.params.phone),
    ])
    res.json({ success: true, calls, permission })
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message })
  }
})

// POST /api/calls/permission-request — send interactive call_permission_request (1/24h, 2/7d)
router.post('/permission-request', async (req, res) => {
  try {
    const { phone, bodyText } = req.body || {}
    await assertTelecallerLeadAccess(phone, req.admin)
    const result = await sendCallPermissionRequest(phone, { bodyText })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
      rateLimit: err.rateLimit,
      metaError: err.metaError,
    })
  }
})

// POST /api/calls/outbound — initiate outbound WebRTC call (requires active 72h permission)
router.post('/outbound', async (req, res) => {
  try {
    const { phone, sdpOffer } = req.body || {}
    await assertTelecallerLeadAccess(phone, req.admin)
    const telecallerId = req.admin?.username || req.admin?.sub || null
    const result = await initiateOutboundCall(phone, sdpOffer, { telecallerId })
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('❌ [OUTBOUND CALL ERROR]:', err.message, err.metaError ? JSON.stringify(err.metaError) : '')
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
      permission: err.permission,
      metaError: err.metaError,
    })
  }
})

// POST /api/calls/:callId/pre-accept
router.post('/:callId/pre-accept', async (req, res) => {
  try {
    await assertTelecallerCallAccess(req.params.callId, req.admin)
    const { sdpAnswer } = req.body || {}
    const result = await preAcceptCall(req.params.callId, sdpAnswer)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/accept
router.post('/:callId/accept', async (req, res) => {
  try {
    const existingCall = await col('whatsapp_calls').findOne(
      { callId: req.params.callId },
      { projection: { status: 1, attended: 1, telecaller_id: 1 } }
    )
    const telecallerId = req.admin?.username || req.admin?.sub || null
    if (
      existingCall &&
      (existingCall.attended || ['accepted', 'connected', 'active'].includes(existingCall.status)) &&
      existingCall.telecaller_id !== telecallerId
    ) {
      return res.status(409).json({ success: false, message: 'Call already accepted by another telecaller' })
    }
    await assertTelecallerCallAccess(req.params.callId, req.admin)
    const { sdpAnswer } = req.body || {}
    const result = await acceptCall(req.params.callId, sdpAnswer, { telecallerId })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/reject
router.post('/:callId/reject', async (req, res) => {
  try {
    await assertTelecallerCallAccess(req.params.callId, req.admin)
    const result = await rejectCall(req.params.callId)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/terminate
router.post('/:callId/terminate', async (req, res) => {
  try {
    await assertTelecallerCallAccess(req.params.callId, req.admin)
    const result = await terminateCall(req.params.callId)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// GET /api/calls/:callId/recording — authenticated audio stream with HTTP Range scrubbing support
router.get('/:callId/recording', async (req, res) => {
  try {
    const resolved = await resolveRecordingFile(req.params.callId)
    if (!resolved) return res.status(404).json({ success: false, message: 'Call not found' })
    if (req.admin?.role === ROLES.TELECALLER && resolved.call?.telecaller_id !== req.admin.username) {
      return res.status(403).json({ success: false, message: 'This call recording is not assigned to you' })
    }
    if (resolved.unavailable) {
      return res.status(404).json({ success: false, message: 'Recording not available for this call' })
    }

    const { filePath, sizeBytes, mimeType } = resolved
    const range = req.headers.range
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${sizeBytes}`)
        return res.end()
      }
      const start = parseInt(match[1], 10)
      const end = match[2] ? Math.min(parseInt(match[2], 10), sizeBytes - 1) : sizeBytes - 1
      if (start >= sizeBytes || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${sizeBytes}`)
        return res.end()
      }
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${sizeBytes}`)
      res.setHeader('Content-Length', end - start + 1)
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.status(200)
      res.setHeader('Content-Length', sizeBytes)
      fs.createReadStream(filePath).pipe(res)
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/calls/:callId/recording — upload mixed WebRTC call audio recording (.webm)
router.post('/:callId/recording', async (req, res) => {
  try {
    await assertTelecallerCallAccess(req.params.callId, req.admin)
    const { audioBase64, mimeType, durationSec } = req.body || {}
    const result = await saveCallRecording(req.params.callId, { audioBase64, mimeType, durationSec })
    res.json({ success: true, ...result })
  } catch (err) {
    console.warn(`⚠️ [CALL RECORDING UPLOAD ${err.status || 400}] ${req.params.callId}: ${err.message}`)
    res.status(err.status || 400).json({ success: false, message: err.message })
  }
})

export default router

