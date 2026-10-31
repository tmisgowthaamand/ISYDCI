// Audit log (who did what, when) + webhook/event log for the developer panel.
import { col } from '../db/mongo.js'

const AUDIT = () => col('audit_logs')
const EVENTS = () => col('webhook_events')

export async function logAudit({ actor, role, action, target = '', details = '', ip = '', method = '', path = '' }) {
  try {
    await AUDIT().insertOne({ actor, role, action, target, details, ip, method, path, createdAt: new Date() })
  } catch (err) {
    console.warn('[Audit] write failed:', err.message)
  }
}

export async function listAudit({ page = 1, limit = 50, actor = '', q = '' } = {}) {
  const filter = {}
  if (actor) filter.actor = actor
  if (q) filter.$or = [{ action: new RegExp(q, 'i') }, { target: new RegExp(q, 'i') }, { details: new RegExp(q, 'i') }]
  const [total, items] = await Promise.all([
    AUDIT().countDocuments(filter),
    AUDIT().find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
  ])
  return { total, page, limit, items: items.map(({ _id, ...r }) => ({ id: String(_id), ...r })) }
}

/** Express middleware: records every successful mutating request made by a logged-in admin. */
export function auditMiddleware(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  res.on('finish', () => {
    if (!req.admin || res.statusCode >= 400) return
    if (req.path.startsWith('/api/flow-log')) return
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const summary = body.name || body.memberId || body.status || body.username || body.key || ''
    logAudit({
      actor: req.admin.username,
      role: req.admin.role,
      action: `${req.method} ${req.originalUrl.split('?')[0]}`,
      target: String(summary).slice(0, 120),
      ip: req.headers['x-forwarded-for'] || req.ip,
      method: req.method,
      path: req.originalUrl,
    })
  })
  next()
}

// ---------------------------------------------------------------- webhook / flow event log
const ring = []
export async function recordEvent(kind, summary, payload = null) {
  const entry = { kind, summary, payload, createdAt: new Date() }
  ring.unshift({ ...entry, createdAt: entry.createdAt.toISOString() })
  if (ring.length > 200) ring.pop()
  try {
    await EVENTS().insertOne(entry)
  } catch (err) {
    console.warn('[EventLog] write failed:', err.message)
  }
}

export function recentEvents(limit = 50) {
  return ring.slice(0, limit)
}

export async function listEvents({ page = 1, limit = 50, kind = '' } = {}) {
  const filter = kind ? { kind } : {}
  const [total, items] = await Promise.all([
    EVENTS().countDocuments(filter),
    EVENTS().find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
  ])
  return { total, page, limit, items: items.map(({ _id, ...r }) => ({ id: String(_id), ...r })) }
}
