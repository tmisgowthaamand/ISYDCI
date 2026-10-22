// Meta WhatsApp Cloud API webhook for the ISYDCI athlete bot.
//
//  New athlete   : "Hi" -> Choose Option list -> Register Athlete -> 4-step Flow -> card delivered in chat
//  Registered    : "Hi" -> "Welcome back, NAME" + membership card image + View & Download button
//                  (Register Athlete is never offered again once the phone number is in the database)

import express from 'express'
import { findMemberByPhone, saveMember, getMemberById } from '../db/db.js'
import { generateAndUploadCard, SITE_URL } from '../services/cardRenderer.js'
import { registerFromFlow, parseDob, formatPhoneDisplay } from './flowEndpoint.js'

const router = express.Router()

const ORG_NAME = 'International Sports & Youth Development Campaign of India (ISYDCI)'
const HELPLINE = '+91 99946 27551'
const REG_NO = '49/1997'

function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: true })
}

function cardPageUrl(member) {
  return `${SITE_URL}/membership-card?id=${encodeURIComponent(member.memberId || '')}`
}

// ---------------------------------------------------------------- Cloud API senders

async function sendWhatsApp(recipient, payload) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) {
    console.log(`❌ [WHATSAPP CONFIG] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing in backend/.env`)
    return null
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, ...payload }),
    })
    const data = await res.json()
    const kind = payload.type === 'interactive' ? `interactive/${payload.interactive?.type}` : payload.type
    if (res.ok && data.messages) {
      console.log(`📤 [WHATSAPP SENT] ${kind} -> +${recipient} (id ${data.messages[0]?.id}) ✅`)
    } else {
      console.log(`❌ [WHATSAPP SEND ERROR] ${kind} -> +${recipient}: ${JSON.stringify(data.error || data)}`)
    }
    return data
  } catch (err) {
    console.error(`❌ [WHATSAPP SEND EXCEPTION] -> +${recipient}: ${err.message}`)
    return null
  }
}

const sendText = (to, body) => sendWhatsApp(to, { type: 'text', text: { body, preview_url: false } })

const sendImage = (to, link, caption) => sendWhatsApp(to, { type: 'image', image: { link, caption } })

function sendCtaUrl(to, { header, body, footer, buttonText, url }) {
  return sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      ...(header ? { header: { type: 'text', text: header } } : {}),
      body: { text: body },
      ...(footer ? { footer: { text: footer } } : {}),
      action: { name: 'cta_url', parameters: { display_text: buttonText, url } },
    },
  })
}

function sendReplyButtons(to, body, buttons, footer) {
  return sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      ...(footer ? { footer: { text: footer } } : {}),
      action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  })
}

async function markAsRead(messageId) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId || !messageId) return
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
    })
  } catch (_) {}
}

// ---------------------------------------------------------------- conversation pieces

/** "Choose Option" list. Registered athletes get "My Membership Card" instead of "Register Athlete". */
function sendMainMenu(to, member) {
  const membershipRows = member
    ? [{ id: 'row_card', title: 'My Membership Card', description: 'View & download your official athlete ID card' }]
    : [{ id: 'row_register', title: 'Register Athlete', description: 'New membership registration & ID card issuance' }]

  const body = member
    ? `🏆 *Welcome back, ${member.name}!*\n\nYou are a verified ISYDCI athlete member.\n🆔 Member ID: *${member.memberId}*\n\nPlease tap below to choose an option:`
    : `🏆 *Welcome to ${ORG_NAME}!*\n\nOfficial National Sports Council accreditation & athlete membership portal.\n\n📍 Ministry Reg No: ${REG_NO} | New Delhi HQ\n\nPlease tap below to choose an option:`

  return sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'ISYDCI National Council' },
      body: { text: body },
      footer: { text: 'Official WhatsApp Athlete Portal' },
      action: {
        button: 'Choose Option',
        sections: [
          { title: 'Athlete Membership', rows: membershipRows },
          {
            title: 'Council Information',
            rows: [
              { id: 'row_about', title: 'About ISYDCI', description: 'Council accreditation & ministry recognition' },
              { id: 'row_website', title: 'Official Website', description: `Visit ${SITE_URL.replace(/^https?:\/\//, '')}` },
              { id: 'row_contact', title: 'Contact Support', description: `Helpline: ${HELPLINE} & office desk` },
            ],
          },
        ],
      },
    },
  })
}

