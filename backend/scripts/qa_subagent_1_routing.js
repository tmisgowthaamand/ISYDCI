// QA Sub-Agent 1: Sticky Routing, Phone Normalization & Offline Fallback
// Run from backend/: node scripts/qa_subagent_1_routing.js

import assert from 'assert'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Ensure test-safe defaults if optional env vars are missing, and avoid live Meta API calls
if (!process.env.JWT_SECRET && !process.env.ADMIN_PASSWORD) {
  process.env.JWT_SECRET = 'qa_test_jwt_secret_ephemeral'
}
if (!process.env.WHATSAPP_APP_SECRET && !process.env.APP_SECRET) {
  process.env.WHATSAPP_APP_SECRET = 'qa_test_app_secret_ephemeral'
}
if (!process.env.WHATSAPP_TOKEN) {
  process.env.WHATSAPP_TOKEN = 'qa_test_token_ephemeral'
}
if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
  process.env.WHATSAPP_PHONE_NUMBER_ID = '000000000000000'
}
process.env.WHATSAPP_MISSED_CALL_FALLBACK = 'false'

import { connectDb, closeDb, col } from '../db/mongo.js'
import { leadPhone } from '../services/leads.js'
import { optionalAuth, signToken, ROLES } from '../services/auth.js'
import whatsappWebhookRouter from '../routes/whatsappWebhook.js'
import callsRouter from '../routes/calls.js'

const TEST_PHONES = ['919999000101', '919999000102', '919999000103', '919999000104']
const TEST_CALL_IDS = [
  'qa_test_call_a',
  'qa_test_call_b',
  'qa_test_call_c',
  'qa_test_call_offline',
]

const findings = []
let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`  PASS: ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL: ${name} -> ${err.message}`)
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  PASS: ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL: ${name} -> ${err.message}`)
  }
}

function signWebhookBody(rawBody) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function buildCallsWebhookPayload(callObj) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'qa_test_waba',
        changes: [
          {
            field: 'calls',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919999999999',
                phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
              },
              calls: [callObj],
            },
          },
        ],
      },
    ],
  }
}

async function openSseStream(baseUrl, token) {
  const controller = new AbortController()
  const res = await fetch(`${baseUrl}/api/calls/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
  assert.strictEqual(res.status, 200, `SSE HTTP status should be 200, got ${res.status}`)

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
    close: () => {
      controller.abort()
      return pump.catch(() => {})
    },
  }
}

