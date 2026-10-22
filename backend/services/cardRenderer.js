// Server-side ISYDCI membership card renderer.
// Draws the same Front + Back design as src/components/MembershipCard.jsx using
// @napi-rs/canvas, so WhatsApp registrations (no browser) still get a real card image.

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage, GlobalFonts, Path2D } from '@napi-rs/canvas'
import QRCode from 'qrcode'
import { uploadToCloudinary } from '../config/cloudinary.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ASSETS = path.resolve(__dirname, '../assets')
const PUBLIC_DIR = path.resolve(__dirname, '../../public')

export const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://isydci.com'

const NAVY = '#0b1e3f'
const SAFFRON = '#f59e0b'
const SLATE_900 = '#0f172a'
const SLATE_800 = '#1e293b'
const SLATE_700 = '#334155'
const SLATE_600 = '#475569'
const SLATE_500 = '#64748b'
const SLATE_300 = '#cbd5e1'
const SLATE_200 = '#e2e8f0'
const SLATE_100 = '#f1f5f9'
const SLATE_50 = '#f8fafc'
const ROSE_700 = '#be123c'

const CARD_W = 340
const CARD_H = 540
const SCALE = 3 // 1020 x 1620 px per side

let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  try {
    GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts/Inter-Bold.ttf'), 'Inter')
    GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts/Inter-Regular.ttf'), 'Inter')
  } catch (err) {
    console.warn('[CardRenderer] Font registration failed, falling back to system fonts:', err.message)
  }
  fontsReady = true
}

