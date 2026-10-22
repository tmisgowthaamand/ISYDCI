// Decrypts media uploaded through a WhatsApp Flow PhotoPicker / DocumentPicker.
//
// Meta delivers each uploaded file to the Flow endpoint as:
//   { file_name, media_id, cdn_url, encryption_metadata: { encrypted_hash, iv, encryption_key, hmac_key, plaintext_hash } }
// The CDN file is  ciphertext || hmac10 ; ciphertext is AES-256-CBC (PKCS7) with encryption_key + iv,
// hmac10 is the first 10 bytes of HMAC-SHA256(hmac_key, iv || ciphertext).

import crypto from 'crypto'

function b64(buf) {
  return Buffer.from(buf).toString('base64')
}

async function defaultDownloader(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CDN download failed: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Encrypt a plaintext buffer exactly the way Meta's CDN stores Flow uploads.
 * Used by local tests to exercise decryptFlowMedia without the real CDN.
 */
export function encryptLikeMetaCdn(plaintext) {
  const encryptionKey = crypto.randomBytes(32)
  const hmacKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const hmac = crypto.createHmac('sha256', hmacKey).update(Buffer.concat([iv, ciphertext])).digest()
  const cdnFile = Buffer.concat([ciphertext, hmac.subarray(0, 10)])

  return {
    cdnFile,
    encryption_metadata: {
      encrypted_hash: b64(crypto.createHash('sha256').update(cdnFile).digest()),
      iv: b64(iv),
      encryption_key: b64(encryptionKey),
      hmac_key: b64(hmacKey),
      plaintext_hash: b64(crypto.createHash('sha256').update(plaintext).digest()),
    },
  }
}

/**
 * Download + verify + decrypt one Flow media object.
 * @param {object} media  one entry of the PhotoPicker array
 * @param {(url:string)=>Promise<Buffer>} [downloader]
 * @returns {Promise<{ buffer: Buffer, fileName: string, mimeType: string }>}
 */
export async function decryptFlowMedia(media, downloader = defaultDownloader) {
  if (!media || !media.cdn_url || !media.encryption_metadata) {
    throw new Error('Invalid flow media object (missing cdn_url / encryption_metadata)')
  }
  const meta = media.encryption_metadata
  const cdnFile = await downloader(media.cdn_url)

  // 1. Encrypted hash check
  const encHash = crypto.createHash('sha256').update(cdnFile).digest('base64')
  if (encHash !== meta.encrypted_hash) throw new Error('encrypted_hash mismatch (CDN file corrupted)')

  // 2. Split ciphertext / mac and verify HMAC
  const iv = Buffer.from(meta.iv, 'base64')
  const hmacKey = Buffer.from(meta.hmac_key, 'base64')
  const encryptionKey = Buffer.from(meta.encryption_key, 'base64')
  const ciphertext = cdnFile.subarray(0, cdnFile.length - 10)
  const mac10 = cdnFile.subarray(cdnFile.length - 10)
  const expectedMac = crypto.createHmac('sha256', hmacKey).update(Buffer.concat([iv, ciphertext])).digest().subarray(0, 10)
  if (!crypto.timingSafeEqual(mac10, expectedMac)) throw new Error('HMAC validation failed')

  // 3. AES-256-CBC decrypt
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  // 4. Plaintext hash check
  const plainHash = crypto.createHash('sha256').update(plaintext).digest('base64')
  if (plainHash !== meta.plaintext_hash) throw new Error('plaintext_hash mismatch')

  const fileName = media.file_name || 'photo.jpg'
  const ext = (fileName.split('.').pop() || 'jpg').toLowerCase()
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  return { buffer: plaintext, fileName, mimeType }
}

/** Convert a decrypted media buffer to a data URI usable by Cloudinary upload. */
export function toDataUri(buffer, mimeType = 'image/jpeg') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
