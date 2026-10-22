const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  });
}
loadEnv();

const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '3106462432894218';
const privPem = process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n');
const priv = crypto.createPrivateKey(privPem);
const pub = crypto.createPublicKey(priv);
const pubPem = pub.export({ type: 'spki', format: 'pem' });

console.log('Public key generated from WHATSAPP_PRIVATE_KEY:');
console.log(pubPem);

async function uploadKey() {
  console.log(`Setting public key on WABA ${wabaId}...`);
  // Try WABA update
  const r = await fetch(`https://graph.facebook.com/v21.0/${wabaId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      flow_endpoint_public_key: pubPem
    })
  });
  console.log('Result:', await r.json());
}

uploadKey();
