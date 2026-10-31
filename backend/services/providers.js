// Messaging providers: Meta Cloud API (default), WATI, WACTO.
// One send interface; the developer picks which provider is active per purpose
// ('flow' = registration bot, 'transactional' = replies/cards, 'marketing' = templates/broadcasts).
import { col } from '../db/mongo.js'

const PROVIDERS = () => col('providers')
export const PURPOSES = ['flow', 'transactional', 'marketing']

export const PROVIDER_DEFS = {
  meta: {
    label: 'Meta WhatsApp Cloud API',
    fields: [
      { key: 'token', label: 'Permanent access token', secret: true },
      { key: 'phoneNumberId', label: 'Phone number ID' },
      { key: 'wabaId', label: 'WhatsApp Business Account ID' },
      { key: 'appId', label: 'Meta App ID (for template media upload)' },
    ],
    notes: 'Falls back to WHATSAPP_* keys in backend/.env when a field is empty.',
  },
  wati: {
    label: 'WATI',
    fields: [
      { key: 'baseUrl', label: 'API base URL (e.g. https://live-mt-server.wati.io/12345)' },
      { key: 'token', label: 'API token', secret: true },
    ],
    notes: 'Session messages need an open 24h window; templates must be approved in WATI first.',
  },
  wacto: {
    label: 'WACTO',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true },
      { key: 'channel', label: 'Channel number (sending WhatsApp number)' },
      { key: 'baseUrl', label: 'API base URL', default: 'https://backend.wacto.ai/api/v1.0' },
    ],
    notes: 'Only one connected number may be active in WACTO or sends fail with "Session is not opened".',
  },
}

function mask(value) {
  if (!value) return ''
  const s = String(value)
  return s.length <= 8 ? '••••' : `${s.slice(0, 4)}••••${s.slice(-4)}`
}

export function publicProvider(doc) {
  if (!doc) return null
  const def = PROVIDER_DEFS[doc.key] || { fields: [] }
  const config = {}
  for (const f of def.fields) config[f.key] = f.secret ? mask(doc.config?.[f.key]) : doc.config?.[f.key] || ''
  const { _id, ...rest } = doc
  return { id: String(_id), ...rest, config, configured: def.fields.every(f => !f.secret || Boolean(doc.config?.[f.key])) || doc.key === 'meta' }
}

export async function listProviders() {
  const docs = await PROVIDERS().find({}).toArray()
  const byKey = Object.fromEntries(docs.map(d => [d.key, d]))
  return Object.keys(PROVIDER_DEFS).map(key => {
    const doc = byKey[key] || { key, label: PROVIDER_DEFS[key].label, enabled: key === 'meta', activeFor: key === 'meta' ? [...PURPOSES] : [], config: {} }
    return { ...publicProvider({ _id: doc._id || '', ...doc }), definition: PROVIDER_DEFS[key] }
  })
}

export async function saveProvider(key, { enabled, activeFor, config }, actor) {
  if (!PROVIDER_DEFS[key]) throw new Error('Unknown provider')
  const existing = (await PROVIDERS().findOne({ key })) || { key, label: PROVIDER_DEFS[key].label, config: {} }
  const nextConfig = { ...existing.config }
  for (const f of PROVIDER_DEFS[key].fields) {
    const v = config?.[f.key]
    if (v === undefined || v === null) continue
    if (f.secret && /^.{0,4}••••/.test(String(v))) continue // masked value sent back unchanged
    nextConfig[f.key] = String(v).trim()
  }
  const purposes = Array.isArray(activeFor) ? activeFor.filter(p => PURPOSES.includes(p)) : existing.activeFor || []
  const now = new Date()
  await PROVIDERS().updateOne(
    { key },
    { $set: { label: PROVIDER_DEFS[key].label, enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled !== false, activeFor: purposes, config: nextConfig, updatedAt: now, updatedBy: actor }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  )
  // a purpose can only be active on one provider
  if (purposes.length) {
    await PROVIDERS().updateMany({ key: { $ne: key } }, { $pull: { activeFor: { $in: purposes } } })
  }
  return publicProvider(await PROVIDERS().findOne({ key }))
}

async function resolveProvider(purpose) {
  const doc = await PROVIDERS().findOne({ enabled: { $ne: false }, activeFor: purpose })
  if (doc) return doc
  const meta = await PROVIDERS().findOne({ key: 'meta' })
  return meta || { key: 'meta', config: {} }
}

export function metaCredentials(config = {}) {
  return {
    token: config.token || process.env.WHATSAPP_TOKEN,
    phoneNumberId: config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: config.wabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    appId: config.appId || process.env.WHATSAPP_APP_ID,
  }
}

// ---------------------------------------------------------------- adapters

const metaAdapter = config => {
  const { token, phoneNumberId } = metaCredentials(config)
  async function send(to, payload) {
    if (!token || !phoneNumberId) throw new Error('Meta credentials missing (provider config or WHATSAPP_* in .env)')
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.messages) throw new Error(data.error?.message || `Meta send failed (${res.status})`)
    return { messageId: data.messages[0]?.id, raw: data }
  }
  return {
    key: 'meta',
    sendText: (to, text) => send(to, { type: 'text', text: { body: text, preview_url: false } }),
    sendImage: (to, link, caption) => send(to, { type: 'image', image: { link, caption } }),
    sendTemplate: (to, { name, language, components }) => send(to, { type: 'template', template: { name, language: { code: language || 'en' }, ...(components?.length ? { components } : {}) } }),
    sendRaw: send,
    async test() {
      if (!token || !phoneNumberId) throw new Error('Meta credentials missing')
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Meta test failed')
      return `${data.verified_name} (${data.display_phone_number}) quality ${data.quality_rating}`
    },
  }
}

