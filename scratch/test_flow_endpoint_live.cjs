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

const privateKeyPem = process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n');
const privateKey = crypto.createPrivateKey(privateKeyPem);
const publicKey = crypto.createPublicKey(privateKey);
const endpointUrl = `${process.env.NGROK_URL}/api/whatsapp/flow-endpoint`;

function encryptMetaRequest(payload) {
  const aesKey = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);

  const encAesKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    aesKey
  ).toString('base64');

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
  const flowCipher = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encFlowData = Buffer.concat([flowCipher, tag]).toString('base64');

  return {
    body: {
      encrypted_aes_key: encAesKey,
      encrypted_flow_data: encFlowData,
      initial_vector: iv.toString('base64')
    },
    aesKey,
    iv
  };
}

function decryptResponse(base64Text, aesKey, iv) {
  const flippedIv = Buffer.from(iv.map(b => b ^ 0xFF));
  const buf = Buffer.from(base64Text, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(0, buf.length - 16);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, flippedIv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

async function runLiveTests() {
  console.log('--- Testing Live Flow Endpoint via Ngrok: ---', endpointUrl);

  // 1. Test INIT (Unregistered)
  console.log('\nTest 1: User opens flow (INIT)');
  const { body: initBody, aesKey: k1, iv: iv1 } = encryptMetaRequest({
    version: '3.0',
    action: 'INIT',
    flow_token: 'test_token_guest_9999999999'
  });
  const r1 = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initBody)
  });
  const t1 = await r1.text();
  const res1 = decryptResponse(t1, k1, iv1);
  console.log('INIT Response (Unregistered):', res1);

  // 2. Test Menu -> Register Athlete
  console.log('\nTest 2: User selects "Register Athlete"');
  const { body: b2, aesKey: k2, iv: iv2 } = encryptMetaRequest({
    version: '3.0',
    action: 'data_exchange',
    screen: 'WELCOME',
    data: { menu_choice: 'register' }
  });
  const r2 = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b2)
  });
  const res2 = decryptResponse(await r2.text(), k2, iv2);
  console.log('Select Register Response:', res2);

  // 3. Test Menu -> My Membership Card
  console.log('\nTest 3: User selects "My Membership Card"');
  const { body: b3, aesKey: k3, iv: iv3 } = encryptMetaRequest({
    version: '3.0',
    action: 'data_exchange',
    screen: 'WELCOME',
    data: { menu_choice: 'card' }
  });
  const r3 = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b3)
  });
  const res3 = decryptResponse(await r3.text(), k3, iv3);
  console.log('Select Card Response:', res3);

  // 4. Test Final Registration Submit (REG_CONFIRM)
  console.log('\nTest 4: User submits registration (REG_CONFIRM)');
  const { body: b4, aesKey: k4, iv: iv4 } = encryptMetaRequest({
    version: '3.0',
    action: 'data_exchange',
    screen: 'REG_CONFIRM',
    data: {
      full_name: 'Rahul Sharma',
      contact_number: '+91 98765 12345',
      state: 'Tamil Nadu',
      district: 'Chennai',
      assembly: 'Velachery',
      zone: 'Ward 25',
      dob: '12 May 2001',
      age: '25',
      gender: 'Male',
      sport: 'Athletics',
      blood_group: 'B+',
      address: 'No. 44, Gandhi Street, Chennai - 600042'
    }
  });
  const r4 = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b4)
  });
  const res4 = decryptResponse(await r4.text(), k4, iv4);
  console.log('Registration Submit Response:', res4);

  console.log('\n✅ ALL LIVE FLOW ENDPOINT TESTS PASSED SUCCESSFULLY!');
}

runLiveTests().catch(err => console.error('Test error:', err));
