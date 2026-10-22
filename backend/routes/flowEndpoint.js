// Meta WhatsApp Flows data endpoint for the ISYDCI athlete registration flow.
//
// Screens (see wacto/isydci_flow_v2.json):
//   REG_LOCATION -> REG_DOB -> REG_DETAILS (photo) -> REG_CONFIRM -> REG_SUCCESS (terminal)
//   CARD_VIEW (terminal) is opened on INIT when the phone number is already registered.
//
// Every screen transition is a data_exchange so each step is validated and logged here.

import express from 'express'
import crypto from 'crypto'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { saveMember, findMemberByPhone, phoneKey } from '../db/db.js'
import { decryptFlowMedia, toDataUri } from '../services/flowMedia.js'
import { uploadToCloudinary } from '../config/cloudinary.js'
import { generateAndUploadCard, cloudinaryFolderFor, SITE_URL } from '../services/cardRenderer.js'

const router = express.Router()

export const SCREENS = {
  LOCATION: 'REG_LOCATION',
  DOB: 'REG_DOB',
  DETAILS: 'REG_DETAILS',
  CONFIRM: 'REG_CONFIRM',
  SUCCESS: 'REG_SUCCESS',
  CARD: 'CARD_VIEW',
}

const REG_FIELDS = ['full_name', 'contact_number', 'state', 'district', 'assembly', 'zone', 'dob', 'dob_display', 'age', 'blood_group', 'address', 'photo_url']

// ---------------------------------------------------------------- crypto helpers

function decryptFlowRequest(body, privateKeyPem) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new Error('Missing encryption fields (encrypted_aes_key, encrypted_flow_data, initial_vector)')
  }
  const privateKey = crypto.createPrivateKey(privateKeyPem.replace(/\\n/g, '\n'))
  const aesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(encrypted_aes_key, 'base64')
  )
  const iv = Buffer.from(initial_vector, 'base64')
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64')
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16)
  const ciphertext = flowDataBuffer.subarray(0, flowDataBuffer.length - 16)
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return { decryptedData: JSON.parse(decrypted.toString('utf8')), aesKey, iv }
}

function encryptFlowResponse(responseObj, aesKey, iv) {
  const flippedIv = Buffer.from(iv.map(b => b ^ 0xff))
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(responseObj), 'utf8'), cipher.final()])
  return Buffer.concat([ciphertext, cipher.getAuthTag()]).toString('base64')
}

// ---------------------------------------------------------------- formatting helpers

function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: true })
}

export function formatPhoneDisplay(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  const last10 = digits.slice(-10)
  const cc = digits.length > 10 ? digits.slice(0, digits.length - 10) : '91'
  return `+${cc} ${last10.slice(0, 5)} ${last10.slice(5)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Accepts DatePicker ms-timestamp strings, YYYY-MM-DD, or free text like "15 Aug 1999". */
export function parseDob(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  let date = null
  const str = String(raw).trim()
  if (/^\d{10,14}$/.test(str)) {
    date = new Date(Number(str))
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    date = new Date(Date.UTC(y, m - 1, d))
  } else {
    const t = Date.parse(str)
    if (!Number.isNaN(t)) date = new Date(t)
  }
  if (!date || Number.isNaN(date.getTime())) return null

  const now = new Date()
  let age = now.getUTCFullYear() - date.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())
  if (beforeBirthday) age -= 1

  const display = `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  return { date, age, display }
}

function clean(v, max = 120) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Pull the registration fields out of an incoming payload (strings only). */
function carryFrom(data = {}) {
  const out = {}
  for (const key of REG_FIELDS) out[key] = typeof data[key] === 'string' ? data[key] : ''
  return out
}

function screenResponse(screen, data, extra = {}) {
  return { screen, data: { ...data, has_error: false, error_message: '', ...extra } }
}

function errorResponse(screen, data, message) {
  console.log(`   ⚠️  Validation:  ${message}`)
  console.log(`   ↩️  Staying on:  [${screen}]`)
  return { screen, data: { ...data, has_error: true, error_message: message } }
}

async function makePhotoPreview(buffer) {
  const img = await loadImage(buffer)
  const size = 280
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const scale = Math.max(size / img.width, size / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  return canvas.toBuffer('image/jpeg', 80).toString('base64')
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))])
}

// ---------------------------------------------------------------- member helpers

