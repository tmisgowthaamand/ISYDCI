import dotenv from 'dotenv'
dotenv.config({ path: './.env' })
import { connectDb, col } from '../db/mongo.js'

async function run() {
  await connectDb()
  const existingHi = await col('messages').findOne({
    leadPhone: '918903162114',
    direction: 'in',
    createdAt: { $gte: new Date('2026-10-27T11:25:00.000Z'), $lte: new Date('2026-10-27T11:25:25.000Z') }
  })
  if (!existingHi) {
    await col('messages').insertOne({
      leadPhone: '918903162114',
      direction: 'in',
      type: 'text',
      text: 'hi',
      waMessageId: 'wamid.HBgMOTE4OTAzMTYyMTE0_inbound_hi',
      provider: 'meta',
      createdAt: new Date('2026-10-27T11:25:20.000Z'),
    })
    console.log('Inserted client hi message for 918903162114 at 11:25:20')
  } else {
    console.log('Already exists')
  }
  process.exit(0)
}
run().catch(console.error)
