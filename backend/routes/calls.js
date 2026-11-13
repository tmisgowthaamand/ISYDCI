import fs from 'fs'
import { Router } from 'express'
import { requireAuth, ROLES } from '../services/auth.js'
import {
  acceptCall,
  callEvents,
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

// GET /api/calls — list call logs with optional telecaller_id, direction, attended, phone filters
router.get('/', async (req, res) => {
  try {
    const { phone, telecaller_id: telecallerId, direction, attended, limit } = req.query
    const calls = await listCallLogs({
      phone,
      telecallerId,
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
    const { telecaller_id: telecallerId, direction } = req.query
    const [calls, permission] = await Promise.all([
      listCallsForLead(req.params.phone, { telecallerId, direction }),
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
    const telecallerId = req.admin?.username || req.admin?.sub || null
    const result = await acceptCall(req.params.callId, sdpAnswer, { telecallerId })
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

// GET /api/calls/:callId/recording — authenticated audio stream with HTTP Range scrubbing support
router.get('/:callId/recording', async (req, res) => {
  try {
    const resolved = await resolveRecordingFile(req.params.callId)
    if (!resolved) return res.status(404).json({ success: false, message: 'Call not found' })
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
    const { audioBase64, mimeType, durationSec } = req.body || {}
    const result = await saveCallRecording(req.params.callId, { audioBase64, mimeType, durationSec })
    res.json({ success: true, ...result })
  } catch (err) {
    console.warn(`⚠️ [CALL RECORDING UPLOAD 400] ${req.params.callId}: ${err.message}`)
    res.status(400).json({ success: false, message: err.message })
  }
})

export default router

