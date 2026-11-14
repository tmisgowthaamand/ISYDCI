import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.resolve(backendDir, '.env') })

import { connectDb, closeDb, col } from '../db/mongo.js'
import { optionalAuth, signToken, ROLES } from '../services/auth.js'
import reportsRouter from '../routes/reports.js'
import callsRouter from '../routes/calls.js'
import { getCallReportData } from '../services/callReports.js'

const TEST_PREFIX = 'qa_test_'
const TC_A = `${TEST_PREFIX}tc_a`
const TC_B = `${TEST_PREFIX}tc_b`
const DIST_1 = `${TEST_PREFIX}dist_1`
const DIST_2 = `${TEST_PREFIX}dist_2`

const PHONES = {
  p1: '919999000001',
  p2: '919999000002',
  p3: '919999000003',
  p4: '919999000004',
}

const CALL_IDS = [
  `${TEST_PREFIX}call_1`,
  `${TEST_PREFIX}call_2`,
  `${TEST_PREFIX}call_3`,
  `${TEST_PREFIX}call_4`,
  `${TEST_PREFIX}call_5`,
]

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function cleanupTestData() {
  await Promise.all([
    col('whatsapp_calls').deleteMany({ callId: { $in: CALL_IDS } }),
    col('leads').deleteMany({ phone: { $in: Object.values(PHONES) } }),
    col('call_permissions').deleteMany({ waId: { $in: Object.values(PHONES) } }),
    col('admins').deleteMany({ username: { $in: [TC_A, TC_B] } }),
  ])
}

