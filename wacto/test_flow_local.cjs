// End-to-end local test of the WhatsApp Flow endpoint + webhook (no Meta involved).
//   node wacto/test_flow_local.cjs            (backend must be running on :5000)
//   node wacto/test_flow_local.cjs --keep     keep the test athlete in the database
//
// It encrypts requests exactly like Meta does (RSA-OAEP + AES-128-GCM), serves a fake
// "Meta CDN" for the photo upload, walks all 4 registration screens, then replays the
// webhook events ("Hi" from a new number, flow completion, "Hi" from the registered number).

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const http = require('http')

function loadEnv() {
  const envPath = path.resolve(__dirname, '../backend/.env')
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (m) {
      let v = m[2] || ''
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  })
}
loadEnv()

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000'
const FLOW_URL = `${BASE}/api/whatsapp/flow-endpoint`
const WEBHOOK_URL = `${BASE}/api/whatsapp/webhook`
const TEST_PHONE = '919000000001'
const KEEP = process.argv.includes('--keep')

const privateKey = crypto.createPrivateKey(process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n'))
const publicKey = crypto.createPublicKey(privateKey)

function encryptRequest(payload) {
  const aesKey = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const encrypted_aes_key = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey).toString('base64')
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const encrypted_flow_data = Buffer.concat([ct, cipher.getAuthTag()]).toString('base64')
  return { body: { encrypted_aes_key, encrypted_flow_data, initial_vector: iv.toString('base64') }, aesKey, iv }
}

function decryptResponse(b64, aesKey, iv) {
  const flipped = Buffer.from(iv.map(b => b ^ 0xff))
  const buf = Buffer.from(b64, 'base64')
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, flipped)
  decipher.setAuthTag(buf.subarray(buf.length - 16))
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(0, buf.length - 16)), decipher.final()]).toString('utf8'))
}

async function flow(payload) {
  const { body, aesKey, iv } = encryptRequest({ version: '3.0', flow_token: TEST_PHONE, ...payload })
  const res = await fetch(FLOW_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  return decryptResponse(text, aesKey, iv)
}

async function webhook(message) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: {}, contacts: [{ wa_id: TEST_PHONE, profile: { name: 'Test' } }], messages: [{ from: TEST_PHONE, id: `wamid.test.${Date.now()}.${Math.random()}`, timestamp: `${Date.now()}`, ...message }] } }] }],
    }),
  })
  return res.status
}

// Encrypt a photo the way Meta's CDN stores Flow uploads (AES-256-CBC + HMAC-SHA256 trailer)
function encryptLikeMetaCdn(plaintext) {
  const encryptionKey = crypto.randomBytes(32)
  const hmacKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const mac = crypto.createHmac('sha256', hmacKey).update(Buffer.concat([iv, ciphertext])).digest().subarray(0, 10)
  const cdnFile = Buffer.concat([ciphertext, mac])
  const b64 = b => Buffer.from(b).toString('base64')
  return {
    cdnFile,
    encryption_metadata: {
      encrypted_hash: b64(crypto.createHash('sha256').update(cdnFile).digest()),
      iv: b64(iv),
      encryption_key: b64(encryptionKey),
      hmac_key: b64(hmacKey),
      plaintext_hash: b64(crypto.createHash('sha256').update(plaintext).digest()),
    },
  }
}

const show = (label, obj) => {
  const copy = JSON.parse(JSON.stringify(obj))
  if (copy.data?.photo_preview) copy.data.photo_preview = `[base64 ${copy.data.photo_preview.length} chars]`
  console.log(`\n▶ ${label}\n  → screen: ${copy.screen || '-'}  data: ${JSON.stringify(copy.data)}`)
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
  console.log(`  ✅ ${msg}`)
}

