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
  const existingIdx = list.findIndex(m => m.id === id || (data.memberId && m.memberId === data.memberId))

  const newRecord = {
    ...data,
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
