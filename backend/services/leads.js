// CRM leads + conversation store.
// A lead is created at FIRST CONTACT (WhatsApp "Hi", ad click, Lead Ads form, website draft, flow step),
// not at registration. One lead per phone number. Built for 10 lakh+ rows: every query is indexed and paged.
import { col } from '../db/mongo.js'
import { phoneKey } from '../db/db.js'
import { pickRoundRobinTelecaller } from './telecallers.js'

export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  REGISTRATION_STARTED: 'registration_started',
  INCOMPLETE: 'incomplete',
  REGISTERED: 'registered',
  CARD_ISSUED: 'card_issued',
  LOST: 'lost',
}
export const LEAD_STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  registration_started: 'Registration Started',
  incomplete: 'Incomplete',
  registered: 'Registered',
  card_issued: 'Card Issued',
  lost: 'Lost',
}
export const LEAD_SOURCES = ['whatsapp', 'ctwa_ad', 'facebook_lead_ad', 'web', 'whatsapp_flow', 'simulator', 'import', 'manual']

const LEADS = () => col('leads')
const MESSAGES = () => col('messages')

const FLOW_STEP_LABEL = {
  REG_LOCATION: 'Step 1 · Personal & location',
  REG_DOB: 'Step 2 · Date of birth',
  REG_DETAILS: 'Step 3 · Blood group, address & photo',
  REG_CONFIRM: 'Step 4 · Confirm',
  REG_SUCCESS: 'Completed',
  CARD_VIEW: 'Already registered',
}

/** Reversed phone string: an "ends with" search becomes an indexed prefix search on phoneRev. */
export const reversePhone = p => String(p || '').split('').reverse().join('')

/** Full international digits (91XXXXXXXXXX) used as the lead key. */
export function leadPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length === 10 ? `91${digits}` : digits
}

function strip(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return { id: String(_id), ...rest, statusLabel: LEAD_STATUS_LABEL[rest.status] || rest.status }
}

const RANK = { new: 0, contacted: 1, registration_started: 2, incomplete: 2, registered: 3, card_issued: 4, lost: -1 }
/** Statuses only move forward automatically (a registered athlete never drops back to "new"). */
function forwardStatus(current, next) {
  if (!current) return next
  if (next === LEAD_STATUS.LOST) return next
  if (current === LEAD_STATUS.LOST) return next === LEAD_STATUS.LOST ? current : next
  return (RANK[next] ?? 0) >= (RANK[current] ?? 0) ? next : current
}

// ---------------------------------------------------------------- upserts from every channel

async function upsertLead(phone, { setOnInsert = {}, set = {}, status, source }) {
  const now = new Date()
  const existing = await LEADS().findOne({ phone })
  const nextStatus = status ? forwardStatus(existing?.status, status) : existing?.status || LEAD_STATUS.NEW
  const update = {
    $set: { ...set, status: nextStatus, updatedAt: now, phoneRev: reversePhone(phone) },
    $setOnInsert: { phone, source: source || 'whatsapp', createdAt: now, firstContactAt: now, notes: [], tags: [], ...setOnInsert },
  }
  if (!existing && source) update.$setOnInsert.source = source
  if (!existing && !set.assignedTo && !setOnInsert.assignedTo) {
    const rr = await pickRoundRobinTelecaller().catch(() => null)
    if (rr) update.$setOnInsert.assignedTo = rr
  }
  if (existing && existing.status !== nextStatus) {
    update.$push = { statusHistory: { from: existing.status, to: nextStatus, at: now } }
  } else if (!existing) {
    update.$setOnInsert.statusHistory = [{ from: null, to: nextStatus, at: now }]
  }
  const res = await LEADS().findOneAndUpdate({ phone }, update, { upsert: true, returnDocument: 'after' })
  return strip(res)
}

