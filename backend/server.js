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

// In-memory buffer of recent requests for live web inspection
const recentLiveLogs = []

// Comprehensive CORS setup explicitly supporting Vercel and all clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client'],
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Live Request Logger Middleware (Visible in terminal and /api/live-logs)
app.use((req, res, next) => {
  // Suppress health & polling noise from terminal
  if (req.originalUrl === '/api/health' || req.originalUrl === '/api/live-logs' || req.originalUrl === '/api/flow-log') {
    return next()
  }

  const start = Date.now()
  const origin = req.headers.origin || req.headers.referer || 'direct'
  const isVercel = origin.includes('isydci.vercel.app')
  const clientTag = isVercel ? '🟢 [VERCEL: isydci.vercel.app]' : `🌐 [${origin}]`

  res.on('finish', () => {
    const duration = Date.now() - start
    const statusIcon = res.statusCode >= 400 ? '❌' : '✅'
    const logLine = `${statusIcon} ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms | Client: ${clientTag}`
    console.log(logLine)

    if (req.method === 'POST' && req.body?.name) {
      console.log(`   ↳ [PAYLOAD] Member: "${req.body.name}", ID: "${req.body.memberId || 'AUTO'}", Status: "${req.body.status || 'Verified'}"`)
    }

    recentLiveLogs.unshift({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      client: clientTag,
      origin,
      payloadSummary: req.body?.name ? `Member: ${req.body.name}` : undefined,
    })
    if (recentLiveLogs.length > 50) recentLiveLogs.pop()
  })

  next()
})

// Endpoint to display Flow Simulator clicks and errors in the terminal
app.post('/api/flow-log', (req, res) => {
  const { status, option, fromNode, toNode, toNodeName, error, details } = req.body || {}
  const time = new Date().toLocaleTimeString()

  if (status === 'error') {
    console.log(`\n======================================================`)
    console.log(`❌ [FLOW ERROR ${time}]`)
    console.log(`   👉 Option Clicked: "${option}"`)
    console.log(`   📍 Current Node:   [${fromNode || 'unknown'}]`)
    console.log(`   ⚠️  Issue:          ${error || 'No matching edge found in flow JSON'}`)
    console.log(`======================================================\n`)
  } else {
    console.log(`\n======================================================`)
    console.log(`📱 [FLOW CLICK ${time}]`)
    console.log(`   👉 Option Clicked: "${option}"`)
    console.log(`   📍 From Node:      [${fromNode || 'root'}]`)
    if (toNode) {
      console.log(`   ➡️  Next Node:      [${toNode}] ${toNodeName || ''}`)
    }
    if (details) {
      console.log(`   ⚡ Backend Action: ${details}`)
    }
    console.log(`   ✅ Result:         SUCCESS`)
    console.log(`======================================================\n`)
  }

  res.json({ success: true })
})

// Root Endpoint (Displays live connection info and status)
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'ISYDCI Cloudinary & Membership API',
    status: 'ONLINE & LIVE',
    frontend: 'https://isydci.vercel.app/',
    backend: 'https://isydci.onrender.com',
    liveLogging: 'ACTIVE — Real-time request monitoring enabled',
    endpoints: {
      liveLogs: '/api/live-logs',
      health: '/api/health',
      members: '/api/members',
      memberById: '/api/members/:id',
      stats: '/api/stats',
      adminAuth: '/api/auth/login',
    },
    totalCapturedRequests: recentLiveLogs.length,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'ISYDCI API Gateway',
    frontend: 'https://isydci.vercel.app/',
    backend: 'https://isydci.onrender.com',
    status: 'online',
    timestamp: new Date().toISOString(),
  })
})

// Live Logs Web Inspection Endpoint
app.get('/api/live-logs', (req, res) => {
  res.json({
    success: true,
    service: 'ISYDCI Live Request Logs',
    frontendUrl: 'https://isydci.vercel.app/',
    backendUrl: 'https://isydci.onrender.com',
    totalRequestsCaptured: recentLiveLogs.length,
    recentRequests: recentLiveLogs,
    timestamp: new Date().toISOString(),
  })
})

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'ISYDCI Membership & Cloudinary API',
    timestamp: new Date().toISOString(),
    frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://isydci.vercel.app/',
    backendUrl: 'https://isydci.onrender.com',
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
