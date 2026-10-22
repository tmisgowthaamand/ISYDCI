const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const privateKeyPem = process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n');
const privateKey = crypto.createPrivateKey(privateKeyPem);
const publicKey = crypto.createPublicKey(privateKey);

function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  
  // 1. Decrypt AES key with RSA private key (RSA-OAEP with SHA-256)
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encrypted_aes_key, 'base64')
  );

  // 2. Decode IV
  const iv = Buffer.from(initial_vector, 'base64');

  // 3. Decode encrypted flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
  const ciphertext = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);

  // 4. Decrypt AES-GCM
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  
  return {
    decryptedData: JSON.parse(decrypted.toString('utf8')),
    aesKey,
    iv
  };
}

function encryptResponse(responseObj, aesKey, iv) {
  // Flip all bits of IV
  const flippedIv = Buffer.from(iv.map(b => b ^ 0xFF));
  
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(responseObj), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([ciphertext, authTag]).toString('base64');
}

// Self-test simulation
function runTest() {
  console.log('Testing Meta Flow crypto simulation...');
  const testPayload = { action: 'ping' };
  
  // Simulate Meta encrypting a request:
  const testAesKey = crypto.randomBytes(16);
  const testIv = crypto.randomBytes(12);
  
  const encAesKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    testAesKey
  ).toString('base64');

  const cipher = crypto.createCipheriv('aes-128-gcm', testAesKey, testIv);
  const flowCipher = Buffer.concat([cipher.update(JSON.stringify(testPayload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encFlowData = Buffer.concat([flowCipher, tag]).toString('base64');

  const simulatedMetaRequest = {
    encrypted_aes_key: encAesKey,
    encrypted_flow_data: encFlowData,
    initial_vector: testIv.toString('base64')
  };

  // Run decryption
  const { decryptedData, aesKey, iv } = decryptRequest(simulatedMetaRequest);
  console.log('Decrypted successfully:', decryptedData);

  // Run encryption
  const responseObj = { data: { status: 'active' } };
  const encryptedResp = encryptResponse(responseObj, aesKey, iv);
  console.log('Encrypted response (base64):', encryptedResp.slice(0, 40) + '...');
  
  // Verify response decryption with flipped IV
  const flippedIv = Buffer.from(iv.map(b => b ^ 0xFF));
  const respBuffer = Buffer.from(encryptedResp, 'base64');
  const respTag = respBuffer.subarray(respBuffer.length - 16);
  const respCiphertext = respBuffer.subarray(0, respBuffer.length - 16);
  
  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, flippedIv);
  decipher.setAuthTag(respTag);
  const decryptedResp = JSON.parse(Buffer.concat([decipher.update(respCiphertext), decipher.final()]).toString('utf8'));
  console.log('Verified decrypted response:', decryptedResp);
  console.log('ALL CRYPTO TESTS PASSED! ✅');
}

runTest();