/** Inbound WhatsApp message (webhook). Captures ad referral (click-to-WhatsApp ads) and stores the message. */
export async function upsertLeadFromInbound(msg, value, member) {
  const phone = leadPhone(msg.from)
  if (!phone) return null
  const contact = (value.contacts || []).find(c => c.wa_id === msg.from)
  const profileName = contact?.profile?.name || ''
  const referral = msg.referral || null

  const set = { lastMessageAt: new Date(), lastInboundAt: new Date(), unread: true }
  if (profileName) set.whatsappName = profileName
  if (member) {
    set.memberId = member.memberId
    set.name = member.name
    set.district = member.district || ''
    set.state = member.state || ''
    set.cardFullUrl = member.cardFullUrl || ''
    set.status = LEAD_STATUS.REGISTERED
    set.statusLabel = 'Registered'
    set.tags = ['verified', 'athlete']
  }
  let source = 'whatsapp'
  if (referral) {
    source = 'ctwa_ad'
    set.campaign = {
      adId: referral.source_id || '',
      adType: referral.source_type || '',
      headline: referral.headline || '',
      body: referral.body || '',
      sourceUrl: referral.source_url || '',
      ctwaClid: referral.ctwa_clid || '',
      mediaType: referral.media_type || '',
      capturedAt: new Date(),
    }
  }
  const status = member ? LEAD_STATUS.REGISTERED : LEAD_STATUS.CONTACTED
  const lead = await upsertLead(phone, { set, setOnInsert: { name: member?.name || profileName }, status, source })

  await MESSAGES().insertOne({
    leadPhone: phone,
    direction: 'in',
    type: msg.type,
    text: extractText(msg),
    waMessageId: msg.id,
    provider: 'meta',
    raw: compact(msg),
    createdAt: new Date(),
  })
  return lead
}

function extractText(msg) {
  if (msg.type === 'text') return msg.text?.body || ''
  if (msg.type === 'interactive') {
    const i = msg.interactive || {}
    if (i.type === 'list_reply') return `[list] ${i.list_reply?.title || ''}`
    if (i.type === 'button_reply') return `[button] ${i.button_reply?.title || ''}`
    if (i.type === 'nfm_reply') return '[flow completed]'
    return `[${i.type}]`
  }
  if (msg.type === 'button') return `[button] ${msg.button?.text || ''}`
  if (msg.type === 'image') return `[image]${msg.image?.caption ? ' ' + msg.image.caption : ''}`
  if (msg.type === 'document') return `[document] ${msg.document?.filename || ''}`
  if (msg.type === 'location') return '[location]'
  return `[${msg.type}]`
}

function compact(obj) {
  try {
    const s = JSON.stringify(obj)
    return s.length > 4000 ? JSON.parse(s.slice(0, 4000) + '"') : obj
  } catch {
    return null
  }
}

/** Outbound message sent through any provider. */
export async function recordOutbound(recipient, payload, waMessageId, provider = 'meta', extra = {}) {
  const phone = leadPhone(recipient)
  if (!phone) return
  let text = ''
  let type = payload.type
  const imageUrl = payload.image?.link || extra.imageUrl || null
  if (payload.type === 'text') text = payload.text?.body || ''
  else if (payload.type === 'template') {
    type = 'template'
    text = extra.renderedText || `[template] ${payload.template?.name || ''}`
  } else if (payload.type === 'image') text = payload.image?.caption || '[image]'
  else if (payload.type === 'interactive') {
    const i = payload.interactive || {}
    text = `[${i.type}] ${i.body?.text || ''}`
  } else text = `[${payload.type}]`

  await MESSAGES().insertOne({
    leadPhone: phone,
    direction: 'out',
    type,
    text: text.slice(0, 2000),
    ...(imageUrl ? { imageUrl } : {}),
    ...(Array.isArray(extra.buttons) && extra.buttons.length ? { buttons: extra.buttons } : {}),
    waMessageId: waMessageId || null,
    status: waMessageId ? 'sent' : 'failed',
    provider,
    templateName: payload.template?.name || extra.templateName || null,
    sentBy: extra.sentBy || 'bot',
    createdAt: new Date(),
  })
  await LEADS().updateOne({ phone }, { $set: { lastMessageAt: new Date(), lastOutboundAt: new Date() } })
}

