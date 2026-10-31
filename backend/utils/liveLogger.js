// Centralized real-time logger for ISYDCI (Terminal + Web /api/live-logs)
// Captures both Web and WhatsApp interactions in one unified stream without missing anything.

const MAX_LOGS = 100
export const recentLiveLogs = []

function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: true })
}

/**
 * Add a structured log entry to the in-memory buffer (visible at /api/live-logs)
 */
export function addLiveLog(entry) {
  const logItem = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    time: getTimestamp(),
    ...entry,
  }

  recentLiveLogs.unshift(logItem)
  if (recentLiveLogs.length > MAX_LOGS) {
    recentLiveLogs.pop()
  }
  return logItem
}

/**
 * Log an incoming HTTP Web request
 */
export function logWebRequest({ req, res, duration, clientTag, payloadSummary }) {
  const statusIcon = res.statusCode >= 400 ? '❌' : '✅'
  const logLine = `${statusIcon} ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms | Client: ${clientTag}`
  console.log(logLine)

  if (payloadSummary) {
    console.log(`   ↳ [PAYLOAD] ${payloadSummary}`)
  }

  addLiveLog({
    channel: 'WEB',
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    client: clientTag,
    origin: req.headers.origin || req.headers.referer || 'direct',
    summary: `${req.method} ${req.originalUrl}`,
    details: payloadSummary || undefined,
  })
}

/**
 * Log an incoming WhatsApp message (from Meta Cloud API or WACTO)
 */
export function logWhatsAppInbound({ sender, senderName, msgType, text, title, member, rawPayload }) {
  const time = getTimestamp()
  const displayMember = member ? `REGISTERED — ${member.name} (${member.memberId})` : 'NEW / UNREGISTERED'
  const content = text ? `"${text}"` : (title ? `Tapped: "${title}"` : `type=${msgType}`)

  console.log(`\n======================================================`)
  console.log(`💬 [WHATSAPP INBOUND ${time}] from +${sender} (${senderName || 'Unknown'}) type=${msgType}`)
  console.log(`   👤 Identity:   ${displayMember}`)
  console.log(`   📝 Message:    ${content}`)
  console.log(`======================================================\n`)

  addLiveLog({
    channel: 'WHATSAPP',
    direction: 'INBOUND',
    sender: `+${sender}`,
    senderName: senderName || undefined,
    msgType,
    text: text || title || undefined,
    member: member ? { name: member.name, id: member.memberId, status: member.status } : null,
    summary: `[WhatsApp IN] +${sender}: ${content}`,
    details: rawPayload ? (typeof rawPayload === 'object' ? JSON.stringify(rawPayload).slice(0, 300) : String(rawPayload).slice(0, 300)) : undefined,
  })
}

/**
 * Log an outgoing WhatsApp message
 */
export function logWhatsAppOutbound({ recipient, kind, messageId, error, details }) {
  const time = getTimestamp()
  const isSuccess = !error && !!messageId
  const statusIcon = isSuccess ? '✅' : '❌'

  if (isSuccess) {
    console.log(`📤 [WHATSAPP SENT ${time}] ${kind} -> +${recipient} (id ${messageId}) ${statusIcon}`)
  } else {
    console.log(`❌ [WHATSAPP SEND ERROR ${time}] ${kind} -> +${recipient}: ${JSON.stringify(error || 'Failed')}`)
  }

  addLiveLog({
    channel: 'WHATSAPP',
    direction: 'OUTBOUND',
    recipient: `+${recipient}`,
    kind,
    status: isSuccess ? 'SENT' : 'FAILED',
    messageId: messageId || undefined,
    error: error || undefined,
    summary: `[WhatsApp OUT] ${kind} -> +${recipient} ${statusIcon}`,
    details: details || (error ? JSON.stringify(error) : undefined),
  })
}

/**
 * Log a Flow Simulator event
 */
export function logFlowEvent({ option, fromNode, toNode, toNodeName, status, error, details }) {
  const time = getTimestamp()
  const isErr = status === 'error'

  if (isErr) {
    console.log(`\n======================================================`)
    console.log(`❌ [FLOW ERROR ${time}]`)
    console.log(`   👉 Option Clicked: "${option}"`)
    console.log(`   📍 Current Node:   [${fromNode || 'unknown'}]`)
    console.log(`   ⚠️  Issue:          ${error || 'No matching edge found'}`)
    console.log(`======================================================\n`)
  } else {
    console.log(`\n======================================================`)
    console.log(`📱 [FLOW CLICK ${time}]`)
    console.log(`   👉 Option Clicked: "${option}"`)
    console.log(`   📍 From Node:      [${fromNode || 'root'}]`)
    if (toNode) console.log(`   ➡️  Next Node:      [${toNode}] ${toNodeName || ''}`)
    if (details) console.log(`   ⚡ Backend Action: ${details}`)
    console.log(`   ✅ Result:         SUCCESS`)
    console.log(`======================================================\n`)
  }

  addLiveLog({
    channel: 'FLOW',
    status: isErr ? 'ERROR' : 'SUCCESS',
    option,
    fromNode,
    toNode,
    summary: `[Flow ${isErr ? 'Error' : 'Click'}] "${option}" (${fromNode || 'root'} -> ${toNode || 'end'})`,
    details: error || details || undefined,
  })
}
