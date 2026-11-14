// Sub-Agent 3: Full Calling, Permissions, Recordings & Reporting Regression Suite
// Run from backend/: node scripts/qa_e2e_3_calling_regression.js

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Safe ephemeral fallbacks only if omitted in backend/.env
process.env.JWT_SECRET ||= process.env.ADMIN_PASSWORD || 'qa_e2e_3_ephemeral_jwt_secret'
process.env.WHATSAPP_APP_SECRET ||= process.env.APP_SECRET || 'qa_e2e_3_ephemeral_app_secret'
process.env.WHATSAPP_TOKEN ||= 'qa_e2e_3_ephemeral_wa_token'
process.env.WHATSAPP_PHONE_NUMBER_ID ||= '999999999999999'

import { connectDb, closeDb, col } from '../db/mongo.js'
import { leadPhone } from '../services/leads.js'
import { optionalAuth, signToken, ROLES } from '../services/auth.js'
import {
  PROTECTED_RECORDINGS_DIR,
  GRAPH_BASE,
  checkPermissionRequestRateLimit,
  getCallPermission,
  recordCallPermissionReply,
} from '../services/calling.js'
import whatsappWebhookRouter from '../routes/whatsappWebhook.js'
import callsRouter from '../routes/calls.js'
import reportsRouter from '../routes/reports.js'

// Strictly isolated test phones and ID prefixes
const TEST_PHONES = [
  '919999820001', // Lead assigned to harish (routing + recording + report)
  '919999820002', // Unassigned lead (broadcast ring + accept + 409 race)
  '919999820003', // Lead assigned to harish (busy auto-reject + report)
  '919999820004', // Lead assigned to harish (1/24h, 2/7d, connected reset + report)
  '919999820005', // Lead assigned to harish (2 warning & 4 unanswered strikes)
  '919999820006', // Lead assigned to rahul (report & CSV isolation)
]

const CALL_PREFIX = 'qa_e2e_3_call_'
const MEDIA_ID_OGG = 'qa_e2e_3_media_ogg_4096'
const MOCK_OGG_SIZE = 4096

const results = []
let passed = 0
let failed = 0

async function runCheck(id, title, fn) {
  try {
    const detail = await fn()
    passed++
    const msg = detail ? ` — ${detail}` : ''
    console.log(`  [PASS] ${id}: ${title}${msg}`)
    results.push({ id, title, status: 'PASS', detail: detail || 'Verified' })
  } catch (err) {
    failed++
    const detail = err?.message || String(err)
    console.error(`  [FAIL] ${id}: ${title} — ${detail}`)
    results.push({ id, title, status: 'FAIL', detail })
  }
}

function signWebhookBody(rawBody) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function buildCallsWebhookPayload(callsArray) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'qa_e2e_3_waba',
        changes: [
          {
            field: 'calls',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919999820000',
                phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
              },
              calls: callsArray,
            },
          },
        ],
      },
    ],
  }
}