export async function updateMessageStatus(waMessageId, status, errors) {
  if (!waMessageId) return
  const set = { status, statusAt: new Date() }
  if (errors?.length) set.error = `${errors[0].code} ${errors[0].title || ''}`.trim()
  await MESSAGES().updateOne({ waMessageId }, { $set: set })
}

/** Every Flow screen transition from the endpoint. Keeps the draft so an incomplete registration shows where it stopped. */
export async function trackFlowStep(senderPhone, { action, screen, nextScreen, data, hasError }) {
  const phone = leadPhone(senderPhone)
  if (!phone) return
  const draft = {}
  for (const [k, v] of Object.entries(data || {})) if (v) draft[k] = v
  const reached = hasError ? screen : nextScreen || screen || 'REG_LOCATION'
  const set = {
    flowStep: reached,
    flowStepLabel: FLOW_STEP_LABEL[reached] || reached,
    flowLastActivityAt: new Date(),
    lastMessageAt: new Date(),
  }
  if (Object.keys(draft).length) set.draft = draft
  if (draft.full_name) set.name = draft.full_name.toUpperCase()
  let status = LEAD_STATUS.REGISTRATION_STARTED
  if (reached === 'REG_SUCCESS') status = LEAD_STATUS.REGISTERED
  if (reached === 'CARD_VIEW') status = undefined
  await upsertLead(phone, { set, status, source: 'whatsapp_flow' })
}

/** Website registration page draft (saved per step so abandoned forms become incomplete leads). */
export async function saveWebDraft({ phone, draft, step }) {
  const key = leadPhone(phone)
  if (!key || key.length < 12) return null
  const set = {
    draft: draft || {},
    flowStep: step || 'web_form',
    flowStepLabel: `Website · ${step || 'Form in progress'}`,
    flowLastActivityAt: new Date(),
    lastMessageAt: new Date(),
  }
  if (draft?.name) set.name = String(draft.name).toUpperCase()
  if (draft?.state) set.state = String(draft.state).toUpperCase()
  if (draft?.district) set.district = String(draft.district).toUpperCase()
  const lead = await upsertLead(key, { set, status: LEAD_STATUS.REGISTRATION_STARTED, source: 'web' })
  await MESSAGES().insertOne({
    leadPhone: key,
    direction: 'in',
    type: 'web_form',
    text: `🌐 Website Registration Draft\nAthlete Name: ${draft?.name || draft?.full_name || 'Prospective Athlete'}\nDistrict: ${draft?.district || '-'}\nState: ${draft?.state || 'TAMIL NADU'}\nStep: ${step || 'Personal Details'}`,
    provider: 'web',
    createdAt: new Date(),
  }).catch(() => {})
  return lead
}

/** Member saved (web, simulator or flow) -> lead becomes Registered and links to the member. */
export async function onMemberRegistered(member, source) {
  const phone = leadPhone(member.contact || member.phone)
  if (!phone) return null
  const set = {
    memberId: member.memberId,
    name: member.name,
    registeredAt: new Date(),
    lastMessageAt: new Date(),
    flowStep: 'REG_SUCCESS',
    flowStepLabel: 'Registration Completed ✅',
  }
  if (member.state) set.state = member.state
  if (member.district) set.district = member.district
  if (member.cardFullUrl) set.cardFullUrl = member.cardFullUrl
  const status = member.cardFullUrl ? LEAD_STATUS.CARD_ISSUED : LEAD_STATUS.REGISTERED
  return upsertLead(phone, { set, status, source })
}

