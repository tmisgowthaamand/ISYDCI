import { Router } from 'express'
import { requireAuth, ROLES } from '../services/auth.js'
import { getCallReportData } from '../services/callReports.js'

const router = Router()
router.use(requireAuth())

// GET /api/reports/calls — Tier 1 operational & telephony analytics
// Automatically scoped to the signed-in telecaller when role === 'telecaller'
router.get('/calls', async (req, res) => {
  try {
    const { from, to, days, telecaller_id: telecallerId, direction, district } = req.query
    const isTelecaller = req.admin?.role === ROLES.TELECALLER
    const scopedTelecaller = isTelecaller ? req.admin.username : (telecallerId || undefined)

    const report = await getCallReportData({
      from,
      to,
      days,
      telecallerId: scopedTelecaller,
      direction,
      district,
    })

    res.json({
      success: true,
      scopedTelecaller: isTelecaller ? req.admin.username : null,
      report,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
