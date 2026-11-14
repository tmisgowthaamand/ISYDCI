// MongoDB connection + index setup.
// Local dev:   MONGO_URL=mongodb://127.0.0.1:27017/isydci_crm   (MongoDB 8 on this PC)
// Production:  MONGO_URL=<DigitalOcean Managed MongoDB connection string>/isydci_crm
import { MongoClient } from 'mongodb'

const DEFAULT_URL = 'mongodb://127.0.0.1:27017/isydci_crm'

let client = null
let db = null

export function mongoUrl() {
  return process.env.MONGO_URL || DEFAULT_URL
}

export async function connectDb() {
  if (db) return db
  const url = mongoUrl()
  client = new MongoClient(url, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 })
  await client.connect()
  db = client.db() // database name comes from the URL path
  await ensureIndexes(db)
  const safeUrl = url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@')
  console.log(`🗄️  [MongoDB] connected -> ${safeUrl} (db: ${db.databaseName})`)
  return db
}

export function getDb() {
  if (!db) throw new Error('MongoDB not connected yet — call connectDb() first')
  return db
}

export const col = name => getDb().collection(name)

export async function closeDb() {
  if (client) await client.close()
  client = null
  db = null
}

async function ensureIndexes(d) {
  try {
    const existing = await d.collection('members').indexes().catch(() => [])
    for (const idx of existing) {
      if (idx.name && idx.name.includes('_text_') && idx.name !== 'name_text_district_text_state_text') {
        await d.collection('members').dropIndex(idx.name).catch(() => {})
      }
    }
  } catch (_) {}

  await Promise.all([
    d.collection('members').createIndexes([
      { key: { memberId: 1 }, unique: true },
      { key: { id: 1 }, unique: true },
      { key: { phoneKey: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
      { key: { name: 'text', district: 'text', state: 'text' } },
    ]).catch(async err => {
      if (err.code === 85) {
        const idxs = await d.collection('members').indexes().catch(() => [])
        for (const i of idxs) {
          if (i.name && i.name.includes('_text_')) await d.collection('members').dropIndex(i.name).catch(() => {})
        }
        return d.collection('members').createIndexes([
          { key: { memberId: 1 }, unique: true },
          { key: { id: 1 }, unique: true },
          { key: { phoneKey: 1 } },
          { key: { status: 1 } },
          { key: { createdAt: -1 } },
          { key: { name: 'text', district: 'text', state: 'text' } },
        ])
      }
      throw err
    }),
    d.collection('leads').createIndexes([
      { key: { phone: 1 }, unique: true },
      { key: { status: 1 } }, // plain index -> countDocuments({status}) is a pure index count
      { key: { status: 1, updatedAt: -1 } },
      { key: { source: 1 } },
      { key: { unread: 1 } },
      { key: { 'campaign.adId': 1 } },
      { key: { assignedTo: 1 } },
      { key: { lastMessageAt: -1, createdAt: -1 } }, // inbox sort at 10 lakh rows
      { key: { createdAt: -1 } },
      { key: { phoneRev: 1 } }, // reversed phone -> "ends with" search becomes an indexed prefix search
      { key: { name: 'text' } },
    ]),
    d.collection('messages').createIndexes([
      { key: { leadPhone: 1, createdAt: -1 } },
      { key: { waMessageId: 1 }, sparse: true },
      { key: { createdAt: -1 } },
    ]),
    d.collection('templates').createIndexes([
      { key: { name: 1, language: 1 }, unique: true },
      { key: { metaId: 1 }, sparse: true },
      { key: { status: 1 } },
    ]),
    d.collection('providers').createIndexes([{ key: { key: 1 }, unique: true }]),
    d.collection('admins').createIndexes([{ key: { username: 1 }, unique: true }]),
    d.collection('audit_logs').createIndexes([{ key: { createdAt: -1 } }, { key: { actor: 1 } }]),
    d.collection('webhook_events').createIndexes([
      { key: { createdAt: -1 } },
      { key: { createdAt: 1 }, expireAfterSeconds: 7 * 24 * 3600 }, // keep 7 days
      { key: { kind: 1 } },
    ]),
    d.collection('whatsapp_calls').createIndexes([
      { key: { callId: 1 }, unique: true },
      { key: { waId: 1, createdAt: -1 } },
      { key: { status: 1, updatedAt: -1 } },
      { key: { status: 1, startedAt: -1 } },
      { key: { attended: 1, recording_status: 1, createdAt: -1 } },
      { key: { telecaller_id: 1, call_direction: 1, createdAt: -1 } },
      { key: { telecaller_id: 1, startedAt: -1 } },
      { key: { direction: 1, startedAt: -1 } },
      { key: { startedAt: -1 } },
      { key: { leadId: 1 }, sparse: true },
      { key: { createdAt: -1 } },
    ]),
    d.collection('call_permissions').createIndexes([
      { key: { waId: 1 }, unique: true },
      { key: { status: 1, permissionExpiresAt: 1 } },
      { key: { permissionExpiresAt: 1 } },
    ]),
  ])
}
