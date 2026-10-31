import fs from 'fs'
import path from 'path'
import { connectDb, col } from '../db/mongo.js'
import { saveMember, getMemberById, deleteMember } from '../db/db.js'
import { saveMemberPhoto, saveMemberCardFiles, deleteMemberFiles, memberUploadDir } from '../services/storage.js'

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${msg}`)
    failed++
  }
}

const SAMPLE_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const DUMMY_PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082', 'hex')

async function run() {
  console.log('=================================================================')
  console.log('🧪 TEST: MEMBER DELETION FROM MONGODB AND DISK STORAGE')
  console.log('=================================================================\n')

  await connectDb()

  const testMemberName = 'DELETE_TEST_USER'
  const testMemberId = 'ISYDCI-DEL999'

  // Clean any previous test run
  await deleteMember(testMemberId)
  const { dir } = memberUploadDir({ name: testMemberName })
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })

  // 1. Create photo on disk
  const photoUrl = saveMemberPhoto({ name: testMemberName }, SAMPLE_PHOTO, 'png')

  // 2. Create card PNGs on disk
  const cardUrls = saveMemberCardFiles({ name: testMemberName }, {
    front: DUMMY_PNG,
    back: DUMMY_PNG,
    combined: DUMMY_PNG,
  })

  // 3. Save member in MongoDB
  const savedMember = await saveMember({
    name: testMemberName,
    memberId: testMemberId,
    contact: '9900011223',
    photo: photoUrl,
    photoUrl,
    cardFrontUrl: cardUrls.cardFrontUrl,
    cardBackUrl: cardUrls.cardBackUrl,
    cardFullUrl: cardUrls.cardFullUrl,
    status: 'Verified',
  })

  // Verify member exists in MongoDB
  const inDb = await getMemberById(testMemberId)
  assert(Boolean(inDb && inDb.name === testMemberName), 'Member exists in MongoDB before deletion')

  // Verify all files exist on disk
  assert(fs.existsSync(dir), 'Member assets folder exists on disk before deletion')
  assert(fs.existsSync(path.join(dir, 'profile_photo.png')), 'profile_photo.png exists on disk')
  assert(fs.existsSync(path.join(dir, 'card_front.png')), 'card_front.png exists on disk')
  assert(fs.existsSync(path.join(dir, 'card_back.png')), 'card_back.png exists on disk')
  assert(fs.existsSync(path.join(dir, 'id_card_full.png')), 'id_card_full.png exists on disk')

  // 4. Perform Deletion (Both Disk Assets and MongoDB Document)
  console.log('\n🗑️ Executing full deletion (Disk Assets + MongoDB Document)...')
  const filesDeleted = deleteMemberFiles(savedMember)
  assert(filesDeleted === true, 'deleteMemberFiles returned true')

  const dbDeleted = await deleteMember(testMemberId)
  assert(dbDeleted === true, 'deleteMember returned true (deleted from MongoDB)')

  // 5. Verify member is gone from MongoDB
  const afterDb = await getMemberById(testMemberId)
  assert(afterDb === null, 'Member successfully deleted from MongoDB (getMemberById returns null)')

  // 6. Verify folder and files are gone from disk
  assert(!fs.existsSync(dir), 'Member asset directory completely removed from disk')

  console.log('\n=================================================================')
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('=================================================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})

