// WhatsApp message templates: builder validation (Meta limits), submit to Meta, status sync via
// API + message_template_status_update webhook, and sending approved templates to leads.
import { ObjectId } from 'mongodb'
import { col } from '../db/mongo.js'
import { metaCredentials, getProvider } from './providers.js'
import { recordOutbound } from './leads.js'
import { uploadToCloudinary } from '../config/cloudinary.js'

const TEMPLATES = () => col('templates')
const GRAPH = 'https://graph.facebook.com/v21.0'

// Limits from Meta's template components reference
export const META_LIMITS = {
  name: { max: 512, pattern: '^[a-z0-9_]+$' },
  categories: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
  headerText: 60,
  headerFormats: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
  body: 1024,
  footer: 60,
  buttons: { total: 10, quickReply: 10, urlMax: 2, phone: 1, copyCode: 1, label: 25, urlLength: 2000, phoneNumber: 20 },
  media: {
    IMAGE: { types: ['image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024, note: 'JPEG or PNG, 8-bit RGB, max 5 MB. Rendered at 1.91:1 — use 1200 × 628 px for banners.' },
    VIDEO: { types: ['video/mp4', 'video/3gpp'], maxBytes: 16 * 1024 * 1024, note: 'MP4 or 3GP, H.264 + AAC, max 16 MB.' },
    DOCUMENT: { types: ['application/pdf'], maxBytes: 100 * 1024 * 1024, note: 'PDF recommended, max 100 MB.' },
  },
  languages: [
    { code: 'en', label: 'English' },
    { code: 'en_US', label: 'English (US)' },
    { code: 'ta', label: 'Tamil' },
    { code: 'hi', label: 'Hindi' },
    { code: 'te', label: 'Telugu' },
    { code: 'kn', label: 'Kannada' },
    { code: 'ml', label: 'Malayalam' },
  ],
  variablePattern: '{{1}}, {{2}} … (positional)',
}

export const STATUS_LABEL = {
  draft: 'Draft',
  PENDING: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAUSED: 'Paused',
  DISABLED: 'Disabled',
  FLAGGED: 'Flagged',
  PENDING_DELETION: 'Pending Deletion',
  DELETED: 'Deleted',
}

function strip(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return { id: String(_id), ...rest, statusLabel: STATUS_LABEL[rest.status] || rest.status }
}

function countVars(text) {
  const m = String(text || '').match(/\{\{(\d+)\}\}/g) || []
  return m.length
}

/** Validate a builder definition against Meta's rules. Returns an array of error strings (empty = valid). */
export function validateTemplate(def) {
  const errors = []
  const name = String(def.name || '')
  if (!name) errors.push('Name is required')
  else if (!/^[a-z0-9_]+$/.test(name)) errors.push('Name may only contain lowercase letters, numbers and underscores')
  else if (name.length > META_LIMITS.name.max) errors.push(`Name is longer than ${META_LIMITS.name.max} characters`)
  if (!META_LIMITS.categories.includes(String(def.category || '').toUpperCase())) errors.push('Category must be MARKETING, UTILITY or AUTHENTICATION')
  if (!def.language) errors.push('Language is required')

  const h = def.header || { format: 'NONE' }
  const format = String(h.format || 'NONE').toUpperCase()
  if (!META_LIMITS.headerFormats.includes(format)) errors.push('Unsupported header format')
  if (format === 'TEXT') {
    if (!h.text) errors.push('Header text is required for a text header')
    else if (h.text.length > META_LIMITS.headerText) errors.push(`Header text is longer than ${META_LIMITS.headerText} characters`)
    if (countVars(h.text) > 1) errors.push('Header text may contain only 1 variable')
    if (countVars(h.text) === 1 && !(h.example && h.example[0])) errors.push('Give a sample value for the header variable')
  }
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
    if (!h.mediaDataUri && !h.mediaUrl && !h.mediaHandle) errors.push(`Upload a sample ${format.toLowerCase()} for the header (Meta reviews it)`)
    if (h.mediaDataUri) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(h.mediaDataUri)
      const lim = META_LIMITS.media[format]
      if (!m) errors.push('Header media must be a base64 data URI')
      else {
        if (!lim.types.includes(m[1])) errors.push(`Header ${format.toLowerCase()} must be ${lim.types.join(' or ')}`)
        const bytes = Math.floor((m[2].length * 3) / 4)
        if (bytes > lim.maxBytes) errors.push(`Header ${format.toLowerCase()} is larger than ${Math.round(lim.maxBytes / 1024 / 1024)} MB`)
      }
    }
  }

  const body = String(def.body?.text || '')
  if (!body.trim()) errors.push('Body text is required')
  if (body.length > META_LIMITS.body) errors.push(`Body is longer than ${META_LIMITS.body} characters`)
  const nVars = countVars(body)
  const examples = def.body?.examples || []
  if (nVars > 0 && examples.filter(Boolean).length < nVars) errors.push(`Give a sample value for each of the ${nVars} body variable(s)`)
  for (let i = 1; i <= nVars; i++) if (!body.includes(`{{${i}}}`)) errors.push(`Body variables must be numbered in order starting at {{1}} (missing {{${i}}})`)

  if (def.footer?.text && def.footer.text.length > META_LIMITS.footer) errors.push(`Footer is longer than ${META_LIMITS.footer} characters`)

  const buttons = def.buttons || []
  if (buttons.length > META_LIMITS.buttons.total) errors.push(`Maximum ${META_LIMITS.buttons.total} buttons`)
  const counts = { QUICK_REPLY: 0, URL: 0, PHONE_NUMBER: 0, COPY_CODE: 0 }
  buttons.forEach((b, i) => {
    const type = String(b.type || '').toUpperCase()
    if (!(type in counts)) errors.push(`Button ${i + 1}: unsupported type`)
    else counts[type]++
    if (type !== 'COPY_CODE') {
      if (!b.text) errors.push(`Button ${i + 1}: label is required`)
      else if (b.text.length > META_LIMITS.buttons.label) errors.push(`Button ${i + 1}: label longer than ${META_LIMITS.buttons.label} characters`)
    }
    if (type === 'URL') {
      if (!/^https?:\/\//.test(b.url || '')) errors.push(`Button ${i + 1}: URL must start with http:// or https://`)
      if ((b.url || '').length > META_LIMITS.buttons.urlLength) errors.push(`Button ${i + 1}: URL too long`)
      if (countVars(b.url) > 1) errors.push(`Button ${i + 1}: a URL may contain only one variable at the end`)
      if (countVars(b.url) === 1 && !b.example) errors.push(`Button ${i + 1}: give a sample value for the URL variable`)
    }
    if (type === 'PHONE_NUMBER') {
      if (!/^\+?[0-9 ]{8,20}$/.test(b.phone_number || '')) errors.push(`Button ${i + 1}: enter a phone number with country code`)
    }
    if (type === 'COPY_CODE' && !b.example) errors.push(`Button ${i + 1}: give a sample code (max 20 characters)`)
  })
  if (counts.QUICK_REPLY > META_LIMITS.buttons.quickReply) errors.push('Too many quick reply buttons')
  if (counts.URL > META_LIMITS.buttons.urlMax) errors.push('Maximum 2 URL buttons')
  if (counts.PHONE_NUMBER > META_LIMITS.buttons.phone) errors.push('Maximum 1 phone number button')
  if (counts.COPY_CODE > META_LIMITS.buttons.copyCode) errors.push('Maximum 1 copy code button')
  // quick replies must be grouped together
  const types = buttons.map(b => String(b.type || '').toUpperCase())
  const firstQr = types.indexOf('QUICK_REPLY')
  const lastQr = types.lastIndexOf('QUICK_REPLY')
  if (firstQr >= 0 && types.slice(firstQr, lastQr + 1).some(t => t !== 'QUICK_REPLY')) errors.push('Quick reply buttons must be grouped together, not mixed with other button types')
  return errors
}

/** Builder definition -> Meta "components" array. */
export function toMetaComponents(def, headerHandle) {
  const components = []
  const h = def.header || { format: 'NONE' }
  const format = String(h.format || 'NONE').toUpperCase()
  if (format === 'TEXT') {
    const c = { type: 'HEADER', format: 'TEXT', text: h.text }
    if (countVars(h.text) === 1) c.example = { header_text: [h.example?.[0] || 'Sample'] }
    components.push(c)
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
    components.push({ type: 'HEADER', format, example: { header_handle: [headerHandle || h.mediaHandle] } })
  }
  const body = { type: 'BODY', text: def.body.text }
  const n = countVars(def.body.text)
  if (n > 0) body.example = { body_text: [(def.body.examples || []).slice(0, n).map(e => e || 'Sample')] }
  components.push(body)
  if (def.footer?.text) components.push({ type: 'FOOTER', text: def.footer.text })
  if (def.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: def.buttons.map(b => {
        const type = String(b.type).toUpperCase()
        if (type === 'QUICK_REPLY') return { type, text: b.text }
        if (type === 'URL') return { type, text: b.text, url: b.url, ...(countVars(b.url) ? { example: [b.example] } : {}) }
        if (type === 'PHONE_NUMBER') return { type, text: b.text, phone_number: String(b.phone_number).replace(/\s+/g, '') }
        if (type === 'COPY_CODE') return { type, example: b.example }
        return { type, text: b.text }
      }),
    })
  }
  return components
}