function font(size, weight = 'normal', italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`
}

let logoCache = null
async function getLogo() {
  if (logoCache) return logoCache
  const candidates = [path.join(ASSETS, 'logo.png'), path.join(PUBLIC_DIR, 'logo.png')]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      logoCache = await loadImage(fs.readFileSync(p))
      return logoCache
    }
  }
  return null
}

async function loadPhoto(photoUrl) {
  if (!photoUrl) return null
  try {
    if (photoUrl.startsWith('data:image')) {
      const base64 = photoUrl.split(',')[1]
      return await loadImage(Buffer.from(base64, 'base64'))
    }
    if (/^https?:\/\//i.test(photoUrl)) {
      const res = await fetch(photoUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await loadImage(Buffer.from(await res.arrayBuffer()))
    }
    // Relative path like /athletes/1.png -> served from the website's public folder
    const local = path.join(PUBLIC_DIR, photoUrl.replace(/^\//, ''))
    if (fs.existsSync(local)) return await loadImage(fs.readFileSync(local))
  } catch (err) {
    console.warn('[CardRenderer] Photo load failed:', err.message)
  }
  return null
}

// ---------- drawing helpers (all coordinates in 340x540 CSS px; ctx is pre-scaled) ----------

function breakLongWord(ctx, word, maxWidth) {
  if (ctx.measureText(word).width <= maxWidth) return [word]
  const parts = []
  let cur = ''
  for (const ch of word) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      parts.push(cur)
      cur = ch
    } else {
      cur += ch
    }
  }
  if (cur) parts.push(cur)
  return parts
}

function wrapText(ctx, text, maxWidth) {
  // Also split after commas so addresses typed without spaces still wrap nicely
  const words = String(text || '')
    .replace(/,(?=\S)/g, ', ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(w => breakLongWord(ctx, w, maxWidth))
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCover(ctx, img, x, y, w, h, radius) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.clip()
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

function drawContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function drawLogoBadge(ctx, logo, cx, cy, diameter, ringWidth) {
  ctx.save()
  ctx.shadowColor = 'rgba(11,30,63,0.28)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = NAVY
  ctx.lineWidth = ringWidth
  ctx.beginPath()
  ctx.arc(cx, cy, diameter / 2 - ringWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (logo) {
    const inner = diameter - ringWidth * 2 - 3
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, inner / 2, 0, Math.PI * 2)
    ctx.clip()
    drawContain(ctx, logo, cx - inner / 2, cy - inner / 2, inner, inner)
    ctx.restore()
  }
}

function drawSvgPath(ctx, d, { fill, stroke, lineWidth = 1, viewW, viewH, x = 0, y = 0, w, h }) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / viewW, h / viewH)
  const p = new Path2D(d)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill(p)
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.stroke(p)
  }
  ctx.restore()
}

function badge(ctx, text, x, y, h) {
  ctx.font = font(8.5, 'bold')
  const w = ctx.measureText(text).width + 9
  ctx.fillStyle = NAVY
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 2.5)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, x + 4.5, y + h / 2 + 0.5)
  return w
}

function titleCase(str) {
  return String(str || '').toLowerCase().replace(/(?:^|\s|-|\/)\S/g, m => m.toUpperCase())
}

// ---------- FRONT ----------

async function drawFront(ctx, member, logo, photo) {
  const {
    name = '',
    state = '',
    district = '',
    assembly = '',
    zone = '',
    memberId = '',
  } = member

  // Card base
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24)
  ctx.clip()

  // Header swoosh (viewBox 340 x 105)
  const hv = { viewW: 340, viewH: 105, x: 0, y: 0, w: CARD_W, h: 105 }
  drawSvgPath(ctx, 'M-20,50 C60,82 140,26 240,60 C290,78 320,58 360,50 L360,105 L-20,105 Z', { fill: 'rgba(11,30,63,0.04)', ...hv })
  drawSvgPath(ctx, 'M-10,65 C70,92 150,42 250,68 C295,80 325,66 360,60 L360,80 C320,86 285,96 245,84 C150,56 75,102 -10,84 Z', { fill: NAVY, ...hv })
  drawSvgPath(ctx, 'M-10,84 C80,104 160,60 260,86 C300,98 330,86 360,80 L360,105 L-10,105 Z', { fill: '#ffffff', ...hv })
  drawSvgPath(ctx, 'M-10,63 C70,90 150,40 250,66 C295,78 325,64 360,58', { stroke: SAFFRON, lineWidth: 2.5, ...hv })
  ctx.fillStyle = SLATE_100
  ctx.fillRect(0, 105, CARD_W, 1)

  // Logo badge (62px, left 12, bottom 8 of header)
  drawLogoBadge(ctx, logo, 12 + 31, 105 - 8 - 31, 62, 2)

  // Org name (centered in the area right of the logo)
  ctx.fillStyle = NAVY
  ctx.font = font(10.5, 'bold')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const orgLines = wrapText(ctx, 'INTERNATIONAL SPORTS & YOUTH DEVELOPMENT CAMPAIGN', CARD_W - 74 - 16)
  orgLines.forEach((line, i) => ctx.fillText(line, 74 + (CARD_W - 74 - 8) / 2, 9 + i * 13))

  // Middle block: measure then vertically center between header (105) and footer (445)
  const rows = []
  if (state) rows.push({ text: String(state).toUpperCase(), tag: 'STATE' })
  if (district) rows.push({ text: String(district).toUpperCase(), tag: 'DIST' })
  if (assembly) rows.push({ text: titleCase(assembly), tag: 'ASSM' })
  const zoneText = zone ? String(zone).toUpperCase() : ''

  const PHOTO_W = 137
  const PHOTO_H = 136
  let blockH = PHOTO_H + 4 + 22 + 2 + rows.length * 15 + (zoneText ? 13 : 0) + (memberId ? 22 : 0)
  let y = 105 + (340 - blockH) / 2
  const cx = CARD_W / 2

  // Photo frame 137 x 136 with navy border
  ctx.fillStyle = NAVY
  ctx.beginPath()
  ctx.roundRect(cx - PHOTO_W / 2, y, PHOTO_W, PHOTO_H, 16)
  ctx.fill()
  if (photo) {
    drawCover(ctx, photo, cx - PHOTO_W / 2 + 2.5, y + 2.5, PHOTO_W - 5, PHOTO_H - 5, 13.5)
  } else {
    ctx.fillStyle = SLATE_100
    ctx.beginPath()
    ctx.roundRect(cx - PHOTO_W / 2 + 2.5, y + 2.5, PHOTO_W - 5, PHOTO_H - 5, 13.5)
    ctx.fill()
    ctx.fillStyle = SLATE_300
    ctx.beginPath()
    ctx.arc(cx, y + 52, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(cx - 38, y + 78, 76, 40, 20)
    ctx.fill()
  }
  y += PHOTO_H + 4

  // Name
  ctx.fillStyle = NAVY
  ctx.font = font(16, 'bold')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  let nameText = String(name || '').toUpperCase()
  while (ctx.measureText(nameText).width > CARD_W - 40 && nameText.length > 4) {
    nameText = nameText.slice(0, -2)
  }
  if (nameText !== String(name || '').toUpperCase()) nameText = nameText.trimEnd() + '…'
  ctx.fillText(nameText, cx, y)
  y += 22 + 2

  // Rows with badges
  for (const row of rows) {
    ctx.font = font(11, 'bold')
    const textW = ctx.measureText(row.text).width
    ctx.font = font(8.5, 'bold')
    const badgeW = ctx.measureText(row.tag).width + 9
    const total = textW + 6 + badgeW
    const startX = cx - total / 2
    ctx.fillStyle = SLATE_800
    ctx.font = font(11, 'bold')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(row.text, startX, y + 7)
    badge(ctx, row.tag, startX + textW + 6, y + 1, 12)
    y += 15
  }

  if (zoneText) {
    ctx.fillStyle = SLATE_900
    ctx.font = font(10, 'bold')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(zoneText, cx, y + 6)
    y += 13
  }

  if (memberId) {
    ctx.font = font(12, 'bold')
    const idW = ctx.measureText(memberId).width + 24
    ctx.fillStyle = SLATE_50
    ctx.strokeStyle = SLATE_300
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(cx - idW / 2, y + 2, idW, 18, 5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = NAVY
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(memberId, cx, y + 11.5)
  }

  // Footer (445 .. 540)
  const fy = CARD_H - 95
  ctx.fillStyle = SLATE_100
  ctx.fillRect(0, fy, CARD_W, 1)
  const fv = { viewW: 340, viewH: 22, x: 0, y: fy, w: CARD_W, h: 22 }
  drawSvgPath(ctx, 'M-10,0 L350,0 L350,6 C280,16 190,4 100,12 C50,16 10,12 -10,10 Z', { fill: NAVY, ...fv })
  drawSvgPath(ctx, 'M-10,8 C60,14 140,5 240,14 C290,10 330,5 350,3', { stroke: SAFFRON, lineWidth: 2, ...fv })
  drawSvgPath(ctx, 'M-10,10 C60,16 140,7 240,16 C290,11 330,7 350,5 L350,22 L-10,22 Z', { fill: '#ffffff', ...fv })

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let by = CARD_H - 10
  ctx.fillStyle = NAVY
  ctx.font = font(8, 'bold')
  ctx.fillText('+91-99946 27551  •  www.isydci.org  •  support@isydci.org', cx, by)
  by -= 12
  ctx.fillStyle = SLATE_800
  ctx.font = font(8.5, 'bold')
  const hqLines = wrapText(ctx, 'VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001', CARD_W - 24)
  for (let i = hqLines.length - 1; i >= 0; i--) {
    ctx.fillText(hqLines[i], cx, by)
    by -= 11
  }
  ctx.fillStyle = NAVY
  ctx.font = font(9.5, 'bold')
  ctx.fillText('NATIONAL HEADQUARTERS', cx, by)

  ctx.restore()

  // Outer border
  ctx.strokeStyle = 'rgba(11,30,63,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, 24)
  ctx.stroke()
}

// ---------- BACK ----------

async function drawBack(ctx, member, logo, qrImage) {
  const {
    dob = '',
    age = '',
    bloodGroup = '',
    address = '',
    contact = '',
  } = member

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, CARD_W, CARD_H, 24)
  ctx.clip()

  // Header swoosh (viewBox 340 x 115)
  const hv = { viewW: 340, viewH: 115, x: 0, y: 0, w: CARD_W, h: 115 }
  drawSvgPath(ctx, 'M-10,35 C80,60 160,20 260,65 C305,80 335,62 360,55 L360,82 C320,90 285,102 245,86 C150,52 75,108 -10,82 Z', { fill: NAVY, ...hv })
  drawSvgPath(ctx, 'M-10,37 C80,62 160,22 260,67 C305,82 335,64 360,57', { stroke: SAFFRON, lineWidth: 2, ...hv })
  drawSvgPath(ctx, 'M-10,75 C70,105 170,40 270,85 C310,100 335,90 360,80 L360,118 L-10,118 Z', { fill: '#ffffff', ...hv })
  ctx.fillStyle = SLATE_100
  ctx.fillRect(0, 115, CARD_W, 1)

  drawLogoBadge(ctx, logo, 12 + 36, 8 + 36, 72, 2)

  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = NAVY
  ctx.font = font(11, 'bold')
  ctx.fillText('ISYDCI MEMBERSHIP CARD', CARD_W - 16, 14)
  ctx.fillStyle = SLATE_500
  ctx.font = font(9, 'bold')
  ctx.fillText('OFFICIAL MEMBER IDENTITY', CARD_W - 16, 29)

  // Footer disclaimer (measure first so the middle can be laid out above it)
  ctx.font = font(9.5, 'normal', true)
  const disclaimer = '"This card is the property of International Sports & Youth Development Campaign of India. If found, please return it to the provided address."'
  const discLines = wrapText(ctx, disclaimer, CARD_W - 32)
  const footerH = 12 + discLines.length * 13 + 10
  const footerY = CARD_H - footerH

  // Middle rows
  const left = 24
  const colLabelW = 108
  const colColon = 12
  const valueX = left + colLabelW + colColon
  const valueW = CARD_W - valueX - 24
  let y = 115 + 16

  const drawRow = (label, value, opts = {}) => {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = SLATE_600
    ctx.font = font(11.5, 'bold')
    ctx.fillText(label, left, y + 1)
    ctx.fillStyle = NAVY
    ctx.font = font(12.5, 'bold')
    ctx.fillText(':', left + colLabelW, y)
    ctx.fillStyle = opts.color || SLATE_900
    ctx.font = font(opts.size || 12.5, opts.weight || 'bold')
    const lines = opts.wrap ? wrapText(ctx, value || '—', valueW) : [value || '—']
    lines.forEach((ln, i) => ctx.fillText(ln, valueX, y + i * ((opts.size || 12.5) + 3)))
    y += Math.max(1, lines.length) * ((opts.size || 12.5) + 3) + 11
  }

  drawRow('DATE OF BIRTH', dob)
  drawRow('AGE', age ? (String(age).match(/yrs|years/i) ? String(age) : `${age} Years`) : '')
  drawRow('BLOOD GROUP', bloodGroup, { color: ROSE_700, size: 13.5 })
  drawRow('ADDRESS', address, { wrap: true, size: 12, color: SLATE_800 })
  drawRow('CONTACT', contact, { size: 13 })

  // Bottom section: QR (left) + signature/authority (right), dashed divider on top
  const sectionH = 84 + 14 + 12
  const sy = footerY - 10 - sectionH
  ctx.save()
  ctx.setLineDash([3, 3])
  ctx.strokeStyle = SLATE_200
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, sy - 4)
  ctx.lineTo(CARD_W - 24, sy - 4)
  ctx.stroke()
  ctx.restore()

  // QR box 84x84
  const qx = left
  const qy = sy + 8
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = SLATE_300
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(qx, qy, 84, 84, 8)
  ctx.fill()
  ctx.stroke()
  if (qrImage) ctx.drawImage(qrImage, qx + 4, qy + 4, 76, 76)
  ctx.fillStyle = SLATE_500
  ctx.font = font(8, 'bold')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('SCAN TO VERIFY', qx + 42, qy + 88)

  // Signature + authority (right block, centered at x ≈ 236)
  const sxc = CARD_W - 24 - 80
  drawSvgPath(ctx, 'M10 28 C 30 10, 45 35, 60 15 C 75 -2, 85 38, 95 18 C 105 2, 110 25, 125 15 C 135 10, 145 28, 155 20 M20 22 L140 22', {
    stroke: NAVY, lineWidth: 2.2, viewW: 160, viewH: 40, x: sxc - 65, y: qy + 4, w: 130, h: 36,
  })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = NAVY
  ctx.font = font(11.5, 'bold')
  ctx.fillText('VISANATH SHETTY', sxc, qy + 44)
  ctx.fillStyle = SLATE_600
  ctx.font = font(9, 'bold')
  ctx.fillText('Founder & State / National President', sxc, qy + 59)
  ctx.fillStyle = SLATE_500
  ctx.font = font(8, 'normal')
  ctx.fillText('Tamilnadu & National Sports Campaign', sxc, qy + 71)

  // Footer disclaimer
  ctx.fillStyle = SLATE_50
  ctx.fillRect(0, footerY, CARD_W, footerH)
  ctx.fillStyle = NAVY
  ctx.fillRect(0, footerY, CARD_W, 2)
  ctx.fillStyle = SLATE_700
  ctx.font = font(9.5, 'normal', true)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  discLines.forEach((ln, i) => ctx.fillText(ln, CARD_W / 2, footerY + 12 + i * 13))

  ctx.restore()

  ctx.strokeStyle = 'rgba(11,30,63,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, 24)
  ctx.stroke()
}

// ---------- public API ----------

/**
 * Render Front + Back + Combined PNG buffers for a member record.
 * @returns {{ front: Buffer, back: Buffer, combined: Buffer }}
 */
export async function renderMemberCard(member) {
  ensureFonts()
  const logo = await getLogo()
  const photo = await loadPhoto(member.photoUrl || member.photo)
  const qrBuffer = await QRCode.toBuffer(`${SITE_URL}/membership-card?id=${encodeURIComponent(member.memberId || 'ISYDCI-MEMBER')}`, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
  const qrImage = await loadImage(qrBuffer)

  const frontCanvas = createCanvas(CARD_W * SCALE, CARD_H * SCALE)
  const fctx = frontCanvas.getContext('2d')
  fctx.scale(SCALE, SCALE)
  await drawFront(fctx, member, logo, photo)

  const backCanvas = createCanvas(CARD_W * SCALE, CARD_H * SCALE)
  const bctx = backCanvas.getContext('2d')
  bctx.scale(SCALE, SCALE)
  await drawBack(bctx, member, logo, qrImage)

  const GAP = 28
  const PAD = 24
  const combined = createCanvas((CARD_W * 2 + GAP + PAD * 2) * SCALE, (CARD_H + PAD * 2) * SCALE)
  const cctx = combined.getContext('2d')
  cctx.fillStyle = '#ffffff'
  cctx.fillRect(0, 0, combined.width, combined.height)
  cctx.drawImage(frontCanvas, PAD * SCALE, PAD * SCALE)
  cctx.drawImage(backCanvas, (PAD + CARD_W + GAP) * SCALE, PAD * SCALE)

  return {
    front: frontCanvas.toBuffer('image/png'),
    back: backCanvas.toBuffer('image/png'),
    combined: combined.toBuffer('image/png'),
  }
}

export function cloudinaryFolderFor(member) {
  const sanitized = String(member.name || 'MEMBER').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'MEMBER'
  return member.cloudinaryFolder || `isydci/members/${sanitized}`
}

/**
 * Render the combined Front+Back card and upload it to Cloudinary.
 * Returns the secure URL (or '' on failure). Never throws.
 */
export async function generateAndUploadCard(member) {
  try {
    const started = Date.now()
    const { combined } = await renderMemberCard(member)
    const dataUri = `data:image/png;base64,${combined.toString('base64')}`
    const folder = cloudinaryFolderFor(member)
    const upload = await uploadToCloudinary(dataUri, folder, 'id_card_full')
    const url = upload?.secure_url && upload.secure_url.startsWith('http') ? upload.secure_url : ''
    console.log(`🪪 [CARD RENDERED] ${member.memberId} (${member.name}) -> ${url || 'UPLOAD FAILED'} [${Date.now() - started}ms, ${(combined.length / 1024).toFixed(0)} KB]`)
    return url
  } catch (err) {
    console.error('[CardRenderer] generateAndUploadCard failed:', err.message)
    return ''
  }
}
