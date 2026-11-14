// Members data layer backed by MongoDB (previously backend/data/members.json).
// All functions are async now. The JSON file is imported once on first start (see bootstrapFromJson).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { col } from './mongo.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LEGACY_JSON = path.resolve(__dirname, '../data/members.json')

const MEMBERS = () => col('members')

/** Normalise any phone string to its last 10 digits (Indian mobile) for matching. */
export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

function strip(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return rest
}

/** One-time import of the legacy JSON file (disabled for fresh production setup). */
export async function bootstrapFromJson() {
  return 0
}

export async function readMembers() {
  const list = await MEMBERS().find({}).sort({ createdAt: -1 }).toArray()
  return list.map(strip)
}

export async function getAllMembers(q = '', status = '') {
  const filter = {}
  if (q) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const digits = q.replace(/\D/g, '')
    filter.$or = [
      { name: rx },
      { memberId: rx },
      { district: rx },
      { state: rx },
      ...(digits.length >= 4 ? [{ phoneKey: new RegExp(digits + '$') }, { contact: rx }] : []),
    ]
  }
  if (status) filter.status = new RegExp(`^${status}$`, 'i')
  const list = await MEMBERS().find(filter).sort({ createdAt: -1 }).toArray()
  return list.map(strip)
}

/** Paged listing for large tables. */
export async function listMembers({ q = '', status = '', page = 1, limit = 50 } = {}) {
  const all = await getAllMembers(q, status)
  const start = (page - 1) * limit
  return { total: all.length, page, limit, members: all.slice(start, start + limit) }
}

export async function getMemberById(id) {
  if (!id) return null
  const { ObjectId } = await import('mongodb')
  let objId = null
  try {
    if (typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
      objId = new ObjectId(id)
    }
  } catch {}
  const doc = await MEMBERS().findOne({
    $or: [{ memberId: id }, { id }, ...(objId ? [{ _id: objId }] : [])],
  })
  return strip(doc)
}

export async function findMemberByPhone(phone) {
  const key = phoneKey(phone)
  if (!key || key.length < 7) return null
  const doc = await MEMBERS().findOne({ phoneKey: key })
  return strip(doc)
}

/**
 * Create or update a member.
 *  - matches by id, then memberId, then phone (one mobile number = one member, Member ID kept)
 *  - never overwrites stored values with empty strings on an update
 */
export async function saveMember(data) {
  const now = new Date().toISOString()
  const incomingKey = phoneKey(data.contact || data.phone)

  let existing = null
  if (data.id) existing = await MEMBERS().findOne({ id: data.id })
  if (!existing && data.memberId) existing = await MEMBERS().findOne({ memberId: data.memberId })
  if (!existing && incomingKey.length >= 10) {
    existing = await MEMBERS().findOne({ phoneKey: incomingKey })
    if (existing) {
      console.log(`[DB] Phone ${incomingKey} already belongs to ${existing.memberId} — updating that record instead of creating a duplicate`)
      data = { ...data, memberId: existing.memberId }
    }
  }

  if (existing) {
    const cleaned = {}
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === undefined || v === null || k === '_id') continue
      cleaned[k] = v
    }
    const photo = cleaned.photo || cleaned.photoUrl || existing.photo || existing.photoUrl || ''
    const update = {
      ...cleaned,
      photo,
      photoUrl: photo,
      id: existing.id,
      memberId: existing.memberId,
      phoneKey: phoneKey(cleaned.contact || existing.contact),
      status: cleaned.status || existing.status || 'Verified',
      joinedDate: cleaned.joinedDate || existing.joinedDate,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    }
    await MEMBERS().updateOne({ _id: existing._id }, { $set: update })
    const updated = await MEMBERS().findOne({ _id: existing._id })
    syncToLeads(updated).catch(() => {})
    return strip(updated)
  }

  const photo = data.photo || data.photoUrl || ''
  const record = {
    ...data,
    id: data.id || `mem-${Date.now()}`,
    memberId: data.memberId || `ISYDCI-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
    phoneKey: incomingKey,
    photo,
    photoUrl: photo,
    status: data.status || 'Verified',
    joinedDate: data.joinedDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAt: now,
    updatedAt: now,
  }
  delete record._id
  await MEMBERS().insertOne(record)
  syncToLeads(record).catch(() => {})
  return strip(record)
}

async function syncToLeads(member) {
  if (!member) return
  const raw = member.contact || member.phone || member.phoneKey
  const digits = String(raw || '').replace(/\D/g, '')
  const phone = digits.length === 10 ? `91${digits}` : digits
  if (!phone) return
  const now = new Date()
  const existing = await col('leads').findOne({ phone }, { projection: { status: 1 } })
  const nextStatus =
    existing?.status === 'card_issued' || Boolean(member.cardFullUrl) ? 'card_issued' : 'registered'
  await col('leads').updateOne(
    { phone },
    {
      $set: {
        name: member.name,
        whatsappName: member.name,
        memberId: member.memberId,
        district: member.district || '',
        state: member.state || '',
        status: nextStatus,
        statusLabel: nextStatus === 'card_issued' ? 'Card Sent 🪪' : 'Registered',
        cardFullUrl: member.cardFullUrl || '',
        tags: ['verified', 'athlete'],
        updatedAt: now,
      },
      $setOnInsert: {
        phone,
        source: member.source || 'whatsapp',
        createdAt: now,
        firstContactAt: now,
        lastMessageAt: now,
        unread: false,
        notes: [],
        statusHistory: [{ from: null, to: 'registered', at: now }],
      },
    },
    { upsert: true }
  )
}

export async function deleteMember(id) {
  if (!id) return false
  const { ObjectId } = await import('mongodb')
  let objId = null
  try {
    if (typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
      objId = new ObjectId(id)
    }
  } catch {}
  const res = await MEMBERS().deleteOne({
    $or: [{ memberId: id }, { id }, ...(objId ? [{ _id: objId }] : [])],
  })
  return res.deletedCount > 0
}

export async function getStats() {
  const [totalMembers, verifiedCount, pendingCount, districts, states, recentMembers] = await Promise.all([
    MEMBERS().countDocuments({}),
    MEMBERS().countDocuments({ status: 'Verified' }),
    MEMBERS().countDocuments({ status: 'Pending' }),
    MEMBERS().distinct('district', { district: { $nin: [null, ''] } }),
    MEMBERS().distinct('state', { state: { $nin: [null, ''] } }),
    MEMBERS().find({}).sort({ createdAt: -1 }).limit(5).toArray(),
  ])
  return {
    totalMembers,
    verifiedCount,
    pendingCount,
    districtsCount: districts.length,
    statesCount: states.length,
    recentMembers: recentMembers.map(strip),
  }
}

/** Export all members as a plain array (backup / CSV). */
export async function exportMembers() {
  return readMembers()
}