// ---------------------------------------------------------------- Meta API

async function graph(method, url, body, token, isJson = true) {
  const res = await fetch(url, {
    method,
    headers: isJson ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}` },
    body: body ? (isJson ? JSON.stringify(body) : body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = data.error || {}
    throw new Error(e.error_user_msg || e.message || `Meta API ${res.status}`)
  }
  return data
}

/** Resumable Upload API: sample header media -> asset handle for template creation. */
async function uploadHeaderMedia(dataUriOrUrl, creds) {
  let buffer
  let mimeType = 'image/png'
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUriOrUrl || '')
  if (m) {
    mimeType = m[1]
    buffer = Buffer.from(m[2], 'base64')
  } else if (/^https?:\/\//i.test(dataUriOrUrl || '')) {
    const imgRes = await fetch(dataUriOrUrl)
    if (!imgRes.ok) throw new Error(`Failed to fetch header image from URL (${imgRes.status})`)
    mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    buffer = Buffer.from(await imgRes.arrayBuffer())
  } else {
    throw new Error('Header media must be an uploaded file or valid HTTPS URL')
  }
  if (!creds.appId) throw new Error('Meta App ID missing (WHATSAPP_APP_ID in .env or provider config)')
  const session = await graph('POST', `${GRAPH}/${creds.appId}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(mimeType)}`, null, creds.token)
  const res = await fetch(`${GRAPH}/${session.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${creds.token}`, file_offset: '0', 'Content-Type': 'application/octet-stream' },
    body: buffer,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.h) throw new Error(data.error?.message || 'Media upload to Meta failed')
  return data.h
}

async function ensureHeaderMediaUrl(header = {}, templateName = 'template') {
  const format = String(header.format || 'NONE').toUpperCase()
  if (format === 'IMAGE' && header.mediaDataUri && (!header.mediaUrl || !/^https?:\/\//i.test(header.mediaUrl))) {
    const up = await uploadToCloudinary(header.mediaDataUri, 'isydci/templates', `${templateName || 'tpl'}_header`)
    if (up?.secure_url && /^https?:\/\//i.test(up.secure_url)) {
      header.mediaUrl = up.secure_url
    }
  }
  return header
}

// ---------------------------------------------------------------- CRUD

export async function listTemplates({ status = '', q = '' } = {}) {
  const filter = {}
  if (status) filter.status = status
  if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const docs = await TEMPLATES().find(filter, { projection: { 'header.mediaDataUri': 0 } }).sort({ updatedAt: -1 }).toArray()
  return docs.map(strip)
}

export async function getTemplate(id) {
  const doc = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  return strip(doc)
}

export async function createTemplate(def, actor) {
  const errors = validateTemplate(def)
  const now = new Date()
  const header = await ensureHeaderMediaUrl({ ...(def.header || { format: 'NONE' }) }, def.name)
  const doc = {
    name: def.name,
    language: def.language || 'en',
    category: String(def.category || 'MARKETING').toUpperCase(),
    header,
    body: { text: def.body?.text || '', examples: def.body?.examples || [] },
    footer: { text: def.footer?.text || '' },
    buttons: def.buttons || [],
    status: 'draft',
    validationErrors: errors,
    provider: 'meta',
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  }
  const res = await TEMPLATES().insertOne(doc)
  return strip({ ...doc, _id: res.insertedId })
}

export async function updateTemplate(id, def, actor) {
  const existing = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  if (!existing) throw new Error('Template not found')
  const mergedHeader = await ensureHeaderMediaUrl({ ...(existing.header || {}), ...(def.header || {}) }, def.name || existing.name)
  const merged = {
    ...existing,
    ...def,
    header: mergedHeader,
    body: { ...existing.body, ...(def.body || {}) },
    footer: def.footer !== undefined ? def.footer : existing.footer,
    buttons: def.buttons !== undefined ? def.buttons : existing.buttons,
  }
  const errors = validateTemplate(merged)
  const set = {
    name: merged.name,
    language: merged.language,
    category: String(merged.category).toUpperCase(),
    header: merged.header,
    body: merged.body,
    footer: merged.footer,
    buttons: merged.buttons,
    validationErrors: errors,
    rejectedReason: '',
    updatedAt: new Date(),
    updatedBy: actor,
  }
  await TEMPLATES().updateOne({ _id: existing._id }, { $set: set })
  return strip(await TEMPLATES().findOne({ _id: existing._id }))
}

export async function deleteTemplate(id, { alsoMeta = true } = {}) {
  const existing = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  if (!existing) throw new Error('Template not found')
  if (alsoMeta && existing.metaId) {
    const creds = metaCredentials()
    try {
      await graph('DELETE', `${GRAPH}/${creds.wabaId}/message_templates?hsm_id=${existing.metaId}&name=${encodeURIComponent(existing.name)}`, null, creds.token)
    } catch (err) {
      console.warn('[Templates] Meta delete failed:', err.message)
    }
  }
  await TEMPLATES().deleteOne({ _id: existing._id })
  return true
}

/** Submit or update a template on Meta for review (or direct approval in dev simulator). */
export async function submitTemplate(id, actor, { directApproval = false } = {}) {
  const existing = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  if (!existing) throw new Error('Template not found')
  const errors = validateTemplate(existing)
  if (errors.length) throw new Error('Fix these first: ' + errors.join('; '))
  const creds = metaCredentials()

  let metaId = existing.metaId || null
  let status = directApproval ? 'APPROVED' : 'PENDING'
  let rejectedReason = ''

  // If live Meta token and WABA id are configured, submit or update directly on Meta Cloud API
  if (creds.token && creds.wabaId) {
    let headerHandle = existing.header?.mediaHandle || null
    const mediaSource = existing.header?.mediaDataUri || existing.header?.mediaUrl
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(existing.header?.format).toUpperCase()) && mediaSource && (!headerHandle || !String(headerHandle).startsWith('4::'))) {
      headerHandle = await uploadHeaderMedia(mediaSource, creds)
      const ensured = await ensureHeaderMediaUrl({ ...existing.header, mediaHandle: headerHandle }, existing.name)
      existing.header = ensured
      await TEMPLATES().updateOne({ _id: existing._id }, { $set: { 'header.mediaHandle': headerHandle, ...(ensured.mediaUrl ? { 'header.mediaUrl': ensured.mediaUrl } : {}) } })
    }

    const components = toMetaComponents(existing, headerHandle)
    console.log(`📋 [TEMPLATE SUBMIT] ${existing.name} (${existing.language}, ${existing.category}) -> Meta Cloud API`)
    try {
      if (metaId && /^\d+$/.test(String(metaId))) {
        // Edit existing template on Meta
        try {
          await graph('POST', `${GRAPH}/${metaId}`, { category: existing.category, components }, creds.token)
          console.log(`   ✅ Meta template ${metaId} updated in-place`)
        } catch (editErr) {
          console.warn(`   ⚠️ In-place edit on Meta (${editErr.message}), attempting create/re-submit...`)
          const data = await graph('POST', `${GRAPH}/${creds.wabaId}/message_templates`, {
            name: existing.name,
            language: existing.language,
            category: existing.category,
            parameter_format: 'POSITIONAL',
            components,
          }, creds.token)
          metaId = data.id || metaId
          status = data.status || status
        }
      } else {
        const data = await graph('POST', `${GRAPH}/${creds.wabaId}/message_templates`, {
          name: existing.name,
          language: existing.language,
          category: existing.category,
          parameter_format: 'POSITIONAL',
          components,
        }, creds.token)
        metaId = data.id || metaId
        status = data.status || 'PENDING'
        console.log(`   ✅ Meta accepted for review: id ${metaId}, status ${status}`)
      }

      // Immediately fetch real status & components from Meta
      if (metaId && /^\d+$/.test(String(metaId))) {
        try {
          const live = await graph('GET', `${GRAPH}/${metaId}?fields=id,name,status,category,language,components,rejected_reason,quality_score`, null, creds.token)
          if (live?.status) status = directApproval ? 'APPROVED' : live.status
          if (live?.rejected_reason && live.rejected_reason !== 'NONE') rejectedReason = live.rejected_reason
        } catch {}
      }
    } catch (err) {
      if (directApproval) {
        console.warn(`[Templates] Meta API submit failed (${err.message}), continuing with direct approval for testing`)
        metaId = metaId || `meta_sim_${Date.now()}`
        status = 'APPROVED'
      } else {
        throw err
      }
    }
  } else {
    console.log(`📋 [TEMPLATE SUBMIT] ${existing.name} (Local mode without live Meta token)`)
    metaId = metaId || `meta_${existing.name}`
    status = directApproval ? 'APPROVED' : 'PENDING'
  }

  const set = {
    metaId,
    status,
    category: existing.category,
    submittedAt: new Date(),
    submittedBy: actor,
    approvedAt: status === 'APPROVED' ? new Date().toISOString() : undefined,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
    rejectedReason,
  }
  await TEMPLATES().updateOne({ _id: existing._id }, { $set: set })
  return strip(await TEMPLATES().findOne({ _id: existing._id }))
}

/** Set template status directly (Approve, Reject, Reset). */
export async function setTemplateStatus(id, { status, reason = '', actor = 'admin' }) {
  const valid = ['APPROVED', 'REJECTED', 'PENDING', 'draft', 'PAUSED']
  if (!valid.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${valid.join(', ')}`)
  }
  const update = {
    status,
    updatedAt: new Date().toISOString(),
    lastSimulatedAt: new Date().toISOString(),
    simulatedBy: actor,
  }
  if (status === 'REJECTED') {
    update.rejectedReason = reason || 'Content does not meet Meta WhatsApp Policy'
  } else if (status === 'APPROVED') {
    update.rejectedReason = ''
    update.approvedAt = new Date().toISOString()
  }
  await TEMPLATES().updateOne({ _id: new ObjectId(id) }, { $set: update })
  const updated = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  return strip(updated)
}

