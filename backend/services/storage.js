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


