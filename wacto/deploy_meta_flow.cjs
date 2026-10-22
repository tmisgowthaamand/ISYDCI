// Deploys the ISYDCI registration Flow to Meta (WhatsApp Business Account).
//
//   node wacto/deploy_meta_flow.cjs                 build + create + validate + publish + save WHATSAPP_FLOW_ID
//   node wacto/deploy_meta_flow.cjs --validate-only build + create as DRAFT + validate, no publish
//   node wacto/deploy_meta_flow.cjs --endpoint https://host/api/whatsapp/flow-endpoint
//   node wacto/deploy_meta_flow.cjs --flow-id <id> upload into an existing DRAFT flow instead of creating one
//
// All credentials are read from backend/.env — nothing is hardcoded here.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ENV_PATH = path.resolve(__dirname, '../backend/.env')
const API = 'https://graph.facebook.com/v21.0'

function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf8')
  content.split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (m) {
      let v = m[2] || ''
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  })
}
loadEnv()

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const opt = name => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ENDPOINT = opt('--endpoint') || process.env.WHATSAPP_FLOW_ENDPOINT_URL
const VALIDATE_ONLY = flag('--validate-only')
const EXISTING_FLOW_ID = opt('--flow-id')

const headers = { Authorization: `Bearer ${TOKEN}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

const line = () => console.log('──────────────────────────────────────────────────────')
const step = t => {
  console.log('')
  line()
  console.log(t)
  line()
}

async function graph(method, url, body, isJson = true) {
  const res = await fetch(url, {
    method,
    headers: isJson ? jsonHeaders : headers,
    body: body ? (isJson ? JSON.stringify(body) : body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function fail(msg) {
  console.error(`\n❌ ${msg}`)
  process.exit(1)
}

function updateEnv(key, value) {
  let content = fs.readFileSync(ENV_PATH, 'utf8')
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(content)) content = content.replace(re, `${key}=${value}`)
  else content += `\n${key}=${value}\n`
  fs.writeFileSync(ENV_PATH, content, 'utf8')
}

async function main() {
  if (!TOKEN || !WABA_ID) fail('WHATSAPP_TOKEN / WHATSAPP_BUSINESS_ACCOUNT_ID missing in backend/.env')
  if (!ENDPOINT) fail('No endpoint: set WHATSAPP_FLOW_ENDPOINT_URL in backend/.env or pass --endpoint')

  step('STEP 0 · Build Flow JSON')
  const { flow, outPath } = require('./build_flow_v2.cjs')
  const flowJson = JSON.stringify(flow)
  console.log(`   file:     ${outPath}`)
  console.log(`   version:  ${flow.version}  (data_api ${flow.data_api_version})`)
  console.log(`   screens:  ${flow.screens.map(s => s.id).join(' → ')}`)
  console.log(`   endpoint: ${ENDPOINT}`)

  step('STEP 1 · Check the Flow endpoint is reachable (Meta will health-check it)')
  try {
    const ping = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ action: 'ping', version: '3.0' }),
    })
    const pingData = await ping.json().catch(() => ({}))
    console.log(`   POST ping -> HTTP ${ping.status} ${JSON.stringify(pingData)}`)
    if (pingData?.data?.status !== 'active') fail('Endpoint did not answer the ping with {data:{status:"active"}}. Start the backend (and ngrok) first.')
  } catch (err) {
    fail(`Endpoint unreachable: ${err.message}. Start the backend (and ngrok) first.`)
  }

  step('STEP 2 · Business public key on the phone number (needed to decrypt Flow requests)')
  if (!process.env.WHATSAPP_PRIVATE_KEY) fail('WHATSAPP_PRIVATE_KEY missing in backend/.env')
  const privateKey = crypto.createPrivateKey(process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n'))
  const publicPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
  const fingerprint = crypto.createHash('sha256').update(publicPem).digest('hex').slice(0, 16)
  console.log(`   local public key fingerprint: ${fingerprint}`)

  if (!PHONE_ID) {
    console.log('   ⚠️  WHATSAPP_PHONE_NUMBER_ID missing — skipping key check')
  } else {
    const cur = await graph('GET', `${API}/${PHONE_ID}/whatsapp_business_encryption`)
    const remotePem = cur.data?.data?.[0]?.business_public_key || ''
    const remoteStatus = cur.data?.data?.[0]?.business_public_key_signature_status || 'NOT SET'
    const remoteFp = remotePem ? crypto.createHash('sha256').update(remotePem.trim() + '\n').digest('hex').slice(0, 16) : '-'
    console.log(`   Meta key status: ${remoteStatus}  fingerprint: ${remoteFp}`)

    if (!remotePem || remotePem.trim() !== publicPem.trim()) {
      console.log('   ↑ Uploading local public key to Meta...')
      const form = new URLSearchParams({ business_public_key: publicPem })
      const up = await fetch(`${API}/${PHONE_ID}/whatsapp_business_encryption`, { method: 'POST', headers, body: form })
      const upData = await up.json().catch(() => ({}))
      console.log(`   upload -> HTTP ${up.status} ${JSON.stringify(upData)}`)
      if (!up.ok) fail('Public key upload failed')
    } else {
      console.log('   ✅ Meta already has this public key')
    }
  }

  let flowId = EXISTING_FLOW_ID
  if (!flowId) {
    step('STEP 3 · Create a new Flow on the WABA')
    const name = `isydci_athlete_registration_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString(36)}`
    const create = await graph('POST', `${API}/${WABA_ID}/flows`, { name, categories: ['SIGN_UP'], endpoint_uri: ENDPOINT })
    console.log(`   POST /flows -> HTTP ${create.status} ${JSON.stringify(create.data)}`)
    if (!create.ok || !create.data.id) fail('Flow creation failed')
    flowId = create.data.id
    console.log(`   ✅ Flow created: ${flowId}  (${name})`)
  } else {
    step(`STEP 3 · Using existing flow ${flowId}`)
    const upd = await graph('POST', `${API}/${flowId}`, { endpoint_uri: ENDPOINT })
    console.log(`   set endpoint_uri -> HTTP ${upd.status} ${JSON.stringify(upd.data)}`)
  }

  step('STEP 4 · Upload Flow JSON asset + Meta validation')
  const formData = new FormData()
  formData.append('name', 'flow.json')
  formData.append('asset_type', 'FLOW_JSON')
  formData.append('file', new Blob([flowJson], { type: 'application/json' }), 'flow.json')
  const asset = await fetch(`${API}/${flowId}/assets`, { method: 'POST', headers, body: formData })
  const assetData = await asset.json().catch(() => ({}))
  console.log(`   POST /assets -> HTTP ${asset.status}`)
  const errors = assetData.validation_errors || []
  if (errors.length) {
    console.log(`   ⚠️  ${errors.length} validation message(s):`)
    errors.forEach(e => console.log(`      [${e.error_type || e.type || 'ERROR'}] ${e.message || JSON.stringify(e)} ${e.pointers ? JSON.stringify(e.pointers) : ''}`))
  } else {
    console.log('   ✅ Flow JSON accepted with 0 validation errors')
  }
  if (!asset.ok) fail(`Asset upload failed: ${JSON.stringify(assetData)}`)
  const blocking = errors.filter(e => (e.error_type || e.type || 'ERROR').toUpperCase().includes('ERROR'))
  if (blocking.length) fail('Fix the validation errors above, then re-run.')

  if (VALIDATE_ONLY) {
    if (!EXISTING_FLOW_ID) {
      const del = await graph('DELETE', `${API}/${flowId}`)
      console.log(`\n🧹 Draft ${flowId} deleted after validation -> ${JSON.stringify(del.data)}`)
    }
    console.log(`\n✅ Flow JSON validated by Meta. Re-run without --validate-only to publish.`)
    return
  }

  step('STEP 5 · Publish')
  const pub = await graph('POST', `${API}/${flowId}/publish`)
  console.log(`   POST /publish -> HTTP ${pub.status} ${JSON.stringify(pub.data)}`)
  if (!pub.ok) fail('Publish failed')

  step('STEP 6 · Verify + save WHATSAPP_FLOW_ID')
  const detail = await graph('GET', `${API}/${flowId}?fields=id,name,status,categories,endpoint_uri,validation_errors,health_status`)
  console.log(`   id:            ${detail.data.id}`)
  console.log(`   name:          ${detail.data.name}`)
  console.log(`   status:        ${detail.data.status}`)
  console.log(`   endpoint_uri:  ${detail.data.endpoint_uri}`)
  if (detail.data.health_status) console.log(`   health:        ${JSON.stringify(detail.data.health_status)}`)

  updateEnv('WHATSAPP_FLOW_ID', flowId)
  console.log(`   ✅ backend/.env updated: WHATSAPP_FLOW_ID=${flowId}`)
  console.log('\n🚀 Done. Restart the backend so the webhook sends the new flow.\n')
}

main().catch(err => fail(err.stack || err.message))
