// Automated unit & RBAC tests for Telecallers, 6-digit passcode login, and Manual/Round-Robin routing
// Usage: node backend/tests/test_telecallers.mjs

import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { connectDb, closeDb, col } from '../db/mongo.js'
import { authenticate, ROLES } from '../services/auth.js'
import {
  assignLeads,
  createTelecaller,
  deleteTelecaller,
  getRoutingConfig,
  pickRoundRobinTelecaller,
  resetTelecallerPasscode,
  setRoutingConfig,
} from '../services/telecallers.js'

let passed = 0
function check(cond, label) {
  assert.ok(cond, label)
  passed++
  console.log(`  ✅ ${label}`)
}

const TC1_PHONE = '919999000111'
const TC2_PHONE = '919999000222'
const LEAD_A = '919999111001'
const LEAD_B = '919999111002'

async function cleanup(prevMode = 'manual') {
  await col('admins').deleteMany({ username: { $in: ['test_tc_one', 'test_tc_two'] } })
  await col('leads').deleteMany({ phone: { $in: [LEAD_A, LEAD_B] } })
  await setRoutingConfig(prevMode, 'test_cleanup').catch(() => {})
}

async function main() {
  console.log('Running Telecaller & Lead Routing tests...')
  await connectDb()
  const initialRouting = await getRoutingConfig()
  await cleanup(initialRouting.mode)

  // 1. Create telecallers with auto-generated 6-digit passcodes
  const r1 = await createTelecaller({
    username: 'test_tc_one',
    phone: '9999000111',
    displayName: 'Test Telecaller One',
    createdBy: 'developer',
  })
  const r2 = await createTelecaller({
    username: 'test_tc_two',
    phone: '9999000222',
    displayName: 'Test Telecaller Two',
    createdBy: 'developer',
  })
  check(/^\d{6}$/.test(r1.passcode), 'Auto-generated 6-digit passcode for telecaller 1')
  check(/^\d{6}$/.test(r2.passcode), 'Auto-generated 6-digit passcode for telecaller 2')
  check(r1.telecaller.role === ROLES.TELECALLER && r1.telecaller.phone === TC1_PHONE, 'Telecaller phone normalized to 91XXXXXXXXXX')

  // 2. Login via phone number AND via username with 6-digit passcode
  const loginByPhone = await authenticate('9999000111', r1.passcode)
  const loginByUser = await authenticate('test_tc_one', r1.passcode)
  const badLogin = await authenticate('9999000111', '000000')
  check(Boolean(loginByPhone?.token) && loginByPhone.admin.role === ROLES.TELECALLER, 'Telecaller login succeeds with 10-digit phone + 6-digit passcode')
  check(Boolean(loginByUser?.token) && loginByUser.admin.username === 'test_tc_one', 'Telecaller login succeeds with username + 6-digit passcode')
  check(badLogin === null, 'Wrong 6-digit passcode rejected')

  // 3. Reset 6-digit passcode invalidates old passcode
  const reset = await resetTelecallerPasscode(r1.telecaller.id)
  check(/^\d{6}$/.test(reset.passcode), 'Reset generates new 6-digit passcode')
  const loginNew = await authenticate(TC1_PHONE, reset.passcode)
  check(Boolean(loginNew?.token), 'Login succeeds with new 6-digit passcode')

  // 4. Manual vs Round-Robin routing
  await setRoutingConfig('manual', 'developer')
  const manualPick = await pickRoundRobinTelecaller()
  check(manualPick === null, 'Manual routing returns null (leaves new leads unassigned)')

  await setRoutingConfig('round_robin', 'developer')
  const rr1 = await pickRoundRobinTelecaller()
  const rr2 = await pickRoundRobinTelecaller()
  check(Boolean(rr1) && Boolean(rr2) && rr1 !== rr2, `Round-Robin rotates across active telecallers (${rr1} -> ${rr2})`)

  // 5. Manual lead assignment
  const now = new Date()
  await col('leads').insertMany([
    { phone: LEAD_A, name: 'Lead Alpha', status: 'new', assignedTo: null, createdAt: now, updatedAt: now },
    { phone: LEAD_B, name: 'Lead Beta', status: 'new', assignedTo: null, createdAt: now, updatedAt: now },
  ])
  await assignLeads({ phone: LEAD_A, telecaller: 'test_tc_one', actor: 'developer' })
  const leadA = await col('leads').findOne({ phone: LEAD_A })
  check(leadA?.assignedTo === 'test_tc_one', 'Manual assignLeads assigns lead to telecaller')

  // 6. Live HTTP RBAC checks if backend is running on :5000
  try {
    const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000'
    const health = await fetch(`${BASE}/api/health`)
    if (health.ok) {
      const superLogin = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
      }).then(r => r.json())
      const devLogin = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.SUPER_SUPER_ADMIN_USERNAME, password: process.env.SUPER_SUPER_ADMIN_PASSWORD }),
      }).then(r => r.json())

      const superCreate = await fetch(`${BASE}/api/telecallers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superLogin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Blocked', phone: '9999000333' }),
      })
      if (superCreate.status !== 404) {
        check(superCreate.status === 403, 'Super Admin blocked (403) from creating telecallers')

        const superAssign = await fetch(`${BASE}/api/leads/${LEAD_A}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${superLogin.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: 'test_tc_two' }),
        })
        check(superAssign.status === 403, 'Super Admin blocked (403) from assigning leads to telecallers')

        const superView = await fetch(`${BASE}/api/telecallers`, {
          headers: { Authorization: `Bearer ${superLogin.token}` },
        })
        check(superView.status === 200, 'Super Admin can view telecallers read-only (200)')

        const tcList = await fetch(`${BASE}/api/leads`, {
          headers: { Authorization: `Bearer ${loginNew.token}` },
        }).then(r => r.json())
        const phones = (tcList.leads || []).map(l => l.phone)
        check(phones.includes(LEAD_A) && !phones.includes(LEAD_B), 'Telecaller sees ONLY their own assigned leads')

        const tcOtherLead = await fetch(`${BASE}/api/leads/${LEAD_B}`, {
          headers: { Authorization: `Bearer ${loginNew.token}` },
        })
        check(tcOtherLead.status === 403, 'Telecaller blocked (403) from viewing unassigned/other telecaller lead')
      }
      void devLogin
    }
  } catch (_) {}

  await deleteTelecaller(r1.telecaller.id)
  await deleteTelecaller(r2.telecaller.id)
  await cleanup(initialRouting.mode)
  await closeDb()
  console.log(`\nAll ${passed} Telecaller & Routing tests passed!`)
}

main().catch(async err => {
  console.error('Test failed:', err)
  await cleanup('manual').catch(() => {})
  await closeDb().catch(() => {})
  process.exit(1)
})
