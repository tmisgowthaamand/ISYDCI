import dotenv from 'dotenv'
dotenv.config({ path: './.env' })
import { connectDb } from '../db/mongo.js'
import { syncMembersToLeads, listLeads } from '../services/leads.js'

async function run() {
  await connectDb()
  const count = await syncMembersToLeads()
  console.log('SYNCED MEMBERS TO LEADS COUNT:', count)

  const registered = await listLeads({ status: 'registered' })
  console.log('REGISTERED LEADS FOUND:', registered.total)
  for (const l of registered.leads) {
    console.log(`- Lead: ${l.name} | Phone: +${l.phone} | Status: ${l.status} (${l.statusLabel}) | ID: ${l.memberId}`)
  }
  process.exit(0)
}
run().catch(console.error)
