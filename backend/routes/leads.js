import { Router } from 'express'
import { requireAuth } from '../services/auth.js'
import {
  listLeads, leadStats, getLead, getMessages, markRead, updateLead, addNote, createManualLead,
  exportLeadsCsv, saveWebDraft, upsertLeadFromLeadAd, recordOutbound, LEAD_STATUS_LABEL, LEAD_SOURCES, sweepIncomplete,
  deleteLead,
} from '../services/leads.js'
import { getProvider } from '../services/providers.js'
import { sendTemplateTo, dispatchRichTemplateMessage } from '../services/templates.js'
import { recordEvent } from '../services/audit.js'

const router = Router()

// ---------------------------------------------------------------- public capture endpoints

// POST /api/leads/draft — website registration page saves each step (abandoned forms become Incomplete leads)
router.post('/draft', async (req, res) => {
  try {
    const { phone, step, draft } = req.body || {}
    const lead = await saveWebDraft({ phone, step, draft })
    res.json({ success: true, tracked: Boolean(lead) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// Facebook Lead Ads webhook (field "leadgen"): GET verify + POST events
router.get('/facebook-webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge'])
  }
  res.status(403).json({ error: 'Verification failed' })
})

router.post('/facebook-webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED')
  try {
    const pageToken = process.env.FB_PAGE_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue
        const v = change.value || {}
        recordEvent('facebook_lead', `leadgen ${v.leadgen_id} form ${v.form_id}`, v).catch(() => {})
        let fields = {}
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${v.leadgen_id}?access_token=${pageToken}`)
          const d = await r.json()
          for (const f of d.field_data || []) fields[f.name] = (f.values || [])[0] || ''
        } catch (err) {
          console.warn('[Lead Ads] fetch failed:', err.message)
        }
        const phone = fields.phone_number || fields.phone || fields.mobile || ''
        const lead = await upsertLeadFromLeadAd({ phone, name: fields.full_name || fields.name || '', email: fields.email || '', formId: v.form_id, adId: v.ad_id, pageId: v.page_id, leadgenId: v.leadgen_id, fields })
        console.log(`📥 [FACEBOOK LEAD] ${lead ? `${lead.phone} (${lead.name || 'no name'})` : 'no phone in form'} from ad ${v.ad_id || '-'}`)
      }
    }
  } catch (err) {
    console.error('[Lead Ads webhook]', err.message)
  }
})

// ---------------------------------------------------------------- admin (both roles)

router.get('/', requireAuth(), async (req, res) => {
  try {
    const { q, status, source, assignedTo, adId, from, to, page, limit, sort } = req.query
    const result = await listLeads({ q, status, source, assignedTo, adId, from, to, sort, page: Math.max(1, parseInt(page) || 1), limit: Math.min(200, parseInt(limit) || 50) })
    res.json({ success: true, ...result, statusLabels: LEAD_STATUS_LABEL, sources: LEAD_SOURCES })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/stats', requireAuth(), async (_req, res) => {
  try {
    res.json({ success: true, stats: await leadStats() })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/export', requireAuth(), async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = { $in: String(req.query.status).split(',') }
    if (req.query.source) filter.source = { $in: String(req.query.source).split(',') }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="isydci-leads-${new Date().toISOString().slice(0, 10)}.csv"`)
    for await (const chunk of exportLeadsCsv(filter)) res.write(chunk)
    res.end()
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/sweep', requireAuth(), async (req, res) => {
  const parsed = parseInt(req.body?.hours)
  const hours = Number.isFinite(parsed) ? Math.max(0, parsed) : 24
  res.json({ success: true, marked: await sweepIncomplete(hours) })
})

router.post('/', requireAuth(), async (req, res) => {
  try {
    res.status(201).json({ success: true, lead: await createManualLead(req.body || {}, req.admin.username) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/:phone', requireAuth(), async (req, res) => {
  try {
    const lead = await getLead(req.params.phone)
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
    const messages = await getMessages(req.params.phone, { limit: Math.min(500, parseInt(req.query.limit) || 200) })
    res.json({ success: true, lead, messages })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.delete('/:phone', requireAuth(), async (req, res) => {
  try {
    const deleted = await deleteLead(req.params.phone)
    if (!deleted) return res.status(404).json({ success: false, message: 'Lead not found' })
    res.json({ success: true, message: 'Lead and messages deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.patch('/:phone', requireAuth(), async (req, res) => {
  try {
    res.json({ success: true, lead: await updateLead(req.params.phone, req.body || {}, req.admin.username) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:phone/notes', requireAuth(), async (req, res) => {
  try {
    res.json({ success: true, lead: await addNote(req.params.phone, req.body?.text, req.admin.username) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:phone/read', requireAuth(), async (req, res) => {
  await markRead(req.params.phone)
  res.json({ success: true })
})

// Free-text or image+caption+buttons reply (works inside the 24h customer service window)
router.post('/:phone/reply', requireAuth(), async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim()
    const imageUrl = String(req.body?.imageUrl || '').trim()
    const footerText = String(req.body?.footerText || '').trim()
    const headerText = String(req.body?.headerText || '').trim()
    const buttons = Array.isArray(req.body?.buttons) ? req.body.buttons : []
    const templateName = req.body?.templateName || null
    if (!text && !imageUrl) return res.status(400).json({ success: false, message: 'Message text or image is required' })
    const to = String(req.params.phone).replace(/\D/g, '')
    const provider = await getProvider('transactional')
    let result
    if (buttons.length > 0 || (imageUrl && /^https?:\/\//i.test(imageUrl))) {
      result = await dispatchRichTemplateMessage(provider, to, {
        headerFormat: imageUrl && /^https?:\/\//i.test(imageUrl) ? 'IMAGE' : headerText ? 'TEXT' : 'NONE',
        headerText,
        imageUrl,
        bodyText: text,
        footerText,
        buttons,
      })
      let storedText = text
      if (footerText && !storedText.includes(footerText)) storedText += `\n\n_${footerText}_`
      await recordOutbound(to, { type: imageUrl ? 'image' : 'text', image: imageUrl ? { link: imageUrl, caption: storedText } : undefined, text: { body: storedText } }, result.messageId, provider.key, { sentBy: req.admin.username, imageUrl: imageUrl || null, templateName, buttons })
    } else {
      result = await provider.sendText(to, text)
      await recordOutbound(to, { type: 'text', text: { body: text } }, result.messageId, provider.key, { sentBy: req.admin.username, templateName })
    }
    res.json({ success: true, messageId: result.messageId, provider: provider.key })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:phone/send-template', requireAuth(), async (req, res) => {
  try {
    const to = String(req.params.phone).replace(/\D/g, '')
    const result = await sendTemplateTo(to, req.body?.templateId, req.body?.params || {}, req.admin.username)
    res.json({ success: true, messageId: result.messageId })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
