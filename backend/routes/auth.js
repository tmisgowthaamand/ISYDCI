import { Router } from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const router = Router()

// POST /api/auth/login — Authenticate Admin via .env credentials
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body

    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD

    if (!validUsername || !validPassword) {
      console.error('[Auth Error]: ADMIN_USERNAME or ADMIN_PASSWORD not configured in .env')
      return res.status(500).json({
        success: false,
        message: 'Admin credentials not configured in server environment (.env)',
      })
    }

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      })
    }

    if (username.trim() === validUsername && password === validPassword) {
      // Generate secure session token
      const token = `isydci_adm_${Buffer.from(`${validUsername}:${Date.now()}:${Math.random()}`).toString('base64')}`
      
      console.log(`[Admin Login Success] Username: ${username} at ${new Date().toISOString()}`)

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          username: validUsername,
          role: 'Administrator',
          loginTime: new Date().toISOString(),
        },
      })
    } else {
      console.warn(`[Admin Login Failed] Invalid attempt for username: ${username}`)
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      })
    }
  } catch (error) {
    console.error('[Auth Login Exception]:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/auth/verify — Verify current token / session
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer isydci_adm_')) {
    return res.json({
      success: true,
      authenticated: true,
      user: {
        username: process.env.ADMIN_USERNAME || 'admin',
        role: 'Administrator',
      },
    })
  }

  return res.status(401).json({
    success: false,
    authenticated: false,
    message: 'Invalid or expired session token',
  })
})

export default router
