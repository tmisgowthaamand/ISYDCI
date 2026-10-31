import { Router } from 'express'
import { getAllMembers, listMembers, getMemberById, saveMember, deleteMember, getStats, findMemberByPhone } from '../db/db.js'
import { uploadToCloudinary } from '../config/cloudinary.js'
import { generateAndUploadCard } from '../services/cardRenderer.js'
import { deleteMemberFiles } from '../services/storage.js'
import { requireAuth } from '../services/auth.js'
import { onMemberRegistered } from '../services/leads.js'

const router = Router()

// GET /api/members — admin list with search & filter (login required). ?page=&limit= for paging.
router.get('/', requireAuth(), async (req, res) => {
  try {
    const { q = '', status = '', page, limit } = req.query
    if (page || limit) {
      const result = await listMembers({ q, status, page: Math.max(1, parseInt(page) || 1), limit: Math.min(500, parseInt(limit) || 50) })
      return res.json({ success: true, ...result })
    }
    const members = await getAllMembers(q, status)
    res.json({ success: true, total: members.length, members })
  } catch (error) {
    console.error('[Error fetching members]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/stats — Dashboard stats (login required)
router.get('/stats', requireAuth(), async (_req, res) => {
  try {
    res.json({ success: true, stats: await getStats() })
  } catch (error) {
    console.error('[Error fetching stats]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/members/phone/:phone — Lookup member by phone number (login required)
router.get('/phone/:phone', requireAuth(), async (req, res) => {
  try {
    const member = await findMemberByPhone(req.params.phone)
    if (!member) {
      return res.status(404).json({ success: false, message: 'No registered member found for this phone number' })
    }
    res.json({ success: true, member })
  } catch (error) {
    console.error('[Error fetching member by phone]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/members/:id — Single member (public: the card page on isydci.com and the QR code use it)
router.get('/:id', async (req, res) => {
  try {
    const member = await getMemberById(req.params.id)
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    res.json({ success: true, member })
  } catch (error) {
    console.error('[Error fetching member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/members — Register member (public: website registration form). Uploads assets to Cloudinary.
router.post('/', async (req, res) => {
  try {
    const {
      name,
      photo,
      cardFullImage,
      state,
      district,
      zone,
      dob,
      age,
      bloodGroup,
      contact,
      address,
      memberId,
      status = 'Verified',
      business = 'No business',
    } = req.body

    if (!name) {
      return res.status(400).json({ success: false, message: 'Member name is required' })
    }

    const sanitizedUserName = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'MEMBER'
    const cloudinaryUserFolder = `isydci/members/${sanitizedUserName}`
    console.log(`[Processing Member Registration] Name: ${name}, Folder: ${cloudinaryUserFolder}`)

    const driver = process.env.STORAGE_DRIVER || (process.env.CLOUDINARY_API_KEY ? 'cloudinary' : 'local')
    let photoUrl = photo || '/athletes/1.png'
    if (photo && photo.startsWith('data:image')) {
      if (driver === 'local' || driver === 'digitalocean') {
        const { saveMemberPhoto } = await import('../services/storage.js')
        photoUrl = saveMemberPhoto({ name, memberId: memberId || 'MEMBER' }, photo, 'jpg')
      } else {
        const uploadRes = await uploadToCloudinary(photo, cloudinaryUserFolder, 'profile_photo')
        if (uploadRes && uploadRes.secure_url) photoUrl = uploadRes.secure_url
      }
    }

    let cardFullUrl = ''
    if (cardFullImage && cardFullImage.startsWith('data:image')) {
      if (driver !== 'local' && driver !== 'digitalocean') {
        const uploadFullRes = await uploadToCloudinary(cardFullImage, cloudinaryUserFolder, 'id_card_full')
        if (uploadFullRes && uploadFullRes.secure_url) cardFullUrl = uploadFullRes.secure_url
      }
    }

    // One phone number = one card: reuse the existing Member ID when this number is already registered
    const existingByPhone = contact ? await findMemberByPhone(contact) : null
    if (existingByPhone) {
      console.log(`[Duplicate Prevented] ${contact} already registered as ${existingByPhone.memberId} (${existingByPhone.name}) — updating that record`)
    }

    const hexCode = Math.random().toString(16).substring(2, 10).toUpperCase()
    const generatedId = memberId || existingByPhone?.memberId || `ISYDCI-${hexCode}`
    const source = existingByPhone?.source || (req.get('X-Client') === 'flow-simulator' ? 'simulator' : 'web')

    let saved = await saveMember({
      name: name.toUpperCase(),
      memberId: generatedId,
      photo: photoUrl,
      photoUrl,
      cardFullUrl,
      cloudinaryFolder: cloudinaryUserFolder,
      state: state ? state.toUpperCase() : 'TAMIL NADU',
      district: district ? district.toUpperCase() : '',
      zone: zone ? zone.toUpperCase() : '',
      dob: dob || '',
      age: age || '',
      bloodGroup: bloodGroup ? bloodGroup.toUpperCase() : '',
      contact: contact || '',
      address: address || '',
      status,
      business,
      source,
    })

    console.log(`[Member Saved Successfully] ID: ${saved.memberId}, Cloudinary: ${cloudinaryUserFolder}`)

    if (!cardFullUrl) {
      const cardRes = await generateAndUploadCard(saved)
      if (cardRes?.cardFullUrl) {
        saved = await saveMember({
          ...saved,
          cardFullUrl: cardRes.cardFullUrl,
          cardFrontUrl: cardRes.cardFrontUrl || saved.cardFrontUrl,
          cardBackUrl: cardRes.cardBackUrl || saved.cardBackUrl,
          cardDesignVersion: 3,
        })
      }
    }

    onMemberRegistered(saved, source).catch(() => {})

    res.status(existingByPhone ? 200 : 201).json({
      success: true,
      duplicate: Boolean(existingByPhone),
      message: existingByPhone
        ? `This mobile number is already registered as ${existingByPhone.memberId}. The existing record was updated — no duplicate card was created.`
        : 'Member registered and assets uploaded to Cloudinary successfully',
      member: saved,
    })
  } catch (error) {
    console.error('[Error saving member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PATCH /api/members/:id/status — Toggle or update member verification status (login required)
router.patch('/:id/status', requireAuth(), async (req, res) => {
  try {
    const { status } = req.body || {}
    const member = await getMemberById(req.params.id)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })
    const nextStatus = status || (member.status === 'Verified' ? 'Pending' : 'Verified')
    const updated = await saveMember({ ...member, status: nextStatus })
    res.json({ success: true, member: updated })
  } catch (error) {
    console.error('[Error updating member status]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/members/:id — Edit member details (login required)
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const member = await getMemberById(req.params.id)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })
    const { id, memberId, createdAt, ...changes } = req.body || {}
    let updated = await saveMember({ ...member, ...changes, id: member.id, memberId: member.memberId })
    if (req.body?.regenerateCard) {
      const cardRes = await generateAndUploadCard(updated)
      if (cardRes?.cardFullUrl) {
        updated = await saveMember({
          ...updated,
          cardFullUrl: cardRes.cardFullUrl,
          cardFrontUrl: cardRes.cardFrontUrl || updated.cardFrontUrl,
          cardBackUrl: cardRes.cardBackUrl || updated.cardBackUrl,
          cardDesignVersion: 3,
        })
      }
    }
    res.json({ success: true, member: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/members/:id/generate-card — (Re)render the Front & Back card image (login required)
router.post('/:id/generate-card', requireAuth(), async (req, res) => {
  try {
    const member = await getMemberById(req.params.id)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })
    const cardRes = await generateAndUploadCard(member)
    if (!cardRes?.cardFullUrl) return res.status(500).json({ success: false, message: 'Card rendering failed' })
    const updated = await saveMember({
      ...member,
      cardFullUrl: cardRes.cardFullUrl,
      cardFrontUrl: cardRes.cardFrontUrl || member.cardFrontUrl,
      cardBackUrl: cardRes.cardBackUrl || member.cardBackUrl,
      cardDesignVersion: 3,
    })
    res.json({ success: true, member: updated })
  } catch (error) {
    console.error('[Error generating card]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/members/:id — Remove member & physical image assets (login required)
router.delete('/:id', requireAuth(), async (req, res) => {
  try {
    const member = await getMemberById(req.params.id)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })

    // 1. Physically delete member image assets (front, back, full card, profile photo)
    deleteMemberFiles(member)

    // 2. Delete member document from MongoDB
    const deleted = await deleteMember(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'Member could not be deleted from database' })

    console.log(`🗑️  [Member & Assets Deleted] ID: ${member.memberId} (${member.name}) - MongoDB document and disk images removed`)
    res.json({ success: true, message: 'Member record and image assets deleted successfully from MongoDB and storage' })
  } catch (error) {
    console.error('[Error deleting member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
