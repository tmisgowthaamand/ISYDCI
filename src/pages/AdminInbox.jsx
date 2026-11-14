import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL, apiJson, getAuthToken } from '../config/api.js'
import { StatusBadge, SOURCE_LABEL } from './AdminLeads.jsx'
import CallControls from '../components/CallControls.jsx'

// Timestamp & Date Formatting Helpers
const formatDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const formatTime = d => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '')

const getDayDividerLabel = d => {
  if (!d) return ''
  const dateObj = new Date(d)
  const today = new Date()
  const isToday = dateObj.toDateString() === today.toDateString()
  const yesterday = new Date(Date.now() - 86400000)
  const isYesterday = dateObj.toDateString() === yesterday.toDateString()
  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'
  return dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** Formats a Meta template into a personalized direct WhatsApp text message (for free 24h window replies) */
export const renderTemplateAsText = (tpl, lead, customParamsStr = '', { bodyOnly = false } = {}) => {
  if (!tpl) return ''
  let text = ''
  if (!bodyOnly && tpl.header?.text) text += `*${tpl.header.text}*\n\n`

  let body = tpl.body?.text || ''
  const customValues = customParamsStr ? customParamsStr.split('|').map(s => s.trim()) : []

  const name = lead?.name || lead?.whatsappName || 'Athlete'
  const district = lead?.district || 'CHENNAI'
  const memberId = lead?.memberId || 'ISYDCI-PENDING'
  const state = lead?.state || 'TAMIL NADU'

  let defaultVars = [name, district, memberId, state]
  if (tpl.name === 'isydci_id_card_ready') {
    defaultVars = [district, name, memberId, state]
  }

  body = body.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    const idx = parseInt(num, 10) - 1
    if (customValues[idx] !== undefined && customValues[idx] !== '') return customValues[idx]
    if (defaultVars[idx] !== undefined && defaultVars[idx] !== '') return defaultVars[idx]
    return tpl.body?.examples?.[idx] || match
  })

  text += body
  if (bodyOnly) return text.trim()

  if (tpl.footer?.text) text += `\n\n_${tpl.footer.text}_`

  if (tpl.buttons?.length) {
    tpl.buttons.forEach(b => {
      if (b.type === 'URL' && b.url) {
        let url = b.url.replace(/\{\{(\d+)\}\}/g, memberId)
        text += `\n\n🔗 *${b.text || 'View Link'}*: ${url}`
      } else if (b.type === 'PHONE_NUMBER' && (b.phone_number || b.phoneNumber)) {
        text += `\n\n📞 *${b.text || 'Contact'}*: ${b.phone_number || b.phoneNumber}`
      }
    })
  }

  return text.trim()
}

export const resolveTemplateButtons = (tpl, lead) => {
  const memberId = lead?.memberId || 'ISYDCI-PENDING'
  return (tpl?.buttons || []).map(b => ({
    ...b,
    url: b.url ? String(b.url).replace(/\{\{(\d+)\}\}/g, memberId) : b.url,
  }))
}

// Render WhatsApp formatting (*bold*, URLs) in authentic iPhone iMessage bubbles
function FormattedMessageText({ text, isOutbound }) {
  if (!text) return null
  const lines = String(text).split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        if (!line) return <div key={lineIdx} className="h-1.5" />
        // Split on *bold* or URLs
        const parts = line.split(/(\*[^*]+\*|https?:\/\/[^\s]+)/g)
        return (
          <div key={lineIdx} className="leading-relaxed">
            {parts.map((part, partIdx) => {
              if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                return (
                  <strong key={partIdx} className={isOutbound ? 'font-black text-white' : 'font-black text-slate-900'}>
                    {part.slice(1, -1)}
                  </strong>
                )
              }
              if (part.startsWith('http://') || part.startsWith('https://')) {
                return (
                  <a
                    key={partIdx}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline break-all font-semibold ${isOutbound ? 'text-white/95 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    {part}
                  </a>
                )
              }
              return part
            })}
          </div>
        )
      })}
    </div>
  )
}

// Apple iMessage Outbound Tail (Bottom-Right Curved Beak from 2nd screenshot)
function IMessageOutTail() {
  return (
    <svg
      className="absolute -bottom-[2px] -right-[7px] w-[14px] h-[18px] text-[#007AFF] fill-current pointer-events-none select-none"
      viewBox="0 0 14 18"
      aria-hidden="true"
    >
      <path d="M0 0 C0 8 3 14 8 16.5 C11 17.5 13.5 18 14 18 C8 18 4 14 2 9 C1 6.5 0 3 0 0 Z" />
    </svg>
  )
}

// Apple iMessage Inbound Tail (Bottom-Left Curved Beak from 2nd screenshot)
function IMessageInTail() {
  return (
    <svg
      className="absolute -bottom-[2px] -left-[7px] w-[14px] h-[18px] text-[#E9E9EB] fill-current pointer-events-none select-none"
      viewBox="0 0 14 18"
      aria-hidden="true"
    >
      <path d="M14 0 C14 8 11 14 6 16.5 C3 17.5 0.5 18 0 18 C6 18 10 14 12 9 C13 6.5 14 3 14 0 Z" />
    </svg>
  )
}

