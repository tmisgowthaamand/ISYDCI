// Load test: seed N fake leads (default 10,00,000) straight into MongoDB and time the queries
// the admin panel runs. Fake leads use phones 91700000xxxx..91799999xxxx and are tagged seed:true.
//   node backend/scripts/seed_leads.mjs                 seed 1,000,000 + timing report
//   node backend/scripts/seed_leads.mjs --count 50000   smaller run
//   node backend/scripts/seed_leads.mjs --clean         remove seeded leads/messages again
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { connectDb, col, closeDb } from '../db/mongo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const args = process.argv.slice(2)
const COUNT = parseInt(args[args.indexOf('--count') + 1]) || 1_000_000
const CLEAN = args.includes('--clean')
const TIME_ONLY = args.includes('--time-only')
const rev = p => String(p).split('').reverse().join('')

const STATUSES = ['new', 'contacted', 'registration_started', 'incomplete', 'registered', 'card_issued', 'lost']
const SOURCES = ['whatsapp', 'ctwa_ad', 'facebook_lead_ad', 'web', 'whatsapp_flow']
const FIRST = ['ARJUN', 'PRIYA', 'KARTHIK', 'MEENA', 'RAHUL', 'DIVYA', 'SURESH', 'ANITHA', 'VIJAY', 'LAKSHMI', 'RAMESH', 'KAVYA']
const LAST = ['KUMAR', 'RAJ', 'DEVI', 'SHARMA', 'NAIR', 'IYER', 'REDDY', 'PATEL', 'SINGH', 'VERMA']
const STATES = ['TAMIL NADU', 'KERALA', 'KARNATAKA', 'ANDHRA PRADESH', 'TELANGANA', 'MAHARASHTRA']
const DISTRICTS = ['CHENNAI', 'MADURAI', 'COIMBATORE', 'TRICHY', 'SALEM', 'ERODE', 'VELLORE']
const rnd = arr => arr[Math.floor(Math.random() * arr.length)]

const db = await connectDb()
const LEADS = col('leads')
const MESSAGES = col('messages')

if (CLEAN) {
  const r1 = await LEADS.deleteMany({ seed: true })
  const r2 = await MESSAGES.deleteMany({ seed: true })
  console.log(`🧹 removed ${r1.deletedCount.toLocaleString('en-IN')} seeded leads and ${r2.deletedCount.toLocaleString('en-IN')} seeded messages`)
  await closeDb()
  process.exit(0)
}

const base = 917000000000
const t0 = Date.now()
if (!TIME_ONLY) {
console.log(`Seeding ${COUNT.toLocaleString('en-IN')} leads into ${db.databaseName}…`)
const BATCH = 5000
let inserted = 0
for (let start = 0; start < COUNT; start += BATCH) {
  const docs = []
  for (let i = start; i < Math.min(COUNT, start + BATCH); i++) {
    const created = new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000 - Math.floor(Math.random() * 86400000))
    const status = rnd(STATUSES)
    const source = rnd(SOURCES)
    const name = `${rnd(FIRST)} ${rnd(LAST)}`
    docs.push({
      phone: String(base + i),
      phoneRev: rev(String(base + i)),
      name,
      whatsappName: name,
      status,
      source,
      seed: true,
      state: rnd(STATES),
      district: rnd(DISTRICTS),
      ...(source === 'ctwa_ad' ? { campaign: { adId: `AD-${1000 + (i % 25)}`, headline: `Campaign ${i % 25}`, capturedAt: created } } : {}),
      ...(status === 'registration_started' || status === 'incomplete' ? { flowStep: 'REG_DOB', flowStepLabel: 'Step 2 · Date of birth', flowLastActivityAt: created } : {}),
      ...(status === 'registered' || status === 'card_issued' ? { memberId: `ISYDCI-${(i >>> 0).toString(16).toUpperCase().padStart(8, '0')}` } : {}),
      unread: Math.random() < 0.05,
      notes: [],
      tags: [],
      createdAt: created,
      updatedAt: created,
      lastMessageAt: created,
      firstContactAt: created,
    })
  }
  await LEADS.insertMany(docs, { ordered: false }).catch(err => {
    if (err.code !== 11000) throw err
  })
  inserted += docs.length
  if (inserted % 100000 === 0 || inserted === COUNT) {
    const s = (Date.now() - t0) / 1000
    process.stdout.write(`  ${inserted.toLocaleString('en-IN')} leads in ${s.toFixed(0)}s (${Math.round(inserted / s).toLocaleString('en-IN')}/s)\n`)
  }
}

