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

const PHONE_1 = '919999700001'
const PHONE_2 = '919999700002'
const CALL_1 = `qa_test_busy_1_${Date.now()}`
const CALL_2 = `qa_test_busy_2_${Date.now()}`
const CALL_3 = `qa_test_busy_3_${Date.now()}`

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

function buildTerminatePayload(callId, fromPhone) {
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
                  event: 'terminate',
                  direction: 'USER_INITIATED',
                  end_reason: 'rejected',
                  duration: 0,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

async function openSse(baseUrl, token) {
  const controller = new AbortController()
  const events = []
  const res = await fetch(`${baseUrl}/api/calls/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
  assert.equal(res.status, 200)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const pump = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const frames = buf.split('\n\n')
        buf = frames.pop() || ''
        for (const f of frames) {
          let eventType = 'message'
          let dataLine = ''
          for (const line of f.split('\n')) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            if (line.startsWith('data:')) dataLine += line.slice(5).trim()
          }
          if (dataLine) {
            try { events.push({ eventType, data: JSON.parse(dataLine) }) } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }
  })()
  const deadline = Date.now() + 3000
  while (Date.now() < deadline && !events.some(e => e.eventType === 'connected')) {
    await new Promise(r => setTimeout(r, 20))
  }
  return { events, close: async () => { controller.abort(); await pump.catch(() => {}) } }
}

async function postWebhook(baseUrl, payload) {
  const raw = JSON.stringify(payload)
  const headers = { 'Content-Type': 'application/json' }
  const sig = signWebhookBody(raw)
  if (sig) headers['X-Hub-Signature-256'] = sig
  const res = await fetch(`${baseUrl}/webhook`, { method: 'POST', headers, body: raw })
  assert.equal(res.status, 200)
}

async function main() {
  await connectDb()
  const origFetch = globalThis.fetch
  const graphRequests = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url || '')
    if (u.startsWith('https://graph.facebook.com/')) {
      const body = init.body ? JSON.parse(init.body) : null
      graphRequests.push({ url: u, body })
      if (u.endsWith('/messages')) {
        return new Response(JSON.stringify({ messages: [{ id: `wamid.qa_test_busy_${graphRequests.length}` }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return origFetch(url, init)
  }

  const app = express()
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }))
  app.use(optionalAuth)
  app.use('/webhook', whatsappWebhookRouter)
  app.use('/api/calls', callsRouter)

  let server
  let sseHarish
  try {
    await col('leads').deleteMany({ phone: { $in: [PHONE_1, PHONE_2] } })
    await col('leads').insertMany([
      { phone: PHONE_1, name: 'QA Lead One', status: 'new', source: 'manual', assignedTo: 'harish', createdAt: new Date(), updatedAt: new Date() },
      { phone: PHONE_2, name: PHONE_2, status: 'new', source: 'manual', assignedTo: 'harish', createdAt: new Date(), updatedAt: new Date() },
    ])

    server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const harishToken = signToken({ sub: 'harish', username: 'harish', role: ROLES.TELECALLER })

    sseHarish = await openSse(baseUrl, harishToken)

    // 1. Lead 1 calls in -> harish accepts
    await postWebhook(baseUrl, buildConnectPayload(CALL_1, PHONE_1))
    const wait1 = Date.now() + 3000
    while (Date.now() < wait1 && !(await col('whatsapp_calls').findOne({ callId: CALL_1 }))) {
      await new Promise(r => setTimeout(r, 30))
    }

    const acceptRes = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(CALL_1)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${harishToken}` },
      body: JSON.stringify({ sdpAnswer: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' }),
    })
    assert.equal(acceptRes.status, 200, 'harish should accept Lead 1 call')

    // 2. While Lead 1 is active, Lead 2 calls in
    await postWebhook(baseUrl, buildConnectPayload(CALL_2, PHONE_2))
    const wait2 = Date.now() + 3000
    while (Date.now() < wait2 && !(await col('whatsapp_calls').findOne({ callId: CALL_2 }))) {
      await new Promise(r => setTimeout(r, 30))
    }

    // 3. Lead 2 redials within 5 minutes (CALL_3) -> must dedupe busy callback message
    await postWebhook(baseUrl, buildConnectPayload(CALL_3, PHONE_2))
    const wait3 = Date.now() + 3000
    while (Date.now() < wait3 && !(await col('whatsapp_calls').findOne({ callId: CALL_3 }))) {
      await new Promise(r => setTimeout(r, 30))
    }

    // 4. Meta sends follow-up terminate webhook for rejected CALL_2 -> must NOT send generic missed-call fallback or overwrite endReason
    await postWebhook(baseUrl, buildTerminatePayload(CALL_2, PHONE_2))
    await new Promise(r => setTimeout(r, 200))

    // Assertions
    const call1 = await col('whatsapp_calls').findOne({ callId: CALL_1 })
    const call2 = await col('whatsapp_calls').findOne({ callId: CALL_2 })
    const call3 = await col('whatsapp_calls').findOne({ callId: CALL_3 })

    assert.equal(call1.status, 'accepted', 'Lead 1 active call must remain accepted')
    assert.equal(call1.attended, true, 'Lead 1 active call must remain attended')
    assert.equal(call1.telecaller_id, 'harish')

    assert.equal(call2.status, 'missed', 'Lead 2 call must be saved as missed')
    assert.equal(call2.endReason, 'telecaller_busy', 'Lead 2 call must preserve endReason=telecaller_busy after terminate')
    assert.equal(call2.telecaller_id, 'harish', 'Lead 2 call must retain telecaller_id=harish')

    assert.equal(call3.endReason, 'telecaller_busy', 'Lead 2 redial must also be flagged telecaller_busy')

    const rejectCalls = graphRequests.filter(r => r.url.endsWith('/calls') && r.body?.action === 'reject')
    assert.ok(rejectCalls.some(r => r.body?.call_id === CALL_2), 'Meta reject action must fire for CALL_2')
    assert.ok(rejectCalls.some(r => r.body?.call_id === CALL_3), 'Meta reject action must fire for CALL_3')

    const busyRingsToHarish = sseHarish.events.filter(
      e => e.eventType === 'call' && e.data?.event === 'incoming_call' && [CALL_2, CALL_3].includes(e.data?.call?.callId)
    )
    assert.equal(busyRingsToHarish.length, 0, 'Harish SSE must NOT receive incoming_call ring for busy calls')

    const busyMsgs = await col('messages').find({ leadPhone: PHONE_2, kind: 'busy_callback' }).toArray()
    assert.equal(busyMsgs.length, 1, 'Busy callback WhatsApp message must fire once and dedupe within 5 minutes')
    assert.match(busyMsgs[0].text, /^Hi there, .*currently assisting another caller/i, 'Numeric-only lead name must fall back to "there"')

    const genericMissedMsgs = graphRequests.filter(
      r => r.url.endsWith('/messages') && r.body?.to === PHONE_2 && /missed your WhatsApp call/i.test(r.body?.text?.body || '')
    )
    assert.equal(genericMissedMsgs.length, 0, 'Generic missed-call fallback must NOT fire after telecaller_busy')

    console.log('✅ All concurrent busy-telecaller assertions passed:')
    console.log(`   - Lead 1 (${CALL_1}) remained active (${call1.status})`)
    console.log(`   - Lead 2 (${CALL_2}) rejected with endReason=${call2.endReason}, Meta reject sent, terminate suppressed duplicate fallback`)
    console.log(`   - Busy callback greeting used "Hi there, ..." & deduped on redial (${CALL_3})`)
  } finally {
    globalThis.fetch = origFetch
    await sseHarish?.close().catch(() => {})
    if (server) await new Promise(r => server.close(r))
    await col('leads').deleteMany({ phone: { $in: [PHONE_1, PHONE_2] } })
    await col('whatsapp_calls').deleteMany({ callId: { $in: [CALL_1, CALL_2, CALL_3] } })
    await col('messages').deleteMany({ leadPhone: { $in: [PHONE_1, PHONE_2] } })
    await col('audit_logs').deleteMany({ 'payload.id': { $in: [CALL_1, CALL_2, CALL_3] } })
    await closeDb()
  }
}

main().catch(err => {
  console.error('❌ Concurrent busy QA failed:', err)
  process.exit(1)
})
