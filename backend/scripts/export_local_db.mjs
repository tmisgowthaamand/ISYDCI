import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb, getDb } from '../db/mongo.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OUT_FILE = path.resolve(__dirname, '../../scratch/isydci_crm_dump.json')

async function exportAll() {
  await connectDb()
  const db = getDb()
  const collections = await db.listCollections().toArray()
  const dump = {}

  for (const c of collections) {
    const docs = await db.collection(c.name).find({}).toArray()
    dump[c.name] = docs
    console.log(`📦 Exported ${c.name}: ${docs.length} documents`)
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(dump, null, 2))
  console.log(`\n💾 Saved entire database dump to ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`)
  process.exit(0)
}

exportAll().catch(err => {
  console.error(err)
  process.exit(1)
})

