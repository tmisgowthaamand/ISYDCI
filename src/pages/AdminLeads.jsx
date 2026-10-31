import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson, apiFetch } from '../config/api.js'

export const STATUS_STYLE = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  contacted: 'bg-sky-50 text-sky-700 border-sky-200',
  registration_started: 'bg-amber-50 text-amber-800 border-amber-200',
  incomplete: 'bg-rose-50 text-rose-700 border-rose-200',
  registered: 'bg-blue-50 text-blue-700 border-blue-200',
  card_issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  lost: 'bg-slate-100 text-slate-400 border-slate-200',
}
export const SOURCE_LABEL = {
  whatsapp: '💬 WhatsApp',
  ctwa_ad: '📣 Click-to-WhatsApp ad',
  facebook_lead_ad: '📘 Facebook Lead Ad',
  web: '🌐 Website',
  whatsapp_flow: '📱 WhatsApp Flow',
  simulator: '🧪 Simulator',
  import: '📥 Import',
  manual: '✍️ Manual',
}

export function StatusBadge({ status, label }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE.new}`}>{label || status}</span>
}

const fmt = d => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

// CRM · Leads (preset="all") and Incomplete Registrations (preset="incomplete")
export default function AdminLeads({ preset = 'all' }) {
  const navigate = useNavigate()
  const incompleteMode = preset === 'incomplete'
  const [stats, setStats] = useState(null)
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(incompleteMode ? 'incomplete,registration_started' : '')
  const [source, setSource] = useState('')
  const [labels, setLabels] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newLead, setNewLead] = useState({ phone: '', name: '' })
  const limit = 50

  const load = async (p = page) => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({ page: p, limit, q, status, source })
      const d = await apiJson(`/api/leads?${params}`)
      setLeads(d.leads || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
      setLabels(d.statusLabels || {})
      const s = await apiJson('/api/leads/stats')
      setStats(s.stats)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setStatus(incompleteMode ? 'incomplete,registration_started' : '')
    setPage(1)
  }, [preset])
  useEffect(() => {
    load(page)
  }, [page, status, source, preset])

  const exportCsv = async () => {
    const res = await apiFetch(`/api/leads/export?status=${encodeURIComponent(status)}&source=${encodeURIComponent(source)}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `isydci-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const addLead = async e => {
    e.preventDefault()
    try {
      await apiJson('/api/leads', { method: 'POST', body: JSON.stringify(newLead) })
      setNewLead({ phone: '', name: '' })
      load(1)
    } catch (err) {
      setError(err.message)
    }
  }

  const chips = incompleteMode
    ? [
        { v: 'incomplete,registration_started', l: 'All incomplete' },
        { v: 'registration_started', l: 'Still in progress' },
        { v: 'incomplete', l: 'Stalled (24h+)' },
      ]
    : [{ v: '', l: 'All' }, ...Object.entries(labels).map(([v, l]) => ({ v, l }))]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">CRM</span>
          <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">{incompleteMode ? 'Incomplete Registrations' : 'Leads'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {incompleteMode
              ? 'Athletes who started registering on WhatsApp or the website but did not finish. Shows exactly where each one stopped.'
              : `Every contact from WhatsApp, ads, Facebook Lead Ads and the website. ${total.toLocaleString('en-IN')} matching leads.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(page)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 cursor-pointer">Refresh</button>
          <button onClick={exportCsv} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer">Export CSV</button>
        </div>
      </div>

      {stats && !incompleteMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(stats.status).map(([k, n]) => (
            <button key={k} onClick={() => { setStatus(k); setPage(1) }} className={`text-left bg-white rounded-2xl border shadow-xs p-3 cursor-pointer hover:border-blue-300 ${status === k ? 'border-blue-500' : 'border-slate-200/90'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{stats.labels[k]}</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{n.toLocaleString('en-IN')}</div>
            </button>
          ))}
        </div>
      )}
      {stats && incompleteMode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile label="In progress" value={stats.status.registration_started} />
          <Tile label="Stalled 24h+" value={stats.status.incomplete} />
          <Tile label="Completed" value={(stats.status.registered || 0) + (stats.status.card_issued || 0)} />
        </div>
      )}

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-wrap items-center gap-2">
        {chips.map(c => (
          <button key={c.v} onClick={() => { setStatus(c.v); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${status === c.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{c.l}</button>
        ))}
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white">
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <form onSubmit={e => { e.preventDefault(); setPage(1); load(1) }} className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 mt-2 sm:mt-0">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, ID…" className="flex-1 sm:w-56 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:border-blue-500 outline-none" />
          <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold cursor-pointer shrink-0">Search</button>
        </form>
      </div>

      {!incompleteMode && (
        <form onSubmit={addLead} className="flex flex-wrap items-center gap-2 text-sm bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 w-full sm:w-auto">Add lead manually:</span>
          <input required value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} placeholder="Mobile number" className="flex-1 min-w-[120px] sm:w-40 px-3 py-1.5 rounded-lg border border-slate-200 text-sm" />
          <input value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} placeholder="Name (optional)" className="flex-1 min-w-[120px] sm:w-44 px-3 py-1.5 rounded-lg border border-slate-200 text-sm" />
          <button className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0">Add</button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">{incompleteMode ? 'Stopped at' : 'Source'}</th>
                <th className="py-3 px-4">{incompleteMode ? 'Draft details' : 'Campaign'}</th>
                <th className="py-3 px-4">Assigned</th>
                <th className="py-3 px-4">Last activity</th>
                <th className="py-3 px-4">First contact</th>
                <th className="py-3 px-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">No leads match.</td></tr>
              ) : (
                leads.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => {
                      if (l.memberId) {
                        navigate(`/admin/members?id=${encodeURIComponent(l.memberId)}`)
                      } else {
                        navigate(`/admin/inbox?phone=${l.phone}`)
                      }
                    }}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        {l.unread && <span className="w-2 h-2 rounded-full bg-blue-500" title="Unread" />}
                        {l.name || l.whatsappName || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        +{l.phone}
                        {l.memberId && <span className="ml-1 text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">🆔 {l.memberId}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={l.status} label={l.statusLabel} /></td>
                    <td className="py-3 px-4 text-xs">
                      {incompleteMode ? (
                        <div className="space-y-1">
                          <span className="font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 block w-fit">
                            {l.flowStepLabel || l.flowStep || '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {SOURCE_LABEL[l.source] || l.source}
                          </span>
                        </div>
                      ) : (
                        <span>{SOURCE_LABEL[l.source] || l.source}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[280px]">
                      {incompleteMode ? (
                        <div>
                          {l.memberId ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                              <span>✅ Registered Athlete</span>
                              <span className="font-mono">({l.memberId})</span>
                            </span>
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-800">
                                {[l.state, l.district].filter(Boolean).join(' · ') || (l.whatsappName ? `WhatsApp: ${l.whatsappName}` : 'Location missing')}
                              </div>
                              {l.draft && (
                                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-1">
                                  {l.draft.dob ? <span className="bg-slate-100 px-1.5 py-0.5 rounded">DOB: {l.draft.dob_display || l.draft.dob}</span> : <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">DOB skipped</span>}
                                  {l.draft.blood_group ? <span className="bg-slate-100 px-1.5 py-0.5 rounded">Blood: {l.draft.blood_group}</span> : null}
                                  {!l.draft.hasPhoto && !l.draft.photo_url ? <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium">📷 Photo missing</span> : <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">📷 Photo uploaded</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        l.campaign?.headline ? `${l.campaign.headline} (${l.campaign.adId})` : l.leadAd?.formId ? `Form ${l.leadAd.formId}` : '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">{l.assignedTo || <span className="text-slate-300">unassigned</span>}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{fmt(l.lastMessageAt || l.updatedAt)}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      {l.memberId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/members?id=${encodeURIComponent(l.memberId)}`)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Open Member Profile & Official Card"
                        >
                          <span>Member Page</span>
                          <span>🪪 →</span>
                        </button>
                      ) : (
                        <span className="text-blue-600 text-xs font-bold hover:underline">Inbox 💬 →</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Page {page} of {pages} · {total.toLocaleString('en-IN')} leads</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-900 mt-1">{(value || 0).toLocaleString('en-IN')}</div>
    </div>
  )
}
