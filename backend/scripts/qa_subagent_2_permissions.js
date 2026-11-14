// QA Sub-Agent 2: Outbound Call Permissions & Rate-Limit Guard QA
// Run from backend/: node scripts/qa_subagent_2_permissions.js
import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

import assert from 'node:assert/strict'
import { connectDb, closeDb, col } from '../db/mongo.js'
import {
  PERMISSION_LIMIT_24H,
  PERMISSION_LIMIT_7D,
  PERMISSION_TTL_MS,
  checkPermissionRequestRateLimit,
  getCallPermission,
  handleCallsWebhook,
  initiateOutboundCall,
  recordCallPermissionReply,
  sendCallPermissionRequest,
} from '../services/calling.js'

const TEST_PHONES = [
  '919999800001',
  '919999800002',
  '919999800003',
  '919999800004',
  '919999800005',
]

let passed = 0
let failed = 0
const gaps = []

function pass(name, detail = '') {
  passed += 1
  console.log(`✅ PASS: ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, err) {
  failed += 1
  console.error(`❌ FAIL: ${name} — ${err?.message || err}`)
}

function reportGap(title, detail) {
  gaps.push({ title, detail })
  console.warn(`⚠️  GAP / MISSING RULE: ${title} — ${detail}`)
}

async function runCheck(name, fn) {
  try {
    await fn()
    pass(name)
  } catch (err) {
    fail(name, err)
  }
}

async function cleanup() {
  const phoneRegex = /^9199998000/
  const qaRegex = /qa_test_/i
  await Promise.all([
    col('call_permissions').deleteMany({ waId: { $in: TEST_PHONES } }),
    col('whatsapp_calls').deleteMany({
      $or: [{ waId: { $in: TEST_PHONES } }, { callId: qaRegex }],
    }),
    col('messages').deleteMany({
      $or: [{ leadPhone: { $in: TEST_PHONES } }, { waMessageId: qaRegex }],
    }),
    col('leads').deleteMany({
      $or: [{ phone: { $in: TEST_PHONES } }, { phone: phoneRegex }],
    }),
    col('audit_logs').deleteMany({
      $or: [{ target: qaRegex }, { details: qaRegex }, { target: phoneRegex }],
    }),
    col('webhook_events').deleteMany({
      $or: [
        { summary: qaRegex },
        { summary: /9199998000/ },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.from': { $in: TEST_PHONES } },
        { 'payload.id': qaRegex },
      ],
    }),
  ])
}

async function main() {
  // Ensure dummy Meta credentials exist if not set in .env so mocked fetch tests don't abort on missing env
  const prevToken = process.env.WHATSAPP_TOKEN
  const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const prevFallback = process.env.WHATSAPP_MISSED_CALL_FALLBACK
  if (!process.env.WHATSAPP_TOKEN) process.env.WHATSAPP_TOKEN = 'qa_test_dummy_token'
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) process.env.WHATSAPP_PHONE_NUMBER_ID = '100000000000001'
  process.env.WHATSAPP_MISSED_CALL_FALLBACK = 'false'

  const origFetch = globalThis.fetch
  let fetchCalls = []
  let nextCallCounter = 1

  globalThis.fetch = async (url, opts = {}) => {
    fetchCalls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const callId = `wacid.qa_test_${nextCallCounter++}`
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: `wamid.qa_test_${nextCallCounter}` }],
        calls: [{ id: callId }],
      }),
    }
  }

  await connectDb()
  await cleanup()

  try {
    console.log('\n=== Suite 1: Permission Request Rate Limits (1/24h, 2/7d) & Connected-Call Reset ===')

    const p1 = TEST_PHONES[0]
    await runCheck('1.1 Fresh phone is allowed to send permission request (0/24h, 0/7d)', async () => {
      const r = await checkPermissionRequestRateLimit(p1)
      assert.equal(r.allowed, true)
      assert.equal(r.count24h, 0)
      assert.equal(r.count7d, 0)
      assert.equal(PERMISSION_LIMIT_24H, 1)
      assert.equal(PERMISSION_LIMIT_7D, 2)
    })

    await runCheck('1.2 First sendCallPermissionRequest succeeds and records timestamp', async () => {
      fetchCalls = []
      const res = await sendCallPermissionRequest(p1, { bodyText: 'qa_test_ permission request 1' })
      assert.equal(res.waId, p1)
      assert.equal(fetchCalls.length, 1)
      assert.match(fetchCalls[0].url, /\/messages$/)
      assert.equal(fetchCalls[0].body.interactive.type, 'call_permission_request')

      const doc = await col('call_permissions').findOne({ waId: p1 })
      assert.ok(doc)
      assert.equal(doc.status, 'pending')
      assert.equal(doc.requestTimestamps.length, 1)
    })

    await runCheck('1.3 Second sendCallPermissionRequest within 24h is blocked (429) without hitting Graph API', async () => {
      fetchCalls = []
      let caught = null
      try {
        await sendCallPermissionRequest(p1)
      } catch (err) {
        caught = err
      }
      assert.ok(caught, 'Expected 429 error')
      assert.equal(caught.status, 429)
      assert.match(caught.message, /1 call permission request per 24 hours/i)
      assert.equal(caught.rateLimit.count24h, 1)
      assert.equal(fetchCalls.length, 0, 'Graph API must not be called when rate-limited')
    })

    await runCheck('1.4 After 24h passes, 2nd request within 7d is allowed', async () => {
      const future25h = new Date(Date.now() + 25 * 3600 * 1000)
      const r = await checkPermissionRequestRateLimit(p1, future25h)
      assert.equal(r.allowed, true)
      assert.equal(r.count24h, 0)
      assert.equal(r.count7d, 1)
    })

    await runCheck('1.5 Two requests within 7 days blocks a 3rd request (2/7d limit)', async () => {
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000)
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 3600 * 1000)
      await col('call_permissions').updateOne(
        { waId: p1 },
        { $set: { requestTimestamps: [fourDaysAgo, twoDaysAgo], updatedAt: now } }
      )
      const r = await checkPermissionRequestRateLimit(p1, now)
      assert.equal(r.allowed, false)
      assert.equal(r.count24h, 0)
      assert.equal(r.count7d, 2)
      assert.match(r.reason, /2 call permission requests per 7 days/i)
    })

    await runCheck('1.6 Connected-call rate-limit reset check (documents actual codebase behavior)', async () => {
      // Simulate an accepted + completed call for p1
      const callId = 'wacid.qa_test_connected_reset'
      await col('whatsapp_calls').insertOne({
        callId,
        waId: p1,
        direction: 'outbound',
        status: 'ringing',
        attended: false,
        createdAt: new Date(),
      })
      await handleCallsWebhook({
        calls: [
          {
            id: callId,
            from: p1,
            direction: 'BUSINESS_INITIATED',
            event: 'connect',
            session: { sdp_type: 'answer', sdp: 'v=0\r\n' },
          },
          {
            id: callId,
            from: p1,
            event: 'terminate',
            duration: 42,
          },
        ],
      })
      const afterCall = await checkPermissionRequestRateLimit(p1)
      assert.equal(afterCall.allowed, true, 'Connected call should reset requestTimestamps')
      assert.equal(afterCall.count7d, 0)
    })

    console.log('\n=== Suite 2: call_permission_reply Webhooks & Outbound Call Guard ===')

    const p2 = TEST_PHONES[1]
    await runCheck('2.1 Outbound call without any permission is rejected (403) before Graph API', async () => {
      fetchCalls = []
      let caught = null
      try {
        await initiateOutboundCall(p2, 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n')
      } catch (err) {
        caught = err
      }
      assert.ok(caught)
      assert.equal(caught.status, 403)
      assert.equal(caught.permission.status, 'none')
      assert.equal(fetchCalls.length, 0)
    })

    await runCheck('2.2 Temporary approval webhook sets 72h permissionExpiresAt and allows outbound call', async () => {
      const t0 = new Date()
      await handleCallsWebhook({
        calls: [
          {
            from: p2,
            event: 'call_permission_reply',
            call_permission_reply: { response: 'accept' },
          },
        ],
      })
      const perm = await getCallPermission(p2, t0)
      assert.equal(perm.allowed, true)
      assert.equal(perm.status, 'accepted')
      assert.equal(perm.isPermanent, false)
      assert.ok(perm.expiresAt)
      const deltaMs = new Date(perm.expiresAt).getTime() - t0.getTime()
      assert.ok(Math.abs(deltaMs - PERMISSION_TTL_MS) < 5000, `Expected ~72h TTL, got ${deltaMs}ms`)

      const expiredPerm = await getCallPermission(p2, new Date(t0.getTime() + PERMISSION_TTL_MS + 1000))
      assert.equal(expiredPerm.allowed, false)
      assert.equal(expiredPerm.status, 'expired')

      fetchCalls = []
      const callRes = await initiateOutboundCall(p2, 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n')
      assert.ok(callRes.callId)
      assert.equal(fetchCalls.length, 1)
      assert.match(fetchCalls[0].url, /\/calls$/)
    })

    const p3 = TEST_PHONES[2]
    await runCheck('2.3 Permanent approval (top-level is_permanent: true) sets isPermanent: true and no expiry', async () => {
      await handleCallsWebhook({
        calls: [
          {
            from: p3,
            event: 'call_permission_reply',
            is_permanent: true,
            call_permission_reply: { response: 'accept' },
          },
        ],
      })
      const perm = await getCallPermission(p3)
      assert.equal(perm.allowed, true)
      assert.equal(perm.isPermanent, true)
      assert.equal(perm.expiresAt, null)

      const farFuture = new Date(Date.now() + 365 * 24 * 3600 * 1000)
      const permFuture = await getCallPermission(p3, farFuture)
      assert.equal(permFuture.allowed, true)
      assert.equal(permFuture.status, 'accepted')
    })

    const p4 = TEST_PHONES[3]
    await runCheck('2.4 Nested call_permission_reply.is_permanent check (bug detection)', async () => {
      await handleCallsWebhook({
        calls: [
          {
            from: p4,
            event: 'call_permission_reply',
            call_permission_reply: { response: 'accept', is_permanent: true },
          },
        ],
      })
      const perm = await getCallPermission(p4)
      assert.equal(perm.allowed, true)
      if (!perm.isPermanent) {
        reportGap(
          'Nested call_permission_reply.is_permanent is ignored',
          'recordCallPermissionReply only checks rawPayload?.is_permanent (top-level on call object), missing call.call_permission_reply?.is_permanent.'
        )
      }
    })

    await runCheck('2.5 Declined/revoked webhook sets status=rejected and blocks outbound call before Graph API', async () => {
      await handleCallsWebhook({
        calls: [
          {
            from: p3,
            event: 'call_permission_reply',
            call_permission_reply: { response: 'reject' },
          },
        ],
      })
      const permAfterReject = await getCallPermission(p3)
      assert.equal(permAfterReject.allowed, false)
      assert.equal(permAfterReject.status, 'rejected')
      assert.equal(permAfterReject.isPermanent, false)
      assert.equal(permAfterReject.expiresAt, null)

      fetchCalls = []
      let caught = null
      try {
        await initiateOutboundCall(p3, 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n')
      } catch (err) {
        caught = err
      }
      assert.ok(caught)
      assert.equal(caught.status, 403)
      assert.equal(fetchCalls.length, 0, 'Graph API must not be hit when permission is rejected/revoked')

      // Also verify revoke string
      await recordCallPermissionReply(p2, 'revoked', { response: 'revoked' })
      const permRevoked = await getCallPermission(p2)
      assert.equal(permRevoked.allowed, false)
      assert.equal(permRevoked.status, 'rejected')
    })

    console.log('\n=== Suite 3: Consecutive Unanswered Outbound Calls (2 warning / 4 auto-revocation) ===')

    const p5 = TEST_PHONES[4]
    await runCheck('3.1 Simulate 2 and 4 consecutive unanswered outbound calls and inspect call_permissions', async () => {
      await recordCallPermissionReply(p5, 'accept', { response: 'accept' })
      const before = await getCallPermission(p5)
      assert.equal(before.allowed, true)

      for (let i = 1; i <= 4; i++) {
        const res = await initiateOutboundCall(p5, 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n')
        await handleCallsWebhook({
          calls: [
            {
              id: res.callId,
              from: p5,
              event: 'terminate',
              end_reason: 'no_answer',
              duration: 0,
            },
          ],
        })

        if (i === 2) {
          const doc2 = await col('call_permissions').findOne({ waId: p5 })
          assert.equal(doc2.status, 'accepted')
          assert.equal(doc2.consecutiveUnansweredOutbound, 2)
          assert.equal(doc2.unansweredWarning, true)
        }
      }

      const permAfter4 = await getCallPermission(p5)
      const doc4 = await col('call_permissions').findOne({ waId: p5 })
      assert.equal(permAfter4.allowed, false, '4 consecutive unanswered outbound calls must auto-revoke permission')
      assert.equal(doc4.status, 'rejected')
      assert.equal(doc4.revokedReason, '4_consecutive_unanswered')
    })
  } finally {
    globalThis.fetch = origFetch
    if (prevToken === undefined) delete process.env.WHATSAPP_TOKEN
    else process.env.WHATSAPP_TOKEN = prevToken
    if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID
    else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId
    if (prevFallback === undefined) delete process.env.WHATSAPP_MISSED_CALL_FALLBACK
    else process.env.WHATSAPP_MISSED_CALL_FALLBACK = prevFallback

    await cleanup()
    await closeDb()
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed, ${gaps.length} codebase gaps noted ===`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal QA script error:', err)
  process.exit(1)
})