async function main() {
  let passed = 0
  let failed = 0
  let server = null

  function check(name, fn) {
    try {
      fn()
      passed += 1
      console.log(`PASS: ${name}`)
    } catch (err) {
      failed += 1
      console.error(`FAIL: ${name} -> ${err.message}`)
    }
  }

  try {
    await connectDb()
    await cleanupTestData()

    // Baseline permission metrics before seeding qa_test_ rows
    const baselineReport = await getCallReportData({ from: '2099-01-10', to: '2099-01-11' })
    const basePerms = baselineReport.permissions

    const now = Date.now()
    const hourMs = 3600 * 1000

    await col('admins').insertMany([
      {
        username: TC_A,
        role: ROLES.TELECALLER,
        displayName: 'QA Telecaller A',
        active: true,
        seeded: false,
        createdAt: new Date().toISOString(),
      },
      {
        username: TC_B,
        role: ROLES.TELECALLER,
        displayName: 'QA Telecaller B',
        active: true,
        seeded: false,
        createdAt: new Date().toISOString(),
      },
    ])

    await col('leads').insertMany([
      {
        phone: PHONES.p1,
        name: 'QA Lead One',
        district: DIST_1,
        state: 'qa_state_1',
        source: `${TEST_PREFIX}campaign_1`,
        status: 'registered',
        assignedTo: TC_A,
        createdAt: new Date().toISOString(),
      },
      {
        phone: PHONES.p2,
        name: '=CMD("calc")',
        district: DIST_1,
        state: 'qa_state_1',
        source: `${TEST_PREFIX}campaign_1`,
        status: 'new',
        assignedTo: TC_A,
        createdAt: new Date().toISOString(),
      },
      {
        phone: PHONES.p3,
        name: 'QA Lead Three',
        district: DIST_2,
        state: 'qa_state_2',
        source: `${TEST_PREFIX}campaign_2`,
        status: 'card_issued',
        assignedTo: TC_B,
        createdAt: new Date().toISOString(),
      },
      {
        phone: PHONES.p4,
        name: '+123456',
        district: DIST_2,
        state: 'qa_state_2',
        source: `${TEST_PREFIX}campaign_2`,
        status: 'new',
        assignedTo: TC_B,
        createdAt: new Date().toISOString(),
      },
    ])

    await col('call_permissions').insertMany([
      {
        waId: PHONES.p1,
        status: 'accepted',
        isPermanent: false,
        lastReplyAt: new Date(now - 48 * hourMs),
        permissionExpiresAt: new Date(now + 12 * hourMs),
        requestTimestamps: [new Date(now - 50 * hourMs)],
      },
      {
        waId: PHONES.p2,
        status: 'accepted',
        isPermanent: false,
        lastReplyAt: new Date(now - 10 * hourMs),
        permissionExpiresAt: new Date(now + 62 * hourMs),
        requestTimestamps: [new Date(now - 12 * hourMs), new Date(now - 11 * hourMs)],
      },
      {
        waId: PHONES.p3,
        status: 'rejected',
        isPermanent: false,
        requestTimestamps: [new Date(now - 5 * hourMs)],
      },
      {
        waId: PHONES.p4,
        status: 'pending',
        isPermanent: false,
        requestTimestamps: [new Date(now - 2 * hourMs)],
      },
    ])

    await col('whatsapp_calls').insertMany([
      {
        callId: CALL_IDS[0],
        waId: PHONES.p1,
        telecaller_id: TC_A,
        direction: 'inbound',
        status: 'completed',
        attended: true,
        startedAt: new Date('2099-01-10T09:15:00.000+05:30'),
        answeredAt: new Date('2099-01-10T09:15:04.000+05:30'),
        endedAt: new Date('2099-01-10T09:17:04.000+05:30'),
        durationSec: 120,
        recording_status: 'ready',
        endReason: 'caller_hangup',
      },
      {
        callId: CALL_IDS[1],
        waId: PHONES.p2,
        telecaller_id: TC_A,
        direction: 'inbound',
        status: 'missed',
        attended: false,
        startedAt: new Date('2099-01-10T09:30:00.000+05:30'),
        answeredAt: null,
        endedAt: new Date('2099-01-10T09:30:30.000+05:30'),
        durationSec: 0,
        recording_status: 'none',
        endReason: 'no_answer',
      },
      {
        callId: CALL_IDS[2],
        waId: PHONES.p2,
        telecaller_id: TC_A,
        direction: 'outbound',
        status: 'completed',
        attended: true,
        startedAt: new Date('2099-01-10T14:05:00.000+05:30'),
        answeredAt: new Date('2099-01-10T14:05:06.000+05:30'),
        endedAt: new Date('2099-01-10T14:06:06.000+05:30'),
        durationSec: 60,
        recording_status: 'none',
        endReason: 'agent_hangup',
      },
      {
        callId: CALL_IDS[3],
        waId: PHONES.p3,
        telecaller_id: TC_B,
        direction: 'outbound',
        status: 'completed',
        attended: true,
        startedAt: new Date('2099-01-11T18:45:00.000+05:30'),
        answeredAt: new Date('2099-01-11T18:45:08.000+05:30'),
        endedAt: new Date('2099-01-11T18:50:08.000+05:30'),
        durationSec: 300,
        recording_status: 'ready',
        endReason: 'caller_hangup',
      },
      {
        callId: CALL_IDS[4],
        waId: PHONES.p4,
        telecaller_id: TC_B,
        direction: 'outbound',
        status: 'failed',
        attended: false,
        startedAt: new Date('2099-01-11T23:10:00.000+05:30'),
        answeredAt: null,
        endedAt: new Date('2099-01-11T23:10:02.000+05:30'),
        durationSec: 0,
        recording_status: 'none',
        endReason: 'network_error',
      },
    ])

    // Boot ephemeral Express server
    const app = express()
    app.use(express.json())
    app.use(optionalAuth)
    app.use('/api/reports', reportsRouter)
    app.use('/api/calls', callsRouter)

    await new Promise(resolve => {
      server = http.createServer(app)
      server.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address()
    const baseUrl = `http://127.0.0.1:${port}`

    const superAdminToken = signToken({
      sub: `${TEST_PREFIX}super_admin_id`,
      username: `${TEST_PREFIX}super_admin`,
      role: ROLES.SUPER_ADMIN,
    })
    const tcAToken = signToken({
      sub: `${TEST_PREFIX}tc_a_id`,
      username: TC_A,
      role: ROLES.TELECALLER,
    })

    // 1. Super Admin GET /api/reports/calls
    const saRes = await fetch(`${baseUrl}/api/reports/calls?from=2099-01-10&to=2099-01-11`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const saBody = await saRes.json()

    check('Super Admin /api/reports/calls returns 200 & success', () => {
      assert.equal(saRes.status, 200)
      assert.equal(saBody.success, true)
      assert.equal(saBody.scopedTelecaller, null)
    })

    const saReport = saBody.report
    check('Super Admin summary KPI math is exact', () => {
      assert.equal(saReport.summary.totalCalls, 5)
      assert.equal(saReport.summary.inboundCalls, 2)
      assert.equal(saReport.summary.outboundCalls, 3)
      assert.equal(saReport.summary.answeredCalls, 3)
      assert.equal(saReport.summary.inboundAnswered, 1)
      assert.equal(saReport.summary.outboundAnswered, 2)
      assert.equal(saReport.summary.missedCalls, 1)
      assert.equal(saReport.summary.failedCalls, 1)
      assert.equal(saReport.summary.answerRate, 60)
      assert.equal(saReport.summary.inboundAnswerRate, 50)
      assert.equal(saReport.summary.outboundAnswerRate, 66.7)
      assert.equal(saReport.summary.totalTalkSec, 480)
      assert.equal(saReport.summary.avgHandleSec, 160)
      assert.equal(saReport.summary.avgRingSec, 6)
      assert.equal(saReport.summary.recordedCalls, 2)
      assert.equal(saReport.summary.recordingCoverage, 66.7)
    })

    check('Super Admin 24-hour IST heatmap buckets are accurate and zero-filled', () => {
      assert.equal(saReport.hourlyHeatmap.length, 24)
      const h9 = saReport.hourlyHeatmap[9]
      const h14 = saReport.hourlyHeatmap[14]
      const h18 = saReport.hourlyHeatmap[18]
      const h23 = saReport.hourlyHeatmap[23]
      const h0 = saReport.hourlyHeatmap[0]
      assert.deepEqual(
        { total: h9.total, inbound: h9.inbound, outbound: h9.outbound, answered: h9.answered, missed: h9.missed },
        { total: 2, inbound: 2, outbound: 0, answered: 1, missed: 1 }
      )
      assert.equal(h14.total, 1)
      assert.equal(h14.outbound, 1)
      assert.equal(h14.answered, 1)
      assert.equal(h18.total, 1)
      assert.equal(h18.outbound, 1)
      assert.equal(h23.total, 1)
      assert.equal(h23.outbound, 1)
      assert.equal(h23.answered, 0)
      assert.equal(h0.total, 0)
    })

    check('Super Admin permission funnel delta matches seeded permissions', () => {
      const p = saReport.permissions
      assert.equal(p.totalContacts - basePerms.totalContacts, 4)
      assert.equal(p.requestsSent - basePerms.requestsSent, 5)
      assert.equal(p.accepted - basePerms.accepted, 2)
      assert.equal(p.rejected - basePerms.rejected, 1)
      assert.equal(p.pending - basePerms.pending, 1)
      assert.equal(p.active72hWindows - basePerms.active72hWindows, 2)
      assert.equal(p.expiringSoon24h - basePerms.expiringSoon24h, 1)
      assert.equal(p.utilizedActive72hWindows - basePerms.utilizedActive72hWindows, 1)
      assert.equal(p.unusedActive72hWindows - basePerms.unusedActive72hWindows, 1)
    })

    check('Super Admin district attribution matches seeded districts', () => {
      const d1 = saReport.localityAttribution.find(d => d.district === DIST_1)
      const d2 = saReport.localityAttribution.find(d => d.district === DIST_2)
      assert.ok(d1, 'DIST_1 missing from localityAttribution')
      assert.ok(d2, 'DIST_2 missing from localityAttribution')
      assert.equal(d1.totalCalls, 3)
      assert.equal(d1.answeredCalls, 2)
      assert.equal(d1.missedCalls, 1)
      assert.equal(d1.totalTalkSec, 180)
      assert.equal(d1.uniqueLeads, 2)
      assert.equal(d1.convertedLeads, 1)
      assert.equal(d2.totalCalls, 2)
      assert.equal(d2.answeredCalls, 1)
      assert.equal(d2.totalTalkSec, 300)
      assert.equal(d2.uniqueLeads, 2)
      assert.equal(d2.convertedLeads, 1)
    })

    // 2. Telecaller A GET /api/reports/calls (including attempt to spoof telecaller_id=TC_B)
    const tcRes = await fetch(
      `${baseUrl}/api/reports/calls?from=2099-01-10&to=2099-01-11&telecaller_id=${TC_B}`,
      { headers: { Authorization: `Bearer ${tcAToken}` } }
    )
    const tcBody = await tcRes.json()

    check('Telecaller A /api/reports/calls enforces strict role isolation', () => {
      assert.equal(tcRes.status, 200)
      assert.equal(tcBody.success, true)
      assert.equal(tcBody.scopedTelecaller, TC_A)
      const r = tcBody.report
      assert.equal(r.summary.totalCalls, 3)
      assert.equal(r.summary.totalTalkSec, 180)
      assert.equal(r.summary.answeredCalls, 2)
      assert.equal(r.summary.avgRingSec, 5)
      assert.equal(r.telecallerLeaderboard.length, 1)
      assert.equal(r.telecallerLeaderboard[0].telecallerId, TC_A)
      assert.equal(r.telecallerLeaderboard.some(row => row.telecallerId === TC_B), false)
      assert.equal(r.localityAttribution.some(row => row.district === DIST_2), false)
      assert.equal(r.hourlyHeatmap[18].total, 0)
      assert.equal(r.hourlyHeatmap[23].total, 0)
      assert.equal(r.permissions.totalContacts, 2)
      assert.equal(r.permissions.requestsSent, 3)
      assert.equal(r.permissions.utilizedActive72hWindows, 1)
      assert.equal(r.permissions.unusedActive72hWindows, 1)
      assert.equal(r.permissions.utilizationRate, 50)
    })

    // 3. Super Admin GET /api/calls/export
    const saCsvRes = await fetch(`${baseUrl}/api/calls/export?from=2099-01-10&to=2099-01-11`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
    const saCsvText = await saCsvRes.text()
    const saCsvRows = parseCsv(saCsvText)

    check('Super Admin /api/calls/export headers, RFC-4180 CSV, IST timestamps & formula sanitization', () => {
      assert.equal(saCsvRes.status, 200)
      assert.match(saCsvRes.headers.get('content-type') || '', /text\/csv/i)
      assert.match(saCsvRes.headers.get('content-disposition') || '', /attachment; filename="isydci-calls-/)
      assert.equal(saCsvRows.length, 6) // 1 header + 5 rows
      assert.deepEqual(saCsvRows[0], [
        'Call ID',
        'Phone (WA ID)',
        'Lead Name',
        'District',
        'State',
        'Source',
        'Telecaller',
        'Direction',
        'Status',
        'Attended',
        'Started At (IST)',
        'Answered At (IST)',
        'Ended At (IST)',
        'Duration (sec)',
        'Ring Latency (sec)',
        'End Reason',
        'Recording Status',
      ])
      const rowMap = new Map(saCsvRows.slice(1).map(r => [r[0], r]))
      const r1 = rowMap.get(CALL_IDS[0])
      const r3 = rowMap.get(CALL_IDS[2])
      const r5 = rowMap.get(CALL_IDS[4])
      assert.ok(r1 && r3 && r5)
      assert.equal(r1[10], '2099-01-10 09:15:00')
      assert.equal(r1[11], '2099-01-10 09:15:04')
      assert.equal(r3[2], '\'=CMD("calc")')
      assert.equal(r5[2], '\'+123456')
    })

    // 4. Telecaller A GET /api/calls/export (with spoofed telecaller_id=TC_B)
    const tcCsvRes = await fetch(
      `${baseUrl}/api/calls/export?from=2099-01-10&to=2099-01-11&telecaller_id=${TC_B}`,
      { headers: { Authorization: `Bearer ${tcAToken}` } }
    )
    const tcCsvText = await tcCsvRes.text()
    const tcCsvRows = parseCsv(tcCsvText)

    check('Telecaller A /api/calls/export isolates rows to TC_A only', () => {
      assert.equal(tcCsvRes.status, 200)
      assert.equal(tcCsvRows.length, 4) // 1 header + 3 TC_A rows
      const callIds = tcCsvRows.slice(1).map(r => r[0])
      assert.ok(callIds.includes(CALL_IDS[0]))
      assert.ok(callIds.includes(CALL_IDS[1]))
      assert.ok(callIds.includes(CALL_IDS[2]))
      assert.equal(callIds.includes(CALL_IDS[3]), false)
      assert.equal(callIds.includes(CALL_IDS[4]), false)
      assert.equal(tcCsvRows.slice(1).every(r => r[6] === TC_A), true)
    })

    console.log(`\nSummary: ${passed} passed, ${failed} failed`)
    if (failed > 0) process.exitCode = 1
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve))
    }
    await cleanupTestData().catch(err => {
      console.error('Cleanup error:', err)
      process.exitCode = 1
    })
    await closeDb().catch(() => {})
  }
}

main().catch(err => {
  console.error('Fatal QA script error:', err)
  process.exit(1)
})
