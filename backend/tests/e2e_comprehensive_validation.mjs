import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb, col } from '../db/mongo.js'
import { authenticate } from '../services/auth.js'
import { generateAndUploadCard, renderMemberCard } from '../services/cardRenderer.js'
import { saveMemberPhoto, memberUploadDir } from '../services/storage.js'
import { saveMember, getMemberById, findMemberByPhone, deleteMember } from '../db/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1x1 transparent PNG data uri for sample test photo
const SAMPLE_BASE64_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

async function run() {
  console.log('=================================================================')
  console.log('🧪 ISYDCI COMPREHENSIVE END-TO-END VALIDATION SUITE')
  console.log('=================================================================\n')

  await connectDb()

  // -------------------------------------------------------------
  // Test 1: Admin & Developer Authentication
  // -------------------------------------------------------------
  console.log('🔐 [TEST 1] Admin Authentication & Passwords Verification')
  const superAdmin = await authenticate(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD)
  assert(superAdmin && superAdmin.admin.role === 'super_admin', 'Super Admin login successful with new password')
  assert(Boolean(superAdmin?.token), 'Super Admin JWT token generated properly')

  const developer = await authenticate(process.env.SUPER_SUPER_ADMIN_USERNAME, process.env.SUPER_SUPER_ADMIN_PASSWORD)
  assert(developer && developer.admin.role === 'super_super_admin', 'Developer (Super Super Admin) login successful with new password')
  assert(Boolean(developer?.token), 'Developer JWT token generated properly')

  const badLogin = await authenticate('admin', 'wrong_password_123')
  assert(badLogin === null, 'Invalid login rejected securely (401)')

  // -------------------------------------------------------------
  // Test 2: Web Registration Flow & Member Card Generation
  // -------------------------------------------------------------
  console.log('\n🌐 [TEST 2] Web Member Registration Flow & DO Disk Storage')
  const testWebPhone = '9876500001'
  const testWebName = 'UNIT_TEST_WEB_MEMBER'

  // Clean any previous test run
  const prevWeb = await findMemberByPhone(testWebPhone)
  if (prevWeb) await deleteMember(prevWeb.id || prevWeb._id)

  // Step 2a: Save photo to DO local storage
  const photoUrl = saveMemberPhoto({ name: testWebName, memberId: 'TEST-WEB-001' }, SAMPLE_BASE64_PHOTO, 'png')
  assert(photoUrl.startsWith('https://isydci.com/uploads/members/'), `Photo saved to DO URL: ${photoUrl}`)

  // Verify file written to disk
  const { dir } = memberUploadDir({ name: testWebName })
  assert(fs.existsSync(path.join(dir, 'profile_photo.png')), 'Photo file exists on disk under backend/uploads/')

  // Step 2b: Save member to MongoDB
  const webMemberDoc = {
    name: testWebName,
    memberId: 'ISYDCI-WEBTEST1',
    photo: photoUrl,
    photoUrl,
    state: 'TAMIL NADU',
    district: 'CHENNAI',
    dob: '2001-05-15',
    age: 25,
    bloodGroup: 'B+',
    contact: testWebPhone,
    address: '100 Marina Beach Road, Chennai',
    status: 'Verified',
    source: 'web_unit_test',
  }
  let savedWebMember = await saveMember(webMemberDoc)
  assert(Boolean(savedWebMember?._id || savedWebMember?.id), 'Member saved to MongoDB successfully')

  // Step 2c: Render Front & Back Cards (without assembly, with signature)
  const webCardRes = await generateAndUploadCard(savedWebMember)
  assert(Boolean(webCardRes?.cardFullUrl), `Full card generated: ${webCardRes?.cardFullUrl}`)
  assert(Boolean(webCardRes?.cardFrontUrl), `Front card generated: ${webCardRes?.cardFrontUrl}`)
  assert(Boolean(webCardRes?.cardBackUrl), `Back card generated: ${webCardRes?.cardBackUrl}`)

  // Step 2d: Update member record with card URLs & version 3
  savedWebMember = await saveMember({
    ...savedWebMember,
    cardFullUrl: webCardRes.cardFullUrl,
    cardFrontUrl: webCardRes.cardFrontUrl,
    cardBackUrl: webCardRes.cardBackUrl,
    cardDesignVersion: 3,
  })
  assert(savedWebMember.cardDesignVersion === 3, 'Card design version set to 3 in MongoDB')

  // Verify all 3 image files exist on disk
  assert(fs.existsSync(path.join(dir, 'card_front.png')), 'card_front.png exists on disk')
  assert(fs.existsSync(path.join(dir, 'card_back.png')), 'card_back.png exists on disk')
  assert(fs.existsSync(path.join(dir, 'id_card_full.png')), 'id_card_full.png exists on disk')

  // -------------------------------------------------------------
  // Test 3: WhatsApp Registration & Flow Simulator
  // -------------------------------------------------------------
  console.log('\n💬 [TEST 3] WhatsApp Athlete Registration & Card Generation')
  const testWaPhone = '9876500002'
  const testWaName = 'UNIT_TEST_WA_MEMBER'

  const prevWa = await findMemberByPhone(testWaPhone)
  if (prevWa) await deleteMember(prevWa.id || prevWa._id)

  const waMemberDoc = {
    name: testWaName,
    memberId: 'ISYDCI-WATEST2',
    photo: '/athletes/1.png',
    photoUrl: '/athletes/1.png',
    state: 'TAMIL NADU',
    district: 'COIMBATORE',
    dob: '1998-12-01',
    age: 27,
    bloodGroup: 'O+',
    contact: testWaPhone,
    address: '45 Cross Cut Road, Coimbatore',
    status: 'Verified',
    source: 'whatsapp_unit_test',
  }
  let savedWaMember = await saveMember(waMemberDoc)
  assert(Boolean(savedWaMember?._id || savedWaMember?.id), 'WhatsApp member saved to MongoDB')

  const waCardRes = await generateAndUploadCard(savedWaMember)
  assert(Boolean(waCardRes?.cardFullUrl), `WhatsApp Full card URL: ${waCardRes?.cardFullUrl}`)
  assert(Boolean(waCardRes?.cardFrontUrl), `WhatsApp Front card URL: ${waCardRes?.cardFrontUrl}`)
  assert(Boolean(waCardRes?.cardBackUrl), `WhatsApp Back card URL: ${waCardRes?.cardBackUrl}`)

  savedWaMember = await saveMember({
    ...savedWaMember,
    cardFullUrl: waCardRes.cardFullUrl,
    cardFrontUrl: waCardRes.cardFrontUrl,
    cardBackUrl: waCardRes.cardBackUrl,
    cardDesignVersion: 3,
  })

  // -------------------------------------------------------------
  // Test 4: Member Retrieval & Lookup
  // -------------------------------------------------------------
  console.log('\n🔍 [TEST 4] Member Retrieval (ID & Phone Lookup)')
  const foundById = await getMemberById(savedWebMember.memberId)
  assert(foundById && foundById.name === testWebName, 'Found member by memberId')
  assert(foundById.cardFrontUrl?.includes('card_front.png'), 'Member has cardFrontUrl')
  assert(foundById.cardBackUrl?.includes('card_back.png'), 'Member has cardBackUrl')
  assert(foundById.cardFullUrl?.includes('id_card_full.png'), 'Member has cardFullUrl')

  const foundByPhone = await findMemberByPhone(testWaPhone)
  assert(foundByPhone && foundByPhone.name === testWaName, 'Found member by phone number')
  assert(foundByPhone.cardFrontUrl?.includes('card_front.png'), 'WhatsApp member has cardFrontUrl')
  assert(foundByPhone.cardBackUrl?.includes('card_back.png'), 'WhatsApp member has cardBackUrl')

  // -------------------------------------------------------------
  // Test 5: Verify Live DigitalOcean Health & Static Serving Config
  // -------------------------------------------------------------
  console.log('\n🌍 [TEST 5] Checking Live DigitalOcean Health & Static Serving')
  const healthUrl = 'https://isydci.com/api/health'
  try {
    const res = await fetch(healthUrl)
    assert(res.status === 200, `Live health endpoint returns HTTP 200: ${healthUrl}`)
    const data = await res.json()
    assert(data.status?.toUpperCase() === 'OK', 'Live health reports status OK')
  } catch (err) {
    assert(false, `Health check failed for ${healthUrl}: ${err.message}`)
  }

  // -------------------------------------------------------------
  // Cleanup Test Members
  // -------------------------------------------------------------
  console.log('\n🧹 [CLEANUP] Cleaning temporary unit test records...')
  await deleteMember(savedWebMember.id || savedWebMember._id)
  await deleteMember(savedWaMember.id || savedWaMember._id)
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    const waDir = memberUploadDir({ name: testWaName }).dir
    fs.rmSync(waDir, { recursive: true, force: true })
  } catch {}
  console.log('  ✅ Temporary records and folders cleaned up cleanly.')

  console.log('\n=================================================================')
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('=================================================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Test suite uncaught error:', err)
  process.exit(1)
})

