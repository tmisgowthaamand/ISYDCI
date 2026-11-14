/**
 * Self-contained local verification for WhatsApp inbound sticky call routing.
 *
 * 1. Connects to MongoDB and ensures two temporary test leads assigned to two
 *    different telecallers (using existing active telecallers if present, or
 *    temporary test usernames).
 * 2. Boots an ephemeral local Express server mounting the real `optionalAuth`,
 *    `POST /webhook` (whatsappWebhookRouter), and `GET /api/calls/*` (callsRouter).
 * 3. Opens two authenticated SSE streams (`GET /api/calls/events`) — one per telecaller.
 * 4. Sends HMAC-SHA256 signed `POST /webhook` `calls` (`event: "connect"`) payloads
 *    for Lead A and Lead B (plus an unassigned caller).
 * 5. Asserts:
 *    - `whatsapp_calls` stores the owning `telecaller_id` for Lead A and Lead B.
 *    - Telecaller A's SSE stream receives ONLY Lead A's ring event (not Lead B's).
 *    - Telecaller B's SSE stream receives ONLY Lead B's ring event (not Lead A's).
 *    - Unassigned caller (`telecaller_id: null`) rings both SSE streams (`includeUnassigned = true`).
 * 6. Cleans up all temporary test documents on exit.
 */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { connectDb, closeDb, col } from '../db/mongo.js'
import { optionalAuth, ROLES, signToken } from '../services/auth.js'
import whatsappWebhookRouter from '../routes/whatsappWebhook.js'
import callsRouter from '../routes/calls.js'

const TEST_PHONE_A = '919999900001'
const TEST_PHONE_B = '919999900002'
const TEST_PHONE_UNASSIGNED = '919999900003'
const CALL_ID_A = `wacid.sticky_test_a_${Date.now()}`
const CALL_ID_B = `wacid.sticky_test_b_${Date.now()}`
const CALL_ID_U = `wacid.sticky_test_u_${Date.now()}`