/** Opens the 4-step registration Flow. INIT on our endpoint decides the first screen. */
async function sendRegistrationFlow(to) {
  const flowId = process.env.WHATSAPP_FLOW_ID
  if (!flowId) {
    console.log(`❌ [FLOW CONFIG] WHATSAPP_FLOW_ID missing in backend/.env — sending website link instead`)
    return sendCtaUrl(to, {
      header: 'ISYDCI National Council',
      body: '🏅 *ISYDCI Athlete Registration*\n\nTap below to complete your athlete membership on our official portal.',
      buttonText: 'Register Athlete',
      url: `${SITE_URL}/register`,
    })
  }

  console.log(`\n======================================================`)
  console.log(`📤 [SENDING REGISTRATION FLOW] Flow ID ${flowId} -> +${to}`)
  console.log(`   Steps: 1 Location → 2 Date of Birth → 3 Details & Photo → 4 Confirm → Card issued`)
  console.log(`======================================================`)

  const res = await sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: { type: 'text', text: 'ISYDCI Athlete Registration' },
      body: {
        text: '🏅 *Register as an ISYDCI Athlete*\n\nComplete 4 quick steps to receive your official Front & Back digital membership card:\n\n1️⃣ Personal & location details\n2️⃣ Date of birth (age auto-calculated)\n3️⃣ Blood group, address & passport photo\n4️⃣ Confirm & submit',
      },
      footer: { text: `Ministry Reg No: ${REG_NO} | New Delhi HQ` },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: `${to}`,
          flow_id: flowId,
          flow_cta: 'Register Athlete',
          flow_action: 'data_exchange',
        },
      },
    },
  })

  if (res?.error) {
    console.log(`   🔄 Flow message failed — falling back to website registration link`)
    return sendCtaUrl(to, {
      header: 'ISYDCI National Council',
      body: '🏅 *ISYDCI Athlete Registration*\n\nTap below to complete your athlete membership on our official portal.',
      buttonText: 'Register Athlete',
      url: `${SITE_URL}/register`,
    })
  }
  return res
}

async function ensureCardUrl(member) {
  if (member.cardFullUrl && member.cardFullUrl.startsWith('http')) return member
  console.log(`   🪪 No card image stored for ${member.memberId} — rendering now...`)
  const url = await generateAndUploadCard(member)
  if (!url) return member
  return saveMember({ ...member, cardFullUrl: url })
}

/** Sends the card image + the "View & Download Card" button. */
async function sendMembershipCard(to, memberIn) {
  const member = await ensureCardUrl(memberIn)
  const caption =
    `🪪 *Official ISYDCI Athlete Membership Card*\n\n` +
    `👤 Athlete: *${member.name}*\n🆔 Member ID: *${member.memberId}*\n` +
    `📍 ${member.state || ''}${member.district ? ` • ${member.district}` : ''}\n` +
    `🩸 Blood Group: ${member.bloodGroup || '-'}\n` +
    `✅ Status: Verified Athlete (Reg No: ${REG_NO})`

  if (member.cardFullUrl && member.cardFullUrl.startsWith('http')) {
    await sendImage(to, member.cardFullUrl, caption)
  } else {
    await sendText(to, caption)
  }

  return sendCtaUrl(to, {
    body: `📥 Tap below to view, download or share your Front & Back membership card.\n\nType *Menu* anytime for more options.`,
    footer: 'ISYDCI Official Athlete Portal',
    buttonText: 'View & Download Card',
    url: cardPageUrl(member),
  })
}

/** Registered athlete says "Hi": Welcome back bubble + [View & Download Card] [Main Menu] (same as the simulator). */
function sendWelcomeBack(to, member) {
  console.log(`   👤 Registered athlete: ${member.name} (${member.memberId}) -> Welcome back + buttons`)
  return sendReplyButtons(
    to,
    `🏆 *Welcome back, ${member.name}!*\nYou are an accredited athlete member with ISYDCI.\n\n👤 Athlete: *${member.name}*\n🆔 ID: *${member.memberId}*\n📍 State: *${member.state || ''}*${member.district ? ` • ${member.district}` : ''}\n✓ Verified Athlete (Reg: ${REG_NO})`,
    [
      { id: 'btn_card', title: 'View & Download Card' },
      { id: 'btn_menu', title: 'Main Menu' },
    ],
    'Official WhatsApp Athlete Portal'
  )
}