/** Pull the current status AND components (header, body, footer, buttons) of one template from Meta. */
export async function syncTemplate(id) {
  const existing = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  if (!existing) throw new Error('Template not found')
  if (!existing.metaId) return strip(existing)
  const creds = metaCredentials()
  const data = await graph('GET', `${GRAPH}/${existing.metaId}?fields=id,name,status,category,language,components,rejected_reason,quality_score`, null, creds.token)
  const def = fromMetaComponents(data)
  if (existing.header?.mediaUrl && /^https:\/\/res\.cloudinary\.com\//i.test(existing.header.mediaUrl)) {
    def.header.mediaUrl = existing.header.mediaUrl
    if (existing.header.mediaName) def.header.mediaName = existing.header.mediaName
    if (existing.header.mediaHandle) def.header.mediaHandle = existing.header.mediaHandle
  }
  const set = {
    status: data.status,
    category: data.category || existing.category,
    rejectedReason: data.rejected_reason && data.rejected_reason !== 'NONE' ? data.rejected_reason : '',
    quality: data.quality_score?.score || '',
    ...def,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  }
  await TEMPLATES().updateOne({ _id: existing._id }, { $set: set })
  return strip(await TEMPLATES().findOne({ _id: existing._id }))
}

let lastAutoSyncAt = 0
/** Throttled background sync so frequent UI polls don't rate-limit Meta Graph API. */
export async function syncAllFromMetaIfStale(minIntervalMs = 8000) {
  if (Date.now() - lastAutoSyncAt < minIntervalMs) return null
  lastAutoSyncAt = Date.now()
  try {
    return await syncAllFromMeta()
  } catch (err) {
    console.warn('[Templates] Auto-sync from Meta skipped:', err.message)
    return null
  }
}

