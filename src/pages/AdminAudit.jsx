import { useEffect, useState } from 'react'
import { apiJson } from '../config/api.js'

// DEVELOPER MODE · Audit Log — who did what, when (logins + every change made through the panel)
export default function AdminAudit() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 50

  const load = async (p = page, query = q) => {
    try {
      setLoading(true)
      setError('')
      const d = await apiJson(`/api/dev/audit?page=${p}&limit=${limit}&q=${encodeURIComponent(query)}`)
      setItems(d.items || [])
      setTotal(d.total || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page, q)
  }, [page])

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Developer Mode</span>
          <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Every login and every change made by an admin, with time and IP. {total.toLocaleString('en-IN')} entries.</p>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault()
            setPage(1)
            load(1, q)
          }}
          className="w-full sm:w-auto flex items-center gap-2"
        >
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search action, target…" className="flex-1 sm:w-56 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:border-blue-500 outline-none" />
          <button className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer shrink-0">Search</button>
        </form>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">When</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">No entries yet.</td></tr>
              ) : (
                items.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">{new Date(i.createdAt).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{i.actor}</span>
                      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${i.role === 'super_super_admin' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{i.role === 'super_super_admin' ? 'DEV' : i.role === 'super_admin' ? 'ADMIN' : '-'}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">{i.action}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 max-w-[280px] truncate" title={i.target}>{i.target || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-400 font-mono">{i.ip || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
