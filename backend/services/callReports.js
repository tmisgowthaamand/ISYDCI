import { col } from '../db/mongo.js'

const CALLS = () => col('whatsapp_calls')
const PERMISSIONS = () => col('call_permissions')
const LEADS = () => col('leads')
const ADMINS = () => col('admins')

const IST_TZ = 'Asia/Kolkata'

function parseDateBound(raw, endOfDay = false) {
  if (!raw || raw === 'all') return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveDateRange({ from, to, days } = {}) {
  if (from === 'all') return { fromDate: null, toDate: parseDateBound(to, true) }
  let fromDate = parseDateBound(from, false)
  let toDate = parseDateBound(to, true)

  if (!fromDate && !toDate) {
    const n = parseInt(days, 10)
    const lookbackDays = Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30
    toDate = new Date()
    fromDate = new Date(toDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
  }
  return { fromDate, toDate }
}

/**
 * Builds base $match + normalized fields + lead $lookup stages shared by
 * both the analytics $facet pipeline and CSV export.
 */
function buildBaseStages({ from, to, days, telecallerId, direction, district } = {}) {
  const { fromDate, toDate } = resolveDateRange({ from, to, days })
  const match = {}

  if (fromDate || toDate) {
    const range = {}
    if (fromDate) range.$gte = fromDate
    if (toDate) range.$lte = toDate
    match.$or = [
      { startedAt: range },
      { startedAt: { $exists: false }, createdAt: range },
      { startedAt: null, createdAt: range },
    ]
  }

  if (telecallerId) {
    if (telecallerId === 'unassigned') {
      match.telecaller_id = { $in: [null, ''] }
    } else {
      match.telecaller_id = String(telecallerId).trim()
    }
  }

  if (direction === 'inbound' || direction === 'outbound') {
    const dirFilter = [{ direction }, { call_direction: direction }]
    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: dirFilter }]
      delete match.$or
    } else {
      match.$or = dirFilter
    }
  }

  const stages = [
    { $match: match },
    {
      $addFields: {
        _ts: { $ifNull: ['$startedAt', '$createdAt'] },
        _dir: { $ifNull: ['$direction', { $ifNull: ['$call_direction', 'inbound'] }] },
        _dur: { $ifNull: ['$durationSec', { $ifNull: ['$duration_seconds', 0] }] },
        _answered: {
          $or: [
            { $eq: ['$attended', true] },
            { $in: ['$status', ['completed', 'accepted']] },
          ],
        },
        _ringSec: {
          $cond: [
            {
              $and: [
                { $ne: ['$answeredAt', null] },
                { $ne: ['$startedAt', null] },
                { $gte: ['$answeredAt', '$startedAt'] },
              ],
            },
            { $divide: [{ $subtract: ['$answeredAt', '$startedAt'] }, 1000] },
            null,
          ],
        },
        _telecaller: {
          $cond: [
            { $and: [{ $ne: ['$telecaller_id', null] }, { $ne: ['$telecaller_id', ''] }] },
            '$telecaller_id',
            'unassigned',
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'leads',
        localField: 'waId',
        foreignField: 'phone',
        as: '_leadArr',
      },
    },
    {
      $addFields: {
        _lead: { $arrayElemAt: ['$_leadArr', 0] },
      },
    },
  ]

  if (district) {
    stages.push({
      $match: {
        '_lead.district': String(district).trim(),
      },
    })
  }

  return stages
}

async function computePermissionMetrics({ telecallerId } = {}) {
  const now = new Date()
  const soonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  let scopedWaIds = null
  if (telecallerId && telecallerId !== 'unassigned') {
    const assignedPhones = await LEADS().distinct('phone', { assignedTo: telecallerId })
    scopedWaIds = assignedPhones.filter(Boolean)
  }

  const permMatch = scopedWaIds ? { waId: { $in: scopedWaIds } } : {}
  const perms = await PERMISSIONS().find(permMatch).toArray()

  let requestsSent = 0
  let accepted = 0
  let rejected = 0
  let pending = 0
  let permanentGrants = 0
  let active72hWindows = 0
  let expiringSoon24h = 0
  let expired72hWindows = 0
  const activeOrRecentWindowWaIds = []
  const replyByWaId = new Map()

  for (const p of perms) {
    const reqCount = Array.isArray(p.requestTimestamps) && p.requestTimestamps.length > 0
      ? p.requestTimestamps.length
      : (p.lastRequestAt ? 1 : 0)
    requestsSent += reqCount

    if (p.status === 'accepted') {
      accepted += 1
      if (p.isPermanent) {
        permanentGrants += 1
      } else {
        const exp = p.permissionExpiresAt ? new Date(p.permissionExpiresAt) : null
        if (exp && exp > now) {
          active72hWindows += 1
          if (exp <= soonCutoff) expiringSoon24h += 1
          activeOrRecentWindowWaIds.push(p.waId)
          replyByWaId.set(p.waId, p.lastReplyAt ? new Date(p.lastReplyAt) : new Date(exp.getTime() - 72 * 3600 * 1000))
        } else {
          expired72hWindows += 1
        }
      }
    } else if (p.status === 'rejected') {
      rejected += 1
    } else {
      pending += 1
    }
  }

  // Count how many currently-active 72h windows have been utilized for at least 1 outbound call
  let utilizedActive72hWindows = 0
  if (activeOrRecentWindowWaIds.length > 0) {
    const outboundCalls = await CALLS()
      .find(
        {
          waId: { $in: activeOrRecentWindowWaIds },
          $or: [{ direction: 'outbound' }, { call_direction: 'outbound' }],
        },
        { projection: { waId: 1, startedAt: 1, createdAt: 1 } }
      )
      .toArray()

    const calledWaIds = new Set()
    for (const c of outboundCalls) {
      const grantedAt = replyByWaId.get(c.waId)
      const callTs = c.startedAt || c.createdAt
      if (!grantedAt || !callTs || new Date(callTs) >= grantedAt) {
        calledWaIds.add(c.waId)
      }
    }
    utilizedActive72hWindows = calledWaIds.size
  }

  const unusedActive72hWindows = Math.max(0, active72hWindows - utilizedActive72hWindows)
  const decided = accepted + rejected
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 1000) / 10 : 0
  const utilizationRate = active72hWindows > 0
    ? Math.round((utilizedActive72hWindows / active72hWindows) * 1000) / 10
    : 0

  return {
    totalContacts: perms.length,
    requestsSent,
    accepted,
    rejected,
    pending,
    acceptanceRate,
    permanentGrants,
    active72hWindows,
    expiringSoon24h,
    expired72hWindows,
    utilizedActive72hWindows,
    unusedActive72hWindows,
    utilizationRate,
  }
}

