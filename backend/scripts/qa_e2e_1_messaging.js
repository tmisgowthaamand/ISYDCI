// QA E2E Sub-Agent 1: Inbound & Outbound WhatsApp Messaging Automation Suite
// Run from backend/: node scripts/qa_e2e_1_messaging.js
// Strictly read-only on production code; isolates test data to 919999800001..919999800005 & wamid.qa_e2e_1_*
// and deletes 100% of test artifacts in finally {} before closing MongoDB.

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import express from 'express'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'url'
import { createCanvas } from '@napi-rs/canvas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { connectDb, closeDb, col } from '../db/mongo.js'
import { optionalAuth, signToken, ROLES } from '../services/auth.js'
import { auditMiddleware } from '../services/audit.js'
import { verifyMetaSignature } from '../services/calling.js'
import { encryptLikeMetaCdn } from '../services/flowMedia.js'
import { deleteMemberFiles, UPLOADS_DIR } from '../services/storage.js'
import cloudinary from '../config/cloudinary.js'

import whatsappWebhookRouter from '../routes/whatsappWebhook.js'
import flowEndpointRouter from '../routes/flowEndpoint.js'
import leadsRouter from '../routes/leads.js'
import templatesRouter from '../routes/templates.js'
import membersRouter from '../routes/members.js'

const TEST_PHONES = [
  '919999800001',
  '919999800002',
  '919999800003',
  '919999800004',
  '919999800005',
]
const TEST_PHONE_KEYS = TEST_PHONES.map(p => p.slice(-10))
const WAMID_PREFIX = 'wamid.qa_e2e_1_'
const TEST_ADMIN_USER = 'qa_e2e_admin'
const TEST_TEMPLATE_NAME = 'qa_e2e_1_welcome_tpl'

const results = []
const gaps = []
let passed = 0
let failed = 0

function recordPass(id, title, detail = '') {
  passed += 1
  results.push({ id, status: 'PASS', title, detail })
  console.log(`✅ [PASS] ${id}: ${title}${detail ? ` — ${detail}` : ''}`)
}

function recordFail(id, title, err) {
  failed += 1
  const detail = err?.message || String(err)
  results.push({ id, status: 'FAIL', title, detail })
  console.error(`❌ [FAIL] ${id}: ${title} — ${detail}`)
}

function recordGap(id, location, title, detail) {
  gaps.push({ id, location, title, detail })
  console.warn(`⚠️  [GAP]  ${id} (${location}): ${title} — ${detail}`)
}

async function runCheck(id, title, fn) {
  try {
    const detail = await fn()
    recordPass(id, title, typeof detail === 'string' ? detail : '')
  } catch (err) {
    recordFail(id, title, err)
  }
}