async function waitFor(predicate, timeoutMs = 4000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

async function main() {
  const originalFetch = globalThis.fetch
  let server = null
  let sseA = null
  let sseB = null

  // Stub only outbound Meta Graph API calls so acceptCall() never hits live Graph API
  globalThis.fetch = async (url, init) => {
    const u = String(url || '')
    if (u.startsWith('https://graph.facebook.com/')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(url, init)
  }

  try {
    await connectDb()
    console.log('\n=== 1. Phone Normalization Tests (leadPhone) ===')

    check('leadPhone("+919876543210") === "919876543210"', () => {
      assert.strictEqual(leadPhone('+919876543210'), '919876543210')
    })
    check('leadPhone("919876543210") === "919876543210"', () => {
      assert.strictEqual(leadPhone('919876543210'), '919876543210')
    })
    check('leadPhone("9876543210") === "919876543210"', () => {
      assert.strictEqual(leadPhone('9876543210'), '919876543210')
    })

    const zeroPrefixed = leadPhone('09876543210')
    console.log(`  INFO: leadPhone("09876543210") returned "${zeroPrefixed}"`)
    if (zeroPrefixed !== '919876543210') {
      findings.push(
        `DISCREPANCY: leadPhone("09876543210") returns "${zeroPrefixed}" instead of "919876543210" because leadPhone() only prepends "91" when digits.length === 10 and does not strip a leading "0" on 11-digit Indian trunk numbers.`
      )
    }
    check('leadPhone("09876543210") normalizes trunk-prefixed 11-digit number to 919876543210', () => {
      assert.strictEqual(zeroPrefixed, '919876543210')
    })

    console.log('\n=== 2. Seed QA Leads & Boot Ephemeral Express Server ===')
    const now = new Date()
    await col('leads').deleteMany({ phone: { $in: TEST_PHONES } })
    await col('leads').insertMany([
      {
        phone: '919999000101',
        name: 'qa_test_lead_a',
        assignedTo: 'qa_test_tc_a',
        status: 'new',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: '919999000102',
        name: 'qa_test_lead_b',
        assignedTo: 'qa_test_tc_b',
        status: 'new',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: '919999000103',
        name: 'qa_test_lead_c_unassigned',
        assignedTo: null,
        status: 'new',
        createdAt: now,
        updatedAt: now,
      },
      {
        phone: '919999000104',
        name: 'qa_test_lead_offline',
        assignedTo: 'qa_test_tc_a',
        status: 'new',
        createdAt: now,
        updatedAt: now,
      },
    ])

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

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address()
    const baseUrl = `http://127.0.0.1:${port}`
    console.log(`  INFO: Ephemeral server listening on ${baseUrl}`)

    const tokenA = signToken({ sub: 'qa_test_id_a', username: 'qa_test_tc_a', role: ROLES.TELECALLER })
    const tokenB = signToken({ sub: 'qa_test_id_b', username: 'qa_test_tc_b', role: ROLES.TELECALLER })

    async function sendSignedWebhook(payload) {
      const raw = JSON.stringify(payload)
      const sig = signWebhookBody(raw)
      return fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': sig,
        },
        body: raw,
      })
    }

    await checkAsync('POST /webhook rejects invalid HMAC signature with 401', async () => {
      const res = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=deadbeef',
        },
        body: JSON.stringify({}),
      })
      assert.strictEqual(res.status, 401)
    })

    console.log('\n=== 3. SSE Stream Isolation & Sticky Routing ===')
    sseA = await openSseStream(baseUrl, tokenA)
    sseB = await openSseStream(baseUrl, tokenB)

    const connectA = await sendSignedWebhook(
      buildCallsWebhookPayload({
        id: 'qa_test_call_a',
        from: '+919999000101',
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=qa_a 1 1 IN IP4 127.0.0.1\r\n' },
      })
    )
    assert.strictEqual(connectA.status, 200)

    const connectB = await sendSignedWebhook(
      buildCallsWebhookPayload({
        id: 'qa_test_call_b',
        from: '9999000102', // 10-digit format to verify normalization in webhook
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=qa_b 1 1 IN IP4 127.0.0.1\r\n' },
      })
    )
    assert.strictEqual(connectB.status, 200)

    const connectC = await sendSignedWebhook(
      buildCallsWebhookPayload({
        id: 'qa_test_call_c',
        from: '919999000103',
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=qa_c 1 1 IN IP4 127.0.0.1\r\n' },
      })
    )
    assert.strictEqual(connectC.status, 200)

    const gotExpectedSse = await waitFor(() => {
      const aIds = sseA.events.filter(e => e.event === 'call').map(e => e.data?.call?.callId)
      const bIds = sseB.events.filter(e => e.event === 'call').map(e => e.data?.call?.callId)
      return (
        aIds.includes('qa_test_call_a') &&
        aIds.includes('qa_test_call_c') &&
        bIds.includes('qa_test_call_b') &&
        bIds.includes('qa_test_call_c')
      )
    }, 4000)
    assert.ok(gotExpectedSse, 'Timed out waiting for expected SSE call events')

    const aCallIds = sseA.events.filter(e => e.event === 'call').map(e => e.data?.call?.callId)
    const bCallIds = sseB.events.filter(e => e.event === 'call').map(e => e.data?.call?.callId)

    check('SSE Stream A receives Lead A and Unassigned C, never Lead B', () => {
      assert.ok(aCallIds.includes('qa_test_call_a'), 'A missing qa_test_call_a')
      assert.ok(aCallIds.includes('qa_test_call_c'), 'A missing unassigned qa_test_call_c')
      assert.ok(!aCallIds.includes('qa_test_call_b'), 'A leaked qa_test_call_b')
    })

    check('SSE Stream B receives Lead B and Unassigned C, never Lead A', () => {
      assert.ok(bCallIds.includes('qa_test_call_b'), 'B missing qa_test_call_b')
      assert.ok(bCallIds.includes('qa_test_call_c'), 'B missing unassigned qa_test_call_c')
      assert.ok(!bCallIds.includes('qa_test_call_a'), 'B leaked qa_test_call_a')
    })

    console.log('\n=== 4. GET /api/calls/active Isolation & Accepting/Locking Unassigned Call ===')
    await checkAsync('GET /api/calls/active isolates A vs B and includes unassigned C for both', async () => {
      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${tokenA}` } }),
        fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${tokenB}` } }),
      ])
      assert.strictEqual(resA.status, 200)
      assert.strictEqual(resB.status, 200)
      const jsonA = await resA.json()
      const jsonB = await resB.json()
      const idsA = jsonA.calls.map(c => c.callId)
      const idsB = jsonB.calls.map(c => c.callId)

      assert.ok(idsA.includes('qa_test_call_a'), 'active(A) missing qa_test_call_a')
      assert.ok(idsA.includes('qa_test_call_c'), 'active(A) missing qa_test_call_c')
      assert.ok(!idsA.includes('qa_test_call_b'), 'active(A) leaked qa_test_call_b')

      assert.ok(idsB.includes('qa_test_call_b'), 'active(B) missing qa_test_call_b')
      assert.ok(idsB.includes('qa_test_call_c'), 'active(B) missing qa_test_call_c')
      assert.ok(!idsB.includes('qa_test_call_a'), 'active(B) leaked qa_test_call_a')
    })

    await checkAsync('Accepting unassigned call C as qa_test_tc_a locks telecaller_id and hides it from B', async () => {
      const acceptRes = await fetch(`${baseUrl}/api/calls/qa_test_call_c/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ sdpAnswer: 'v=0\r\no=qa_ans 1 1 IN IP4 127.0.0.1\r\n' }),
      })
      assert.strictEqual(acceptRes.status, 200)
      const acceptJson = await acceptRes.json()
      assert.strictEqual(acceptJson.call?.status, 'accepted')
      assert.strictEqual(acceptJson.call?.attended, true)
      assert.strictEqual(acceptJson.call?.telecaller_id, 'qa_test_tc_a')

      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${tokenA}` } }),
        fetch(`${baseUrl}/api/calls/active`, { headers: { Authorization: `Bearer ${tokenB}` } }),
      ])
      const idsA = (await resA.json()).calls.map(c => c.callId)
      const idsB = (await resB.json()).calls.map(c => c.callId)
      assert.ok(idsA.includes('qa_test_call_c'), 'active(A) should still include locked qa_test_call_c')
      assert.ok(!idsB.includes('qa_test_call_c'), 'active(B) should no longer include qa_test_call_c after A accepted')
    })

    // Note: Check whether acceptCall() prevents a second telecaller from overwriting telecaller_id
    findings.push(
      'NOTE: In backend/services/calling.js, acceptCall() does not guard against a second telecaller calling POST /api/calls/:callId/accept on an already-accepted call (it unconditionally overwrites telecaller_id if provided).'
    )

    console.log('\n=== 5. Offline Fallback (No Active SSE Stream -> Terminate -> Missed + Thread Log) ===')
    await sseA.close()
    await sseB.close()
    sseA = null
    sseB = null

    const offlineConnect = await sendSignedWebhook(
      buildCallsWebhookPayload({
        id: 'qa_test_call_offline',
        from: '+919999000104',
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=qa_off 1 1 IN IP4 127.0.0.1\r\n' },
      })
    )
    assert.strictEqual(offlineConnect.status, 200)

    const offlineCreated = await waitFor(async () => {
      const doc = await col('whatsapp_calls').findOne({ callId: 'qa_test_call_offline' })
      return Boolean(doc)
    }, 3000)
    assert.ok(offlineCreated, 'qa_test_call_offline was not inserted after connect webhook')

    const offlineTerminate = await sendSignedWebhook(
      buildCallsWebhookPayload({
        id: 'qa_test_call_offline',
        from: '+919999000104',
        event: 'terminate',
        duration: 0,
      })
    )
    assert.strictEqual(offlineTerminate.status, 200)

    const offlineMissed = await waitFor(async () => {
      const doc = await col('whatsapp_calls').findOne({ callId: 'qa_test_call_offline' })
      return doc?.status === 'missed'
    }, 3000)
    assert.ok(offlineMissed, 'qa_test_call_offline did not transition to status: "missed"')

    await checkAsync('Offline call transitions to missed, retains telecaller_id, and logs to messages thread', async () => {
      const callDoc = await col('whatsapp_calls').findOne({ callId: 'qa_test_call_offline' })
      assert.strictEqual(callDoc.status, 'missed')
      assert.strictEqual(callDoc.attended, false)
      assert.strictEqual(callDoc.telecaller_id, 'qa_test_tc_a')

      const msgs = await col('messages')
        .find({ leadPhone: '919999000104', waMessageId: 'qa_test_call_offline', type: 'call_log' })
        .toArray()
      assert.ok(msgs.length >= 2, `Expected >= 2 call_log messages (connect + missed), found ${msgs.length}`)
      assert.ok(
        msgs.some(m => String(m.text || '').toLowerCase().includes('missed')),
        'Expected a missed call summary message in messages thread'
      )
    })
  } finally {
    console.log('\n=== 6. Cleanup (finally) ===')
    if (sseA) await sseA.close().catch(() => {})
    if (sseB) await sseB.close().catch(() => {})
    if (server) await new Promise(resolve => server.close(resolve))
    globalThis.fetch = originalFetch

    try {
      const [delLeads, delCalls, delMsgs, delAudits, delEvents] = await Promise.all([
        col('leads').deleteMany({
          $or: [{ phone: { $in: TEST_PHONES } }, { name: /^qa_test_/ }, { assignedTo: /^qa_test_/ }],
        }),
        col('whatsapp_calls').deleteMany({
          $or: [
            { callId: { $in: TEST_CALL_IDS } },
            { callId: /^qa_test_/ },
            { waId: { $in: TEST_PHONES } },
            { telecaller_id: /^qa_test_/ },
          ],
        }),
        col('messages').deleteMany({
          $or: [{ leadPhone: { $in: TEST_PHONES } }, { waMessageId: /^qa_test_/ }],
        }),
        col('audit_logs').deleteMany({
          $or: [{ actor: /^qa_test_/ }, { target: /qa_test_/ }, { path: /qa_test_/ }],
        }),
        col('webhook_events').deleteMany({
          $or: [
            { summary: /qa_test_|91999900010[1-4]/ },
            { 'payload.id': /^qa_test_/ },
            { 'payload.callId': /^qa_test_/ },
          ],
        }),
      ])
      console.log(
        `  CLEANUP: leads=${delLeads.deletedCount}, whatsapp_calls=${delCalls.deletedCount}, messages=${delMsgs.deletedCount}, audit_logs=${delAudits.deletedCount}, webhook_events=${delEvents.deletedCount}`
      )
    } catch (cleanErr) {
      console.error('  CLEANUP ERROR:', cleanErr.message)
      failed++
    }

    await closeDb().catch(() => {})
  }

  console.log('\n=== Summary ===')
  console.log(`Passed: ${passed}, Failed: ${failed}`)
  if (findings.length) {
    console.log('Findings:')
    for (const f of findings) console.log(`  - ${f}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