/**
 * Generates Tier 1 operational & telephony analytics from MongoDB.
 */
export async function getCallReportData({ from, to, days, telecallerId, direction, district } = {}) {
  const baseStages = buildBaseStages({ from, to, days, telecallerId, direction, district })

  const [facetResult] = await CALLS().aggregate([
    ...baseStages,
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalCalls: { $sum: 1 },
              inboundCalls: { $sum: { $cond: [{ $eq: ['$_dir', 'inbound'] }, 1, 0] } },
              outboundCalls: { $sum: { $cond: [{ $eq: ['$_dir', 'outbound'] }, 1, 0] } },
              answeredCalls: { $sum: { $cond: ['$_answered', 1, 0] } },
              inboundAnswered: {
                $sum: { $cond: [{ $and: [{ $eq: ['$_dir', 'inbound'] }, '$_answered'] }, 1, 0] },
              },
              outboundAnswered: {
                $sum: { $cond: [{ $and: [{ $eq: ['$_dir', 'outbound'] }, '$_answered'] }, 1, 0] },
              },
              missedCalls: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
              rejectedCalls: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
              failedCalls: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              totalTalkSec: { $sum: { $cond: ['$_answered', '$_dur', 0] } },
              avgHandleSec: { $avg: { $cond: ['$_answered', '$_dur', null] } },
              avgRingSec: { $avg: '$_ringSec' },
              recordedCalls: { $sum: { $cond: [{ $eq: ['$recording_status', 'ready'] }, 1, 0] } },
            },
          },
        ],
        dailyTrend: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$_ts', timezone: IST_TZ } },
              total: { $sum: 1 },
              inbound: { $sum: { $cond: [{ $eq: ['$_dir', 'inbound'] }, 1, 0] } },
              outbound: { $sum: { $cond: [{ $eq: ['$_dir', 'outbound'] }, 1, 0] } },
              answered: { $sum: { $cond: ['$_answered', 1, 0] } },
              missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
              talkSec: { $sum: { $cond: ['$_answered', '$_dur', 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        hourlyHeatmap: [
          {
            $group: {
              _id: { $hour: { date: '$_ts', timezone: IST_TZ } },
              total: { $sum: 1 },
              inbound: { $sum: { $cond: [{ $eq: ['$_dir', 'inbound'] }, 1, 0] } },
              outbound: { $sum: { $cond: [{ $eq: ['$_dir', 'outbound'] }, 1, 0] } },
              answered: { $sum: { $cond: ['$_answered', 1, 0] } },
              missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        telecallerLeaderboard: [
          {
            $group: {
              _id: '$_telecaller',
              totalCalls: { $sum: 1 },
              outboundAttempts: { $sum: { $cond: [{ $eq: ['$_dir', 'outbound'] }, 1, 0] } },
              outboundAnswered: {
                $sum: { $cond: [{ $and: [{ $eq: ['$_dir', 'outbound'] }, '$_answered'] }, 1, 0] },
              },
              inboundCalls: { $sum: { $cond: [{ $eq: ['$_dir', 'inbound'] }, 1, 0] } },
              inboundAnswered: {
                $sum: { $cond: [{ $and: [{ $eq: ['$_dir', 'inbound'] }, '$_answered'] }, 1, 0] },
              },
              inboundMissed: {
                $sum: { $cond: [{ $and: [{ $eq: ['$_dir', 'inbound'] }, { $eq: ['$status', 'missed'] }] }, 1, 0] },
              },
              answeredCalls: { $sum: { $cond: ['$_answered', 1, 0] } },
              totalTalkSec: { $sum: { $cond: ['$_answered', '$_dur', 0] } },
              avgHandleSec: { $avg: { $cond: ['$_answered', '$_dur', null] } },
              recordedCalls: { $sum: { $cond: [{ $eq: ['$recording_status', 'ready'] }, 1, 0] } },
            },
          },
          { $sort: { totalCalls: -1 } },
        ],
        localityAttribution: [
          {
            $group: {
              _id: {
                district: { $ifNull: ['$_lead.district', 'Unknown'] },
                state: { $ifNull: ['$_lead.state', ''] },
              },
              totalCalls: { $sum: 1 },
              answeredCalls: { $sum: { $cond: ['$_answered', 1, 0] } },
              missedCalls: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
              totalTalkSec: { $sum: { $cond: ['$_answered', '$_dur', 0] } },
              uniquePhones: { $addToSet: '$waId' },
              convertedPhones: {
                $addToSet: {
                  $cond: [
                    { $in: ['$_lead.status', ['registered', 'card_issued']] },
                    '$waId',
                    '$$REMOVE',
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              district: '$_id.district',
              state: '$_id.state',
              totalCalls: 1,
              answeredCalls: 1,
              missedCalls: 1,
              totalTalkSec: 1,
              uniqueLeads: { $size: '$uniquePhones' },
              convertedLeads: { $size: '$convertedPhones' },
            },
          },
          { $sort: { totalCalls: -1 } },
          { $limit: 15 },
        ],
        campaignAttribution: [
          {
            $group: {
              _id: { $ifNull: ['$_lead.source', 'unknown'] },
              totalCalls: { $sum: 1 },
              answeredCalls: { $sum: { $cond: ['$_answered', 1, 0] } },
              missedCalls: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
              totalTalkSec: { $sum: { $cond: ['$_answered', '$_dur', 0] } },
            },
          },
          { $sort: { totalCalls: -1 } },
        ],
        endReasons: [
          {
            $group: {
              _id: { $ifNull: ['$endReason', 'unknown'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
      },
    },
  ]).toArray()

  const rawSummary = facetResult?.summary?.[0] || {}
  const totalCalls = rawSummary.totalCalls || 0
  const answeredCalls = rawSummary.answeredCalls || 0
  const inboundCalls = rawSummary.inboundCalls || 0
  const outboundCalls = rawSummary.outboundCalls || 0

  const summary = {
    totalCalls,
    inboundCalls,
    outboundCalls,
    answeredCalls,
    inboundAnswered: rawSummary.inboundAnswered || 0,
    outboundAnswered: rawSummary.outboundAnswered || 0,
    missedCalls: rawSummary.missedCalls || 0,
    rejectedCalls: rawSummary.rejectedCalls || 0,
    failedCalls: rawSummary.failedCalls || 0,
    answerRate: totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 1000) / 10 : 0,
    inboundAnswerRate: inboundCalls > 0
      ? Math.round(((rawSummary.inboundAnswered || 0) / inboundCalls) * 1000) / 10
      : 0,
    outboundAnswerRate: outboundCalls > 0
      ? Math.round(((rawSummary.outboundAnswered || 0) / outboundCalls) * 1000) / 10
      : 0,
    totalTalkSec: Math.round(rawSummary.totalTalkSec || 0),
    avgHandleSec: Math.round(rawSummary.avgHandleSec || 0),
    avgRingSec: rawSummary.avgRingSec != null ? Math.round(rawSummary.avgRingSec * 10) / 10 : null,
    recordedCalls: rawSummary.recordedCalls || 0,
    recordingCoverage: answeredCalls > 0
      ? Math.round(((rawSummary.recordedCalls || 0) / answeredCalls) * 1000) / 10
      : 0,
  }

  // Zero-fill 24-hour IST buckets (00..23)
  const hourMap = new Map((facetResult?.hourlyHeatmap || []).map(h => [h._id, h]))
  const hourlyHeatmap = Array.from({ length: 24 }, (_, hour) => {
    const h = hourMap.get(hour) || {}
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      total: h.total || 0,
      inbound: h.inbound || 0,
      outbound: h.outbound || 0,
      answered: h.answered || 0,
      missed: h.missed || 0,
    }
  })

  // Enrich telecaller leaderboard with displayName and assignedLeads count
  const [telecallerAdmins, assignedLeadCounts, availableDistricts, permissions] = await Promise.all([
    ADMINS()
      .find({ role: 'telecaller' }, { projection: { username: 1, displayName: 1, active: 1 } })
      .toArray(),
    LEADS()
      .aggregate([
        { $match: { assignedTo: { $nin: [null, ''] } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      ])
      .toArray(),
    LEADS().distinct('district', { district: { $nin: [null, ''] } }),
    computePermissionMetrics({ telecallerId }),
  ])

  const adminMap = new Map(telecallerAdmins.map(a => [a.username, a]))
  const assignedMap = new Map(assignedLeadCounts.map(a => [a._id, a.count]))

  const telecallerLeaderboard = (facetResult?.telecallerLeaderboard || []).map(row => {
    const admin = adminMap.get(row._id)
    const outboundPickupRate = row.outboundAttempts > 0
      ? Math.round((row.outboundAnswered / row.outboundAttempts) * 1000) / 10
      : 0
    const recordingCoverage = row.answeredCalls > 0
      ? Math.round((row.recordedCalls / row.answeredCalls) * 1000) / 10
      : 0
    return {
      telecallerId: row._id,
      displayName: row._id === 'unassigned' ? 'Unassigned' : (admin?.displayName || row._id),
      assignedLeads: assignedMap.get(row._id) || 0,
      totalCalls: row.totalCalls,
      outboundAttempts: row.outboundAttempts,
      outboundAnswered: row.outboundAnswered,
      outboundPickupRate,
      inboundCalls: row.inboundCalls,
      inboundAnswered: row.inboundAnswered,
      inboundMissed: row.inboundMissed,
      answeredCalls: row.answeredCalls,
      totalTalkSec: Math.round(row.totalTalkSec || 0),
      avgHandleSec: Math.round(row.avgHandleSec || 0),
      recordedCalls: row.recordedCalls,
      recordingCoverage,
    }
  })

  const dailyTrend = (facetResult?.dailyTrend || []).map(d => ({
    date: d._id,
    total: d.total,
    inbound: d.inbound,
    outbound: d.outbound,
    answered: d.answered,
    missed: d.missed,
    talkSec: Math.round(d.talkSec || 0),
  }))

  const campaignAttribution = (facetResult?.campaignAttribution || []).map(c => ({
    source: c._id || 'unknown',
    totalCalls: c.totalCalls,
    answeredCalls: c.answeredCalls,
    missedCalls: c.missedCalls,
    answerRate: c.totalCalls > 0 ? Math.round((c.answeredCalls / c.totalCalls) * 1000) / 10 : 0,
    totalTalkSec: Math.round(c.totalTalkSec || 0),
  }))

  const endReasons = (facetResult?.endReasons || []).map(e => ({
    reason: e._id || 'unknown',
    count: e.count,
  }))

  return {
    summary,
    dailyTrend,
    hourlyHeatmap,
    telecallerLeaderboard,
    permissions,
    localityAttribution: facetResult?.localityAttribution || [],
    campaignAttribution,
    endReasons,
    filters: {
      districts: availableDistricts.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
      telecallers: telecallerAdmins.map(a => ({
        username: a.username,
        displayName: a.displayName || a.username,
      })),
    },
  }
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

function fmtIst(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('sv-SE', { timeZone: IST_TZ })
}

/**
 * Streams filtered call records as UTF-8 CSV chunks.
 */
export async function* exportCallsCsv({ from, to, days, telecallerId, direction, district } = {}) {
  const header = [
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
  ]
  yield `${header.map(csvCell).join(',')}\n`

  const baseStages = buildBaseStages({ from, to, days, telecallerId, direction, district })
  const cursor = CALLS().aggregate([
    ...baseStages,
    { $sort: { _ts: -1 } },
    {
      $project: {
        callId: 1,
        waId: 1,
        leadName: 1,
        status: 1,
        attended: 1,
        startedAt: 1,
        answeredAt: 1,
        endedAt: 1,
        endReason: 1,
        recording_status: 1,
        _ts: 1,
        _dir: 1,
        _dur: 1,
        _ringSec: 1,
        _telecaller: 1,
        leadDistrict: '$_lead.district',
        leadState: '$_lead.state',
        leadSource: '$_lead.source',
        leadDbName: '$_lead.name',
      },
    },
  ])

  for await (const c of cursor) {
    const row = [
      c.callId || '',
      c.waId || '',
      c.leadName || c.leadDbName || '',
      c.leadDistrict || '',
      c.leadState || '',
      c.leadSource || '',
      c._telecaller || 'unassigned',
      c._dir || '',
      c.status || '',
      c.attended ? 'Yes' : 'No',
      fmtIst(c.startedAt || c._ts),
      fmtIst(c.answeredAt),
      fmtIst(c.endedAt),
      Math.round(c._dur || 0),
      c._ringSec != null ? Math.round(c._ringSec * 10) / 10 : '',
      c.endReason || '',
      c.recording_status || 'none',
    ]
    yield `${row.map(csvCell).join(',')}\n`
  }
}