/** Import/refresh every template that exists on the WhatsApp Business Account. */
export async function syncAllFromMeta() {
  const creds = metaCredentials()
  if (!creds.token || !creds.wabaId) throw new Error('Meta credentials missing')
  let url = `${GRAPH}/${creds.wabaId}/message_templates?fields=id,name,status,category,language,components,rejected_reason,quality_score&limit=100`
  let imported = 0
  let updated = 0
  while (url) {
    const data = await graph('GET', url, null, creds.token)
    for (const t of data.data || []) {
      const def = fromMetaComponents(t)
      const prev = await TEMPLATES().findOne({ name: t.name, language: t.language }, { projection: { header: 1 } })
      if (prev?.header?.mediaUrl && /^https:\/\/res\.cloudinary\.com\//i.test(prev.header.mediaUrl)) {
        def.header.mediaUrl = prev.header.mediaUrl
        if (prev.header.mediaName) def.header.mediaName = prev.header.mediaName
        if (prev.header.mediaHandle) def.header.mediaHandle = prev.header.mediaHandle
      }
      const res = await TEMPLATES().updateOne(
        { name: t.name, language: t.language },
        {
          $set: { metaId: t.id, status: t.status, category: t.category, rejectedReason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : '', quality: t.quality_score?.score || '', lastSyncAt: new Date(), updatedAt: new Date(), ...def },
          $setOnInsert: { name: t.name, language: t.language, provider: 'meta', createdAt: new Date(), createdBy: 'meta-sync', validationErrors: [] },
        },
        { upsert: true }
      )
      if (res.upsertedCount) imported++
      else updated++
    }
    url = data.paging?.next || null
  }
  lastAutoSyncAt = Date.now()
  return { imported, updated }
}