async function waitFor(predicate, { timeoutMs = 4000, intervalMs = 40, label = 'condition' } = {}) {
  const start = Date.now()
  let lastVal = null
  while (Date.now() - start < timeoutMs) {
    lastVal = await predicate()
    if (lastVal) return lastVal
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`)
}

function makeTinyPortraitPng() {
  const c = createCanvas(120, 120)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1e3a8a'
  ctx.fillRect(0, 0, 120, 120)
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(60, 50, 28, 0, Math.PI * 2)
  ctx.fill()
  return c.toBuffer('image/png')
}

async function cleanupAllTestArtifacts() {
  const phoneRegex = /^91999980000[1-5]$/
  const phoneSubRegex = /91999980000[1-5]/
  const wamidRegex = /^wamid\.qa_e2e_1_/
  const qaAnyRegex = /qa_e2e_1_|91999980000[1-5]|QA E2E ATHLETE/i

  // Clean up any physical member files created under backend/uploads/members/QA_E2E_*
  try {
    const testMembers = await col('members')
      .find({
        $or: [
          { phoneKey: { $in: TEST_PHONE_KEYS } },
          { name: /^QA E2E /i },
          { memberId: /^ISYDCI-QAE2E/i },
        ],
      })
      .toArray()
    for (const m of testMembers) deleteMemberFiles(m)
    deleteMemberFiles({ name: 'QA E2E ATHLETE ONE' })
    const membersUploadRoot = path.join(UPLOADS_DIR, 'members')
    if (fs.existsSync(membersUploadRoot)) {
      for (const entry of fs.readdirSync(membersUploadRoot)) {
        if (/^QA_E2E_/i.test(entry)) {
          fs.rmSync(path.join(membersUploadRoot, entry), { recursive: true, force: true })
        }
      }
    }
  } catch (_) {}

  await Promise.all([
    col('leads').deleteMany({
      $or: [{ phone: { $in: TEST_PHONES } }, { phone: phoneRegex }],
    }),
    col('messages').deleteMany({
      $or: [{ leadPhone: { $in: TEST_PHONES } }, { waMessageId: wamidRegex }],
    }),
    col('members').deleteMany({
      $or: [
        { phoneKey: { $in: TEST_PHONE_KEYS } },
        { name: /^QA E2E /i },
        { memberId: /^ISYDCI-QAE2E/i },
      ],
    }),
    col('templates').deleteMany({ name: /^qa_e2e_1_/ }),
    col('call_permissions').deleteMany({ waId: { $in: TEST_PHONES } }),
    col('whatsapp_calls').deleteMany({
      $or: [{ waId: { $in: TEST_PHONES } }, { callId: /qa_e2e_1_/ }],
    }),
    col('audit_logs').deleteMany({
      $or: [
        { actor: TEST_ADMIN_USER },
        { path: qaAnyRegex },
        { target: qaAnyRegex },
        { details: qaAnyRegex },
      ],
    }),
    col('webhook_events').deleteMany({
      $or: [
        { summary: qaAnyRegex },
        { 'payload.from': { $in: TEST_PHONES } },
        { 'payload.waId': { $in: TEST_PHONES } },
        { 'payload.id': wamidRegex },
        { 'payload.contact_number': phoneSubRegex },
      ],
    }),
  ])
}

async function verifyZeroRemainingArtifacts() {
  const qaAnyRegex = /qa_e2e_|91999980000[1-5]/i
  const counts = {
    leads: await col('leads').countDocuments({ phone: /^91999980000/ }),
    messages: await col('messages').countDocuments({
      $or: [{ leadPhone: /^91999980000/ }, { waMessageId: /qa_e2e_/i }],
    }),
    members: await col('members').countDocuments({
      $or: [{ phoneKey: /^999980000/ }, { name: /^QA E2E /i }],
    }),
    templates: await col('templates').countDocuments({ name: /qa_e2e_/i }),
    call_permissions: await col('call_permissions').countDocuments({ waId: /^91999980000/ }),
    whatsapp_calls: await col('whatsapp_calls').countDocuments({
      $or: [{ waId: /^91999980000/ }, { callId: /qa_e2e_/i }],
    }),
    audit_logs: await col('audit_logs').countDocuments({
      $or: [{ actor: TEST_ADMIN_USER }, { path: qaAnyRegex }, { target: qaAnyRegex }],
    }),
    webhook_events: await col('webhook_events').countDocuments({
      $or: [
        { summary: qaAnyRegex },
        { 'payload.from': /^91999980000/ },
        { 'payload.id': /qa_e2e_/i },
      ],
    }),
  }
  return counts
}

async function main() {
  console.log('================================================================================')
  console.log('🧪 QA E2E SUITE 1: INBOUND & OUTBOUND WHATSAPP MESSAGING AUTOMATION')
  console.log('================================================================================')

  // Capture original env state so we restore cleanly in finally {}
  const origEnv = {
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    APP_SECRET: process.env.APP_SECRET,
    WHATSAPP_FLOW_ID: process.env.WHATSAPP_FLOW_ID,
    WHATSAPP_PRIVATE_KEY: process.env.WHATSAPP_PRIVATE_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  }

  const envHadAppSecret = Boolean(process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET)
  const envHadVerifyToken = Boolean(process.env.WHATSAPP_VERIFY_TOKEN)
  const envHadFlowId = Boolean(process.env.WHATSAPP_FLOW_ID)
  console.log(
    `📋 Env Audit: WHATSAPP_VERIFY_TOKEN=${envHadVerifyToken ? 'SET' : 'MISSING'}, ` +
      `WHATSAPP_APP_SECRET=${envHadAppSecret ? 'SET' : 'MISSING'}, ` +
      `WHATSAPP_FLOW_ID=${envHadFlowId ? 'SET' : 'MISSING'}`
  )

  // Ensure deterministic test credentials in-process (all outbound HTTP is stubbed)
  if (!process.env.WHATSAPP_TOKEN) process.env.WHATSAPP_TOKEN = 'qa_e2e_1_stub_token'
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) process.env.WHATSAPP_PHONE_NUMBER_ID = '100000000000001'
  if (!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '200000000000001'
  if (!process.env.WHATSAPP_VERIFY_TOKEN) process.env.WHATSAPP_VERIFY_TOKEN = 'qa_e2e_1_verify_token'
  if (!process.env.WHATSAPP_APP_SECRET && !process.env.APP_SECRET) {
    process.env.WHATSAPP_APP_SECRET = 'qa_e2e_1_app_secret_hmac_key'
  }
  if (!process.env.WHATSAPP_FLOW_ID) process.env.WHATSAPP_FLOW_ID = '1436503989540741'
  if (!process.env.JWT_SECRET && !process.env.ADMIN_PASSWORD) {
    process.env.JWT_SECRET = 'qa_e2e_1_jwt_secret'
  }
  // Force local storage driver so cardRenderer & flowEndpoint never touch Cloudinary externally
  process.env.STORAGE_DRIVER = 'local'

  // Prepare RSA keypair for Flow Endpoint encryption test
  let flowPublicKey = null
  try {
    const rawKey = (process.env.WHATSAPP_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    const priv = crypto.createPrivateKey(rawKey)
    flowPublicKey = crypto.createPublicKey(priv)
  } catch {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.WHATSAPP_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
    flowPublicKey = pair.publicKey
  }

  // Stub Cloudinary uploader as extra defense-in-depth
  const origCloudinaryUpload = cloudinary.uploader.upload
  cloudinary.uploader.upload = async (_src, opts = {}) => ({
    secure_url: `https://res.cloudinary.com/qa-stub/image/upload/${opts.folder || 'qa'}/${opts.public_id || 'asset'}.png`,
    public_id: opts.public_id || 'qa_stub',
    format: 'png',
    bytes: 1024,
  })

  // Prepare fake Meta CDN encrypted photo for Flow Step 3 (REG_DETAILS)
  const portraitPng = makeTinyPortraitPng()
  const encryptedPhoto = encryptLikeMetaCdn(portraitPng)
  const FAKE_CDN_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/qa_e2e_1_photo.png'

  // Intercept globalThis.fetch: allow localhost in-process requests, stub all external APIs
  const origFetch = globalThis.fetch
  const externalCalls = []
  let outMsgSeq = 1

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || String(input)
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) {
      return origFetch(input, init)
    }

    const method = (init.method || 'GET').toUpperCase()
    let parsedBody = null
    if (typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body)
      } catch {
        parsedBody = init.body
      }
    }

    externalCalls.push({ url, method, body: parsedBody, ts: Date.now() })

    // Stub fake Meta CDN download for Flow PhotoPicker decryption
    if (url === FAKE_CDN_URL) {
      const buf = encryptedPhoto.cdnFile
      return new Response(buf, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
    }

    // Stub Meta Graph API / WATI / WACTO endpoints
    if (url.includes('graph.facebook.com')) {
      // Read receipt
      if (parsedBody?.status === 'read') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // Outbound message send
      if (url.endsWith('/messages') && method === 'POST') {
        const outId = `${WAMID_PREFIX}out_${String(outMsgSeq++).padStart(4, '0')}`
        return new Response(
          JSON.stringify({
            messaging_product: 'whatsapp',
            contacts: [{ input: parsedBody?.to, wa_id: parsedBody?.to }],
            messages: [{ id: outId }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // Facebook Lead Ads leadgen fetch stub
      if (url.includes('qa_e2e_1_leadgen_9005')) {
        return new Response(
          JSON.stringify({
            id: 'qa_e2e_1_leadgen_9005',
            field_data: [
              { name: 'full_name', values: ['QA E2E LeadGen Five'] },
              { name: 'phone_number', values: [TEST_PHONES[4]] },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // Template submission / lookup on Graph API
      if (url.includes('/message_templates') && method === 'POST') {
        return new Response(JSON.stringify({ id: '999000111222', status: 'PENDING', category: 'UTILITY' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (method === 'DELETE') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ id: '999000111222', status: 'APPROVED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fallback for WATI / WACTO if configured in providers collection
    const fallbackOutId = `${WAMID_PREFIX}out_${String(outMsgSeq++).padStart(4, '0')}`
    return new Response(
      JSON.stringify({
        success: true,
        result: true,
        id: fallbackOutId,
        messageId: fallbackOutId,
        message: { whatsappMessageId: fallbackOutId },
        messages: [{ id: fallbackOutId }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let server = null
  let baseUrl = ''

  await connectDb()
  await cleanupAllTestArtifacts()

  try {
    // Mount in-process Express app mirroring backend/server.js
    const app = express()
    app.use(
      express.json({
        limit: '50mb',
        verify: (req, _res, buf) => {
          req.rawBody = buf
        },
      })
    )
    app.use(express.urlencoded({ extended: true, limit: '50mb' }))
    app.use(optionalAuth)
    app.use(auditMiddleware)
    app.use('/api/leads', leadsRouter)
    app.use('/api/templates', templatesRouter)
    app.use('/api/members', membersRouter)
    app.use('/api/whatsapp/flow-endpoint', flowEndpointRouter)
    app.use('/api/whatsapp/webhook', whatsappWebhookRouter)
    app.use('/webhook', whatsappWebhookRouter)

    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', err => (err ? reject(err) : resolve()))
    })
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
    console.log(`🚀 In-process Express server listening on ${baseUrl}\n`)

    const adminToken = signToken({
      sub: 'qa_e2e_admin_id',
      username: TEST_ADMIN_USER,
      role: ROLES.SUPER_SUPER_ADMIN,
    })
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    }

    const activeSecret = () => process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET

    function signPayload(rawJson) {
      return 'sha256=' + crypto.createHmac('sha256', activeSecret()).update(rawJson, 'utf8').digest('hex')
    }

    async function postWebhook(bodyObj, { signature = 'valid', pathSuffix = '/api/whatsapp/webhook' } = {}) {
      const raw = JSON.stringify(bodyObj)
      const headers = { 'Content-Type': 'application/json' }
      if (signature === 'valid') headers['X-Hub-Signature-256'] = signPayload(raw)
      else if (signature !== null) headers['X-Hub-Signature-256'] = signature
      const res = await origFetch(`${baseUrl}${pathSuffix}`, { method: 'POST', headers, body: raw })
      const text = await res.text()
      return { status: res.status, text }
    }

    function buildInboundEnvelope(phone, msg, profileName = 'QA Test Athlete') {
      return {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_QA_E2E_1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919994627551',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
                  },
                  contacts: [{ wa_id: phone, profile: { name: profileName } }],
                  messages: [
                    {
                      from: phone,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      ...msg,
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
    }

    function buildStatusEnvelope(recipientPhone, statusObj) {
      return {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_QA_E2E_1',
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
                      recipient_id: recipientPhone,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      ...statusObj,
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
    }

    async function callFlowEndpoint(senderPhone, payload) {
      const aesKey = crypto.randomBytes(16)
      const iv = crypto.randomBytes(12)
      const encKey = crypto
        .publicEncrypt(
          { key: flowPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          aesKey
        )
        .toString('base64')
      const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv)
      const plainJson = JSON.stringify({ version: '3.0', flow_token: senderPhone, ...payload })
      const ct = Buffer.concat([cipher.update(plainJson, 'utf8'), cipher.final()])
      const encryptedFlowData = Buffer.concat([ct, cipher.getAuthTag()]).toString('base64')

      const res = await origFetch(`${baseUrl}/api/whatsapp/flow-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encrypted_aes_key: encKey,
          encrypted_flow_data: encryptedFlowData,
          initial_vector: iv.toString('base64'),
        }),
      })
      assert.equal(res.status, 200, `Expected Flow endpoint HTTP 200, got ${res.status}`)
      const respBuf = Buffer.from(await res.text(), 'base64')
      const flippedIv = Buffer.from(iv.map(b => b ^ 0xff))
      const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, flippedIv)
      decipher.setAuthTag(respBuf.subarray(respBuf.length - 16))
      const dec = Buffer.concat([decipher.update(respBuf.subarray(0, respBuf.length - 16)), decipher.final()])
      return JSON.parse(dec.toString('utf8'))
    }

    function outboundMessageCalls() {
      return externalCalls.filter(
        c =>
          c.method === 'POST' &&
          c.body?.status !== 'read' &&
          (c.url.endsWith('/messages') || c.url.includes('sendSession') || c.url.includes('send-'))
      )
    }

    // =========================================================================
    // SCENARIO 1: Webhook GET Verification
    // =========================================================================
    console.log('--- Scenario 1: Webhook GET Verification ---')

    await runCheck('1.1', 'GET /api/whatsapp/webhook returns 200 + challenge on matching verify_token', async () => {
      const challenge = 'qa_e2e_1_challenge_987654'
      const res = await origFetch(
        `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(
          process.env.WHATSAPP_VERIFY_TOKEN
        )}&hub.challenge=${challenge}`
      )
      const text = await res.text()
      assert.equal(res.status, 200)
      assert.equal(text, challenge)
      return `HTTP 200, body="${text}"`
    })

    await runCheck('1.2', 'GET /api/whatsapp/webhook returns 403 on mismatched verify_token', async () => {
      const res = await origFetch(
        `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token_xyz&hub.challenge=12345`
      )
      assert.equal(res.status, 403)
      return `HTTP ${res.status}`
    })

    await runCheck('1.3', 'GET /api/whatsapp/webhook returns 403 when hub.mode !== subscribe', async () => {
      const res = await origFetch(
        `${baseUrl}/api/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${encodeURIComponent(
          process.env.WHATSAPP_VERIFY_TOKEN
        )}&hub.challenge=12345`
      )
      assert.equal(res.status, 403)
      return `HTTP ${res.status}`
    })

    // =========================================================================
    // SCENARIO 2: HMAC X-Hub-Signature-256 Verification
    // =========================================================================
    console.log('\n--- Scenario 2: HMAC X-Hub-Signature-256 Verification ---')

    await runCheck('2.1', 'POST /api/whatsapp/webhook (field=calls) rejects missing signature with 401', async () => {
      const callsBody = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'WABA', changes: [{ field: 'calls', value: { calls: [{ id: 'wacid.qa_e2e_1_sig', event: 'connect', from: TEST_PHONES[0] }] } }] }],
      }
      const r = await postWebhook(callsBody, { signature: null })
      assert.equal(r.status, 401)
      return `HTTP ${r.status} (${r.text})`
    })

    await runCheck('2.2', 'POST /api/whatsapp/webhook (field=calls) rejects invalid HMAC signature with 401', async () => {
      const callsBody = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'WABA', changes: [{ field: 'calls', value: { calls: [{ id: 'wacid.qa_e2e_1_sig2', event: 'connect', from: TEST_PHONES[0] }] } }] }],
      }
      const r = await postWebhook(callsBody, { signature: 'sha256=' + '0'.repeat(64) })
      assert.equal(r.status, 401)
      return `HTTP ${r.status}`
    })

    await runCheck('2.3', 'POST /api/whatsapp/webhook (field=messages) rejects missing & invalid signature with 401', async () => {
      const msgBody = buildInboundEnvelope(TEST_PHONES[0], {
        id: `${WAMID_PREFIX}unauth_01`,
        type: 'text',
        text: { body: 'Hi' },
      })
      const rMissing = await postWebhook(msgBody, { signature: null })
      const rInvalid = await postWebhook(msgBody, { signature: 'sha256=' + 'f'.repeat(64) })
      assert.equal(rMissing.status, 401)
      assert.equal(rInvalid.status, 401)
      const dbCount = await col('messages').countDocuments({ waMessageId: `${WAMID_PREFIX}unauth_01` })
      assert.equal(dbCount, 0, 'Unsigned webhook must not write to messages collection')
      return `missing=${rMissing.status}, invalid=${rInvalid.status}, dbRows=${dbCount}`
    })

    // Check fail-open behavior of verifyMetaSignature when appSecret is empty
    await runCheck('2.4', 'Audit verifyMetaSignature behavior when WHATSAPP_APP_SECRET is empty & check /facebook-webhook', async () => {
      const failOpenCheck = verifyMetaSignature('{"test":1}', undefined, '')
      if (failOpenCheck.valid && failOpenCheck.skipped) {
        recordGap(
          'GAP-HMAC-1',
          'backend/services/calling.js:52',
          'verifyMetaSignature fails open when WHATSAPP_APP_SECRET is unset',
          `if (!appSecret) return { valid: true, skipped: true } — backend/.env currently has WHATSAPP_APP_SECRET=${
            envHadAppSecret ? 'SET' : 'MISSING (CRITICAL: live webhook accepts unsigned POSTs!)'
          }`
        )
      }
      // Also test POST /api/leads/facebook-webhook without X-Hub-Signature-256
      const fbRes = await origFetch(`${baseUrl}/api/leads/facebook-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object: 'page', entry: [] }),
      })
      if (fbRes.status === 200) {
        recordGap(
          'GAP-HMAC-2',
          'backend/routes/leads.js:35',
          'POST /api/leads/facebook-webhook does not verify X-Hub-Signature-256',
          `Accepted unsigned POST with HTTP ${fbRes.status}`
        )
      }
      return `verifyMetaSignature(emptySecret)=${JSON.stringify(failOpenCheck)}, facebookWebhookUnsignedStatus=${fbRes.status}`
    })

    // =========================================================================
    // SCENARIO 3: Webhook message.id (wamid) Idempotency
    // =========================================================================
    console.log('\n--- Scenario 3: Webhook message.id Idempotency ---')

    await runCheck('3.1', 'Duplicate wamid.qa_e2e_1_dup is deduplicated in-memory (1 DB row, 1 bot reply)', async () => {
      const dupPhone = TEST_PHONES[1] // 919999800002
      const dupWamid = `${WAMID_PREFIX}dup_001`
      const dupEnvelope = buildInboundEnvelope(dupPhone, {
        id: dupWamid,
        type: 'text',
        text: { body: 'Hi' },
      })

      const beforeOut = outboundMessageCalls().length
      const r1 = await postWebhook(dupEnvelope)
      assert.equal(r1.status, 200)

      await waitFor(
        async () => {
          const outRows = await col('messages').countDocuments({ leadPhone: dupPhone, direction: 'out' })
          return outRows >= 1
        },
        { label: 'first inbound+outbound persisted for dup test' }
      )
      const afterFirstOut = outboundMessageCalls().length
      assert.equal(afterFirstOut - beforeOut, 1, 'Expected 1 outbound Graph call on first delivery')

      // Send exact duplicate webhook retry
      const r2 = await postWebhook(dupEnvelope)
      assert.equal(r2.status, 200)
      await new Promise(r => setTimeout(r, 250))

      const inRows = await col('messages').countDocuments({ waMessageId: dupWamid })
      const totalOutRows = await col('messages').countDocuments({ leadPhone: dupPhone, direction: 'out' })
      const afterSecondOut = outboundMessageCalls().length

      assert.equal(inRows, 1, `Expected 1 inbound messages row, got ${inRows}`)
      assert.equal(totalOutRows, 1, `Expected 1 outbound messages row, got ${totalOutRows}`)
      assert.equal(afterSecondOut, afterFirstOut, 'Duplicate retry must not trigger a second Graph API send')

      // Inspect MongoDB index on messages.waMessageId
      const indexes = await col('messages').indexes()
      const wamidIdx = indexes.find(i => i.key && i.key.waMessageId === 1)
      if (!wamidIdx?.unique) {
        recordGap(
          'GAP-IDEMP-1',
          'backend/routes/whatsappWebhook.js:348-355 & backend/db/mongo.js:90 & backend/services/leads.js:127',
          'Webhook wamid deduplication is process-memory only (Set max 2000), not enforced in MongoDB',
          `messages.waMessageId index has unique=${Boolean(wamidIdx?.unique)}; PM2 restarts or multi-worker deployments can duplicate inbound rows & bot replies`
        )
      }

      return `inRows=${inRows}, outRows=${totalOutRows}, graphSends=${afterSecondOut - beforeOut}, wamidIndexUnique=${Boolean(wamidIdx?.unique)}`
    })

    // =========================================================================
    // SCENARIO 4: Multi-step Inbound Conversation & Flow Registration
    // =========================================================================
    console.log('\n--- Scenario 4: Multi-Step Inbound Conversation & Flow Registration (919999800001 & 919999800005) ---')

    const athletePhone = TEST_PHONES[0] // 919999800001
    const manualLeadPhone = TEST_PHONES[4] // 919999800005

    await runCheck('4.0', 'Lead creation at status="new" (POST /api/leads & Lead Ads) -> transitions new -> contacted on inbound "Hi"', async () => {
      const createRes = await origFetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ phone: manualLeadPhone, name: 'QA E2E Manual Lead', source: 'manual' }),
      })
      const createBody = await createRes.json()

      if (createRes.status === 400 && /conflict at 'tags'/i.test(createBody.message || '')) {
        recordGap(
          'GAP-MONGO-1',
          'backend/services/leads.js:73-74 & 482',
          'CRITICAL BUG: POST /api/leads (createManualLead) always fails with HTTP 400 ConflictingUpdateOperators on "tags"',
          `createManualLead puts "tags" in $set while upsertLead puts "tags: []" in $setOnInsert -> MongoDB error: "${createBody.message}"`
        )
        // Exercise the "new" state via Facebook Lead Ads webhook (upsertLeadFromLeadAd omits tags in $set)
        const fbRes = await origFetch(`${baseUrl}/api/leads/facebook-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            object: 'page',
            entry: [
              {
                id: 'PAGE_QA',
                changes: [
                  {
                    field: 'leadgen',
                    value: { leadgen_id: 'qa_e2e_1_leadgen_9005', form_id: 'form_qa_e2e_1', ad_id: 'ad_qa_e2e_1', page_id: 'page_qa_e2e_1' },
                  },
                ],
              },
            ],
          }),
        })
        assert.equal(fbRes.status, 200)
        const newLead = await waitFor(
          async () => await col('leads').findOne({ phone: manualLeadPhone }),
          { label: 'leadgen lead created at status=new' }
        )
        assert.equal(newLead.status, 'new')
      } else {
        assert.equal(createRes.status, 201)
        assert.equal(createBody.lead.status, 'new')
      }

      await postWebhook(
        buildInboundEnvelope(manualLeadPhone, {
          id: `${WAMID_PREFIX}m_hi_01`,
          type: 'text',
          text: { body: 'Hi' },
        })
      )
      const updated = await waitFor(
        async () => {
          const d = await col('leads').findOne({ phone: manualLeadPhone })
          return d?.status === 'contacted' ? d : null
        },
        { label: 'lead transition new -> contacted' }
      )
      return `POST /api/leads=${createRes.status}, leadgen status=new -> inbound "Hi" -> ${updated.status}`
    })

    await runCheck('4.1', 'Cold inbound "Hi" (919999800001) upserts lead, logs inbound, sends interactive list menu', async () => {
      const beforeOut = outboundMessageCalls().length
      const r = await postWebhook(
        buildInboundEnvelope(
          athletePhone,
          {
            id: `${WAMID_PREFIX}s4_hi_01`,
            type: 'text',
            text: { body: 'Hi' },
            referral: {
              source_url: 'https://fb.me/qa_ad',
              source_id: 'QA_AD_001',
              source_type: 'ad',
              headline: 'ISYDCI Trials',
              ctwa_clid: 'qa_clid_001',
            },
          },
          'QA E2E Athlete One'
        )
      )
      assert.equal(r.status, 200)

      const state = await waitFor(
        async () => {
          const lead = await col('leads').findOne({ phone: athletePhone })
          const msgs = await col('messages').find({ leadPhone: athletePhone }).sort({ createdAt: 1 }).toArray()
          return lead && msgs.length >= 2 ? { lead, msgs } : null
        },
        { label: 'lead + inbound + outbound menu saved' }
      )

      // Note: cold WhatsApp inbound sets status directly to 'contacted' (skipping 'new')
      assert.equal(state.lead.status, 'contacted')
      assert.equal(state.lead.source, 'ctwa_ad')
      assert.equal(state.lead.campaign?.adId, 'QA_AD_001')

      const inMsg = state.msgs.find(m => m.direction === 'in' && m.waMessageId === `${WAMID_PREFIX}s4_hi_01`)
      const outMsg = state.msgs.find(m => m.direction === 'out')
      assert.ok(inMsg, 'Inbound "Hi" row missing')
      assert.ok(outMsg, 'Outbound menu row missing')

      const lastGraph = outboundMessageCalls()[beforeOut]
      assert.equal(lastGraph.body.type, 'interactive')
      assert.equal(lastGraph.body.interactive.type, 'list')
      const rowIds = lastGraph.body.interactive.action.sections.flatMap(s => s.rows.map(rw => rw.id))
      assert.ok(rowIds.includes('row_register'), 'New user menu must include row_register')

      return `lead.status=${state.lead.status} (cold WhatsApp inbound starts at contacted), menuRows=[${rowIds.join(',')}]`
    })

    await runCheck('4.2', 'Interactive list_reply "row_contact" sends helpline details', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_contact_02`,
          type: 'interactive',
          interactive: {
            type: 'list_reply',
            list_reply: { id: 'row_contact', title: 'Contact Support' },
          },
        })
      )
      const call = await waitFor(() => outboundMessageCalls()[beforeOut], { label: 'helpline outbound call' })
      assert.equal(call.body.type, 'text')
      assert.match(call.body.text.body, /99946 27551/)
      return 'Helpline text sent & verified'
    })

    await runCheck('4.3', 'Unregistered user requesting "card" gets Not Registered prompt + Registration Flow', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_card_unreg_03`,
          type: 'text',
          text: { body: 'download my card' },
        })
      )
      await waitFor(() => outboundMessageCalls().length >= beforeOut + 2, {
        label: 'not-registered text + flow send',
      })
      const warnCall = outboundMessageCalls()[beforeOut]
      const flowCall = outboundMessageCalls()[beforeOut + 1]
      assert.match(warnCall.body.text.body, /No Member Record Found/)
      assert.equal(flowCall.body.type, 'interactive')
      assert.equal(flowCall.body.interactive.type, 'flow')
      return `Sent warning + interactive/${flowCall.body.interactive.type}`
    })

    await runCheck('4.4', 'Interactive list_reply "row_register" launches WhatsApp Registration Flow', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_reg_tap_04`,
          type: 'interactive',
          interactive: {
            type: 'list_reply',
            list_reply: { id: 'row_register', title: 'Register Athlete' },
          },
        })
      )
      const flowCall = await waitFor(() => outboundMessageCalls()[beforeOut], { label: 'registration flow send' })
      assert.equal(flowCall.body.type, 'interactive')
      assert.equal(flowCall.body.interactive.type, 'flow')
      assert.equal(flowCall.body.interactive.action.parameters.flow_token, athletePhone)
      return `Flow ID=${flowCall.body.interactive.action.parameters.flow_id}, token=${athletePhone}`
    })

    let registeredMemberId = ''

    await runCheck('4.5', 'Encrypted Flow Endpoint (INIT -> LOCATION -> DOB -> DETAILS -> CONFIRM) transitions lead to registration_started -> registered/card_issued', async () => {
      // Step A: INIT
      const initRes = await callFlowEndpoint(athletePhone, { action: 'INIT' })
      assert.equal(initRes.screen, 'REG_LOCATION')

      const afterInitLead = await waitFor(
        async () => {
          const d = await col('leads').findOne({ phone: athletePhone })
          return d?.status === 'registration_started' ? d : null
        },
        { label: 'lead.status === registration_started' }
      )
      assert.equal(afterInitLead.status, 'registration_started')

      // Step B: REG_LOCATION
      const locRes = await callFlowEndpoint(athletePhone, {
        action: 'data_exchange',
        screen: 'REG_LOCATION',
        data: {
          ...initRes.data,
          full_name: 'QA E2E Athlete One',
          state: 'Tamil Nadu',
          district: 'Chennai',
          zone: 'South Zone',
        },
      })
      assert.equal(locRes.screen, 'REG_DOB')

      // Step C: REG_DOB
      const dobRes = await callFlowEndpoint(athletePhone, {
        action: 'data_exchange',
        screen: 'REG_DOB',
        data: {
          ...locRes.data,
          dob: '2000-05-15',
        },
      })
      assert.equal(dobRes.screen, 'REG_DETAILS')
      assert.match(dobRes.data.age, /Years/)

      // Step D: REG_DETAILS (with encrypted photo decrypted from stubbed CDN)
      const detRes = await callFlowEndpoint(athletePhone, {
        action: 'data_exchange',
        screen: 'REG_DETAILS',
        data: {
          ...dobRes.data,
          blood_group: 'O+',
          address: '12 Anna Salai, Mount Road, Chennai 600002',
          photo: [
            {
              file_name: 'passport.png',
              media_id: 'qa_e2e_1_media_01',
              cdn_url: FAKE_CDN_URL,
              encryption_metadata: encryptedPhoto.encryption_metadata,
            },
          ],
        },
      })
      assert.equal(detRes.screen, 'REG_CONFIRM')
      assert.ok(detRes.data.photo_preview, 'Expected base64 photo_preview on REG_CONFIRM')

      // Step E: REG_CONFIRM -> saves member, renders card, triggers onMemberRegistered
      const confRes = await callFlowEndpoint(athletePhone, {
        action: 'data_exchange',
        screen: 'REG_CONFIRM',
        data: {
          ...detRes.data,
          confirm: true,
        },
      })
      assert.equal(confRes.screen, 'REG_SUCCESS')
      assert.ok(confRes.data.member_id, 'Expected generated member_id')
      registeredMemberId = confRes.data.member_id

      // Allow async syncToLeads / onMemberRegistered / trackFlowStep to settle
      await new Promise(r => setTimeout(r, 300))

      const memberDoc = await col('members').findOne({ memberId: registeredMemberId })
      assert.ok(memberDoc, 'Member document must exist in members collection')
      assert.equal(memberDoc.name, 'QA E2E ATHLETE ONE')
      assert.ok(memberDoc.cardFullUrl, 'Member cardFullUrl should be generated')

      const leadDoc = await col('leads').findOne({ phone: athletePhone })
      assert.ok(
        ['registered', 'card_issued'].includes(leadDoc.status),
        `Expected lead.status registered or card_issued, got ${leadDoc.status}`
      )

      // Check race between db.js:syncToLeads (unconditionally sets 'registered') and onMemberRegistered ('card_issued')
      if (leadDoc.status === 'registered' && memberDoc.cardFullUrl) {
        recordGap(
          'GAP-STATE-1',
          'backend/db/db.js:163 & backend/services/leads.js:388',
          'syncToLeads() / syncMembersToLeads() overwrites leads.status with "registered" without forwardStatus()',
          `Member has cardFullUrl (${memberDoc.cardFullUrl}), onMemberRegistered sets "card_issued", but unawaited syncToLeads in saveMember can overwrite status back to "${leadDoc.status}"`
        )
      }

      return `memberId=${registeredMemberId}, lead.status=${leadDoc.status}`
    })

    await runCheck('4.6', 'Webhook nfm_reply delivers congratulatory text + card image + CTA button & marks card_issued', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_nfm_05`,
          type: 'interactive',
          interactive: {
            type: 'nfm_reply',
            nfm_reply: {
              name: 'flow',
              body: 'Sent',
              response_json: JSON.stringify({
                member_id: registeredMemberId,
                full_name: 'QA E2E ATHLETE ONE',
              }),
            },
          },
        })
      )

      await waitFor(() => outboundMessageCalls().length >= beforeOut + 3, {
        label: 'congrats text + card image + CTA URL button',
      })
      const [congratsCall, cardImgCall, ctaCall] = outboundMessageCalls().slice(beforeOut, beforeOut + 3)
      assert.equal(congratsCall.body.type, 'text')
      assert.match(congratsCall.body.text.body, /registration is successful/i)
      assert.equal(cardImgCall.body.type, 'image')
      assert.ok(cardImgCall.body.image.link.startsWith('http'))
      assert.equal(ctaCall.body.type, 'interactive')
      assert.equal(ctaCall.body.interactive.type, 'cta_url')

      const leadDoc = await waitFor(
        async () => {
          const d = await col('leads').findOne({ phone: athletePhone })
          return d?.status === 'card_issued' ? d : null
        },
        { label: 'lead.status === card_issued after markCardIssued' }
      )
      return `Delivered text+image+cta_url, lead.status=${leadDoc.status}`
    })

    await runCheck('4.7', 'Subsequent "Hi" from registered athlete fires "Welcome back" branch without offering registration', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_hi_again_06`,
          type: 'text',
          text: { body: 'Hi' },
        })
      )

      const wbCall = await waitFor(() => outboundMessageCalls()[beforeOut], { label: 'Welcome back reply' })
      assert.equal(wbCall.body.type, 'interactive')
      assert.equal(wbCall.body.interactive.type, 'button')
      assert.match(wbCall.body.interactive.body.text, /Welcome back, QA E2E ATHLETE ONE/)
      const btnIds = wbCall.body.interactive.action.buttons.map(b => b.reply.id)
      assert.deepEqual(btnIds, ['btn_card', 'btn_menu'])
      assert.ok(!JSON.stringify(wbCall.body).toLowerCase().includes('register athlete'))

      // Also verify Main Menu button on registered user omits row_register
      const beforeMenu = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_btn_menu_07`,
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            button_reply: { id: 'btn_menu', title: 'Main Menu' },
          },
        })
      )
      const menuCall = await waitFor(() => outboundMessageCalls()[beforeMenu], { label: 'Registered Main Menu' })
      const menuRowIds = menuCall.body.interactive.action.sections.flatMap(s => s.rows.map(rw => rw.id))
      assert.ok(menuRowIds.includes('row_card'), 'Registered menu must include row_card')
      assert.ok(!menuRowIds.includes('row_register'), 'Registered menu must NOT include row_register')

      // Verify lead status did not regress below card_issued & check whether inbound message from registered athlete was saved
      await new Promise(r => setTimeout(r, 150))
      const leadDoc = await col('leads').findOne({ phone: athletePhone })
      assert.equal(leadDoc.status, 'card_issued', 'forwardStatus must preserve card_issued on subsequent inbound')

      const regInboundMsg = await col('messages').findOne({ waMessageId: `${WAMID_PREFIX}s4_hi_again_06` })
      if (!regInboundMsg) {
        recordGap(
          'GAP-MONGO-2',
          'backend/services/leads.js:73-74, 108, 127',
          'CRITICAL BUG: upsertLeadFromInbound() fails for ALL registered athletes due to MongoDB "tags" conflict',
          'When member exists, set.tags=["verified","athlete"] conflicts with $setOnInsert.tags=[] in upsertLead(), throwing before MESSAGES().insertOne() — 0 inbound messages or lastInboundAt updates are stored in CRM Inbox once an athlete registers!'
        )
      }

      // Also verify typing "register" from a registered athlete triggers sendAlreadyRegistered instead of opening Flow
      const beforeRegText = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(athletePhone, {
          id: `${WAMID_PREFIX}s4_reg_again_08`,
          type: 'text',
          text: { body: 'register' },
        })
      )
      await waitFor(() => outboundMessageCalls().length >= beforeRegText + 2, {
        label: 'already registered text + card resend',
      })
      const alreadyRegCall = outboundMessageCalls()[beforeRegText]
      assert.match(alreadyRegCall.body.text.body, /already registered/i)

      return `Welcome back buttons=[${btnIds.join(',')}], menuRows=[${menuRowIds.join(',')}], regInboundPersisted=${Boolean(regInboundMsg)}`
    })

    // =========================================================================
    // SCENARIO 5: Inbound Media/Document & STOP Opt-Out Behavior
    // =========================================================================
    console.log('\n--- Scenario 5: Inbound Media/Document & STOP Opt-Out Behavior (919999800003) ---')

    const mediaPhone = TEST_PHONES[2] // 919999800003

    await runCheck('5.1', 'Inbound image & document messages are logged with placeholder text and trigger fallback menu', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(mediaPhone, {
          id: `${WAMID_PREFIX}s5_img_01`,
          type: 'image',
          image: {
            id: 'meta_media_img_001',
            mime_type: 'image/jpeg',
            sha256: 'abc123',
            caption: 'District gold medal photo',
          },
        })
      )
      await waitFor(() => outboundMessageCalls().length >= beforeOut + 1, { label: 'image fallback reply' })

      const beforeDocOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(mediaPhone, {
          id: `${WAMID_PREFIX}s5_doc_02`,
          type: 'document',
          document: {
            id: 'meta_media_doc_002',
            mime_type: 'application/pdf',
            filename: 'birth_certificate.pdf',
          },
        })
      )
      await waitFor(() => outboundMessageCalls().length >= beforeDocOut + 1, { label: 'document fallback reply' })
      await new Promise(r => setTimeout(r, 150))

      const imgMsg = await col('messages').findOne({ waMessageId: `${WAMID_PREFIX}s5_img_01` })
      const docMsg = await col('messages').findOne({ waMessageId: `${WAMID_PREFIX}s5_doc_02` })
      assert.equal(imgMsg.type, 'image')
      assert.equal(imgMsg.text, '[image] District gold medal photo')
      assert.equal(docMsg.type, 'document')
      assert.equal(docMsg.text, '[document] birth_certificate.pdf')

      if (!imgMsg.imageUrl && !imgMsg.mediaUrl) {
        recordGap(
          'GAP-MEDIA-1',
          'backend/services/leads.js:127-154 & backend/routes/whatsappWebhook.js:477-482',
          'Inbound WhatsApp media (image/document/audio) is not downloaded from Meta Graph API',
          'Only placeholder text ("[image] ...", "[document] ...") and raw media.id are stored; CRM Inbox cannot preview/download inbound user attachments'
        )
      }

      return `img.text="${imgMsg.text}", doc.text="${docMsg.text}", mediaUrlPersisted=${Boolean(imgMsg.imageUrl)}`
    })

    await runCheck('5.2', 'Inbound "STOP" / "UNSUBSCRIBE" opt-out behavior audit', async () => {
      const beforeOut = outboundMessageCalls().length
      await postWebhook(
        buildInboundEnvelope(mediaPhone, {
          id: `${WAMID_PREFIX}s5_stop_03`,
          type: 'text',
          text: { body: 'STOP' },
        })
      )
      const replyCall = await waitFor(() => outboundMessageCalls()[beforeOut], { label: 'STOP reply' })
      await new Promise(r => setTimeout(r, 150))

      const leadDoc = await col('leads').findOne({ phone: mediaPhone })
      const hasOptOutFlag = Boolean(leadDoc.optedOut || leadDoc.unsubscribed || leadDoc.doNotContact || leadDoc.status === 'lost')
      const sentMainMenu = replyCall?.body?.interactive?.type === 'list'

      if (!hasOptOutFlag || sentMainMenu) {
        recordGap(
          'GAP-OPTOUT-1',
          'backend/routes/whatsappWebhook.js:453-475 & backend/routes/templates.js:100-121',
          'Missing STOP / UNSUBSCRIBE opt-out handling',
          `Inbound "STOP" did not mark lead optedOut (status="${leadDoc.status}") and auto-replied with interactive/${replyCall?.body?.interactive?.type}; bulk template sends do not filter opted-out leads`
        )
      }

      return `optedOutFlag=${hasOptOutFlag}, botReply=interactive/${replyCall?.body?.interactive?.type}`
    })

    // =========================================================================
    // SCENARIO 6: Outbound CRM Free-Form vs HSM Template + Delivery Statuses
    // =========================================================================
    console.log('\n--- Scenario 6: Outbound CRM Free-Form vs HSM Template & Webhook Statuses (919999800004) ---')

    const crmPhone = TEST_PHONES[3] // 919999800004
    let failedOutboundWamid = ''
    let templateOutboundWamid = ''

    await runCheck('6.1', 'Outbound free-form POST /api/leads/:phone/reply outside 24h customer window & 131047 failure tracking', async () => {
      // Seed lead with lastInboundAt 30 hours ago (expired 24h customer service window)
      const thirtyHoursAgo = new Date(Date.now() - 30 * 3600 * 1000)
      await col('leads').insertOne({
        phone: crmPhone,
        phoneRev: crmPhone.split('').reverse().join(''),
        name: 'QA E2E EXPIRED WINDOW',
        status: 'contacted',
        source: 'whatsapp',
        createdAt: thirtyHoursAgo,
        firstContactAt: thirtyHoursAgo,
        lastInboundAt: thirtyHoursAgo,
        lastMessageAt: thirtyHoursAgo,
        unread: false,
        notes: [],
        tags: [],
      })

      const replyRes = await origFetch(`${baseUrl}/api/leads/${crmPhone}/reply`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Following up on your athlete registration' }),
      })
      const replyData = await replyRes.json()
      assert.equal(replyRes.status, 200, `Expected HTTP 200 (current behavior), got ${replyRes.status}`)
      assert.ok(replyData.messageId)
      failedOutboundWamid = replyData.messageId

      recordGap(
        'GAP-WINDOW-1',
        'backend/routes/leads.js:177-212',
        'POST /api/leads/:phone/reply does not enforce or check 24-hour customer service window (lead.lastInboundAt)',
        `Allowed free-form text send when lastInboundAt was 30h ago (HTTP ${replyRes.status}); relies solely on async Meta 131047 failure webhook`
      )

      const initialMsg = await col('messages').findOne({ waMessageId: failedOutboundWamid })
      assert.equal(initialMsg.status, 'sent')
      assert.equal(initialMsg.sentBy, TEST_ADMIN_USER)

      // Deliver Meta webhook status = failed with 131047 Re-engagement message
      const stRes = await postWebhook(
        buildStatusEnvelope(crmPhone, {
          id: failedOutboundWamid,
          status: 'failed',
          errors: [{ code: 131047, title: 'Re-engagement message' }],
        })
      )
      assert.equal(stRes.status, 200)

      const failedMsg = await waitFor(
        async () => {
          const m = await col('messages').findOne({ waMessageId: failedOutboundWamid })
          return m?.status === 'failed' ? m : null
        },
        { label: 'messages.status updated to failed (131047)' }
      )
      assert.equal(failedMsg.status, 'failed')
      assert.equal(failedMsg.error, '131047 Re-engagement message')

      return `wamid=${failedOutboundWamid}: sent -> failed ("${failedMsg.error}")`
    })

    await runCheck('6.2', 'HSM Template lifecycle: draft blocked -> APPROVED sent via POST /api/leads/:phone/send-template + payload audit', async () => {
      // 1. Create draft template
      const createTplRes = await origFetch(`${baseUrl}/api/templates`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: TEST_TEMPLATE_NAME,
          language: 'en',
          category: 'UTILITY',
          header: { format: 'TEXT', text: 'ISYDCI Membership Desk' },
          body: {
            text: 'Hello {{1}}, please complete your ISYDCI athlete registration today.',
            examples: ['Arjun'],
          },
          footer: { text: 'ISYDCI Official' },
          buttons: [{ type: 'URL', text: 'Complete Form', url: 'https://isydci.com/register' }],
        }),
      })
      const createTplBody = await createTplRes.json()
      assert.equal(createTplRes.status, 201)
      const tplId = createTplBody.template.id
      assert.equal(createTplBody.template.status, 'draft')

      // 2. Sending unapproved (draft) template MUST fail with 400
      const draftSendRes = await origFetch(`${baseUrl}/api/leads/${crmPhone}/send-template`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ templateId: tplId, params: { body: ['Arjun'] } }),
      })
      assert.equal(draftSendRes.status, 400)

      // 3. Approve template
      const approveRes = await origFetch(`${baseUrl}/api/templates/${tplId}/status`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      assert.equal(approveRes.status, 200)

      // 4. Send approved template outside 24h window
      const beforeOut = outboundMessageCalls().length
      const sendTplRes = await origFetch(`${baseUrl}/api/leads/${crmPhone}/send-template`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ templateId: tplId, params: { body: ['Arjun'] } }),
      })
      const sendTplData = await sendTplRes.json()
      assert.equal(sendTplRes.status, 200)
      templateOutboundWamid = sendTplData.messageId

      const graphPayload = outboundMessageCalls()[beforeOut]?.body
      const storedMsg = await col('messages').findOne({ waMessageId: templateOutboundWamid })
      assert.equal(storedMsg.type, 'template')
      assert.equal(storedMsg.templateName, TEST_TEMPLATE_NAME)
      assert.equal(storedMsg.status, 'sent')

      if (graphPayload && graphPayload.type !== 'template') {
        recordGap(
          'GAP-TPL-1',
          'backend/services/templates.js:668-675',
          'CRITICAL: sendTemplateTo() sends free-form session payload instead of Meta HSM type="template"',
          `sendTemplateTo() calls dispatchRichTemplateMessage() which sent Graph API payload type="${graphPayload.type}" (interactive/${graphPayload.interactive?.type || 'n/a'}) instead of provider.sendTemplate() ({ type: "template", template: { name, language, components } }). Outside the 24h window, Meta Cloud API rejects non-template messages with 131047!`
        )
      }

      return `draftSend=400, approvedSend=200 (wamid=${templateOutboundWamid}), db.type=${storedMsg.type}, actualGraphType=${graphPayload?.type}`
    })

    await runCheck('6.3', 'Webhook statuses progression (sent -> delivered -> read) & out-of-order status check', async () => {
      // Delivered
      await postWebhook(
        buildStatusEnvelope(crmPhone, {
          id: templateOutboundWamid,
          status: 'delivered',
        })
      )
      const deliveredMsg = await waitFor(
        async () => {
          const m = await col('messages').findOne({ waMessageId: templateOutboundWamid })
          return m?.status === 'delivered' ? m : null
        },
        { label: 'status === delivered' }
      )
      assert.ok(deliveredMsg.statusAt instanceof Date)

      // Read
      await postWebhook(
        buildStatusEnvelope(crmPhone, {
          id: templateOutboundWamid,
          status: 'read',
        })
      )
      const readMsg = await waitFor(
        async () => {
          const m = await col('messages').findOne({ waMessageId: templateOutboundWamid })
          return m?.status === 'read' ? m : null
        },
        { label: 'status === read' }
      )
      assert.equal(readMsg.status, 'read')

      // Out-of-order delayed 'delivered' webhook arriving after 'read'
      await postWebhook(
        buildStatusEnvelope(crmPhone, {
          id: templateOutboundWamid,
          status: 'delivered',
        })
      )
      await new Promise(r => setTimeout(r, 150))
      const afterLateDelivered = await col('messages').findOne({ waMessageId: templateOutboundWamid })
      if (afterLateDelivered.status === 'delivered') {
        recordGap(
          'GAP-STATUS-1',
          'backend/services/leads.js:199-204',
          'updateMessageStatus() has no monotonic rank guard (sent < delivered < read)',
          'Out-of-order "delivered" webhook overwrote "read" back to "delivered"'
        )
      }

      return `sent -> delivered -> read (late delivered overwrote read: ${afterLateDelivered.status === 'delivered'})`
    })
  } finally {
    console.log('\n--- Teardown & Strict Cleanup Verification ---')
    if (server) {
      await new Promise(resolve => server.close(() => resolve()))
    }
    globalThis.fetch = origFetch
    cloudinary.uploader.upload = origCloudinaryUpload

    // Restore process.env
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }

    await cleanupAllTestArtifacts()
    const remaining = await verifyZeroRemainingArtifacts()
    const totalRemaining = Object.values(remaining).reduce((a, b) => a + b, 0)
    console.log(`🧹 Remaining test records across MongoDB collections: ${JSON.stringify(remaining)} (total=${totalRemaining})`)
    if (totalRemaining !== 0) {
      console.error('❌ CLEANUP ASSERTION FAILED: Non-zero test records remaining!')
      failed += 1
    } else {
      console.log('✅ CLEANUP VERIFIED: 0 temporary qa_e2e_ / 91999980000* records remain in MongoDB.')
    }

    await closeDb()
  }

  console.log('\n================================================================================')
  console.log(`📊 SUMMARY: ${passed} PASSED | ${failed} FAILED | ${gaps.length} ARCHITECTURAL/COMPLIANCE GAPS FOUND`)
  console.log('================================================================================')
  for (const g of gaps) {
    console.log(` - [${g.id}] ${g.location}: ${g.title}`)
  }

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