function signWebhookBody(rawBody) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET
  if (!secret) return null
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function buildConnectPayload(callId, fromPhone) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'waba_test',
        changes: [
          {
            field: 'calls',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: process.env.WHATSAPP_NUMBER || '910000000000',
                phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || 'phone_id_test',
              },
              calls: [
                {
                  id: callId,
                  from: fromPhone,
                  to: process.env.WHATSAPP_NUMBER || '910000000000',
                  event: 'connect',
                  direction: 'USER_INITIATED',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  session: {
                    sdp_type: 'offer',
                    sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

async function openSseCollector(baseUrl, token) {
  const controller = new AbortController()
  const events = []

  const res = await fetch(`${baseUrl}/api/calls/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
  assert.equal(res.status, 200, 'SSE connection should return HTTP 200')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const loop = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        for (const frame of frames) {
          const lines = frame.split('\n')
          let eventType = 'message'
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            if (line.startsWith('data:')) dataLine += line.slice(5).trim()
          }
          if (dataLine) {
            try {
              events.push({ eventType, data: JSON.parse(dataLine) })
            } catch {
              events.push({ eventType, data: dataLine })
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }
  })()

  // Wait for initial `connected` SSE frame
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    if (events.some(e => e.eventType === 'connected')) break
    await new Promise(r => setTimeout(r, 25))
  }
  assert.ok(events.some(e => e.eventType === 'connected'), 'SSE stream should emit connected event')

  return {
    events,
    close: async () => {
      controller.abort()
      await loop.catch(() => {})
    },
  }
}

async function postSignedWebhook(baseUrl, payload) {
  const raw = JSON.stringify(payload)
  const headers = { 'Content-Type': 'application/json' }
  const sig = signWebhookBody(raw)
  if (sig) headers['X-Hub-Signature-256'] = sig

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers,
    body: raw,
  })
  assert.equal(res.status, 200, `Webhook POST should return 200 (got ${res.status})`)
}

async function main() {
  await connectDb()

  // Pick up to 2 existing active telecallers from MongoDB, or fall back to synthetic usernames
  const existingTelecallers = await col('admins')
    .find({ role: ROLES.TELECALLER, active: { $ne: false } })
    .limit(2)
    .toArray()

  const telecallerA = existingTelecallers[0]?.username || 'sticky_test_tc_a'
  const telecallerB = existingTelecallers[1]?.username || 'sticky_test_tc_b'
  console.log(`Using telecallers: A=@${telecallerA}, B=@${telecallerB}`)

  const app = express()
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf
      },
    })
  )
  app.use(optionalAuth)
  app.use('/webhook', whatsappWebhookRouter)
  app.use('/api/calls', callsRouter)

  let server
  let sseA
  let sseB

  try {
    await col('leads').deleteMany({ phone: { $in: [TEST_PHONE_A, TEST_PHONE_B, TEST_PHONE_UNASSIGNED] } })
    await col('leads').insertMany([
      {
        phone: TEST_PHONE_A,
        name: 'Sticky Test Lead A',
        status: 'new',
        source: 'manual',
        assignedTo: telecallerA,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        phone: TEST_PHONE_B,
        name: 'Sticky Test Lead B',
        status: 'new',
        source: 'manual',
        assignedTo: telecallerB,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address()
    const baseUrl = `http://127.0.0.1:${port}`

    const tokenA = signToken({ sub: 'tc-a', username: telecallerA, role: ROLES.TELECALLER })
    const tokenB = signToken({ sub: 'tc-b', username: telecallerB, role: ROLES.TELECALLER })

    sseA = await openSseCollector(baseUrl, tokenA)
    sseB = await openSseCollector(baseUrl, tokenB)

    // 1. Send signed inbound connect webhook for Lead A
    await postSignedWebhook(baseUrl, buildConnectPayload(CALL_ID_A, TEST_PHONE_A))
    // 2. Send signed inbound connect webhook for Lead B
    await postSignedWebhook(baseUrl, buildConnectPayload(CALL_ID_B, TEST_PHONE_B))
    // 3. Send signed inbound connect webhook for an unknown/unassigned caller
    await postSignedWebhook(baseUrl, buildConnectPayload(CALL_ID_U, TEST_PHONE_UNASSIGNED))

    // Wait briefly for async webhook handler + SSE flush
    const waitUntil = Date.now() + 4000
    while (Date.now() < waitUntil) {
      const aIds = sseA.events.filter(e => e.eventType === 'call').map(e => e.data?.call?.callId)
      const bIds = sseB.events.filter(e => e.eventType === 'call').map(e => e.data?.call?.callId)
      if (aIds.includes(CALL_ID_A) && aIds.includes(CALL_ID_U) && bIds.includes(CALL_ID_B) && bIds.includes(CALL_ID_U)) {
        break
      }
      await new Promise(r => setTimeout(r, 50))
    }

    // Verify MongoDB whatsapp_calls records
    const callA = await col('whatsapp_calls').findOne({ callId: CALL_ID_A })
    const callB = await col('whatsapp_calls').findOne({ callId: CALL_ID_B })
    const callU = await col('whatsapp_calls').findOne({ callId: CALL_ID_U })

    assert.ok(callA, 'whatsapp_calls should persist Call A')
    assert.ok(callB, 'whatsapp_calls should persist Call B')
    assert.ok(callU, 'whatsapp_calls should persist Unassigned Call U')

    assert.equal(callA.telecaller_id, telecallerA, `Call A should be assigned to ${telecallerA}`)
    assert.equal(callB.telecaller_id, telecallerB, `Call B should be assigned to ${telecallerB}`)
    assert.equal(callU.telecaller_id, null, 'Unknown caller U should have telecaller_id: null')

    // Verify SSE isolation
    const aCallIds = sseA.events.filter(e => e.eventType === 'call').map(e => e.data?.call?.callId)
    const bCallIds = sseB.events.filter(e => e.eventType === 'call').map(e => e.data?.call?.callId)

    assert.ok(aCallIds.includes(CALL_ID_A), 'Telecaller A SSE should receive Call A')
    assert.ok(!aCallIds.includes(CALL_ID_B), 'Telecaller A SSE must NOT receive Call B')
    assert.ok(aCallIds.includes(CALL_ID_U), 'Telecaller A SSE should receive unassigned Call U')

    assert.ok(bCallIds.includes(CALL_ID_B), 'Telecaller B SSE should receive Call B')
    assert.ok(!bCallIds.includes(CALL_ID_A), 'Telecaller B SSE must NOT receive Call A')
    assert.ok(bCallIds.includes(CALL_ID_U), 'Telecaller B SSE should receive unassigned Call U')

    // Also verify /api/calls/active isolation
    const activeARes = await fetch(`${baseUrl}/api/calls/active`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    const activeAJson = await activeARes.json()
    const activeAIds = (activeAJson.calls || []).map(c => c.callId)
    assert.ok(activeAIds.includes(CALL_ID_A), '/api/calls/active for A should include Call A')
    assert.ok(!activeAIds.includes(CALL_ID_B), '/api/calls/active for A must NOT include Call B')

    console.log('✅ Sticky routing verified:')
    console.log(`   - Call ${CALL_ID_A} -> telecaller_id=${callA.telecaller_id} (SSE A only)`)
    console.log(`   - Call ${CALL_ID_B} -> telecaller_id=${callB.telecaller_id} (SSE B only)`)
    console.log(`   - Call ${CALL_ID_U} -> telecaller_id=null (broadcast to both A & B)`)
  } finally {
    await sseA?.close().catch(() => {})
    await sseB?.close().catch(() => {})
    if (server) await new Promise(r => server.close(r))

    await col('leads').deleteMany({ phone: { $in: [TEST_PHONE_A, TEST_PHONE_B, TEST_PHONE_UNASSIGNED] } })
    await col('whatsapp_calls').deleteMany({ callId: { $in: [CALL_ID_A, CALL_ID_B, CALL_ID_U] } })
    await col('messages').deleteMany({ leadPhone: { $in: [TEST_PHONE_A, TEST_PHONE_B, TEST_PHONE_UNASSIGNED] } })
    await col('audit_logs').deleteMany({ 'payload.id': { $in: [CALL_ID_A, CALL_ID_B, CALL_ID_U] } })
    await closeDb()
  }
}

main().catch(err => {
  console.error('❌ Sticky routing test failed:', err)
  process.exit(1)
})
