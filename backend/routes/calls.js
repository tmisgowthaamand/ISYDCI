import { Router } from 'express'
import { requireAuth, ROLES } from '../services/auth.js'
import {
  acceptCall,
  callEvents,
  getCallPermission,
  getCallingSettings,
  initiateOutboundCall,
  listActiveCalls,
  listCallsForLead,
  preAcceptCall,
  rejectCall,
  saveCallRecording,
  sendCallPermissionRequest,
  terminateCall,
  updateCallingSettings,
} from '../services/calling.js'

const router = Router()
router.use(requireAuth())

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

// GET /api/calls/active — list ringing/active calls for CRM UI polling
router.get('/active', async (_req, res) => {
  try {
    const calls = await listActiveCalls()
    res.json({ success: true, calls })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/calls/events — Server-Sent Events stream for real-time incoming calls & SDP answers
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)

  const onEvent = evt => {
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

// GET /api/calls/lead/:phone — call history + current 72h call permission for a CRM contact
router.get('/lead/:phone', async (req, res) => {
  try {
    const [calls, permission] = await Promise.all([
      listCallsForLead(req.params.phone),
      getCallPermission(req.params.phone),
    ])
    res.json({ success: true, calls, permission })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/calls/permission-request — send interactive call_permission_request (1/24h, 2/7d)
router.post('/permission-request', async (req, res) => {
  try {
    const { phone, bodyText } = req.body || {}
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
    const result = await initiateOutboundCall(phone, sdpOffer)
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
    const { sdpAnswer } = req.body || {}
    const result = await acceptCall(req.params.callId, sdpAnswer)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/reject
router.post('/:callId/reject', async (req, res) => {
  try {
    const result = await rejectCall(req.params.callId)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/terminate
router.post('/:callId/terminate', async (req, res) => {
  try {
    const result = await terminateCall(req.params.callId)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message, metaError: err.metaError })
  }
})

// POST /api/calls/:callId/recording — upload mixed WebRTC call audio recording (.webm)
router.post('/:callId/recording', async (req, res) => {
  try {
    const { audioBase64, mimeType, durationSec } = req.body || {}
    const result = await saveCallRecording(req.params.callId, { audioBase64, mimeType, durationSec })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

export default router

