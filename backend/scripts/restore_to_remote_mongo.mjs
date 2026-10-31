import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from '../node_modules/mongodb/lib/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DUMP_FILE = path.resolve(__dirname, '../../scratch/isydci_crm_dump.json')

const REMOTE_URI = process.env.REMOTE_MONGO_URL || 'mongodb://isydci_admin:isydci_mongo_secure_2026@143.244.129.138:27017/isydci_crm?authSource=admin'

async function restore() {
  console.log(`Connecting to remote DigitalOcean MongoDB: ${REMOTE_URI.replace(/:[^:@]+@/, ':****@')}...`)
  const client = new MongoClient(REMOTE_URI)
  await client.connect()
  const db = client.db('isydci_crm')

  const dump = JSON.parse(fs.readFileSync(DUMP_FILE, 'utf-8'))
  console.log(`Loaded dump file with collections: ${Object.keys(dump).join(', ')}`)

  for (const [colName, docs] of Object.entries(dump)) {
    if (!docs || docs.length === 0) {
      console.log(`- ${colName}: 0 documents (skipped)`)
      continue
    }
    const col = db.collection(colName)
    // Clear existing to avoid duplicate key errors during full migration
    await col.deleteMany({})
    const res = await col.insertMany(docs)
    console.log(`✅ ${colName}: restored ${res.insertedCount} documents`)
  }

  // Create unique index on members.memberId & members.contact
  try {
    await db.collection('members').createIndex({ memberId: 1 }, { unique: true })
    await db.collection('members').createIndex({ contact: 1 })
    console.log('✅ Created indexes on members collection')
  } catch (idxErr) {
    console.warn('Index notice:', idxErr.message)
  }

  await client.close()
  console.log('\n🎉 DigitalOcean MongoDB restore completed successfully!')
  process.exit(0)
}

restore().catch(err => {
  console.error('Restore failed:', err)
  process.exit(1)
})

