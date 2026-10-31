// Phase 2/3 checks: lead capture from WhatsApp (with ad referral), flow steps -> registration_started,
// incomplete sweep, inbox messages, paging, notes/assign, website draft, CSV export.
//   node backend/tests/test_leads.mjs   (backend running on :5000)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = {}
fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^"|"$/g, '')
})
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000'
const PHONE = '919000000777'
let failures = 0
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }
const j = async (p, opts = {}) => {
  const res = await fetch(BASE + p, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const hook = msg =>
  fetch(BASE + '/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: {}, contacts: [{ wa_id: PHONE, profile: { name: 'Lead Tester' } }], messages: [{ from: PHONE, id: `wamid.lead.${Date.now()}.${Math.random()}`, timestamp: `${Date.now()}`, ...msg }] } }] }] }),
  })

console.log(`Testing ${BASE} with lead +${PHONE}`)

// cleanup from earlier runs
const prev = await j(`/api/leads/${PHONE}`)
if (prev.status === 200) await j(`/api/leads/${PHONE}`, { method: 'PATCH', body: JSON.stringify({ status: 'lost', lostReason: 'test reset' }) })

// 1. "Hi" with a click-to-WhatsApp ad referral -> lead created, source ctwa_ad, campaign captured
await hook({ type: 'text', text: { body: 'Hi' }, referral: { source_url: 'https://fb.me/ad123', source_id: 'AD-123', source_type: 'ad', headline: 'Join ISYDCI', body: 'Register now', ctwa_clid: 'clid-xyz' } })
await sleep(1500)
let lead = await j(`/api/leads/${PHONE}`)
ok(lead.status === 200, 'lead created from first WhatsApp message')
ok(lead.body.lead?.source === 'ctwa_ad' && lead.body.lead?.campaign?.adId === 'AD-123', `ad attribution captured (source ${lead.body.lead?.source}, ad ${lead.body.lead?.campaign?.adId})`)
ok(['contacted', 'new'].includes(lead.body.lead?.status), `status after Hi: ${lead.body.lead?.status}`)
ok(lead.body.messages.some(m => m.direction === 'in' && m.text === 'Hi'), 'inbound message stored in inbox')
ok(lead.body.messages.some(m => m.direction === 'out'), 'bot reply stored as outbound message')

// 2. Flow INIT + step 1 -> registration_started with draft
const crypto = await import('crypto')
const privateKey = crypto.createPrivateKey(env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n'))
const publicKey = crypto.createPublicKey(privateKey)
const flow = async payload => {
  const aesKey = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const encKey = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey).toString('base64')
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify({ version: '3.0', flow_token: PHONE, ...payload }), 'utf8'), cipher.final()])
  const res = await fetch(BASE + '/api/whatsapp/flow-endpoint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encrypted_aes_key: encKey, encrypted_flow_data: Buffer.concat([ct, cipher.getAuthTag()]).toString('base64'), initial_vector: iv.toString('base64') }) })
  const buf = Buffer.from(await res.text(), 'base64')
  const d = crypto.createDecipheriv('aes-128-gcm', aesKey, Buffer.from(iv.map(b => b ^ 0xff)))
  d.setAuthTag(buf.subarray(buf.length - 16))
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'))
}
const init = await flow({ action: 'INIT' })
const s1 = await flow({ action: 'data_exchange', screen: 'REG_LOCATION', data: { ...init.data, full_name: 'Lead Tester', state: 'Tamil Nadu', district: 'Salem', assembly: 'Salem North', zone: 'Ward 2' } })
await sleep(800)
lead = await j(`/api/leads/${PHONE}`)
ok(lead.body.lead?.status === 'registration_started', `flow step moves lead to registration_started (${lead.body.lead?.status})`)
ok(lead.body.lead?.flowStep === 'REG_DOB' && lead.body.lead?.name === 'LEAD TESTER', `draft kept: stopped at ${lead.body.lead?.flowStepLabel}, name ${lead.body.lead?.name}`)

// 3. Sweep with 0 hours -> incomplete
const sweep = await j('/api/leads/sweep', { method: 'POST', body: JSON.stringify({ hours: 0 }) })
ok(sweep.status === 200 && sweep.body.marked >= 1, `sweep marked ${sweep.body.marked} stalled registration(s) Incomplete`)
lead = await j(`/api/leads/${PHONE}`)
ok(lead.body.lead?.status === 'incomplete', 'lead now Incomplete')

// 4. Inbox operations
const note = await j(`/api/leads/${PHONE}/notes`, { method: 'POST', body: JSON.stringify({ text: 'Called, will finish tomorrow' }) })
ok(note.status === 200 && note.body.lead.notes.length >= 1, 'note added')
const assign = await j(`/api/leads/${PHONE}`, { method: 'PATCH', body: JSON.stringify({ assignedTo: env.ADMIN_USERNAME, tags: ['followup'] }) })
ok(assign.status === 200 && assign.body.lead.assignedTo === env.ADMIN_USERNAME, 'lead assigned')
const listIncomplete = await j('/api/leads?status=incomplete&limit=10')
ok(listIncomplete.status === 200 && listIncomplete.body.leads.some(l => l.phone === PHONE), 'Incomplete filter lists the lead')
const search = await j('/api/leads?q=0000777')
ok(search.body.leads?.some(l => l.phone === PHONE), 'search by last digits works')
const stats = await j('/api/leads/stats')
ok(stats.status === 200 && stats.body.stats.total >= 1, `stats total ${stats.body.stats.total}`)

// 5. Website draft -> registration_started again (web source kept as ctwa_ad since lead exists)
const draft = await fetch(BASE + '/api/leads/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '9000000777', step: 'details', draft: { name: 'Lead Tester', district: 'Salem' } }) }).then(r => r.json())
ok(draft.tracked === true, 'website draft tracked')

// 6. Invalid status rejected
ok((await j(`/api/leads/${PHONE}`, { method: 'PATCH', body: JSON.stringify({ status: 'bogus' }) })).status === 400, 'invalid status rejected')

// 7. CSV export streams
const csv = await fetch(BASE + '/api/leads/export?status=incomplete,registration_started', { headers: H }).then(r => r.text())
ok(csv.startsWith('phone,name,status') && csv.includes(PHONE), 'CSV export contains the lead')

// cleanup: mark lost
await j(`/api/leads/${PHONE}`, { method: 'PATCH', body: JSON.stringify({ status: 'lost', lostReason: 'test lead' }) })

console.log(failures ? `\n❌ ${failures} check(s) failed` : '\n✅ LEADS / INBOX PASSED')
process.exit(failures ? 1 : 0)
