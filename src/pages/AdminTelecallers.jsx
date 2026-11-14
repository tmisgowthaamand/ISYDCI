import { useEffect, useState } from 'react'
import { apiJson } from '../config/api.js'

// DEVELOPER MODE ONLY (Super Super Admin) — Telecaller accounts (auto 6-digit passcode),
// Manual vs Round-Robin lead routing, and lead-to-telecaller assignment.
export default function AdminTelecallers() {
  const [telecallers, setTelecallers] = useState([])
  const [routing, setRouting] = useState({ mode: 'manual' })
  const [leads, setLeads] = useState([])
  const [form, setForm] = useState({ displayName: '', username: '', phone: '' })
  const [generatedCreds, setGeneratedCreds] = useState(null) // { username, phone, passcode }
  const [revealedIds, setRevealedIds] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [tcRes, leadsRes] = await Promise.all([
        apiJson('/api/telecallers'),
        apiJson('/api/leads?limit=50'),
      ])
      setTelecallers(tcRes.telecallers || [])
      setRouting(tcRes.routing || { mode: 'manual' })
      setLeads(leadsRes.leads || [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createTelecaller = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    setGeneratedCreds(null)
    try {
      const res = await apiJson('/api/telecallers', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setGeneratedCreds({
        username: res.telecaller.username,
        phone: res.telecaller.phone,
        displayName: res.telecaller.displayName,
        passcode: res.passcode,
      })
      setMsg(`Telecaller "${res.telecaller.displayName}" created with auto-generated 6-digit passcode.`)
      setForm({ displayName: '', username: '', phone: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const resetPasscode = async tc => {
    if (!window.confirm(`Generate a new 6-digit passcode for ${tc.displayName || tc.username}?`)) return
    setError('')
    setMsg('')
    try {
      const res = await apiJson(`/api/telecallers/${tc.id}/reset-passcode`, { method: 'POST' })
      setGeneratedCreds({
        username: res.telecaller.username,
        phone: res.telecaller.phone,
        displayName: res.telecaller.displayName,
        passcode: res.passcode,
      })
      setMsg(`New 6-digit passcode generated for ${tc.username}.`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleActive = async tc => {
    try {
      await apiJson(`/api/telecallers/${tc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: tc.active === false }),
      })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const removeTelecaller = async tc => {
    if (!window.confirm(`Delete telecaller "${tc.username}"? Their assigned leads will become unassigned.`)) return
    try {
      await apiJson(`/api/telecallers/${tc.id}`, { method: 'DELETE' })
      setMsg(`Telecaller "${tc.username}" deleted.`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const updateRoutingMode = async mode => {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const res = await apiJson('/api/telecallers/routing', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      })
      setRouting(res.routing)
      setMsg(`Lead routing switched to ${mode === 'round_robin' ? 'Round-Robin (Auto)' : 'Manual'}.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const distributeUnassigned = async () => {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const res = await apiJson('/api/telecallers/assign', {
        method: 'POST',
        body: JSON.stringify({ distributeUnassigned: true }),
      })
      setMsg(`Auto-assigned ${res.assignedCount} unassigned lead(s) across active telecallers (Round-Robin).`)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const assignSingleLead = async (phone, telecaller) => {
    setError('')
    try {
      await apiJson('/api/telecallers/assign', {
        method: 'POST',
        body: JSON.stringify({ phone, telecaller: telecaller || null }),
      })
      setMsg(`Lead +${phone} ${telecaller ? `assigned to ${telecaller}` : 'unassigned'}.`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const copyCreds = () => {
    if (!generatedCreds) return
    const text = `Telecaller Login\nURL: ${window.location.origin}/admin/login\nUsername: ${generatedCreds.username}${generatedCreds.phone ? `\nPhone: +${generatedCreds.phone}` : ''}\n6-Digit Passcode: ${generatedCreds.passcode}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            Super Super Admin Only
          </span>
          <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">Telecallers & Lead Routing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add telecallers with auto-generated 6-digit passcodes, configure Manual or Round-Robin routing, and assign leads. Super Admins can view assignments only.
          </p>
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">{msg}</div>}

      {/* One-time 6-digit passcode banner */}
      {generatedCreds && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-amber-400/50 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              One-Time Telecaller Security Passcode (Save Now)
            </div>
            <div className="text-sm">
              <span className="text-slate-400">Telecaller:</span> <b>{generatedCreds.displayName}</b> ·{' '}
              <span className="text-slate-400">Username:</span> <code className="font-mono text-emerald-300">{generatedCreds.username}</code>
              {generatedCreds.phone && (
                <> · <span className="text-slate-400">Phone:</span> <code className="font-mono text-emerald-300">+{generatedCreds.phone}</code></>
              )}
            </div>
            <div className="text-lg font-mono font-black tracking-[0.25em] text-amber-300 pt-1">
              PASSCODE: {generatedCreds.passcode}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyCreds}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
            >
              {copied ? '✓ Copied' : '📋 Copy Login Details'}
            </button>
            <button
              type="button"
              onClick={() => setGeneratedCreds(null)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Routing Mode Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900">Lead & Call Routing Mode</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            <b>Manual:</b> New leads wait unassigned until you assign them. <b>Round-Robin:</b> New leads auto-rotate across active telecallers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { id: 'manual', label: 'Manual Routing' },
              { id: 'round_robin', label: 'Round-Robin (Auto)' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => updateRoutingMode(m.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  routing.mode === m.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={distributeUnassigned}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            ↻ Auto-Assign Unassigned Leads
          </button>
        </div>
      </div>

      {/* Add Telecaller + Telecallers Table */}
      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={createTelecaller} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-3 lg:col-span-1">
          <h2 className="font-bold text-slate-900">Add Telecaller</h2>
          <p className="text-xs text-slate-500">A secure 6-digit login passcode will be auto-generated.</p>
          <label className="block text-xs font-bold text-slate-600">
            Full Name
            <input
              required
              value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. Priya Sharma"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Phone Number (for login)
            <input
              required
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. 9876543210"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Username (optional, auto-generated from phone if blank)
            <input
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. priya"
            />
          </label>
          <button
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create Telecaller & Generate 6-Digit Code'}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Telecaller</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">6-Digit Code</th>
                  <th className="py-3 px-4">Assigned Leads</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {telecallers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      No telecallers added yet.
                    </td>
                  </tr>
                ) : (
                  telecallers.map(tc => {
                    const isShown = Boolean(revealedIds[tc.id])
                    return (
                    <tr key={tc.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{tc.displayName || tc.username}</div>
                        <div className="text-xs font-mono text-slate-400">@{tc.username}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {tc.phone ? `+${tc.phone}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {tc.passcode ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
                            <span className="font-mono text-xs font-black tracking-widest text-slate-900">
                              {isShown ? tc.passcode : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRevealedIds(prev => ({ ...prev, [tc.id]: !prev[tc.id] }))}
                              className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                              title={isShown ? 'Hide passcode' : 'Show passcode'}
                            >
                              {isShown ? '🙈' : '👁'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(tc.passcode)
                                setCopiedId(tc.id)
                                setTimeout(() => setCopiedId(null), 1500)
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                              title="Copy 6-digit code"
                            >
                              {copiedId === tc.id ? '✓' : '📋'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => resetPasscode(tc)}
                            className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100 cursor-pointer"
                          >
                            Generate Code
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                          {tc.assignedLeadCount || 0} leads
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {tc.lastLoginAt ? new Date(tc.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => resetPasscode(tc)}
                          className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          New 6-Digit Code
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(tc)}
                          className={`text-xs font-bold cursor-pointer ${tc.active === false ? 'text-emerald-600' : 'text-amber-600'} hover:underline`}
                        >
                          {tc.active === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTelecaller(tc)}
                          className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lead Assignment Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Manual Lead Assignment</h2>
          <span className="text-xs text-slate-500">Showing latest {leads.length} leads</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Lead</th>
                <th className="py-2.5 px-4">Phone</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Assigned Telecaller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map(l => (
                <tr key={l.phone} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-bold text-slate-900 text-xs">{l.name || l.whatsappName || 'Unknown'}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">+{l.phone}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-600">{l.statusLabel || l.status}</td>
                  <td className="py-2.5 px-4">
                    <select
                      value={l.assignedTo || ''}
                      onChange={e => assignSingleLead(l.phone, e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                    >
                      <option value="">Unassigned</option>
                      {telecallers.filter(t => t.active !== false).map(t => (
                        <option key={t.id} value={t.username}>
                          {t.displayName || t.username} (@{t.username})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
