import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '../data')
const dataFile = path.resolve(dataDir, 'members.json')

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Initial seed members (empty for manual registration)
const initialSeed = []

// Initialize members file if not present
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify(initialSeed, null, 2), 'utf-8')
}

export function readMembers() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('[DB Read Error]:', err.message)
    return []
  }
}

export function writeMembers(members) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(members, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('[DB Write Error]:', err.message)
    return false
  }
}

export function getAllMembers(q = '', status = '') {
  let list = readMembers()

  if (q) {
    const query = q.toLowerCase().trim()
    list = list.filter(m =>
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.memberId && m.memberId.toLowerCase().includes(query)) ||
      (m.contact && m.contact.includes(query)) ||
      (m.district && m.district.toLowerCase().includes(query)) ||
      (m.assembly && m.assembly.toLowerCase().includes(query)) ||
      (m.state && m.state.toLowerCase().includes(query))
    )
  }

  if (status) {
    list = list.filter(m => m.status && m.status.toLowerCase() === status.toLowerCase())
  }

  return list
}

export function getMemberById(id) {
  const list = readMembers()
  return list.find(m => m.id === id || m.memberId === id) || null
}

export function saveMember(data) {
  const list = readMembers()
  const id = data.id || `mem-${Date.now()}`
  let existingIdx = list.findIndex(m => m.id === id || (data.memberId && m.memberId === data.memberId))

  // One mobile number = one member. A new registration from a phone that is already in the
  // database updates that record (keeping its Member ID) instead of creating a duplicate card.
  const incomingPhone = phoneKey(data.contact || data.phone)
  if (existingIdx < 0 && incomingPhone.length >= 10) {
    existingIdx = list.findIndex(m => phoneKey(m.contact || m.phone) === incomingPhone)
    if (existingIdx >= 0) {
      console.log(`[DB] Phone ${incomingPhone} already belongs to ${list[existingIdx].memberId} — updating that record instead of creating a duplicate`)
      data = { ...data, memberId: list[existingIdx].memberId }
    }
  }

  // Never wipe stored values (photo, card image, address...) with empty fields from a partial save
  if (existingIdx >= 0) {
    const cleaned = {}
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === undefined || v === null) continue
      cleaned[k] = v
    }
    data = cleaned
  }

  // Keep `photo` and `photoUrl` in sync so every client (admin panel, card page, bot) finds the image
  const resolvedPhoto = data.photo || data.photoUrl || (existingIdx >= 0 ? (list[existingIdx].photo || list[existingIdx].photoUrl) : '') || ''

  const newRecord = {
    ...data,
    photo: resolvedPhoto,
    photoUrl: resolvedPhoto,
    id: existingIdx >= 0 ? list[existingIdx].id : id,
    status: data.status || 'Verified',
    joinedDate: data.joinedDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...newRecord }
  } else {
    list.unshift(newRecord)
  }

  writeMembers(list)
  return newRecord
}

export function deleteMember(id) {
  let list = readMembers()
  const initialLen = list.length
  list = list.filter(m => m.id !== id && m.memberId !== id)
  if (list.length !== initialLen) {
    writeMembers(list)
    return true
  }
  return false
}

export function getStats() {
  const list = readMembers()
  const verifiedCount = list.filter(m => m.status === 'Verified').length
  const pendingCount = list.filter(m => m.status === 'Pending').length
  const districts = [...new Set(list.map(m => m.district).filter(Boolean))]
  const states = [...new Set(list.map(m => m.state).filter(Boolean))]

  return {
    totalMembers: list.length,
    verifiedCount,
    pendingCount,
    districtsCount: districts.length,
    statesCount: states.length,
    recentMembers: list.slice(0, 5)
  }
}

/** Normalise any phone string to its last 10 digits (Indian mobile) for matching. */
export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

/** Find a member whose stored contact matches the given phone (last-10-digit compare). */
export function findMemberByPhone(phone) {
  const key = phoneKey(phone)
  if (!key || key.length < 7) return null
  const list = readMembers()
  return list.find(m => phoneKey(m.contact || m.phone) === key) || null
}
