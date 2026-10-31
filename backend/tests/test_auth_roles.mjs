// Phase 1 checks: login, token enforcement, role gates, members on MongoDB.
//   node backend/tests/test_auth_roles.mjs   (backend running on :5000)
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
let failures = 0
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}
const j = async (path, opts = {}, token) => {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

console.log(`Testing ${BASE}`)

// health
const h = await j('/api/health')
ok(h.status === 200 && h.body.database === 'mongodb', 'health reports MongoDB backend')

// login
const bad = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: env.ADMIN_USERNAME, password: 'wrong-password' }) })
ok(bad.status === 401, 'wrong password rejected (401)')
const sa = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }) })
ok(sa.status === 200 && sa.body.user?.role === 'super_admin' && !sa.body.user.isDeveloper, `Super Admin login -> role super_admin (${env.ADMIN_USERNAME})`)
const dev = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: env.SUPER_SUPER_ADMIN_USERNAME, password: env.SUPER_SUPER_ADMIN_PASSWORD }) })
ok(dev.status === 200 && dev.body.user?.role === 'super_super_admin' && dev.body.user.isDeveloper, `Developer login -> role super_super_admin (${env.SUPER_SUPER_ADMIN_USERNAME})`)
const saTok = sa.body.token
const devTok = dev.body.token

// token enforcement
ok((await j('/api/members')).status === 401, 'members list without token -> 401')
ok((await j('/api/members', {}, 'not.a.token')).status === 401, 'members list with bad token -> 401')
const me = await j('/api/auth/me', {}, saTok)
ok(me.status === 200 && me.body.user.username === env.ADMIN_USERNAME, '/api/auth/me validates the token')

// members on mongo (create a test member if empty, test endpoints, then clean up)
const testMemberPayload = {
  name: 'CI TEST ATHLETE',
  contact: '919876543210',
  state: 'TAMIL NADU',
  district: 'CHENNAI',
  zone: 'WARD 1',
  dob: '15 Aug 1999',
  age: '27',
  bloodGroup: 'O+',
  address: 'No 1, Test Street, Chennai',
  photo: '/athletes/1.png',
}
const regRes = await j('/api/members', { method: 'POST', body: JSON.stringify(testMemberPayload) }, saTok)
const testMem = regRes.body?.member || regRes.body

const list = await j('/api/members', {}, saTok)
ok(list.status === 200 && Array.isArray(list.body.members) && list.body.total >= 1, `members list with token -> ${list.body.total} members from MongoDB`)
const paged = await j('/api/members?page=1&limit=3', {}, saTok)
ok(paged.status === 200 && Array.isArray(paged.body.members), 'paged members list works')

if (testMem && testMem.memberId) {
  const pub = await j(`/api/members/${testMem.memberId}`)
  ok(pub.status === 200 && pub.body.member?.memberId === testMem.memberId, 'public card lookup by Member ID still open (no token)')
  const phoneLookup = await j(`/api/members/phone/${testMemberPayload.contact}`, {}, saTok)
  ok(phoneLookup.status === 200 && phoneLookup.body.member?.memberId === testMem.memberId, 'phone lookup finds the member')
  // Cleanup test member
  await j(`/api/members/${testMem.id || testMem.memberId}`, { method: 'DELETE' }, saTok)
}

const stats = await j('/api/stats', {}, saTok)
ok(stats.status === 200 && stats.body.stats !== undefined, 'dashboard stats work')

// role gates
ok((await j('/api/dev/status', {}, saTok)).status === 403, 'Super Admin blocked from developer routes (403)')
const devStatus = await j('/api/dev/status', {}, devTok)
ok(devStatus.status === 200 && devStatus.body.status?.database?.url, 'Developer can read /api/dev/status')
ok((await j('/api/auth/admins', {}, saTok)).status === 403, 'Super Admin cannot manage admin accounts')
const admins = await j('/api/auth/admins', {}, devTok)
ok(admins.status === 200 && admins.body.admins.length >= 2, `Developer sees admin accounts (${admins.body.admins?.length})`)
ok((await j('/api/leads', {}, saTok)).status === 200, 'Super Admin can open leads')
ok((await j('/api/templates', {}, saTok)).status === 200, 'Super Admin can open templates')
ok((await j('/api/dev/providers', {}, devTok)).status === 200, 'Developer can open providers')

// admin account management (create, then delete)
const created = await j('/api/auth/admins', { method: 'POST', body: JSON.stringify({ username: 'test_staff', password: 'TempPass123!', role: 'super_admin', displayName: 'Test Staff' }) }, devTok)
ok(created.status === 201, 'Developer can create a Super Admin account')
if (created.status === 201) {
  const staff = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'test_staff', password: 'TempPass123!' }) })
  ok(staff.status === 200 && staff.body.user.role === 'super_admin', 'new staff account can log in as Super Admin')
  const del = await j(`/api/auth/admins/${created.body.admin.id}`, { method: 'DELETE' }, devTok)
  ok(del.status === 200, 'test staff account deleted')
}
const seededDel = await j(`/api/auth/admins/${admins.body.admins.find(a => a.seeded)?.id}`, { method: 'DELETE' }, devTok)
ok(seededDel.status === 400, '.env-managed accounts cannot be deleted from the panel')

// audit trail
const audit = await j('/api/dev/audit?limit=5', {}, devTok)
ok(audit.status === 200 && audit.body.items.some(i => i.action === 'LOGIN'), 'audit log records logins')

console.log(failures ? `\n❌ ${failures} check(s) failed` : '\n✅ PHASE 1 (auth + roles + MongoDB) PASSED')
process.exit(failures ? 1 : 0)