// Apple iOS Audio Waveform Player (from 3rd phone in 2nd screenshot mockup)
function IMessageAudioWaveform({ isOutbound, duration = '0:14' }) {
  const bars = [35, 65, 40, 85, 100, 75, 45, 60, 90, 80, 50, 70, 95, 60, 40, 75, 55, 30, 45, 65, 85, 60, 40]
  return (
    <div className="flex items-center gap-2.5 py-1 px-1">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
          isOutbound ? 'bg-white text-[#007AFF]' : 'bg-[#007AFF] text-white'
        }`}
      >
        <svg className="w-3.5 h-3.5 ml-0.5 fill-current" viewBox="0 0 24 24">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      </div>
      <div className="flex items-center gap-0.5 h-6 flex-1 min-w-[120px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-0.75 rounded-full ${isOutbound ? 'bg-white/80' : 'bg-slate-500'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className={`text-[11px] font-mono font-semibold shrink-0 ${isOutbound ? 'text-blue-100' : 'text-slate-500'}`}>
        {duration}
      </span>
    </div>
  )
}

// Group messages into chronological timeline with day dividers
const groupMessagesWithDividers = messages => {
  const items = []
  let lastDay = null
  for (const m of messages) {
    const dayLabel = getDayDividerLabel(m.createdAt)
    if (dayLabel && dayLabel !== lastDay) {
      lastDay = dayLabel
      items.push({ isDivider: true, id: `div-${dayLabel}-${m.createdAt || Math.random()}`, label: dayLabel, dateString: formatDate(m.createdAt) })
    }
    items.push({ isDivider: false, ...m })
  }
  return items
}

function formatCallDur(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function CallLogBubbleContent({ m, isOutbound, call }) {
  const cleanText = String(m.text || '').replace(/\s*\(wacid\.[^)]+\)/g, '').trim()
  const isInitialEvent = /started|initiated|incoming/i.test(cleanText) && !/ended|missed|·/i.test(cleanText)
  const isAttended = Boolean(call?.attended ?? call?.answeredAt)
  const recStatus = call?.recording_status || (call?.recordingUrl ? 'ready' : 'none')
  const dur = call?.duration_seconds ?? call?.durationSec ?? 0
  const dirLabel = (call?.call_direction || call?.direction) === 'inbound' ? '↙ Inbound Call' : '↗ Outbound Call'
  const authToken = getAuthToken()
  const streamUrl = call?.callId
    ? `${API_BASE_URL}/api/calls/${encodeURIComponent(call.callId)}/recording?token=${encodeURIComponent(authToken)}`
    : ''
  const ext = String(call?.recordingMimeType || '').includes('ogg') ? 'ogg' : 'webm'

  return (
    <div className="space-y-1.5 min-w-[230px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[12.5px]">{cleanText || dirLabel}</span>
        {call && !isInitialEvent && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isOutbound ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {formatCallDur(dur)}
          </span>
        )}
      </div>

      {call && !isInitialEvent && isAttended && recStatus === 'ready' && streamUrl && (
        <div className={`pt-1.5 border-t space-y-1.5 ${isOutbound ? 'border-white/25' : 'border-slate-300/70'}`}>
          <audio controls preload="none" src={streamUrl} className="w-full h-8" />
          <div className="flex items-center justify-between text-[10px]">
            <span className={isOutbound ? 'text-blue-100 font-semibold' : 'text-emerald-700 font-semibold'}>
              ● Live call recording ready
            </span>
            <a
              href={streamUrl}
              download={`isydci-call-${call.waId || 'lead'}-${call.callId.slice(-8)}.${ext}`}
              className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
                isOutbound
                  ? 'bg-white text-[#007AFF] hover:bg-blue-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              ⬇ Download
            </a>
          </div>
        </div>
      )}

      {call && !isInitialEvent && isAttended && recStatus === 'pending' && (
        <div className={`text-[10px] italic ${isOutbound ? 'text-blue-100' : 'text-amber-700'}`}>
          Processing live call recording...
        </div>
      )}

      {call && !isInitialEvent && !isAttended && (
        <div className={`text-[10px] font-semibold ${isOutbound ? 'text-blue-100' : 'text-slate-500'}`}>
          Unanswered call (no recording)
        </div>
      )}
    </div>
  )
}

// CRM · Omnichannel Live Inbox — Blue & White iOS Style Desk
export default function AdminInbox() {
  const [params, setParams] = useSearchParams()
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all') // all | registered | unread | new | contacted ...
  const [channelFilter, setChannelFilter] = useState('all') // all | whatsapp | web
  const [q, setQ] = useState('')
  const [labels, setLabels] = useState({})
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [leadCalls, setLeadCalls] = useState({})
  const [telecallers, setTelecallers] = useState([])
  const authInfo = (() => {
    try {
      return JSON.parse(localStorage.getItem('isydci_admin_auth') || '{}')
    } catch {
      return {}
    }
  })()
  const isDeveloper = authInfo?.role === 'super_super_admin' || Boolean(authInfo?.isDeveloper)
  const isTelecaller = authInfo?.role === 'telecaller'

  useEffect(() => {
    if (!isDeveloper) return
    apiJson('/api/telecallers')
      .then(d => setTelecallers(d.telecallers || []))
      .catch(() => {})
  }, [isDeveloper])
  const [reply, setReply] = useState('')
  const [replyImage, setReplyImage] = useState(null) // { url, templateName }
  const [note, setNote] = useState('')
  const [templates, setTemplates] = useState([])
  const [tplId, setTplId] = useState('')
  const [tplParams, setTplParams] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('reply') // reply | template | notes
  const [copied, setCopied] = useState(false)
  const chatScrollRef = useRef(null)
  const limit = 30

  const scrollToBottom = (smooth = false) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }

  const loadList = async (p = page, showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true)
      const sp = new URLSearchParams({ page: p, limit, q })
      if (filter === 'unread') sp.set('sort', 'lastMessageAt')
      else if (filter !== 'all') sp.set('status', filter)
      if (channelFilter !== 'all') sp.set('source', channelFilter)
      const d = await apiJson(`/api/leads?${sp}`)
      let items = d.leads || []
      if (filter === 'unread') items = items.filter(l => l.unread)
      setLeads(items)
      setTotal(d.total || 0)
      setLabels(d.statusLabels || {})
    } catch (e) {
      setError(e.message)
    } finally {
      if (showLoader) setTimeout(() => setRefreshing(false), 400)
    }
  }

  const openLead = async phone => {
    try {
      setError('')
      const [d, cRes] = await Promise.all([
        apiJson(`/api/leads/${phone}`),
        apiJson(`/api/calls/lead/${encodeURIComponent(phone)}`).catch(() => null),
      ])
      setSelected(d.lead)
      setMessages(d.messages || [])
      if (cRes?.calls) {
        const map = {}
        for (const c of cRes.calls) map[c.callId] = c
        setLeadCalls(map)
      }
      apiJson(`/api/leads/${phone}/read`, { method: 'POST' }).catch(() => {})
      setLeads(prev => prev.map(l => (l.phone === phone ? { ...l, unread: false } : l)))
      setParams({ phone })
      setTimeout(() => scrollToBottom(false), 50)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    loadList(page)
  }, [page, filter, channelFilter])

  useEffect(() => {
    const fetchTpls = () =>
      apiJson('/api/templates?status=APPROVED&sync=true')
        .then(d => setTemplates(d.templates || []))
        .catch(() => {})
    fetchTpls()
    const id = setInterval(fetchTpls, 10000)
    const phone = params.get('phone')
    if (phone) openLead(phone)
    return () => clearInterval(id)
  }, [])

  // Live refresh of open conversation every 6 seconds
  useEffect(() => {
    if (!selected) return
    const id = setInterval(async () => {
      try {
        const d = await apiJson(`/api/leads/${selected.phone}`)
        setMessages(d.messages || [])
        setSelected(d.lead)
      } catch {}
    }, 6000)
    return () => clearInterval(id)
  }, [selected?.phone])

  const sendReply = async e => {
    if (e) e.preventDefault()
    if ((!reply.trim() && !replyImage?.url) || !selected) return
    setSending(true)
    setError('')
    try {
      await apiJson(`/api/leads/${selected.phone}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          text: reply.trim(),
          imageUrl: replyImage?.url || undefined,
          footerText: replyImage?.footerText || undefined,
          headerText: replyImage?.headerText || undefined,
          buttons: replyImage?.buttons || undefined,
          templateName: replyImage?.templateName || undefined,
        }),
      })
      setReply('')
      setReplyImage(null)
      setInfo('Message sent successfully!')
      openLead(selected.phone)
      loadList(page)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const sendTemplate = async () => {
    if (!tplId || !selected) return
    setSending(true)
    setError('')
    try {
      const targetTpl = templates.find(t => t.id === tplId)
      const body = tplParams.split('|').map(s => s.trim()).filter(Boolean)
      const header = targetTpl?.header?.format === 'IMAGE' && targetTpl?.header?.mediaUrl ? { link: targetTpl.header.mediaUrl } : undefined
      await apiJson(`/api/leads/${selected.phone}/send-template`, {
        method: 'POST',
        body: JSON.stringify({ templateId: tplId, params: { body, header } }),
      })
      setInfo('Meta template (Image + Text + Buttons) dispatched.')
      setTplId('')
      setTplParams('')
      openLead(selected.phone)
      loadList(page)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const sendTemplateAsDirectReply = async (templateObj, customParams) => {
    if (!templateObj || !selected) return
    const buttons = resolveTemplateButtons(templateObj, selected)
    const hasInteractiveButtons = buttons.some(b => ['URL', 'QUICK_REPLY'].includes(String(b.type || '').toUpperCase()))
    const textToSend = renderTemplateAsText(templateObj, selected, customParams, { bodyOnly: hasInteractiveButtons })
    if (!textToSend) return
    const imageUrl = templateObj.header?.format === 'IMAGE' ? templateObj.header?.mediaUrl : undefined
    setSending(true)
    setError('')
    try {
      await apiJson(`/api/leads/${selected.phone}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          text: textToSend,
          imageUrl,
          headerText: hasInteractiveButtons && templateObj.header?.format === 'TEXT' ? templateObj.header.text : undefined,
          footerText: hasInteractiveButtons ? templateObj.footer?.text : undefined,
          buttons: hasInteractiveButtons ? buttons : undefined,
          templateName: templateObj.name,
        }),
      })
      setInfo(`Free direct reply "${templateObj.name}"${imageUrl || hasInteractiveButtons ? ' (Image + Text + Button in 1 message)' : ''} delivered!`)
      setTplId('')
      setTplParams('')
      setReply('')
      setReplyImage(null)
      openLead(selected.phone)
      loadList(page)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const patch = async changes => {
    try {
      const d = await apiJson(`/api/leads/${selected.phone}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      setSelected(d.lead)
      setLeads(prev => prev.map(l => (l.phone === d.lead.phone ? { ...l, ...d.lead } : l)))
    } catch (e) {
      setError(e.message)
    }
  }

  const addNote = async e => {
    e.preventDefault()
    if (!note.trim()) return
    try {
      const d = await apiJson(`/api/leads/${selected.phone}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text: note.trim() }),
      })
      setSelected(d.lead)
      setNote('')
    } catch (e) {
      setError(e.message)
    }
  }

  const copyPhone = () => {
    if (!selected?.phone) return
    navigator.clipboard.writeText(`+${selected.phone}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const chips = [
    { v: 'all', l: 'All Leads' },
    { v: 'registered', l: 'Registered' },
    { v: 'unread', l: 'Unread' },
    { v: 'new', l: 'New' },
    { v: 'contacted', l: 'Contacted' },
    { v: 'registration_started', l: 'In Progress' },
  ]

  const unreadCount = leads.filter(l => l.unread).length

  // Blue & White Apple style avatar generator
  const getAvatarColor = (name = '', status = '') => {
    if (status === 'registered' || status === 'card_issued') return 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-blue-500/25'
    if (status === 'registration_started' || status === 'incomplete') return 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-amber-500/20'
    if (status === 'contacted') return 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-sky-500/20'
    if (status === 'lost') return 'bg-slate-400 text-white'
    return 'bg-gradient-to-tr from-indigo-600 to-blue-800 text-white shadow-indigo-600/20'
  }

  const timelineItems = groupMessagesWithDividers(messages)

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fadeIn font-sans bg-slate-50/50">
      
      {/* ==============================================================
          TOP CRM DESK HEADER (BLUE & WHITE EXECUTIVE STYLE)
          ============================================================== */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-[#007AFF] text-white flex items-center justify-center font-black shadow-md shadow-blue-500/25 text-base sm:text-lg shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200/90 px-1.5 sm:px-2 py-0.5 rounded-md shrink-0">
                CRM DESK
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#007AFF] animate-pulse"></span>
                <span className="hidden xs:inline">Meta WhatsApp Cloud API Connected</span>
                <span className="xs:hidden">API Connected</span>
              </span>
            </div>
            <h1 className="text-base sm:text-xl md:text-2xl font-black text-[#0b1e3f] font-['Montserrat'] tracking-tight mt-0.5 truncate">
              Live Client Conversations
            </h1>
          </div>
        </div>

        {/* Top Channel Overview Pills & Sync */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200/90 rounded-xl px-3.5 py-1.5 shadow-2xs font-medium">
            <span>Total Contacts: <b className="text-slate-900">{total}</b></span>
            <span>&bull;</span>
            <span className="text-blue-700 font-bold inline-flex items-center gap-1">
              <span>💬 WhatsApp & 🌐 Web</span>
            </span>
            {unreadCount > 0 && (
              <>
                <span>&bull;</span>
                <span className="text-white bg-[#007AFF] font-bold px-1.5 py-0.2 rounded-full text-[10px]">{unreadCount} new</span>
              </>
            )}
          </div>

          <button
            onClick={() => loadList(page, true)}
            title="Refresh conversations list"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <svg className={`w-3.5 h-3.5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span className="hidden xs:inline">{refreshing ? 'Syncing…' : 'Sync Inbox'}</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold px-1 cursor-pointer">&times;</button>
        </div>
      )}
      {info && (
        <div className="mb-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span className="font-semibold">{info}</span>
          </div>
          <button onClick={() => setInfo('')} className="text-blue-500 hover:text-blue-700 font-bold px-1 cursor-pointer">&times;</button>
        </div>
      )}

      {/* ==============================================================
          MAIN DUAL PANE WORKSPACE (BLUE & WHITE THEME)
          ============================================================== */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden min-h-0">
        
        {/* ============================================================
            LEFT PANE: SEARCH, FILTERS & LEADS STREAM
            ============================================================ */}
        <div className={`w-full md:w-[280px] lg:w-[310px] shrink-0 border-r border-slate-200 flex-col bg-white overflow-hidden h-full ${
          selected ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Search & Channel Selection Header */}
          <div className="p-3 border-b border-slate-100 space-y-2.5 bg-slate-50/80">
            {/* Search Input */}
            <form onSubmit={e => { e.preventDefault(); setPage(1); loadList(1) }} className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search athlete, phone or ID…"
                className="w-full bg-white pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/10 transition-all font-medium shadow-2xs"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setPage(1); loadList(1) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                >
                  &times;
                </button>
              )}
            </form>

            {/* Apple Style Segmented Channel Selector */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-xl text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setChannelFilter('all')}
                className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                  channelFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                All Sources
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('whatsapp')}
                className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer inline-flex items-center justify-center gap-1 ${
                  channelFilter === 'whatsapp' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                <span>💬 WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('web')}
                className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer inline-flex items-center justify-center gap-1 ${
                  channelFilter === 'web' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                <span>🌐 Website</span>
              </button>
            </div>

            {/* Horizontal Scrollable Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
              {chips.map(c => {
                const isActive = filter === c.v
                return (
                  <button
                    key={c.v}
                    onClick={() => { setFilter(c.v); setPage(1) }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{c.l}</span>
                    {c.v === 'unread' && unreadCount > 0 && (
                      <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? 'bg-white text-[#007AFF] font-black' : 'bg-[#007AFF] text-white font-bold'}`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Leads List Stream */}
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {leads.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="text-xs font-bold text-slate-700">No conversations found</div>
                <p className="text-[11px] text-slate-400 mt-1">Try clearing filters or search query.</p>
                {(q || filter !== 'all' || channelFilter !== 'all') && (
                  <button
                    onClick={() => { setQ(''); setFilter('all'); setChannelFilter('all'); setPage(1); loadList(1) }}
                    className="mt-3 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              leads.map(l => {
                const isSelected = selected?.phone === l.phone
                const initials = (l.name || l.whatsappName || '#').slice(0, 2).toUpperCase()
                const avatarColor = getAvatarColor(l.name || l.whatsappName, l.status)
                const isWeb = l.source === 'web'

                return (
                  <button
                    key={l.id || l.phone}
                    onClick={() => openLead(l.phone)}
                    className={`w-full text-left px-3.5 py-3 transition-all cursor-pointer relative group flex items-start gap-3 border-l-4 ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-[#007AFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
                        : 'border-l-transparent hover:bg-slate-50'
                    }`}
                  >
                    {/* Athlete Avatar with Blue Accent */}
                    <div className="relative shrink-0">
                      {l.photoUrl || l.photo ? (
                        <img
                          src={l.photoUrl || l.photo}
                          alt={l.name || 'Athlete'}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-xs tracking-wider ${avatarColor}`}>
                          {initials}
                        </div>
                      )}
                      {/* Channel Icon Dot */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold ${
                          isWeb ? 'bg-[#007AFF] text-white' : 'bg-slate-700 text-white'
                        }`}
                        title={isWeb ? 'Website Portal' : 'WhatsApp'}
                      >
                        {isWeb ? '🌐' : '💬'}
                      </span>
                    </div>

                    {/* Middle Card Content */}
                    <div className="min-w-0 flex-1">
                      {/* Row 1: Full Name & Time */}
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-xs ${l.unread ? 'font-black text-slate-900' : isSelected ? 'font-extrabold text-blue-900' : 'font-bold text-slate-800'} break-words`}>
                          {l.name || l.whatsappName || `+${l.phone}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {formatTime(l.lastMessageAt) || formatDate(l.createdAt) || 'Recent'}
                        </span>
                      </div>

                      {/* Row 2: Phone & Member ID */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-500 truncate">
                          +{l.phone}
                        </span>
                        {l.memberId ? (
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-mono font-bold border border-blue-200/60">
                            {l.memberId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 truncate">
                            {l.district || SOURCE_LABEL[l.source] || 'Prospective'}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Channel Pill & Status Badges */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <StatusBadge status={l.status} label={l.statusLabel} />
                        
                        {/* Channel Badge */}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                          isWeb ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {isWeb ? 'Web' : 'WhatsApp'}
                        </span>

                        {l.district && (
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]">
                            {l.district}
                          </span>
                        )}

                        {l.unread && (
                          <span className="ml-auto text-[9px] bg-[#007AFF] text-white font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Left Footer: Pagination */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/60 shrink-0">
            <span className="font-medium text-[11px]">
              Showing <b className="text-slate-700">{leads.length}</b> of <b className="text-slate-700">{total}</b> leads
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous page"
              >
                &larr;
              </button>
              <span className="px-2 text-xs font-bold text-slate-700">
                p.{page}
              </span>
              <button
                disabled={leads.length < limit}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next page"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            RIGHT PANE: iPHONE / iMESSAGE STYLE CHAT WORKSPACE
            ============================================================ */}
        <div className={`flex-1 flex-col bg-white overflow-hidden min-w-0 min-h-0 h-full ${
          selected ? 'flex' : 'hidden md:flex'
        }`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/40">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#007AFF] flex items-center justify-center mb-3 shadow-sm border border-blue-100">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-slate-800">Select an athlete conversation</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                Choose any athlete from the left list to view the complete conversation thread with exact timestamps and dates.
              </p>
            </div>
          ) : (
            <>
              {/* ---------------- APPLE iOS STYLE EXECUTIVE CONVERSATION HEADER ---------------- */}
              <div className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0 shadow-2xs">
                
                {/* Left: Mobile Back Button + Athlete Avatar + Full Name & Metadata */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Mobile Back Button (Returns to leads list on phones) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null)
                      const p = new URLSearchParams(window.location.search)
                      p.delete('phone')
                      window.history.replaceState({}, '', `${window.location.pathname}${p.toString() ? '?' + p.toString() : ''}`)
                    }}
                    className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-[#007AFF] hover:bg-slate-100 rounded-lg flex items-center gap-1 font-bold text-xs shrink-0 cursor-pointer transition-colors"
                    title="Back to leads list"
                  >
                    <svg className="w-5 h-5 text-[#007AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="hidden xs:inline text-xs font-bold text-[#007AFF]">Leads</span>
                  </button>

                  {/* Circular Avatar with Active Indicator */}
                  <div className="relative shrink-0">
                    {selected.photoUrl || selected.photo ? (
                      <img
                        src={selected.photoUrl || selected.photo}
                        alt={selected.name || 'Athlete'}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-blue-500/20 shadow-xs"
                      />
                    ) : (
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-black shadow-xs tracking-wider ${getAvatarColor(selected.name || selected.whatsappName, selected.status)}`}>
                        {(selected.name || selected.whatsappName || '#').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#007AFF] border-2 border-white" title="Active on WhatsApp" />
                  </div>

                  {/* Name & Subtitle Info: Clean 2-line layout */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Full Registered Name + Verified + Member ID + Channel Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap min-w-0">
                      <h2 className="font-black text-xs sm:text-base text-slate-900 tracking-tight whitespace-nowrap truncate sm:whitespace-nowrap shrink-0 max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                        {selected.name || selected.whatsappName || 'Athlete'}
                      </h2>
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#007AFF] text-white text-[9px] sm:text-[10px] font-black shrink-0 shadow-2xs" title="Verified ISYDCI Athlete">
                        ✓
                      </span>
                      {selected.memberId && (
                        <span className="text-blue-700 font-mono font-bold text-[10px] sm:text-xs bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded border border-blue-200/80 shrink-0">
                          ID: {selected.memberId}
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 hidden xs:inline ${
                        selected.source === 'web'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {selected.source === 'web' ? '🌐 Web' : '💬 WhatsApp'}
                      </span>
                    </div>

                    {/* Line 2: Phone • District (Clean Subline, Never wraps) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 flex-nowrap min-w-0">
                      <button
                        onClick={copyPhone}
                        className="font-mono text-slate-700 hover:text-blue-600 transition-colors inline-flex items-center gap-1 cursor-pointer font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] shrink-0"
                        title="Click to copy phone number"
                      >
                        <span>+{selected.phone}</span>
                        <span className="text-[10px] text-slate-400">{copied ? '✓' : '📋'}</span>
                      </button>

                      {selected.district && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-medium text-[10px] sm:text-xs inline-flex items-center gap-1 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px]" title={`${selected.district}${selected.state ? `, ${selected.state}` : ''}`}>
                            <span>📍</span>
                            <span className="truncate">{selected.district}{selected.state ? `, ${selected.state}` : ''}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Clean Action Controls */}
                <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
                  <CallControls phone={selected.phone} name={selected.name || selected.whatsappName} />
                  {/* Status Dropdown */}
                  <select
                    value={selected.status}
                    onChange={e => patch({ status: e.target.value })}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-bold bg-white text-slate-700 shadow-2xs cursor-pointer focus:outline-none focus:border-[#007AFF]"
                  >
                    {Object.entries(labels).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>

                  {/* Telecaller Assignment: Super Super Admin can assign; Super Admin & Telecaller view read-only */}
                  {isDeveloper ? (
                    <select
                      value={selected.assignedTo || ''}
                      onChange={e => patch({ assignedTo: e.target.value || null })}
                      className="hidden 2xl:block px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#007AFF] cursor-pointer"
                      title="Assign lead to telecaller (Developer only)"
                    >
                      <option value="">Unassigned</option>
                      {telecallers.filter(t => t.active !== false).map(t => (
                        <option key={t.id} value={t.username}>
                          👤 {t.displayName || t.username}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="hidden 2xl:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600"
                      title={isTelecaller ? 'Assigned to you' : 'Assigned telecaller (read-only)'}
                    >
                      👤 {selected.assignedTo || 'Unassigned'}
                    </span>
                  )}

                  {/* View Member Card Link (if member exists) */}
                  {selected.memberId && (
                    <a
                      href={`/membership-card?id=${selected.memberId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 sm:px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] sm:text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 shrink-0"
                      title="View verified digital card in portal"
                    >
                      <span>🪪</span>
                      <span className="hidden xs:inline">ID Card</span>
                    </a>
                  )}

                  {/* Open in WhatsApp Button */}
                  <a
                    href={`https://wa.me/${selected.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 sm:px-3 py-1 rounded-lg bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 shrink-0"
                    title="Open official WhatsApp app or web"
                  >
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* ---------------- iPHONE / iMESSAGE STYLE CHAT TIMELINE (2nd SCREENSHOT) ---------------- */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar bg-[#F8FAFC]">
                {/* Security / Channel Badge */}
                <div className="flex justify-center my-1 select-none">
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1 rounded-full shadow-2xs border border-slate-200 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <span>🔒 Official ISYDCI Customer Messaging</span>
                    <span>&bull;</span>
                    <span className="text-blue-700 font-semibold">Meta Cloud API</span>
                  </span>
                </div>

                {timelineItems.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-14">
                    <p className="font-semibold text-slate-600">No message history yet</p>
                    <p className="text-[11px] mt-1 text-slate-400">Send an iMessage or template reply below to start the conversation.</p>
                  </div>
                ) : (
                  timelineItems.map(item => {
                    // Apple iOS Centered Date Divider
                    if (item.isDivider) {
                      return (
                        <div key={item.id} className="flex items-center justify-center my-3 select-none">
                          <span className="bg-slate-200/80 text-slate-600 text-[11px] font-semibold px-3.5 py-0.5 rounded-full shadow-2xs border border-slate-300/50 backdrop-blur-xs">
                            {item.label} • {item.dateString}
                          </span>
                        </div>
                      )
                    }

                    const m = item
                    const isOutbound = m.direction === 'out'

                    return (
                      <div
                        key={m.id || m._id || `${m.createdAt}-${Math.random()}`}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} animate-fadeIn group`}
                      >
                        {/* ---------------- CLIENT INBOUND MESSAGE (AUTHENTIC GRAY BUBBLE WITH TAIL) ---------------- */}
                        {!isOutbound && (
                          <div className="flex flex-col items-start max-w-[85%] sm:max-w-[70%]">
                            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-bold text-slate-600">
                              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">
                                👤
                              </span>
                              <span>{selected.name || 'Client Athlete'}</span>
                              <span className="text-slate-300">&bull;</span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {m.provider === 'web' ? 'Website Inquiry' : 'WhatsApp'}
                              </span>
                            </div>

                            {/* iOS Style Received Bubble with Bottom-Left Tail */}
                            <div className="relative bg-[#E9E9EB] text-[#000000] px-4 py-2.5 rounded-[18px] text-[13.5px] leading-relaxed shadow-2xs whitespace-pre-wrap break-words selection:bg-blue-200 border border-black/[0.04]">
                              {m.type === 'call_log' || m.channel === 'whatsapp_call' ? (
                                <CallLogBubbleContent m={m} isOutbound={false} call={leadCalls[m.waMessageId]} />
                              ) : m.type === 'audio' || m.type === 'voice' ? (
                                <IMessageAudioWaveform isOutbound={false} duration={m.duration || '0:14'} />
                              ) : m.text ? (
                                <FormattedMessageText text={m.text} isOutbound={false} />
                              ) : (
                                <span className="italic text-slate-500">[{m.type || 'Message'}]</span>
                              )}
                              <IMessageInTail />
                            </div>

                            {/* Timestamp & Date */}
                            <div className="text-[10px] text-slate-400 px-1 mt-1 font-medium select-none">
                              {formatTime(m.createdAt)} • {formatDate(m.createdAt)}
                            </div>
                          </div>
                        )}

                        {/* ---------------- OUTBOUND MESSAGE (iMESSAGE VIBRANT BLUE BUBBLE WITH TAIL) ---------------- */}
                        {isOutbound && (
                          <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
                            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-bold text-blue-700">
                              <span className="text-[10px] text-blue-600 font-semibold">
                                {m.templateName ? `Template: ${m.templateName}` : 'Direct Reply'}
                              </span>
                              <span className="text-slate-300">&bull;</span>
                              <span>ISYDCI ({m.sentBy || 'Bot'})</span>
                              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                                {m.sentBy === 'bot' ? '🤖' : '👨‍💼'}
                              </span>
                            </div>

                            {/* iOS iMessage Vibrant Blue Bubble with Bottom-Right Tail */}
                            <div className="relative bg-[#007AFF] text-white px-4 py-2.5 rounded-[18px] text-[13.5px] leading-relaxed shadow-sm shadow-blue-500/20 whitespace-pre-wrap break-words selection:bg-white/30">
                              {m.imageUrl && (
                                <img
                                  src={m.imageUrl}
                                  alt="Template header"
                                  className="w-full max-h-48 object-cover rounded-xl mb-2 border border-white/20"
                                />
                              )}
                              {m.type === 'call_log' || m.channel === 'whatsapp_call' ? (
                                <CallLogBubbleContent m={m} isOutbound={true} call={leadCalls[m.waMessageId]} />
                              ) : m.type === 'audio' || m.type === 'voice' ? (
                                <IMessageAudioWaveform isOutbound={true} duration={m.duration || '0:18'} />
                              ) : m.text ? (
                                <FormattedMessageText text={m.text} isOutbound={true} />
                              ) : (
                                <span className="italic text-blue-100">[{m.type || 'Message'}]</span>
                              )}
                              {Array.isArray(m.buttons) && m.buttons.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-white/25 space-y-1.5">
                                  {m.buttons.map((b, bi) => (
                                    <a
                                      key={bi}
                                      href={b.url || '#'}
                                      target={b.url ? '_blank' : undefined}
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-white text-[#007AFF] font-extrabold text-xs shadow-2xs hover:bg-blue-50 transition-colors"
                                    >
                                      <span>{String(b.type).toUpperCase() === 'URL' ? '↗' : '↩'}</span>
                                      <span>{b.text || 'Visit website'}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                              <IMessageOutTail />
                            </div>

                            {/* Exact Time, Date & Delivery Checkmarks */}
                            <div className="text-[10px] text-slate-400 px-1 mt-1 font-medium flex items-center gap-1.5 select-none">
                              <span>{formatTime(m.createdAt)} • {formatDate(m.createdAt)}</span>
                              <span className="text-slate-300">&bull;</span>
                              <span className={m.status === 'read' ? 'text-blue-600 font-black' : m.status === 'delivered' ? 'text-blue-500 font-bold' : 'text-slate-400 font-semibold'}>
                                {m.status === 'read' ? '✓✓ Read' : m.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent'}
                              </span>
                            </div>

                            {/* Failure / Billing Error Callout */}
                            {m.error && (
                              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1 text-left w-full shadow-2xs">
                                <div className="font-extrabold flex items-center gap-1 text-rose-700">
                                  <span>⚠️ Delivery Issue:</span>
                                  <span>{m.error}</span>
                                </div>
                                {m.error.includes('131042') && (
                                  <p className="text-[10px] text-rose-700 leading-snug">
                                    Meta Cloud API requires an active payment card in Meta Business Suite to send official templates. <strong>Tip:</strong> Use the <strong>Direct Message</strong> tab below to deliver messages 100% free inside the 24h window!
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                <div className="h-0.5" />
              </div>

              {/* ---------------- APPLE iOS STYLE COMPOSER (2nd SCREENSHOT PILL & CIRCULAR SEND) ---------------- */}
              <div className="border-t border-slate-200 bg-white p-3 space-y-2.5 shrink-0 shadow-lg">
                
                {/* Mode Selector Tabs (Blue & White Theme) */}
                <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-100 pb-2 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveTab('reply')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'reply'
                        ? 'bg-[#007AFF] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>💬 Direct Message</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                      activeTab === 'reply' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      Free 24h
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('template')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'template'
                        ? 'bg-[#007AFF] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>📄 WhatsApp Template</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      activeTab === 'template' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      Meta Billed
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('notes')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'notes'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>📝 Notes ({selected.notes?.length || 0})</span>
                  </button>

                  <span className="ml-auto text-[11px] text-blue-700 font-bold hidden sm:inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-[#007AFF] animate-pulse"></span>
                    <span>24h Free Customer Service Window Active</span>
                  </span>
                </div>

                {/* TAB 1: Direct Reply (Apple Pill Input with Circular Up-Arrow Send Button) */}
                {activeTab === 'reply' && (
                  <form onSubmit={sendReply} className="space-y-2">
                    {/* Quick Template Insertion Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-0.5">
                      <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
                        <span>⚡ Templates:</span>
                      </span>
                      {templates.map(tp => (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() => {
                            const btns = resolveTemplateButtons(tp, selected)
                            const hasBtns = btns.some(b => ['URL', 'QUICK_REPLY'].includes(String(b.type || '').toUpperCase()))
                            setReply(renderTemplateAsText(tp, selected, '', { bodyOnly: hasBtns }))
                            if ((tp.header?.format === 'IMAGE' && tp.header?.mediaUrl) || hasBtns) {
                              setReplyImage({
                                url: tp.header?.format === 'IMAGE' ? tp.header.mediaUrl : '',
                                headerText: hasBtns && tp.header?.format === 'TEXT' ? tp.header.text : '',
                                footerText: hasBtns ? tp.footer?.text : '',
                                buttons: hasBtns ? btns : [],
                                templateName: tp.name,
                              })
                            } else {
                              setReplyImage(null)
                            }
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[10px] font-bold border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                          title={`Insert "${tp.name}" template into iMessage`}
                        >
                          {tp.header?.format === 'IMAGE' && <span>🖼️</span>}
                          <span>+ {tp.name.replace(/^isydci_/, '')}</span>
                          {tp.buttons?.length > 0 && <span className="text-emerald-600">↗</span>}
                        </button>
                      ))}
                    </div>

                    {/* Attached Template Header Image / Buttons Preview */}
                    {replyImage && (replyImage.url || replyImage.buttons?.length > 0) && (
                      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900">
                        {replyImage.url && <img src={replyImage.url} alt="Header preview" className="w-12 h-8 object-cover rounded-lg border border-blue-200 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[11px] text-blue-800 flex items-center gap-1.5 flex-wrap">
                            <span>🖼️ {replyImage.templateName}</span>
                            {(replyImage.buttons || []).map((b, bi) => (
                              <span key={bi} className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                ↗ {b.text}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-blue-600 truncate">Will be delivered with image + text + button in 1 combined WhatsApp message</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyImage(null)}
                          className="text-blue-500 hover:text-blue-800 font-bold px-1.5 cursor-pointer"
                          title="Remove attached template media/buttons"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Apple iOS Style Message Bar (Pill Input + Circular Up-Arrow Button) */}
                    <div className="flex items-center gap-2">
                      {/* Plus / Template Switcher Button (Apple iOS Style) */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('template')}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer border border-slate-200 shadow-2xs"
                        title="Open WhatsApp templates"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>

                      {/* Pill-shaped Input Container */}
                      <div className="flex-1 relative flex items-center bg-slate-100 hover:bg-slate-50 focus-within:bg-white border border-slate-300/80 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-blue-500/10 rounded-full px-4 py-1.5 shadow-2xs transition-all">
                        <input
                          type="text"
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              sendReply(e)
                            }
                          }}
                          placeholder={`iMessage to ${selected.name || '+' + selected.phone}…`}
                          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium pr-9"
                          autoFocus
                        />

                        {/* Circular Up-Arrow Send Button (From 2nd Screenshot) */}
                        <button
                          type="submit"
                          disabled={sending || !reply.trim()}
                          className={`absolute right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                            reply.trim() && !sending
                              ? 'bg-[#007AFF] hover:bg-blue-600 text-white active:scale-90 shadow-blue-500/30'
                              : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                          }`}
                          title="Send message (Enter)"
                        >
                          <svg className="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 select-none">
                      <span className="text-blue-700 font-semibold">✓ Free 24h customer window • Instant WhatsApp delivery</span>
                      <span>Press Enter to send</span>
                    </div>
                  </form>
                )}

                {/* TAB 2: WhatsApp Templates (Blue & White Theme) */}
                {activeTab === 'template' && (
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={tplId}
                        onChange={e => setTplId(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white min-w-[220px] focus:outline-none focus:border-[#007AFF] shadow-2xs"
                      >
                        <option value="">Select approved WhatsApp template…</option>
                        {templates.map(tp => (
                          <option key={tp.id} value={tp.id}>
                            {tp.name} ({tp.language})
                          </option>
                        ))}
                      </select>

                      <input
                        value={tplParams}
                        onChange={e => setTplParams(e.target.value)}
                        placeholder="Custom vars (optional): value1 | value2"
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs flex-1 min-w-[180px] bg-white focus:outline-none focus:border-[#007AFF] shadow-2xs"
                      />

                      {/* Primary Free Option: Send as Direct Reply */}
                      <button
                        type="button"
                        onClick={() => {
                          const targetTpl = templates.find(t => t.id === tplId)
                          sendTemplateAsDirectReply(targetTpl, tplParams)
                        }}
                        disabled={!tplId || sending}
                        className="px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                        title="Delivers template message as a free 24h customer service message (No Meta credit card needed!)"
                      >
                        <span>⚡ Send as Free Direct Message (₹0)</span>
                      </button>

                      {/* Edit in Reply Box */}
                      <button
                        type="button"
                        onClick={() => {
                          const targetTpl = templates.find(t => t.id === tplId)
                          if (targetTpl) {
                            setReply(renderTemplateAsText(targetTpl, selected, tplParams))
                            if (targetTpl.header?.format === 'IMAGE' && targetTpl.header?.mediaUrl) {
                              setReplyImage({ url: targetTpl.header.mediaUrl, templateName: targetTpl.name })
                            } else {
                              setReplyImage(null)
                            }
                            setActiveTab('reply')
                          }
                        }}
                        disabled={!tplId}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <span>✏️ Edit in Message Box</span>
                      </button>

                      {/* Official Meta Template (Requires Card) */}
                      <button
                        type="button"
                        onClick={sendTemplate}
                        disabled={!tplId || sending}
                        className="px-3 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shrink-0"
                        title="Sends official Meta template payload (Requires payment card in Meta Business Suite)"
                      >
                        <span>📄 Official Meta Template</span>
                      </button>
                    </div>

                    {/* Live Preview of Rendered Template */}
                    {tplId && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 space-y-2 shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Live Message Preview (Personalized for {selected.name || selected.phone}):</span>
                          <span className="text-blue-600 font-bold">Ready for Free 24h Delivery (1 Combined Message)</span>
                        </div>
                        {(() => {
                          const previewTpl = templates.find(t => t.id === tplId)
                          return (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-800 space-y-2">
                              {previewTpl?.header?.format === 'IMAGE' && previewTpl?.header?.mediaUrl && (
                                <img
                                  src={previewTpl.header.mediaUrl}
                                  alt="Template Header"
                                  className="w-full max-h-44 object-cover rounded-lg border border-slate-200"
                                />
                              )}
                              <div className="whitespace-pre-line font-sans text-xs">
                                {renderTemplateAsText(previewTpl, selected, tplParams, { bodyOnly: (previewTpl?.buttons || []).length > 0 })}
                                {previewTpl?.footer?.text && (previewTpl?.buttons || []).length > 0 && (
                                  <div className="text-[10px] text-slate-400 mt-1.5">{previewTpl.footer.text}</div>
                                )}
                              </div>
                              {(previewTpl?.buttons || []).length > 0 && (
                                <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                                  {previewTpl.buttons.map((b, bi) => (
                                    <span key={bi} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                      <span>{String(b.type).toUpperCase() === 'URL' ? '↗' : '↩'}</span>
                                      <span>{b.text}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 text-[11px] text-blue-900 bg-blue-50/80 border border-blue-200/80 p-2.5 rounded-xl">
                      <span className="text-xs shrink-0">💡</span>
                      <span>
                        <strong>Two ways to send:</strong> Click <strong>"⚡ Send as Free Direct Message (₹0)"</strong> to deliver immediately within the 24h window with NO credit card needed. Use <strong>"Official Meta Template"</strong> only if you have configured a payment method in Meta Business Suite.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 3: Internal Notes */}
                {activeTab === 'notes' && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                    <form onSubmit={addNote} className="flex gap-2 items-center">
                      <input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Add internal team note (not visible to athlete)…"
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#007AFF] font-medium"
                      />
                      <button
                        type="submit"
                        disabled={!note.trim()}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        Save Note
                      </button>
                    </form>

                    {selected.notes?.length > 0 && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pt-1">
                        {selected.notes.map((n, i) => (
                          <div key={i} className="text-xs bg-white p-2.5 rounded-xl border border-slate-200 flex items-start justify-between gap-2 shadow-2xs">
                            <span className="text-slate-800 font-medium">{n.text}</span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {n.by || 'admin'} &bull; {formatDate(n.at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
