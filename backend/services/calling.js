// Meta WhatsApp Business Calling API (Graph API v24.0) service:
// - Phone number calling & SIP settings (GET/POST /{PHONE_NUMBER_ID}/settings)
// - Outbound call permission requests (1/24h, 2/7d rate limits) & 72h permission tracking
// - WebRTC call signaling (POST /{PHONE_NUMBER_ID}/calls: connect, pre_accept, accept, reject, terminate)
// - Webhook processing for field === "calls" & call_permission_reply
// - X-Hub-Signature-256 verification helper

import crypto from 'crypto'
import { EventEmitter } from 'events'
import { col } from '../db/mongo.js'
import { findMemberByPhone } from '../db/db.js'
import { metaCredentials } from './providers.js'
import { leadPhone, recordOutbound } from './leads.js'
import { recordEvent } from './audit.js'
import { logWhatsAppOutbound } from '../utils/liveLogger.js'

export const GRAPH_VERSION = 'v24.0'
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export const PERMISSION_TTL_MS = 72 * 60 * 60 * 1000 // 72 hours
export const PERMISSION_LIMIT_24H = 1
export const PERMISSION_LIMIT_7D = 2

const CALLS = () => col('whatsapp_calls')
const PERMISSIONS = () => col('call_permissions')
const LEADS = () => col('leads')
const MESSAGES = () => col('messages')

export const callEvents = new EventEmitter()
callEvents.setMaxListeners(50)

function emitCallEvent(type, payload) {
  callEvents.emit('call_event', { type, ...payload, ts: new Date().toISOString() })
}

/** Verify Meta X-Hub-Signature-256 header against raw request body using timing-safe comparison. */
export function verifyMetaSignature(rawBody, signatureHeader, appSecret = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET) {
  if (!appSecret) return { valid: true, skipped: true }
  if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    return { valid: false, reason: 'Missing or malformed X-Hub-Signature-256 header' }
  }
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8')
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(buf).digest('hex')
  const a = Buffer.from(signatureHeader, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return { valid: false, reason: 'Signature length mismatch' }
  const match = crypto.timingSafeEqual(a, b)
  return match ? { valid: true } : { valid: false, reason: 'Invalid HMAC signature' }
}

