// Admin accounts, password hashing (scrypt) and signed login tokens (HS256 JWT, no extra deps).
import crypto from 'crypto'
import { col } from '../db/mongo.js'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SUPER_SUPER_ADMIN: 'super_super_admin',
}
export const ROLE_LABEL = {
  super_admin: 'Super Admin',
  super_super_admin: 'Super Super Admin (Developer)',
}
const TOKEN_TTL_SECONDS = 12 * 3600

const ADMINS = () => col('admins')

function secret() {
  const s = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD
  if (!s) throw new Error('JWT_SECRET missing in backend/.env')
  return s
}

// ---------------------------------------------------------------- passwords
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false
  const [, salt, hash] = stored.split('$')
  const check = crypto.scryptSync(String(password), salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return check.length === expected.length && crypto.timingSafeEqual(check, expected)
}

// ---------------------------------------------------------------- tokens
const b64url = buf => Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const fromB64url = str => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = b64url(crypto.createHmac('sha256', secret()).update(`${header}.${body}`).digest())
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- accounts
function publicAdmin(doc) {
  if (!doc) return null
  const { _id, passwordHash, ...rest } = doc
  return { id: String(_id), ...rest, roleLabel: ROLE_LABEL[doc.role] || doc.role }
}

/**
 * The two bootstrap accounts come from backend/.env and are re-synced on every start,
 * so changing the password in .env changes the login. Extra admins are managed in the panel.
 */
export async function ensureSeedAdmins() {
  const seeds = [
    { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD, role: ROLES.SUPER_ADMIN },
    { username: process.env.SUPER_SUPER_ADMIN_USERNAME, password: process.env.SUPER_SUPER_ADMIN_PASSWORD, role: ROLES.SUPER_SUPER_ADMIN },
  ]
  for (const s of seeds) {
    if (!s.username || !s.password) continue
    const now = new Date().toISOString()
    await ADMINS().updateOne(
      { username: s.username },
      {
        $set: { passwordHash: hashPassword(s.password), role: s.role, seeded: true, active: true, updatedAt: now },
        $setOnInsert: { createdAt: now, displayName: s.role === ROLES.SUPER_SUPER_ADMIN ? 'Developer' : 'Super Admin' },
      },
      { upsert: true }
    )
  }
  const n = await ADMINS().countDocuments({})
  console.log(`👤 [Auth] admin accounts ready: ${n} (seeded from .env: ${seeds.filter(s => s.username && s.password).map(s => `${s.username}=${s.role}`).join(', ') || 'none'})`)
}

export async function authenticate(username, password) {
  const doc = await ADMINS().findOne({ username: String(username || '').trim() })
  if (!doc || doc.active === false) return null
  if (!verifyPassword(password, doc.passwordHash)) return null
  await ADMINS().updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date().toISOString() } })
  const admin = publicAdmin(doc)
  const token = signToken({ sub: admin.id, username: admin.username, role: admin.role })
  return { admin, token }
}

export async function listAdmins() {
  const list = await ADMINS().find({}).sort({ createdAt: 1 }).toArray()
  return list.map(publicAdmin)
}

export async function createAdmin({ username, password, role, displayName, createdBy }) {
  username = String(username || '').trim()
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3-40 letters, numbers, dots, dashes or underscores')
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters')
  if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role')
  const now = new Date().toISOString()
  const doc = { username, passwordHash: hashPassword(password), role, displayName: displayName || username, active: true, seeded: false, createdBy, createdAt: now, updatedAt: now }
  const res = await ADMINS().insertOne(doc)
  return publicAdmin({ ...doc, _id: res.insertedId })
}

export async function updateAdmin(id, { password, role, displayName, active }, actor) {
  const { ObjectId } = await import('mongodb')
  const target = await ADMINS().findOne({ _id: new ObjectId(id) })
  if (!target) throw new Error('Admin not found')
  const set = { updatedAt: new Date().toISOString() }
  if (password) {
    if (String(password).length < 8) throw new Error('Password must be at least 8 characters')
    set.passwordHash = hashPassword(password)
  }
  if (role) {
    if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role')
    set.role = role
  }
  if (displayName !== undefined) set.displayName = displayName
  if (active !== undefined) set.active = Boolean(active)
  // never lock out the last developer account
  if ((set.role && set.role !== ROLES.SUPER_SUPER_ADMIN) || set.active === false) {
    if (target.role === ROLES.SUPER_SUPER_ADMIN) {
      const others = await ADMINS().countDocuments({ role: ROLES.SUPER_SUPER_ADMIN, active: { $ne: false }, _id: { $ne: target._id } })
      if (others === 0) throw new Error('Cannot demote or disable the last Super Super Admin')
    }
  }
  if (target.seeded && (set.passwordHash || set.role)) throw new Error('This account is managed from backend/.env — change it there')
  await ADMINS().updateOne({ _id: target._id }, { $set: set })
  return publicAdmin(await ADMINS().findOne({ _id: target._id }))
}

export async function deleteAdmin(id, actor) {
  const { ObjectId } = await import('mongodb')
  const target = await ADMINS().findOne({ _id: new ObjectId(id) })
  if (!target) throw new Error('Admin not found')
  if (target.seeded) throw new Error('This account is managed from backend/.env and cannot be deleted here')
  if (String(target._id) === String(actor?.sub)) throw new Error('You cannot delete your own account')
  await ADMINS().deleteOne({ _id: target._id })
  return true
}

// ---------------------------------------------------------------- express middleware
export function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token
    const payload = verifyToken(token)
    if (!payload) return res.status(401).json({ success: false, message: 'Login required' })
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ success: false, message: 'This section is for the Super Super Admin (developer) only' })
    }
    req.admin = payload
    next()
  }
}

/** Attaches req.admin when a valid token is present, without blocking. */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyToken(token) : null
  if (payload) req.admin = payload
  next()
}
