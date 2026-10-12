import { Router } from 'express'
import { getAllMembers, getMemberById, saveMember, deleteMember, getStats } from '../db/db.js'
import { uploadToCloudinary } from '../config/cloudinary.js'

const router = Router()

// GET /api/members — List all members with search & filter
router.get('/', (req, res) => {
  try {
    const { q = '', status = '' } = req.query
    const members = getAllMembers(q, status)
    res.json({
      success: true,
      total: members.length,
      members,
    })
  } catch (error) {
    console.error('[Error fetching members]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/stats — Dashboard stats
router.get('/stats', (req, res) => {
  try {
    const stats = getStats()
    res.json({ success: true, stats })
  } catch (error) {
    console.error('[Error fetching stats]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/members/:id — Single member details
router.get('/:id', (req, res) => {
  try {
    const member = getMemberById(req.params.id)
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    res.json({ success: true, member })
  } catch (error) {
    console.error('[Error fetching member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/members — Register member & Upload assets to Cloudinary in user's named folder
router.post('/', async (req, res) => {
  try {
    const {
      name,
      photo,
      cardFullImage,
      state,
      district,
      assembly,
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

    // Prepare User-Specific Cloudinary Folder Name (as requested)
    const sanitizedUserName = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'MEMBER'
    const cloudinaryUserFolder = `isydci/members/${sanitizedUserName}`

    console.log(`[Processing Member Registration] Name: ${name}, Folder: ${cloudinaryUserFolder}`)

    // 1. Upload Profile Photo to Cloudinary (if base64 or file provided)
    let photoUrl = photo || '/athletes/1.png'
    if (photo && photo.startsWith('data:image')) {
      const uploadRes = await uploadToCloudinary(photo, cloudinaryUserFolder, 'profile_photo')
      if (uploadRes && uploadRes.secure_url) {
        photoUrl = uploadRes.secure_url
      }
    }

    // 2. Upload Full Combined ID Card (Front & Back on transparent background)
    let cardFullUrl = ''
    if (cardFullImage && cardFullImage.startsWith('data:image')) {
      const uploadFullRes = await uploadToCloudinary(cardFullImage, cloudinaryUserFolder, 'id_card_full')
      if (uploadFullRes && uploadFullRes.secure_url) {
        cardFullUrl = uploadFullRes.secure_url
      }
    }

    // Auto-generate Member ID if missing (Format matching Screenshot 2: ISYDCI-684DDC04)
    const hexCode = Math.random().toString(16).substring(2, 10).toUpperCase()
    const generatedId = memberId || `ISYDCI-${hexCode}`

    // Save record to persistent database (only full card and profile photo stored)
    const saved = saveMember({
      name: name.toUpperCase(),
      memberId: generatedId,
      photo: photoUrl,
      photoUrl,
      cardFullUrl,
      cloudinaryFolder: cloudinaryUserFolder,
      state: state ? state.toUpperCase() : 'TAMIL NADU',
      district: district ? district.toUpperCase() : '',
      assembly: assembly || '',
      zone: zone ? zone.toUpperCase() : '',
      dob: dob || '',
      age: age || '',
      bloodGroup: bloodGroup ? bloodGroup.toUpperCase() : '',
      contact: contact || '',
      address: address || '',
      status,
      business,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    })

    console.log(`[Member Saved Successfully] ID: ${saved.memberId}, Cloudinary: ${cloudinaryUserFolder}`)

    res.status(201).json({
      success: true,
      message: 'Member registered and assets uploaded to Cloudinary successfully',
      member: saved,
    })
  } catch (error) {
    console.error('[Error saving member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PATCH /api/members/:id/status — Toggle or update member verification status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body || {}
    const member = getMemberById(req.params.id)
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    const nextStatus = status || (member.status === 'Verified' ? 'Pending' : 'Verified')
    const updated = saveMember({ ...member, status: nextStatus })
    res.json({ success: true, member: updated })
  } catch (error) {
    console.error('[Error updating member status]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/members/:id — Remove member
router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteMember(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    res.json({ success: true, message: 'Member deleted successfully' })
  } catch (error) {
    console.error('[Error deleting member]:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