function memberCardData(member) {
  return {
    name: member.name || '',
    member_id: member.memberId || '',
    state: member.state || '',
    district: member.district || '',
    assembly: member.assembly || '',
    dob: member.dob || '',
    blood_group: member.bloodGroup || '',
    contact: member.contact || '',
    status: member.status === 'Pending' ? 'Pending Verification' : 'Verified Athlete ✅',
    card_url: member.cardFullUrl || `${SITE_URL}/membership-card?id=${encodeURIComponent(member.memberId || '')}`,
  }
}

/** Save (or update, when the phone is already registered) and generate the card image. */
export async function registerFromFlow(fields, senderPhone) {
  // The WhatsApp sender number (flow_token) is authoritative; the form never asks for it
  const contactDigits = phoneKey(senderPhone || fields.contact_number)
  const existing = findMemberByPhone(contactDigits)
  const memberId = existing?.memberId || `ISYDCI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

  const record = {
    id: existing?.id,
    name: clean(fields.full_name, 60).toUpperCase(),
    memberId,
    contact: formatPhoneDisplay(contactDigits),
    state: clean(fields.state, 60).toUpperCase(),
    district: clean(fields.district, 60).toUpperCase(),
    assembly: clean(fields.assembly, 60),
    zone: clean(fields.zone, 60).toUpperCase(),
    dob: fields.dob_display || fields.dob || '',
    age: fields.age || '',
    bloodGroup: clean(fields.blood_group, 5).toUpperCase(),
    address: clean(fields.address, 300),
    photoUrl: fields.photo_url || existing?.photoUrl || '/athletes/1.png',
    photo: fields.photo_url || existing?.photoUrl || '/athletes/1.png',
    cloudinaryFolder: existing?.cloudinaryFolder,
    status: 'Verified',
    business: existing?.business || 'No business',
    source: 'whatsapp_flow',
    joinedDate: existing?.joinedDate,
  }
  record.cloudinaryFolder = record.cloudinaryFolder || cloudinaryFolderFor(record)

  let saved = saveMember(record)
  console.log(`   💾 ${existing ? 'MEMBER UPDATED' : 'NEW MEMBER SAVED'} -> backend/data/members.json`)
  console.log(`   👤 Athlete:       ${saved.name}`)
  console.log(`   🆔 Member ID:     ${saved.memberId}`)
  console.log(`   📞 Mobile:        ${saved.contact}`)
  console.log(`   📍 Location:      ${saved.state} / ${saved.district} / ${saved.assembly} / ${saved.zone}`)
  console.log(`   🎂 DOB / Age:     ${saved.dob} / ${saved.age}`)
  console.log(`   🩸 Blood Group:   ${saved.bloodGroup}`)
  console.log(`   📷 Photo:         ${saved.photoUrl}`)

  console.log(`   🪪 Rendering Front & Back membership card...`)
  const cardUrl = await withTimeout(generateAndUploadCard(saved), 8000, '')
  if (cardUrl) {
    saved = saveMember({ ...saved, cardFullUrl: cardUrl })
    console.log(`   ☁️  Card URL:      ${cardUrl}`)
  } else {
    console.log(`   ⏳ Card image not ready yet — it will be generated when the card is sent on WhatsApp.`)
  }
  return saved
}

// ---------------------------------------------------------------- routes

router.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log(`🔔 [WHATSAPP FLOW WEBHOOK VERIFIED ${getTimestamp()}] challenge accepted ✅`)
    return res.status(200).send(challenge)
  }

  console.log(`⚡ [FLOW ENDPOINT HEALTH CHECK ${getTimestamp()}] Status: ONLINE 🟢`)
  res.json({ status: 'active', service: 'ISYDCI WhatsApp Flow Endpoint', timestamp: new Date().toISOString() })
})

router.post('/', async (req, res) => {
  const time = getTimestamp()

  try {
    if (req.body && req.body.action === 'ping') {
      console.log(`⚡ [WHATSAPP FLOW PING ${time}] Meta health-check (unencrypted) -> active 🟢`)
      return res.json({ data: { status: 'active' } })
    }

    const privateKeyPem = process.env.WHATSAPP_PRIVATE_KEY
    if (!privateKeyPem) {
      console.log(`❌ [WHATSAPP FLOW ERROR ${time}] Missing WHATSAPP_PRIVATE_KEY in backend/.env`)
      return res.status(500).json({ error: 'Private key not configured' })
    }

    let decryptedData, aesKey, iv
    try {
      ;({ decryptedData, aesKey, iv } = decryptFlowRequest(req.body, privateKeyPem))
    } catch (decErr) {
      console.log(`\n======================================================`)
      console.log(`❌ [WHATSAPP FLOW DECRYPTION ERROR ${time}]`)
      console.log(`   Error:   ${decErr.message}`)
      console.log(`   Hint:    The private key in backend/.env must match the public key uploaded to Meta.`)
      console.log(`======================================================\n`)
      // 421 tells Meta to re-fetch the public key and retry
      return res.status(421).json({ error: 'Decryption failed' })
    }

    const { action, screen, data = {}, flow_token: flowToken } = decryptedData
    const senderPhone = String(flowToken || '').replace(/\D/g, '')

    console.log(`\n======================================================`)
    console.log(`📱 [WHATSAPP FLOW ${time}]  action=[${action}]  screen=[${screen || 'INIT'}]`)
    if (senderPhone) console.log(`   📞 From:          +${senderPhone}`)
    const logData = { ...data }
    if (logData.photo) logData.photo = Array.isArray(logData.photo) ? `[${logData.photo.length} photo(s) uploaded]` : '[photo uploaded]'
    if (logData.photo_preview) logData.photo_preview = '[base64 preview]'
    if (Object.keys(logData).length) console.log(`   📦 Payload:       ${JSON.stringify(logData)}`)

    let response

    if (action === 'ping') {
      response = { data: { status: 'active' } }
    }

    // -------------------------------------------------- INIT: decide first screen
    else if (action === 'INIT') {
      const member = findMemberByPhone(senderPhone)
      if (member) {
        console.log(`   👤 Identity:      REGISTERED ATHLETE ✅  ${member.name} (${member.memberId})`)
        console.log(`   ➡️  Open screen:   [${SCREENS.CARD}]`)
        response = { screen: SCREENS.CARD, data: memberCardData(member) }
      } else {
        console.log(`   👤 Identity:      NEW ATHLETE (not in database)`)
        console.log(`   ➡️  Open screen:   [${SCREENS.LOCATION}] Step 1 of 4`)
        response = screenResponse(SCREENS.LOCATION, { ...carryFrom(), contact_number: formatPhoneDisplay(senderPhone) })
      }
    }

    // -------------------------------------------------- BACK: re-serve requested screen
    else if (action === 'BACK') {
      response = screenResponse(screen, carryFrom(data))
    }

    // -------------------------------------------------- data_exchange: step handlers
    else if (action === 'data_exchange') {
      const carry = carryFrom(data)
      if (!carry.contact_number) carry.contact_number = formatPhoneDisplay(senderPhone)

      if (screen === SCREENS.LOCATION) {
        carry.full_name = clean(data.full_name, 60)
        carry.state = clean(data.state, 60)
        carry.district = clean(data.district, 60)
        carry.assembly = clean(data.assembly, 60)
        carry.zone = clean(data.zone, 60)
        if (carry.full_name.length < 3) response = errorResponse(screen, carry, 'Please enter your full name (minimum 3 letters).')
        else if (!carry.state) response = errorResponse(screen, carry, 'Please select your State / Union Territory.')
        else if (!carry.district || !carry.assembly || !carry.zone) response = errorResponse(screen, carry, 'District, Assembly and Zone are required.')
        else {
          console.log(`   ✅ Step 1 of 4:   Name "${carry.full_name}" | ${carry.state} / ${carry.district} / ${carry.assembly} / ${carry.zone}`)
          console.log(`   ➡️  Next screen:   [${SCREENS.DOB}] Step 2 of 4`)
          response = screenResponse(SCREENS.DOB, carry)
        }
      }

      else if (screen === SCREENS.DOB) {
        const parsed = parseDob(data.dob)
        if (!parsed) response = errorResponse(screen, carry, 'Please select a valid date of birth.')
        else if (parsed.age < 5 || parsed.age > 100) response = errorResponse(screen, carry, 'Age must be between 5 and 100 years. Please check your date of birth.')
        else {
          carry.dob = String(data.dob)
          carry.dob_display = parsed.display
          carry.age = `${parsed.age} Years`
          console.log(`   ✅ Step 2 of 4:   DOB ${parsed.display} -> Age auto-calculated: ${parsed.age} Years`)
          console.log(`   ➡️  Next screen:   [${SCREENS.DETAILS}] Step 3 of 4`)
          response = screenResponse(SCREENS.DETAILS, carry)
        }
      }

      else if (screen === SCREENS.DETAILS) {
        carry.blood_group = clean(data.blood_group, 5)
        carry.address = clean(data.address, 300)
        // Accept either picker (Take Photo = camera, Upload Photo = gallery) or the legacy single picker
        const asList = v => (Array.isArray(v) ? v : v ? [v] : [])
        const photos = [...asList(data.photo_camera), ...asList(data.photo_gallery), ...asList(data.photo)].filter(p => p && p.cdn_url)
        if (!carry.blood_group) response = errorResponse(screen, carry, 'Please select your blood group.')
        else if (carry.address.length < 8) response = errorResponse(screen, carry, 'Please enter your full address.')
        else if (photos.length === 0) response = errorResponse(screen, carry, 'A passport-size photo is mandatory for the ID card. Please upload your photo.')
        else {
          try {
            console.log(`   📷 Photo upload:  ${photos[0].file_name || 'photo'} (media_id ${photos[0].media_id || '-'}) — decrypting from Meta CDN...`)
            const { buffer, mimeType } = await decryptFlowMedia(photos[0])
            console.log(`   🔓 Decrypted:     ${(buffer.length / 1024).toFixed(0)} KB ${mimeType}`)
            const folder = cloudinaryFolderFor({ name: carry.full_name })
            const upload = await uploadToCloudinary(toDataUri(buffer, mimeType), folder, 'profile_photo')
            carry.photo_url = upload?.secure_url?.startsWith('http') ? upload.secure_url : ''
            console.log(`   ☁️  Cloudinary:    ${carry.photo_url || 'upload failed (will retry on submit)'}`)
            const preview = await makePhotoPreview(buffer)
            console.log(`   ✅ Step 3 of 4:   Blood ${carry.blood_group} | Address "${carry.address}" | Photo OK`)
            console.log(`   ➡️  Next screen:   [${SCREENS.CONFIRM}] Step 4 of 4 (review & submit)`)
            response = screenResponse(SCREENS.CONFIRM, carry, { photo_preview: preview })
          } catch (photoErr) {
            console.log(`   ❌ Photo error:   ${photoErr.message}`)
            response = errorResponse(screen, carry, 'We could not read your photo. Please upload a clear JPG/PNG passport photo again.')
          }
        }
      }

      else if (screen === SCREENS.CONFIRM) {
        const confirmed = data.confirm === true || data.confirm === 'true' || data.confirmation === 'confirmed'
        if (!confirmed) {
          response = errorResponse(screen, carry, 'Please confirm that all the details are correct.', )
          response.data.photo_preview = typeof data.photo_preview === 'string' ? data.photo_preview : ''
        } else {
          console.log(`   📝 Step 4 of 4:   Details confirmed — registering athlete...`)
          const saved = await registerFromFlow(carry, senderPhone)
          console.log(`   ➡️  Next screen:   [${SCREENS.SUCCESS}] 🎉`)
          response = {
            screen: SCREENS.SUCCESS,
            data: {
              name: saved.name,
              member_id: saved.memberId,
              state: saved.state,
              district: saved.district,
              card_url: saved.cardFullUrl || `${SITE_URL}/membership-card?id=${encodeURIComponent(saved.memberId)}`,
            },
          }
        }
      }

      // Legacy single-screen flow (kept so an older published flow keeps working)
      else if (screen === 'ATHLETE_REGISTRATION') {
        const parsed = parseDob(data.dob)
        const legacy = {
          ...carry,
          full_name: clean(data.full_name, 60),
          dob: String(data.dob || ''),
          dob_display: parsed?.display || clean(data.dob, 20),
          age: parsed ? `${parsed.age} Years` : clean(data.age, 10),
        }
        const saved = await registerFromFlow(legacy, senderPhone)
        response = { screen: 'REG_SUCCESS', data: { name: saved.name, member_id: saved.memberId, sport: 'ATHLETICS', state: saved.state, district: saved.district, card_url: saved.cardFullUrl || '' } }
      }

      else {
        console.log(`   ⚠️  Unknown screen [${screen}] — restarting at Step 1`)
        response = screenResponse(SCREENS.LOCATION, { ...carryFrom(), contact_number: formatPhoneDisplay(senderPhone) })
      }
    }

    else {
      console.log(`   ⚠️  Unknown action [${action}]`)
      response = screenResponse(SCREENS.LOCATION, { ...carryFrom(), contact_number: formatPhoneDisplay(senderPhone) })
    }

    const encrypted = encryptFlowResponse(response, aesKey, iv)
    console.log(`   ✅ Responded 200 -> screen [${response.screen || 'ping'}]`)
    console.log(`======================================================\n`)
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(encrypted)
  } catch (err) {
    console.log(`\n======================================================`)
    console.log(`❌ [WHATSAPP FLOW PROCESSING ERROR ${time}]`)
    console.log(`   Error:   ${err.message}`)
    console.log(`   Stack:   ${err.stack}`)
    console.log(`======================================================\n`)
    return res.status(500).json({ error: err.message })
  }
})

export default router
