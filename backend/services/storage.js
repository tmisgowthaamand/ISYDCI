// Local disk storage for member card assets and photos served under https://isydci.com/uploads/...
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const UPLOADS_DIR = path.resolve(__dirname, '../uploads')

export function getSiteUrl() {
  return process.env.PUBLIC_SITE_URL || 'https://isydci.com'
}

export function sanitizeMemberFolder(member) {
  const name = member?.name || member?.memberId || 'MEMBER'
  return String(name).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'MEMBER'
}

export function memberUploadDir(member) {
  const folder = sanitizeMemberFolder(member)
  const dir = path.join(UPLOADS_DIR, 'members', folder)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return { dir, folder }
}

/**
 * Saves Front, Back, and Combined 2-in-1 cards to disk.
 * Returns public https://isydci.com/uploads/members/{FOLDER}/... URLs.
 */
export function saveMemberCardFiles(member, { front, back, combined }) {
  const { dir, folder } = memberUploadDir(member)
  const baseUrl = `${getSiteUrl()}/uploads/members/${folder}`

  if (front) fs.writeFileSync(path.join(dir, 'card_front.png'), front)
  if (back) fs.writeFileSync(path.join(dir, 'card_back.png'), back)
  if (combined) fs.writeFileSync(path.join(dir, 'id_card_full.png'), combined)

  return {
    cardFullUrl: `${baseUrl}/id_card_full.png`,
    cardFrontUrl: `${baseUrl}/card_front.png`,
    cardBackUrl: `${baseUrl}/card_back.png`,
  }
}

/**
 * Saves member passport photo to disk.
 * Returns public https://isydci.com/uploads/members/{FOLDER}/profile_photo.jpg URL.
 */
export function saveMemberPhoto(member, bufferOrDataUri, extension = 'jpg') {
  const { dir, folder } = memberUploadDir(member)
  let buffer = bufferOrDataUri
  if (typeof bufferOrDataUri === 'string' && bufferOrDataUri.startsWith('data:image')) {
    const base64 = bufferOrDataUri.split(',')[1]
    buffer = Buffer.from(base64, 'base64')
  }
  const filename = `profile_photo.${extension}`
  fs.writeFileSync(path.join(dir, filename), buffer)
  return `${getSiteUrl()}/uploads/members/${folder}/${filename}`
}

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
}

/**
 * Saves inbound/outbound WhatsApp inbox media (gallery, document, voice note, video)
 * under uploads/inbox_media/<phone>/ and returns its public URL & metadata.
 */
export function saveInboxMedia(phone, buffer, { mimeType = '', originalName = '', ext = '' } = {}) {
  const safePhone = String(phone || 'unknown').replace(/\D/g, '') || 'unknown'
  const dir = path.join(UPLOADS_DIR, 'inbox_media', safePhone)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const cleanMime = String(mimeType || '').split(';')[0].trim().toLowerCase()
  const nameExt = originalName && originalName.includes('.')
    ? originalName.split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    : ''
  const resolvedExt = ext || nameExt || MIME_EXT[cleanMime] || 'bin'

  const baseName = originalName
    ? path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    : 'media'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${baseName}.${resolvedExt}`
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  return {
    url: `${getSiteUrl()}/uploads/inbox_media/${safePhone}/${filename}`,
    filePath,
    filename: originalName || filename,
    mimeType: cleanMime || mimeType || 'application/octet-stream',
    sizeBytes: buffer.length,
  }
}

/**
 * Deletes all physical image files and directory for a member from disk.
 * Handles front card, back card, full card, and profile photo.
 */
export function deleteMemberFiles(member) {
  if (!member) return false
  try {
    const folders = new Set()
    folders.add(sanitizeMemberFolder(member))

    // Also check folder names referenced directly by card / photo URLs
    const urls = [member.cardFullUrl, member.cardFrontUrl, member.cardBackUrl, member.photoUrl, member.photo]
    for (const url of urls) {
      if (typeof url === 'string' && url.includes('/uploads/members/')) {
        const parts = url.split('/uploads/members/')[1]?.split('/')
        if (parts && parts[0]) folders.add(parts[0])
      }
    }

    let deletedAny = false
    for (const f of folders) {
      const dir = path.join(UPLOADS_DIR, 'members', f)
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
        console.log(`🗑️  [STORAGE] Deleted physical member assets folder: ${dir}`)
        deletedAny = true
      }
    }
    return deletedAny
  } catch (err) {
    console.warn('[STORAGE] Failed to delete member files:', err.message)
    return false
  }
}


