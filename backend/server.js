import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import membersRouter from './routes/members.js'
import authRouter from './routes/auth.js'
import flowEndpointRouter from './routes/flowEndpoint.js'
import whatsappWebhookRouter from './routes/whatsappWebhook.js'
import leadsRouter from './routes/leads.js'
import templatesRouter from './routes/templates.js'
import devRouter from './routes/dev.js'
import { connectDb } from './db/mongo.js'
import { bootstrapFromJson } from './db/db.js'
import { ensureSeedAdmins, optionalAuth } from './services/auth.js'
import { auditMiddleware } from './services/audit.js'
import { startLeadSweeper, syncMembersToLeads } from './services/leads.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { recentLiveLogs, logWebRequest, logFlowEvent } from './utils/liveLogger.js'

// Load environment variables dynamically from .env (no hardcoded keys)
dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Comprehensive CORS setup explicitly supporting Vercel and all clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client'],
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')))
app.use(optionalAuth)
app.use(auditMiddleware)

// Live Request Logger Middleware (Visible in terminal and /api/live-logs)
app.use((req, res, next) => {
  // Suppress health & polling noise from terminal
  if (req.originalUrl === '/api/health' || req.originalUrl === '/api/live-logs' || req.originalUrl === '/api/flow-log') {
    return next()
  }

  const start = Date.now()
  const origin = req.headers.origin || req.headers.referer || 'direct'
  const isLiveSite = origin.includes('isydci.com')
  const clientTag = isLiveSite ? '🟢 [LIVE: isydci.com]' : `🌐 [${origin}]`

  res.on('finish', () => {
    const duration = Date.now() - start
    const payloadSummary = (req.method === 'POST' && req.body?.name)
      ? `Member: "${req.body.name}", ID: "${req.body.memberId || 'AUTO'}", Status: "${req.body.status || 'Verified'}"`
      : undefined

    logWebRequest({ req, res, duration, clientTag, payloadSummary })
  })

  next()
})

// Endpoint to display Flow Simulator clicks and errors in the terminal
app.post('/api/flow-log', (req, res) => {
  logFlowEvent(req.body || {})
  res.json({ success: true })
})

// Root Endpoint (Displays live connection info and status)
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'ISYDCI Cloudinary & Membership API',
    status: 'ONLINE & LIVE',
    frontend: 'https://isydci.com',
    backend: 'https://isydci.onrender.com',
    liveLogging: 'ACTIVE — Real-time request monitoring enabled',
    endpoints: {
      liveLogs: '/api/live-logs',
      health: '/api/health',
      members: '/api/members',
      memberById: '/api/members/:id',
      stats: '/api/stats',
      adminAuth: '/api/auth/login',
      whatsappWebhook: '/api/whatsapp/webhook',
      whatsappFlowEndpoint: '/api/whatsapp/flow-endpoint',
    },
    totalCapturedRequests: recentLiveLogs.length,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api', (req, res) => {
  res.json({
    success: true,
    service: 'ISYDCI API Gateway',
    frontend: 'https://isydci.com',
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
    frontendUrl: 'https://isydci.com',
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
    frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://isydci.com',
    backendUrl: 'https://isydci.onrender.com',
    cloudinaryConfigured: !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME),
    adminConfigured: !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD),
    developerConfigured: !!(process.env.SUPER_SUPER_ADMIN_USERNAME && process.env.SUPER_SUPER_ADMIN_PASSWORD),
    database: 'mongodb',
  })
})

// Mount API Routes
app.use('/api/auth', authRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/dev', devRouter)
app.use('/api/members', membersRouter)
app.use('/api', membersRouter) // exposes /api/stats
app.use('/api/whatsapp/flow-endpoint', flowEndpointRouter)
app.use('/api/whatsapp/webhook', whatsappWebhookRouter)
app.use('/webhook', whatsappWebhookRouter)
app.use('/api/whatsapp/wacto', whatsappWebhookRouter) // legacy path kept for older Meta app configs

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack)
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' })
})

async function start() {
  try {
    await connectDb()
    await bootstrapFromJson()
    await ensureSeedAdmins()
    await syncMembersToLeads()
    startLeadSweeper()
  } catch (err) {
    console.error('❌ [Startup] MongoDB connection failed:', err.message)
    console.error('   Start MongoDB (Windows service "MongoDB") or set MONGO_URL in backend/.env, then restart.')
    process.exit(1)
  }

  app.listen(PORT, () => {
  console.log(`\n======================================================`)
  console.log(`🚀 ISYDCI Backend Server running on http://localhost:${PORT}`)
  console.log(`🔗 Webhook Tunnel: Forward to PORT ${PORT} (run: npm run tunnel)`)
  console.log(`🌐 Frontend Client URL: ${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173'}`)
  console.log(`☁️  Cloudinary Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT CONFIGURED'}`)
  console.log(`🔑 Cloudinary API Key: ${process.env.CLOUDINARY_API_KEY ? 'Present' : 'Missing'}`)
  console.log(`👤 Admin Username: ${process.env.ADMIN_USERNAME || 'NOT CONFIGURED'}`)
  console.log(`======================================================\n`)
})
}

start()
