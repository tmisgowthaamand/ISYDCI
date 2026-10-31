// DEVELOPER MODE routes (Super Super Admin only): providers, webhook/flow event log, audit log,
// flow deploy + status scripts, environment health.
import { Router } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth, ROLES } from '../services/auth.js'
import { listAudit, listEvents, recentEvents } from '../services/audit.js'
import { listProviders, saveProvider, testProvider, activeProviderMap, PROVIDER_DEFS, PURPOSES } from '../services/providers.js'
import { col, mongoUrl } from '../db/mongo.js'
import { recentLiveLogs } from '../utils/liveLogger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')

const router = Router()
router.use(requireAuth(ROLES.SUPER_SUPER_ADMIN))

const ENV_KEYS = [
  'PORT', 'MONGO_URL', 'FRONTEND_URL', 'PUBLIC_SITE_URL',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SUPER_SUPER_ADMIN_USERNAME', 'SUPER_SUPER_ADMIN_PASSWORD', 'JWT_SECRET',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_APP_ID', 'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_FLOW_ID', 'WHATSAPP_FLOW_ENDPOINT_URL', 'WHATSAPP_CALLBACK_URL', 'WHATSAPP_PRIVATE_KEY', 'NGROK_URL', 'FB_PAGE_ACCESS_TOKEN',
]
const SECRET = /TOKEN|SECRET|PASSWORD|KEY|MONGO_URL/i
const mask = v => (!v ? '' : String(v).length <= 8 ? '••••' : `${String(v).slice(0, 4)}••••${String(v).slice(-4)}`)

router.get('/status', async (_req, res) => {
  try {
    const d = col('members').s?.db || null
    const [members, leads, messages, templates, admins] = await Promise.all([
      col('members').estimatedDocumentCount(),
      col('leads').estimatedDocumentCount(),
      col('messages').estimatedDocumentCount(),
      col('templates').estimatedDocumentCount(),
      col('admins').estimatedDocumentCount(),
    ])
    const env = ENV_KEYS.map(k => ({ key: k, set: Boolean(process.env[k]), value: SECRET.test(k) ? mask(process.env[k]) : process.env[k] || '' }))
    res.json({
      success: true,
      status: {
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        database: { url: mongoUrl().replace(/\/\/([^:]+):[^@]+@/, '//$1:***@'), members, leads, messages, templates, admins },
        providers: await activeProviderMap(),
        flow: { id: process.env.WHATSAPP_FLOW_ID || '', endpoint: process.env.WHATSAPP_FLOW_ENDPOINT_URL || '', webhook: process.env.WHATSAPP_CALLBACK_URL || '' },
        env,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/events', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, parseInt(req.query.limit) || 50)
    res.json({ success: true, ...(await listEvents({ page, limit, kind: req.query.kind || '' })), live: recentEvents(20) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/live-logs', (_req, res) => res.json({ success: true, logs: recentLiveLogs }))

router.get('/audit', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, parseInt(req.query.limit) || 50)
    res.json({ success: true, ...(await listAudit({ page, limit, actor: req.query.actor || '', q: req.query.q || '' })) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ---------------------------------------------------------------- providers
router.get('/providers', async (_req, res) => {
  try {
    res.json({ success: true, providers: await listProviders(), purposes: PURPOSES, definitions: PROVIDER_DEFS, active: await activeProviderMap() })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.put('/providers/:key', async (req, res) => {
  try {
    res.json({ success: true, provider: await saveProvider(req.params.key, req.body || {}, req.admin.username), active: await activeProviderMap() })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/providers/:key/test', async (req, res) => {
  try {
    res.json({ success: true, result: await testProvider(req.params.key) })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// ---------------------------------------------------------------- flow scripts (run the existing wacto/*.cjs tools)
function runScript(args, timeoutMs = 180000) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, env: process.env })
    let out = ''
    const timer = setTimeout(() => {
      child.kill()
      out += '\n[timed out]'
    }, timeoutMs)
    child.stdout.on('data', d => (out += d.toString()))
    child.stderr.on('data', d => (out += d.toString()))
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code, output: out })
    })
  })
}

router.post('/flow/status', async (_req, res) => {
  res.json({ success: true, ...(await runScript(['wacto/check_flow_status.cjs'], 90000)) })
})

router.post('/flow/validate', async (_req, res) => {
  res.json({ success: true, ...(await runScript(['wacto/deploy_meta_flow.cjs', '--validate-only'])) })
})

router.post('/flow/deploy', async (req, res) => {
  const args = ['wacto/deploy_meta_flow.cjs']
  if (req.body?.endpoint) args.push('--endpoint', String(req.body.endpoint))
  const result = await runScript(args)
  // the script writes WHATSAPP_FLOW_ID into backend/.env; pick it up without a restart
  const m = /WHATSAPP_FLOW_ID=(\d+)/.exec(result.output)
  if (m) process.env.WHATSAPP_FLOW_ID = m[1]
  res.json({ success: result.code === 0, ...result, flowId: m ? m[1] : process.env.WHATSAPP_FLOW_ID })
})

router.post('/flow/test', async (_req, res) => {
  res.json({ success: true, ...(await runScript(['wacto/test_flow_local.cjs'], 240000)) })
})

export default router