function fromMetaComponents(t) {
  const header = { format: 'NONE' }
  const body = { text: '', examples: [] }
  const footer = { text: '' }
  let buttons = []
  for (const c of t.components || []) {
    if (c.type === 'HEADER') {
      header.format = c.format
      if (c.format === 'TEXT') {
        header.text = c.text
        header.example = c.example?.header_text || []
      } else header.mediaUrl = c.example?.header_handle?.[0] || ''
    } else if (c.type === 'BODY') {
      body.text = c.text
      body.examples = c.example?.body_text?.[0] || []
    } else if (c.type === 'FOOTER') footer.text = c.text
    else if (c.type === 'BUTTONS') buttons = (c.buttons || []).map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number, example: Array.isArray(b.example) ? b.example[0] : b.example }))
  }
  return { header, body, footer, buttons }
}

/** Webhook: message_template_status_update / message_template_components_update */
export async function onTemplateStatusWebhook(value) {
  const metaId = String(value.message_template_id || '')
  const event = String(value.event || 'UPDATED').toUpperCase()
  const map = { APPROVED: 'APPROVED', REJECTED: 'REJECTED', PENDING: 'PENDING', PAUSED: 'PAUSED', DISABLED: 'DISABLED', FLAGGED: 'FLAGGED', REINSTATED: 'APPROVED', PENDING_DELETION: 'PENDING_DELETION', DELETED: 'DELETED' }
  const status = map[event] || undefined
  const set = { lastSyncAt: new Date(), updatedAt: new Date(), lastWebhookEvent: event }
  if (status) set.status = status
  if (status === 'REJECTED') set.rejectedReason = value.reason || value.other_info?.description || 'Rejected by Meta'
  if (status === 'APPROVED') set.rejectedReason = ''

  // Fetch latest components (buttons, body, header, footer) & status directly from Meta Graph API
  const creds = metaCredentials()
  if (metaId && creds.token) {
    try {
      const data = await graph('GET', `${GRAPH}/${metaId}?fields=id,name,status,category,language,components,rejected_reason,quality_score`, null, creds.token)
      const def = fromMetaComponents(data)
      const prev = await TEMPLATES().findOne(metaId ? { metaId } : { name: value.message_template_name }, { projection: { header: 1 } })
      if (prev?.header?.mediaUrl && /^https:\/\/res\.cloudinary\.com\//i.test(prev.header.mediaUrl)) {
        def.header.mediaUrl = prev.header.mediaUrl
        if (prev.header.mediaName) def.header.mediaName = prev.header.mediaName
        if (prev.header.mediaHandle) def.header.mediaHandle = prev.header.mediaHandle
      }
      Object.assign(set, def, {
        metaId: String(data.id || metaId),
        status: data.status || set.status || 'APPROVED',
        category: data.category || value.message_template_category || 'MARKETING',
        rejectedReason: data.rejected_reason && data.rejected_reason !== 'NONE' ? data.rejected_reason : set.rejectedReason || '',
      })
    } catch (err) {
      console.warn('[Templates] Webhook live component fetch failed:', err.message)
    }
  }

  const filter = metaId ? { metaId } : { name: value.message_template_name, language: value.message_template_language }
  const res = await TEMPLATES().updateOne(filter, { $set: set })
  if (!res.matchedCount && value.message_template_name) {
    await TEMPLATES().updateOne(
      { name: value.message_template_name, language: value.message_template_language || 'en' },
      { $set: { ...set, metaId }, $setOnInsert: { name: value.message_template_name, language: value.message_template_language || 'en', category: 'MARKETING', header: { format: 'NONE' }, body: { text: '(synced from Meta)', examples: [] }, footer: { text: '' }, buttons: [], provider: 'meta', createdAt: new Date(), createdBy: 'meta-webhook', validationErrors: [] } },
      { upsert: true }
    )
  }
}

