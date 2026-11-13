// Admin/setup utility for Meta WhatsApp Business Calling API (Graph API v24.0)
// Usage:
//   node scripts/configure_whatsapp_calling.mjs --status
//   node scripts/configure_whatsapp_calling.mjs --enable
//   node scripts/configure_whatsapp_calling.mjs --enable --hours
//   node scripts/configure_whatsapp_calling.mjs --enable --sip-host sip.example.com --sip-port 5061

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(path.join(ROOT, 'backend', '.env'))
loadEnvFile(path.join(ROOT, '.env'))

const GRAPH = 'https://graph.facebook.com/v24.0'
const TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID

const args = process.argv.slice(2)
const hasFlag = f => args.includes(f)
const getArg = name => {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null
}

const DEFAULT_CALL_HOURS = {
  status: 'ENABLED',
  timezone_id: 'Asia/Kolkata',
  weekly_operating_hours: [
    { day_of_week: 'MONDAY', open_time: '0930', close_time: '1800' },
    { day_of_week: 'TUESDAY', open_time: '0930', close_time: '1800' },
    { day_of_week: 'WEDNESDAY', open_time: '0930', close_time: '1800' },
    { day_of_week: 'THURSDAY', open_time: '0930', close_time: '1800' },
    { day_of_week: 'FRIDAY', open_time: '0930', close_time: '1800' },
    { day_of_week: 'SATURDAY', open_time: '0930', close_time: '1800' },
  ],
}

async function main() {
  if (!TOKEN || !PHONE_ID) {
    console.error('Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID in backend/.env')
    process.exit(1)
  }

  if (hasFlag('--status') || args.length === 0) {
    const r = await fetch(`${GRAPH}/${PHONE_ID}/settings?include_sip_credentials=true`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const data = await r.json()
    console.log('GET /settings ->', r.status, JSON.stringify(data, null, 2))
    return
  }

  const calling = {
    status: hasFlag('--disable') ? 'DISABLED' : 'ENABLED',
    call_icon_visibility: getArg('--icon') || 'DEFAULT',
    callback_permission_status: hasFlag('--no-callback') ? 'DISABLED' : 'ENABLED',
  }

  if (hasFlag('--hours')) {
    calling.call_hours = DEFAULT_CALL_HOURS
  }

  const sipHost = getArg('--sip-host')
  if (sipHost) {
    calling.sip = {
      status: 'ENABLED',
      servers: [
        {
          hostname: sipHost,
          port: Number(getArg('--sip-port') || 5061),
        },
      ],
    }
  }

  console.log('POST /settings payload:', JSON.stringify({ calling }, null, 2))
  const res = await fetch(`${GRAPH}/${PHONE_ID}/settings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ calling }),
  })
  const data = await res.json()
  console.log('Response ->', res.status, JSON.stringify(data, null, 2))
  if (!res.ok) process.exit(1)

  const verify = await fetch(`${GRAPH}/${PHONE_ID}/settings`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  console.log('Verified GET /settings ->', verify.status, JSON.stringify(await verify.json(), null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

