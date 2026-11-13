// Read-only Meta WhatsApp Business Calling API (Graph API v24.0) eligibility & readiness check.
// Usage: node scripts/verify_whatsapp_calling.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
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

const GRAPH_VERSION = 'v24.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

const TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WABA_ID
const APP_ID = process.env.WHATSAPP_APP_ID || process.env.APP_ID
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || process.env.APP_SECRET

const ELIGIBLE_TIERS = new Set(['TIER_2K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED'])

async function graphGet(endpoint, params = {}) {
  const url = new URL(`${GRAPH_BASE}/${endpoint.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function printHeader(title) {
  console.log(`\n${'='.repeat(64)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(64)}`)
}

async function main() {
  printHeader(`Meta WhatsApp Calling Readiness Check (${GRAPH_VERSION})`)

  const checks = []
  const record = (name, passed, detail, raw = null) => {
    checks.push({ name, passed, detail, raw })
    const icon = passed ? 'PASS' : 'FAIL'
    console.log(`[${icon}] ${name}: ${detail}`)
    if (!passed && raw) {
      console.log('       Response:', JSON.stringify(raw, null, 2).split('\n').join('\n       '))
    }
  }

  // 0. Env check
  if (!TOKEN || !PHONE_NUMBER_ID || !WABA_ID) {
    record(
      'Environment Credentials',
      false,
      `Missing required env vars (WHATSAPP_TOKEN=${Boolean(TOKEN)}, WHATSAPP_PHONE_NUMBER_ID=${Boolean(PHONE_NUMBER_ID)}, WHATSAPP_BUSINESS_ACCOUNT_ID=${Boolean(WABA_ID)})`
    )
    process.exit(1)
  }
  record(
    'Environment Credentials',
    true,
    `PHONE_NUMBER_ID=${PHONE_NUMBER_ID}, WABA_ID=${WABA_ID}, APP_ID=${APP_ID || 'unset'}, APP_SECRET=${APP_SECRET ? 'set' : 'NOT SET (needed for X-Hub-Signature-256 in Phase 3)'}`
  )

  // 1. Verify Token & Permissions
  const debugRes = await graphGet('debug_token', { input_token: TOKEN, access_token: TOKEN })
  const scopes = debugRes.data?.data?.scopes || []
  const isValidToken = Boolean(debugRes.ok && debugRes.data?.data?.is_valid)
  const hasMessaging = scopes.includes('whatsapp_business_messaging')
  const hasManagement = scopes.includes('whatsapp_business_management')

  record(
    'Token Validity (/debug_token)',
    isValidToken,
    isValidToken
      ? `Valid (type=${debugRes.data.data.type}, app_id=${debugRes.data.data.app_id}, expires_at=${debugRes.data.data.expires_at || 'never'})`
      : `Token check failed (HTTP ${debugRes.status})`,
    isValidToken ? null : debugRes.data
  )

  record(
    'Required Permissions',
    hasMessaging && hasManagement,
    `scopes=[${scopes.join(', ')}] (messaging=${hasMessaging}, management=${hasManagement})`,
    hasMessaging && hasManagement ? null : debugRes.data
  )

  // Also check WABA subscribed_apps
  const subRes = await graphGet(`${WABA_ID}/subscribed_apps`)
  const apps = subRes.data?.data || []
  const subscribedFields = apps.flatMap(a => a.whatsapp_business_api_data?.subscribed_fields || [])
  record(
    'WABA Subscribed Apps',
    subRes.ok && apps.length > 0,
    subRes.ok
      ? `${apps.length} app(s) subscribed: ${apps.map(a => `${a.whatsapp_business_api_data?.name || a.id} (${a.whatsapp_business_api_data?.id || ''})`).join(', ')}`
      : `Failed (HTTP ${subRes.status})`,
    subRes.ok && apps.length > 0 ? null : subRes.data
  )

  // 2. Verify Phone Number Tier & Quality
  const phoneRes = await graphGet(PHONE_NUMBER_ID, {
    fields: 'display_phone_number,verified_name,quality_rating,messaging_limit_tier,whatsapp_business_manager_messaging_limit,platform_type,throughput',
  })

  if (!phoneRes.ok) {
    record('Phone Number Metadata', false, `HTTP ${phoneRes.status}`, phoneRes.data)
  } else {
    const p = phoneRes.data
    console.log('\nPhone Number Details:', JSON.stringify(p, null, 2))
    record('Platform Type', p.platform_type === 'CLOUD_API', `platform_type=${p.platform_type}`, p.platform_type === 'CLOUD_API' ? null : p)
    record('Quality Rating', p.quality_rating === 'GREEN', `quality_rating=${p.quality_rating}`, p.quality_rating === 'GREEN' ? null : p)
    const tier = p.messaging_limit_tier || p.whatsapp_business_manager_messaging_limit
    record(
      'Messaging Limit Tier',
      ELIGIBLE_TIERS.has(tier),
      `messaging_limit_tier=${p.messaging_limit_tier ?? 'unset'}, whatsapp_business_manager_messaging_limit=${p.whatsapp_business_manager_messaging_limit ?? 'unset'} (required: TIER_2K or higher)`,
      ELIGIBLE_TIERS.has(tier) ? null : p
    )
  }

  // 3. Check Current Calling Settings
  const settingsRes = await graphGet(`${PHONE_NUMBER_ID}/settings`)
  if (!settingsRes.ok) {
    record('Current Calling Settings (/settings)', false, `HTTP ${settingsRes.status}`, settingsRes.data)
  } else {
    console.log('\nCurrent /settings:', JSON.stringify(settingsRes.data, null, 2))
    const calling = settingsRes.data?.calling || {}
    record(
      'Calling Settings Endpoint',
      true,
      `calling.status=${calling.status || 'NOT_SET'}, call_icon_visibility=${calling.call_icon_visibility || 'NOT_SET'}, callback_permission_status=${calling.callback_permission_status || 'NOT_SET'}, call_hours=${calling.call_hours ? JSON.stringify(calling.call_hours) : 'NOT_SET'}`
    )
  }

  const sipRes = await graphGet(`${PHONE_NUMBER_ID}/settings`, { include_sip_credentials: 'true' })
  if (sipRes.ok) {
    const sip = sipRes.data?.calling?.sip || sipRes.data?.sip
    console.log('SIP Settings (include_sip_credentials=true):', JSON.stringify(sip || 'none', null, 2))
  } else {
    console.log(`SIP Settings query note (HTTP ${sipRes.status}):`, JSON.stringify(sipRes.data))
  }

  // Summary
  printHeader('Phase 2 Readiness Report Summary')
  const failed = checks.filter(c => !c.passed)
  console.log(`Total checks: ${checks.length} | Passed: ${checks.length - failed.length} | Failed: ${failed.length}`)
  if (subscribedFields.length) {
    console.log(`Subscribed webhook fields on WABA: ${subscribedFields.join(', ')}`)
  }
  if (!APP_SECRET) {
    console.log('NOTE: WHATSAPP_APP_SECRET / APP_SECRET is not set in backend/.env. Add it before Phase 3 webhook signature verification.')
  }

  if (failed.length > 0) {
    console.log('\nOVERALL STATUS: FAIL — Resolve the failed prerequisite(s) above before Phase 3.')
    process.exit(1)
  } else {
    console.log('\nOVERALL STATUS: PASS — Account & phone number are eligible for WhatsApp Business Calling API (v24.0).')
  }
}

main().catch(err => {
  console.error('Fatal error running verification:', err)
  process.exit(1)
})