async function openSseStream(baseUrl, token, query = '') {
  const controller = new AbortController()
  const res = await fetch(`${baseUrl}/api/calls/events${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
  assert.equal(res.status, 200, `Expected 200 opening SSE stream, got ${res.status}`)

  const events = []
  let buffer = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let resolveConnected
  const connectedPromise = new Promise(resolve => {
    resolveConnected = resolve
  })

  const pump = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(':')) continue
          let eventName = 'message'
          let dataStr = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
          }
          let data = dataStr
          try {
            data = JSON.parse(dataStr)
          } catch (_) {}
          events.push({ event: eventName, data })
          if (eventName === 'connected') resolveConnected(true)
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }
  })()

  await Promise.race([
    connectedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE connect timeout')), 4000)),
  ])

  return {
    events,
    close: async () => {
      controller.abort()
      await pump.catch(() => {})
    },
  }
}

async function waitFor(predicate, timeoutMs = 4000, intervalMs = 40) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function purgeAllTestArtifacts() {
  const phoneRegex = /^91999982000[1-6]$/
  const callIdRegex = /^qa_e2e_3_call_/
  const anyTagRegex = /qa_e2e_3_|91999982000[1-6]/

  // Delete temporary .ogg files in backend/protected_recordings/
  let deletedOggFiles = 0
  if (fs.existsSync(PROTECTED_RECORDINGS_DIR)) {
    for (const entry of fs.readdirSync(PROTECTED_RECORDINGS_DIR)) {
      if (entry.startsWith('qa_e2e_3_call_') && entry.endsWith('.ogg')) {
        try {
          fs.unlinkSync(path.join(PROTECTED_RECORDINGS_DIR, entry))
          deletedOggFiles++
        } catch (_) {}
      }
    }
  }

  const [delLeads, delCalls, delPerms, delMsgs, delAudits, delEvents] = await Promise.all([
    col('leads').deleteMany({
      $or: [{ phone: { $in: TEST_PHONES } }, { phone: phoneRegex }, { district: /^qa_e2e_3_/ }],
    }),
    col('whatsapp_calls').deleteMany({
      $or: [{ callId: callIdRegex }, { waId: { $in: TEST_PHONES } }, { waId: phoneRegex }],
    }),
    col('call_permissions').deleteMany({
      $or: [{ waId: { $in: TEST_PHONES } }, { waId: phoneRegex }],
    }),
    col('messages').deleteMany({
      $or: [
        { leadPhone: { $in: TEST_PHONES } },
        { leadPhone: phoneRegex },
        { waMessageId: /^qa_e2e_3_/ },
      ],
    }),
    col('audit_logs').deleteMany({
      $or: [
        { target: anyTagRegex },
        { details: anyTagRegex },
        { path: anyTagRegex },
        { action: anyTagRegex },
      ],
    }),
    col('webhook_events').deleteMany({
      $or: [
        { summary: anyTagRegex },
        { 'payload.id': callIdRegex },
        { 'payload.callId': callIdRegex },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.from': { $in: TEST_PHONES } },
      ],
    }),
  ])

  return {
    leads: delLeads.deletedCount,
    whatsapp_calls: delCalls.deletedCount,
    call_permissions: delPerms.deletedCount,
    messages: delMsgs.deletedCount,
    audit_logs: delAudits.deletedCount,
    webhook_events: delEvents.deletedCount,
    ogg_files: deletedOggFiles,
  }
}

async function countLeftoverTestArtifacts() {
  const phoneRegex = /^91999982000[1-6]$/
  const callIdRegex = /^qa_e2e_3_call_/
  const anyTagRegex = /qa_e2e_3_|91999982000[1-6]/

  let leftoverOggFiles = 0
  if (fs.existsSync(PROTECTED_RECORDINGS_DIR)) {
    for (const entry of fs.readdirSync(PROTECTED_RECORDINGS_DIR)) {
      if (entry.startsWith('qa_e2e_3_call_') && entry.endsWith('.ogg')) {
        leftoverOggFiles++
      }
    }
  }

  const [leads, calls, perms, msgs, audits, events] = await Promise.all([
    col('leads').countDocuments({
      $or: [{ phone: { $in: TEST_PHONES } }, { phone: phoneRegex }, { district: /^qa_e2e_3_/ }],
    }),
    col('whatsapp_calls').countDocuments({
      $or: [{ callId: callIdRegex }, { waId: { $in: TEST_PHONES } }, { waId: phoneRegex }],
    }),
    col('call_permissions').countDocuments({
      $or: [{ waId: { $in: TEST_PHONES } }, { waId: phoneRegex }],
    }),
    col('messages').countDocuments({
      $or: [
        { leadPhone: { $in: TEST_PHONES } },
        { leadPhone: phoneRegex },
        { waMessageId: /^qa_e2e_3_/ },
      ],
    }),
    col('audit_logs').countDocuments({
      $or: [
        { target: anyTagRegex },
        { details: anyTagRegex },
        { path: anyTagRegex },
        { action: anyTagRegex },
      ],
    }),
    col('webhook_events').countDocuments({
      $or: [
        { summary: anyTagRegex },
        { 'payload.id': callIdRegex },
        { 'payload.callId': callIdRegex },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.from': { $in: TEST_PHONES } },
      ],
    }),
  ])

  return {
    leads,
    whatsapp_calls: calls,
    call_permissions: perms,
    messages: msgs,
    audit_logs: audits,
    webhook_events: events,
    ogg_files: leftoverOggFiles,
    total: leads + calls + perms + msgs + audits + events + leftoverOggFiles,
  }
}

async function main() {
  console.log('================================================================================')
  console.log('Sub-Agent 3: Full Calling, Permissions, Recordings & Reporting Regression Suite')
  console.log('================================================================================')

  const originalFetch = globalThis.fetch
  const graphLog = []
  let outCallSeq = 0
  let outMsgSeq = 0

  // Build deterministic 4096-byte mock OggS audio buffer
  const mockOggBuffer = Buffer.alloc(MOCK_OGG_SIZE, 0x55)
  Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00').copy(mockOggBuffer, 0)
  const mockMediaDownloadUrl = `https://graph.facebook.com/v24.0/media_download/${MEDIA_ID_OGG}.ogg`

  // Stub globalThis.fetch strictly for https://graph.facebook.com/...
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url || '')
    if (u.startsWith('https://graph.facebook.com/')) {
      let parsedBody = null
      if (init.body) {
        try {
          parsedBody = JSON.parse(init.body)
        } catch (_) {
          parsedBody = String(init.body)
        }
      }
      graphLog.push({ url: u, method: init.method || 'GET', body: parsedBody })

      // 1. Media metadata lookup
      if (u === `${GRAPH_BASE}/${encodeURIComponent(MEDIA_ID_OGG)}`) {
        return new Response(
          JSON.stringify({ url: mockMediaDownloadUrl, mime_type: 'audio/ogg' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 2. Binary Ogg media download
      if (u === mockMediaDownloadUrl) {
        return new Response(mockOggBuffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/ogg' },
        })
      }

      // 3. Messages endpoint
      if (u.endsWith('/messages')) {
        const msgId = `qa_e2e_3_wamid_${++outMsgSeq}`
        return new Response(
          JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: msgId }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 4. Calls signaling endpoint
      if (u.endsWith('/calls')) {
        if (parsedBody?.action === 'connect') {
          const cid = `${CALL_PREFIX}out_${++outCallSeq}`
          return new Response(
            JSON.stringify({ messaging_product: 'whatsapp', calls: [{ id: cid }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(JSON.stringify({ messaging_product: 'whatsapp', success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return originalFetch(url, init)
  }

  let server = null
  let sseHarish = null
  let sseRahul = null
  let sseAdmin = null

  await connectDb()
  await purgeAllTestArtifacts()

  try {
    // Mount in-process Express server (127.0.0.1:0)
    const app = express()
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          req.rawBody = buf
        },
      })
    )
    app.use(optionalAuth)
    app.use('/api/whatsapp/webhook', whatsappWebhookRouter)
    app.use('/api/calls', callsRouter)
    app.use('/api/reports', reportsRouter)

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address()
    const baseUrl = `http://127.0.0.1:${port}`
    console.log(`In-process Express server mounted on ${baseUrl}\n`)

    const harishToken = signToken({ sub: 'qa_e2e_3_harish', username: 'harish', role: ROLES.TELECALLER })
    const rahulToken = signToken({ sub: 'qa_e2e_3_rahul', username: 'rahul', role: ROLES.TELECALLER })
    const adminToken = signToken({ sub: 'qa_e2e_3_admin', username: 'admin', role: ROLES.SUPER_ADMIN })

    async function postCallsWebhook(callsArray) {
      const payload = buildCallsWebhookPayload(callsArray)
      const raw = JSON.stringify(payload)
      const sig = signWebhookBody(raw)
      const res = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': sig,
        },
        body: raw,
      })
      assert.equal(res.status, 200, `Webhook POST expected 200, got ${res.status}`)
      return res
    }

    // Seed isolated test leads
    const now = new Date()
    await col('leads').insertMany([
      {
        phone: TEST_PHONES[0],
        name: 'QA E2E3 Harish Lead 1',
        district: 'qa_e2e_3_chennai',
        state: 'TAMIL NADU',
        source: 'whatsapp',
        status: 'contacted',
        assignedTo: 'harish',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: TEST_PHONES[1],
        name: 'QA E2E3 Unassigned Lead',
        district: 'qa_e2e_3_chennai',
        state: 'TAMIL NADU',
        source: 'whatsapp',
        status: 'new',
        assignedTo: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: TEST_PHONES[2],
        name: 'QA E2E3 Harish Busy Lead',
        district: 'qa_e2e_3_madurai',
        state: 'TAMIL NADU',
        source: 'whatsapp',
        status: 'contacted',
        assignedTo: 'harish',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: TEST_PHONES[3],
        name: 'QA E2E3 Harish Perm Rate Lead',
        district: 'qa_e2e_3_chennai',
        state: 'TAMIL NADU',
        source: 'whatsapp',
        status: 'contacted',
        assignedTo: 'harish',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: TEST_PHONES[4],
        name: 'QA E2E3 Harish Strikes Lead',
        district: 'qa_e2e_3_madurai',
        state: 'TAMIL NADU',
        source: 'whatsapp',
        status: 'contacted',
        assignedTo: 'harish',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: TEST_PHONES[5],
        name: 'QA E2E3 Rahul Lead 1',
        district: 'qa_e2e_3_coimbatore',
        state: 'TAMIL NADU',
        source: 'ctwa_ad',
        status: 'registered',
        assignedTo: 'rahul',
        createdAt: now,
        updatedAt: now,
      },
    ])

    // =========================================================================
    // 1. Phone Normalization (leadPhone())
    // =========================================================================
    console.log('--- 1. Phone Normalization (leadPhone()) ---')
    await runCheck(
      '1.1',
      "leadPhone() normalizes '+91 99998 20001', '919999820001', '9999820001', '09999820001' -> '919999820001'",
      () => {
        const inputs = ['+91 99998 20001', '919999820001', '9999820001', '09999820001']
        const outputs = inputs.map(v => leadPhone(v))
        for (let i = 0; i < inputs.length; i++) {
          assert.equal(
            outputs[i],
            '919999820001',
            `leadPhone('${inputs[i]}') returned '${outputs[i]}' instead of '919999820001'`
          )
        }
        return `All 4 formats normalized to '${outputs[0]}'`
      }
    )

    // =========================================================================
    // 2. Inbound Sticky Routing SSE Isolation & Active Call Polling
    // =========================================================================
    console.log('\n--- 2. Inbound Sticky Routing SSE Isolation & Active Call Polling ---')
    sseHarish = await openSseStream(baseUrl, harishToken)
    sseRahul = await openSseStream(baseUrl, rahulToken)
    sseAdmin = await openSseStream(baseUrl, adminToken)

    const CALL_HARISH_ASSIGNED = `${CALL_PREFIX}in_harish_1`
    const CALL_UNASSIGNED = `${CALL_PREFIX}in_unassigned_1`

    await postCallsWebhook([
      {
        id: CALL_HARISH_ASSIGNED,
        from: '+91 99998 20001',
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=harish_in 1 1 IN IP4 127.0.0.1\r\n' },
      },
    ])

    // Wait for harish SSE stream and DB insert
    await waitFor(
      () =>
        sseHarish.events.some(
          e =>
            e.event === 'call' &&
            e.data?.type === 'incoming_call' &&
            e.data?.call?.callId === CALL_HARISH_ASSIGNED
        ),
      3000
    )
    // Allow brief settle window to ensure any unintended frames on rahul/admin would have flushed
    await new Promise(r => setTimeout(r, 200))

    await runCheck(
      '2.1a',
      'Assigned lead inbound connect: harish receives incoming_call SSE, rahul receives ZERO events & /api/calls/active excludes call for rahul',
      async () => {
        const harishCallEvts = sseHarish.events.filter(e => e.event === 'call')
        const rahulCallEvts = sseRahul.events.filter(e => e.event === 'call')

        assert.ok(
          harishCallEvts.some(
            e => e.data?.type === 'incoming_call' && e.data?.call?.callId === CALL_HARISH_ASSIGNED
          ),
          'harish did not receive incoming_call SSE event'
        )
        assert.equal(
          rahulCallEvts.length,
          0,
          `Expected 0 SSE call events for rahul, got ${rahulCallEvts.length}`
        )

        const [activeHarishRes, activeRahulRes] = await Promise.all([
          fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${harishToken}` } }),
          fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${rahulToken}` } }),
        ])
        assert.equal(activeHarishRes.status, 200)
        assert.equal(activeRahulRes.status, 200)
        const harishIds = (await activeHarishRes.json()).calls.map(c => c.callId)
        const rahulIds = (await activeRahulRes.json()).calls.map(c => c.callId)

        assert.ok(harishIds.includes(CALL_HARISH_ASSIGNED), 'GET /api/calls/active for harish missing call')
        assert.ok(!rahulIds.includes(CALL_HARISH_ASSIGNED), 'GET /api/calls/active for rahul leaked harish call')
        return `harish SSE=1, rahul SSE=0, active(rahul) excludes ${CALL_HARISH_ASSIGNED}`
      }
    )

    await runCheck(
      '2.1b',
      'Assigned lead inbound connect: admin (super_admin) receives incoming_call SSE event',
      () => {
        const adminCallEvts = sseAdmin.events.filter(e => e.event === 'call')
        const gotHarishCall = adminCallEvts.some(
          e => e.data?.type === 'incoming_call' && e.data?.call?.callId === CALL_HARISH_ASSIGNED
        )
        assert.ok(
          gotHarishCall,
          `admin (role=super_admin) received ${adminCallEvts.length} SSE events for ${CALL_HARISH_ASSIGNED}; canAdminReceiveCall() in services/calling.js:1125 checks assigned===username without bypassing super_admin (and scope=all in routes/calls.js:91 is restricted to super_super_admin)`
        )
        return `admin SSE received ${CALL_HARISH_ASSIGNED}`
      }
    )

    await postCallsWebhook([
      {
        id: CALL_UNASSIGNED,
        from: TEST_PHONES[1],
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=unassigned_in 1 1 IN IP4 127.0.0.1\r\n' },
      },
    ])

    await runCheck(
      '2.2',
      'Unassigned lead inbound connect: all three (harish, rahul, admin) receive incoming_call SSE event',
      async () => {
        const allReceived = await waitFor(() => {
          const h = sseHarish.events.some(
            e => e.event === 'call' && e.data?.type === 'incoming_call' && e.data?.call?.callId === CALL_UNASSIGNED
          )
          const r = sseRahul.events.some(
            e => e.event === 'call' && e.data?.type === 'incoming_call' && e.data?.call?.callId === CALL_UNASSIGNED
          )
          const a = sseAdmin.events.some(
            e => e.event === 'call' && e.data?.type === 'incoming_call' && e.data?.call?.callId === CALL_UNASSIGNED
          )
          return h && r && a
        }, 3000)

        assert.ok(allReceived, `One or more SSE streams missed unassigned call ${CALL_UNASSIGNED}`)
        return `harish, rahul, and admin all received ${CALL_UNASSIGNED}`
      }
    )

    // =========================================================================
    // 3. Concurrent Busy-Telecaller Auto-Reject + 409 Conflict Double-Accept
    // =========================================================================
    console.log('\n--- 3. Concurrent Busy-Telecaller Auto-Reject + 409 Double-Accept Protection ---')
    await runCheck(
      '3.1a',
      'harish accepts unassigned ringing call via POST /api/calls/:callId/accept -> 200 OK',
      async () => {
        const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_UNASSIGNED)}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({ sdpAnswer: 'v=0\r\no=harish_ans 1 1 IN IP4 127.0.0.1\r\n' }),
        })
        assert.equal(res.status, 200, `Expected 200 OK for harish accept, got ${res.status}`)
        const json = await res.json()
        assert.equal(json.call?.status, 'accepted')
        assert.equal(json.call?.attended, true)
        assert.equal(json.call?.telecaller_id, 'harish')
        return `200 OK, status='accepted', telecaller_id='harish'`
      }
    )

    await runCheck(
      '3.1b',
      'rahul immediately calls POST /api/calls/:callId/accept on same call -> 409 Conflict',
      async () => {
        const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_UNASSIGNED)}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${rahulToken}`,
          },
          body: JSON.stringify({ sdpAnswer: 'v=0\r\no=rahul_ans 1 1 IN IP4 127.0.0.1\r\n' }),
        })
        const body = await res.json().catch(() => ({}))
        assert.equal(
          res.status,
          409,
          `Expected 409 Conflict when rahul accepts already-accepted call, got HTTP ${res.status} (${body.message || 'no message'}) — routes/calls.js:218 runs assertTelecallerCallAccess() before acceptCall(), returning 403 once telecaller_id='harish' is set`
        )
        return `409 Conflict (${body.message})`
      }
    )

    const CALL_BUSY = `${CALL_PREFIX}in_busy_1`
    await runCheck(
      '3.2',
      "While harish is in accepted call, inbound call for harish's other lead auto-rejects (endReason='telecaller_busy', status='missed', Graph action='reject')",
      async () => {
        graphLog.length = 0
        await postCallsWebhook([
          {
            id: CALL_BUSY,
            from: TEST_PHONES[2],
            event: 'connect',
            direction: 'USER_INITIATED',
            session: { sdp_type: 'offer', sdp: 'v=0\r\no=busy_in 1 1 IN IP4 127.0.0.1\r\n' },
          },
        ])

        const settled = await waitFor(
          () =>
            sseHarish.events.some(
              e => e.event === 'call' && e.data?.type === 'call_update' && e.data?.call?.callId === CALL_BUSY
            ),
          4000
        )
        assert.ok(settled, `${CALL_BUSY} did not finish busy-reject webhook processing`)

        const busyDoc = await col('whatsapp_calls').findOne({ callId: CALL_BUSY })
        assert.equal(busyDoc.endReason, 'telecaller_busy')
        assert.equal(busyDoc.status, 'missed')
        assert.equal(busyDoc.attended, false)
        assert.equal(busyDoc.telecaller_id, 'harish')

        const rejectReq = graphLog.find(
          r => r.url.endsWith('/calls') && r.body?.action === 'reject' && r.body?.call_id === CALL_BUSY
        )
        assert.ok(rejectReq, `Expected Graph API POST /calls with action='reject' for ${CALL_BUSY}`)

        return `status='${busyDoc.status}', endReason='${busyDoc.endReason}', Graph action='reject' verified`
      }
    )

    // Cleanly end active calls from section 2/3 so harish is no longer busy for section 4 & 5
    await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_UNASSIGNED)}/terminate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${harishToken}` },
    })
    await postCallsWebhook([{ id: CALL_HARISH_ASSIGNED, from: TEST_PHONES[0], event: 'terminate', duration: 0 }])
    await waitFor(
      () =>
        sseHarish.events.some(
          e => e.event === 'call' && e.data?.type === 'call_ended' && e.data?.call?.callId === CALL_HARISH_ASSIGNED
        ),
      4000
    )

    // =========================================================================
    // 4. Permission Rate Limits, Connected-Call Reset & Unanswered Strike Rules
    // =========================================================================
    console.log('\n--- 4. Permission Rate Limits, Connected-Call Reset & Unanswered Strike Rules ---')
    const PERM_RATE_PHONE = TEST_PHONES[3]
    const PERM_STRIKE_PHONE = TEST_PHONES[4]

    await runCheck(
      '4.1',
      '1/24h rate limit: 1st request 200 OK, 2nd request within 24h blocked with 429',
      async () => {
        const res1 = await fetch(`${baseUrl}/api/calls/permission-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({ phone: PERM_RATE_PHONE, bodyText: 'qa_e2e_3 perm req 1' }),
        })
        assert.equal(res1.status, 200, `1st permission request expected 200, got ${res1.status}`)

        const rateAfter1 = await checkPermissionRequestRateLimit(PERM_RATE_PHONE)
        assert.equal(rateAfter1.allowed, false)
        assert.equal(rateAfter1.count24h, 1)

        const res2 = await fetch(`${baseUrl}/api/calls/permission-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({ phone: PERM_RATE_PHONE, bodyText: 'qa_e2e_3 perm req 2' }),
        })
        const body2 = await res2.json()
        assert.equal(res2.status, 429, `Expected 429 on 2nd request within 24h, got ${res2.status}`)
        assert.match(body2.message || '', /1 call permission request per 24 hours/i)
        return `1st=200, 2nd=429 (count24h=${rateAfter1.count24h})`
      }
    )

    await runCheck(
      '4.2',
      '2/7d rate limit: seeding 2 timestamps (2d & 4d ago) blocks 3rd request within 7d with 429',
      async () => {
        const nowTs = new Date()
        const twoDaysAgo = new Date(nowTs.getTime() - 2 * 24 * 3600 * 1000)
        const fourDaysAgo = new Date(nowTs.getTime() - 4 * 24 * 3600 * 1000)
        await col('call_permissions').updateOne(
          { waId: PERM_RATE_PHONE },
          { $set: { requestTimestamps: [fourDaysAgo, twoDaysAgo], updatedAt: nowTs } }
        )

        const rateCheck = await checkPermissionRequestRateLimit(PERM_RATE_PHONE, nowTs)
        assert.equal(rateCheck.allowed, false)
        assert.equal(rateCheck.count24h, 0)
        assert.equal(rateCheck.count7d, 2)

        const res3 = await fetch(`${baseUrl}/api/calls/permission-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({ phone: PERM_RATE_PHONE, bodyText: 'qa_e2e_3 perm req 3' }),
        })
        const body3 = await res3.json()
        assert.equal(res3.status, 429, `Expected 429 on 3rd request within 7d, got ${res3.status}`)
        assert.match(body3.message || '', /2 call permission requests per 7 days/i)
        return `count24h=0, count7d=2 -> blocked with 429`
      }
    )

    await runCheck(
      '4.3',
      'Connected outbound call (attended: true) resets requestTimestamps: [] and consecutiveUnansweredOutbound: 0',
      async () => {
        await recordCallPermissionReply(PERM_RATE_PHONE, 'accept', { response: 'accept' })
        // Seed non-zero consecutiveUnansweredOutbound while keeping existing requestTimestamps
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000)
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600 * 1000)
        await col('call_permissions').updateOne(
          { waId: PERM_RATE_PHONE },
          {
            $set: {
              requestTimestamps: [fourDaysAgo, twoDaysAgo],
              consecutiveUnansweredOutbound: 1,
              unansweredWarning: false,
            },
          }
        )

        const outRes = await fetch(`${baseUrl}/api/calls/outbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({
            phone: PERM_RATE_PHONE,
            sdpOffer: 'v=0\r\no=out_conn 1 1 IN IP4 127.0.0.1\r\n',
          }),
        })
        assert.equal(outRes.status, 200, `Outbound initiate expected 200, got ${outRes.status}`)
        const { callId } = await outRes.json()

        await postCallsWebhook([
          {
            id: callId,
            from: PERM_RATE_PHONE,
            direction: 'BUSINESS_INITIATED',
            event: 'connect',
            session: { sdp_type: 'answer', sdp: 'v=0\r\no=ans 1 1 IN IP4 127.0.0.1\r\n' },
          },
          {
            id: callId,
            from: PERM_RATE_PHONE,
            direction: 'BUSINESS_INITIATED',
            event: 'terminate',
            duration: 45,
          },
        ])

        const done = await waitFor(
          () =>
            sseHarish.events.some(
              e => e.event === 'call' && e.data?.type === 'call_ended' && e.data?.call?.callId === callId
            ),
          4000
        )
        assert.ok(done, `Outbound call ${callId} did not finish call_ended webhook processing`)

        const cDoc = await col('whatsapp_calls').findOne({ callId })
        assert.equal(cDoc?.status, 'completed')
        assert.equal(cDoc?.attended, true)

        const permDoc = await col('call_permissions').findOne({ waId: PERM_RATE_PHONE })
        assert.deepEqual(permDoc.requestTimestamps, [])
        assert.equal(permDoc.consecutiveUnansweredOutbound, 0)
        return `requestTimestamps=[], consecutiveUnansweredOutbound=0 after connected call ${callId}`
      }
    )

    await runCheck(
      '4.4a',
      "2 consecutive unanswered outbound calls sets unansweredWarning: true while status remains 'accepted'",
      async () => {
        await recordCallPermissionReply(PERM_STRIKE_PHONE, 'accept', { response: 'accept' })

        for (let i = 1; i <= 2; i++) {
          const outRes = await fetch(`${baseUrl}/api/calls/outbound`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${harishToken}`,
            },
            body: JSON.stringify({
              phone: PERM_STRIKE_PHONE,
              sdpOffer: `v=0\r\no=strike_${i} 1 1 IN IP4 127.0.0.1\r\n`,
            }),
          })
          assert.equal(outRes.status, 200)
          const { callId } = await outRes.json()

          await postCallsWebhook([
            {
              id: callId,
              from: PERM_STRIKE_PHONE,
              direction: 'BUSINESS_INITIATED',
              event: 'terminate',
              end_reason: 'no_answer',
              duration: 0,
            },
          ])
          const ended = await waitFor(
            () =>
              sseHarish.events.some(
                e => e.event === 'call' && e.data?.type === 'call_ended' && e.data?.call?.callId === callId
              ),
            4000
          )
          assert.ok(ended, `Strike ${i} call ${callId} did not finish call_ended webhook processing`)
        }

        const doc2 = await col('call_permissions').findOne({ waId: PERM_STRIKE_PHONE })
        assert.equal(doc2.consecutiveUnansweredOutbound, 2)
        assert.equal(doc2.unansweredWarning, true)
        assert.equal(doc2.status, 'accepted')
        return `consecutiveUnansweredOutbound=2, unansweredWarning=true, status='accepted'`
      }
    )

    await runCheck(
      '4.4b',
      "4 consecutive unanswered outbound calls revokes permission (status: 'revoked', revokedReason: '4_consecutive_unanswered')",
      async () => {
        for (let i = 3; i <= 4; i++) {
          const outRes = await fetch(`${baseUrl}/api/calls/outbound`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${harishToken}`,
            },
            body: JSON.stringify({
              phone: PERM_STRIKE_PHONE,
              sdpOffer: `v=0\r\no=strike_${i} 1 1 IN IP4 127.0.0.1\r\n`,
            }),
          })
          assert.equal(outRes.status, 200)
          const { callId } = await outRes.json()

          await postCallsWebhook([
            {
              id: callId,
              from: PERM_STRIKE_PHONE,
              direction: 'BUSINESS_INITIATED',
              event: 'terminate',
              end_reason: 'no_answer',
              duration: 0,
            },
          ])
          const ended = await waitFor(
            () =>
              sseHarish.events.some(
                e => e.event === 'call' && e.data?.type === 'call_ended' && e.data?.call?.callId === callId
              ),
            4000
          )
          assert.ok(ended, `Strike ${i} call ${callId} did not finish call_ended webhook processing`)
        }

        const permAfter4 = await getCallPermission(PERM_STRIKE_PHONE)
        const doc4 = await col('call_permissions').findOne({ waId: PERM_STRIKE_PHONE })
        assert.equal(permAfter4.allowed, false, 'Permission should no longer be allowed after 4 unanswered calls')
        assert.equal(doc4.consecutiveUnansweredOutbound, 4)
        assert.equal(doc4.revokedReason, '4_consecutive_unanswered')
        assert.equal(
          doc4.status,
          'revoked',
          `Expected call_permissions.status === 'revoked', got '${doc4.status}' (revokedReason='${doc4.revokedReason}', allowed=${permAfter4.allowed} — services/calling.js:1050 writes status: 'rejected' instead of 'revoked')`
        )
        return `status='${doc4.status}', revokedReason='${doc4.revokedReason}', allowed=false`
      }
    )

    // =========================================================================
    // 5. Recording Download, 206 Byte-Range Streaming & Auth Isolation
    // =========================================================================
    console.log('\n--- 5. Recording Download, 206 Byte-Range Streaming & Auth Isolation ---')
    const CALL_REC = `${CALL_PREFIX}rec_1`

    await runCheck(
      '5.1',
      "Webhook terminate + media_id downloads 4096-byte OggS buffer -> recording_status='ready', recordingSizeBytes=4096, SSE call_update emitted, file saved in protected_recordings/",
      async () => {
        // Connect + accept as harish
        await postCallsWebhook([
          {
            id: CALL_REC,
            from: TEST_PHONES[0],
            event: 'connect',
            direction: 'USER_INITIATED',
            session: { sdp_type: 'offer', sdp: 'v=0\r\no=rec_in 1 1 IN IP4 127.0.0.1\r\n' },
          },
        ])
        await waitFor(async () => Boolean(await col('whatsapp_calls').findOne({ callId: CALL_REC })), 2000)

        const accRes = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_REC)}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${harishToken}`,
          },
          body: JSON.stringify({ sdpAnswer: 'v=0\r\no=rec_ans 1 1 IN IP4 127.0.0.1\r\n' }),
        })
        assert.equal(accRes.status, 200)

        const sseStartIdx = sseHarish.events.length

        // Simulate terminate with media_id (triggers ingestCallRecording)
        await postCallsWebhook([
          {
            id: CALL_REC,
            from: TEST_PHONES[0],
            event: 'terminate',
            duration: 32,
            media_id: MEDIA_ID_OGG,
          },
        ])

        const readyInDbAndSse = await waitFor(async () => {
          const doc = await col('whatsapp_calls').findOne({ callId: CALL_REC })
          const slice = sseHarish.events.slice(sseStartIdx)
          const sseReady = slice.some(
            e =>
              e.event === 'call' &&
              e.data?.type === 'call_update' &&
              e.data?.call?.callId === CALL_REC &&
              e.data?.call?.recording_status === 'ready'
          )
          const sseEnded = slice.some(
            e => e.event === 'call' && e.data?.type === 'call_ended' && e.data?.call?.callId === CALL_REC
          )
          return doc?.recording_status === 'ready' && sseReady && sseEnded
        }, 5000)

        assert.ok(readyInDbAndSse, 'Timed out waiting for recording_status=ready in DB and SSE call_update')

        const recDoc = await col('whatsapp_calls').findOne({ callId: CALL_REC })
        assert.equal(recDoc.recording_status, 'ready')
        assert.equal(recDoc.recordingSizeBytes, MOCK_OGG_SIZE)
        assert.equal(recDoc.recordingMimeType, 'audio/ogg')

        const savedFilePath = path.join(PROTECTED_RECORDINGS_DIR, recDoc.recording_file)
        assert.ok(fs.existsSync(savedFilePath), `Missing file on disk: ${savedFilePath}`)
        const diskBuf = fs.readFileSync(savedFilePath)
        assert.equal(diskBuf.length, MOCK_OGG_SIZE)
        assert.equal(diskBuf.subarray(0, 4).toString('ascii'), 'OggS')

        return `recording_status='ready', size=${recDoc.recordingSizeBytes}B, SSE call_update verified, file=${recDoc.recording_file}`
      }
    )

    await runCheck(
      '5.2a',
      'GET /api/calls/:callId/recording unauthenticated -> 401 Unauthorized',
      async () => {
        const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_REC)}/recording`)
        assert.equal(res.status, 401, `Expected 401 unauthenticated, got ${res.status}`)
        return '401 Unauthorized'
      }
    )

    await runCheck(
      '5.2b',
      "GET /api/calls/:callId/recording as rahul (other telecaller) -> 403 Forbidden",
      async () => {
        const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_REC)}/recording`, {
          headers: { Authorization: `Bearer ${rahulToken}` },
        })
        assert.equal(res.status, 403, `Expected 403 for unassigned telecaller rahul, got ${res.status}`)
        return '403 Forbidden'
      }
    )

    await runCheck(
      '5.2c',
      'GET /api/calls/:callId/recording as harish with Range: bytes=0-1023 -> 206 Partial Content, Content-Range: bytes 0-1023/4096, Accept-Ranges: bytes, 1024 bytes',
      async () => {
        const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_REC)}/recording`, {
          headers: {
            Authorization: `Bearer ${harishToken}`,
            Range: 'bytes=0-1023',
          },
        })
        assert.equal(res.status, 206, `Expected 206 Partial Content, got ${res.status}`)
        assert.equal(res.headers.get('content-range'), 'bytes 0-1023/4096')
        assert.equal(res.headers.get('accept-ranges'), 'bytes')
        assert.equal(res.headers.get('content-length'), '1024')
        const buf = Buffer.from(await res.arrayBuffer())
        assert.equal(buf.length, 1024)
        assert.ok(buf.equals(mockOggBuffer.subarray(0, 1024)), 'Byte-range slice mismatch against OggS buffer')
        return '206 Partial Content, Content-Range: bytes 0-1023/4096, body=1024B'
      }
    )

    // =========================================================================
    // 6. Reporting & CSV Export Role Isolation (/api/reports/calls & /api/calls/export)
    // =========================================================================
    console.log('\n--- 6. Reporting & CSV Export Role Isolation ---')
    // Seed deterministic calls in an isolated date window (2099-06-01 .. 2099-06-02)
    // so live/historical records in isydci_crm cannot skew assertions
    const REP_FROM = '2099-06-01'
    const REP_TO = '2099-06-02'
    const REP_CALLS = [
      {
        callId: `${CALL_PREFIX}rep_1`,
        waId: TEST_PHONES[0],
        telecaller_id: 'harish',
        direction: 'inbound',
        call_direction: 'inbound',
        status: 'completed',
        attended: true,
        startedAt: new Date('2099-06-01T10:00:00.000+05:30'),
        answeredAt: new Date('2099-06-01T10:00:05.000+05:30'),
        endedAt: new Date('2099-06-01T10:02:05.000+05:30'),
        durationSec: 120,
        duration_seconds: 120,
        recording_status: 'ready',
        endReason: 'caller_hangup',
        createdAt: new Date('2099-06-01T10:00:00.000+05:30'),
      },
      {
        callId: `${CALL_PREFIX}rep_2`,
        waId: TEST_PHONES[2],
        telecaller_id: 'harish',
        direction: 'inbound',
        call_direction: 'inbound',
        status: 'missed',
        attended: false,
        startedAt: new Date('2099-06-01T10:01:00.000+05:30'),
        answeredAt: null,
        endedAt: new Date('2099-06-01T10:01:00.000+05:30'),
        durationSec: 0,
        duration_seconds: 0,
        recording_status: 'none',
        endReason: 'telecaller_busy',
        createdAt: new Date('2099-06-01T10:01:00.000+05:30'),
      },
      {
        callId: `${CALL_PREFIX}rep_3`,
        waId: TEST_PHONES[3],
        telecaller_id: 'harish',
        direction: 'outbound',
        call_direction: 'outbound',
        status: 'missed',
        attended: false,
        startedAt: new Date('2099-06-01T11:30:00.000+05:30'),
        answeredAt: null,
        endedAt: new Date('2099-06-01T11:30:30.000+05:30'),
        durationSec: 0,
        duration_seconds: 0,
        recording_status: 'none',
        endReason: 'no_answer',
        createdAt: new Date('2099-06-01T11:30:00.000+05:30'),
      },
      {
        callId: `${CALL_PREFIX}rep_4`,
        waId: TEST_PHONES[5],
        telecaller_id: 'rahul',
        direction: 'outbound',
        call_direction: 'outbound',
        status: 'completed',
        attended: true,
        startedAt: new Date('2099-06-02T14:00:00.000+05:30'),
        answeredAt: new Date('2099-06-02T14:00:04.000+05:30'),
        endedAt: new Date('2099-06-02T14:03:04.000+05:30'),
        durationSec: 180,
        duration_seconds: 180,
        recording_status: 'ready',
        endReason: 'agent_hangup',
        createdAt: new Date('2099-06-02T14:00:00.000+05:30'),
      },
      {
        callId: `${CALL_PREFIX}rep_5`,
        waId: TEST_PHONES[5],
        telecaller_id: 'rahul',
        direction: 'inbound',
        call_direction: 'inbound',
        status: 'missed',
        attended: false,
        startedAt: new Date('2099-06-02T16:15:00.000+05:30'),
        answeredAt: null,
        endedAt: new Date('2099-06-02T16:15:25.000+05:30'),
        durationSec: 0,
        duration_seconds: 0,
        recording_status: 'none',
        endReason: 'no_answer',
        createdAt: new Date('2099-06-02T16:15:00.000+05:30'),
      },
    ]
    await col('whatsapp_calls').insertMany(REP_CALLS)

    await runCheck(
      '6.1',
      'GET /api/reports/calls scopes harish strictly to harish (ignoring ?telecaller_id=rahul) while admin sees all telecallers (harish + rahul) with exact answered/missed/telecaller_busy counts',
      async () => {
        const [harishRepRes, adminRepRes] = await Promise.all([
          fetch(`${baseUrl}/api/reports/calls?from=${REP_FROM}&to=${REP_TO}&telecaller_id=rahul`, {
            headers: { Authorization: `Bearer ${harishToken}` },
          }),
          fetch(`${baseUrl}/api/reports/calls?from=${REP_FROM}&to=${REP_TO}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          }),
        ])
        assert.equal(harishRepRes.status, 200)
        assert.equal(adminRepRes.status, 200)

        const harishBody = await harishRepRes.json()
        const adminBody = await adminRepRes.json()

        // Harish isolation assertions
        assert.equal(harishBody.scopedTelecaller, 'harish')
        assert.equal(harishBody.report.summary.totalCalls, 3)
        assert.equal(harishBody.report.summary.answeredCalls, 1)
        assert.equal(harishBody.report.summary.missedCalls, 2)
        const harishBusyReason = harishBody.report.endReasons.find(r => r.reason === 'telecaller_busy')
        assert.equal(harishBusyReason?.count, 1)
        assert.equal(harishBody.report.telecallerLeaderboard.length, 1)
        assert.equal(harishBody.report.telecallerLeaderboard[0].telecallerId, 'harish')

        // Admin full-visibility assertions
        assert.equal(adminBody.scopedTelecaller, null)
        assert.equal(adminBody.report.summary.totalCalls, 5)
        assert.equal(adminBody.report.summary.answeredCalls, 2)
        assert.equal(adminBody.report.summary.missedCalls, 3)
        const adminBusyReason = adminBody.report.endReasons.find(r => r.reason === 'telecaller_busy')
        assert.equal(adminBusyReason?.count, 1)

        const tcIds = adminBody.report.telecallerLeaderboard.map(t => t.telecallerId).sort()
        assert.deepEqual(tcIds, ['harish', 'rahul'])

        return `harish=(total:3, answered:1, missed:2, busy:1); admin=(total:5, answered:2, missed:3, busy:1, leaderboard:[harish,rahul])`
      }
    )

    await runCheck(
      '6.2',
      'GET /api/calls/export as harish exports only harish rows (even with ?telecaller_id=rahul), while admin exports all matching rows',
      async () => {
        const [harishCsvRes, adminCsvRes] = await Promise.all([
          fetch(`${baseUrl}/api/calls/export?from=${REP_FROM}&to=${REP_TO}&telecaller_id=rahul`, {
            headers: { Authorization: `Bearer ${harishToken}` },
          }),
          fetch(`${baseUrl}/api/calls/export?from=${REP_FROM}&to=${REP_TO}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          }),
        ])
        assert.equal(harishCsvRes.status, 200)
        assert.equal(adminCsvRes.status, 200)
        assert.match(harishCsvRes.headers.get('content-type') || '', /text\/csv/i)
        assert.match(adminCsvRes.headers.get('content-type') || '', /text\/csv/i)

        const harishRows = parseCsv(await harishCsvRes.text())
        const adminRows = parseCsv(await adminCsvRes.text())

        // 1 header + 3 harish rows
        assert.equal(harishRows.length, 4, `Expected 4 CSV lines for harish, got ${harishRows.length}`)
        assert.ok(
          harishRows.slice(1).every(r => r[6] === 'harish'),
          'Harish CSV leaked non-harish rows'
        )

        // 1 header + 5 total rows
        assert.equal(adminRows.length, 6, `Expected 6 CSV lines for admin, got ${adminRows.length}`)
        const exportedTelecallers = new Set(adminRows.slice(1).map(r => r[6]))
        assert.ok(exportedTelecallers.has('harish') && exportedTelecallers.has('rahul'))
        const busyRow = adminRows.slice(1).find(r => r[0] === `${CALL_PREFIX}rep_2`)
        assert.equal(busyRow?.[15], 'telecaller_busy')

        return `harish CSV=3 data rows (only harish), admin CSV=5 data rows (harish+rahul)`
      }
    )
  } finally {
    console.log('\n--- Cleanup & Zero-Leftover Verification (finally) ---')
    if (sseHarish) await sseHarish.close().catch(() => {})
    if (sseRahul) await sseRahul.close().catch(() => {})
    if (sseAdmin) await sseAdmin.close().catch(() => {})
    if (server) await new Promise(resolve => server.close(resolve)).catch(() => {})
    globalThis.fetch = originalFetch

    const deleted = await purgeAllTestArtifacts()
    console.log('  Deleted temporary artifacts:', JSON.stringify(deleted))

    const leftovers = await countLeftoverTestArtifacts()
    console.log('  Leftover temporary artifacts:', JSON.stringify(leftovers))
    assert.equal(
      leftovers.total,
      0,
      `Expected 0 leftover temporary QA items, found: ${JSON.stringify(leftovers)}`
    )

    await closeDb()
  }

  console.log('\n================================================================================')
  console.log(`FINAL REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`)
  console.log('================================================================================')
  for (const r of results) {
    console.log(`  [${r.status}] ${r.id} ${r.title} -> ${r.detail}`)
  }

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal regression runner error:', err)
  process.exit(1)
})