export async function markCardIssued(recipient, member) {
  const phone = leadPhone(recipient)
  if (!phone) return
  await upsertLead(phone, {
    set: {
      memberId: member.memberId,
      name: member.name,
      cardIssuedAt: new Date(),
      flowStep: 'CARD_VIEW',
      flowStepLabel: 'Card Issued & Delivered ✅',
    },
    status: LEAD_STATUS.CARD_ISSUED,
  })
}

/** Facebook Lead Ads form submission (leadgen webhook, already fetched from Graph API). */
export async function upsertLeadFromLeadAd({ phone, name, email, formId, adId, pageId, leadgenId, fields }) {
  const key = leadPhone(phone)
  if (!key) return null
  return upsertLead(key, {
    set: { name: name ? String(name).toUpperCase() : undefined, email, leadAd: { formId, adId, pageId, leadgenId, fields, capturedAt: new Date() }, lastMessageAt: new Date() },
    status: LEAD_STATUS.NEW,
    source: 'facebook_lead_ad',
  })
}

// ---------------------------------------------------------------- queries (paged + indexed)

export async function listLeads({ q = '', status = '', source = '', assignedTo = '', adId = '', from = '', to = '', page = 1, limit = 50, sort = 'lastMessageAt' } = {}) {
  const filter = {}
  if (status) {
    const parts = status.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.includes('registered') && !parts.includes('card_issued')) {
      parts.push('card_issued')
    }
    filter.status = { $in: parts }
  }
  if (source) filter.source = { $in: source.split(',').map(s => s.trim()).filter(Boolean) }
  if (assignedTo) filter.assignedTo = assignedTo
  if (adId) filter['campaign.adId'] = adId
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  if (q) {
    const digits = q.replace(/\D/g, '')
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    // phone: exact match for a full number, otherwise an indexed "ends with" search via the reversed phone
    const phoneClause =
      digits.length >= 10
        ? [{ phone: { $in: [digits, leadPhone(digits)] } }]
        : digits.length >= 3
          ? [{ phoneRev: new RegExp('^' + reversePhone(digits)) }]
          : []
    filter.$or = digits.length >= 3 && !/[a-z]/i.test(q) ? phoneClause : [{ name: rx }, { whatsappName: rx }, { memberId: rx }, ...phoneClause]
  }
  const sortSpec = sort === 'createdAt' ? { createdAt: -1 } : { lastMessageAt: -1, createdAt: -1 }
  const skip = (page - 1) * limit
  const [total, items] = await Promise.all([
    LEADS().countDocuments(filter),
    LEADS().find(filter, { projection: { statusHistory: 0 } }).sort(sortSpec).skip(skip).limit(limit).toArray(),
  ])
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), leads: items.map(strip) }
}

export async function deleteLead(rawPhone) {
  const p = leadPhone(rawPhone)
  statsCache = { at: 0, value: null }
  await MESSAGES().deleteMany({ leadPhone: p })
  const res = await LEADS().deleteOne({ phone: p })
  return res.deletedCount > 0
}

