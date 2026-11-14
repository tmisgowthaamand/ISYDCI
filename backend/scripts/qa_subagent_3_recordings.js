import 'dotenv/config'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

import { connectDb, closeDb, col } from '../db/mongo.js'
import { optionalAuth, signToken, ROLES } from '../services/auth.js'
import {
  META_RECORDING_CONFIG,
  PROTECTED_RECORDINGS_DIR,
  GRAPH_BASE,
  initiateOutboundCall,
  preAcceptCall,
  acceptCall,
  handleCallsWebhook,
} from '../services/calling.js'
import callsRouter from '../routes/calls.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const createdFiles = new Set()
const qaCallIds = []
let server = null

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    passed++
    console.log(`✅ PASS: ${name}`)
  } catch (err) {
    failed++
    console.error(`❌ FAIL: ${name} -> ${err.message}`)
  }
}

function assertNoStackTraceLeak(bodyText, label) {
  assert.ok(!bodyText.includes('\n    at '), `${label}: response leaked a stack trace`)
  assert.ok(!/Error:\s/.test(bodyText), `${label}: response leaked raw Error: prefix`)
}

async function main() {
  // Ensure test-safe fallback credentials in memory only if .env omits them
  process.env.WHATSAPP_TOKEN ||= 'qa_test_dummy_whatsapp_token'
  process.env.WHATSAPP_PHONE_NUMBER_ID ||= 'qa_test_phone_number_id'

  await connectDb()

  const runId = Date.now()
  const outboundCallId = `qa_test_outbound_${runId}`
  const inboundCallId = `qa_test_inbound_${runId}`
  const recordingCallId = `qa_test_rec_${runId}`
  qaCallIds.push(outboundCallId, inboundCallId, recordingCallId)

  // ------------------------------------------------------------------
  // 1. Audit META_RECORDING_CONFIG on outbound (connect) & inbound (accept)
  // ------------------------------------------------------------------
  await check('META_RECORDING_CONFIG has expected ENABLED structure', () => {
    assert.equal(META_RECORDING_CONFIG.status, 'ENABLED')
    assert.ok(META_RECORDING_CONFIG.purpose, 'purpose should be set')
    assert.ok(META_RECORDING_CONFIG.announcement_language, 'announcement_language should be set')
  })

  await check('Outbound initiateOutboundCall (action: connect) attaches META_RECORDING_CONFIG', async () => {
    const capturedPayloads = []
    const origFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      capturedPayloads.push({ url: String(url), body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ calls: [{ id: outboundCallId }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    try {
      await initiateOutboundCall('919999900001', 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n', {
        bypassPermissionCheck: true,
        telecallerId: 'qa_test_telecaller',
      })
    } finally {
      globalThis.fetch = origFetch
    }
    assert.equal(capturedPayloads.length, 1)
    assert.equal(capturedPayloads[0].body.action, 'connect')
    assert.deepEqual(capturedPayloads[0].body.recording, META_RECORDING_CONFIG)
  })

  await check('Inbound preAcceptCall does NOT attach recording, acceptCall (action: accept) attaches META_RECORDING_CONFIG', async () => {
    await col('whatsapp_calls').insertOne({
      callId: inboundCallId,
      waId: '919999900002',
      direction: 'inbound',
      status: 'ringing',
      attended: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const capturedPayloads = []
    const origFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      capturedPayloads.push({ url: String(url), body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    try {
      await preAcceptCall(inboundCallId, 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n')
      await acceptCall(inboundCallId, 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n', {
        telecallerId: 'qa_test_telecaller',
      })
    } finally {
      globalThis.fetch = origFetch
    }

    assert.equal(capturedPayloads.length, 2)
    assert.equal(capturedPayloads[0].body.action, 'pre_accept')
    assert.equal(capturedPayloads[0].body.recording, undefined)

    assert.equal(capturedPayloads[1].body.action, 'accept')
    assert.deepEqual(capturedPayloads[1].body.recording, META_RECORDING_CONFIG)
  })

  // ------------------------------------------------------------------
  // 2. Simulate call_recording_available via handleCallsWebhook
  // ------------------------------------------------------------------
  const dummyOggBuffer = Buffer.alloc(2400, 0x41)
  Buffer.from('OggS\x00\x02').copy(dummyOggBuffer, 0)

  await col('whatsapp_calls').insertOne({
    callId: recordingCallId,
    waId: '919999900003',
    direction: 'inbound',
    call_direction: 'inbound',
    status: 'completed',
    attended: true,
    telecaller_id: 'qa_test_owner',
    recording_status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const mediaId = `qa_test_media_${runId}`
  const mockMediaDownloadUrl = `https://mock.meta.cdn.local/recordings/${mediaId}.ogg`
  const mockFetch = async (url) => {
    const u = String(url)
    if (u === `${GRAPH_BASE}/${encodeURIComponent(mediaId)}`) {
      return new Response(JSON.stringify({ url: mockMediaDownloadUrl, mime_type: 'audio/ogg' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (u === mockMediaDownloadUrl) {
      return new Response(dummyOggBuffer, {
        status: 200,
        headers: { 'content-type': 'audio/ogg' },
      })
    }
    return new Response(JSON.stringify({ error: { message: `Unexpected mockFetch URL: ${u}` } }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  await check('handleCallsWebhook(call_recording_available) downloads .ogg to protected_recordings and updates MongoDB', async () => {
    const webhookValue = {
      calls: [
        {
          id: recordingCallId,
          from: '919999900003',
          event: 'call_recording_available',
          call_recording: {
            audio: { id: mediaId },
          },
        },
      ],
    }

    await handleCallsWebhook(webhookValue, { awaitRecording: true, fetchImpl: mockFetch })

    const updatedCall = await col('whatsapp_calls').findOne({ callId: recordingCallId })
    assert.ok(updatedCall, 'whatsapp_calls doc should exist')
    assert.equal(updatedCall.recording_status, 'ready')
    assert.equal(updatedCall.recordingMimeType, 'audio/ogg')
    assert.equal(updatedCall.recordingSizeBytes, dummyOggBuffer.length)
    assert.ok(updatedCall.recording_file, 'recording_file should be populated')

    const savedPath = path.join(PROTECTED_RECORDINGS_DIR, updatedCall.recording_file)
    createdFiles.add(savedPath)
    assert.ok(fs.existsSync(savedPath), `Recording file should exist at ${savedPath}`)
    const diskBytes = fs.readFileSync(savedPath)
    assert.equal(diskBytes.length, dummyOggBuffer.length)
    assert.ok(diskBytes.equals(dummyOggBuffer), 'Saved .ogg bytes should match downloaded buffer')
  })

  // ------------------------------------------------------------------
  // 3. Boot ephemeral Express server and test GET /api/calls/:callId/recording
  // ------------------------------------------------------------------
  const app = express()
  app.use(express.json())
  app.use(optionalAuth)
  app.use('/api/calls', callsRouter)

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`

  const adminToken = signToken({
    sub: 'qa_test_admin_id',
    username: 'qa_test_admin',
    role: ROLES.SUPER_ADMIN,
  })
  const otherTelecallerToken = signToken({
    sub: 'qa_test_other_tc_id',
    username: 'qa_test_other_tc',
    role: ROLES.TELECALLER,
  })

  await check('GET /api/calls/:callId/recording unauthenticated returns 401 or 403', async () => {
    const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(recordingCallId)}/recording`)
    assert.ok([401, 403].includes(res.status), `Expected 401 or 403, got ${res.status}`)
  })

  await check('GET /api/calls/:callId/recording as unassigned telecaller returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(recordingCallId)}/recording`, {
      headers: { Authorization: `Bearer ${otherTelecallerToken}` },
    })
    assert.equal(res.status, 403)
  })

  await check('GET /api/calls/:callId/recording authenticated with Range: bytes=0-1023 returns 206 + Content-Range', async () => {
    const res = await fetch(`${baseUrl}/api/calls/${encodeURIComponent(recordingCallId)}/recording`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Range: 'bytes=0-1023',
      },
    })
    assert.equal(res.status, 206)
    assert.equal(res.headers.get('content-range'), `bytes 0-1023/${dummyOggBuffer.length}`)
    assert.equal(res.headers.get('content-length'), '1024')
    assert.equal(res.headers.get('accept-ranges'), 'bytes')
    const chunk = Buffer.from(await res.arrayBuffer())
    assert.equal(chunk.length, 1024)
    assert.ok(chunk.equals(dummyOggBuffer.subarray(0, 1024)), '206 body should match first 1024 bytes')
  })

  await check('GET /api/calls/qa_test_nonexistent/recording returns 404 with no stack trace leak', async () => {
    const res = await fetch(`${baseUrl}/api/calls/qa_test_nonexistent_${runId}/recording`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(res.status, 404)
    const text = await res.text()
    assertNoStackTraceLeak(text, 'non-existent callId')
  })

  await check('GET /api/calls/..%2F..%2F.env/recording returns 404 with no stack trace leak', async () => {
    const res = await fetch(`${baseUrl}/api/calls/..%2F..%2F.env/recording`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.equal(res.status, 404)
    const text = await res.text()
    assertNoStackTraceLeak(text, 'path traversal')
  })

  console.log(`\nSummary: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

try {
  await main()
} catch (err) {
  console.error('❌ UNHANDLED QA ERROR:', err)
  process.exitCode = 1
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve)).catch(() => {})
  }
  for (const filePath of createdFiles) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      console.error(`Cleanup warning (file ${filePath}):`, err.message)
    }
  }
  try {
    await Promise.all([
      col('whatsapp_calls').deleteMany({ callId: /^qa_test_/ }),
      col('messages').deleteMany({ waMessageId: /^qa_test_/ }),
      col('audit_logs').deleteMany({ $or: [{ 'meta.callId': /^qa_test_/ }, { message: /qa_test_/ }] }),
    ])
  } catch (err) {
    console.error('Cleanup warning (MongoDB):', err.message)
  }
  await closeDb().catch(() => {})
}
