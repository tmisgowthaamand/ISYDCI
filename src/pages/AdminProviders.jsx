import { useEffect, useState } from 'react'
import { apiJson } from '../config/api.js'

const PURPOSE_LABEL = { flow: 'Registration bot (flow)', transactional: 'Replies & cards', marketing: 'Templates & broadcasts' }

// DEVELOPER MODE · Providers — Meta / WATI / WACTO credentials and which one is active per purpose
export default function AdminProviders() {
  const [providers, setProviders] = useState([])
  const [purposes, setPurposes] = useState([])
  const [active, setActive] = useState({})
  const [edits, setEdits] = useState({})
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    try {
      const d = await apiJson('/api/dev/providers')
      setProviders(d.providers || [])
      setPurposes(d.purposes || [])
      setActive(d.active || {})
      const e = {}
      for (const p of d.providers || []) e[p.key] = { enabled: p.enabled !== false, activeFor: p.activeFor || [], config: { ...(p.config || {}) } }
      setEdits(e)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const save = async key => {
    setBusy(key)
    setError('')
    setMsg('')
    try {
      const d = await apiJson(`/api/dev/providers/${key}`, { method: 'PUT', body: JSON.stringify(edits[key]) })
      setActive(d.active || {})
      setMsg(`${key.toUpperCase()} saved.`)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const test = async key => {
    setBusy(key + ':test')
    setError('')
    setMsg('')
    try {
      const d = await apiJson(`/api/dev/providers/${key}/test`, { method: 'POST' })
      setMsg(`${key.toUpperCase()} test: ${d.result}`)
    } catch (e) {
      setError(`${key.toUpperCase()} test failed: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  const togglePurpose = (key, purpose) => {
    setEdits(prev => {
      const cur = prev[key].activeFor || []
      const next = cur.includes(purpose) ? cur.filter(p => p !== purpose) : [...cur, purpose]
      return { ...prev, [key]: { ...prev[key], activeFor: next } }
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Developer Mode</span>
        <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">Messaging Providers</h1>
        <p className="text-sm text-slate-500 mt-1">One send interface, three providers. Pick which provider handles each purpose; a purpose can be active on only one provider at a time.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {purposes.map(p => (
          <div key={p} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{PURPOSE_LABEL[p] || p}</div>
            <div className="text-xl font-black text-slate-900 mt-1 uppercase">{active[p] || 'meta'}</div>
          </div>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">{msg}</div>}

      <div className="space-y-5">
        {providers.map(p => {
          const e = edits[p.key] || { enabled: true, activeFor: [], config: {} }
          return (
            <div key={p.key} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">{p.definition.label}</h2>
                  <p className="text-xs text-slate-500">{p.definition.notes}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={e.enabled} onChange={ev => setEdits({ ...edits, [p.key]: { ...e, enabled: ev.target.checked } })} className="w-4 h-4" />
                  Enabled
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {p.definition.fields.map(f => (
                  <label key={f.key} className="block text-xs font-bold text-slate-600">
                    {f.label}
                    <input
                      type={f.secret ? 'password' : 'text'}
                      value={e.config[f.key] ?? ''}
                      placeholder={f.default || (f.secret ? '••••••••' : '')}
                      onChange={ev => setEdits({ ...edits, [p.key]: { ...e, config: { ...e.config, [f.key]: ev.target.value } } })}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500 outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 mr-1">Active for:</span>
                {purposes.map(pur => (
                  <button
                    key={pur}
                    type="button"
                    onClick={() => togglePurpose(p.key, pur)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${e.activeFor.includes(pur) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {PURPOSE_LABEL[pur] || pur}
                  </button>
                ))}
                <div className="w-full sm:w-auto sm:ml-auto flex justify-end gap-2 mt-2 sm:mt-0">
                  <button onClick={() => test(p.key)} disabled={busy === p.key + ':test'} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50">{busy === p.key + ':test' ? 'Testing…' : 'Test connection'}</button>
                  <button onClick={() => save(p.key)} disabled={busy === p.key} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{busy === p.key ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