// ---------------------------------------------------------------- sending

/**
 * Helper to dispatch a rich message (with optional image/text header, body, footer, and URL/Quick-Reply buttons)
 * in a SINGLE WhatsApp message bubble so the user sees the Image + Text + "Visit website" button together.
 */
export async function dispatchRichTemplateMessage(provider, to, { headerFormat = 'NONE', headerText = '', imageUrl = '', bodyText = '', footerText = '', buttons = [] }) {
  const cleanButtons = (buttons || []).filter(b => b && b.text)
  const urlBtn = cleanButtons.find(b => String(b.type || '').toUpperCase() === 'URL' && b.url)
  const qrButtons = cleanButtons.filter(b => String(b.type || '').toUpperCase() === 'QUICK_REPLY').slice(0, 3)

  let interactiveHeader = undefined
  if (headerFormat === 'IMAGE' && imageUrl && /^https?:\/\//i.test(imageUrl)) {
    interactiveHeader = { type: 'image', image: { link: imageUrl } }
  } else if (headerFormat === 'TEXT' && headerText) {
    interactiveHeader = { type: 'text', text: String(headerText).slice(0, 60) }
  }

  // 1) Interactive CTA URL message (renders Header Image + Body + Footer + native "[ ↗ Visit website ]" button in 1 bubble)
  if (urlBtn && provider.sendRaw) {
    const interactive = {
      type: 'cta_url',
      ...(interactiveHeader ? { header: interactiveHeader } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: String(footerText).slice(0, 60) } } : {}),
      action: {
        name: 'cta_url',
        parameters: {
          display_text: String(urlBtn.text).slice(0, 20),
          url: urlBtn.url,
        },
      },
    }
    return provider.sendRaw(to, { type: 'interactive', interactive })
  }

  // 2) Interactive Quick-Reply Buttons message (renders Header Image + Body + Footer + Quick Reply buttons in 1 bubble)
  if (qrButtons.length > 0 && provider.sendRaw) {
    const interactive = {
      type: 'button',
      ...(interactiveHeader ? { header: interactiveHeader } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: String(footerText).slice(0, 60) } } : {}),
      action: {
        buttons: qrButtons.map((b, idx) => ({
          type: 'reply',
          reply: { id: `tpl_btn_${idx}`, title: String(b.text).slice(0, 20) },
        })),
      },
    }
    return provider.sendRaw(to, { type: 'interactive', interactive })
  }

  // 3) Image + Caption message (no buttons)
  let caption = bodyText
  if (headerFormat === 'TEXT' && headerText) caption = `*${headerText}*\n\n${caption}`
  if (footerText) caption += `\n\n_${footerText}_`
  if (headerFormat === 'IMAGE' && imageUrl && /^https?:\/\//i.test(imageUrl)) {
    return provider.sendImage(to, imageUrl, caption)
  }

  // 4) Plain text fallback
  return provider.sendText(to, caption)
}

