import { useEffect, useState } from 'react'
import { apiJson } from '../config/api.js'

// DEVELOPER MODE · Admin Accounts — create Super Admins / Developers without touching .env
export default function AdminUsers() {
  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState({})
  const [form, setForm] = useState({ username: '', password: '', role: 'super_admin', displayName: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const d = await apiJson('/api/auth/admins')
      setAdmins(d.admins || [])
      setRoles(d.roles || {})
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const create = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await apiJson('/api/auth/admins', { method: 'POST', body: JSON.stringify(form) })
      setMsg(`Account "${form.username}" created as ${roles[form.role] || form.role}.`)
      setForm({ username: '', password: '', role: 'super_admin', displayName: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async a => {
    try {
      await apiJson(`/api/auth/admins/${a.id}`, { method: 'PATCH', body: JSON.stringify({ active: a.active === false }) })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const resetPassword = async a => {
    const password = window.prompt(`New password for ${a.username} (min 8 characters):`)
    if (!password) return
    try {
      await apiJson(`/api/auth/admins/${a.id}`, { method: 'PATCH', body: JSON.stringify({ password }) })
      setMsg(`Password updated for ${a.username}.`)
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async a => {
    if (!window.confirm(`Delete admin account "${a.username}"? This cannot be undone.`)) return
    try {
      await apiJson(`/api/auth/admins/${a.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Developer Mode</span>
        <h1 className="text-3xl font-black text-slate-900 mt-2 font-['Montserrat']">Admin Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">Both roles sign in at <span className="font-mono">/admin/login</span>. The two accounts marked <b>.env</b> are managed from backend/.env; everything else is managed here.</p>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">{msg}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={create} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-3 lg:col-span-1">
          <h2 className="font-bold text-slate-900">Create account</h2>
          <label className="block text-xs font-bold text-slate-600">Username
            <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none" placeholder="e.g. staff_priya" />
          </label>
          <label className="block text-xs font-bold text-slate-600">Display name
            <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none" placeholder="Priya (Secretariat)" />
          </label>
          <label className="block text-xs font-bold text-slate-600">Password
            <input required type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none" placeholder="min 8 characters" />
          </label>
          <label className="block text-xs font-bold text-slate-600">Role
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:border-blue-500 outline-none">
              <option value="super_admin">Super Admin</option>
              <option value="super_super_admin">Super Super Admin (Developer)</option>
            </select>
          </label>
          <button disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Last login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {admins.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{a.displayName || a.username}</div>
                      <div className="text-xs text-slate-500 font-mono">{a.username}{a.seeded ? <span className="ml-2 text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">.env</span> : null}{a.active === false ? <span className="ml-2 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded">DISABLED</span> : null}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${a.role === 'super_super_admin' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{a.roleLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-IN') : 'never'}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {!a.seeded && (
                        <>
                          <button onClick={() => resetPassword(a)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-xs font-bold cursor-pointer mr-1.5">Reset password</button>
                          <button onClick={() => toggleActive(a)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 text-xs font-bold cursor-pointer mr-1.5">{a.active === false ? 'Enable' : 'Disable'}</button>
                          <button onClick={() => remove(a)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold cursor-pointer">Delete</button>
                        </>
                      )}
                      {a.seeded && <span className="text-xs text-slate-400">change in backend/.env</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