async function sendAlreadyRegistered(to, member) {
  console.log(`   ℹ️  ${member.name} tried to register again -> showing existing card`)
  await sendText(
    to,
    `✅ *You are already registered, ${member.name}!*\n\nYour mobile number is linked to Member ID *${member.memberId}*. There is no need to register again.\n\nHere is your membership card 👇`
  )
  return sendMembershipCard(to, member)
}

async function sendNotRegistered(to) {
  await sendText(
    to,
    `⚠️ *No Member Record Found*\n\nYour mobile number (+${to}) is not yet registered in the ISYDCI National Athlete Database.\n\nTap *Register Athlete* below to complete your membership in 4 quick steps.`
  )
  return sendRegistrationFlow(to)
}

const sendAbout = to =>
  sendText(
    to,
    `🏛️ *About ISYDCI*\n\n${ORG_NAME} is a national sports accreditation & athlete development organisation.\n\n📍 Ministry Reg No: ${REG_NO} | New Delhi HQ\n🏅 National Championships, State Selection Trials & Athlete Welfare.\n\n🌐 Official Portal: ${SITE_URL}`
  )

const sendWebsite = to =>
  sendCtaUrl(to, {
    header: 'ISYDCI Official Website',
    body: `🌐 Access the athlete roster, national calendar, membership directory and card downloads on our official portal.`,
    buttonText: 'Open isydci.com',
    url: SITE_URL,
  })

const sendContact = to =>
  sendText(
    to,
    `📞 *ISYDCI Council Secretariat*\n\n📞 Helpline: ${HELPLINE}\n📧 Email: support@isydci.org\n🌐 Portal: ${SITE_URL}\n📍 Headquarters: VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001\n\n🕘 Office Hours: Mon – Sat, 9:30 AM – 6:00 PM IST`
  )

/** Flow finished (nfm_reply). The member was saved by the Flow endpoint on the confirm step. */
async function handleFlowCompletion(sender, payload) {
  let member = (payload.member_id && getMemberById(payload.member_id)) || findMemberByPhone(sender)

  // Legacy / fallback: a flow that completed without touching the endpoint still carries the fields
  if (!member && payload.full_name) {
    const parsed = parseDob(payload.dob)
    member = await registerFromFlow(
      {
        full_name: payload.full_name,
        contact_number: payload.contact_number || formatPhoneDisplay(sender),
        state: payload.state,
        district: payload.district,
        assembly: payload.assembly,
        zone: payload.zone,
        dob: String(payload.dob || ''),
        dob_display: parsed?.display || String(payload.dob || ''),
        age: parsed ? `${parsed.age} Years` : String(payload.age || ''),
        blood_group: payload.blood_group,
        address: payload.address,
        photo_url: '',
      },
      sender
    )
  }

  if (!member) {
    console.log(`   ⚠️  Flow completed but no member record found for +${sender}`)
    await sendText(sender, `⚠️ We could not find your registration. Please tap *Register Athlete* and submit the form again, or call ${HELPLINE}.`)
    return sendMainMenu(sender, null)
  }

  if (payload.action === 'GET_CARD') {
    console.log(`   🪪 Registered athlete requested card from flow -> ${member.name}`)
    return sendMembershipCard(sender, member)
  }

  console.log(`   🎉 Registration complete -> ${member.name} (${member.memberId})`)
  await sendText(
    sender,
    `🎉 *Hi ${member.name}, your registration is successful!*\n\nWelcome to ${ORG_NAME}.\n\n🆔 *Member ID:* ${member.memberId}\n📍 *State / District:* ${member.state}${member.district ? ` / ${member.district}` : ''}\n🩸 *Blood Group:* ${member.bloodGroup || '-'}\n✅ *Status:* Verified Athlete (Reg No: ${REG_NO})\n\nYour official Front & Back membership card is ready 👇`
  )
  return sendMembershipCard(sender, member)
}

// ---------------------------------------------------------------- webhook routes

router.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    console.log(`🔔 [WHATSAPP WEBHOOK VERIFIED ${getTimestamp()}] subscribed ✅`)
    return res.status(200).send(challenge)
  }
  console.log(`⚠️ [WHATSAPP WEBHOOK VERIFICATION FAILED ${getTimestamp()}] token mismatch`)
  return res.status(403).json({ error: 'Verification failed' })
})

// Meta retries webhooks; remember recent message ids so a retry never double-replies
const seenMessageIds = new Set()
function alreadyHandled(id) {
  if (!id) return false
  if (seenMessageIds.has(id)) return true
  seenMessageIds.add(id)
  if (seenMessageIds.size > 2000) seenMessageIds.delete(seenMessageIds.values().next().value)
  return false
}

