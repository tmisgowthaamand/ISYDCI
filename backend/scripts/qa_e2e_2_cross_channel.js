// QA Sub-Agent 2: Messaging <-> Calling Cross-Channel Integration Suite
// Usage: Set-Location backend; node scripts/qa_e2e_2_cross_channel.js

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

// Ensure required in-process env vars exist without mutating .env on disk
if (!process.env.WHATSAPP_TOKEN) process.env.WHATSAPP_TOKEN = 'qa_e2e_2_mock_token'
if (!process.env.WHATSAPP_PHONE_NUMBER_ID) process.env.WHATSAPP_PHONE_NUMBER_ID = '100000000000002'
if (!process.env.WHATSAPP_APP_SECRET && !process.env.APP_SECRET) {
  process.env.WHATSAPP_APP_SECRET = 'qa_e2e_2_mock_app_secret'
}
// Ensure missed-call fallback is enabled for cross-channel guard verification
delete process.env.WHATSAPP_MISSED_CALL_FALLBACK

import { connectDb, closeDb, col } from '../db/mongo.js'
import { optionalAuth, ROLES, signToken } from '../services/auth.js'
import { PROTECTED_RECORDINGS_DIR } from '../services/calling.js'
import whatsappWebhookRouter from '../routes/whatsappWebhook.js'
import callsRouter from '../routes/calls.js'
import leadsRouter from '../routes/leads.js'

// Strictly isolated test identifiers
const PHONE_1 = '919999810001'
const PHONE_2 = '919999810002'
const TEST_PHONES = [PHONE_1, PHONE_2]

const CALL_OUT_1 = 'qa_e2e_2_call_out_1'
const CALL_OUT_FROM_BUG = 'qa_e2e_2_call_out_from_bug'
const CALL_IN_1 = 'qa_e2e_2_call_in_1'
const CALL_BUSY_1 = 'qa_e2e_2_call_busy_1'
const CALL_BUSY_2 = 'qa_e2e_2_call_busy_2'
const CALL_OUT_NOANS = 'qa_e2e_2_call_out_noans'
const CALL_IN_MISSED = 'qa_e2e_2_call_in_missed'

const MSG_IN_CTWA = 'wamid.qa_e2e_2_in_ctwa_1'
const MSG_IN_LEAD2 = 'wamid.qa_e2e_2_in_lead2_1'
const MSG_IN_PERM_ACCEPT = 'wamid.qa_e2e_2_in_perm_accept_1'
const MEDIA_ID_OGG = 'qa_e2e_2_media_ogg_1'
const MOCK_MEDIA_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/qa_e2e_2_recording.ogg'
const MOCK_OGG_BYTES = Buffer.concat([
  Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00', 'binary'),
  Buffer.alloc(256, 0x4f),
])

const results = []
const gaps = []

function recordPass(id, title, detail = '') {
  results.push({ id, status: 'PASS', title, detail })
  console.log(`✅ [PASS] ${id}: ${title}${detail ? ` — ${detail}` : ''}`)
}

function recordFail(id, title, err) {
  const detail = err?.stack || err?.message || String(err)
  results.push({ id, status: 'FAIL', title, detail: err?.message || String(err) })
  console.error(`❌ [FAIL] ${id}: ${title} — ${err?.message || err}`)
}

function recordGap(id, title, fileRef, detail) {
  gaps.push({ id, title, fileRef, detail })
  console.warn(`⚠️  [GAP]  ${id} (${fileRef}): ${title} — ${detail}`)
}

async function checkStep(id, title, fn) {
  try {
    const detail = await fn()
    recordPass(id, title, typeof detail === 'string' ? detail : '')
  } catch (err) {
    recordFail(id, title, err)
  }
}

