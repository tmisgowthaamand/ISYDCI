import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import membersRouter from './routes/members.js'
import authRouter from './routes/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables dynamically from .env (no hardcoded keys)
dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'ISYDCI Membership & Cloudinary API',
    timestamp: new Date().toISOString(),
    frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
    cloudinaryConfigured: !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME),
    adminConfigured: !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD),
  })
})

// Mount API Routes
app.use('/api/auth', authRouter)
app.use('/api/members', membersRouter)
app.use('/api', membersRouter) // exposes /api/stats

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack)
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`\n======================================================`)
  console.log(`🚀 ISYDCI Backend Server running on http://localhost:${PORT}`)
  console.log(`🌐 Frontend Client URL: ${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173'}`)
  console.log(`☁️  Cloudinary Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT CONFIGURED'}`)
  console.log(`🔑 Cloudinary API Key: ${process.env.CLOUDINARY_API_KEY ? 'Present' : 'Missing'}`)
  console.log(`👤 Admin Username: ${process.env.ADMIN_USERNAME || 'NOT CONFIGURED'}`)
  console.log(`======================================================\n`)
})