// Stats tiles: indexed per-status / per-source counts run in parallel (a $group would scan every
// row at 10 lakh leads), cached for 20 s so the dashboard never hammers the database.
let statsCache = { at: 0, value: null }
export async function leadStats(opts = {}) {
  const baseFilter = opts.assignedTo ? { assignedTo: opts.assignedTo } : {}
  if (!opts.assignedTo && !opts.force && statsCache.value && Date.now() - statsCache.at < 5000) return statsCache.value
  const statuses = Object.values(LEAD_STATUS)
  const [statusCounts, sourceCounts, total, today, unread] = await Promise.all([
    Promise.all(statuses.map(s => LEADS().countDocuments({ ...baseFilter, status: s }))),
    Promise.all(LEAD_SOURCES.map(s => LEADS().countDocuments({ ...baseFilter, source: s }))),
    LEADS().countDocuments(baseFilter),
    LEADS().countDocuments({ ...baseFilter, createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
    LEADS().countDocuments({ ...baseFilter, unread: true }),
  ])
  const status = {}
  statuses.forEach((s, i) => (status[s] = statusCounts[i]))
  if (status.card_issued) status.registered = (status.registered || 0) + status.card_issued
  const source = {}
  LEAD_SOURCES.forEach((s, i) => {
    if (sourceCounts[i]) source[s] = sourceCounts[i]
  })
  const value = { total, today, unread, status, source, labels: LEAD_STATUS_LABEL, cachedAt: new Date().toISOString() }
  statsCache = { at: Date.now(), value }
  return value
}

/** Automatically syncs all accredited members from the members collection into CRM leads as registered */
export async function syncMembersToLeads() {
  try {
    const members = await col('members').find({}).toArray()
    let count = 0
    const now = new Date()
    for (const m of members) {
      const rawPhone = m.contact || m.phone || m.phoneKey
      const phone = leadPhone(rawPhone)
      if (!phone) continue
      const set = {
        name: m.name,
        whatsappName: m.name,
        memberId: m.memberId,
        district: m.district || '',
        state: m.state || '',
        status: LEAD_STATUS.REGISTERED,
        statusLabel: 'Registered',
        cardFullUrl: m.cardFullUrl || '',
        tags: ['verified', 'athlete'],
        updatedAt: now,
      }
      await LEADS().updateOne(
        { phone },
        {
          $set: set,
          $setOnInsert: {
            phone,
            source: m.source || 'whatsapp',
            createdAt: m.createdAt ? new Date(m.createdAt) : now,
            firstContactAt: m.createdAt ? new Date(m.createdAt) : now,
            lastMessageAt: m.updatedAt ? new Date(m.updatedAt) : now,
            unread: false,
            notes: [],
            statusHistory: [{ from: null, to: LEAD_STATUS.REGISTERED, at: now }],
          },
        },
        { upsert: true }
      )
      count++
    }
    statsCache = { at: 0, value: null } // invalidate stats cache
    console.log(`✅ [Leads] Synced ${count} registered members into CRM leads`)
    return count
  } catch (err) {
    console.warn('[Leads] syncMembersToLeads error:', err.message)
    return 0
  }
}

export async function getLead(phoneOrId) {
  const phone = leadPhone(phoneOrId)
  let doc = await LEADS().findOne({ phone })
  if (!doc) {
    doc = await LEADS().findOne({ id: phoneOrId })
  }
  if (!doc) return null

  // Always enrich with verified member details if available
  const p10 = phoneKey(phone)
  const member = await col('members').findOne({
    $or: [{ phone: p10 }, { phone: `91${p10}` }, { phone: `+91${p10}` }, ...(doc.memberId ? [{ memberId: doc.memberId }] : [])]
  })
  if (member) {
    if (member.name) doc.name = member.name
    if (member.memberId) doc.memberId = member.memberId
    if (member.district) doc.district = member.district
    if (member.state) doc.state = member.state
    if (member.photo) doc.photoUrl = member.photo
  }
  return strip(doc)
}

export async function getMessages(phoneRaw, { limit = 200, before } = {}) {
  const phone = leadPhone(phoneRaw)
  const filter = { leadPhone: phone }
  if (before) filter.createdAt = { $lt: new Date(before) }
  const items = await MESSAGES().find(filter, { projection: { raw: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray()
  return items.reverse().map(({ _id, ...m }) => ({ id: String(_id), ...m }))
}

export async function markRead(phoneRaw) {
  await LEADS().updateOne({ phone: leadPhone(phoneRaw) }, { $set: { unread: false } })
}

export async function updateLead(phoneRaw, changes, actor) {
  const phone = leadPhone(phoneRaw)
  const allowed = ['status', 'assignedTo', 'tags', 'lostReason', 'name', 'priority']
  const set = { updatedAt: new Date() }
  for (const k of allowed) if (changes[k] !== undefined) set[k] = changes[k]
  if (set.status && !Object.values(LEAD_STATUS).includes(set.status)) throw new Error('Invalid status')
  const existing = await LEADS().findOne({ phone })
  if (!existing) throw new Error('Lead not found')
  const update = { $set: set }
  if (set.status && set.status !== existing.status) update.$push = { statusHistory: { from: existing.status, to: set.status, at: new Date(), by: actor } }
  const res = await LEADS().findOneAndUpdate({ phone }, update, { returnDocument: 'after' })
  return strip(res)
}

export async function addNote(phoneRaw, text, actor) {
  const phone = leadPhone(phoneRaw)
  const note = { text: String(text || '').slice(0, 2000), by: actor, at: new Date() }
  const res = await LEADS().findOneAndUpdate({ phone }, { $push: { notes: note }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' })
  if (!res) throw new Error('Lead not found')
  return strip(res)
}

export async function createManualLead({ phone, name, source = 'manual', tags = [] }, actor) {
  const key = leadPhone(phone)
  if (!key || key.length < 12) throw new Error('Enter a valid mobile number')
  return upsertLead(key, { set: { name: name ? String(name).toUpperCase() : undefined, tags, createdBy: actor }, status: LEAD_STATUS.NEW, source })
}

/** CSV export as an async generator (streams 10 lakh rows without holding them in memory). */
export async function* exportLeadsCsv(filter = {}) {
  const cols = ['phone', 'name', 'status', 'source', 'memberId', 'state', 'district', 'flowStepLabel', 'assignedTo', 'campaign.headline', 'campaign.adId', 'createdAt', 'lastMessageAt']
  yield cols.join(',') + '\n'
  const cursor = LEADS().find(filter, { projection: { draft: 0, notes: 0, statusHistory: 0 } }).sort({ createdAt: -1 })
  for await (const d of cursor) {
    const row = cols.map(c => {
      const v = c.split('.').reduce((o, k) => (o ? o[k] : ''), d)
      const s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    })
    yield row.join(',') + '\n'
  }
}

// ---------------------------------------------------------------- sweeper: stalled registrations -> Incomplete

export async function sweepIncomplete(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000)
  const res = await LEADS().updateMany(
    { status: LEAD_STATUS.REGISTRATION_STARTED, flowLastActivityAt: { $lt: cutoff } },
    { $set: { status: LEAD_STATUS.INCOMPLETE, updatedAt: new Date() }, $push: { statusHistory: { from: LEAD_STATUS.REGISTRATION_STARTED, to: LEAD_STATUS.INCOMPLETE, at: new Date(), by: 'sweeper' } } }
  )
  if (res.modifiedCount) console.log(`🧹 [Leads] ${res.modifiedCount} stalled registration(s) marked Incomplete`)
  return res.modifiedCount
}

/** One-time backfill of phoneRev for leads created before the field existed (runs in the background). */
export async function backfillPhoneRev() {
  const cursor = LEADS().find({ phoneRev: { $exists: false } }, { projection: { phone: 1 } })
  let ops = []
  let n = 0
  for await (const d of cursor) {
    ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { phoneRev: reversePhone(d.phone) } } } })
    if (ops.length >= 5000) {
      await LEADS().bulkWrite(ops, { ordered: false })
      n += ops.length
      ops = []
    }
  }
  if (ops.length) {
    await LEADS().bulkWrite(ops, { ordered: false })
    n += ops.length
  }
  if (n) console.log(`🔁 [Leads] phoneRev backfilled on ${n.toLocaleString('en-IN')} lead(s)`)
  return n
}

let sweeper = null
export function startLeadSweeper() {
  if (sweeper) return
  backfillPhoneRev().catch(err => console.warn('[Leads] phoneRev backfill failed:', err.message))
  sweeper = setInterval(() => sweepIncomplete(24).catch(err => console.warn('[Leads] sweep failed:', err.message)), 60 * 60 * 1000)
  sweepIncomplete(24).catch(() => {})
}
