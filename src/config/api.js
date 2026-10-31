// Centralized API configuration reading from frontend .env (VITE_API_URL) with production fallback
export const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : (import.meta.env.PROD ? '' : 'http://localhost:5000')

export const AUTH_STORAGE_KEY = 'isydci_admin_auth'

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAuthToken() {
  return getAuth()?.token || ''
}

export function isDeveloper() {
  return getAuth()?.role === 'super_super_admin'
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {}
}

/**
 * fetch() for admin API calls: adds the login token and sends the user back to the login page
 * when the token is missing, expired or rejected (401).
 */
export async function apiFetch(input, options = {}) {
  const url = typeof input === 'string' && input.startsWith('/') ? `${API_BASE_URL}${input}` : input
  const headers = new Headers(options.headers || {})
  const token = getAuthToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    clearAuth()
    if (!window.location.pathname.startsWith('/admin/login')) window.location.assign('/admin/login')
  }
  return res
}

/** JSON helper: returns the parsed body, throws on non-2xx with the server message. */
export async function apiJson(input, options = {}) {
  const res = await apiFetch(input, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`)
  return data
}

export default { API_BASE_URL, apiFetch, apiJson, getAuth, getAuthToken, isDeveloper, clearAuth }
