import crypto from 'crypto'
import { ObjectId } from 'mongodb'
import { col } from '../db/mongo.js'
import { ROLES, generateSixDigitPasscode, hashPassword, normalizeTelecallerPhone } from './auth.js'
import { leadPhone } from './leads.js'

const ADMINS = () => col('admins')
const LEADS = () => col('leads')
const SETTINGS = () => col('settings')

const ROUTING_DOC_ID = 'telecaller_routing'
export const ROUTING_MODES = ['manual', 'round_robin']

function passcodeKey() {
  const s = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'isydci-dev-key'
  return crypto.createHash('sha256').update(String(s)).digest()
}

function encryptPasscode(code) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', passcodeKey(), iv)
  const enc = Buffer.concat([cipher.update(String(code), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decryptPasscode(stored) {
  if (!stored || typeof stored !== 'string') return null
  const parts = stored.split(':')
  if (parts.length !== 3) return null
  try {
    const [ivHex, tagHex, encHex] = parts
    const decipher = crypto.createDecipheriv('aes-256-gcm', passcodeKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return decipher.update(Buffer.from(encHex, 'hex'), undefined, 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

function publicTelecaller(doc, assignedLeadCount = 0, { includePasscode = false } = {}) {
  if (!doc) return null
  const { _id, passwordHash, passcodeEnc, ...rest } = doc
  return {
    id: String(_id),
    ...rest,
    assignedLeadCount,
    ...(includePasscode ? { passcode: decryptPasscode(passcodeEnc) } : {}),
  }
}

export async function getRoutingConfig() {
  const doc = await SETTINGS().findOne({ _id: ROUTING_DOC_ID })
  return {
    mode: ROUTING_MODES.includes(doc?.mode) ? doc.mode : 'manual',
    updatedBy: doc?.updatedBy || null,
    updatedAt: doc?.updatedAt || null,
  }
}

export async function setRoutingConfig(mode, actor) {
  if (!ROUTING_MODES.includes(mode)) throw new Error('Routing mode must be manual or round_robin')
  const now = new Date().toISOString()
  await SETTINGS().updateOne(
    { _id: ROUTING_DOC_ID },
    { $set: { mode, updatedBy: actor || 'developer', updatedAt: now } },
    { upsert: true }
  )
  return getRoutingConfig()
}

export async function pickRoundRobinTelecaller() {
  const cfg = await getRoutingConfig()
  if (cfg.mode !== 'round_robin') return null

  const candidate = await ADMINS().findOneAndUpdate(
    { role: ROLES.TELECALLER, active: { $ne: false } },
    { $set: { lastAssignedAt: new Date().toISOString() } },
    { sort: { lastAssignedAt: 1, createdAt: 1 }, returnDocument: 'after' }
  )
  return candidate?.username || null
}

export async function listTelecallers({ includePasscode = false } = {}) {
  const list = await ADMINS()
    .find({ role: ROLES.TELECALLER })
    .sort({ createdAt: 1 })
    .toArray()

  const counts = await LEADS()
    .aggregate([
      { $match: { assignedTo: { $ne: null, $ne: '' } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ])
    .toArray()
  const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]))
  return list.map(doc => publicTelecaller(doc, countMap[doc.username] || 0, { includePasscode }))
}

export async function createTelecaller({ username, phone, displayName, createdBy }) {
  const normPhone = normalizeTelecallerPhone(phone)
  let cleanUsername = String(username || '').trim()
  if (!cleanUsername && normPhone) {
    cleanUsername = `tc_${normPhone.slice(-6)}`
  }
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUsername)) {
    throw new Error('Username must be 3-40 letters, numbers, dots, dashes or underscores')
  }

  const existingUser = await ADMINS().findOne({ username: cleanUsername })
  if (existingUser) throw new Error(`Username "${cleanUsername}" is already in use`)

  if (normPhone) {
    const existingPhone = await ADMINS().findOne({ phone: normPhone })
    if (existingPhone) throw new Error(`Phone "${normPhone}" is already registered to another account`)
  }

  const passcode = generateSixDigitPasscode()
  const now = new Date().toISOString()
  const doc = {
    username: cleanUsername,
    phone: normPhone || null,
    passwordHash: hashPassword(passcode),
    passcodeEnc: encryptPasscode(passcode),
    role: ROLES.TELECALLER,
    displayName: String(displayName || '').trim() || cleanUsername,
    active: true,
    seeded: false,
    lastAssignedAt: null,
    createdBy: createdBy || 'developer',
    createdAt: now,
    updatedAt: now,
  }
  const res = await ADMINS().insertOne(doc)
  return {
    telecaller: publicTelecaller({ ...doc, _id: res.insertedId }, 0),
    passcode,
  }
}

export async function resetTelecallerPasscode(id) {
  const target = await ADMINS().findOne({ _id: new ObjectId(id), role: ROLES.TELECALLER })
  if (!target) throw new Error('Telecaller not found')
  const passcode = generateSixDigitPasscode()
  await ADMINS().updateOne(
    { _id: target._id },
    {
      $set: {
        passwordHash: hashPassword(passcode),
        passcodeEnc: encryptPasscode(passcode),
        updatedAt: new Date().toISOString(),
      },
    }
  )
  const updated = await ADMINS().findOne({ _id: target._id })
  return { telecaller: publicTelecaller(updated), passcode }
}

export async function updateTelecaller(id, { displayName, phone, active }) {
  const target = await ADMINS().findOne({ _id: new ObjectId(id), role: ROLES.TELECALLER })
  if (!target) throw new Error('Telecaller not found')
  const set = { updatedAt: new Date().toISOString() }
  if (displayName !== undefined) set.displayName = String(displayName || '').trim() || target.username
  if (phone !== undefined) {
    const normPhone = normalizeTelecallerPhone(phone)
    if (normPhone) {
      const conflict = await ADMINS().findOne({ phone: normPhone, _id: { $ne: target._id } })
      if (conflict) throw new Error(`Phone "${normPhone}" is already registered`)
    }
    set.phone = normPhone || null
  }
  if (active !== undefined) set.active = Boolean(active)
  await ADMINS().updateOne({ _id: target._id }, { $set: set })
  const updated = await ADMINS().findOne({ _id: target._id })
  return publicTelecaller(updated)
}

export async function deleteTelecaller(id) {
  const target = await ADMINS().findOne({ _id: new ObjectId(id), role: ROLES.TELECALLER })
  if (!target) throw new Error('Telecaller not found')
  await ADMINS().deleteOne({ _id: target._id })
  await LEADS().updateMany({ assignedTo: target.username }, { $set: { assignedTo: null, updatedAt: new Date() } })
  return true
}

export async function assignLeads({ phone, phones = [], telecaller = null, distributeUnassigned = false, actor = 'developer' }) {
  const now = new Date()
  if (distributeUnassigned) {
    const activeTelecallers = await ADMINS()
      .find({ role: ROLES.TELECALLER, active: { $ne: false } })
      .sort({ lastAssignedAt: 1, createdAt: 1 })
      .toArray()
    if (!activeTelecallers.length) throw new Error('No active telecallers available for round-robin assignment')

    const unassigned = await LEADS()
      .find({ $or: [{ assignedTo: null }, { assignedTo: '' }, { assignedTo: { $exists: false } }] })
      .sort({ createdAt: 1 })
      .toArray()

    let idx = 0
    for (const lead of unassigned) {
      const tc = activeTelecallers[idx % activeTelecallers.length]
      await LEADS().updateOne({ _id: lead._id }, { $set: { assignedTo: tc.username, assignedBy: actor, updatedAt: now } })
      await ADMINS().updateOne({ _id: tc._id }, { $set: { lastAssignedAt: now.toISOString() } })
      idx++
    }
    return { assignedCount: unassigned.length, mode: 'round_robin' }
  }

  const targetList = (Array.isArray(phones) && phones.length ? phones : phone ? [phone] : [])
    .map(leadPhone)
    .filter(Boolean)
  if (!targetList.length) throw new Error('At least one lead phone is required')

  const cleanAssignee = telecaller ? String(telecaller).trim() : null
  if (cleanAssignee) {
    const tc = await ADMINS().findOne({ username: cleanAssignee, role: ROLES.TELECALLER })
    if (!tc) throw new Error(`Telecaller "${cleanAssignee}" not found`)
  }

  const res = await LEADS().updateMany(
    { phone: { $in: targetList } },
    { $set: { assignedTo: cleanAssignee, assignedBy: actor, updatedAt: now } }
  )
  return { assignedCount: res.modifiedCount, telecaller: cleanAssignee }
}