router.post('/', async (req, res) => {
  const time = getTimestamp()
  const body = req.body || {}
  res.status(200).send('EVENT_RECEIVED')

  try {
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (!value) return

    for (const msg of value.messages || []) {
      if (alreadyHandled(msg.id)) {
        console.log(`↩️  [WHATSAPP DUPLICATE ${time}] message ${msg.id} already handled — skipped`)
        continue
      }
      const sender = msg.from
      const msgType = msg.type
      const member = findMemberByPhone(sender)
      markAsRead(msg.id)

      console.log(`\n======================================================`)
      console.log(`💬 [WHATSAPP INBOUND ${time}]  from +${sender}  type=${msgType}`)
      console.log(`   👤 Identity:   ${member ? `REGISTERED — ${member.name} (${member.memberId})` : 'NEW / UNREGISTERED'}`)

      // A. Flow completion
      if (msgType === 'interactive' && msg.interactive?.type === 'nfm_reply') {
        let payload = {}
        try {
          payload = JSON.parse(msg.interactive.nfm_reply.response_json || '{}')
        } catch (_) {
          payload = {}
        }
        console.log(`   🎯 FLOW COMPLETED  payload=${JSON.stringify(payload)}`)
        await handleFlowCompletion(sender, payload)
      }

      // B. List row / reply button
      else if (msgType === 'interactive') {
        const id = msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.id || ''
        const title = msg.interactive?.list_reply?.title || msg.interactive?.button_reply?.title || ''
        console.log(`   🔘 Tapped:     "${title}" (${id})`)

        if (id === 'btn_menu' || /^main menu$/i.test(title)) {
          await sendMainMenu(sender, member)
        } else if (id === 'row_register' || /register/i.test(title)) {
          if (member) await sendAlreadyRegistered(sender, member)
          else await sendRegistrationFlow(sender)
        } else if (id === 'row_card' || id === 'btn_card' || /card/i.test(title)) {
          if (member) await sendMembershipCard(sender, member)
          else await sendNotRegistered(sender)
        } else if (id === 'row_about') await sendAbout(sender)
        else if (id === 'row_website') await sendWebsite(sender)
        else if (id === 'row_contact') await sendContact(sender)
        else await sendMainMenu(sender, member)
      }

      // C. Plain text
      else if (msgType === 'text') {
        const text = (msg.text?.body || '').trim()
        const lower = text.toLowerCase()
        console.log(`   💬 Text:       "${text}"`)

        if (/\b(register|registration|join|sign ?up|new member)\b/.test(lower)) {
          if (member) await sendAlreadyRegistered(sender, member)
          else await sendRegistrationFlow(sender)
        } else if (/\b(card|id card|membership|download|my id)\b/.test(lower)) {
          if (member) await sendMembershipCard(sender, member)
          else await sendNotRegistered(sender)
        } else if (/\b(menu|options?|help)\b/.test(lower)) {
          await sendMainMenu(sender, member)
        } else if (/\babout\b/.test(lower)) await sendAbout(sender)
        else if (/\b(contact|support|helpline)\b/.test(lower)) await sendContact(sender)
        else if (/\b(website|site|portal)\b/.test(lower)) await sendWebsite(sender)
        else if (member) {
          // "Hi", "Hello" or anything else from a registered athlete -> welcome back + card
          await sendWelcomeBack(sender, member)
        } else {
          await sendMainMenu(sender, null)
        }
      }

      // D. Anything else (image, sticker, location, ...)
      else {
        console.log(`   ℹ️  Unsupported message type -> sending menu`)
        if (member) await sendWelcomeBack(sender, member)
        else await sendMainMenu(sender, null)
      }

      console.log(`======================================================\n`)
    }

    for (const st of value.statuses || []) {
      const recipient = st.recipient_id
      if (st.status === 'failed') {
        console.log(`❌ [WHATSAPP DELIVERY FAILED ${time}] -> +${recipient}: ${(st.errors || []).map(e => `${e.code} ${e.title}`).join('; ')}`)
      } else if (st.status === 'delivered') {
        console.log(`🚚 [WHATSAPP STATUS ${time}] delivered to +${recipient} ✅`)
      } else if (st.status === 'read') {
        console.log(`👁️  [WHATSAPP STATUS ${time}] read by +${recipient} ✅`)
      }
    }
  } catch (err) {
    console.error(`❌ [Webhook Handler Error ${time}]:`, err.message)
  }
})

export default router
