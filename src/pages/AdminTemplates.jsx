import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../config/api.js'

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  PAUSED: 'bg-orange-50 text-orange-700 border-orange-200',
  DISABLED: 'bg-slate-200 text-slate-500 border-slate-300',
}

const EMPTY = {
  name: '',
  language: 'en',
  category: 'MARKETING',
  header: { format: 'NONE', text: '', example: [''], mediaDataUri: '', mediaName: '' },
  body: { text: '', examples: [] },
  footer: { text: '' },
  buttons: [],
}

const countVars = s => (String(s || '').match(/\{\{\d+\}\}/g) || []).length

export default function AdminTemplates() {
  const [templates, setTemplates] = useState([])
  const [limits, setLimits] = useState(null)
  const [statusLabels, setStatusLabels] = useState({})
  const [editing, setEditing] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [sendFor, setSendFor] = useState(null)
  const [sendTo, setSendTo] = useState('')
  const [sendSegment, setSendSegment] = useState('')
  const [sendParams, setSendParams] = useState('')
  const [sendLink, setSendLink] = useState('')

  const load = async (withMetaSync = false) => {
    try {
      const [t, l] = await Promise.all([
        apiJson(`/api/templates${withMetaSync ? '?sync=true' : ''}`),
        limits ? Promise.resolve({ limits }) : apiJson('/api/templates/limits'),
      ])
      setTemplates(t.templates || [])
      setStatusLabels(t.statusLabels || {})
      if (l?.limits) setLimits(l.limits)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load(true)
    const id = setInterval(() => load(true), 10000)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Live validation while editing in builder
  useEffect(() => {
    if (!editing) return
    const id = setTimeout(async () => {
      try {
        const d = await apiJson('/api/templates/validate', { method: 'POST', body: JSON.stringify(editing) })
        setErrors(d.errors || [])
      } catch {}
    }, 400)
    return () => clearTimeout(id)
  }, [editing])

  const act = async (label, fn) => {
    setBusy(label)
    setError('')
    setMsg('')
    try {
      const r = await fn()
      if (r) setMsg(r)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const save = () =>
    act('save', async () => {
      if (editingId) await apiJson(`/api/templates/${editingId}`, { method: 'PUT', body: JSON.stringify(editing) })
      else await apiJson('/api/templates', { method: 'POST', body: JSON.stringify(editing) })
      setEditing(null)
      setEditingId(null)
      return 'Template saved as draft.'
    })

  const saveAndSubmit = (direct = true) =>
    act('saveSubmit', async () => {
      let saved
      if (editingId) saved = await apiJson(`/api/templates/${editingId}`, { method: 'PUT', body: JSON.stringify(editing) })
      else saved = await apiJson('/api/templates', { method: 'POST', body: JSON.stringify(editing) })
      const targetId = saved.template?.id || editingId
      if (targetId) {
        const res = await apiJson(`/api/templates/${targetId}/submit?direct=${direct ? 'true' : 'false'}`, {
          method: 'POST',
          body: JSON.stringify({ directApproval: direct }),
        })
        setEditing(null)
        setEditingId(null)
        return `“${res.template?.name || editing.name}” submitted for Meta approval (${res.template?.statusLabel || 'Approved'}).`
      }
      setEditing(null)
      setEditingId(null)
      return 'Template saved.'
    })

  const submit = (t, direct = false) =>
    act(`submit:${t.id}`, async () => {
      const res = await apiJson(`/api/templates/${t.id}/submit?direct=${direct ? 'true' : 'false'}`, {
        method: 'POST',
        body: JSON.stringify({ directApproval: direct }),
      })
      return `“${t.name}” submitted to Meta (${res.template.statusLabel}).`
    })

  const sync = t =>
    act(`sync:${t.id}`, async () => {
      const res = await apiJson(`/api/templates/${t.id}/sync`, { method: 'POST' })
      return `“${t.name}” status refreshed from Meta: ${res.template.statusLabel}.`
    })

  const syncAll = () =>
    act('syncAll', async () => {
      const d = await apiJson('/api/templates/sync-all', { method: 'POST' })
      return `Synced from Meta: ${d.imported} imported, ${d.updated} updated.`
    })

  // Change approval status on demand
  const setTestStatus = (t, status, reason = '') =>
    act(`status:${t.id}`, async () => {
      const d = await apiJson(`/api/templates/${t.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      })
      return `“${t.name}” status updated to ${d.template.statusLabel} (Dev Simulator).`
    })

  const remove = t =>
    window.confirm(`Delete template “${t.name}”${t.metaId ? ' from Meta as well' : ''}?`) &&
    act(`del:${t.id}`, async () => {
      await apiJson(`/api/templates/${t.id}`, { method: 'DELETE' })
      return 'Template deleted.'
    })

  const doSend = () =>
    act('send', async () => {
      const body = {
        params: {
          body: sendParams.split('|').map(s => s.trim()).filter(Boolean),
          header: sendLink ? { link: sendLink } : undefined,
        },
      }
      if (sendTo) body.to = sendTo
      else if (sendSegment) body.segment = { status: sendSegment }
      const d = await apiJson(`/api/templates/${sendFor.id}/send`, { method: 'POST', body: JSON.stringify(body) })
      setSendFor(null)
      return `Successfully sent ${d.sent} message(s)${d.failed?.length ? `, ${d.failed.length} failed` : ''}.`
    })

  const startEdit = t => {
    setEditingId(t?.id || null)
    setEditing(
      t
        ? {
            name: t.name,
            language: t.language,
            category: t.category,
            header: { format: 'NONE', text: '', example: [''], ...t.header },
            body: { text: '', examples: [], ...t.body },
            footer: { text: '', ...t.footer },
            buttons: t.buttons || [],
          }
        : JSON.parse(JSON.stringify(EMPTY))
    )
    setErrors([])
  }

  const openSendModal = tp => {
    setSendFor(tp)
    setSendTo('')
    setSendSegment('')
    // Pre-fill variable placeholders from examples if available
    const initialParams = (tp.body?.examples || []).join(' | ')
    setSendParams(initialParams)
    setSendLink(tp.header?.mediaUrl || '')
  }

  const onMedia = async (file, format) => {
    if (!file) return
    const lim = limits?.media?.[format]
    if (lim && file.size > lim.maxBytes) return setError(`${format} must be under ${Math.round(lim.maxBytes / 1024 / 1024)} MB`)
    const reader = new FileReader()
    reader.onload = () =>
      setEditing(e => ({
        ...e,
        header: { ...e.header, mediaDataUri: reader.result, mediaName: file.name, mediaHandle: '' },
      }))
    reader.readAsDataURL(file)
  }

  const bodyVars = useMemo(() => countVars(editing?.body?.text), [editing?.body?.text])

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      
      {/* ==============================================================
          PAGE HEADER & ACTIONS
          ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              CRM · META TEMPLATES
            </span>
            <span className="text-xs text-slate-400">&bull; WhatsApp Cloud API</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1e3f] mt-1.5 font-['Montserrat']">
            Message Templates
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Build here, submit to Meta for review, and test approval/rejection. Only <b>Approved</b> templates can be dispatched to leads.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncAll}
            disabled={!!busy}
            title="Import/refresh official templates directly from your Meta WhatsApp Business Account"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>{busy === 'syncAll' ? 'Syncing…' : 'Sync from Meta'}</span>
          </button>

          <button
            onClick={() => startEdit(null)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 cursor-pointer"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold px-1">&times;</button>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-semibold">{msg}</span>
          </div>
          <button onClick={() => setMsg('')} className="text-emerald-500 hover:text-emerald-700 font-bold px-1">&times;</button>
        </div>
      )}

      {/* ==============================================================
          TEMPLATES TABLE
          ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Template</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Approval Simulator (Test)</th>
                <th className="py-3.5 px-4">Body Preview</th>
                <th className="py-3.5 px-4 text-center">Sent</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No templates found.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ New Template" to create a template or "Sync from Meta" to import existing templates from your WhatsApp Business Account.</p>
                  </td>
                </tr>
              ) : (
                templates.map(tp => {
                  const isApproved = tp.status === 'APPROVED'
                  const isPending = tp.status === 'PENDING'
                  const isRejected = tp.status === 'REJECTED'
                  const isDraft = tp.status === 'draft'

                  return (
                    <tr key={tp.id} className="hover:bg-slate-50/70 align-top transition-colors">
                      {/* Name & Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono text-xs flex items-center gap-1.5">
                          <span>{tp.name}</span>
                          {tp.metaId ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-sans font-bold" title={`Meta Template ID: ${tp.metaId}`}>
                              ✓ On Meta
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-semibold" title="Not submitted to Meta yet">
                              Local Draft
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {tp.language}
                          {tp.header?.format && tp.header.format !== 'NONE' ? ` · ${tp.header.format} header` : ''}
                          {tp.buttons?.length ? ` · ${tp.buttons.length} button(s)` : ''}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {tp.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${STATUS_STYLE[tp.status] || STATUS_STYLE.draft}`}>
                          {tp.statusLabel || tp.status}
                        </span>
                        {tp.rejectedReason && (
                          <div className="text-[11px] text-rose-600 mt-1 max-w-[200px] leading-tight">
                            ❌ {tp.rejectedReason}
                          </div>
                        )}
                        {tp.validationErrors?.length > 0 && isDraft && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-1">
                            ⚠️ {tp.validationErrors.length} issue(s) to fix
                          </div>
                        )}
                      </td>

                      {/* Simulator Controls: Directly Approve or Reject for Testing */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {!isApproved && (
                            <button
                              onClick={() => setTestStatus(tp, 'APPROVED')}
                              disabled={!!busy}
                              title="Set status to APPROVED to test sending immediately"
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span>✓</span>
                              <span>Approve</span>
                            </button>
                          )}

                          {!isRejected && (
                            <button
                              onClick={() => setTestStatus(tp, 'REJECTED', 'Content policy violation: promotional wording in utility template (Simulated)')}
                              disabled={!!busy}
                              title="Set status to REJECTED to test rejection handling"
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span>✕</span>
                              <span>Reject</span>
                            </button>
                          )}

                          {(isApproved || isRejected) && (
                            <button
                              onClick={() => setTestStatus(tp, 'PENDING')}
                              disabled={!!busy}
                              title="Reset to In Review (PENDING)"
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Body Snippet */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[300px]">
                        <div className="flex items-start gap-2.5">
                          {tp.header?.format === 'IMAGE' && tp.header?.mediaUrl && (
                            <img
                              src={tp.header.mediaUrl}
                              alt={tp.name}
                              className="w-12 h-9 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                            />
                          )}
                          <div className="space-y-1.5 min-w-0">
                            <div className="line-clamp-2 whitespace-pre-wrap leading-relaxed">
                              {tp.body?.text || '—'}
                            </div>
                            {tp.buttons?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tp.buttons.map((b, bi) => (
                                  <span
                                    key={bi}
                                    title={b.url || b.phone_number || b.text}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                                  >
                                    <span>{String(b.type).toUpperCase() === 'URL' ? '↗' : String(b.type).toUpperCase() === 'PHONE_NUMBER' ? '📞' : '↩'}</span>
                                    <span>{b.text || b.type}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sent Count */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {tp.sentCount || 0}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => startEdit(tp)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          Edit
                        </button>

                        {(!tp.metaId || isDraft || isRejected) && (
                          <button
                            onClick={() => submit(tp)}
                            disabled={!!busy}
                            title="Submit template definition to Meta Cloud API"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Submit to Meta
                          </button>
                        )}

                        {tp.metaId && (
                          <button
                            onClick={() => sync(tp)}
                            disabled={!!busy}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Sync status
                          </button>
                        )}

                        {/* SEND BUTTON (Available when status is APPROVED) */}
                        {isApproved && (
                          <button
                            onClick={() => openSendModal(tp)}
                            className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1 active:scale-95"
                          >
                            <span>Send &rarr;</span>
                          </button>
                        )}

                        <button
                          onClick={() => remove(tp)}
                          disabled={!!busy}
                          className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==============================================================
          TEMPLATE BUILDER MODAL
          ============================================================== */}
      {editing && limits && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-y-auto custom-scrollbar">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-2 sm:my-4 grid lg:grid-cols-5 overflow-hidden">
            <div className="lg:col-span-3 p-4 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900 font-['Montserrat']">
                  {editingId ? 'Edit Template' : 'Create New Template'}
                </h2>
                <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700 text-xl cursor-pointer">✕</button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block text-xs font-bold text-slate-600">
                  Name <span className="text-slate-400 font-normal">(lowercase_with_underscores)</span>
                  <input
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                    placeholder="isydci_welcome_offer"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Category
                  <select
                    value={editing.category}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {limits.categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Language
                  <select
                    value={editing.language}
                    onChange={e => setEditing({ ...editing, language: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {limits.languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Header Configuration */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600">Header</span>
                  <select
                    value={editing.header.format}
                    onChange={e => setEditing({ ...editing, header: { ...editing.header, format: e.target.value } })}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    {limits.headerFormats.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                {editing.header.format === 'TEXT' && (
                  <input
                    value={editing.header.text}
                    onChange={e => setEditing({ ...editing, header: { ...editing.header, text: e.target.value } })}
                    placeholder="Header text (max 60 chars)"
                    maxLength={60}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                )}
                {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(editing.header.format) && (
                  <div className="space-y-2 text-xs text-slate-500">
                    <input
                      type="file"
                      accept={editing.header.format === 'IMAGE' ? 'image/jpeg,image/png' : undefined}
                      onChange={e => onMedia(e.target.files[0], editing.header.format)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {editing.header.mediaName && <div className="text-emerald-600 font-bold">Uploaded file: {editing.header.mediaName}</div>}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500">Or paste public {editing.header.format.toLowerCase()} HTTPS URL:</span>
                      <input
                        value={editing.header.mediaUrl || ''}
                        onChange={e => setEditing({ ...editing, header: { ...editing.header, mediaUrl: e.target.value.trim() } })}
                        placeholder="https://res.cloudinary.com/..."
                        className="mt-1 w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Body Configuration */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Body Text <span className="text-slate-400 font-normal">Use {'{{1}}, {{2}}'} for dynamic variables</span>
                </label>
                <textarea
                  value={editing.body.text}
                  onChange={e => setEditing({ ...editing, body: { ...editing.body, text: e.target.value } })}
                  rows={5}
                  placeholder="Hello {{1}}, welcome to ISYDCI! Your athlete ID is {{2}}."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed"
                />
              </div>

              {/* Sample Variables */}
              {bodyVars > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Sample variable values for Meta review ({bodyVars})</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Array.from({ length: bodyVars }, (_, i) => (
                      <input
                        key={i}
                        placeholder={`{{${i + 1}}} sample value`}
                        value={editing.body.examples?.[i] || ''}
                        onChange={e => {
                          const ex = [...(editing.body.examples || [])]
                          ex[i] = e.target.value
                          setEditing({ ...editing, body: { ...editing.body, examples: ex } })
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Footer <span className="text-slate-400 font-normal">(Optional, max 60 chars)</span>
                </label>
                <input
                  value={editing.footer.text}
                  onChange={e => setEditing({ ...editing, footer: { ...editing.footer, text: e.target.value } })}
                  placeholder="ISYDCI Sports Council"
                  maxLength={60}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              {/* Buttons (CTA URL / Quick Reply / Phone) */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    Buttons <span className="text-slate-400 font-normal">(Optional — Visit website URL, Quick Reply, Phone)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          buttons: [...(editing.buttons || []), { type: 'URL', text: 'Visit website', url: 'https://isydci.com/' }],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer"
                    >
                      + Visit Website Button
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          buttons: [...(editing.buttons || []), { type: 'QUICK_REPLY', text: 'Yes, Interested' }],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                    >
                      + Quick Reply
                    </button>
                  </div>
                </div>

                {(editing.buttons || []).map((b, idx) => (
                  <div key={idx} className="grid sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                    <select
                      value={b.type || 'URL'}
                      onChange={e => {
                        const next = [...editing.buttons]
                        next[idx] = { ...next[idx], type: e.target.value }
                        setEditing({ ...editing, buttons: next })
                      }}
                      className="sm:col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-semibold"
                    >
                      <option value="URL">URL (Website)</option>
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="PHONE_NUMBER">Phone Number</option>
                    </select>
                    <input
                      value={b.text || ''}
                      maxLength={25}
                      onChange={e => {
                        const next = [...editing.buttons]
                        next[idx] = { ...next[idx], text: e.target.value }
                        setEditing({ ...editing, buttons: next })
                      }}
                      placeholder="Button label (e.g. Visit website)"
                      className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                    {String(b.type).toUpperCase() === 'URL' && (
                      <input
                        value={b.url || ''}
                        onChange={e => {
                          const next = [...editing.buttons]
                          next[idx] = { ...next[idx], url: e.target.value }
                          setEditing({ ...editing, buttons: next })
                        }}
                        placeholder="https://isydci.com/"
                        className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
                      />
                    )}
                    {String(b.type).toUpperCase() === 'PHONE_NUMBER' && (
                      <input
                        value={b.phone_number || ''}
                        onChange={e => {
                          const next = [...editing.buttons]
                          next[idx] = { ...next[idx], phone_number: e.target.value }
                          setEditing({ ...editing, buttons: next })
                        }}
                        placeholder="+919994627551"
                        className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
                      />
                    )}
                    {String(b.type).toUpperCase() === 'QUICK_REPLY' && <div className="sm:col-span-4 text-[11px] text-slate-400 px-2">Replies directly to chat</div>}
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, buttons: editing.buttons.filter((_, i) => i !== idx) })}
                      className="sm:col-span-1 text-rose-500 hover:text-rose-700 font-bold text-center cursor-pointer"
                      title="Remove button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Validation errors summary */}
              {errors.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                  <div className="font-bold">Please correct before submitting:</div>
                  {errors.map((err, i) => <div key={i}>&bull; {err}</div>)}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Cancel</button>
                <button onClick={save} className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer">Save Draft</button>
                <button
                  onClick={() => saveAndSubmit(false)}
                  disabled={errors.length > 0 || !editing.name || !editing.body?.text}
                  title="Publish to Meta Cloud API and sync real Meta review status (In Review / Approved / Rejected)"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <span>Publish &amp; Sync with Meta</span>
                </button>
                <button
                  onClick={() => saveAndSubmit(true)}
                  disabled={errors.length > 0 || !editing.name || !editing.body?.text}
                  title="Save, upload to Meta, and mark Approved immediately for testing"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <span>✓</span>
                  <span>Direct Meta Approval</span>
                </button>
              </div>
            </div>

            {/* Right: Live Preview Panel */}
            <div className="lg:col-span-2 p-6 bg-slate-50/70 flex flex-col items-center justify-center">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
                WhatsApp Phone Preview (1 Combined Message)
              </div>
              <div className="w-full max-w-xs bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden text-xs">
                <div className="bg-[#075e54] text-white p-3 font-bold text-xs flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">🏢</div>
                  <span>ISYDCI National Council</span>
                </div>
                <div className="p-3.5 bg-[#efeae2]/60 space-y-2">
                  <div className="bg-white rounded-xl overflow-hidden shadow-2xs border border-slate-100">
                    {editing.header.format === 'IMAGE' && (editing.header.mediaDataUri || editing.header.mediaUrl) && (
                      <img
                        src={editing.header.mediaDataUri || editing.header.mediaUrl}
                        alt="Header preview"
                        className="w-full h-36 object-cover border-b border-slate-100"
                      />
                    )}
                    <div className="p-3 space-y-1.5">
                      {editing.header.format === 'TEXT' && editing.header.text && <div className="font-extrabold text-slate-900">{editing.header.text}</div>}
                      <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                        {sub(editing.body.text, editing.body.examples) || 'Your message body will appear here…'}
                      </div>
                      {editing.footer.text && <div className="text-[10px] text-slate-400 pt-1">{editing.footer.text}</div>}
                    </div>
                    {(editing.buttons || []).length > 0 && (
                      <div className="border-t border-slate-100 divide-y divide-slate-100">
                        {editing.buttons.map((b, bi) => (
                          <div key={bi} className="py-2.5 px-3 text-center text-[#00a884] font-bold text-xs flex items-center justify-center gap-1.5 bg-white">
                            <span>{String(b.type).toUpperCase() === 'URL' ? '↗' : String(b.type).toUpperCase() === 'PHONE_NUMBER' ? '📞' : '↩'}</span>
                            <span>{b.text || 'Button'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          SEND TEMPLATE MODAL (TEST DISPATCH)
          ============================================================== */}
      {sendFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 font-sans animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Ready to Dispatch
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  Send “{sendFor.name}”
                </h2>
              </div>
              <button onClick={() => setSendFor(null)} className="text-slate-400 hover:text-slate-700 text-xl cursor-pointer">✕</button>
            </div>

            {/* Recipient Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient Phone Number (with Country Code)
              </label>
              <input
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                placeholder="Enter recipient phone with country code (e.g. 91XXXXXXXXXX)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500 font-medium"
                autoFocus
              />
            </div>

            <div className="text-center text-xs text-slate-400 font-semibold">— or select segment —</div>

            {/* Segment Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dispatch to Lead Segment
              </label>
              <select
                value={sendSegment}
                onChange={e => setSendSegment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
              >
                <option value="">Select target lead status…</option>
                {['new', 'contacted', 'registration_started', 'incomplete', 'registered', 'card_issued'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Header Image URL when template uses IMAGE header */}
            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(sendFor.header?.format || '').toUpperCase()) && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Header {sendFor.header.format} URL <span className="font-normal text-slate-400">(Sent together in 1 message)</span>
                </label>
                <input
                  value={sendLink}
                  onChange={e => setSendLink(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                {sendFor.header.format === 'IMAGE' && sendLink && (
                  <img src={sendLink} alt="Header attachment" className="h-28 w-full object-cover rounded-xl border border-slate-200" />
                )}
              </div>
            )}

            {/* Dynamic Variables Input */}
            {countVars(sendFor.body?.text) > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Variable Values ({countVars(sendFor.body.text)}) <span className="font-normal text-slate-400">— separated with |</span>
                </label>
                <input
                  value={sendParams}
                  onChange={e => setSendParams(e.target.value)}
                  placeholder="Karthik Raja | Salem | ISYDCI-0A12C860"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Example preview: {sub(sendFor.body.text, sendParams.split('|').map(s => s.trim()))}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSendFor(null)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={doSend}
                disabled={busy === 'send' || (!sendTo && !sendSegment)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-40 cursor-pointer"
              >
                {busy === 'send' ? 'Dispatching…' : 'Dispatch Template Now'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function sub(text, examples) {
  return String(text || '').replace(/\{\{(\d+)\}\}/g, (_, n) => (examples && examples[n - 1]) || `{{${n}}}`)
}
