// One-shot health report for the ISYDCI WhatsApp integration.
//   node wacto/check_flow_status.cjs
// Checks: local backend, flow endpoint + webhook through the public URL, the published Flow on Meta,
// the business public key, WABA messaging health, and the member database.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ENV_PATH = path.resolve(__dirname, '../backend/.env')
fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) {
    let v = m[2] || ''
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
})

const API = 'https://graph.facebook.com/v21.0'
const headers = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
const row = (k, v) => console.log(`${k.padEnd(28)} ${v}`)

async function main() {
  console.log('──────────────────────────────────────────────────────')
  console.log('ISYDCI WhatsApp status  ' + new Date().toLocaleString())
  console.log('──────────────────────────────────────────────────────')

  try {
    const r = await fetch('http://localhost:5000/api/health').then(r => r.json())
    row('Backend :5000', r.status === 'OK' ? 'ONLINE' : 'DOWN')
  } catch {
    row('Backend :5000', 'DOWN')
  }

  try {
    const r = await fetch(process.env.WHATSAPP_FLOW_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ action: 'ping', version: '3.0' }),
    }).then(r => r.json())
    row('Flow endpoint (public)', r?.data?.status === 'active' ? 'ACTIVE' : 'FAIL ' + JSON.stringify(r))
  } catch {
    row('Flow endpoint (public)', 'UNREACHABLE — start backend + ngrok')
  }

  try {
    const t = await fetch(
      `${process.env.WHATSAPP_CALLBACK_URL}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(process.env.WHATSAPP_VERIFY_TOKEN)}&hub.challenge=ok123`,
      { headers: { 'ngrok-skip-browser-warning': '1' } }
    ).then(r => r.text())
    row('Webhook verify (public)', t === 'ok123' ? 'OK' : 'FAIL ' + t.slice(0, 40))
  } catch {
    row('Webhook verify (public)', 'UNREACHABLE')
  }

  const id = process.env.WHATSAPP_FLOW_ID
  const d = await fetch(`${API}/${id}?fields=id,name,status,endpoint_uri,validation_errors,health_status`, { headers }).then(r => r.json())
  row('Flow ID (backend/.env)', id)
  row('Flow name', d.name || '-')
  row('Flow status on Meta', d.status || JSON.stringify(d.error || d))
  row('Flow endpoint on Meta', d.endpoint_uri === process.env.WHATSAPP_FLOW_ENDPOINT_URL ? 'matches backend/.env' : String(d.endpoint_uri))
  row('Flow validation errors', String((d.validation_errors || []).length))
  const ent = d.health_status?.entities || []
  const fh = ent.find(e => e.entity_type === 'FLOW')
  const waba = ent.find(e => e.entity_type === 'WABA')
  row('Flow health', fh?.can_send_message || '-')
  row('WABA messaging health', (waba?.can_send_message || '-') + (waba?.errors?.[0] ? ` (${waba.errors[0].error_code}: ${waba.errors[0].error_description})` : ''))

  try {
    const k = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_encryption`, { headers }).then(r => r.json())
    const localPem = crypto
      .createPublicKey(crypto.createPrivateKey(process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n')))
      .export({ type: 'spki', format: 'pem' })
      .trim()
    const remote = (k.data?.[0]?.business_public_key || '').trim()
    row('Public key on Meta', remote === localPem ? `matches backend key (${k.data[0].business_public_key_signature_status})` : 'MISMATCH — run deploy_meta_flow.cjs')
  } catch (e) {
    row('Public key on Meta', 'check failed: ' + e.message)
  }

  try {
    const m = await fetch('http://localhost:5000/api/members').then(r => r.json())
    row('Members in database', `${m.total} (${m.members.filter(x => x.photo).length} with photo, ${m.members.filter(x => x.cardFullUrl).length} with card image)`)
  } catch {
    row('Members in database', 'backend down')
  }
  console.log('──────────────────────────────────────────────────────')
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
