import { useEffect, useState } from 'react'
import { apiJson } from '../config/api.js'

// DEVELOPER MODE · Webhook & Flow Logs (mode="logs") and Flow Deploy (mode="flow")
export default function AdminDevTools({ mode = 'logs' }) {
  const [status, setStatus] = useState(null)
  const [events, setEvents] = useState([])
  const [kind, setKind] = useState('')
  const [live, setLive] = useState([])
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState('')
  const [error, setError] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [selected, setSelected] = useState(null)

  const loadStatus = async () => {
    try {
      const d = await apiJson('/api/dev/status')
      setStatus(d.status)
      if (!endpoint) setEndpoint(d.status.flow.endpoint || '')
    } catch (e) {
      setError(e.message)
    }
  }
  const loadEvents = async () => {
    try {
      const d = await apiJson(`/api/dev/events?limit=100&kind=${encodeURIComponent(kind)}`)
      setEvents(d.items || [])
      setLive(d.live || [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])
  useEffect(() => {
    if (mode !== 'logs') return
    loadEvents()
    const t = setInterval(loadEvents, 5000)
    return () => clearInterval(t)
  }, [mode, kind])

  const run = async (name, path, body) => {
    setRunning(name)
    setError('')
    setOutput(`Running ${name}…\n`)
    try {
      const d = await apiJson(path, { method: 'POST', body: JSON.stringify(body || {}) })
      setOutput(d.output || JSON.stringify(d, null, 2))
      loadStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning('')
    }
  }

  const KINDS = ['', 'whatsapp_inbound', 'flow', 'template_status', 'facebook_lead']

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Developer Mode</span>
        <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">{mode === 'flow' ? 'Flow Deploy & Status' : 'Webhook & Flow Logs'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'flow'
            ? 'Validate and publish the WhatsApp registration flow on Meta, sync the public key, and run the end-to-end test — the same scripts as the terminal, from here.'
            : 'Every inbound WhatsApp message, flow step, template status change and Facebook lead the backend received (kept 7 days).'}
        </p>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {status && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Database" value={`${status.database.members} members · ${status.database.leads.toLocaleString('en-IN')} leads`} sub={status.database.url} />
          <Tile label="Messages stored" value={status.database.messages.toLocaleString('en-IN')} sub={`${status.database.templates} templates · ${status.database.admins} admins`} />
          <Tile label="Active flow" value={status.flow.id || 'not set'} sub={status.flow.endpoint || 'no endpoint'} />
          <Tile label="Providers" value={Object.entries(status.providers).map(([k, v]) => `${k}: ${v}`).join(' · ')} sub={`uptime ${Math.round(status.uptimeSeconds / 60)} min · node ${status.node}`} />
        </div>
      )}

      {mode === 'flow' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs font-bold text-slate-600 w-full sm:flex-1 sm:min-w-[260px]">
              Flow endpoint URL (ngrok locally, isydci.com in production)
              <input value={endpoint} onChange={e => setEndpoint(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500 outline-none" />
            </label>
            <button disabled={!!running} onClick={() => run('status check', '/api/dev/flow/status')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50">Status report</button>
            <button disabled={!!running} onClick={() => run('validation', '/api/dev/flow/validate')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50">Validate with Meta</button>
            <button disabled={!!running} onClick={() => run('end-to-end test', '/api/dev/flow/test')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50">Run local E2E test</button>
            <button
              disabled={!!running}
              onClick={() => window.confirm('Publish a NEW flow version on Meta and switch the bot to it?') && run('deploy', '/api/dev/flow/deploy', { endpoint })}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {running === 'deploy' ? 'Publishing…' : 'Publish new flow version'}
            </button>
          </div>
          <pre className="bg-[#0c1427] text-emerald-200 text-[11px] leading-relaxed rounded-xl p-4 overflow-auto max-h-[480px] whitespace-pre-wrap font-mono">{output || 'Output appears here.'}</pre>
        </div>
      )}

      {mode === 'logs' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden lg:col-span-3">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
              {KINDS.map(k => (
                <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer whitespace-nowrap ${kind === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {k || 'All'}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400 whitespace-nowrap pl-2">auto-refresh 5s</span>
            </div>
            <div className="max-h-[600px] overflow-auto divide-y divide-slate-100">
              {events.length === 0 && <div className="py-10 text-center text-slate-400 text-sm">No events yet.</div>}
              {events.map(ev => (
                <button key={ev.id} onClick={() => setSelected(ev)} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 cursor-pointer ${selected?.id === ev.id ? 'bg-blue-50/60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ev.kind === 'flow' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ev.kind === 'template_status' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{ev.kind}</span>
                    <span className="text-sm text-slate-800 truncate">{ev.summary}</span>
                    <span className="ml-auto text-[11px] text-slate-400 font-mono shrink-0">{new Date(ev.createdAt).toLocaleTimeString('en-IN')}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 lg:col-span-2">
            <h3 className="font-bold text-slate-900 text-sm mb-2">{selected ? `Payload · ${selected.summary}` : 'Select an event to see its payload'}</h3>
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] overflow-auto max-h-[560px] font-mono whitespace-pre-wrap">{selected ? JSON.stringify(selected.payload, null, 2) : live.length ? `Live (last ${live.length}):\n` + live.map(l => `${new Date(l.createdAt).toLocaleTimeString('en-IN')}  ${l.kind}  ${l.summary}`).join('\n') : ''}</pre>
          </div>
        </div>
      )}

      {status && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <h3 className="font-bold text-slate-900 mb-3">Environment (backend/.env)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {status.env.map(e => (
              <div key={e.key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                <span className="font-mono text-slate-600 truncate">{e.key}</span>
                <span className={`font-mono truncate max-w-[55%] ${e.set ? 'text-slate-800' : 'text-rose-500 font-bold'}`}>{e.set ? e.value || '✓' : 'missing'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-black text-slate-900 mt-1 truncate" title={value}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={sub}>{sub}</div>
    </div>
  )
}
