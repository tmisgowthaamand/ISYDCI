import { useEffect, useMemo, useState } from 'react'
import { apiFetch, apiJson } from '../config/api.js'

const SOURCE_LABELS = {
  whatsapp: 'WhatsApp',
  ctwa_ad: 'Click-to-WhatsApp Ad',
  facebook_lead_ad: 'Facebook Lead Ad',
  web: 'Website',
  whatsapp_flow: 'WhatsApp Flow',
  simulator: 'Simulator',
  import: 'Import',
  manual: 'Manual',
  unknown: 'Unattributed',
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export default function AdminCallReports() {
  const [days, setDays] = useState('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [direction, setDirection] = useState('')
  const [district, setDistrict] = useState('')
  const [telecallerId, setTelecallerId] = useState('')
  const [report, setReport] = useState(null)
  const [scopedTelecaller, setScopedTelecaller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const buildQuery = () => {
    const p = new URLSearchParams()
    if (from || to) {
      if (from) p.set('from', from)
      if (to) p.set('to', to)
    } else if (days === 'all') {
      p.set('from', 'all')
    } else {
      p.set('days', days)
    }
    if (direction) p.set('direction', direction)
    if (district) p.set('district', district)
    if (telecallerId && !scopedTelecaller) p.set('telecaller_id', telecallerId)
    return p.toString()
  }

  const loadReport = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = buildQuery()
      const data = await apiJson(`/api/reports/calls?${qs}`)
      setReport(data.report)
      setScopedTelecaller(data.scopedTelecaller || null)
    } catch (err) {
      setError(err.message || 'Failed to load call report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, from, to, direction, district, telecallerId])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const qs = buildQuery()
      const res = await apiFetch(`/api/calls/export?${qs}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `isydci-calls-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const summary = report?.summary || {}
  const dailyTrend = report?.dailyTrend || []
  const hourlyHeatmap = report?.hourlyHeatmap || []
  const leaderboard = report?.telecallerLeaderboard || []
  const permissions = report?.permissions || {}
  const locality = report?.localityAttribution || []
  const campaigns = report?.campaignAttribution || []
  const endReasons = report?.endReasons || []
  const filterOptions = report?.filters || { districts: [], telecallers: [] }

  const maxDaily = useMemo(
    () => Math.max(1, ...dailyTrend.map(d => d.total || 0)),
    [dailyTrend]
  )
  const maxHourly = useMemo(
    () => Math.max(1, ...hourlyHeatmap.map(h => h.total || 0)),
    [hourlyHeatmap]
  )

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a] font-['Montserrat']">
            WhatsApp Call Reports &amp; Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {scopedTelecaller
              ? `Showing telephony performance scoped to @${scopedTelecaller} (IST).`
              : 'Tier 1 operational metrics, hourly call spikes, telecaller leaderboard, and 72-hour permission utilization (IST).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Quick Range
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {[
              { id: '7', label: '7D' },
              { id: '30', label: '30D' },
              { id: '90', label: '90D' },
              { id: 'all', label: 'All' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setDays(opt.id)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  !from && !to && days === opt.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            From (IST)
          </label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            To (IST)
          </label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Direction
          </label>
          <select
            value={direction}
            onChange={e => setDirection(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            District
          </label>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white min-w-[140px]"
          >
            <option value="">All Districts</option>
            {filterOptions.districts.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {!scopedTelecaller && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Telecaller
            </label>
            <select
              value={telecallerId}
              onChange={e => setTelecallerId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white min-w-[150px]"
            >
              <option value="">All Telecallers</option>
              {filterOptions.telecallers.map(t => (
                <option key={t.username} value={t.username}>
                  {t.displayName} (@{t.username})
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Calls
          </div>
          <div className="text-3xl font-black text-slate-900 mt-1">
            {loading ? '—' : summary.totalCalls ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            In: <span className="font-bold text-slate-700">{summary.inboundCalls ?? 0}</span> · Out:{' '}
            <span className="font-bold text-slate-700">{summary.outboundCalls ?? 0}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            Answer Rate
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-1">
            {loading ? '—' : `${summary.answerRate ?? 0}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            In: <span className="font-bold">{summary.inboundAnswerRate ?? 0}%</span> · Out:{' '}
            <span className="font-bold">{summary.outboundAnswerRate ?? 0}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
            Missed &amp; Failed
          </div>
          <div className="text-3xl font-black text-rose-700 mt-1">
            {loading ? '—' : summary.missedCalls ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Rejected: <span className="font-bold">{summary.rejectedCalls ?? 0}</span> · Failed:{' '}
            <span className="font-bold">{summary.failedCalls ?? 0}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Avg Handle Time
          </div>
          <div className="text-3xl font-black text-blue-700 mt-1">
            {loading ? '—' : fmtDuration(summary.avgHandleSec)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Talk: <span className="font-bold">{fmtDuration(summary.totalTalkSec)}</span>
            {summary.avgRingSec != null && (
              <> · Ring: <span className="font-bold">{summary.avgRingSec}s</span></>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Recording Coverage
          </div>
          <div className="text-3xl font-black text-indigo-700 mt-1">
            {loading ? '—' : `${summary.recordingCoverage ?? 0}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {summary.recordedCalls ?? 0} of {summary.answeredCalls ?? 0} answered calls
          </div>
        </div>
      </div>

      {/* Daily Trend + Hourly Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Daily Call Volume (IST)</h2>
              <p className="text-xs text-slate-500">Answered (emerald) vs. Missed/Other (rose)</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Answered
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-400" /> Unanswered
              </span>
            </div>
          </div>

          {dailyTrend.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400">
              No calls recorded in the selected date range.
            </div>
          ) : (
            <div className="h-48 flex items-end gap-1.5 overflow-x-auto pb-2 pt-4">
              {dailyTrend.map(d => {
                const unanswered = Math.max(0, d.total - d.answered)
                const ansH = Math.round((d.answered / maxDaily) * 140)
                const unH = Math.round((unanswered / maxDaily) * 140)
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.total} total (${d.answered} answered, ${d.missed} missed, ${fmtDuration(d.talkSec)} talk)`}
                    className="flex-1 min-w-[18px] flex flex-col items-center group"
                  >
                    <div className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 mb-1">
                      {d.total}
                    </div>
                    <div className="w-full max-w-[26px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100">
                      {unH > 0 && <div style={{ height: `${unH}px` }} className="bg-rose-400 w-full" />}
                      {ansH > 0 && <div style={{ height: `${ansH}px` }} className="bg-emerald-500 w-full" />}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1.5 -rotate-45 origin-top-left whitespace-nowrap">
                      {d.date.slice(5)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Hourly Heatmap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Peak Hour &amp; Missed-Call Heatmap (IST)</h2>
              <p className="text-xs text-slate-500">Hourly distribution (00:00–23:00) to spot staffing gaps</p>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {hourlyHeatmap.map(h => {
              const ratio = h.total / maxHourly
              const hasMissedSpike = h.missed > 0 && h.missed >= h.answered
              const bgClass =
                h.total === 0
                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                  : hasMissedSpike
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : ratio > 0.65
                      ? 'bg-blue-600 border-blue-700 text-white'
                      : ratio > 0.3
                        ? 'bg-blue-100 border-blue-300 text-blue-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
              return (
                <div
                  key={h.hour}
                  title={`${h.label} IST — Total: ${h.total}, Answered: ${h.answered}, Missed: ${h.missed}`}
                  className={`rounded-xl border p-2 text-center ${bgClass}`}
                >
                  <div className="text-[10px] font-bold opacity-80">{h.label.slice(0, 2)}h</div>
                  <div className="text-sm font-black mt-0.5">{h.total}</div>
                  {h.missed > 0 && (
                    <div className="text-[9px] font-bold mt-0.5">
                      {h.missed} miss
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 72-Hour Permission Funnel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Outbound Call Permission Funnel &amp; 72-Hour Free Window Utilization
            </h2>
            <p className="text-xs text-slate-500">
              Tracks Meta call permission conversion and how effectively active 72h windows are dialed.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start">
            Acceptance Rate: {permissions.acceptanceRate ?? 0}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Requests Sent', val: permissions.requestsSent ?? 0, sub: `${permissions.totalContacts ?? 0} contacts` },
            { label: 'Accepted', val: permissions.accepted ?? 0, sub: `${permissions.permanentGrants ?? 0} permanent` },
            { label: 'Rejected', val: permissions.rejected ?? 0, sub: `${permissions.pending ?? 0} pending` },
            { label: 'Active 72h Windows', val: permissions.active72hWindows ?? 0, sub: `${permissions.expiringSoon24h ?? 0} expiring <24h` },
            { label: 'Utilized Windows', val: permissions.utilizedActive72hWindows ?? 0, sub: `${permissions.utilizationRate ?? 0}% dialed` },
            { label: 'Unused Active', val: permissions.unusedActive72hWindows ?? 0, sub: `${permissions.expired72hWindows ?? 0} expired` },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</div>
              <div className="text-xl font-black text-slate-900 mt-1">{card.val}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Telecaller Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-900">Telecaller Leaderboard &amp; Compliance</h2>
          <p className="text-xs text-slate-500">Outbound pickup rate, inbound handling, talk time, and recording coverage.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3">Telecaller</th>
                <th className="px-4 py-3 text-right">Assigned Leads</th>
                <th className="px-4 py-3 text-right">Total Calls</th>
                <th className="px-4 py-3 text-right">Outbound (Pickup %)</th>
                <th className="px-4 py-3 text-right">Inbound (Ans / Miss)</th>
                <th className="px-4 py-3 text-right">Total Talk</th>
                <th className="px-4 py-3 text-right">Avg Handle</th>
                <th className="px-4 py-3 text-right">Recording %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No telecaller call activity found for the selected filters.
                  </td>
                </tr>
              ) : (
                leaderboard.map(row => (
                  <tr key={row.telecallerId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {row.displayName}{' '}
                      {row.telecallerId !== 'unassigned' && (
                        <span className="text-[11px] font-normal text-slate-400">@{row.telecallerId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{row.assignedLeads}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{row.totalCalls}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.outboundAttempts}{' '}
                      <span className="text-[11px] font-bold text-emerald-600">({row.outboundPickupRate}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.inboundAnswered} / <span className="text-rose-600 font-bold">{row.inboundMissed}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {fmtDuration(row.totalTalkSec)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtDuration(row.avgHandleSec)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{row.recordingCoverage}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Locality & Campaign Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-900">Locality Attribution (Top Districts)</h2>
            <p className="text-xs text-slate-500">Matched from CRM leads by phone number.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5">District / State</th>
                  <th className="px-4 py-2.5 text-right">Calls</th>
                  <th className="px-4 py-2.5 text-right">Answered</th>
                  <th className="px-4 py-2.5 text-right">Missed</th>
                  <th className="px-4 py-2.5 text-right">Converted Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {locality.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No district data available.
                    </td>
                  </tr>
                ) : (
                  locality.map((l, idx) => (
                    <tr key={`${l.district}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">
                        {l.district}
                        {l.state ? <span className="text-slate-400 font-normal">, {l.state}</span> : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{l.totalCalls}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">{l.answeredCalls}</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 font-semibold">{l.missedCalls}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700 font-bold">
                        {l.convertedLeads} / {l.uniqueLeads}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900">Lead Source Attribution &amp; End Reasons</h2>
              <p className="text-xs text-slate-500">Call volume by acquisition channel and termination cause.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-4 py-2.5">Source</th>
                    <th className="px-4 py-2.5 text-right">Calls</th>
                    <th className="px-4 py-2.5 text-right">Answer %</th>
                    <th className="px-4 py-2.5 text-right">Talk Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No source attribution data available.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map(c => (
                      <tr key={c.source} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          {SOURCE_LABELS[c.source] || c.source}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{c.totalCalls}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{c.answerRate}%</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtDuration(c.totalTalkSec)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {endReasons.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/60">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Termination Reasons
              </div>
              <div className="flex flex-wrap gap-1.5">
                {endReasons.map(e => (
                  <span
                    key={e.reason}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                  >
                    {e.reason}: <span className="font-black text-slate-900">{e.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
