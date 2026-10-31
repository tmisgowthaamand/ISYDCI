// Phase 4 checks: template validation against Meta limits, draft CRUD, and (with --meta) a real
// submit -> sync -> delete round trip on the WhatsApp Business Account.
//   node backend/tests/test_templates.mjs            validation + CRUD only
//   node backend/tests/test_templates.mjs --meta     also creates + deletes a real test template on Meta
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
const WITH_META = process.argv.includes('--meta')
let failures = 0
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}
const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }
const j = async (p, opts = {}) => {
  const res = await fetch(BASE + p, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const validate = async def => (await j('/api/templates/validate', { method: 'POST', body: JSON.stringify(def) })).body.errors

console.log(`Testing ${BASE}${WITH_META ? ' (with a real Meta round trip)' : ''}`)

// ---- validation rules
const good = { name: 'isydci_test_welcome', language: 'en', category: 'UTILITY', header: { format: 'TEXT', text: 'Welcome {{1}}', example: ['Athlete'] }, body: { text: 'Hi {{1}}, your ISYDCI Member ID is {{2}}. Reply STOP to opt out.', examples: ['Rahul', 'ISYDCI-ABCD1234'] }, footer: { text: 'ISYDCI · Reg No 49/1997' }, buttons: [{ type: 'URL', text: 'View card', url: 'https://isydci.com/membership-card?id={{1}}', example: 'ISYDCI-ABCD1234' }, { type: 'QUICK_REPLY', text: 'Need help' }] }
ok((await validate(good)).length === 0, 'valid template passes with 0 errors')
ok((await validate({ ...good, name: 'Bad Name!' })).some(e => /lowercase/.test(e)), 'uppercase/space in name rejected')
ok((await validate({ ...good, body: { text: 'x'.repeat(1025), examples: [] } })).some(e => /1024/.test(e)), 'body over 1024 chars rejected')
ok((await validate({ ...good, header: { format: 'TEXT', text: 'y'.repeat(61) } })).some(e => /60/.test(e)), 'header over 60 chars rejected')
ok((await validate({ ...good, footer: { text: 'f'.repeat(61) } })).some(e => /60/.test(e)), 'footer over 60 chars rejected')
ok((await validate({ ...good, body: { text: 'Hi {{1}} and {{2}}', examples: ['only one'] } })).some(e => /sample value/.test(e)), 'missing variable samples rejected')
ok((await validate({ ...good, buttons: [1, 2, 3].map(i => ({ type: 'URL', text: `U${i}`, url: 'https://isydci.com' })) })).some(e => /Maximum 2 URL/.test(e)), 'more than 2 URL buttons rejected')
ok((await validate({ ...good, buttons: [{ type: 'QUICK_REPLY', text: 'a'.repeat(26) }] })).some(e => /25/.test(e)), 'button label over 25 chars rejected')
ok((await validate({ ...good, buttons: [{ type: 'QUICK_REPLY', text: 'A' }, { type: 'URL', text: 'B', url: 'https://x.y' }, { type: 'QUICK_REPLY', text: 'C' }] })).some(e => /grouped/.test(e)), 'quick replies split by another button rejected')
ok((await validate({ ...good, header: { format: 'IMAGE' } })).some(e => /Upload a sample image/.test(e)), 'image header without sample rejected')
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
ok((await validate({ ...good, header: { format: 'IMAGE', mediaDataUri: tinyPng } })).length === 0, 'image header with a PNG sample accepted')
ok((await validate({ ...good, header: { format: 'IMAGE', mediaDataUri: 'data:image/gif;base64,R0lGOD' } })).some(e => /jpeg|png/i.test(e)), 'GIF header rejected (JPEG/PNG only)')

// ---- CRUD
const name = `isydci_crm_test_${Date.now().toString(36)}`
const created = await j('/api/templates', { method: 'POST', body: JSON.stringify({ ...good, name, header: { format: 'NONE' }, buttons: [{ type: 'QUICK_REPLY', text: 'Need help' }] }) })
ok(created.status === 201 && created.body.template.status === 'draft', `draft created (${name})`)
const id = created.body.template.id
const listed = await j('/api/templates')
ok(listed.body.templates.some(t => t.id === id), 'draft appears in the list')
const edited = await j(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify({ footer: { text: 'ISYDCI Secretariat' } }) })
ok(edited.status === 200 && edited.body.template.footer.text === 'ISYDCI Secretariat', 'draft edited')
const sendDraft = await j(`/api/templates/${id}/send`, { method: 'POST', body: JSON.stringify({ to: '919000000001' }) })
ok(sendDraft.status === 400 && /Approved/.test(sendDraft.body.message), 'sending a non-approved template is refused')

if (WITH_META) {
  const sub = await j(`/api/templates/${id}/submit`, { method: 'POST' })
  ok(sub.status === 200 && sub.body.template.metaId, `submitted to Meta -> id ${sub.body.template.metaId}, status ${sub.body.template.status}`)
  const sync = await j(`/api/templates/${id}/sync`, { method: 'POST' })
  ok(sync.status === 200 && ['PENDING', 'APPROVED', 'REJECTED'].includes(sync.body.template.status), `status synced from Meta: ${sync.body.template.statusLabel}`)
  const all = await j('/api/templates/sync-all', { method: 'POST' })
  ok(all.status === 200, `sync-all from Meta: ${all.body.imported} imported, ${all.body.updated} updated`)
  const del = await j(`/api/templates/${id}`, { method: 'DELETE' })
  ok(del.status === 200, 'test template deleted locally and on Meta')
} else {
  const del = await j(`/api/templates/${id}?meta=false`, { method: 'DELETE' })
  ok(del.status === 200, 'draft deleted')
}

console.log(failures ? `\n❌ ${failures} check(s) failed` : '\n✅ TEMPLATES PASSED')
process.exit(failures ? 1 : 0)