async function waitFor(predicate, { timeoutMs = 4000, intervalMs = 25, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastVal = null
  while (Date.now() < deadline) {
    lastVal = await predicate()
    if (lastVal) return lastVal
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`)
}

function signWebhookPayload(rawBody) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

async function cleanupTestArtifacts() {
  const testPhoneRegex = /91999981000[12]/
  const testIdRegex = /^(wamid\.qa_e2e_2_|qa_e2e_2_)/

  await Promise.all([
    col('leads').deleteMany({ phone: { $in: TEST_PHONES } }),
    col('messages').deleteMany({
      $or: [
        { leadPhone: { $in: TEST_PHONES } },
        { waMessageId: testIdRegex },
      ],
    }),
    col('whatsapp_calls').deleteMany({
      $or: [
        { waId: { $in: TEST_PHONES } },
        { callId: /^qa_e2e_2_call_/ },
      ],
    }),
    col('call_permissions').deleteMany({ waId: { $in: TEST_PHONES } }),
    col('audit_logs').deleteMany({
      $or: [
        { actor: /^qa_e2e_2_/ },
        { path: /91999981000[12]|qa_e2e_2_/ },
        { target: /91999981000[12]|qa_e2e_2_/ },
        { details: /91999981000[12]|qa_e2e_2_/ },
      ],
    }),
    col('webhook_events').deleteMany({
      $or: [
        { summary: /91999981000[12]|qa_e2e_2_/ },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.from': { $in: TEST_PHONES } },
        { 'payload.to': { $in: TEST_PHONES } },
        { 'payload.id': testIdRegex },
        { 'payload.callId': /^qa_e2e_2_call_/ },
      ],
    }),
  ])

  if (fs.existsSync(PROTECTED_RECORDINGS_DIR)) {
    for (const file of fs.readdirSync(PROTECTED_RECORDINGS_DIR)) {
      if (file.startsWith('qa_e2e_2_')) {
        fs.unlinkSync(path.join(PROTECTED_RECORDINGS_DIR, file))
      }
    }
  }
}

async function countRemainingTestArtifacts() {
  const testIdRegex = /^(wamid\.qa_e2e_2_|qa_e2e_2_)/
  const [leadsCount, messagesCount, callsCount, permsCount, auditCount, eventsCount] = await Promise.all([
    col('leads').countDocuments({ phone: { $in: TEST_PHONES } }),
    col('messages').countDocuments({
      $or: [{ leadPhone: { $in: TEST_PHONES } }, { waMessageId: testIdRegex }],
    }),
    col('whatsapp_calls').countDocuments({
      $or: [{ waId: { $in: TEST_PHONES } }, { callId: /^qa_e2e_2_call_/ }],
    }),
    col('call_permissions').countDocuments({ waId: { $in: TEST_PHONES } }),
    col('audit_logs').countDocuments({
      $or: [
        { actor: /^qa_e2e_2_/ },
        { path: /91999981000[12]|qa_e2e_2_/ },
        { target: /91999981000[12]|qa_e2e_2_/ },
        { details: /91999981000[12]|qa_e2e_2_/ },
      ],
    }),
    col('webhook_events').countDocuments({
      $or: [
        { summary: /91999981000[12]|qa_e2e_2_/ },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.from': { $in: TEST_PHONES } },
        { 'payload.to': { $in: TEST_PHONES } },
        { 'payload.id': testIdRegex },
        { 'payload.callId': /^qa_e2e_2_call_/ },
      ],
    }),
  ])

  const leftoverFiles = fs.existsSync(PROTECTED_RECORDINGS_DIR)
    ? fs.readdirSync(PROTECTED_RECORDINGS_DIR).filter(f => f.startsWith('qa_e2e_2_'))
    : []

  return {
    leadsCount,
    messagesCount,
    callsCount,
    permsCount,
    auditCount,
    eventsCount,
    leftoverFiles: leftoverFiles.length,
  }
}

async function main() {
  console.log('================================================================================')
  console.log('🧪 Sub-Agent 2: Messaging <-> Calling Cross-Channel Integration Suite')
  console.log('================================================================================')

  await connectDb()
  await cleanupTestArtifacts()

  const origFetch = globalThis.fetch
  const graphRequests = []
  let outMsgSeq = 0
  let queuedOutboundCallId = CALL_OUT_1

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url || '')

    if (u.startsWith('http://127.0.0.1:')) {
      return origFetch(url, init)
    }

    if (u === MOCK_MEDIA_URL) {
      graphRequests.push({ url: u, method: init.method || 'GET', body: null })
      return new Response(MOCK_OGG_BYTES, {
        status: 200,
        headers: { 'Content-Type': 'audio/ogg' },
      })
    }

    if (u.startsWith('https://graph.facebook.com/')) {
      const method = (init.method || 'GET').toUpperCase()
      const parsedBody = init.body ? JSON.parse(init.body) : null
      graphRequests.push({ url: u, method, body: parsedBody })

      // Media metadata lookup: GET /v24.0/{media_id}
      if (method === 'GET' && u.includes(encodeURIComponent(MEDIA_ID_OGG))) {
        return new Response(
          JSON.stringify({
            messaging_product: 'whatsapp',
            id: MEDIA_ID_OGG,
            url: MOCK_MEDIA_URL,
            mime_type: 'audio/ogg',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Messages endpoint: POST /v21.0|v24.0/{phoneNumberId}/messages
      if (method === 'POST' && u.endsWith('/messages')) {
        if (parsedBody?.status === 'read') {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const msgId = `wamid.qa_e2e_2_out_${++outMsgSeq}`
        return new Response(
          JSON.stringify({
            messaging_product: 'whatsapp',
            contacts: [{ input: parsedBody?.to, wa_id: parsedBody?.to }],
            messages: [{ id: msgId }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Calls signaling endpoint: POST /v24.0/{phoneNumberId}/calls
      if (method === 'POST' && u.endsWith('/calls')) {
        if (parsedBody?.action === 'connect') {
          const cid = queuedOutboundCallId
          return new Response(
            JSON.stringify({
              messaging_product: 'whatsapp',
              calls: [{ id: cid }],
            }),
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

    throw new Error(`Blocked unexpected external fetch in QA test: ${u}`)
  }

  // Spin up in-process Express server matching production middleware wiring
  const app = express()
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf
      },
    })
  )
  app.use(optionalAuth)
  app.use('/api/whatsapp/webhook', whatsappWebhookRouter)
  app.use('/api/calls', callsRouter)
  app.use('/api/leads', leadsRouter)

  let server = null
  let cleanupSummary = null

  try {
    server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })
    const baseUrl = `http://127.0.0.1:${server.address().port}`

    const ssaToken = signToken({
      sub: 'qa_e2e_2_ssa',
      username: 'qa_e2e_2_ssa',
      role: ROLES.SUPER_SUPER_ADMIN,
    })
    const rahulToken = signToken({
      sub: 'qa_e2e_2_rahul',
      username: 'rahul',
      role: ROLES.TELECALLER,
    })
    const harishToken = signToken({
      sub: 'qa_e2e_2_harish',
      username: 'harish',
      role: ROLES.TELECALLER,
    })

    async function postSignedWebhook(payload) {
      const raw = JSON.stringify(payload)
      const sig = signWebhookPayload(raw)
      return origFetch(`${baseUrl}/api/whatsapp/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': sig,
        },
        body: raw,
      })
    }

    async function apiJson(method, route, token, body) {
      const res = await origFetch(`${baseUrl}${route}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      const data = await res.json().catch(() => ({}))
      return { status: res.status, data, headers: res.headers }
    }

    // =========================================================================
    // SUITE 1: Unified Cross-Channel Lifecycle (919999810001)
    // =========================================================================
    console.log('\n--- Suite 1: Unified Cross-Channel Lifecycle (919999810001) ---')

    await checkStep('1.0', 'Webhook rejects unsigned/tampered payload with 401 Invalid signature', async () => {
      const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
      const badRes = await origFetch(`${baseUrl}/api/whatsapp/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=0000' },
        body: raw,
      })
      assert.equal(badRes.status, 401)
      return 'HTTP 401 enforced via verifyMetaSignature'
    })

    await checkStep('1.1', 'Inbound CTWA WhatsApp text creates CRM lead + inbound message in unified thread', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919994627551',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
                  },
                  contacts: [{ profile: { name: 'QA Athlete One' }, wa_id: PHONE_1 }],
                  messages: [
                    {
                      from: PHONE_1,
                      id: MSG_IN_CTWA,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: 'Hi, saw the ISYDCI national trial ad' },
                      referral: {
                        source_url: 'https://fb.me/qa_e2e_2_ad',
                        source_id: 'qa_e2e_2_ad_901',
                        source_type: 'ad',
                        headline: 'ISYDCI Trials 2026',
                        body: 'Apply on WhatsApp',
                        media_type: 'image',
                        ctwa_clid: 'qa_e2e_2_ctwa_clid_1',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const res = await postSignedWebhook(webhookPayload)
      assert.equal(res.status, 200)

      const lead = await waitFor(() => col('leads').findOne({ phone: PHONE_1 }), { label: 'leads doc for PHONE_1' })
      assert.equal(lead.phone, PHONE_1)
      assert.equal(lead.source, 'ctwa_ad')
      assert.equal(lead.status, 'contacted')
      assert.equal(lead.campaign?.adId, 'qa_e2e_2_ad_901')
      assert.equal(lead.campaign?.ctwaClid, 'qa_e2e_2_ctwa_clid_1')
      assert.equal(lead.whatsappName, 'QA Athlete One')

      const inMsg = await waitFor(
        () => col('messages').findOne({ leadPhone: PHONE_1, waMessageId: MSG_IN_CTWA }),
        { label: 'inbound CTWA message in messages' }
      )
      assert.equal(inMsg.direction, 'in')
      assert.equal(inMsg.text, 'Hi, saw the ISYDCI national trial ad')

      // Wait for bot auto-reply main menu outbound record to settle too
      await waitFor(
        () => col('messages').findOne({ leadPhone: PHONE_1, direction: 'out', type: 'interactive' }),
        { label: 'bot menu auto-reply in messages' }
      )
      return `leadId=${lead._id}, source=${lead.source}, campaign.adId=${lead.campaign.adId}`
    })

    await checkStep('1.2', 'Admin assigns lead 919999810001 to telecaller rahul via PATCH /api/leads/:phone', async () => {
      const { status, data } = await apiJson('PATCH', `/api/leads/${PHONE_1}`, ssaToken, {
        assignedTo: 'rahul',
      })
      assert.equal(status, 200)
      assert.equal(data.lead?.assignedTo, 'rahul')

      const dbLead = await col('leads').findOne({ phone: PHONE_1 })
      assert.equal(dbLead.assignedTo, 'rahul')
      return 'assignedTo=rahul'
    })

    let firstPermMsgId = null
    await checkStep('1.3', 'Telecaller rahul sends Call Permission Request -> Graph payload + pending status + thread log', async () => {
      // Pass formatted phone with +91 & spaces to verify normalization across channels
      const { status, data } = await apiJson('POST', '/api/calls/permission-request', rahulToken, {
        phone: '+91 99998-10001',
      })
      assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
      assert.equal(data.waId, PHONE_1)
      assert.ok(data.messageId?.startsWith('wamid.qa_e2e_2_out_'))
      firstPermMsgId = data.messageId

      const graphPermReq = graphRequests.find(
        r =>
          r.url.endsWith('/messages') &&
          r.body?.to === PHONE_1 &&
          r.body?.type === 'interactive' &&
          r.body?.interactive?.type === 'call_permission_request'
      )
      assert.ok(graphPermReq, 'Graph API must receive interactive/call_permission_request')
      assert.equal(graphPermReq.body.interactive.action?.name, 'call_permission_request')

      const permDoc = await col('call_permissions').findOne({ waId: PHONE_1 })
      assert.ok(permDoc)
      assert.equal(permDoc.status, 'pending')
      assert.equal(permDoc.lastRequestMessageId, firstPermMsgId)
      assert.equal(permDoc.requestTimestamps?.length, 1)

      const threadEntry = await waitFor(
        () => col('messages').findOne({ leadPhone: PHONE_1, waMessageId: firstPermMsgId }),
        { label: '[Call Permission Request] in messages thread' }
      )
      assert.equal(threadEntry.direction, 'out')
      assert.ok(threadEntry.text.startsWith('[Call Permission Request]'))

      // Confirm 24h rate limit is currently active prior to failed-delivery rollback
      const dupAttempt = await apiJson('POST', '/api/calls/permission-request', rahulToken, { phone: PHONE_1 })
      assert.equal(dupAttempt.status, 429, '2nd request within 24h must return 429 before rollback')
      return `lastRequestMessageId=${firstPermMsgId}, 24h guard=429 verified`
    })

    await checkStep('1.4', 'Meta failed status (131047 Re-engagement) rolls back permission request so rahul immediately re-sends without 429', async () => {
      const failStatusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919994627551',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
                  },
                  statuses: [
                    {
                      id: firstPermMsgId,
                      status: 'failed',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      recipient_id: PHONE_1,
                      errors: [{ code: 131047, title: 'Re-engagement message' }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const whRes = await postSignedWebhook(failStatusPayload)
      assert.equal(whRes.status, 200)

      const rolledBack = await waitFor(
        async () => {
          const p = await col('call_permissions').findOne({ waId: PHONE_1 })
          return p && p.status === 'none' && p.requestTimestamps?.length === 0 ? p : null
        },
        { label: 'rollbackFailedPermissionRequest completion' }
      )
      assert.equal(rolledBack.status, 'none')
      assert.equal(rolledBack.requestTimestamps.length, 0)
      assert.equal(rolledBack.lastRequestMessageId, null)
      assert.ok(String(rolledBack.lastRequestError || '').includes('131047'))

      const failedMsgDoc = await waitFor(
        async () => {
          const m = await col('messages').findOne({ waMessageId: firstPermMsgId })
          return m?.status === 'failed' ? m : null
        },
        { label: 'updateMessageStatus failed on messages' }
      )
      assert.ok(String(failedMsgDoc.error || '').includes('131047'))

      // Immediate re-send by rahul must succeed (200 OK, not 429!)
      const resend = await apiJson('POST', '/api/calls/permission-request', rahulToken, { phone: PHONE_1 })
      assert.equal(resend.status, 200, `Expected immediate re-send 200, got ${resend.status}: ${JSON.stringify(resend.data)}`)
      const permAfterResend = await col('call_permissions').findOne({ waId: PHONE_1 })
      assert.equal(permAfterResend.status, 'pending')
      assert.equal(permAfterResend.lastRequestMessageId, resend.data.messageId)
      assert.equal(permAfterResend.requestTimestamps.length, 1)
      return `rolledBack->none, re-sent messageId=${resend.data.messageId} (HTTP 200)`
    })

    await checkStep('1.5', 'Lead taps Allow via interactive.call_permission_reply (accept) -> allowed=true & 72h TTL', async () => {
      const replyPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919994627551',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
                  },
                  contacts: [{ profile: { name: 'QA Athlete One' }, wa_id: PHONE_1 }],
                  messages: [
                    {
                      from: PHONE_1,
                      id: MSG_IN_PERM_ACCEPT,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'interactive',
                      interactive: {
                        type: 'call_permission_reply',
                        call_permission_reply: {
                          response: 'accept',
                          is_permanent: false,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const whRes = await postSignedWebhook(replyPayload)
      assert.equal(whRes.status, 200)

      const acceptedPerm = await waitFor(
        async () => {
          const p = await col('call_permissions').findOne({ waId: PHONE_1 })
          return p?.status === 'accepted' ? p : null
        },
        { label: 'call_permissions.status === accepted' }
      )
      assert.equal(acceptedPerm.status, 'accepted')

      const { status, data } = await apiJson('GET', `/api/calls/lead/${PHONE_1}`, rahulToken)
      assert.equal(status, 200)
      assert.equal(data.permission?.status, 'accepted')
      assert.equal(data.permission?.allowed, true)
      const ttlHours = (new Date(data.permission.expiresAt).getTime() - Date.now()) / (1000 * 3600)
      assert.ok(ttlHours > 71.9 && ttlHours <= 72.1, `Expected ~72h TTL, got ${ttlHours}`)
      return `status=accepted, allowed=true, ttlHours=${ttlHours.toFixed(2)}h`
    })

    await checkStep('1.6', 'Rahul outbound call -> connect answer -> terminate (42s + media_id) -> .ogg saved + unified thread summary', async () => {
      queuedOutboundCallId = CALL_OUT_1
      const sdpOffer = 'v=0\r\no=- 1001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'

      const outRes = await apiJson('POST', '/api/calls/outbound', rahulToken, {
        phone: PHONE_1,
        sdpOffer,
      })
      assert.equal(outRes.status, 200, `Outbound call failed: ${JSON.stringify(outRes.data)}`)
      assert.equal(outRes.data.callId, CALL_OUT_1)

      const connectGraphReq = graphRequests.find(
        r => r.url.endsWith('/calls') && r.body?.action === 'connect' && r.body?.to === PHONE_1
      )
      assert.ok(connectGraphReq, 'Graph /calls connect request sent')
      assert.equal(connectGraphReq.body?.recording?.status, 'ENABLED')

      // Meta webhook: callee answers outbound call (connect + sdp_type=answer)
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_OUT_1,
                      to: PHONE_1,
                      direction: 'BUSINESS_INITIATED',
                      event: 'connect',
                      session: {
                        sdp_type: 'answer',
                        sdp: 'v=0\r\no=- 2002 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await waitFor(
        async () => {
          const c = await col('whatsapp_calls').findOne({ callId: CALL_OUT_1 })
          return c?.status === 'accepted' && c?.attended === true ? c : null
        },
        { label: 'outbound call accepted state' }
      )

      // Meta webhook: call terminates at 42s with recording media_id
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_OUT_1,
                      to: PHONE_1,
                      direction: 'BUSINESS_INITIATED',
                      event: 'terminate',
                      duration: 42,
                      end_reason: 'completed',
                      recording: { media_id: MEDIA_ID_OGG },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const finalCall = await waitFor(
        async () => {
          const c = await col('whatsapp_calls').findOne({ callId: CALL_OUT_1 })
          return c?.status === 'completed' && c?.recording_status === 'ready' ? c : null
        },
        { timeoutMs: 6000, label: 'whatsapp_calls completed + recording_status=ready' }
      )

      assert.equal(finalCall.direction, 'outbound')
      assert.equal(finalCall.telecaller_id, 'rahul')
      assert.equal(finalCall.attended, true)
      assert.equal(finalCall.durationSec, 42)
      assert.equal(finalCall.recording_status, 'ready')
      assert.equal(finalCall.recording_media_id, MEDIA_ID_OGG)
      assert.equal(finalCall.recording_file, `${CALL_OUT_1}.ogg`)

      const oggPath = path.join(PROTECTED_RECORDINGS_DIR, `${CALL_OUT_1}.ogg`)
      assert.ok(fs.existsSync(oggPath), 'Expected .ogg recording file in protected_recordings')
      assert.equal(fs.statSync(oggPath).size, MOCK_OGG_BYTES.length)

      // Verify authenticated streaming endpoint (200 full + 206 Range for rahul; 403 for harish)
      const streamRahul = await origFetch(`${baseUrl}/api/calls/${CALL_OUT_1}/recording`, {
        headers: { Authorization: `Bearer ${rahulToken}`, Range: 'bytes=0-15' },
      })
      assert.equal(streamRahul.status, 206)
      assert.equal((await streamRahul.arrayBuffer()).byteLength, 16)

      const streamHarish = await origFetch(`${baseUrl}/api/calls/${CALL_OUT_1}/recording`, {
        headers: { Authorization: `Bearer ${harishToken}` },
      })
      assert.equal(streamHarish.status, 403, 'Other telecaller must get 403 on recording stream')

      // Verify call summary logged in exact same messages thread (leadPhone: 919999810001)
      const summaryMsg = await waitFor(
        () =>
          col('messages').findOne({
            leadPhone: PHONE_1,
            channel: 'whatsapp_call',
            waMessageId: CALL_OUT_1,
            text: /Outbound WhatsApp call · 42s \(Answered\)/,
          }),
        { label: '42s call summary in PHONE_1 messages thread' }
      )
      assert.equal(summaryMsg.direction, 'out')
      assert.equal(summaryMsg.type, 'call_log')

      // Verify GET /api/leads/919999810001 returns unified thread containing both chat + call items
      const threadRes = await apiJson('GET', `/api/leads/${PHONE_1}`, rahulToken)
      assert.equal(threadRes.status, 200)
      const texts = (threadRes.data.messages || []).map(m => m.text)
      assert.ok(texts.some(t => t.includes('Hi, saw the ISYDCI national trial ad')))
      assert.ok(texts.some(t => t.startsWith('[Call Permission Request]')))
      assert.ok(texts.some(t => t.includes('Outbound WhatsApp call initiated')))
      assert.ok(texts.some(t => t.includes('Outbound WhatsApp call · 42s (Answered)')))

      return `callId=${CALL_OUT_1}, oggBytes=${MOCK_OGG_BYTES.length}, unifiedMessages=${texts.length}`
    })

    // Probe GAP-1 safely within PHONE_1/PHONE_2 namespace: outbound BUSINESS_INITIATED webhook containing both `from` and `to`
    await checkStep('1.7', 'Cross-channel audit probe: outbound BUSINESS_INITIATED webhook with both from & to fields', async () => {
      queuedOutboundCallId = CALL_OUT_FROM_BUG
      const initRes = await apiJson('POST', '/api/calls/outbound', rahulToken, {
        phone: PHONE_1,
        sdpOffer: 'v=0\r\no=- 1009 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      })
      assert.equal(initRes.status, 200)

      // Simulate Meta sending both `from` (business phone, simulated using isolated PHONE_2) and `to` (lead PHONE_1)
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_OUT_FROM_BUG,
                      from: PHONE_2,
                      to: PHONE_1,
                      direction: 'BUSINESS_INITIATED',
                      event: 'terminate',
                      duration: 12,
                      end_reason: 'completed',
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await waitFor(
        async () => {
          const c = await col('whatsapp_calls').findOne({ callId: CALL_OUT_FROM_BUG })
          return c?.status === 'completed' ? c : null
        },
        { label: 'CALL_OUT_FROM_BUG completed' }
      )

      const loggedOnLead1 = await col('messages').findOne({
        leadPhone: PHONE_1,
        waMessageId: CALL_OUT_FROM_BUG,
        text: /12s/,
      })
      const misroutedToFrom = await col('messages').findOne({
        leadPhone: PHONE_2,
        waMessageId: CALL_OUT_FROM_BUG,
        text: /12s/,
      })

      if (!loggedOnLead1 && misroutedToFrom) {
        recordGap(
          'GAP-1',
          'Outbound BUSINESS_INITIATED call webhooks use `call.from || call.to` instead of `call.to` / `existing.waId`',
          'backend/services/calling.js:797-798, 851-856, 1015-1037',
          'When Meta sends both `from` (business display number) and `to` (lead wa_id) on BUSINESS_INITIATED connect/terminate webhooks, `waId` resolves to `call.from`, logging the call summary and updating `call_permissions` under the business phone instead of `existing.waId` / `call.to`.'
        )
      }

      // Clean up probe message on PHONE_2 before Suite 3 runs
      await col('messages').deleteMany({ waMessageId: CALL_OUT_FROM_BUG })
      await col('whatsapp_calls').deleteOne({ callId: CALL_OUT_FROM_BUG })
      return `misroutedWhenBothFromAndToPresent=${Boolean(misroutedToFrom && !loggedOnLead1)}`
    })

    // =========================================================================
    // SUITE 2: Sticky Ownership Consistency Across Channels
    // =========================================================================
    console.log('\n--- Suite 2: Sticky Ownership Consistency Across Channels ---')

    await checkStep('2.1', 'Telecaller harish blocked with 403 Forbidden on POST /api/calls/outbound to rahul lead 919999810001', async () => {
      const beforeCallsCount = graphRequests.filter(r => r.url.endsWith('/calls')).length
      const res = await apiJson('POST', '/api/calls/outbound', harishToken, {
        phone: PHONE_1,
        sdpOffer: 'v=0\r\no=- 3001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      })
      assert.equal(res.status, 403)
      assert.match(String(res.data.message || ''), /not assigned to you/i)
      const afterCallsCount = graphRequests.filter(r => r.url.endsWith('/calls')).length
      assert.equal(afterCallsCount, beforeCallsCount, 'No Graph /calls request should fire on 403')
      return `HTTP ${res.status} (${res.data.message})`
    })

    await checkStep('2.2', 'Telecaller harish blocked with 403 Forbidden on POST /api/calls/permission-request to rahul lead 919999810001', async () => {
      const beforeMsgCount = graphRequests.filter(r => r.url.endsWith('/messages')).length
      const res = await apiJson('POST', '/api/calls/permission-request', harishToken, {
        phone: PHONE_1,
      })
      assert.equal(res.status, 403)
      assert.match(String(res.data.message || ''), /not assigned to you/i)
      const afterMsgCount = graphRequests.filter(r => r.url.endsWith('/messages')).length
      assert.equal(afterMsgCount, beforeMsgCount, 'No Graph /messages request should fire on 403')
      return `HTTP ${res.status} (${res.data.message})`
    })

    await checkStep('2.3', 'Cross-channel sticky access check on GET /api/leads/:phone vs GET /api/calls/lead/:phone', async () => {
      const leadGet = await apiJson('GET', `/api/leads/${PHONE_1}`, harishToken)
      assert.equal(leadGet.status, 403, 'GET /api/leads/:phone must return 403 for unassigned telecaller')

      const leadReply = await apiJson('POST', `/api/leads/${PHONE_1}/reply`, harishToken, { text: 'Unauthorized reply' })
      assert.equal(leadReply.status, 403, 'POST /api/leads/:phone/reply must return 403 for unassigned telecaller')

      const callsLeadGet = await apiJson('GET', `/api/calls/lead/${PHONE_1}`, harishToken)
      if (callsLeadGet.status === 200 && callsLeadGet.data?.permission?.waId === PHONE_1) {
        recordGap(
          'GAP-2',
          'GET /api/calls/lead/:phone returns 200 and exposes call permission state to non-assigned telecallers',
          'backend/routes/calls.js:153-165',
          'While `calls` list is scoped to `req.admin.username`, `assertTelecallerLeadAccess` is not called on `GET /api/calls/lead/:phone`, leaking `permission` metadata (`allowed`, `status`, `expiresAt`) across telecallers (whereas `GET /api/leads/:phone` returns 403). Similarly `POST /api/calls/:callId/recording` (line 295) omits `assertTelecallerCallAccess`.'
        )
      }
      return `leads/:phone=${leadGet.status}, leads/:phone/reply=${leadReply.status}, calls/lead/:phone=${callsLeadGet.status}`
    })

    await checkStep('2.4', 'Inbound WhatsApp call from 919999810001 auto-routes to whatsapp_calls.telecaller_id === "rahul"', async () => {
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_IN_1,
                      from: PHONE_1,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'connect',
                      session: {
                        sdp_type: 'offer',
                        sdp: 'v=0\r\no=- 4001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const callDoc = await waitFor(
        () => col('whatsapp_calls').findOne({ callId: CALL_IN_1 }),
        { label: 'CALL_IN_1 ringing doc' }
      )
      assert.equal(callDoc.direction, 'inbound')
      assert.equal(callDoc.status, 'ringing')
      assert.equal(callDoc.telecaller_id, 'rahul')

      // Active calls endpoint: visible to rahul, hidden from harish
      const activeRahul = await apiJson('GET', '/api/calls/active', rahulToken)
      const activeHarish = await apiJson('GET', '/api/calls/active', harishToken)
      assert.ok(activeRahul.data.calls?.some(c => c.callId === CALL_IN_1))
      assert.ok(!activeHarish.data.calls?.some(c => c.callId === CALL_IN_1))

      // Harish cannot accept rahul's call
      const harishAccept = await apiJson('POST', `/api/calls/${CALL_IN_1}/accept`, harishToken, {
        sdpAnswer: 'v=0\r\no=- 4002 1 IN IP4 127.0.0.1\r\n',
      })
      assert.equal(harishAccept.status, 403)

      return `telecaller_id=${callDoc.telecaller_id}, harishAccept=${harishAccept.status}`
    })

    // =========================================================================
    // SUITE 3: Busy Collision + Deduplicated Callback & Missed-Call Auto-Reply Guard
    // =========================================================================
    console.log('\n--- Suite 3: Busy Collision + Deduplicated Callback & Missed-Call Auto-Reply Guard ---')

    await checkStep('3.1', 'Rahul accepts inbound call from 919999810001 (POST /api/calls/:callId/accept)', async () => {
      const res = await apiJson('POST', `/api/calls/${CALL_IN_1}/accept`, rahulToken, {
        sdpAnswer: 'v=0\r\no=- 5001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      })
      assert.equal(res.status, 200, `Accept failed: ${JSON.stringify(res.data)}`)
      assert.equal(res.data.call?.status, 'accepted')
      assert.equal(res.data.call?.attended, true)
      assert.equal(res.data.call?.telecaller_id, 'rahul')
      return `callId=${CALL_IN_1} status=accepted`
    })

    await checkStep('3.2', 'Concurrent inbound call from 919999810002 (numeric name, assigned to rahul) -> Graph reject + telecaller_busy + "Hi there, ..." callback', async () => {
      // Probe manual lead creation endpoint first (surfaces MongoDB $set/$setOnInsert conflict on `tags`)
      const manualCreateRes = await apiJson('POST', '/api/leads', ssaToken, {
        phone: PHONE_2,
        name: PHONE_2,
      })
      if (manualCreateRes.status === 400 && /conflict at 'tags'/i.test(String(manualCreateRes.data?.message || ''))) {
        recordGap(
          'GAP-5',
          'POST /api/leads (createManualLead -> upsertLead) fails with HTTP 400 MongoDB conflict on `tags`',
          'backend/services/leads.js:73-74, 108, 479-483',
          '`upsertLead` sets `tags: []` inside `$setOnInsert` while `createManualLead` (and `upsertLeadFromInbound` when `member` exists) also passes `tags` inside `$set`, causing MongoDB `Updating the path \'tags\' would create a conflict at \'tags\'`.'
        )
      }

      // Create second lead via inbound WhatsApp message with numeric-only profile name '919999810002' and assign to rahul
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919994627551',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
                  },
                  contacts: [{ profile: { name: PHONE_2 }, wa_id: PHONE_2 }],
                  messages: [
                    {
                      from: PHONE_2,
                      id: MSG_IN_LEAD2,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await waitFor(() => col('leads').findOne({ phone: PHONE_2 }), { label: 'leads doc for PHONE_2' })

      const assignRes = await apiJson('PATCH', `/api/leads/${PHONE_2}`, ssaToken, {
        assignedTo: 'rahul',
        name: PHONE_2,
      })
      assert.equal(assignRes.status, 200)
      assert.equal(assignRes.data.lead?.assignedTo, 'rahul')
      assert.equal(assignRes.data.lead?.name, PHONE_2)

      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_BUSY_1,
                      from: PHONE_2,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'connect',
                      session: {
                        sdp_type: 'offer',
                        sdp: 'v=0\r\no=- 6001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const busyDoc = await waitFor(
        () => col('whatsapp_calls').findOne({ callId: CALL_BUSY_1 }),
        { label: 'CALL_BUSY_1 saved as telecaller_busy' }
      )
      assert.equal(busyDoc.status, 'missed')
      assert.equal(busyDoc.endReason, 'telecaller_busy')
      assert.equal(busyDoc.attended, false)
      assert.equal(busyDoc.telecaller_id, 'rahul')

      const rejectReq = graphRequests.find(
        r => r.url.endsWith('/calls') && r.body?.action === 'reject' && r.body?.call_id === CALL_BUSY_1
      )
      assert.ok(rejectReq, 'Immediate Graph reject action must be sent for concurrent call')

      const callbackMsg = await waitFor(
        () => col('messages').findOne({ leadPhone: PHONE_2, kind: 'busy_callback' }),
        { label: 'busy_callback message in PHONE_2 thread' }
      )
      assert.ok(
        callbackMsg.text.startsWith('Hi there, '),
        `Expected numeric-only name fallback "Hi there, ...", got "${callbackMsg.text}"`
      )
      assert.match(callbackMsg.text, /currently assisting another caller/i)
      return `endReason=${busyDoc.endReason}, text="${callbackMsg.text}"`
    })

    await checkStep('3.3', 'Redial within 5m from 919999810002 -> rejected busy, busy_callback deduped (still 1), follow-up terminate skips sendMissedCallFallback', async () => {
      // Redial within 5 minutes
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_BUSY_2,
                      from: PHONE_2,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'connect',
                      session: {
                        sdp_type: 'offer',
                        sdp: 'v=0\r\no=- 6002 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const busyDoc2 = await waitFor(
        () => col('whatsapp_calls').findOne({ callId: CALL_BUSY_2 }),
        { label: 'CALL_BUSY_2 saved' }
      )
      assert.equal(busyDoc2.endReason, 'telecaller_busy')
      assert.ok(
        graphRequests.some(r => r.url.endsWith('/calls') && r.body?.action === 'reject' && r.body?.call_id === CALL_BUSY_2),
        'Immediate Graph reject sent for redial CALL_BUSY_2'
      )

      const busyCallbacksCount = await col('messages').countDocuments({
        leadPhone: PHONE_2,
        kind: 'busy_callback',
      })
      assert.equal(busyCallbacksCount, 1, 'busy_callback must be deduplicated within 5m window')

      // Follow-up terminate webhook from Meta for rejected CALL_BUSY_1
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_BUSY_1,
                      from: PHONE_2,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'terminate',
                      end_reason: 'rejected',
                      duration: 0,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      // Wait until terminate call_log summary is written, then verify no missed-call fallback fired
      await waitFor(
        () =>
          col('messages').findOne({
            leadPhone: PHONE_2,
            waMessageId: CALL_BUSY_1,
            text: /Missed inbound WhatsApp call$/,
          }),
        { label: 'terminate summary for CALL_BUSY_1' }
      )

      const callAfterTerm = await col('whatsapp_calls').findOne({ callId: CALL_BUSY_1 })
      assert.equal(callAfterTerm.endReason, 'telecaller_busy', 'endReason=telecaller_busy must be preserved')

      const missedFallbacksForPhone2 = graphRequests.filter(
        r =>
          r.url.endsWith('/messages') &&
          r.body?.to === PHONE_2 &&
          String(r.body?.text?.body || '').includes('Sorry we missed your WhatsApp call')
      )
      assert.equal(missedFallbacksForPhone2.length, 0, 'sendMissedCallFallback must NOT fire after busy rejection')
      return `busy_callback count=${busyCallbacksCount}, missedCallFallback count=${missedFallbacksForPhone2.length}`
    })

    await checkStep('3.4', 'Unanswered OUTBOUND call (terminate duration=0, no_answer) NEVER fires sendMissedCallFallback', async () => {
      // First end rahul's active call so rahul is free
      const termActive = await apiJson('POST', `/api/calls/${CALL_IN_1}/terminate`, rahulToken)
      assert.equal(termActive.status, 200)

      queuedOutboundCallId = CALL_OUT_NOANS
      const outRes = await apiJson('POST', '/api/calls/outbound', rahulToken, {
        phone: PHONE_1,
        sdpOffer: 'v=0\r\no=- 7001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      })
      assert.equal(outRes.status, 200)
      assert.equal(outRes.data.callId, CALL_OUT_NOANS)

      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_OUT_NOANS,
                      to: PHONE_1,
                      direction: 'BUSINESS_INITIATED',
                      event: 'terminate',
                      end_reason: 'no_answer',
                      duration: 0,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const missedOutDoc = await waitFor(
        async () => {
          const c = await col('whatsapp_calls').findOne({ callId: CALL_OUT_NOANS })
          return c?.status === 'missed' ? c : null
        },
        { label: 'CALL_OUT_NOANS missed status' }
      )
      assert.equal(missedOutDoc.direction, 'outbound')
      assert.equal(missedOutDoc.attended, false)
      assert.equal(missedOutDoc.durationSec, 0)

      // Give any async side effects a moment, then assert 0 missed-call fallbacks sent
      await new Promise(r => setTimeout(r, 150))
      const outFallbacks = graphRequests.filter(
        r =>
          r.url.endsWith('/messages') &&
          r.body?.to === PHONE_1 &&
          String(r.body?.text?.body || '').includes('Sorry we missed your WhatsApp call')
      )
      assert.equal(outFallbacks.length, 0, 'Unanswered outbound call must NEVER fire sendMissedCallFallback')

      const permAfterNoAns = await col('call_permissions').findOne({ waId: PHONE_1 })
      assert.equal(permAfterNoAns.consecutiveUnansweredOutbound, 1)
      return `outbound missed fallback count=${outFallbacks.length}, consecutiveUnansweredOutbound=${permAfterNoAns.consecutiveUnansweredOutbound}`
    })

    await checkStep('3.5', 'Genuine unanswered INBOUND call (when telecaller is NOT busy) DOES fire sendMissedCallFallback once', async () => {
      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_IN_MISSED,
                      from: PHONE_1,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'connect',
                      session: {
                        sdp_type: 'offer',
                        sdp: 'v=0\r\no=- 8001 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const ringingDoc = await waitFor(
        () => col('whatsapp_calls').findOne({ callId: CALL_IN_MISSED }),
        { label: 'CALL_IN_MISSED ringing' }
      )
      assert.equal(ringingDoc.status, 'ringing')
      assert.equal(ringingDoc.telecaller_id, 'rahul')

      await postSignedWebhook({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_qa_e2e_2',
            changes: [
              {
                field: 'calls',
                value: {
                  messaging_product: 'whatsapp',
                  calls: [
                    {
                      id: CALL_IN_MISSED,
                      from: PHONE_1,
                      to: '919994627551',
                      direction: 'USER_INITIATED',
                      event: 'terminate',
                      end_reason: 'no_answer',
                      duration: 0,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const fallbackMsgDoc = await waitFor(
        () =>
          col('messages').findOne({
            leadPhone: PHONE_1,
            direction: 'out',
            text: /Sorry we missed your WhatsApp call/,
          }),
        { label: 'sendMissedCallFallback recorded in PHONE_1 messages' }
      )
      assert.ok(fallbackMsgDoc)

      const inboundFallbacks = graphRequests.filter(
        r =>
          r.url.endsWith('/messages') &&
          r.body?.to === PHONE_1 &&
          String(r.body?.text?.body || '').includes('Sorry we missed your WhatsApp call')
      )
      assert.equal(inboundFallbacks.length, 1, 'Genuine unanswered inbound call must fire sendMissedCallFallback exactly once')
      return `inbound missed fallback count=${inboundFallbacks.length}, waMessageId=${fallbackMsgDoc.waMessageId}`
    })

    // Record static cross-channel architecture gaps discovered during code audit
    recordGap(
      'GAP-3',
      'DELETE /api/leads/:phone (deleteLead) leaves orphaned call_permissions, whatsapp_calls, and protected_recordings files',
      'backend/services/leads.js:338-344',
      '`deleteLead(rawPhone)` deletes `leads` and `messages` for `leadPhone(rawPhone)`, but does not clean up `call_permissions` (`{ waId }`) or `whatsapp_calls` (`{ waId }`) or associated `.ogg`/`.webm` files.'
    )
    recordGap(
      'GAP-4',
      'POST /api/leads/:phone/reply and /send-template strip non-digits instead of normalizing via leadPhone()',
      'backend/routes/leads.js:189, 219',
      'Uses `String(req.params.phone).replace(/\\D/g, "")` instead of `leadPhone(req.params.phone)`. A 10-digit `:phone` param sends `to` without `91` prefix to the Graph API while `recordOutbound` stores `leadPhone(to)` (`91...`) in `messages`.'
    )
  } finally {
    globalThis.fetch = origFetch
    if (server) {
      await new Promise(resolve => server.close(resolve))
    }
    // Wait briefly for any fire-and-forget auditMiddleware / recordEvent writes before final sweep
    await new Promise(r => setTimeout(r, 100))
    await cleanupTestArtifacts()
    cleanupSummary = await countRemainingTestArtifacts()
    await closeDb()
  }

  console.log('\n================================================================================')
  console.log('🧹 Cleanup Verification (Must all be 0):')
  console.log(JSON.stringify(cleanupSummary, null, 2))
  assert.equal(cleanupSummary.leadsCount, 0, 'Leftover leads must be 0')
  assert.equal(cleanupSummary.messagesCount, 0, 'Leftover messages must be 0')
  assert.equal(cleanupSummary.callsCount, 0, 'Leftover whatsapp_calls must be 0')
  assert.equal(cleanupSummary.permsCount, 0, 'Leftover call_permissions must be 0')
  assert.equal(cleanupSummary.auditCount, 0, 'Leftover audit_logs must be 0')
  assert.equal(cleanupSummary.eventsCount, 0, 'Leftover webhook_events must be 0')
  assert.equal(cleanupSummary.leftoverFiles, 0, 'Leftover protected_recordings files must be 0')

  const passCount = results.filter(r => r.status === 'PASS').length
  const failCount = results.filter(r => r.status === 'FAIL').length
  console.log('================================================================================')
  console.log(`📊 Summary: ${passCount} PASSED | ${failCount} FAILED | ${gaps.length} GAPS REPORTED`)
  console.log('================================================================================')

  if (failCount > 0) {
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error('Fatal QA suite error:', err)
  process.exitCode = 1
})