async function graphRequest(endpoint, { method = 'GET', body, params } = {}) {
  const { token } = metaCredentials()
  if (!token) throw new Error('WHATSAPP_TOKEN missing in environment or provider config')

  const url = new URL(`${GRAPH_BASE}/${endpoint.replace(/^\//, '')}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error?.message || `Meta Graph API error (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.metaError = data.error || data
    throw err
  }
  return data
}

// ---------------------------------------------------------------- Settings (Calling & SIP)

export async function getCallingSettings({ includeSip = false } = {}) {
  const { phoneNumberId } = metaCredentials()
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID missing')
  return graphRequest(`${phoneNumberId}/settings`, {
    method: 'GET',
    params: includeSip ? { include_sip_credentials: 'true' } : undefined,
  })
}

export async function updateCallingSettings({
  status = 'ENABLED',
  callIconVisibility = 'DEFAULT',
  callbackPermissionStatus = 'ENABLED',
  callHours = null,
  sip = null,
} = {}) {
  const { phoneNumberId } = metaCredentials()
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID missing')

  const payload = {
    calling: {
      status,
      call_icon_visibility: callIconVisibility,
      callback_permission_status: callbackPermissionStatus,
      ...(callHours ? { call_hours: callHours } : {}),
      ...(sip ? { sip } : {}),
    },
  }

  return graphRequest(`${phoneNumberId}/settings`, {
    method: 'POST',
    body: payload,
  })
}

// ---------------------------------------------------------------- Call Permissions & Rate Limits

/**
 * Check Meta's call_permission_request rate limits for a user:
 * Max 1 request per 24 hours, max 2 requests per 7 days.
 */
export async function checkPermissionRequestRateLimit(rawPhone, now = new Date()) {
  const waId = leadPhone(rawPhone)
  if (!waId) return { allowed: false, reason: 'Invalid phone number', count24h: 0, count7d: 0 }

  const doc = await PERMISSIONS().findOne({ waId })
  const timestamps = (doc?.requestTimestamps || [])
    .map(t => new Date(t))
    .filter(d => !Number.isNaN(d.getTime()) && now.getTime() - d.getTime() < 7 * 24 * 3600 * 1000)

  const count7d = timestamps.length
  const count24h = timestamps.filter(d => now.getTime() - d.getTime() < 24 * 3600 * 1000).length

  if (count24h >= PERMISSION_LIMIT_24H) {
    const latest24h = timestamps.filter(d => now.getTime() - d.getTime() < 24 * 3600 * 1000).sort((a, b) => b - a)[0]
    return {
      allowed: false,
      reason: 'Rate limit exceeded: max 1 call permission request per 24 hours',
      count24h,
      count7d,
      nextAllowedAt: new Date(latest24h.getTime() + 24 * 3600 * 1000).toISOString(),
    }
  }

  if (count7d >= PERMISSION_LIMIT_7D) {
    const oldest7d = timestamps.sort((a, b) => a - b)[0]
    return {
      allowed: false,
      reason: 'Rate limit exceeded: max 2 call permission requests per 7 days',
      count24h,
      count7d,
      nextAllowedAt: new Date(oldest7d.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
    }
  }

  return { allowed: true, count24h, count7d, nextAllowedAt: null }
}

export async function getCallPermission(rawPhone, now = new Date()) {
  const waId = leadPhone(rawPhone)
  if (!waId) return { waId: '', allowed: false, status: 'none', expiresAt: null }
  const doc = await PERMISSIONS().findOne({ waId })
  if (!doc) return { waId, allowed: false, status: 'none', expiresAt: null }

  const expiresAt = doc.permissionExpiresAt ? new Date(doc.permissionExpiresAt) : null
  const isPermanent = Boolean(doc.isPermanent)
  const isExpired = isPermanent ? false : (expiresAt ? expiresAt.getTime() <= now.getTime() : true)
  const effectiveStatus = doc.status === 'accepted' && isExpired ? 'expired' : doc.status
  return {
    waId,
    allowed: doc.status === 'accepted' && !isExpired,
    isPermanent,
    status: effectiveStatus || 'none',
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    lastRequestAt: doc.lastRequestAt || null,
    lastReplyAt: doc.lastReplyAt || null,
  }
}

export async function sendCallPermissionRequest(rawPhone, { bodyText } = {}) {
  const { phoneNumberId } = metaCredentials()
  const waId = leadPhone(rawPhone)
  if (!waId) throw new Error('Valid recipient phone number is required')

  const now = new Date()
  const rate = await checkPermissionRequestRateLimit(waId, now)
  if (!rate.allowed) {
    const err = new Error(rate.reason)
    err.status = 429
    err.rateLimit = rate
    throw err
  }

  const text =
    bodyText ||
    '📞 ISYDCI Support would like to call you on WhatsApp regarding your athlete membership. Tap below to allow calls for 72 hours.'

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'interactive',
    interactive: {
      type: 'call_permission_request',
      body: { text },
      action: { name: 'call_permission_request' },
    },
  }

  const data = await graphRequest(`${phoneNumberId}/messages`, { method: 'POST', body: payload })
  const msgId = data.messages?.[0]?.id || null

  const existing = await PERMISSIONS().findOne({ waId })
  const kept = (existing?.requestTimestamps || [])
    .map(t => new Date(t))
    .filter(d => !Number.isNaN(d.getTime()) && now.getTime() - d.getTime() < 7 * 24 * 3600 * 1000)
  kept.push(now)

  await PERMISSIONS().updateOne(
    { waId },
    {
      $set: {
        waId,
        status: existing?.status === 'accepted' ? existing.status : 'pending',
        requestTimestamps: kept,
        lastRequestAt: now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )

  logWhatsAppOutbound({ recipient: waId, kind: 'interactive/call_permission_request', messageId: msgId })
  recordOutbound(waId, { type: 'text', text: { body: `[Call Permission Request] ${text}` } }, msgId, 'meta').catch(() => {})

  return { messageId: msgId, waId, data }
}

export async function recordCallPermissionReply(rawPhone, responseValue, rawPayload = {}, now = new Date()) {
  const waId = leadPhone(rawPhone)
  if (!waId) return null

  const normalized = String(responseValue || '').toLowerCase()
  const accepted = ['accept', 'accepted', 'allow', 'allowed', 'yes'].includes(normalized)
  const isPermanent = Boolean(rawPayload?.is_permanent)
  const status = accepted ? 'accepted' : 'rejected'
  const expiresAt = accepted ? (isPermanent ? null : new Date(now.getTime() + PERMISSION_TTL_MS)) : null

  await PERMISSIONS().updateOne(
    { waId },
    {
      $set: {
        waId,
        status,
        isPermanent: accepted ? isPermanent : false,
        permissionExpiresAt: expiresAt,
        lastReplyAt: now,
        lastReplyRaw: rawPayload,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now, requestTimestamps: [] },
    },
    { upsert: true }
  )

  await recordEvent('call_permission', `${waId} -> ${status}`, { waId, status, expiresAt, rawPayload }).catch(() => {})
  emitCallEvent('permission_updated', { waId, status, expiresAt: expiresAt ? expiresAt.toISOString() : null })

  return { waId, status, expiresAt }
}

// ---------------------------------------------------------------- Call Signaling (POST /{PHONE_NUMBER_ID}/calls)

export async function initiateOutboundCall(rawPhone, sdpOffer, { bypassPermissionCheck = false } = {}) {
  const { phoneNumberId } = metaCredentials()
  const waId = leadPhone(rawPhone)
  if (!waId) throw new Error('Valid recipient phone number is required')
  if (!sdpOffer) throw new Error('SDP offer is required to initiate a WebRTC call')

  if (!bypassPermissionCheck) {
    const perm = await getCallPermission(waId)
    if (!perm.allowed) {
      const err = new Error(`Active call permission required for +${waId} (current status: ${perm.status}). Send a Call Permission Request first.`)
      err.status = 403
      err.permission = perm
      throw err
    }
  }

  const body = {
    messaging_product: 'whatsapp',
    to: waId,
    action: 'connect',
    session: {
      sdp_type: 'offer',
      sdp: sdpOffer,
    },
  }

  let data
  try {
    data = await graphRequest(`${phoneNumberId}/calls`, { method: 'POST', body })
  } catch (err) {
    const now = new Date()
    const failId = `wacid.fail.${Date.now()}`
    logWhatsAppOutbound({ recipient: waId, kind: 'call/outbound', error: err.metaError || err.message })
    await recordEvent('whatsapp_call_error', `Outbound call failed +${waId}: ${err.message}`, {
      waId,
      status: err.status,
      metaError: err.metaError || err.message,
    }).catch(() => {})
    await CALLS().insertOne({
      callId: failId,
      waId,
      rawWaId: waId,
      direction: 'outbound',
      status: 'failed',
      startedAt: now,
      endedAt: now,
      durationSec: 0,
      endReason: err.message,
      metaError: err.metaError || null,
      createdAt: now,
      updatedAt: now,
    }).catch(() => {})
    await logCallMessageInThread(waId, `📵 Outbound call failed: ${err.message}`, failId, 'out')
    throw err
  }

  const callId = data.calls?.[0]?.id || data.call_id || `wacid.out.${Date.now()}`
  const now = new Date()

  const member = await findMemberByPhone(waId).catch(() => null)
  const lead = await LEADS().findOne({ phone: waId }).catch(() => null)

  const doc = {
    callId,
    waId,
    rawWaId: waId,
    direction: 'outbound',
    status: 'ringing',
    sdpSession: { type: 'offer', offer: sdpOffer, answer: null },
    startedAt: now,
    answeredAt: null,
    endedAt: null,
    durationSec: 0,
    endReason: null,
    memberId: member?.memberId || lead?.memberId || null,
    leadId: lead?._id ? String(lead._id) : null,
    recordingUrl: null,
    transcript: null,
    createdAt: now,
    updatedAt: now,
  }

  await CALLS().updateOne({ callId }, { $set: doc }, { upsert: true })
  logWhatsAppOutbound({ recipient: waId, kind: 'call/outbound', messageId: callId })
  await logCallMessageInThread(waId, `📞 Outbound WhatsApp call started (${callId})`, callId, 'out')
  await recordEvent('whatsapp_call', `Outbound call initiated ${callId} -> +${waId}`, doc).catch(() => {})
  emitCallEvent('call_update', { call: doc })

  return { callId, call: doc, raw: data }
}

async function sendCallAction(callId, action, session) {
  const { phoneNumberId } = metaCredentials()
  const body = {
    messaging_product: 'whatsapp',
    call_id: callId,
    action,
    ...(session ? { session } : {}),
  }
  return graphRequest(`${phoneNumberId}/calls`, { method: 'POST', body })
}

export async function preAcceptCall(callId, sdpAnswer) {
  if (!callId || !sdpAnswer) throw new Error('callId and sdpAnswer are required')
  const data = await sendCallAction(callId, 'pre_accept', { sdp_type: 'answer', sdp: sdpAnswer })
  const now = new Date()
  await CALLS().updateOne(
    { callId },
    { $set: { status: 'pre_accepted', 'sdpSession.answer': sdpAnswer, updatedAt: now } }
  )
  const updated = await CALLS().findOne({ callId })
  emitCallEvent('call_update', { call: updated })
  return { call: updated, raw: data }
}

export async function acceptCall(callId, sdpAnswer) {
  if (!callId || !sdpAnswer) throw new Error('callId and sdpAnswer are required')
  const data = await sendCallAction(callId, 'accept', { sdp_type: 'answer', sdp: sdpAnswer })
  const now = new Date()
  await CALLS().updateOne(
    { callId },
    { $set: { status: 'accepted', answeredAt: now, 'sdpSession.answer': sdpAnswer, updatedAt: now } }
  )
  const updated = await CALLS().findOne({ callId })
  emitCallEvent('call_update', { call: updated })
  return { call: updated, raw: data }
}

export async function rejectCall(callId) {
  if (!callId) throw new Error('callId is required')
  const data = await sendCallAction(callId, 'reject')
  const now = new Date()
  await CALLS().updateOne(
    { callId },
    { $set: { status: 'rejected', endedAt: now, endReason: 'rejected_by_agent', updatedAt: now } }
  )
  const updated = await CALLS().findOne({ callId })
  emitCallEvent('call_update', { call: updated })
  return { call: updated, raw: data }
}

export async function terminateCall(callId) {
  if (!callId) throw new Error('callId is required')
  const existing = await CALLS().findOne({ callId })
  const data = await sendCallAction(callId, 'terminate')
  const now = new Date()
  const durationSec = existing?.answeredAt
    ? Math.max(0, Math.round((now.getTime() - new Date(existing.answeredAt).getTime()) / 1000))
    : 0
  await CALLS().updateOne(
    { callId },
    { $set: { status: 'completed', endedAt: now, durationSec, endReason: 'terminated_by_agent', updatedAt: now } }
  )
  const updated = await CALLS().findOne({ callId })
  emitCallEvent('call_update', { call: updated })
  return { call: updated, raw: data }
}

// ---------------------------------------------------------------- Webhook Handler (field === "calls")

async function logCallMessageInThread(waId, text, callId, direction = 'in') {
  try {
    await MESSAGES().insertOne({
      leadPhone: waId,
      direction,
      channel: 'whatsapp_call',
      type: 'call_log',
      text,
      waMessageId: callId,
      createdAt: new Date(),
    })
    await LEADS().updateOne({ phone: waId }, { $set: { lastMessageAt: new Date(), updatedAt: new Date() } })
  } catch (_) {}
}

async function sendMissedCallFallback(waId) {
  if (process.env.WHATSAPP_MISSED_CALL_FALLBACK === 'false') return
  const { token, phoneNumberId } = metaCredentials()
  if (!token || !phoneNumberId) return
  try {
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: {
        preview_url: false,
        body: '📞 Sorry we missed your WhatsApp call! Reply here with your query or type *Menu* to access your ISYDCI Athlete Portal.',
      },
    }
    const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.messages?.[0]?.id) {
      recordOutbound(waId, body, data.messages[0].id, 'meta').catch(() => {})
    }
  } catch (_) {}
}

export async function handleCallsWebhook(value) {
  if (!value) return

  // 1. Handle call events (connect, terminate, status updates, call_permission_reply)
  for (const call of value.calls || []) {
    const callId = call.id || call.call_id
    const rawFrom = call.from || call.to || ''
    const waId = leadPhone(rawFrom)
    const event = String(call.event || '').toLowerCase()
    const now = new Date()

    if (event === 'call_permission_reply' || call.call_permission_reply) {
      const reply = call.call_permission_reply?.response || call.response || call.status
      await recordCallPermissionReply(waId, reply, call, now)
      continue
    }

    if (!callId) continue

    const member = waId ? await findMemberByPhone(waId).catch(() => null) : null
    const lead = waId ? await LEADS().findOne({ phone: waId }).catch(() => null) : null

    if (event === 'connect') {
      const direction = call.direction === 'BUSINESS_INITIATED' ? 'outbound' : 'inbound'
      const sdp = call.session?.sdp || null
      const sdpType = call.session?.sdp_type || 'offer'

      const existing = await CALLS().findOne({ callId })
      if (direction === 'outbound' && existing && sdpType === 'answer') {
        await CALLS().updateOne(
          { callId },
          {
            $set: {
              status: 'accepted',
              answeredAt: existing.answeredAt || now,
              'sdpSession.answer': sdp,
              updatedAt: now,
            },
          }
        )
        const updated = await CALLS().findOne({ callId })
        emitCallEvent('call_answered', { call: updated })
        await recordEvent('whatsapp_call', `Outbound call answered ${callId} (+${waId})`, call).catch(() => {})
      } else {
        const doc = {
          callId,
          waId,
          rawWaId: rawFrom,
          direction,
          status: 'ringing',
          sdpSession: { type: sdpType, offer: sdp, answer: null },
          startedAt: now,
          answeredAt: null,
          endedAt: null,
          durationSec: 0,
          endReason: null,
          memberId: member?.memberId || lead?.memberId || null,
          leadId: lead?._id ? String(lead._id) : null,
          recordingUrl: null,
          transcript: null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        }
        await CALLS().updateOne({ callId }, { $set: doc }, { upsert: true })
        await logCallMessageInThread(waId, `📞 Incoming WhatsApp call (${callId})`, callId, 'in')
        await recordEvent('whatsapp_call', `Inbound call connect ${callId} from +${waId}`, call).catch(() => {})
        emitCallEvent('incoming_call', { call: doc })
      }
    } else if (event === 'terminate' || ['completed', 'missed', 'failed', 'rejected', 'no_answer'].includes(event)) {
      const existing = await CALLS().findOne({ callId })
      const endReason = call.end_reason || call.reason || event
      const wasAnswered = Boolean(existing?.answeredAt)
      const isMissed =
        !wasAnswered &&
        (existing?.direction === 'inbound' || !existing) &&
        ['missed', 'no_answer', 'unanswered', 'caller_hangup', 'timeout', 'terminate'].includes(String(endReason).toLowerCase())

      const finalStatus =
        event === 'rejected'
          ? 'rejected'
          : event === 'failed'
            ? 'failed'
            : isMissed
              ? 'missed'
              : 'completed'

      const durationSec =
        typeof call.duration === 'number'
          ? call.duration
          : existing?.answeredAt
            ? Math.max(0, Math.round((now.getTime() - new Date(existing.answeredAt).getTime()) / 1000))
            : 0

      await CALLS().updateOne(
        { callId },
        {
          $set: {
            status: finalStatus,
            endedAt: now,
            durationSec,
            endReason,
            updatedAt: now,
          },
          $setOnInsert: {
            callId,
            waId,
            rawWaId: rawFrom,
            direction: 'inbound',
            startedAt: now,
            createdAt: now,
          },
        },
        { upsert: true }
      )

      const updated = await CALLS().findOne({ callId })
      const summaryText =
        finalStatus === 'missed'
          ? `📵 Missed WhatsApp call (${endReason})`
          : `📞 WhatsApp call ended · ${durationSec}s (${finalStatus})`
      if (waId) {
        await logCallMessageInThread(waId, summaryText, callId, existing?.direction === 'outbound' ? 'out' : 'in')
        if (finalStatus === 'missed') {
          await sendMissedCallFallback(waId)
        }
      }
      await recordEvent('whatsapp_call', `Call ${finalStatus} ${callId} (${durationSec}s)`, call).catch(() => {})
      emitCallEvent('call_ended', { call: updated })
    }
  }

  // 2. Handle call status updates sent in value.statuses
  for (const st of value.statuses || []) {
    if (st.type !== 'call' && !st.call_id && !String(st.id || '').startsWith('wacid')) continue
    const callId = st.call_id || st.id
    const status = String(st.status || '').toLowerCase()
    const now = new Date()
    const update = { updatedAt: now }
    if (status === 'accepted' || status === 'answered') {
      update.status = 'accepted'
      update.answeredAt = now
    } else if (['completed', 'missed', 'failed', 'rejected', 'terminated'].includes(status)) {
      update.status = status === 'terminated' ? 'completed' : status
      update.endedAt = now
      if (typeof st.duration === 'number') update.durationSec = st.duration
      if (st.errors?.length) update.endReason = st.errors.map(e => `${e.code}: ${e.title}`).join('; ')
    }
    await CALLS().updateOne({ callId }, { $set: update })
    const updated = await CALLS().findOne({ callId })
    if (updated) emitCallEvent('call_update', { call: updated })
  }
}

// ---------------------------------------------------------------- CRM Query Helpers

export async function listActiveCalls() {
  return CALLS()
    .find({ status: { $in: ['ringing', 'pre_accepted', 'accepted', 'active'] } })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray()
}

export async function listCallsForLead(rawPhone, limit = 25) {
  const waId = leadPhone(rawPhone)
  if (!waId) return []
  return CALLS().find({ waId }).sort({ createdAt: -1 }).limit(limit).toArray()
}

