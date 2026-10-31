import dotenv from 'dotenv'
dotenv.config({ path: './.env' })
import { connectDb, col } from '../db/mongo.js'
import { phoneKey } from '../db/db.js'

async function run() {
  await connectDb()
  const pk = phoneKey('7010905730')
  console.log('phoneKey for 7010905730:', pk)
  const mem = await col('members').findOne({ phoneKey: pk })
  console.log('MEMBER in DB for 7010905730:', mem ? { name: mem.name, memberId: mem.memberId, phoneKey: mem.phoneKey, contact: mem.contact } : 'NOT FOUND')
  
  const lead = await col('leads').findOne({ phone: { $regex: '7010905730' } })
  console.log('LEAD in DB for 7010905730:', lead ? { phone: lead.phone, name: lead.name, status: lead.status, memberId: lead.memberId } : 'NOT FOUND')

  const allMems = await col('members').find({}).toArray()
  console.log('\nALL MEMBERS in DB count:', allMems.length)
  for (const m of allMems) {
    console.log(`- Member: ${m.name} | ${m.memberId} | phoneKey: ${m.phoneKey} | contact: ${m.contact}`)
  }

  const allLeads = await col('leads').find({}).toArray()
  console.log('\nALL LEADS in DB count:', allLeads.length)
  for (const l of allLeads) {
    console.log(`- Lead: ${l.name} | phone: ${l.phone} | status: ${l.status} | memberId: ${l.memberId}`)
  }

  process.exit(0)
}
run().catch(console.error)
