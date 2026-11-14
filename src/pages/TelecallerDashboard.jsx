import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL, apiJson, getAuthToken } from '../config/api.js'

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TelecallerDashboard() {
  const [stats, setStats] = useState(null)
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [error, setError] = useState('')
  const authUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('isydci_admin_auth') || '{}')
    } catch {
      return {}
    }
  })()

  const load = async () => {
    try {
      const [sRes, lRes, cRes] = await Promise.all([
        apiJson('/api/leads/stats?fresh=1'),
        apiJson('/api/leads?limit=25'),
        apiJson('/api/calls?limit=30'),
      ])
      setStats(sRes.stats || null)
      setLeads(lRes.leads || [])
      setCalls(cRes.calls || [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const answeredCalls = calls.filter(c => Boolean(c.attended ?? c.answeredAt))
  const recordedCalls = calls.filter(c => (c.recording_status || (c.recordingUrl ? 'ready' : 'none')) === 'ready')
  const authToken = getAuthToken()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            Telecaller Desk
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1.5 font-['Montserrat']">
            Welcome, {authUser.displayName || authUser.username || 'Telecaller'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your assigned leads, live WhatsApp inbox, and attended call recordings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/inbox"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs"
          >
            💬 Open Live Inbox
          </Link>
          <Link
            to="/admin/leads"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-extrabold"
          >
            📋 My Leads
          </Link>
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Assigned Leads', value: stats?.total ?? leads.length, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Unread Chats', value: stats?.unread ?? 0, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Attended Calls', value: answeredCalls.length, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Ready Recordings', value: recordedCalls.length, tone: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k.label}</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{k.value}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${k.tone}`}>Live</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Assigned Leads */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">My Assigned Leads</h2>
            <Link to="/admin/leads" className="text-xs font-bold text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {leads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No leads assigned to you yet.</div>
            ) : (
              leads.map(l => (
                <div key={l.phone} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">
                      {l.name || l.whatsappName || `+${l.phone}`}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">+{l.phone} · {l.statusLabel || l.status}</div>
                  </div>
                  <Link
                    to={`/admin/inbox?phone=${encodeURIComponent(l.phone)}`}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold shrink-0"
                  >
                    Chat & Call
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Call Records & Recordings */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">My Recent Call Recordings</h2>
            <span className="text-xs text-slate-400">{calls.length} calls</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto p-3 space-y-2">
            {calls.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No calls recorded yet.</div>
            ) : (
              calls.map(c => {
                const isInbound = (c.call_direction || c.direction) === 'inbound'
                const isAttended = Boolean(c.attended ?? c.answeredAt)
                const recStatus = c.recording_status || (c.recordingUrl ? 'ready' : 'none')
                const dur = c.duration_seconds ?? c.durationSec ?? 0
                const streamUrl = `${API_BASE_URL}/api/calls/${encodeURIComponent(c.callId)}/recording?token=${encodeURIComponent(authToken)}`
                const ext = String(c.recordingMimeType || '').includes('ogg') ? 'ogg' : 'webm'
                return (
                  <div key={c.callId} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isInbound ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {isInbound ? '↙ Inbound' : '↗ Outbound'}
                        </span>
                        <span className="font-mono font-bold text-slate-800">+{c.waId}</span>
                      </div>
                      <span className="font-mono text-slate-500">{formatDuration(dur)}</span>
                    </div>
                    {isAttended && recStatus === 'ready' && (
                      <div className="space-y-1 pt-1">
                        <audio controls preload="none" src={streamUrl} className="w-full h-8" />
                        <div className="flex justify-end">
                          <a
                            href={streamUrl}
                            download={`isydci-call-${c.waId}-${c.callId.slice(-8)}.${ext}`}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            ⬇ Download Recording
                          </a>
                        </div>
                      </div>
                    )}
                    {isAttended && recStatus === 'pending' && (
                      <div className="text-[10px] text-amber-600 italic">Processing recording...</div>
                    )}
                    {!isAttended && (
                      <div className="text-[10px] text-slate-400">Unanswered</div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