async function main() {
  console.log(`Testing against ${BASE}  (test phone +${TEST_PHONE})`)

  // Clean any leftover test athlete
  const existing = await fetch(`${BASE}/api/members/phone/${TEST_PHONE}`).then(r => (r.ok ? r.json() : null))
  if (existing?.member) {
    await fetch(`${BASE}/api/members/${existing.member.id}`, { method: 'DELETE' })
    console.log(`  (removed leftover test athlete ${existing.member.memberId})`)
  }

  // Fake Meta CDN serving the encrypted photo
  const photo = fs.readFileSync(path.resolve(__dirname, '../public/athletes/3.png'))
  const { cdnFile, encryption_metadata } = encryptLikeMetaCdn(photo)
  const cdn = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
    res.end(cdnFile)
  })
  await new Promise(r => cdn.listen(0, '127.0.0.1', r))
  const cdnUrl = `http://127.0.0.1:${cdn.address().port}/photo.enc`

  try {
    // 0. ping
    const ping = await fetch(FLOW_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ping', version: '3.0' }) }).then(r => r.json())
    expect(ping?.data?.status === 'active', 'unencrypted ping -> active')

    // 1. "Hi" from a new number -> main menu with Register Athlete
    console.log(`\n▶ WEBHOOK: "Hi" from new number`)
    expect((await webhook({ type: 'text', text: { body: 'Hi' } })) === 200, 'webhook accepted "Hi" (see backend log: menu for NEW athlete)')

    // 2. INIT -> unregistered -> REG_LOCATION
    const init = await flow({ action: 'INIT' })
    show('INIT (new number)', init)
    expect(init.screen === 'REG_LOCATION', 'INIT opens REG_LOCATION for an unregistered number')
    expect(init.data.contact_number === '+91 90000 00001', 'mobile auto-filled from WhatsApp number')

    // 3. Step 1 validation error, then success
    const bad1 = await flow({ action: 'data_exchange', screen: 'REG_LOCATION', data: { ...init.data, full_name: 'A', state: 'Tamil Nadu', district: 'Chennai', assembly: 'Velachery', zone: 'Ward 25' } })
    show('STEP 1 with 1-letter name', bad1)
    expect(bad1.screen === 'REG_LOCATION' && bad1.data.has_error === true, 'short name is rejected and stays on step 1')

    const s1 = await flow({ action: 'data_exchange', screen: 'REG_LOCATION', data: { ...init.data, full_name: 'Test Athlete Flow', state: 'Tamil Nadu', district: 'Chennai', assembly: 'Velachery', zone: 'Ward 25' } })
    show('STEP 1 ok', s1)
    expect(s1.screen === 'REG_DOB' && s1.data.has_error === false, 'step 1 -> REG_DOB')

    // 4. Step 2: DatePicker ms timestamp for 15 Aug 1999
    const dobMs = String(Date.UTC(1999, 7, 15))
    const s2 = await flow({ action: 'data_exchange', screen: 'REG_DOB', data: { ...s1.data, dob: dobMs } })
    show('STEP 2 dob', s2)
    expect(s2.screen === 'REG_DETAILS' && s2.data.dob_display === '15 Aug 1999', 'step 2 -> REG_DETAILS with dob formatted')
    expect(/^\d+ Years$/.test(s2.data.age), `age auto-calculated: ${s2.data.age}`)

    // 5. Step 3: missing photo rejected, then photo decrypted + uploaded
    const noPhoto = await flow({ action: 'data_exchange', screen: 'REG_DETAILS', data: { ...s2.data, blood_group: 'O+', address: 'No. 12, 3rd Street, Velachery, Chennai - 600042', photo: [] } })
    show('STEP 3 without photo', noPhoto)
    expect(noPhoto.screen === 'REG_DETAILS' && noPhoto.data.has_error === true, 'photo is mandatory')

    const s3 = await flow({
      action: 'data_exchange',
      screen: 'REG_DETAILS',
      data: {
        ...s2.data,
        blood_group: 'O+',
        address: 'No. 12, 3rd Street, Velachery, Chennai - 600042',
        photo: [{ file_name: 'athlete.png', media_id: 'media-test-1', cdn_url: cdnUrl, encryption_metadata }],
      },
    })
    show('STEP 3 with photo', s3)
    expect(s3.screen === 'REG_CONFIRM', 'step 3 -> REG_CONFIRM')
    expect(typeof s3.data.photo_preview === 'string' && s3.data.photo_preview.length > 1000, 'photo preview (base64) returned for the confirm screen')
    expect(/^https?:\/\//.test(s3.data.photo_url), `photo uploaded to Cloudinary: ${s3.data.photo_url}`)

    // 6. Step 4: confirm -> member saved + card generated
    const s4 = await flow({ action: 'data_exchange', screen: 'REG_CONFIRM', data: { ...s3.data, photo_preview: '', confirm: true } })
    show('STEP 4 submit', s4)
    expect(s4.screen === 'REG_SUCCESS' && /^ISYDCI-[0-9A-F]{8}$/.test(s4.data.member_id), `registered with Member ID ${s4.data.member_id}`)

    const saved = await fetch(`${BASE}/api/members/phone/${TEST_PHONE}`).then(r => r.json())
    expect(saved.success && saved.member.memberId === s4.data.member_id, 'member is in backend/data/members.json (admin panel)')
    expect(/^https?:\/\//.test(saved.member.cardFullUrl || ''), `card image generated: ${saved.member.cardFullUrl}`)
    expect(saved.member.age === s2.data.age && saved.member.dob === '15 Aug 1999', 'dob/age stored correctly')

    // 7. Flow completion webhook -> success message + card
    console.log(`\n▶ WEBHOOK: flow completed (nfm_reply)`)
    expect((await webhook({ type: 'interactive', interactive: { type: 'nfm_reply', nfm_reply: { name: 'flow', body: 'Sent', response_json: JSON.stringify({ status: 'REGISTERED', member_id: s4.data.member_id, name: s4.data.name }) } } })) === 200, 'webhook accepted flow completion (see log: success + card)')

    // 8. "Hi" again -> welcome back, no register option
    console.log(`\n▶ WEBHOOK: "Hi" from the now-registered number`)
    expect((await webhook({ type: 'text', text: { body: 'Hi' } })) === 200, 'webhook accepted "Hi" (see log: WELCOME BACK + card)')

    // 9. INIT again -> CARD_VIEW (already registered)
    const init2 = await flow({ action: 'INIT' })
    show('INIT (registered number)', init2)
    expect(init2.screen === 'CARD_VIEW' && init2.data.member_id === s4.data.member_id, 'INIT opens CARD_VIEW for a registered number (no re-registration)')

    // 10. Submitting again with same phone updates instead of duplicating
    const again = await flow({ action: 'data_exchange', screen: 'REG_CONFIRM', data: { ...s3.data, full_name: 'Test Athlete Flow', photo_preview: '', confirm: true } })
    expect(again.data.member_id === s4.data.member_id, 'resubmitting the same phone keeps the same Member ID (no duplicate)')

    await new Promise(r => setTimeout(r, 1500)) // let async webhook sends log

    if (!KEEP) {
      await fetch(`${BASE}/api/members/${saved.member.id}`, { method: 'DELETE' })
      console.log(`\n🧹 Test athlete ${saved.member.memberId} removed from the database.`)
    } else {
      console.log(`\n📌 Test athlete ${saved.member.memberId} kept (--keep).`)
    }
    console.log('\n✅ ALL LOCAL FLOW + WEBHOOK TESTS PASSED\n')
  } finally {
    cdn.close()
  }
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
