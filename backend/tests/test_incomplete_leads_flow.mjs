import { connectDb, col } from '../db/mongo.js'
import { saveWebDraft, trackFlowStep, onMemberRegistered, getLead, listLeads, sweepIncomplete } from '../services/leads.js'
import { saveMember, deleteMember, findMemberByPhone } from '../db/db.js'

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

async function run() {
  console.log('=================================================================')
  console.log('🧪 TEST: INCOMPLETE LEADS & AUTOMATIC CONVERSION TO MEMBER')
  console.log('=================================================================\n')

  await connectDb()

  const testWebPhone = '9876540099'
  const testWaPhone = '9876540088'

  // Clean any previous test leads / members
  await col('leads').deleteMany({ phone: { $in: [`91${testWebPhone}`, `91${testWaPhone}`] } })
  const m1 = await findMemberByPhone(testWebPhone)
  if (m1) await deleteMember(m1.id || m1._id)
  const m2 = await findMemberByPhone(testWaPhone)
  if (m2) await deleteMember(m2.id || m2._id)

  // -------------------------------------------------------------
  // Test A: Website Incomplete Lead Auto-Capture
  // -------------------------------------------------------------
  console.log('🌐 [TEST A] Website Incomplete Lead — Step Skipped Tracking')
  const webLead = await saveWebDraft({
    phone: testWebPhone,
    step: 'Step 2 · Location selected',
    draft: {
      name: 'INCOMPLETE WEB USER',
      contact: testWebPhone,
      state: 'TAMIL NADU',
      district: 'MADURAI',
      zone: 'SOUTH ZONE',
      hasPhoto: false,
    },
  })

  assert(webLead && webLead.status === 'registration_started', 'Web lead created with status registration_started')
  assert(webLead.source === 'web', 'Lead source is web')
  assert(webLead.flowStepLabel === 'Website · Step 2 · Location selected', `Exact step captured: ${webLead.flowStepLabel}`)
  assert(webLead.name === 'INCOMPLETE WEB USER', `Lead name captured: ${webLead.name}`)

  // Verify listLeads returns the draft and step
  const incompleteList = await listLeads({ status: 'registration_started,incomplete' })
  const foundIncomplete = incompleteList.leads.find(l => l.phone === `91${testWebPhone}`)
  assert(Boolean(foundIncomplete), 'Incomplete lead appears in admin panel leads list')
  assert(foundIncomplete.flowStepLabel.includes('Step 2'), 'Admin panel shows exact step skipped: ' + foundIncomplete.flowStepLabel)
  assert(foundIncomplete.draft?.district === 'MADURAI', 'Draft details (Madurai) preserved for admin view')

  // -------------------------------------------------------------
  // Test B: WhatsApp Incomplete Lead Step Tracking
  // -------------------------------------------------------------
  console.log('\n💬 [TEST B] WhatsApp Incomplete Lead — Flow Step Tracking')
  await trackFlowStep(testWaPhone, {
    action: 'data_exchange',
    screen: 'REG_DETAILS',
    nextScreen: 'REG_DETAILS',
    data: {
      full_name: 'INCOMPLETE WA USER',
      state: 'TAMIL NADU',
      district: 'COIMBATORE',
      dob: '946684800000',
      blood_group: 'B+',
      address: '100 Main Road, Coimbatore',
      photo: [], // Photo missing!
    },
    hasError: true,
  })

  const waLead = await getLead(testWaPhone)
  assert(waLead && waLead.status === 'registration_started', 'WhatsApp lead created with registration_started')
  assert(waLead.flowStepLabel === 'Step 3 · Blood group, address & photo', `WhatsApp step captured: ${waLead.flowStepLabel}`)

  // -------------------------------------------------------------
  // Test C: Automatic Conversion to Member Page Link
  // -------------------------------------------------------------
  console.log('\n🚀 [TEST C] Lead Completes Registration -> Auto-Transition to Member')

  // Simulate user coming back and completing registration on web
  const registeredDoc = {
    name: 'INCOMPLETE WEB USER',
    memberId: 'ISYDCI-CONV01',
    contact: testWebPhone,
    state: 'TAMIL NADU',
    district: 'MADURAI',
    cardFullUrl: 'https://isydci.com/uploads/members/INCOMPLETE_WEB_USER/id_card_full.png',
    status: 'Verified',
  }
  const savedMember = await saveMember(registeredDoc)
  await onMemberRegistered(savedMember, 'web')

  const convertedLead = await getLead(testWebPhone)
  assert(convertedLead.status === 'card_issued' || convertedLead.status === 'registered', `Status auto-upgraded: ${convertedLead.status}`)
  assert(convertedLead.memberId === 'ISYDCI-CONV01', `Member ID linked to lead: ${convertedLead.memberId}`)
  assert(convertedLead.flowStepLabel === 'Registration Completed ✅', `Flow step updated to completed: ${convertedLead.flowStepLabel}`)

  // Verify in leads list: when admin searches by memberId or phone, it links directly to member
  const allLeads = await listLeads({ q: 'ISYDCI-CONV01' })
  assert(allLeads.leads.length === 1 && allLeads.leads[0].memberId === 'ISYDCI-CONV01', 'Admin can find converted lead by Member ID')

  // -------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------
  console.log('\n🧹 [CLEANUP] Removing test records...')
  await col('leads').deleteMany({ phone: { $in: [`91${testWebPhone}`, `91${testWaPhone}`] } })
  await deleteMember(savedMember.id || savedMember._id)
  console.log('  ✅ Cleaned up.')

  console.log('\n=================================================================')
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('=================================================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})

