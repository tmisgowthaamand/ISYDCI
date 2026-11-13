// Automated unit & webhook payload tests for Meta WhatsApp Business Calling API (v24.0)
// Usage: node backend/tests/test_whatsapp_calling.mjs

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { connectDb, closeDb, col } from '../db/mongo.js'
import {
  verifyMetaSignature,
  handleCallsWebhook,
  recordCallPermissionReply,
  getCallPermission,
  checkPermissionRequestRateLimit,
  initiateOutboundCall,
  saveCallRecording,
} from '../services/calling.js'

const TEST_PHONE = '919999888777'
const TEST_CALL_ID_IN = `wacid.test.in.${Date.now()}`
const TEST_CALL_ID_ANS = `wacid.test.ans.${Date.now()}`

let passed = 0
function check(cond, label) {
  assert.ok(cond, label)
  passed++
  console.log(`  ✅ ${label}`)
}

async function cleanup() {
  await col('whatsapp_calls').deleteMany({ waId: TEST_PHONE })
  await col('call_permissions').deleteMany({ waId: TEST_PHONE })
  await col('messages').deleteMany({ leadPhone: TEST_PHONE, channel: 'whatsapp_call' })
}

async function main() {
  console.log('Running WhatsApp Calling API unit & webhook tests...')
  await connectDb()
  await cleanup()

  // Prevent live outbound fallback messages during tests
  process.env.WHATSAPP_MISSED_CALL_FALLBACK = 'false'

  // 1. X-Hub-Signature-256 verification
  const secret = 'test_app_secret_12345'
  const rawPayload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const validSig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawPayload).digest('hex')

  check(verifyMetaSignature(rawPayload, validSig, secret).valid === true, 'Valid X-Hub-Signature-256 accepted')
  check(verifyMetaSignature(rawPayload, 'sha256=deadbeef', secret).valid === false, 'Invalid X-Hub-Signature-256 rejected')
  check(verifyMetaSignature(rawPayload, '', secret).valid === false, 'Missing X-Hub-Signature-256 rejected when secret set')
  check(verifyMetaSignature(rawPayload, '', '').skipped === true, 'Signature check skipped when secret is unset')

  // 2. Inbound call.connect webhook -> stored in whatsapp_calls with SDP offer
  await handleCallsWebhook({
    messaging_product: 'whatsapp',
    calls: [
      {
        id: TEST_CALL_ID_IN,
        from: TEST_PHONE,
        event: 'connect',
        direction: 'USER_INITIATED',
        session: { sdp_type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n' },
      },
    ],
  })

  const ringingDoc = await col('whatsapp_calls').findOne({ callId: TEST_CALL_ID_IN })
  check(ringingDoc && ringingDoc.status === 'ringing', 'Inbound call.connect stored with status=ringing')
  check(ringingDoc?.direction === 'inbound', 'Inbound call direction recorded as inbound')
  check(ringingDoc?.sdpSession?.offer?.includes('v=0'), 'Inbound SDP offer persisted')

  // 3. Missed call.terminate webhook
  await handleCallsWebhook({
    messaging_product: 'whatsapp',
    calls: [
      {
        id: TEST_CALL_ID_IN,
        from: TEST_PHONE,
        event: 'terminate',
        end_reason: 'missed',
      },
    ],
  })

  const missedDoc = await col('whatsapp_calls').findOne({ callId: TEST_CALL_ID_IN })
  check(missedDoc?.status === 'missed', 'Unanswered call.terminate transitions to status=missed')

  // 4. Answered call -> terminate with duration
  await col('whatsapp_calls').insertOne({
    callId: TEST_CALL_ID_ANS,
    waId: TEST_PHONE,
    direction: 'inbound',
    status: 'accepted',
    startedAt: new Date(Date.now() - 45000),
    answeredAt: new Date(Date.now() - 30000),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await handleCallsWebhook({
    messaging_product: 'whatsapp',
    calls: [
      {
        id: TEST_CALL_ID_ANS,
        from: TEST_PHONE,
        event: 'terminate',
        duration: 30,
        end_reason: 'caller_hangup',
      },
    ],
  })

  const completedDoc = await col('whatsapp_calls').findOne({ callId: TEST_CALL_ID_ANS })
  check(completedDoc?.status === 'completed' && completedDoc?.durationSec === 30, 'Answered call.terminate transitions to completed with durationSec=30')

  // 5. call_permission_reply webhook (accept -> 72h expiry, reject -> blocked)
  await handleCallsWebhook({
    messaging_product: 'whatsapp',
    calls: [
      {
        from: TEST_PHONE,
        event: 'call_permission_reply',
        call_permission_reply: { response: 'accept' },
      },
    ],
  })

  const permAccepted = await getCallPermission(TEST_PHONE)
  const hoursUntilExpiry = (new Date(permAccepted.expiresAt).getTime() - Date.now()) / (1000 * 3600)
  check(permAccepted.allowed === true && permAccepted.status === 'accepted', 'call_permission_reply accept sets allowed=true')
  check(hoursUntilExpiry > 71.9 && hoursUntilExpiry <= 72.1, `Permission expires in ~72h (${hoursUntilExpiry.toFixed(2)}h)`)

  await recordCallPermissionReply(TEST_PHONE, 'reject', { source: 'test' })
  const permRejected = await getCallPermission(TEST_PHONE)
  check(permRejected.allowed === false && permRejected.status === 'rejected', 'call_permission_reply reject revokes outbound permission')

  // 6. Outbound call permission guard (403 when not permitted)
  let blocked403 = false
  try {
    await initiateOutboundCall(TEST_PHONE, 'v=0\r\n')
  } catch (err) {
    blocked403 = err.status === 403
  }
  check(blocked403, 'initiateOutboundCall blocks with 403 when no active call permission exists')

  // 7. Outbound call_permission_request rate-limit guards (1/24h, 2/7d)
  const now = new Date()
  await col('call_permissions').updateOne(
    { waId: TEST_PHONE },
    { $set: { requestTimestamps: [] } },
    { upsert: true }
  )
  const r0 = await checkPermissionRequestRateLimit(TEST_PHONE, now)
  check(r0.allowed === true, 'Rate limit allows first call_permission_request')

  await col('call_permissions').updateOne(
    { waId: TEST_PHONE },
    { $set: { requestTimestamps: [new Date(now.getTime() - 2 * 3600 * 1000)] } }
  )
  const r24 = await checkPermissionRequestRateLimit(TEST_PHONE, now)
  check(r24.allowed === false && r24.count24h === 1, 'Rate limit blocks 2nd request within 24h')

  await col('call_permissions').updateOne(
    { waId: TEST_PHONE },
    {
      $set: {
        requestTimestamps: [
          new Date(now.getTime() - 26 * 3600 * 1000),
          new Date(now.getTime() - 72 * 3600 * 1000),
        ],
      },
    }
  )
  const r7d = await checkPermissionRequestRateLimit(TEST_PHONE, now)
  check(r7d.allowed === false && r7d.count7d === 2, 'Rate limit blocks 3rd request within 7 days')

  // 8. Save call recording (.webm) and verify recordingUrl persisted + file written
  const dummyBase64 = 'data:audio/webm;base64,' + Buffer.from('WEBM_TEST_AUDIO_BYTES').toString('base64')
  const recRes = await saveCallRecording(TEST_CALL_ID_ANS, {
    audioBase64: dummyBase64,
    mimeType: 'audio/webm',
    durationSec: 30,
  })
  const recDoc = await col('whatsapp_calls').findOne({ callId: TEST_CALL_ID_ANS })
  const savedFile = path.resolve(__dirname, '../uploads/recordings', `${TEST_CALL_ID_ANS}.webm`)
  check(recRes.recordingUrl === `/uploads/recordings/${TEST_CALL_ID_ANS}.webm`, 'saveCallRecording returns expected recordingUrl')
  check(recDoc?.recordingUrl === recRes.recordingUrl && fs.existsSync(savedFile), 'Recording URL stored in DB and file written to disk')
  fs.unlinkSync(savedFile)

  await cleanup()
  await closeDb()
  console.log(`\nAll ${passed} WhatsApp Calling API tests passed!`)
}

main().catch(async err => {
  console.error('Test failed:', err)
  await cleanup().catch(() => {})
  await closeDb().catch(() => {})
  process.exit(1)
})

