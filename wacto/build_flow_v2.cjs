// Builds the Meta WhatsApp Flow JSON (v6.0) for ISYDCI athlete registration.
// Output: wacto/isydci_flow_v2.json  (run: node wacto/build_flow_v2.cjs)
//
// Screens: REG_LOCATION -> REG_DOB -> REG_DETAILS -> REG_CONFIRM -> REG_SUCCESS
//          CARD_VIEW (terminal) for athletes whose number is already registered.
// Every Footer uses data_exchange so backend/routes/flowEndpoint.js validates each step.

const fs = require('fs')
const path = require('path')

const SITE_URL = 'https://isydci.com'

const STATES = [
  'Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]
const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

// Registration fields carried from screen to screen (must match REG_FIELDS in flowEndpoint.js)
const REG_EXAMPLES = {
  full_name: 'Amit Kumar',
  contact_number: '+91 91234 56789',
  state: 'Tamil Nadu',
  district: 'Chennai',
  assembly: 'Velachery',
  zone: 'Ward 25',
  dob: '934675200000',
  dob_display: '15 Aug 1999',
  age: '27 Years',
  blood_group: 'O+',
  address: 'No. 12, 3rd Street, Velachery, Chennai - 600042',
  photo_url: '',
}

const str = example => ({ type: 'string', __example__: example })

function regData(extra = {}) {
  const data = {}
  for (const [k, v] of Object.entries(REG_EXAMPLES)) data[k] = str(v)
  data.has_error = { type: 'boolean', __example__: false }
  data.error_message = str('')
  return { ...data, ...extra }
}

/** `${data.x}` for every carried field, so the endpoint always receives the full draft. */
function carryPayload(screen, formFields) {
  const payload = { screen }
  for (const k of Object.keys(REG_EXAMPLES)) payload[k] = `\${data.${k}}`
  for (const [k, v] of Object.entries(formFields)) payload[k] = v
  return payload
}

const errorCaption = {
  type: 'TextCaption',
  text: '${data.error_message}',
  visible: '${data.has_error}',
}

const screens = [
  // ------------------------------------------------------------------ STEP 1
  {
    id: 'REG_LOCATION',
    title: 'Athlete Registration',
    terminal: false,
    data: regData(),
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: 'Athlete Registration' },
        { type: 'TextSubheading', text: 'Step 1 of 4 · Personal & location details' },
        { type: 'TextBody', text: 'Ministry Reg No: 49/1997 | New Delhi HQ' },
        { type: 'TextBody', text: '📞 Mobile Number • ${data.contact_number}' },
        { type: 'TextCaption', text: 'Automatically detected from your WhatsApp account — no need to type it.' },
        errorCaption,
        {
          type: 'Form',
          name: 'location_form',
          children: [
            { type: 'TextInput', name: 'full_name', label: 'Full Name', required: true, 'input-type': 'text', 'helper-text': 'Official name as per Govt ID' },
            { type: 'Dropdown', name: 'state', label: 'State / Union Territory', required: true, 'data-source': STATES.map(s => ({ id: s, title: s })) },
            { type: 'TextInput', name: 'district', label: 'District', required: true, 'input-type': 'text', 'helper-text': 'e.g. Chennai' },
            { type: 'TextInput', name: 'assembly', label: 'Assembly / Constituency', required: true, 'input-type': 'text', 'helper-text': 'e.g. Velachery' },
            { type: 'TextInput', name: 'zone', label: 'Zone / Ward / Area', required: true, 'input-type': 'text', 'helper-text': 'e.g. Ward 25' },
            {
              type: 'Footer',
              label: 'Continue',
              'on-click-action': {
                name: 'data_exchange',
                payload: carryPayload('REG_LOCATION', {
                  full_name: '${form.full_name}',
                  state: '${form.state}',
                  district: '${form.district}',
                  assembly: '${form.assembly}',
                  zone: '${form.zone}',
                }),
              },
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------ STEP 2
  {
    id: 'REG_DOB',
    title: 'Date of Birth & Age',
    terminal: false,
    data: regData(),
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: 'Date of Birth & Age' },
        { type: 'TextSubheading', text: 'Step 2 of 4 · Please provide your date of birth' },
        { type: 'TextBody', text: 'Athlete • ${data.full_name}\nMobile • ${data.contact_number}' },
        errorCaption,
        {
          type: 'Form',
          name: 'dob_form',
          children: [
            { type: 'DatePicker', name: 'dob', label: 'Date of Birth', required: true, 'helper-text': 'Age will be calculated automatically based on your date of birth.' },
            {
              type: 'Footer',
              label: 'Continue',
              'on-click-action': {
                name: 'data_exchange',
                payload: carryPayload('REG_DOB', { dob: '${form.dob}' }),
              },
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------ STEP 3
  {
    id: 'REG_DETAILS',
    title: 'Additional Information',
    terminal: false,
    data: regData(),
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: 'Additional Information' },
        { type: 'TextSubheading', text: 'Step 3 of 4 · Please complete the remaining details' },
        { type: 'TextBody', text: 'Date of Birth • ${data.dob_display}\nAge • ${data.age} auto-calculated' },
        errorCaption,
        {
          type: 'Form',
          name: 'details_form',
          children: [
            { type: 'Dropdown', name: 'blood_group', label: 'Blood Group', required: true, 'data-source': BLOOD_GROUPS.map(b => ({ id: b, title: b })) },
            { type: 'TextArea', name: 'address', label: 'Full Address', required: true, 'helper-text': 'House no, street, locality, city - pincode' },
            {
              type: 'PhotoPicker',
              name: 'photo',
              label: 'Upload Your Photo',
              description: 'Choose a clear passport-size photo from your gallery. Photo is mandatory for your ID card. JPG or PNG, max 5 MB.',
              'photo-source': 'gallery',
              'min-uploaded-photos': 1,
              'max-uploaded-photos': 1,
              'max-file-size-kb': 5120,
            },
            {
              type: 'Footer',
              label: 'Continue',
              'on-click-action': {
                name: 'data_exchange',
                payload: carryPayload('REG_DETAILS', {
                  blood_group: '${form.blood_group}',
                  address: '${form.address}',
                  photo: '${form.photo}',
                }),
              },
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------ STEP 4
  {
    id: 'REG_CONFIRM',
    title: 'Confirm Your Details',
    terminal: false,
    data: regData({ photo_preview: str('') }),
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: 'Confirm Your Details' },
        { type: 'TextSubheading', text: 'Step 4 of 4 · Please review your details before submitting' },
        errorCaption,
        { type: 'Image', src: '${data.photo_preview}', width: 150, height: 150, 'scale-type': 'cover', 'alt-text': 'Athlete passport photo' },
        {
          type: 'TextBody',
          text:
            '👤 Full Name • ${data.full_name}\n' +
            '📞 Mobile Number • ${data.contact_number}\n' +
            '🏛️ State • ${data.state}\n' +
            '📍 District • ${data.district}\n' +
            '📍 Assembly • ${data.assembly}\n' +
            '📍 Zone • ${data.zone}\n' +
            '📅 Date of Birth • ${data.dob_display}\n' +
            '🎂 Age • ${data.age}\n' +
            '🩸 Blood Group • ${data.blood_group}\n' +
            '🏠 Address • ${data.address}\n' +
            '📷 Photo • Uploaded ✅',
        },
        {
          type: 'Form',
          name: 'confirm_form',
          children: [
            { type: 'OptIn', name: 'confirm', label: 'I confirm that all the details are correct.', required: true },
            {
              type: 'Footer',
              label: 'Submit Registration',
              'on-click-action': {
                name: 'data_exchange',
                payload: carryPayload('REG_CONFIRM', { confirm: '${form.confirm}' }),
              },
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------ SUCCESS
  {
    id: 'REG_SUCCESS',
    title: 'Registration Successful',
    terminal: true,
    data: {
      name: str('AMIT KUMAR'),
      member_id: str('ISYDCI-684DDC04'),
      state: str('TAMIL NADU'),
      district: str('CHENNAI'),
      card_url: str(`${SITE_URL}/membership-card?id=ISYDCI-684DDC04`),
    },
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: '🎉 Registration Successful!' },
        { type: 'TextSubheading', text: 'Welcome to the ISYDCI National Sports Community' },
        {
          type: 'TextBody',
          text:
            'Thank you ${data.name}!\n\n' +
            'Your athlete registration has been saved in the ISYDCI National Database.\n\n' +
            '🆔 Member ID • ${data.member_id}\n' +
            '📍 State • ${data.state}\n' +
            '📍 District • ${data.district}\n' +
            '✅ Status • Verified Athlete\n\n' +
            'Tap Done to receive your official Front and Back membership card here in WhatsApp.',
        },
        {
          type: 'Footer',
          label: 'Done',
          'on-click-action': {
            name: 'complete',
            payload: { status: 'REGISTERED', member_id: '${data.member_id}', name: '${data.name}' },
          },
        },
      ],
    },
  },

  // ------------------------------------------------------------------ ALREADY REGISTERED
  {
    id: 'CARD_VIEW',
    title: 'My Membership Card',
    terminal: true,
    data: {
      name: str('AMIT KUMAR'),
      member_id: str('ISYDCI-684DDC04'),
      state: str('TAMIL NADU'),
      district: str('CHENNAI'),
      assembly: str('Velachery'),
      dob: str('15 Aug 1999'),
      blood_group: str('O+'),
      contact: str('+91 91234 56789'),
      status: str('Verified Athlete ✅'),
      card_url: str(`${SITE_URL}/membership-card?id=ISYDCI-684DDC04`),
    },
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextHeading', text: '🪪 You are already registered' },
        { type: 'TextSubheading', text: 'ISYDCI Verified Athlete Membership' },
        {
          type: 'TextBody',
          text:
            '👤 Athlete • ${data.name}\n' +
            '🆔 Member ID • ${data.member_id}\n' +
            '📍 ${data.state} • ${data.district}\n' +
            '📅 DOB • ${data.dob}\n' +
            '🩸 Blood Group • ${data.blood_group}\n' +
            '📞 Mobile • ${data.contact}\n' +
            'Status • ${data.status}\n\n' +
            'Tap below to receive your Front and Back membership card in WhatsApp.',
        },
        {
          type: 'Footer',
          label: 'Get My Card',
          'on-click-action': {
            name: 'complete',
            payload: { action: 'GET_CARD', member_id: '${data.member_id}', name: '${data.name}' },
          },
        },
      ],
    },
  },
]

/**
 * Meta's dynamic-text syntax: a backtick expression where literal text is a quoted string and
 * ${data.x} references are bare, e.g.  `'Mobile • ' ${data.contact_number}`.
 * Newlines are not allowed inside, so multi-line texts become one component per line.
 */
const quote = str => "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
const isPureRef = line => /^\$\{[^}]+\}$/.test(line.trim())
function toConcat(line) {
  const parts = []
  const re = /\$\{[^}]+\}/g
  let last = 0
  let m
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(quote(line.slice(last, m.index)))
    parts.push(m[0])
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push(quote(line.slice(last)))
  return '`' + parts.join(' ') + '`'
}
function expandDynamicText(node) {
  if (Array.isArray(node)) return node.forEach(expandDynamicText)
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node.children)) {
    node.children = node.children.flatMap(c => {
      if (c && typeof c.text === 'string' && c.text.includes('${') && !isPureRef(c.text)) {
        return c.text
          .split('\n')
          .filter(l => l.trim() !== '')
          .map(l => ({ ...c, text: isPureRef(l) ? l.trim() : toConcat(l) }))
      }
      return [c]
    })
  }
  Object.values(node).forEach(expandDynamicText)
}

const flow = {
  version: '6.0',
  data_api_version: '3.0',
  routing_model: {
    REG_LOCATION: ['REG_DOB', 'CARD_VIEW'], // endpoint may route a registered number straight to CARD_VIEW
    REG_DOB: ['REG_DETAILS'],
    REG_DETAILS: ['REG_CONFIRM'],
    REG_CONFIRM: ['REG_SUCCESS'],
    REG_SUCCESS: [],
    CARD_VIEW: [],
  },
  screens,
}

expandDynamicText(flow.screens)

const outPath = path.join(__dirname, 'isydci_flow_v2.json')
fs.writeFileSync(outPath, JSON.stringify(flow, null, 2), 'utf8')

if (require.main === module) {
  console.log(`✅ Flow JSON written: ${outPath}`)
  console.log(`   screens: ${screens.map(s => s.id).join(' → ')}`)
  console.log(`   size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`)
}

module.exports = { flow, outPath }
