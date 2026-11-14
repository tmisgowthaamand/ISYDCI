import { Router } from 'express'
import { authenticate, requireAuth, listAdmins, createAdmin, updateAdmin, deleteAdmin, ROLES, ROLE_LABEL } from '../services/auth.js'
import { logAudit } from '../services/audit.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/auth/login — brute-force protected (max 10 failed attempts / 15 min per IP)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' })
    }
    const result = await authenticate(username, password)
    if (!result) {
      console.warn(`[Admin Login Failed] Invalid attempt for username: ${username}`)
      await logAudit({ actor: String(username).slice(0, 40), role: '-', action: 'LOGIN_FAILED', ip: req.ip })
      return res.status(401).json({ success: false, message: 'Invalid username or password' })
    }
    const { admin, token } = result
    console.log(`[Admin Login Success] ${admin.username} (${admin.role}) at ${new Date().toISOString()}`)
    await logAudit({ actor: admin.username, role: admin.role, action: 'LOGIN', ip: req.ip })
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        phone: admin.phone || null,
        role: admin.role,
        roleLabel: ROLE_LABEL[admin.role],
        isDeveloper: admin.role === ROLES.SUPER_SUPER_ADMIN,
        isTelecaller: admin.role === ROLES.TELECALLER,
        loginTime: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Auth Login Exception]:', error)
    return res.status(500).json({ success: false, message: 'Login failed: ' + error.message })
  }
})

// GET /api/auth/me — validates the stored token and returns the role (used by the admin layout guard)
router.get('/me', requireAuth(), (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.admin.sub,
      username: req.admin.username,
      phone: req.admin.phone || null,
      role: req.admin.role,
      roleLabel: ROLE_LABEL[req.admin.role],
      isDeveloper: req.admin.role === ROLES.SUPER_SUPER_ADMIN,
      isTelecaller: req.admin.role === ROLES.TELECALLER,
      expiresAt: new Date(req.admin.exp * 1000).toISOString(),
    },
  })
})

// ---------------------------------------------------------------- admin accounts (developer only)
router.get('/admins', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (_req, res) => {
  res.json({ success: true, admins: await listAdmins(), roles: ROLE_LABEL })
})

router.post('/admins', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const admin = await createAdmin({ ...req.body, createdBy: req.admin.username })
    res.status(201).json({ success: true, admin })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.patch('/admins/:id', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    const admin = await updateAdmin(req.params.id, req.body || {}, req.admin)
    res.json({ success: true, admin })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.delete('/admins/:id', requireAuth(ROLES.SUPER_SUPER_ADMIN), async (req, res) => {
  try {
    await deleteAdmin(req.params.id, req.admin)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