const watiAdapter = config => {
  const base = (config.baseUrl || '').replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${config.token || ''}`, 'Content-Type': 'application/json' }
  const ok = async res => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.result === false) throw new Error(data.info || data.message || `WATI request failed (${res.status})`)
    return data
  }
  return {
    key: 'wati',
    async sendText(to, text) {
      const data = await ok(await fetch(`${base}/api/v1/sendSessionMessage/${to}?messageText=${encodeURIComponent(text)}`, { method: 'POST', headers }))
      return { messageId: data.message?.whatsappMessageId || data.id || null, raw: data }
    },
    async sendImage(to, link, caption) {
      const data = await ok(await fetch(`${base}/api/v1/sendSessionFile/${to}?caption=${encodeURIComponent(caption || '')}`, { method: 'POST', headers, body: JSON.stringify({ url: link }) }))
      return { messageId: data.message?.whatsappMessageId || null, raw: data }
    },
    async sendTemplate(to, { name, parameters = [] }) {
      const data = await ok(await fetch(`${base}/api/v1/sendTemplateMessage?whatsappNumber=${to}`, { method: 'POST', headers, body: JSON.stringify({ template_name: name, broadcast_name: `isydci_${Date.now()}`, parameters }) }))
      return { messageId: data.message?.whatsappMessageId || null, raw: data }
    },
    async test() {
      if (!base || !config.token) throw new Error('WATI base URL and token are required')
      const data = await ok(await fetch(`${base}/api/v1/getMessageTemplates?pageSize=1`, { headers }))
      return `WATI reachable (${data.messageTemplates?.length ?? 0} template(s) visible)`
    },
  }
}

const wactoAdapter = config => {
  const base = (config.baseUrl || 'https://backend.wacto.ai/api/v1.0').replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${config.apiKey || ''}`, 'Content-Type': 'application/json' }
  const ok = async res => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) throw new Error(data.message || data.error || `WACTO request failed (${res.status})`)
    return data
  }
  return {
    key: 'wacto',
    async sendText(to, text) {
      const data = await ok(await fetch(`${base}/messages/send-text/${config.channel}`, { method: 'POST', headers, body: JSON.stringify({ to, text }) }))
      return { messageId: data.messageId || data.id || null, raw: data }
    },
    async sendImage(to, link, caption) {
      const data = await ok(await fetch(`${base}/messages/send-image/${config.channel}`, { method: 'POST', headers, body: JSON.stringify({ to, link, caption }) }))
      return { messageId: data.messageId || null, raw: data }
    },
    async sendTemplate(to, { name, language, components }) {
      const data = await ok(await fetch(`${base}/messages/send-template/${config.channel}`, { method: 'POST', headers, body: JSON.stringify({ to, template_name: name, language: language || 'en', components }) }))
      return { messageId: data.messageId || null, raw: data }
    },
    async test() {
      if (!config.apiKey || !config.channel) throw new Error('WACTO API key and channel are required')
      const data = await ok(await fetch(`${base}/channels`, { headers }))
      return `WACTO reachable (${Array.isArray(data) ? data.length : data.data?.length ?? '?'} channel(s))`
    },
  }
}

const ADAPTERS = { meta: metaAdapter, wati: watiAdapter, wacto: wactoAdapter }

export async function getProvider(purpose = 'transactional') {
  const doc = await resolveProvider(purpose)
  const adapter = ADAPTERS[doc.key] || metaAdapter
  return adapter(doc.config || {})
}

export async function getProviderByKey(key) {
  const doc = (await PROVIDERS().findOne({ key })) || { key, config: {} }
  const adapter = ADAPTERS[key]
  if (!adapter) throw new Error('Unknown provider')
  return adapter(doc.config || {})
}

export async function testProvider(key) {
  const p = await getProviderByKey(key)
  return p.test()
}

export async function activeProviderMap() {
  const out = {}
  for (const p of PURPOSES) out[p] = (await resolveProvider(p)).key
  return out
}