// one message per 10 leads so the inbox has conversation volume
const msgDocs = []
for (let i = 0; i < Math.min(COUNT, 100000); i += 10) {
  msgDocs.push({ leadPhone: String(base + i), direction: 'in', type: 'text', text: 'Hi', seed: true, provider: 'meta', createdAt: new Date() })
  if (msgDocs.length >= BATCH) {
    await MESSAGES.insertMany(msgDocs.splice(0), { ordered: false })
  }
}
if (msgDocs.length) await MESSAGES.insertMany(msgDocs, { ordered: false })

console.log(`\n✅ seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
}
console.log(`Total leads now: ${(await LEADS.estimatedDocumentCount()).toLocaleString('en-IN')}`)

// ---- timing: the queries the panel runs
const time = async (label, fn) => {
  const t = Date.now()
  const r = await fn()
  const ms = Date.now() - t
  console.log(`  ${ms <= 1000 ? '✅' : '⚠️ '} ${label.padEnd(46)} ${String(ms).padStart(6)} ms${r !== undefined ? `   (${r})` : ''}`)
  return ms
}
console.log('\nPanel queries at this volume (target: under 1000 ms):')
const times = []
times.push(await time('inbox page 1 (50 by last activity)', async () => (await LEADS.find({}, { projection: { draft: 0 } }).sort({ lastMessageAt: -1, createdAt: -1 }).limit(50).toArray()).length))
times.push(await time('incomplete list page 1', async () => (await LEADS.find({ status: { $in: ['incomplete', 'registration_started'] } }).sort({ lastMessageAt: -1 }).limit(50).toArray()).length))
times.push(await time('count incomplete', async () => await LEADS.countDocuments({ status: { $in: ['incomplete', 'registration_started'] } })))
times.push(await time('search by last 7 digits of phone (phoneRev)', async () => (await LEADS.find({ phoneRev: new RegExp('^' + rev('0000777')) }).limit(50).toArray()).length))
times.push(await time('search by full phone (exact)', async () => (await LEADS.find({ phone: { $in: [String(base + 777), '91' + String(base + 777).slice(-10)] } }).limit(50).toArray()).length))
times.push(await time('lookup one lead by phone', async () => (await LEADS.findOne({ phone: String(base + 123456) }))?.name))
times.push(await time('campaign filter (one ad id)', async () => await LEADS.countDocuments({ 'campaign.adId': 'AD-1007' })))
times.push(await time('stats tiles (parallel indexed counts)', async () => (await Promise.all(STATUSES.map(s => LEADS.countDocuments({ status: s })))).length + ' statuses'))
times.push(await time('deep page (page 2000, skip 100k)', async () => (await LEADS.find({}).sort({ createdAt: -1 }).skip(100000).limit(50).toArray()).length))
times.push(await time('conversation (messages of one lead)', async () => (await MESSAGES.find({ leadPhone: String(base + 10) }).sort({ createdAt: -1 }).limit(200).toArray()).length))
const stats = await db.command({ collStats: 'leads' })
console.log(`\nStorage: leads collection ${(stats.storageSize / 1024 / 1024).toFixed(0)} MB on disk, indexes ${(stats.totalIndexSize / 1024 / 1024).toFixed(0)} MB`)
console.log(times.every(t => t <= 1000) ? '\n✅ LOAD TEST PASSED — every panel query under 1 second' : '\n⚠️  some queries exceeded 1 second — check indexes')
await closeDb()