/**
 * Send an APPROVED template to one number.
 * params: { header: { link } | { text }, body: ['v1','v2'], buttons: { 0: 'urlSuffix' } }
 */
export async function sendTemplateTo(to, id, params = {}, actor = 'admin') {
  const t = await TEMPLATES().findOne({ _id: new ObjectId(id) })
  if (!t) throw new Error('Template not found')
  if (t.status !== 'APPROVED') throw new Error(`Template is ${STATUS_LABEL[t.status] || t.status} — only Approved templates can be sent`)
  const format = String(t.header?.format || 'NONE').toUpperCase()
  let imageLink = format === 'IMAGE' ? (params.header?.link || t.header?.mediaUrl) : null
  if (format === 'IMAGE' && (!imageLink || !/^https?:\/\//i.test(imageLink)) && t.header?.mediaDataUri) {
    const ensured = await ensureHeaderMediaUrl({ ...t.header }, t.name)
    if (ensured.mediaUrl) {
      imageLink = ensured.mediaUrl
      await TEMPLATES().updateOne({ _id: t._id }, { $set: { 'header.mediaUrl': imageLink } })
    }
  }
  if (format === 'IMAGE' && !imageLink) throw new Error('This template needs a header media link to send')

  const n = countVars(t.body?.text)
  const values = (params.body || []).slice(0, n)
  while (values.length < n) values.push(t.body.examples?.[values.length] || '-')

  const bodyText = String(t.body?.text || '').replace(/\{\{(\d+)\}\}/g, (_, idx) => values[Number(idx) - 1] ?? `{{${idx}}}`)
  const headerText = format === 'TEXT' ? String(t.header?.text || '').replace(/\{\{(\d+)\}\}/g, () => params.header?.text || t.header?.example?.[0] || '') : ''
  const footerText = t.footer?.text || ''

  const resolvedButtons = (t.buttons || []).map((b, i) => ({
    ...b,
    url: b.url ? String(b.url).replace(/\{\{(\d+)\}\}/g, () => String(params.buttons?.[i] ?? b.example ?? '')) : b.url,
  }))

  let renderedText = ''
  if (headerText) renderedText += `*${headerText}*\n\n`
  renderedText += bodyText
  if (footerText) renderedText += `\n\n_${footerText}_`

  const provider = await getProvider('marketing')
  let result
  if (provider.sendTemplate) {
    const components = []
    if (format === 'IMAGE' && imageLink) {
      components.push({ type: 'header', parameters: [{ type: 'image', image: { link: imageLink } }] })
    } else if (format === 'TEXT' && countVars(t.header?.text) > 0) {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: String(params.header?.text || t.header?.example?.[0] || '-') }],
      })
    }
    if (values.length > 0) {
      components.push({
        type: 'body',
        parameters: values.map(v => ({ type: 'text', text: String(v) })),
      })
    }
    ;(t.buttons || []).forEach((b, i) => {
      if (String(b.type || '').toUpperCase() === 'URL' && /\{\{\d+\}\}/.test(b.url || '')) {
        const suffix = String(params.buttons?.[i] ?? b.example ?? '')
        if (suffix) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(i),
            parameters: [{ type: 'text', text: suffix }],
          })
        }
      }
    })
    result = await provider.sendTemplate(to, {
      name: t.name,
      language: t.language || 'en',
      components,
    })
  } else {
    result = await dispatchRichTemplateMessage(provider, to, {
      headerFormat: format,
      headerText,
      imageUrl: imageLink,
      bodyText,
      footerText,
      buttons: resolvedButtons,
    })
  }

  await recordOutbound(
    to,
    { type: imageLink ? 'image' : 'template', image: imageLink ? { link: imageLink, caption: renderedText } : undefined, template: { name: t.name } },
    result.messageId,
    provider.key,
    { sentBy: actor, imageUrl: imageLink, templateName: t.name, renderedText, buttons: resolvedButtons }
  )
  await TEMPLATES().updateOne({ _id: t._id }, { $inc: { sentCount: 1 }, $set: { lastSentAt: new Date() } })
  return result
}
