import dotenv from 'dotenv'
dotenv.config({ path: './.env' })
import { connectDb, col } from '../db/mongo.js'

async function run() {
  await connectDb()
  const msgs = await col('messages').find({ leadPhone: /7010905730/ }).toArray()
  console.log('MESSAGES for 7010905730:', msgs.length)

  const allMsgs = await col('messages').find({}).toArray()
  console.log('ALL MESSAGES count:', allMsgs.length)
  for (const m of allMsgs) {
    console.log(`- Msg: ${m.leadPhone} | ${m.direction} | ${m.text}`)
  }

  process.exit(0)
}
run().catch(console.error)
