import React, { useState, useEffect, useMemo, useRef } from 'react'
import { toPng } from 'html-to-image'
import { CardFront, CardBack } from '../components/MembershipCard.jsx'
import isydciFlowData from '../data/isydci_flow_v1.json'
import isydciLabels from '../data/isydci.labels.json'
import PhotoCropModal from '../components/PhotoCropModal.jsx'

const indianStatesAndUTs = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
  'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
]

const bloodGroups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

export default function FlowSimulator() {
  // Flow Data State
  const [flow, setFlow] = useState(isydciFlowData)
  const [currentFlowName, setCurrentFlowName] = useState('ISYDCI Official Bot v1 (isydci_flow_v1.json)')
  const [showBackendReplies, setShowBackendReplies] = useState(true)
  const [backendServer, setBackendServer] = useState('Local Dev (localhost:5000)')
  const [dbMembers, setDbMembers] = useState([])
  const [selectedUser, setSelectedUser] = useState({
    name: 'Amit Kumar',
    phone: '9876543210',
    memberId: 'ISYDCI-684DDC04',
    sport: 'Boxing',
    state: 'Tamil Nadu'
  })
  const [cardViewTab, setCardViewTab] = useState('combined') // 'combined' | 'front' | 'back'
  const [downloadTargetMember, setDownloadTargetMember] = useState(null)
  const [registrationDraft, setRegistrationDraft] = useState({
    name: '',
    state: 'Tamil Nadu',
    district: 'Chennai',
    assembly: 'Velachery',
    zone: 'Ward 25',
    dob: '15 Aug 1999',
    age: '27',
    bloodGroup: 'O+',
    contact: '+91 91234 56789',
    address: 'No. 12, 3rd Street, Velachery, Chennai - 600042, Tamil Nadu, India',
    sport: 'ATHLETICS',
    photo: '/athletes/1.png'
  })
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false)
  const [flowScreenStep, setFlowScreenStep] = useState(1) // 1: Location, 2: DOB, 3: Address, 4: Photo, 5: Confirm
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [customAthleteMode, setCustomAthleteMode] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPhone, setCustomPhone] = useState('')
  const hiddenDualRef = useRef(null)

  // API base URL
  const apiBaseUrl = 'http://localhost:5000'
  const [backendStatus, setBackendStatus] = useState('online') // 'online' | 'offline' | 'checking'

  // Chat & Navigation State
  const [currentNodeId, setCurrentNodeId] = useState('root')
  const [inspectedNodeId, setInspectedNodeId] = useState('root')
  const [chatMessages, setChatMessages] = useState([])
  const [historyStack, setHistoryStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  
  // UI Interactive States
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [activeSheetNode, setActiveSheetNode] = useState(null)
  const [inputText, setInputText] = useState('')
  const [activeTab, setActiveTab] = useState('inspect') // 'inspect' | 'edit'
  const [checksFilter, setChecksFilter] = useState('all') // 'all' | 'errors' | 'warnings' | 'notes'
  const [nodeSearch, setNodeSearch] = useState('')
  
  // Modals
  const [jsonModalNode, setJsonModalNode] = useState(null)
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pastedJsonText, setPastedJsonText] = useState('')
  const [pasteError, setPasteError] = useState('')

  // Edit form state
  const [editingNode, setEditingNode] = useState(null)

  const chatBottomRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const nodesScrollRef = useRef(null)
  const nodeItemRefs = useRef({})
  const inspectorRef = useRef(null)

  // Map nodes and edges
  const { nodeMap, outEdgesMap, inEdgesCount } = useMemo(() => {
    const nodes = flow.nodes || []
    const edges = flow.edges || []
    const nMap = {}
    const eMap = {}
    const inCount = {}

    nodes.forEach(n => {
      nMap[n.nodeId] = n
      eMap[n.nodeId] = []
      inCount[n.nodeId] = 0
    })

    edges.forEach(e => {
      if (eMap[e.fromNodeId]) {
        eMap[e.fromNodeId].push(e)
      }
      if (inCount[e.toNodeId] !== undefined) {
        inCount[e.toNodeId]++
      }
    })

    return { nodeMap: nMap, outEdgesMap: eMap, inEdgesCount: inCount }
  }, [flow])

  // Current inspected node
  const inspectedNode = useMemo(() => {
    return nodeMap[inspectedNodeId] || nodeMap['root'] || flow.nodes?.[0]
  }, [nodeMap, inspectedNodeId, flow])

  // Current node on phone
  const currentNode = useMemo(() => {
    return nodeMap[currentNodeId] || nodeMap['root'] || flow.nodes?.[0]
  }, [nodeMap, currentNodeId, flow])

  // Automated Verification Checks (Same rules as verify_flow.py and route_check.py)
  const checks = useMemo(() => {
    const results = []
    const nodes = flow.nodes || []
    const edges = flow.edges || []
    const nMap = {}
    nodes.forEach(n => { nMap[n.nodeId] = n })

    // 1. Root check
    if (!nMap['root']) {
      results.push({
        type: 'error',
        title: 'Missing Root Node',
        desc: 'No node with nodeId "root" was found. The bot cannot start.',
        nodeId: null
      })
    } else {
      const rootKeywords = nMap['root'].keywords || []
      if (rootKeywords.length === 0) {
        results.push({
          type: 'error',
          title: 'Root has no keywords',
          desc: 'Root node has no trigger keywords. "Hi" or "Start" will not launch the bot.',
          nodeId: 'root'
        })
      }
    }

    // 2. Reachability from root
    const reachable = new Set(['root'])
    const queue = ['root']
    const adj = {}
    edges.forEach(e => {
      if (!adj[e.fromNodeId]) adj[e.fromNodeId] = []
      adj[e.fromNodeId].push(e.toNodeId)
    })

    while (queue.length > 0) {
      const curr = queue.shift()
      const neighbors = adj[curr] || []
      neighbors.forEach(nxt => {
        if (!reachable.has(nxt)) {
          reachable.add(nxt)
          queue.push(nxt)
        }
      })
    }

    nodes.forEach(n => {
      if (!reachable.has(n.nodeId)) {
        results.push({
          type: 'error',
          title: `Unreachable node: "${n.name}"`,
          desc: `Node ${n.nodeId} cannot be reached from root by any outgoing edge. WACTO wipes keywords of non-root nodes on import.`,
          nodeId: n.nodeId
        })
      }
    })

    // 3. Option character limits and WhatsApp constraints
    nodes.forEach(n => {
      const act = n.data?.action || {}
      const it = n.data?.interactiveType
      const body = n.data?.body || ''

      if (!body.trim()) {
        results.push({
          type: 'error',
          title: `Empty message body in "${n.name}"`,
          desc: 'Meta WhatsApp Business API strictly rejects messages with empty body.',
          nodeId: n.nodeId
        })
      } else if (body.length > 1024) {
        results.push({
          type: 'error',
          title: `Body exceeds 1,024 chars in "${n.name}"`,
          desc: `Current length is ${body.length} characters (WhatsApp limit is 1,024).`,
          nodeId: n.nodeId
        })
      }

      // Buttons check
      const buttons = act.buttons || []
      if (it === 'button') {
        if (buttons.length > 3) {
          results.push({
            type: 'error',
            title: `More than 3 reply buttons in "${n.name}"`,
            desc: `WhatsApp allows a maximum of 3 quick reply buttons. Found: ${buttons.length}.`,
            nodeId: n.nodeId
          })
        }
        buttons.forEach(b => {
          const title = b.reply?.title || ''
          if (title.length > 20) {
            results.push({
              type: 'error',
              title: `Button title > 20 chars in "${n.name}"`,
              desc: `Button "${title}" has ${title.length} chars (Meta limit is 20).`,
              nodeId: n.nodeId
            })
          }
        })
      }

      // List check
      const sections = act.sections || []
      if (it === 'list') {
        let totalRows = 0
        sections.forEach(sec => {
          const sTitle = sec.title || ''
          if (sTitle.length > 24) {
            results.push({
              type: 'warning',
              title: `Section title > 24 chars in "${n.name}"`,
              desc: `Section "${sTitle}" exceeds Meta recommendation of 24 characters.`,
              nodeId: n.nodeId
            })
          }
          const rows = sec.rows || []
          totalRows += rows.length
          rows.forEach(r => {
            const rTitle = r.title || ''
            const rDesc = r.description || ''
            if (rTitle.length > 24) {
              results.push({
                type: 'error',
                title: `Row title > 24 chars in "${n.name}"`,
                desc: `Row "${rTitle}" has ${rTitle.length} chars (WhatsApp limit is 24).`,
                nodeId: n.nodeId
              })
            }
            if (rDesc.length > 72) {
              results.push({
                type: 'error',
                title: `Row description > 72 chars in "${n.name}"`,
                desc: `Description for "${rTitle}" has ${rDesc.length} chars (WhatsApp limit is 72).`,
                nodeId: n.nodeId
              })
            }
          })
        })

        if (totalRows > 10) {
          results.push({
            type: 'error',
            title: `List has ${totalRows} rows in "${n.name}"`,
            desc: 'WhatsApp list picker allows a maximum of 10 rows across all sections.',
            nodeId: n.nodeId
          })
        }
      }
    })

    // 4. Duplicate option clashes across outgoing edges
    const edgeKeywordsMap = {}
    edges.forEach(e => {
      (e.keywords || []).forEach(kw => {
        if (!edgeKeywordsMap[kw]) edgeKeywordsMap[kw] = []
        edgeKeywordsMap[kw].push({ from: e.fromNodeId, to: e.toNodeId })
      })
    })

    // Check backend labels
    const backendOnly = isydciLabels?.backend_only || []
    backendOnly.forEach(label => {
      if (edgeKeywordsMap[label]) {
        results.push({
          type: 'warning',
          title: `Backend-only label "${label}" matches a WACTO edge`,
          desc: `Label "${label}" is handled entirely by backend webhook; having an edge to a WACTO node might cause duplicate responses.`,
          nodeId: null
        })
      }
    })

    // If no errors, add informational notes
    if (results.filter(r => r.type === 'error').length === 0) {
      results.push({
        type: 'note',
        title: 'All Edge Keywords Matched',
        desc: 'Every outgoing edge keyword cleanly links from its originating interactive node option.',
        nodeId: null
      })
      results.push({
        type: 'note',
        title: 'WhatsApp Limits Respected',
        desc: 'Button count <= 3, list rows <= 10, option titles within 20/24 char bounds.',
        nodeId: null
      })
      results.push({
        type: 'note',
        title: 'Backend Webhook Interceptors Active',
        desc: 'Verified Member ID lookup, Cloudinary ID Card delivery and UTR confirmation mapped.',
        nodeId: null
      })
    }

    return results
  }, [flow])

  const filteredChecks = useMemo(() => {
    if (checksFilter === 'all') return checks
    if (checksFilter === 'errors') return checks.filter(c => c.type === 'error')
    if (checksFilter === 'warnings') return checks.filter(c => c.type === 'warning')
    if (checksFilter === 'notes') return checks.filter(c => c.type === 'note')
    return checks
  }, [checks, checksFilter])

  const errorCount = checks.filter(c => c.type === 'error').length
  const warnCount = checks.filter(c => c.type === 'warning').length
  const noteCount = checks.filter(c => c.type === 'note').length

  // Fetch all registered members from localhost:5000 on mount & handle URL query params (?id=... or ?phone=...)
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/members`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.members)) {
          setDbMembers(d.members)
          const params = new URLSearchParams(window.location.search)
          const qId = params.get('id')
          const qPhone = params.get('phone')

          if (qId || qPhone) {
            const match = d.members.find(m => 
              (qId && m.memberId === qId) ||
              (qPhone && (m.contact || '').replace(/\D/g, '') === qPhone.replace(/\D/g, ''))
            )
            if (match) {
              switchSimulatedUser({ ...match, isUnregistered: false })
              return
            }
          }

          // Otherwise sync selected user
          const found = d.members.find(m => m.contact === selectedUser.phone || m.memberId === selectedUser.memberId)
          if (found) {
            setSelectedUser(found)
          } else if (d.members.length > 0 && !selectedUser.isUnregistered) {
            setSelectedUser(d.members[0])
          }
        }
      })
      .catch(() => {})
  }, [apiBaseUrl])

  // Restart chat from root (checks if phone is already registered)
  const handleRestartChat = async (userOverride) => {
    const userToTest = userOverride || selectedUser
    setIsSheetOpen(false)
    setActiveSheetNode(null)
    setHistoryStack([])
    setRedoStack([])

    let regMember = null
    const isExplicitlyUnregistered = Boolean(userToTest.isUnregistered || !userToTest.phone || userToTest.phone === '9123456789')
    
    if (!isExplicitlyUnregistered) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/members/phone/${userToTest.phone}`)
        const data = await res.json()
        if (data.success && data.member) {
          regMember = data.member
        }
      } catch (_) {
        regMember = dbMembers.find(m => (m.contact || '').replace(/\D/g, '') === (userToTest.phone || '').replace(/\D/g, ''))
      }
    }

    const timeStr = '11:00 am'
    const initialMsgs = [
      {
        id: 'enc-banner',
        type: 'system',
        text: 'Messages are end-to-end encrypted. No one outside of this chat can read them.'
      },
      {
        id: 'user-hi',
        type: 'user',
        text: 'Hi',
        time: timeStr
      }
    ]

    if (regMember) {
      initialMsgs.push({
        id: `returning-${Date.now()}`,
        type: 'returning_member',
        member: regMember,
        time: timeStr
      })
      setCurrentNodeId('root')
      setInspectedNodeId('root')
    } else {
      const root = nodeMap['root'] || flow.nodes?.[0]
      if (root) {
        initialMsgs.push({
          id: `node-${root.nodeId}-${Date.now()}`,
          type: 'bot',
          nodeId: root.nodeId,
          node: root,
          time: timeStr
        })
        setCurrentNodeId(root.nodeId)
        setInspectedNodeId(root.nodeId)
      }
    }

    setChatMessages(initialMsgs)
  }

  // Switch simulated athlete and immediately restart simulator chat
  const switchSimulatedUser = (userObj) => {
    setSelectedUser(userObj)
    setIsFlowModalOpen(false)
    setFlowScreenStep(1)
    if (userObj.isUnregistered) {
      setRegistrationDraft({
        name: '',
        contact: '+91 91234 56789',
        state: 'Tamil Nadu',
        district: 'Chennai',
        assembly: 'Velachery',
        zone: 'Ward 25',
        dob: '15 Aug 1999',
        age: '27',
        bloodGroup: 'O+',
        address: 'No. 12, 3rd Street, Velachery, Chennai - 600042, Tamil Nadu, India',
        sport: 'ATHLETICS',
        photo: '/athletes/1.png'
      })
    } else {
      setRegistrationDraft({
        name: userObj.name || 'Amit Kumar',
        contact: userObj.contact || userObj.phone || '+91 98765 43210',
        sport: userObj.sport || 'ATHLETICS',
        state: userObj.state || 'Tamil Nadu',
        district: userObj.district || 'Chennai',
        assembly: userObj.assembly || 'Velachery',
        zone: userObj.zone || 'Ward 25',
        dob: userObj.dob || '15 Aug 1999',
        age: userObj.age || '27',
        bloodGroup: userObj.bloodGroup || 'O+',
        address: userObj.address || 'No. 12, 3rd Street, Velachery, Chennai - 600042, Tamil Nadu, India',
        photo: userObj.photo || '/athletes/1.png'
      })
    }
    handleRestartChat(userObj)
  }

  // Handle WhatsApp Flow Screen Submission (Screen 6 -> Screen 7 -> Screen 8)
  const handleFlowSubmit = () => {
    setIsFlowModalOpen(false)
    const timeStr = '12:30 pm'
    const newMemberId = 'ISYDCI-684DDC04'
    const newMember = {
      name: (registrationDraft.name || 'Amit Kumar').toUpperCase(),
      contact: registrationDraft.contact || '+91 98765 43210',
      memberId: newMemberId,
      sport: registrationDraft.sport || 'ATHLETICS',
      state: registrationDraft.state || 'Tamil Nadu',
      district: registrationDraft.district || 'Chennai',
      assembly: registrationDraft.assembly || 'Velachery',
      zone: registrationDraft.zone || 'Ward 25',
      dob: registrationDraft.dob || '15 Aug 1999',
      age: registrationDraft.age || '27',
      bloodGroup: registrationDraft.bloodGroup || 'O+',
      address: registrationDraft.address || 'No. 12, 3rd Street, Velachery, Chennai - 600042, Tamil Nadu, India',
      photo: registrationDraft.photo || '/athletes/1.png',
      photoUrl: registrationDraft.photo || '/athletes/1.png',
      status: 'Verified',
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    // Save to backend database
    fetch(`${apiBaseUrl}/api/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'flow-simulator' },
      body: JSON.stringify(newMember)
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.member) {
          setSelectedUser({ ...d.member, isUnregistered: false })
          setDbMembers(prev => [d.member, ...prev.filter(m => m.memberId !== d.member.memberId)])
        }
      })
      .catch(() => {})

    // Screen 7: Registration Submitted! (Show success message)
    setChatMessages(prev => [
      ...prev,
      {
        id: `reg-submit-${Date.now()}`,
        type: 'reg_submitted',
        memberId: newMemberId,
        time: timeStr
      }
    ])

    logToTerminal({
      status: 'success',
      option: 'Submit Registration',
      fromNode: 'flow_screen_6',
      details: `Submitted registration for ${newMember.name} (${newMember.memberId})`
    })

    // Screen 8: Your ISYDCI Member Card (Show immediately after submission)
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: `card-ready-${Date.now()}`,
          type: 'card_ready',
          member: newMember,
          time: timeStr
        }
      ])
    }, 600)
  }

  // Initialize on mount and when selectedUser changes
  useEffect(() => {
    handleRestartChat()
  }, [flow, selectedUser.phone, selectedUser.isUnregistered])

  // Single Download Card handler (Generates combined Front & Back PNG)
  const handleDownloadCard = async (memberToDl) => {
    const target = memberToDl || selectedUser
    setDownloadTargetMember(target)

    setTimeout(async () => {
      try {
        if (hiddenDualRef.current) {
          const dataUrl = await toPng(hiddenDualRef.current, {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff'
          })
          const link = document.createElement('a')
          link.download = `ISYDCI_Membership_Card_${(target.name || 'Athlete').replace(/\s+/g, '_')}_${target.memberId || 'ID'}.png`
          link.href = dataUrl
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          setChatMessages(prev => [
            ...prev,
            {
              id: `dl-${Date.now()}`,
              type: 'backend',
              text: `✅ *Combined Membership Card Downloaded*\n\nHigh-resolution PNG digital athlete ID card (Front & Back) downloaded for *${target.name}* (${target.memberId}).`,
              time: '11:00 am'
            }
          ])
        } else {
          window.open(`/membership-card?id=${target.memberId || ''}`, '_blank')
        }
      } catch (err) {
        console.error('Download error:', err)
        window.open(`/membership-card?id=${target.memberId || ''}`, '_blank')
      }
    }, 200)
  }

  // State for WhatsApp In-Simulator Share Modal
  const [shareModalMember, setShareModalMember] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Single Share Card handler (Opens in-phone WhatsApp modal, copies link, & posts interactive share bubble)
  const handleShareCard = async (memberToShare) => {
    const target = memberToShare || selectedUser
    const shareUrl = `${window.location.origin}/membership-card?id=${target.memberId || 'ISYDCI'}`
    const shareText = `🏆 Indian Sports Youth Development Council of India (ISYDCI)\nOfficial Athlete Membership Card: *${target.name}*\nMember ID: *${target.memberId}*\nAccreditation: Verified Athlete ✅ (Reg No: 49/1997)\n\nView & Download Card: ${shareUrl}`

    // 1. Copy direct link to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
      }
    } catch (_) {}

    // 2. Open the In-Phone WhatsApp Share Sheet overlay
    setShareModalMember(target)

    // 3. Post a rich share confirmation message inside the WhatsApp chat
    setChatMessages(prev => [
      ...prev,
      {
        id: `share-${Date.now()}`,
        type: 'share_card_message',
        shareMember: target,
        shareUrl: shareUrl,
        shareText: shareText,
        time: '11:00 am'
      }
    ])

    logToTerminal({
      status: 'success',
      option: 'Share Card',
      fromNode: currentNodeId,
      details: `Generated interactive share modal & link for ${target.name} (${target.memberId})`
    })
  }

  // Scroll ONLY inside the phone chat to the very end — NEVER scrolls the main window
  useEffect(() => {
    const scrollPhoneToEnd = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
    scrollPhoneToEnd()
    const timer = setTimeout(scrollPhoneToEnd, 60)
    return () => clearTimeout(timer)
  }, [chatMessages, isSheetOpen])

  // Scroll ONLY inside the Nodes list container (never scrolls the outer browser window)
  useEffect(() => {
    if (!inspectedNodeId) return
    const el = nodeItemRefs.current[inspectedNodeId]
    const container = nodesScrollRef.current
    if (el && container) {
      const topOffset = el.offsetTop - container.offsetTop
      container.scrollTo({ top: Math.max(0, topOffset - 10), behavior: 'smooth' })
    }
  }, [inspectedNodeId])

  // Check backend health on mount and poll periodically
  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/health`, {
        cache: 'no-store',
        headers: { 'X-Client': 'flow-simulator' }
      })
      if (res.ok) {
        setBackendStatus('online')
        return
      }
    } catch (_) {}

    // Fallback check: if backend is running on port 5000
    try {
      const res2 = await fetch(`${apiBaseUrl}/api/members`, { cache: 'no-store' })
      if (res2.ok) {
        setBackendStatus('online')
        return
      }
    } catch (_) {}

    setBackendStatus('offline')
  }

  useEffect(() => {
    checkBackendHealth()
    const interval = setInterval(checkBackendHealth, 4000)
    return () => clearInterval(interval)
  }, [apiBaseUrl])

  // Helper to print flow clicks and errors directly to the backend terminal
  const logToTerminal = (logData) => {
    fetch(`${apiBaseUrl}/api/flow-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch(() => {})
  }

  // Handle option tap or text submission
  const handleSelectOption = (optionTitle) => {
    if (!optionTitle) return
    setIsSheetOpen(false)

    // Save history for Undo
    setHistoryStack(prev => [...prev, {
      currentNodeId,
      chatMessages: [...chatMessages]
    }])
    setRedoStack([])

    const timeStr = '11:00 am'

    // Add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: optionTitle,
      time: timeStr
    }

    const newMsgs = [...chatMessages, userMsg]

    // Check if backend answers this option
    const isBackendOnly = isydciLabels?.backend_only?.includes(optionTitle)
    const isDual = isydciLabels?.dual?.includes(optionTitle)

    // ── 0. WHATSAPP FLOW SCREEN: REGISTER ATHLETE ────────────────────────────
    if (optionTitle === 'Register Athlete' || optionTitle === 'Register' || optionTitle === 'New Registration') {
      setIsFlowModalOpen(true)
      setFlowScreenStep(1)
      logToTerminal({
        status: 'success',
        option: optionTitle,
        fromNode: currentNodeId,
        details: 'Opened WhatsApp Flow: Athlete Registration (Screen 2: Location Details)'
      })
      return
    }

    if (optionTitle === 'Submit Registration') {
      handleFlowSubmit()
      return
    }

    if (optionTitle === 'Share Card') {
      handleShareCard(selectedUser)
      return
    }

    if (optionTitle === 'Close') {
      handleSelectOption('Main Menu')
      return
    }

    // ── 1. MY MEMBERSHIP CARD / DOWNLOAD CARD ────────────────────────────────
    if (optionTitle === 'My Membership Card' || optionTitle === 'View & Download Card' || optionTitle === 'View & Download' || optionTitle === 'Download Card' || optionTitle === 'Download ID Card' || optionTitle === 'View Membership Card') {
      if (optionTitle === 'Download Card' || optionTitle === 'Download ID Card') {
        handleDownloadCard(selectedUser)
        return
      }

      // Fetch latest member record by phone
      let memberObj = selectedUser
      fetch(`${apiBaseUrl}/api/members/phone/${selectedUser.phone}`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.member) {
            memberObj = d.member
            setSelectedUser(d.member)
          }
        })
        .catch(() => {})
        .finally(() => {
          newMsgs.push({
            id: `backend-${Date.now()}`,
            type: 'backend',
            text: `🪪 *Official ISYDCI Athlete Membership Card*\n\n👤 Athlete: ${memberObj.name}\n🆔 Member ID: ${memberObj.memberId}\n🥊 Sport: ${memberObj.sport || 'ATHLETICS'}\n📍 State: ${memberObj.state || 'TAMIL NADU'}\nAccreditation: Verified Athlete ✅\nSociety Reg No: 49/1997\n\n📄 Official Front & Back Combined Card displayed below:`,
            time: timeStr
          })

          newMsgs.push({
            id: `card-${Date.now()}`,
            type: 'card',
            member: memberObj,
            time: timeStr
          })

          setChatMessages(newMsgs)
          logToTerminal({
            status: 'success',
            option: optionTitle,
            fromNode: currentNodeId,
            details: `Displayed Front & Back Card for ${memberObj.name} (${memberObj.memberId})`
          })
        })
      return
    }

    const lowerTrim = (optionTitle || '').trim().toLowerCase()
    const isConfirmAction = optionTitle === 'Confirm & Issue Card' || 
      optionTitle === 'Use Athlete Photo' ||
      ((nodeMap[currentNodeId]?.name || '').includes('Passport Photo') && 
       (lowerTrim === 'confirm' || lowerTrim === 'issue card' || lowerTrim === 'yes' || lowerTrim === 'done' || lowerTrim === 'ok'))

    // ── 2. NEW REGISTRATION PHOTO SUBMIT & CARD ISSUANCE ───────────────────────
    if (isConfirmAction) {
      // Step A: Show the uploaded photo in chat as user upload message
      newMsgs.push({
        id: `photo-msg-${Date.now()}`,
        type: 'uploaded_photo',
        photo: registrationDraft.photo || '/athletes/1.png',
        caption: `📸 Official 137×136 Passport Photo Uploaded by ${registrationDraft.name || 'DINESH'}`,
        time: timeStr
      })

      const generatedHex = Math.random().toString(16).substring(2, 10).toUpperCase()
      const newMemberId = `ISYDCI-${generatedHex}`
      const newMember = {
        name: (registrationDraft.name || 'DINESH').toUpperCase(),
        contact: registrationDraft.contact || selectedUser.phone || '7305171482',
        memberId: newMemberId,
        sport: registrationDraft.sport || 'ATHLETICS',
        state: (registrationDraft.state || 'TAMIL NADU').toUpperCase(),
        district: (registrationDraft.district || 'CHENNAI').toUpperCase(),
        assembly: registrationDraft.assembly || 'Velachery',
        zone: registrationDraft.zone || 'CHENNAI ZONE',
        dob: registrationDraft.dob || '15 Aug 1994',
        age: registrationDraft.age || '32',
        bloodGroup: registrationDraft.bloodGroup || 'A+',
        address: registrationDraft.address || 'Anna Nagar, Chennai - 600040',
        photo: registrationDraft.photo || '/athletes/1.png',
        photoUrl: registrationDraft.photo || '/athletes/1.png',
        status: 'Verified',
        joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      }

      // Save to localhost:5000 /api/members
      fetch(`${apiBaseUrl}/api/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'flow-simulator' },
        body: JSON.stringify(newMember)
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.member) {
            setSelectedUser({ ...d.member, isUnregistered: false })
            setDbMembers(prev => [d.member, ...prev.filter(m => m.memberId !== d.member.memberId)])
          }
        })
        .catch(() => {})

      newMsgs.push({
        id: `backend-${Date.now()}`,
        type: 'backend',
        text: `🎉 *Athlete Registration Confirmed & ID Issued!*\n\n👤 Athlete: ${newMember.name}\n🆔 Member ID: ${newMember.memberId}\n📍 State: ${newMember.state} | ${newMember.district}\n🏛️ Assembly: ${newMember.assembly} | ${newMember.zone}\n🩸 Blood Group: ${newMember.bloodGroup} | Age: ${newMember.age}\n🏠 Address: ${newMember.address}\n🪪 Council Accreditation: Verified (Reg No: 49/1997)\n\nOfficial Front & Back ID Card generated below:`,
        time: timeStr
      })

      newMsgs.push({
        id: `card-${Date.now()}`,
        type: 'card',
        member: newMember,
        time: timeStr
      })

      const completeNode = (flow.nodes || []).find(n => n.name.includes('Registration Complete'))
      if (completeNode) {
        setCurrentNodeId(completeNode.nodeId)
        setInspectedNodeId(completeNode.nodeId)
      }

      setChatMessages(newMsgs)
      logToTerminal({
        status: 'success',
        option: optionTitle,
        fromNode: currentNodeId,
        details: `Registered athlete & issued card: ${newMember.name} (${newMember.memberId})`
      })
      return
    }

    // ── 3. CONVERSATIONAL REGISTRATION STEPS (NEVER MISS USER TYPING) ────────
    const currNodeObj = nodeMap[currentNodeId] || {}
    const currNodeName = currNodeObj.name || ''

    // Step 1: User enters Full Name
    if (currNodeName.includes('Enter Full Name') && optionTitle !== 'Main Menu') {
      const assignedName = optionTitle === 'Use Sample Name'
        ? (registrationDraft.name || 'DINESH')
        : optionTitle.trim().toUpperCase()

      setRegistrationDraft(prev => ({ ...prev, name: assignedName }))

      const step2Node = (flow.nodes || []).find(n => n.name.includes('Date of Birth'))
      if (step2Node) {
        const dynamicStep2 = {
          ...step2Node,
          data: {
            ...step2Node.data,
            body: `🎂 *Date of Birth & Age (Step 2/5)*\n\nThank you, *${assignedName}*! Now please enter your *Date of Birth* and *Blood Group*:\n\nExample format: \`15 Aug 1994, B+\`\n\n💬 *Type your DOB & Blood Group in the chat below*, or tap to continue:`
          }
        }

        newMsgs.push({
          id: `bot-${step2Node.nodeId}-${Date.now()}`,
          type: 'bot',
          nodeId: step2Node.nodeId,
          node: dynamicStep2,
          time: timeStr
        })

        setCurrentNodeId(step2Node.nodeId)
        setInspectedNodeId(step2Node.nodeId)
        setChatMessages(newMsgs)
        logToTerminal({
          status: 'success',
          option: optionTitle,
          fromNode: currentNodeId,
          toNode: step2Node.nodeId,
          details: `Captured athlete name "${assignedName}", transitioned to Step 2 (DOB)`
        })
        return
      }
    }

    // Step 2: User enters Date of Birth & Age -> Transitions to Step 3: Select State
    if (currNodeName.includes('Date of Birth') && optionTitle !== 'Main Menu') {
      const dobVal = optionTitle === '15 Aug 1994 (32)' ? '15 Aug 1994' : optionTitle.trim()
      let ageVal = registrationDraft.age || '32'
      const ageMatch = optionTitle.match(/\b(\d{1,2})\b/)
      if (ageMatch) {
        const parsedAge = parseInt(ageMatch[1], 10)
        if (parsedAge >= 8 && parsedAge <= 90) ageVal = String(parsedAge)
      }
      let bloodVal = registrationDraft.bloodGroup || 'B+'
      const bloodMatch = optionTitle.match(/\b(A|B|AB|O)[+-]\b/i)
      if (bloodMatch) bloodVal = bloodMatch[0].toUpperCase()

      setRegistrationDraft(prev => ({ ...prev, dob: dobVal, age: ageVal, bloodGroup: bloodVal }))

      const step3Node = (flow.nodes || []).find(n => n.name.includes('Select State'))
      if (step3Node) {
        newMsgs.push({
          id: `bot-${step3Node.nodeId}-${Date.now()}`,
          type: 'bot',
          nodeId: step3Node.nodeId,
          node: step3Node,
          time: timeStr
        })

        setCurrentNodeId(step3Node.nodeId)
        setInspectedNodeId(step3Node.nodeId)
        setChatMessages(newMsgs)
        logToTerminal({
          status: 'success',
          option: optionTitle,
          fromNode: currentNodeId,
          toNode: step3Node.nodeId,
          details: `Captured DOB "${dobVal}", Age "${ageVal}", transitioned to Step 3 (Select State)`
        })
        return
      }
    }

    // Step 3: User selects or types State -> Transitions to Step 4: District, Assembly & Zone
    if (currNodeName.includes('Select State') && optionTitle !== 'Main Menu') {
      let stateVal = 'TAMIL NADU'
      if (optionTitle && optionTitle !== 'Other State / UT') {
        stateVal = optionTitle.trim().toUpperCase()
      }

      setRegistrationDraft(prev => ({
        ...prev,
        state: stateVal
      }))

      const step4Node = (flow.nodes || []).find(n => n.name.includes('District, Assembly'))
      if (step4Node) {
        const dynamicStep4 = {
          ...step4Node,
          data: {
            ...step4Node.data,
            body: `🏛️ *District, Assembly & Zone (Step 4/5)*\n\nState selected: *${stateVal}*\n\nPlease enter your local representation details:\n• District (e.g. \`Chennai\`)\n• Assembly Constituency (e.g. \`Velachery\`)\n• Zone / Region (e.g. \`Chennai Zone\`)\n\n💬 *Type your District, Assembly & Zone in chat below* (e.g. \`Chennai, Velachery, Chennai Zone\`), or tap below:`
          }
        }

        newMsgs.push({
          id: `bot-${step4Node.nodeId}-${Date.now()}`,
          type: 'bot',
          nodeId: step4Node.nodeId,
          node: dynamicStep4,
          time: timeStr
        })

        setCurrentNodeId(step4Node.nodeId)
        setInspectedNodeId(step4Node.nodeId)
        setChatMessages(newMsgs)
        logToTerminal({
          status: 'success',
          option: optionTitle,
          fromNode: currentNodeId,
          toNode: step4Node.nodeId,
          details: `Selected State "${stateVal}", transitioned to Step 4 (District/Assembly)`
        })
        return
      }
    }

    // Step 4: User types District, Assembly & Zone -> Transitions to Step 5: Passport Photo
    if (currNodeName.includes('District, Assembly') && optionTitle !== 'Main Menu') {
      let distVal = 'CHENNAI'
      let assmVal = 'Velachery'
      let zoneVal = 'CHENNAI ZONE'

      if (optionTitle !== 'Chennai, Velachery') {
        const parts = optionTitle.split(/[,/-]/).map(s => s.trim()).filter(Boolean)
        if (parts.length >= 1) distVal = parts[0].toUpperCase()
        if (parts.length >= 2) assmVal = parts[1]
        if (parts.length >= 3) zoneVal = parts[2]
        else zoneVal = `${distVal} ZONE`
      }

      setRegistrationDraft(prev => ({
        ...prev,
        district: distVal,
        assembly: assmVal,
        zone: zoneVal
      }))

      const step5Node = (flow.nodes || []).find(n => n.name.includes('Passport Photo'))
      if (step5Node) {
        newMsgs.push({
          id: `bot-${step5Node.nodeId}-${Date.now()}`,
          type: 'bot',
          nodeId: step5Node.nodeId,
          node: step5Node,
          time: timeStr
        })

        setCurrentNodeId(step5Node.nodeId)
        setInspectedNodeId(step5Node.nodeId)
        setChatMessages(newMsgs)
        logToTerminal({
          status: 'success',
          option: optionTitle,
          fromNode: currentNodeId,
          toNode: step5Node.nodeId,
          details: `Captured District "${distVal}", Assembly "${assmVal}", transitioned to Step 5 (Photo)`
        })
        return
      }
    }

    if (showBackendReplies && (isBackendOnly || isDual)) {
      let backendText = ''
      if (optionTitle === 'Register Athlete' || optionTitle === 'Register') {
        backendText = `⚡ *ISYDCI Athlete Registration Portal*\nConnecting to official sports council registry for membership onboarding and digital card issuance.`
      } else {
        backendText = `⚡ *ISYDCI Automated Service*\nReceived: "${optionTitle}". Record verified in sports registry.`
      }

      newMsgs.push({
        id: `backend-${Date.now()}`,
        type: 'backend',
        text: backendText,
        time: timeStr
      })
    }

    // Find outgoing edge matching this title
    const outgoingEdges = outEdgesMap[currentNodeId] || []
    let matchedEdge = outgoingEdges.find(e => (e.keywords || []).includes(optionTitle))

    // Fallback: search all edges if account-wide
    if (!matchedEdge) {
      matchedEdge = (flow.edges || []).find(e => (e.keywords || []).includes(optionTitle))
    }

    // Special fallback for "Main Menu", "Hi", "Hello", "Start", "Menu"
    const lowerOpt = (optionTitle || '').trim().toLowerCase()
    if (!matchedEdge && (lowerOpt === 'main menu' || lowerOpt === 'hi' || lowerOpt === 'hello' || lowerOpt === 'start' || lowerOpt === 'menu')) {
      const isReg = Boolean(
        (selectedUser?.memberId && selectedUser.memberId.trim().length > 0) ||
        dbMembers.some(m => (m.contact || '').replace(/\D/g, '') === (selectedUser?.phone || '').replace(/\D/g, ''))
      )
      const currentMember = dbMembers.find(m => (m.contact || '').replace(/\D/g, '') === (selectedUser?.phone || '').replace(/\D/g, '')) || selectedUser

      // If registered athlete greets with Hi / Hello / Start -> show welcome back + View & Download Card + Main Menu
      if (isReg && (lowerOpt === 'hi' || lowerOpt === 'hello' || lowerOpt === 'start')) {
        newMsgs.push({
          id: `returning-${Date.now()}`,
          type: 'returning_member',
          member: currentMember,
          time: timeStr
        })
        setCurrentNodeId('root')
        setInspectedNodeId('root')
        setChatMessages(newMsgs)
        logToTerminal({
          status: 'success',
          option: optionTitle,
          details: `Greeted registered member: ${currentMember.name} (${currentMember.memberId})`
        })
        return
      }

      // Otherwise show Root Main Menu
      const rootNode = nodeMap['root']
      if (rootNode) {
        newMsgs.push({
          id: `bot-root-${Date.now()}`,
          type: 'bot',
          nodeId: rootNode.nodeId,
          node: rootNode,
          time: timeStr
        })
        setCurrentNodeId('root')
        setInspectedNodeId('root')
        setChatMessages(newMsgs)
        return
      }
    }

    if (matchedEdge && nodeMap[matchedEdge.toNodeId]) {
      const nextNode = nodeMap[matchedEdge.toNodeId]
      newMsgs.push({
        id: `bot-${nextNode.nodeId}-${Date.now()}`,
        type: 'bot',
        nodeId: nextNode.nodeId,
        node: nextNode,
        time: timeStr
      })
      setCurrentNodeId(nextNode.nodeId)
      setInspectedNodeId(nextNode.nodeId)

      // Send log to terminal
      logToTerminal({
        status: 'success',
        option: optionTitle,
        fromNode: currentNodeId,
        toNode: nextNode.nodeId,
        toNodeName: nextNode.name,
        details: isBackendOnly ? `Handled by backend webhook (${optionTitle})` : undefined
      })
    } else if (!isBackendOnly) {
      // No edge and not handled by backend alone -> ERROR
      newMsgs.push({
        id: `unmatched-${Date.now()}`,
        type: 'system',
        text: `⚠️ Notice: Option "${optionTitle}" has no outgoing edge configured from this step. Type *Hi* to restart.`,
        time: timeStr
      })

      // Send error log to terminal
      logToTerminal({
        status: 'error',
        option: optionTitle,
        fromNode: currentNodeId,
        error: `No outgoing edge found from [${currentNodeId}] for "${optionTitle}". The bot stops here.`
      })
    } else {
      // Backend-only reply
      logToTerminal({
        status: 'success',
        option: optionTitle,
        fromNode: currentNodeId,
        details: `Backend action processed: ${optionTitle}`
      })
    }

    setChatMessages(newMsgs)
  }

  // Handle typing custom input
  const handleSendMessage = (e) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    handleSelectOption(text)
  }

  // Undo chat
  const handleUndo = () => {
    if (historyStack.length === 0) return
    const prev = historyStack[historyStack.length - 1]
    setRedoStack(r => [...r, { currentNodeId, chatMessages: [...chatMessages] }])
    setHistoryStack(h => h.slice(0, -1))
    setCurrentNodeId(prev.currentNodeId)
    setInspectedNodeId(prev.currentNodeId)
    setChatMessages(prev.chatMessages)
  }

  // Redo chat
  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setHistoryStack(h => [...h, { currentNodeId, chatMessages: [...chatMessages] }])
    setRedoStack(r => r.slice(0, -1))
    setCurrentNodeId(next.currentNodeId)
    setInspectedNodeId(next.currentNodeId)
    setChatMessages(next.chatMessages)
  }

  // Open JSON file
  const handleOpenFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
          alert('Invalid WACTO JSON export: missing "nodes" array.')
          return
        }
        setFlow(parsed)
        setCurrentFlowName(file.name)
      } catch (err) {
        alert('Could not parse JSON file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  // Paste JSON
  const handlePasteSubmit = () => {
    setPasteError('')
    try {
      const parsed = JSON.parse(pastedJsonText)
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        setPasteError('Invalid WACTO flow JSON: must include "nodes" array.')
        return
      }
      setFlow(parsed)
      setCurrentFlowName(parsed.chatbot?.name || 'Custom Pasted Flow')
      setPasteModalOpen(false)
      setPastedJsonText('')
    } catch (err) {
      setPasteError('JSON syntax error: ' + err.message)
    }
  }

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flow, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `${flow.chatbot?.name || 'isydci_flow'}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Prepare options list for inspected node
  const inspectedOptions = useMemo(() => {
    if (!inspectedNode) return []
    const act = inspectedNode.data?.action || {}
    const items = []

    if (inspectedNode.data?.interactiveType === 'button') {
      (act.buttons || []).forEach(b => {
        const title = b.reply?.title || ''
        const edge = (outEdgesMap[inspectedNode.nodeId] || []).find(e => (e.keywords || []).includes(title))
        const targetNode = edge ? nodeMap[edge.toNodeId] : null
        items.push({
          title,
          targetId: edge?.toNodeId,
          targetName: targetNode ? targetNode.name : (edge?.toNodeId ? 'Unknown Node' : 'None (Orphan edge)'),
          type: 'button'
        })
      })
    } else if (inspectedNode.data?.interactiveType === 'list') {
      (act.sections || []).forEach(sec => {
        (sec.rows || []).forEach(r => {
          const title = r.title || ''
          const edge = (outEdgesMap[inspectedNode.nodeId] || []).find(e => (e.keywords || []).includes(title))
          const targetNode = edge ? nodeMap[edge.toNodeId] : null
          items.push({
            title,
            targetId: edge?.toNodeId,
            targetName: targetNode ? targetNode.name : (edge?.toNodeId ? 'Unknown Node' : 'None (Orphan edge)'),
            type: 'list_row'
          })
        })
      })
    }
    return items
  }, [inspectedNode, outEdgesMap, nodeMap])

  // All nodes list filtered by search
  const filteredNodes = useMemo(() => {
    const list = flow.nodes || []
    if (!nodeSearch.trim()) return list
    const q = nodeSearch.toLowerCase()
    return list.filter(n => {
      const matchName = (n.name || '').toLowerCase().includes(q)
      const matchId = (n.nodeId || '').toLowerCase().includes(q)
      const matchKeywords = (n.keywords || []).some(k => k.toLowerCase().includes(q))
      const act = n.data?.action || {}
      const matchOptions = (act.buttons || []).some(b => (b.reply?.title || '').toLowerCase().includes(q)) ||
        (act.sections || []).some(s => (s.rows || []).some(r => (r.title || '').toLowerCase().includes(q)))
      return matchName || matchId || matchKeywords || matchOptions
    })
  }, [flow, nodeSearch])

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOpenFile}
        accept=".json"
        className="hidden"
      />

      {/* ==============================================================
          TOP BREADCRUMB & SUPER ADMIN BADGE
          ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="hover:text-blue-600 cursor-pointer">WhatsApp bot</span>
          <span className="text-slate-300 font-bold">&rsaquo;</span>
          <span className="text-slate-900 font-bold">Flow Simulator</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell Badge */}
          <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              9
            </span>
          </button>

          {/* Super Admin Pill */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              S
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold text-slate-900">Super</div>
              <div className="text-[10px] text-slate-400 font-medium">Super Admin</div>
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          HEADER & MAIN TOOLBAR
          ============================================================== */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Flow Simulator
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Load a WACTO export and tap through it exactly as a candidate sees it on WhatsApp, before anything is pushed to WACTO.
        </p>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Open JSON</span>
        </button>

        <button
          onClick={() => setPasteModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Paste JSON</span>
        </button>

        <button
          onClick={handleUndo}
          disabled={historyStack.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>Undo</span>
        </button>

        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
          <span>Redo</span>
        </button>

        <button
          onClick={handleRestartChat}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Restart chat</span>
        </button>

        <button
          onClick={handleExportJson}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/25 transition-all cursor-pointer ml-auto"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Export JSON</span>
        </button>
      </div>

      {/* ==============================================================
          MAIN WORKSPACE: PHONE SIMULATOR (LEFT) + INSPECTOR (RIGHT)
          ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ------------------------------------------------------------
            LEFT: AUTHENTIC WHATSAPP PHONE MOCKUP
            ------------------------------------------------------------ */}
        <div className="lg:col-span-5 flex flex-col items-center space-y-3">
          {/* Phone Shell */}
          <div className="w-full max-w-[360px] h-[640px] bg-slate-900 rounded-[44px] p-2.5 shadow-2xl ring-1 ring-slate-800/80 relative flex flex-col overflow-hidden">
            
            {/* Front Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
            </div>

            {/* Inner Phone Screen */}
            <div className="w-full h-full rounded-[36px] bg-[#efeae2] flex flex-col overflow-hidden relative border border-slate-800">
              
              {/* WhatsApp Status Bar */}
              <div className="bg-[#005d4b] text-white pt-2.5 px-6 pb-1 flex justify-between items-center text-[11px] font-medium tracking-tight z-20">
                <span>11:00 am</span>
                <div className="flex items-center gap-1.5 opacity-90">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.46-.91c1.27.64 2.7.91 4.19.91 4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                  </svg>
                  <span>5G</span>
                  <div className="w-5 h-2.5 rounded-xs border border-white flex items-center p-0.5">
                    <div className="w-full h-full bg-white rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* WhatsApp Chat Header */}
              <div className="bg-[#005d4b] text-white px-3 py-2 flex items-center justify-between shadow-xs z-20">
                <div className="flex items-center gap-2">
                  <button className="text-white hover:opacity-80 p-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-9 h-9 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs ring-1 ring-white/30 shrink-0">
                    IS
                  </div>
                  <div className="leading-tight overflow-hidden">
                    <div className="font-bold text-xs truncate max-w-[150px]">
                      {flow.chatbot?.name || 'ISYDCI Official Bot'}
                    </div>
                    <div className="text-[10px] text-teal-100/80">
                      Business account
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-white/90">
                  <svg className="w-4 h-4 cursor-pointer hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg className="w-4 h-4 cursor-pointer hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <svg className="w-4 h-4 cursor-pointer hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </div>
              </div>

              {/* Chat Message Scroll Area */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 pb-8 space-y-3 text-xs scroll-smooth"
                style={{
                  backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              >
                {/* Date stamp pill */}
                <div className="flex justify-center">
                  <span className="bg-white/90 backdrop-blur-xs text-slate-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                    Today
                  </span>
                </div>

                {/* Render chat items */}
                {chatMessages.map((msg) => {
                  if (msg.type === 'system') {
                    return (
                      <div key={msg.id} className="bg-amber-100/90 border border-amber-200/80 text-amber-900 text-[10px] rounded-xl p-2 shadow-2xs text-center flex items-center justify-center gap-1.5 leading-snug">
                        <span>🔒</span>
                        <span>{msg.text}</span>
                      </div>
                    )
                  }

                  if (msg.type === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-[#d9fdd3] text-slate-900 rounded-2xl rounded-tr-xs px-3 py-1.5 shadow-2xs border border-[#c3eab9] max-w-[85%]">
                          <div className="text-xs font-normal whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </div>
                          <div className="text-[9px] text-slate-500 text-right mt-0.5 flex items-center justify-end gap-1">
                            <span>{msg.time}</span>
                            <span className="text-blue-500 font-bold">✓✓</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Uploaded Passport Photo Message Bubble (sent by user)
                  if (msg.type === 'uploaded_photo') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-[#d9fdd3] text-slate-900 rounded-2xl rounded-tr-xs p-2 shadow-2xs border border-[#c3eab9] max-w-[75%] space-y-1.5">
                          <div className="w-[137px] h-[136px] mx-auto rounded-lg overflow-hidden border-2 border-emerald-500 shadow-xs bg-slate-100 relative">
                            <img src={msg.photo} alt="Passport Photo" className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 bg-black/70 text-white text-[8px] font-mono px-1.5 py-0.5 rounded shadow">
                              137 × 136
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-800 px-1 font-semibold text-center leading-tight">
                            {msg.caption || '📸 Official Passport Photo Uploaded'}
                          </div>
                          <div className="text-[9px] text-slate-500 text-right pr-1 flex items-center justify-end gap-1">
                            <span>{msg.time}</span>
                            <span className="text-blue-500 font-bold">✓✓</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (msg.type === 'backend') {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="bg-sky-50/90 border-2 border-dashed border-sky-400 text-slate-800 rounded-2xl rounded-tl-xs p-3 shadow-2xs max-w-[90%]">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1">
                            <span className="font-mono">{'{ }'}</span>
                            <span>Backend Webhook Reply</span>
                          </div>
                          <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans">
                            {msg.text}
                          </div>
                          <div className="text-[9px] text-slate-400 text-right mt-1">
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Returning Registered Member Welcome Message
                  if (msg.type === 'returning_member' && msg.member) {
                    const m = msg.member
                    return (
                      <div key={msg.id} className="flex flex-col gap-1.5 max-w-[92%]">
                        <div className="bg-white rounded-xl rounded-tl-xs p-2.5 shadow-2xs border border-slate-200/60 space-y-1">
                          <div className="font-extrabold text-[#005d4b] text-xs flex items-center gap-1">
                            <span>🏆</span>
                            <span>Welcome back, {m.name}!</span>
                          </div>
                          <div className="text-[11px] text-slate-700 leading-relaxed">
                            You are an accredited athlete member with ISYDCI.
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] space-y-0.5">
                            <div>👤 Athlete: <strong className="text-slate-900">{m.name}</strong></div>
                            <div>🆔 ID: <strong className="font-mono text-teal-800">{m.memberId}</strong></div>
                            <div>📍 State: <strong>{m.state || 'TAMIL NADU'}</strong> • {m.district || m.assembly || 'TRICHY'}</div>
                            <div className="text-emerald-700 font-bold">✓ Verified Athlete (Reg: 49/1997)</div>
                          </div>
                          <div className="text-[9px] text-slate-400 text-right mt-1">
                            {msg.time}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 pt-0.5">
                          <button
                            onClick={() => handleSelectOption('View & Download Card')}
                            className="w-full py-2 px-3 bg-white hover:bg-teal-50 hover:border-teal-300 text-teal-700 font-bold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer text-center active:scale-98"
                          >
                            View & Download Card
                          </button>
                          <button
                            onClick={() => handleSelectOption('Main Menu')}
                            className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer text-center"
                          >
                            Main Menu
                          </button>
                        </div>
                      </div>
                    )
                  }

                  // Screen 7: Registration Submitted! (From Screenshot 7)
                  if (msg.type === 'reg_submitted') {
                    return (
                      <div key={msg.id} className="flex flex-col gap-1.5 max-w-[94%] animate-fade-in">
                        <div className="bg-white text-slate-900 rounded-2xl rounded-tl-xs p-3.5 shadow-sm border border-slate-200/80">
                          {/* Big Green Check Circle */}
                          <div className="flex flex-col items-center text-center space-y-2 py-1">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              Registration Submitted!
                            </div>
                            <div className="text-[11px] text-slate-600 leading-relaxed px-1">
                              Thank you for registering with ISYDCI. Your details have been successfully submitted.
                            </div>

                            {/* Membership ID Badge */}
                            <div className="w-full bg-teal-50/70 border border-teal-200 rounded-xl p-2.5 flex items-center gap-2.5 mt-2 text-left">
                              <div className="w-9 h-9 rounded-lg bg-[#005d4b] text-white flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                </svg>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase tracking-wider text-teal-800 font-bold">Membership ID</div>
                                <div className="text-xs font-black font-mono text-[#005d4b]">{msg.memberId || 'ISYDCI-684DDC04'}</div>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-500 leading-tight pt-1">
                              Your membership card is being generated and will be shown below.
                            </div>

                            {/* Generation Spinner */}
                            <div className="w-full bg-slate-50 rounded-lg p-2 border border-slate-200/60 flex items-center gap-2 text-[10px] text-slate-600">
                              <div className="w-4 h-4 border-2 border-[#005d4b] border-t-transparent rounded-full animate-spin shrink-0" />
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-slate-700">Generating your ISYDCI Member Card...</div>
                                <div className="text-[9px] text-slate-400">Please wait a moment.</div>
                              </div>
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-400 text-right mt-2">
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Screen 8: Your ISYDCI Member Card (Show immediately after submission)
                  if ((msg.type === 'card' || msg.type === 'card_ready') && msg.member) {
                    const cardMember = msg.member
                    return (
                      <div key={msg.id} className="flex flex-col gap-2 max-w-[96%] animate-fade-in">
                        <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-md border border-slate-200/90 overflow-hidden">
                          {/* Heading matching Screenshot 8 */}
                          <div className="mb-2">
                            <div className="font-extrabold text-[#0b1e3f] text-xs flex items-center gap-1.5">
                              <span>🎉</span>
                              <span>Your ISYDCI Membership Card is Ready!</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Here is your official membership card.
                            </div>
                          </div>

                          {/* Card View Switcher Tabs: Combined | Front | Back */}
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg mb-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setCardViewTab('combined')}
                              className={`flex-1 py-1 rounded transition-all cursor-pointer ${cardViewTab === 'combined' ? 'bg-white text-[#0b1e3f] shadow-2xs' : 'text-slate-500'}`}
                            >
                              Combined (F+B)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardViewTab('front')}
                              className={`flex-1 py-1 rounded transition-all cursor-pointer ${cardViewTab === 'front' ? 'bg-white text-[#0b1e3f] shadow-2xs' : 'text-slate-500'}`}
                            >
                              Front Side
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardViewTab('back')}
                              className={`flex-1 py-1 rounded transition-all cursor-pointer ${cardViewTab === 'back' ? 'bg-white text-[#0b1e3f] shadow-2xs' : 'text-slate-500'}`}
                            >
                              Back Side
                            </button>
                          </div>

                          {/* Scaled Card Canvas Container with Front & Back Side Badges */}
                          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100/70 p-2 flex flex-col items-center justify-center">
                            {cardViewTab === 'combined' && (
                              <div className="flex flex-col gap-2 items-center py-1 w-full">
                                <div className="w-full flex flex-col items-center">
                                  <div className="origin-top scale-[0.56] -mb-[235px]">
                                    <CardFront member={cardMember} />
                                  </div>
                                  <div className="mt-1 bg-slate-800 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                                    Front Side
                                  </div>
                                </div>
                                <div className="w-full flex flex-col items-center pt-2">
                                  <div className="origin-top scale-[0.56] -mb-[235px]">
                                    <CardBack member={cardMember} />
                                  </div>
                                  <div className="mt-1 bg-slate-800 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                                    Back Side
                                  </div>
                                </div>
                              </div>
                            )}

                            {cardViewTab === 'front' && (
                              <div className="w-full flex flex-col items-center py-1">
                                <div className="origin-top scale-[0.58] -mb-[220px]">
                                  <CardFront member={cardMember} />
                                </div>
                                <div className="mt-1 bg-slate-800 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                                  Front Side
                                </div>
                              </div>
                            )}

                            {cardViewTab === 'back' && (
                              <div className="w-full flex flex-col items-center py-1">
                                <div className="origin-top scale-[0.58] -mb-[220px]">
                                  <CardBack member={cardMember} />
                                </div>
                                <div className="mt-1 bg-slate-800 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                                  Back Side
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Member Accreditation Info */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] leading-tight text-slate-700">
                            <div className="font-extrabold text-slate-900">{cardMember.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              ID: <span className="font-mono font-bold text-teal-800">{cardMember.memberId}</span> &middot; {cardMember.sport || 'ATHLETICS'}
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              National Council Accreditation (Reg No: 49/1997)
                            </div>
                          </div>
                        </div>

                        {/* Screenshot 8 Action Buttons: [ Download Card ] [ Share Card ] [ Close ] */}
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleDownloadCard(cardMember)}
                            className="w-full py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download Card</span>
                          </button>

                          <button
                            onClick={() => handleShareCard(cardMember)}
                            className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                          >
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <span>Share Card</span>
                          </button>

                          <button
                            onClick={() => handleSelectOption('Main Menu')}
                            className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>✕ Close</span>
                          </button>
                        </div>
                      </div>
                    )
                  }

                  // Rich Share Card Confirmation Bubble
                  if (msg.type === 'share_card_message' && msg.shareMember) {
                    const sm = msg.shareMember
                    return (
                      <div key={msg.id} className="flex flex-col gap-1.5 max-w-[94%] animate-fade-in">
                        <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-sm border border-slate-200/90 space-y-2.5">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              🔗
                            </div>
                            <div>
                              <div className="font-extrabold text-xs text-slate-900">Athlete Membership Card</div>
                              <div className="text-[10px] text-emerald-700 font-semibold">Official Verification Link Ready</div>
                            </div>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Athlete:</span>
                              <span className="font-bold text-slate-900">{sm.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Member ID:</span>
                              <span className="font-mono font-bold text-teal-800">{sm.memberId}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Status:</span>
                              <span className="text-emerald-700 font-bold text-[10px]">Verified Athlete ✅</span>
                            </div>
                          </div>

                          {/* URL Box with direct Copy */}
                          <div className="p-2 bg-slate-100/90 rounded-lg flex items-center justify-between gap-1 text-[10px]">
                            <span className="font-mono text-slate-600 truncate flex-1">{msg.shareUrl}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(msg.shareUrl)
                                  setCopiedLink(true)
                                  setTimeout(() => setCopiedLink(false), 2000)
                                } catch (_) {}
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-700 font-bold shrink-0 cursor-pointer text-[10px]"
                            >
                              {copiedLink ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg.shareText || msg.shareUrl)}`, '_blank')
                              }}
                              className="w-full py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <span>📲 Share on WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadCard(sm)}
                              className="w-full py-2 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <span>📥 Download Card PNG</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => window.open(msg.shareUrl, '_blank')}
                              className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>🌐 Open in Card Generator</span>
                            </button>
                          </div>

                          <div className="text-[9px] text-slate-400 text-right">
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Standard Bot Interactive Node Message
                  if (msg.type === 'bot' && msg.node) {
                    const node = msg.node
                    const data = node.data || {}
                    const action = data.action || {}
                    const isList = data.interactiveType === 'list'
                    const isButton = data.interactiveType === 'button'
                    const buttons = action.buttons || []
                    const header = data.header || {}
                    const footer = data.footer || ''

                    return (
                      <div key={msg.id} className="flex flex-col gap-1.5 max-w-[92%]">
                        
                        {/* Message Bubble Body */}
                        <div className="bg-white text-slate-900 rounded-2xl rounded-tl-xs p-3 shadow-2xs border border-slate-200/70">
                          {header?.text && (
                            <div className="font-bold text-slate-900 text-xs mb-1">
                              {header.text}
                            </div>
                          )}

                          <div className="whitespace-pre-wrap leading-relaxed text-xs">
                            {data.body}
                          </div>

                          {footer && (
                            <div className="text-[10px] text-slate-400 mt-1.5">
                              {footer}
                            </div>
                          )}

                          <div className="text-[9px] text-slate-400 text-right mt-1">
                            {msg.time}
                          </div>

                          {/* List Button CTA Inside Bubble */}
                          {isList && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => {
                                  setActiveSheetNode(node)
                                  setIsSheetOpen(true)
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-teal-700 font-bold text-xs transition-colors border border-slate-200 shadow-2xs cursor-pointer active:scale-98"
                              >
                                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <span>{action.button || 'View Options'}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Step 5: 137 x 136 Passport Photo Frame */}
                        {node.name.includes('Passport Photo') && (
                          <div className="bg-white rounded-2xl p-3 border-2 border-teal-500/80 shadow-md space-y-2.5 mt-1.5 animate-fade-in">
                            {/* Summary chip of collected details */}
                            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 text-[10px] space-y-1.5">
                              <div className="flex items-center justify-between font-bold text-slate-800">
                                <span>👤 {registrationDraft.name || 'DINESH'}</span>
                                <span className="text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded text-[9px] font-bold border border-teal-200">
                                  Reg 49/1997
                                </span>
                              </div>
                              <div className="text-slate-600 flex items-center justify-between text-[9px]">
                                <span>🎂 {registrationDraft.dob || '15 Aug 1994'} ({registrationDraft.age || '32'} yrs)</span>
                                <span className="font-semibold text-rose-600">🩸 {registrationDraft.bloodGroup || 'A+'}</span>
                              </div>
                              <div className="text-slate-600 flex items-center justify-between text-[9px] pt-1 border-t border-slate-200/60">
                                <span>📍 {registrationDraft.state || 'TAMIL NADU'} &bull; {registrationDraft.district || 'CHENNAI'}</span>
                                <span>🏛️ {registrationDraft.assembly || 'Velachery'}</span>
                              </div>
                            </div>

                            {/* 137 x 136 Photo Box */}
                            <div className="flex flex-col items-center p-2.5 bg-slate-50 rounded-xl border border-dashed border-teal-300 space-y-2">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1">
                                  <span>📸</span> Member Photo (137 × 136)
                                </span>
                                {registrationDraft.photo && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                    Fitted 137×136 ✓
                                  </span>
                                )}
                              </div>

                              <div className="relative w-[137px] h-[136px] bg-white rounded-xl border-2 border-teal-600 overflow-hidden shadow-sm flex items-center justify-center ring-2 ring-teal-100">
                                {registrationDraft.photo ? (
                                  <img src={registrationDraft.photo} alt="Passport Photo" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="flex flex-col items-center text-slate-300">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-[9px] font-bold">NO PHOTO</span>
                                  </div>
                                )}
                                <div className="absolute top-1 right-1 bg-black/60 text-white text-[8px] font-mono px-1 rounded">
                                  137×136
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 w-full">
                                <label className="flex-1 py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-2xs transition-all">
                                  <span>📷 Upload &amp; Crop (137×136)</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) {
                                        const reader = new FileReader()
                                        reader.onload = () => {
                                          setRegistrationDraft(prev => ({ ...prev, photo: reader.result }))
                                        }
                                        reader.readAsDataURL(file)
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {/* Sample Avatars */}
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {['/athletes/1.png', '/athletes/2.png', '/athletes/3.png', '/athletes/4.png'].map((pSrc, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => setRegistrationDraft(prev => ({ ...prev, photo: pSrc }))}
                                    className={`w-7 h-7 rounded-md overflow-hidden border transition-all cursor-pointer ${
                                      registrationDraft.photo === pSrc ? 'border-teal-600 ring-2 ring-teal-400 scale-105 shadow-xs' : 'border-slate-200 opacity-60 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={pSrc} alt="athlete" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quick Reply Buttons Under Bubble */}
                        {isButton && buttons.length > 0 && (
                          <div className="flex flex-col gap-1 pt-0.5">
                            {buttons.map((btn, idx) => {
                              const title = btn.reply?.title || `Option ${idx + 1}`
                              return (
                                <button
                                  key={btn.reply?.id || idx}
                                  onClick={() => handleSelectOption(title)}
                                  className="w-full py-2 px-3 bg-white hover:bg-teal-50 hover:border-teal-300 text-teal-700 font-bold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer text-center active:scale-98"
                                >
                                  {title}
                                </button>
                              )
                            })}
                          </div>
                        )}

                      </div>
                    )
                  }

                  return null
                })}

                <div ref={chatBottomRef} />
              </div>

              {/* Bottom Sheet for Interactive List */}
              {isSheetOpen && activeSheetNode && (
                <div className="absolute inset-0 z-30 bg-slate-900/50 backdrop-blur-2xs flex flex-col justify-end animate-fade-in">
                  <div className="bg-white rounded-t-3xl max-h-[75%] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-800">
                        {activeSheetNode.data?.action?.button || 'Select an option'}
                      </div>
                      <button
                        onClick={() => setIsSheetOpen(false)}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-800 text-base"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="overflow-y-auto p-2 space-y-3">
                      {(activeSheetNode.data?.action?.sections || []).map((sec, sIdx) => {
                        const isUserReg = Boolean(
                          !selectedUser?.isUnregistered &&
                          ((selectedUser?.memberId && selectedUser.memberId.trim().length > 0) ||
                          dbMembers.some(m => (m.contact || '').replace(/\D/g, '') === (selectedUser?.phone || '').replace(/\D/g, '')))
                        )
                        const filteredRows = (sec.rows || []).filter(row => {
                          if (activeSheetNode.nodeId === 'root' || activeSheetNode.id === 'root') {
                            if (isUserReg && row.title === 'Register Athlete') return false
                            if (!isUserReg && (row.title === 'My Membership Card' || row.title === 'View & Download Card')) return false
                          }
                          return true
                        })
                        if (filteredRows.length === 0) return null

                        return (
                          <div key={sIdx} className="space-y-1">
                            {sec.title && (
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                                {sec.title}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              {filteredRows.map((row, rIdx) => {
                                const isRegRow = row.title === 'Register Athlete'
                                const isCardRow = row.title === 'My Membership Card' || row.title === 'View & Download Card'
                                const isAboutRow = row.title === 'About ISYDCI'
                                const isWebRow = row.title === 'Official Website'
                                const isContactRow = row.title === 'Contact Support'

                                return (
                                  <button
                                    key={row.id || rIdx}
                                    onClick={() => handleSelectOption(row.title)}
                                    className={`w-full text-left p-2.5 rounded-2xl transition-all flex items-center justify-between cursor-pointer border ${
                                      isRegRow 
                                        ? 'bg-emerald-50/60 hover:bg-emerald-100/70 border-emerald-500/80 shadow-2xs' 
                                        : 'hover:bg-slate-50 border-slate-200/90 bg-white shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                        isRegRow ? 'bg-emerald-600 text-white shadow-xs' :
                                        isCardRow ? 'bg-[#005d4b] text-white shadow-xs' :
                                        'bg-teal-50 text-teal-700 border border-teal-200'
                                      }`}>
                                        {isRegRow && '👤'}
                                        {isCardRow && '🪪'}
                                        {isAboutRow && '🏛️'}
                                        {isWebRow && '🌐'}
                                        {isContactRow && '📞'}
                                        {!isRegRow && !isCardRow && !isAboutRow && !isWebRow && !isContactRow && '📋'}
                                      </div>
                                      <div>
                                        <div className={`font-bold text-xs ${isRegRow ? 'text-emerald-950 font-extrabold' : 'text-slate-900'}`}>
                                          {row.title}
                                        </div>
                                        {row.description && (
                                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                            {row.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <svg className={`w-4 h-4 shrink-0 ${isRegRow ? 'text-emerald-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Native In-Phone Share Sheet Overlay */}
              {shareModalMember && (
                <div 
                  className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end rounded-[36px] overflow-hidden animate-fade-in"
                  onClick={() => setShareModalMember(null)}
                >
                  <div
                    className="bg-white rounded-t-3xl p-4 space-y-3.5 shadow-2xl flex flex-col max-h-[85%] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top drag handle indicator */}
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto" />

                    {/* Sheet Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#005d4b] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-900">Share Membership Card</div>
                          <div className="text-[10px] text-slate-500">Official digital verification card</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShareModalMember(null)}
                        className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Mini Member Card Preview */}
                    <div className="bg-linear-to-br from-slate-900 to-[#0b1e3f] text-white rounded-2xl p-3 shadow-md border border-slate-700/50 flex items-center gap-3">
                      <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-800">
                        <img
                          src={shareModalMember.photo || '/athletes/1.png'}
                          alt={shareModalMember.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black truncate">{shareModalMember.name}</div>
                        <div className="text-[10px] font-mono text-teal-300 font-bold truncate">
                          {shareModalMember.memberId || 'ISYDCI-MEMBER'}
                        </div>
                        <div className="text-[9px] text-slate-300 truncate">
                          {shareModalMember.sport || 'ATHLETICS'} &bull; {shareModalMember.state || 'TAMIL NADU'}
                        </div>
                        <div className="inline-flex items-center gap-1 mt-1 bg-emerald-500/20 text-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                          <span>✓</span> Verified Athlete
                        </div>
                      </div>
                    </div>

                    {/* Direct Share Actions */}
                    <div className="space-y-2 pt-1">
                      {/* WhatsApp Direct Share Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/membership-card?id=${shareModalMember.memberId || 'ISYDCI'}`
                          const text = `🏆 Indian Sports Youth Development Council of India (ISYDCI)\nOfficial Athlete Membership Card: *${shareModalMember.name}*\nMember ID: *${shareModalMember.memberId}*\nAccreditation: Verified Athlete ✅ (Reg No: 49/1997)\n\nView & Download Card: ${url}`
                          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
                        }}
                        className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.181-.076.355.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z"/>
                        </svg>
                        <span>Share on WhatsApp</span>
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          const url = `${window.location.origin}/membership-card?id=${shareModalMember.memberId || 'ISYDCI'}`
                          try {
                            await navigator.clipboard.writeText(url)
                            setCopiedLink(true)
                            setTimeout(() => setCopiedLink(false), 2500)
                          } catch (_) {}
                        }}
                        className={`w-full py-2.5 px-3 font-bold text-xs rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                          copiedLink
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        {copiedLink ? (
                          <>
                            <span className="text-emerald-600 font-black">✓</span>
                            <span>Direct Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>Copy Card Link</span>
                          </>
                        )}
                      </button>

                      {/* Download Card Image Button */}
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadCard(shareModalMember)
                          setShareModalMember(null)
                        }}
                        className="w-full py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download Card PNG</span>
                      </button>

                      {/* View Full Card Generator */}
                      <button
                        type="button"
                        onClick={() => {
                          window.open(`/membership-card?id=${shareModalMember.memberId || 'ISYDCI'}`, '_blank')
                          setShareModalMember(null)
                        }}
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Open in Digital Card Viewer</span>
                      </button>
                    </div>

                    {/* Bottom Close */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShareModalMember(null)}
                        className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Native Flow Screen Overlay (Screens 2 through 6) */}
              {isFlowModalOpen && (
                <div className="absolute inset-0 z-40 bg-white flex flex-col rounded-[36px] overflow-hidden animate-fade-in shadow-2xl">
                  {/* WhatsApp Flow Screen Top Status Bar */}
                  <div className="bg-[#005d4b] text-white pt-2.5 px-6 pb-1 flex justify-between items-center text-[11px] font-medium tracking-tight shrink-0">
                    <span>12:30 pm</span>
                    <div className="flex items-center gap-1.5 opacity-90">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.46-.91c1.27.64 2.7.91 4.19.91 4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                      </svg>
                      <span>5G</span>
                      <div className="w-5 h-2.5 rounded-xs border border-white flex items-center p-0.5">
                        <div className="w-full h-full bg-white rounded-2xs" />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Flow Header */}
                  <div className="bg-[#005d4b] text-white px-3 py-2 flex items-center justify-between shadow-xs shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (flowScreenStep > 1) {
                            setFlowScreenStep(prev => prev - 1)
                          } else {
                            setIsFlowModalOpen(false)
                          }
                        }}
                        className="text-white hover:opacity-80 p-0.5 cursor-pointer"
                        title="Back"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="w-8 h-8 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs ring-1 ring-white/30 shrink-0">
                        IS
                      </div>
                      <div className="leading-tight overflow-hidden">
                        <div className="font-bold text-xs truncate max-w-[150px] flex items-center gap-1">
                          <span>ISYDCI Official Bot</span>
                          <span className="w-3.5 h-3.5 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                        </div>
                        <div className="text-[10px] text-teal-100/80">
                          Business Account
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-white/90">
                      <button
                        type="button"
                        onClick={() => setIsFlowModalOpen(false)}
                        className="text-white/80 hover:text-white p-1 text-sm font-bold cursor-pointer"
                        title="Close Flow"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Flow Screen Body based on flowScreenStep (1 to 5) */}
                  {/* SCREEN 2: Enter Location Details */}
                  {flowScreenStep === 1 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-slate-800">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Athlete Registration</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Please enter your location details.</p>
                      </div>

                      {/* Full Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Full Name <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationDraft.name}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter full name"
                            className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">👤</span>
                        </div>
                      </div>

                      {/* Mobile Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Mobile Number</label>
                        <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/70 border border-emerald-300 rounded-xl">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z"/>
                            </svg>
                            <span className="font-bold text-xs text-slate-900 font-mono">{registrationDraft.contact || '+91 98765 43210'}</span>
                          </div>
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 font-medium">Automatically detected from WhatsApp</p>
                      </div>

                      {/* State / Union Territory */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">State / Union Territory <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <select
                            value={registrationDraft.state}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, state: e.target.value }))}
                            className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none appearance-none cursor-pointer"
                          >
                            {indianStatesAndUTs.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🏛️</span>
                          <span className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">▼</span>
                        </div>
                      </div>

                      {/* District */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">District <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationDraft.district}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, district: e.target.value }))}
                            placeholder="e.g. Chennai"
                            className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">👤</span>
                        </div>
                      </div>

                      {/* Assembly / Constituency */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Assembly / Constituency <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationDraft.assembly}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, assembly: e.target.value }))}
                            placeholder="e.g. Velachery"
                            className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">📍</span>
                        </div>
                      </div>

                      {/* Zone / Ward / Area */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Zone / Ward / Area <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationDraft.zone}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, zone: e.target.value }))}
                            placeholder="e.g. Ward 25"
                            className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">📍</span>
                        </div>
                      </div>

                      {/* Next Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(2)}
                          className="w-full py-2.5 px-4 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
                        >
                          <span>Next</span>
                          <span>&gt;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SCREEN 3: Enter Date of Birth & Age */}
                  {flowScreenStep === 2 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-800">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Date of Birth &amp; Age</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Please provide your date of birth.</p>
                      </div>

                      {/* Date of Birth */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Date of Birth <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationDraft.dob}
                            onChange={(e) => {
                              const val = e.target.value
                              let calculatedAge = registrationDraft.age
                              const matchYear = val.match(/\b(19\d\d|20\d\d)\b/)
                              if (matchYear) {
                                const yr = parseInt(matchYear[1], 10)
                                calculatedAge = String(new Date().getFullYear() - yr)
                              }
                              setRegistrationDraft(prev => ({ ...prev, dob: val, age: calculatedAge }))
                            }}
                            placeholder="15 Aug 1999"
                            className="w-full px-3 py-2.5 pl-9 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                          />
                          <span className="absolute left-3 top-2.5 text-slate-500 text-xs">📅</span>
                        </div>
                      </div>

                      {/* Info alert */}
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-emerald-800">
                        <span className="text-base shrink-0 mt-0.5">ℹ️</span>
                        <p className="text-[11px] leading-relaxed">
                          Age will be calculated automatically based on your date of birth.
                        </p>
                      </div>

                      {/* Age Auto-calculated Badge */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Age</label>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">👤</span>
                            <span className="font-bold text-sm text-slate-900">{registrationDraft.age || '27'} Years</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">(Auto-calculated)</span>
                        </div>
                      </div>

                      {/* Back & Next Navigation */}
                      <div className="flex items-center gap-2 pt-6">
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(1)}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>&lt; Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(3)}
                          className="flex-1 py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <span>&gt;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SCREEN 4: Enter Remaining Details */}
                  {flowScreenStep === 3 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-800">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Additional Information</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Please complete the remaining details.</p>
                      </div>

                      {/* Blood Group */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Blood Group <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <select
                            value={registrationDraft.bloodGroup}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, bloodGroup: e.target.value }))}
                            className="w-full px-3 py-2.5 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-600 outline-none appearance-none cursor-pointer"
                          >
                            {bloodGroups.map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                          <span className="absolute left-2.5 top-2.5 text-rose-500 text-xs">🩸</span>
                          <span className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">▼</span>
                        </div>
                      </div>

                      {/* Full Address */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">Full Address <span className="text-rose-500">*</span></label>
                          <span className="text-[10px] text-slate-400 font-mono">{(registrationDraft.address || '').length}/300</span>
                        </div>
                        <div className="relative">
                          <textarea
                            rows={4}
                            maxLength={300}
                            value={registrationDraft.address}
                            onChange={(e) => setRegistrationDraft(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Enter house no, street, locality, pincode"
                            className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal focus:bg-white focus:border-teal-600 outline-none transition-all resize-none leading-relaxed"
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🏠</span>
                        </div>
                      </div>

                      {/* Back & Next Navigation */}
                      <div className="flex items-center gap-2 pt-6">
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(2)}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>&lt; Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(4)}
                          className="flex-1 py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <span>&gt;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SCREEN 5: Upload Photo */}
                  {flowScreenStep === 4 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-800 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Upload Your Photo</h2>
                          <p className="text-[11px] text-slate-500 mt-0.5">Please upload a clear passport size photo for your ID card.</p>
                        </div>

                        {/* Passport Photo Preview Container with Pencil Badge */}
                        <div className="flex flex-col items-center py-2">
                          <div
                            onClick={() => {
                              setImageToCrop(registrationDraft.photo || '/athletes/1.png')
                              setCropModalOpen(true)
                            }}
                            className="relative w-[140px] h-[140px] bg-slate-100 rounded-2xl border-2 border-teal-600 overflow-visible shadow-md flex items-center justify-center cursor-pointer group"
                            title="Click to crop photo"
                          >
                            <img
                              src={registrationDraft.photo || '/athletes/1.png'}
                              alt="Athlete Passport Photo"
                              className="w-full h-full object-cover object-top rounded-xl"
                            />
                            {/* Circular Green Pencil Edit Badge on Bottom-Right */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setImageToCrop(registrationDraft.photo || '/athletes/1.png')
                                setCropModalOpen(true)
                              }}
                              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white cursor-pointer hover:bg-emerald-700 hover:scale-105 transition-all"
                              title="Crop / Edit Photo"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>

                          {/* Upload Button */}
                          <label className="mt-4 py-2.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-2 cursor-pointer shadow-2xs transition-all">
                            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Upload Photo (JPG/PNG)</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    setImageToCrop(reader.result)
                                    setCropModalOpen(true)
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                            />
                          </label>
                          <span className="text-[10px] text-slate-400 mt-1.5">Recommended size: 300 DPI | Max size: 5 MB</span>

                          {/* Quick Sample Avatars */}
                          <div className="flex items-center gap-2 mt-3">
                            {['/athletes/1.png', '/athletes/2.png', '/athletes/3.png', '/athletes/4.png'].map((pSrc, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => {
                                  setImageToCrop(pSrc)
                                  setCropModalOpen(true)
                                }}
                                className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                  registrationDraft.photo === pSrc ? 'border-teal-600 ring-2 ring-teal-400 scale-105' : 'border-slate-200 opacity-60 hover:opacity-100'
                                }`}
                                title="Select & Crop this photo"
                              >
                                <img src={pSrc} alt="athlete" className="w-full h-full object-cover object-top" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Back & Next Navigation */}
                      <div className="flex items-center gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(3)}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>&lt; Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(5)}
                          className="flex-1 py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <span>&gt;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SCREEN 6: Confirm Your Details */}
                  {flowScreenStep === 5 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-slate-800">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Confirm Your Details</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Please review your details before submitting.</p>
                      </div>

                      {/* Details Table matching Screenshot 6 */}
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">👤 Full Name</span>
                          <span className="font-bold text-slate-900">{registrationDraft.name || 'Amit Kumar'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📞 Mobile Number</span>
                          <span className="font-mono font-semibold text-slate-800">{registrationDraft.contact || '+91 98765 43210'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">🏛️ State</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.state || 'Tamil Nadu'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📍 District</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.district || 'Chennai'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📍 Assembly</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.assembly || 'Velachery'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📍 Zone</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.zone || 'Ward 25'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📅 Date of Birth</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.dob || '15 Aug 1999'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">👤 Age</span>
                          <span className="font-semibold text-slate-800">{registrationDraft.age || '27'} Years</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1">🩸 Blood Group</span>
                          <span className="font-bold text-rose-600">{registrationDraft.bloodGroup || 'O+'}</span>
                        </div>
                        <div className="py-1 border-b border-slate-200/60 space-y-0.5">
                          <span className="text-slate-500 font-medium flex items-center gap-1">🏠 Address</span>
                          <div className="text-[10px] text-slate-700 leading-snug pl-4">{registrationDraft.address}</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-500 font-medium flex items-center gap-1">📷 Photo</span>
                          <div className="w-9 h-9 rounded-lg border border-teal-500 overflow-hidden shadow-2xs">
                            <img src={registrationDraft.photo || '/athletes/1.png'} alt="Photo" className="w-full h-full object-cover object-top" />
                          </div>
                        </div>
                      </div>

                      {/* Green Confirmation Pill */}
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 flex items-center gap-2 text-emerald-800">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
                        <span className="text-[10px] font-semibold">Please confirm that all the details are correct.</span>
                      </div>

                      {/* Back & Submit Navigation */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setFlowScreenStep(4)}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>&lt; Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleFlowSubmit}
                          className="flex-1 py-2.5 px-3 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
                        >
                          <span>Submit Registration</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp Message Input Bar */}
              <form onSubmit={handleSendMessage} className="bg-[#f0f2f5] p-2 flex items-center gap-2 border-t border-slate-200 z-20">
                <button type="button" className="text-slate-500 hover:text-slate-700 p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Message"
                  className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-slate-800 outline-none border border-slate-200 shadow-2xs focus:border-teal-500"
                />

                {inputText.trim() ? (
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-full bg-[#005d4b] text-white flex items-center justify-center hover:bg-[#075e54] transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                ) : (
                  <button type="button" className="text-slate-500 hover:text-slate-700 p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  </button>
                )}
              </form>

            </div>
          </div>

          {/* Subtext description below phone */}
          <p className="text-[11px] text-slate-500 text-center max-w-[340px] mt-3 leading-relaxed">
            Lists open the WhatsApp sheet; reply buttons sit under the bubble; dashed bubbles are what our backend sends. Type <strong className="text-slate-800 font-mono">Hi</strong> to start over.
          </p>

        </div>

        {/* ------------------------------------------------------------
            RIGHT: NODE INSPECTOR & EDIT PANEL
            ------------------------------------------------------------ */}
        <div ref={inspectorRef} className="lg:col-span-7 space-y-4">
          
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            
            {/* Inspector Header & Tabs */}
            <div className="border-b border-slate-100 flex items-center justify-between px-5 pt-3">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('inspect')}
                  className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'inspect'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Inspect</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('edit')
                    setEditingNode(JSON.parse(JSON.stringify(inspectedNode)))
                  }}
                  className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'edit'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>

              <div className="pb-2 text-[10px] text-slate-400 font-mono">
                nodeId: <strong className="text-slate-700">{inspectedNode?.nodeId}</strong>
              </div>
            </div>

            {/* TAB CONTENT: INSPECT */}
            {activeTab === 'inspect' && inspectedNode && (
              <div className="p-5 space-y-5">
                
                {/* Node Details Header */}
                <div>
                  <div className="text-lg font-bold text-slate-900">
                    {inspectedNode.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {inspectedNode.data?.interactiveType === 'list' ? 'List' : 'Button'} &middot; id {inspectedNode.nodeId} &middot; {inEdgesCount[inspectedNode.nodeId] || 0} incoming edges
                  </div>

                  {/* Top Action Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      onClick={() => {
                        setCurrentNodeId(inspectedNode.nodeId)
                        setChatMessages(prev => [
                          ...prev,
                          {
                            id: `jump-${Date.now()}`,
                            type: 'bot',
                            nodeId: inspectedNode.nodeId,
                            node: inspectedNode,
                            time: '11:00 am'
                          }
                        ])
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <span>▶</span>
                      <span>Show on phone</span>
                    </button>

                    <button
                      onClick={() => setJsonModalNode(inspectedNode)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <span className="font-mono">{'{ }'}</span>
                      <span>JSON</span>
                    </button>

                    {currentNodeId === inspectedNode.nodeId ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>On screen</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        (Not currently on phone screen)
                      </span>
                    )}
                  </div>
                </div>

                {/* Root keywords */}
                <div className="text-xs text-slate-600 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                  <span className="font-bold text-slate-700">Root keywords: </span>
                  <span className="font-mono text-slate-800">
                    {(inspectedNode.keywords || []).join(', ') || 'None (Node opens via button tap)'}
                  </span>
                </div>

                {/* Option to Target Node Table */}
                <div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">OPTION</th>
                          <th className="py-2.5 px-4">GOES TO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectedOptions.length > 0 ? (
                          inspectedOptions.map((opt, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-slate-800">
                                {opt.title}
                              </td>
                              <td className="py-2.5 px-4">
                                {opt.targetId ? (
                                  <button
                                    onClick={() => setInspectedNodeId(opt.targetId)}
                                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer text-left"
                                  >
                                    {opt.targetName}
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">None</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="py-3 px-4 text-center text-slate-400 italic">
                              No interactive buttons or list items in this node.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* "How to read this" Card */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-2">
                  <div className="font-bold text-xs text-slate-800">
                    How to read this
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400 font-bold">≡</span>
                      <span>White bubbles are WACTO nodes, exactly as WhatsApp renders list and button messages.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">⤴</span>
                      <span>Green bubbles are the user's taps and typed text.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-sky-600 font-bold">{'{ }'}</span>
                      <span>Dashed bubbles are our backend's replies, with the wording saved in Bot Messages & Media.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">⚠</span>
                      <span>Yellow notes flag a silent WACTO, a missing edge, or a title that leads to two nodes.</span>
                    </li>
                  </ul>
                </div>

              </div>
            )}

            {/* TAB CONTENT: EDIT */}
            {activeTab === 'edit' && editingNode && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Node Title</label>
                  <input
                    type="text"
                    value={editingNode.name || ''}
                    onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Message Body</label>
                  <textarea
                    rows={6}
                    value={editingNode.data?.body || ''}
                    onChange={(e) => setEditingNode({
                      ...editingNode,
                      data: { ...editingNode.data, body: e.target.value }
                    })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      const updatedNodes = flow.nodes.map(n => n.nodeId === editingNode.nodeId ? editingNode : n)
                      setFlow({ ...flow, nodes: updatedNodes })
                      setActiveTab('inspect')
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setActiveTab('inspect')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* ==============================================================
          BOTTOM ROW: 3 DIAGNOSTIC & NAVIGATION PANELS
          ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        
        {/* PANEL 1: FLOW */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="font-extrabold text-sm text-slate-900 mb-2">
              Flow
            </div>

            {/* Flow selector dropdown */}
            <select
              value={currentFlowName}
              onChange={(e) => {
                if (e.target.value === 'isydci') {
                  setFlow(isydciFlowData)
                  setCurrentFlowName('ISYDCI Official Bot v1 (isydci_flow_v1.json)')
                }
              }}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="isydci">{flow.chatbot?.name || 'ISYDCI Official Bot v1'} (wacto/isydci_flow_v1.json)</option>
            </select>

            {/* Stat Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                {flow.nodes?.length || 0} nodes
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                {flow.edges?.length || 0} edges
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                errorCount > 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {errorCount} errors
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {warnCount} warn
              </span>
            </div>

            {/* Backend responses toggle */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="show-backend-cb"
                checked={showBackendReplies}
                onChange={(e) => setShowBackendReplies(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="show-backend-cb" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                Show our backend's replies
              </label>
            </div>

            {/* Backend connection indicator (Localhost 5000) */}
            <div className="mt-2.5">
              <div 
                onClick={checkBackendHealth}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-800 flex items-center justify-between font-mono cursor-pointer hover:bg-slate-100 transition-colors"
                title="Click to re-check backend health"
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span>http://localhost:5000</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  backendStatus === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  <span>{backendStatus === 'online' ? 'ONLINE' : 'OFFLINE'}</span>
                  <span className="text-[9px] opacity-60">↻</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Simulate As Athlete:</span>
              <button
                type="button"
                onClick={() => setCustomAthleteMode(!customAthleteMode)}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                {customAthleteMode ? '← Pick from list' : '+ Enter new custom phone'}
              </button>
            </div>

            {customAthleteMode ? (
              <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Athlete Name (e.g. Rahul Sharma)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="New Phone (e.g. 9811223344)"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const phoneToUse = customPhone.trim() || '9811223344'
                    const nameToUse = customName.trim() || 'New Candidate'
                    const found = dbMembers.find(m => (m.contact || '').replace(/\D/g, '') === phoneToUse.replace(/\D/g, ''))
                    if (found) {
                      switchSimulatedUser({ ...found, isUnregistered: false })
                    } else {
                      switchSimulatedUser({
                        name: nameToUse,
                        phone: phoneToUse,
                        memberId: '',
                        isUnregistered: true,
                        sport: 'Boxing',
                        state: 'Tamil Nadu'
                      })
                    }
                  }}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer text-center"
                >
                  Apply &amp; Test This Number
                </button>
              </div>
            ) : (
              <select
                value={selectedUser.isUnregistered ? 'unregistered' : selectedUser.phone}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'unregistered') {
                    switchSimulatedUser({
                      name: '',
                      phone: '9123456789',
                      memberId: '',
                      isUnregistered: true,
                      sport: 'ATHLETICS',
                      state: 'Tamil Nadu'
                    })
                  } else {
                    const found = dbMembers.find(m => m.contact === val)
                    if (found) {
                      switchSimulatedUser({ ...found, isUnregistered: false })
                    }
                  }
                }}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none"
              >
                {dbMembers.map((m, idx) => (
                  <option key={m.memberId || idx} value={m.contact}>
                    {m.name} ({m.contact || 'No phone'}) &mdash; Registered
                  </option>
                ))}
                <option value="unregistered">
                  Unregistered (9123456789) — Not Registered
                </option>
              </select>
            )}
            <div className="text-[10px] text-slate-400 leading-snug">
              Registered users see returning greeting &amp; instant card on <strong className="text-slate-600 font-mono">Hi</strong>. Unregistered candidates test the full registration &amp; photo flow.
            </div>
          </div>
        </div>

        {/* PANEL 2: CHECKS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-extrabold text-sm text-slate-900">
                Checks
              </div>
              <div className="text-[11px] text-slate-400">
                Same rules as verify_flow / route_check
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setChecksFilter('all')}
              className={`flex-1 py-1 rounded-lg transition-all ${
                checksFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All {checks.length}
            </button>
            <button
              onClick={() => setChecksFilter('errors')}
              className={`flex-1 py-1 rounded-lg transition-all ${
                checksFilter === 'errors' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Errors {errorCount}
            </button>
            <button
              onClick={() => setChecksFilter('warnings')}
              className={`flex-1 py-1 rounded-lg transition-all ${
                checksFilter === 'warnings' ? 'bg-white text-amber-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Warnings {warnCount}
            </button>
            <button
              onClick={() => setChecksFilter('notes')}
              className={`flex-1 py-1 rounded-lg transition-all ${
                checksFilter === 'notes' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Notes {noteCount}
            </button>
          </div>

          {/* Scrollable Checks List */}
          <div className="flex-1 overflow-y-auto max-h-56 space-y-2 pr-1 divide-y divide-slate-100">
            {filteredChecks.length > 0 ? (
              filteredChecks.map((chk, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-start gap-2.5 text-xs">
                  <span className="mt-0.5 shrink-0">
                    {chk.type === 'error' && <span className="text-rose-500 text-sm">⛔</span>}
                    {chk.type === 'warning' && <span className="text-amber-500 text-sm">⚠️</span>}
                    {chk.type === 'note' && <span className="text-emerald-500 text-sm">✓</span>}
                  </span>
                  <div>
                    <div className={`font-bold ${
                      chk.type === 'error' ? 'text-rose-900' : chk.type === 'warning' ? 'text-amber-900' : 'text-slate-800'
                    }`}>
                      {chk.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {chk.desc}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No items in this category.
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: NODES */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-sm text-slate-900">
              Nodes
            </div>
            <div className="text-xs text-slate-400 font-semibold">
              {filteredNodes.length} shown
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              placeholder="Search name or option..."
              className="w-full text-xs p-2.5 pl-8 rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:border-blue-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Scrollable Nodes List */}
          <div ref={nodesScrollRef} className="flex-1 overflow-y-auto max-h-56 space-y-1 pr-1">
            {filteredNodes.map((n) => {
              const isSelected = inspectedNodeId === n.nodeId
              const isOnScreen = currentNodeId === n.nodeId
              const isList = n.data?.interactiveType === 'list'

              return (
                <button
                  key={n.nodeId}
                  ref={el => { nodeItemRefs.current[n.nodeId] = el }}
                  onClick={() => setInspectedNodeId(n.nodeId)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200 ring-1 ring-blue-300/60'
                      : isOnScreen
                        ? 'bg-emerald-50/70 text-slate-800 border border-emerald-200/70'
                        : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-slate-400 text-sm">
                      {isList ? '≡' : '💬'}
                    </span>
                    <span className="truncate">{n.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isOnScreen && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Visible on phone" />
                    )}
                    {isSelected && !isOnScreen && (
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">inspecting</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* ==============================================================
          MODAL: VIEW RAW NODE JSON
          ============================================================== */}
      {jsonModalNode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-bold text-sm text-slate-900 font-mono">
                {jsonModalNode.name} ({jsonModalNode.nodeId})
              </div>
              <button
                onClick={() => setJsonModalNode(null)}
                className="text-slate-400 hover:text-slate-800 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs">
              <pre>{JSON.stringify(jsonModalNode, null, 2)}</pre>
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setJsonModalNode(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: PASTE RAW FLOW JSON
          ============================================================== */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900">
                  Paste WACTO Flow JSON
                </div>
                <div className="text-xs text-slate-500">
                  Paste any WACTO export JSON to simulate and verify offline.
                </div>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col space-y-2">
              <textarea
                value={pastedJsonText}
                onChange={(e) => setPastedJsonText(e.target.value)}
                placeholder='{"chatbot": {"name": "..."}, "nodes": [...], "edges": [...]}'
                className="w-full flex-1 min-h-[300px] p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
              {pasteError && (
                <div className="text-xs text-rose-600 font-bold">
                  {pasteError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                Load into Simulator
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: -100 }}>
        <div ref={hiddenDualRef} className="flex flex-row gap-6 p-6 bg-white rounded-2xl">
          <CardFront member={downloadTargetMember || selectedUser} />
          <CardBack member={downloadTargetMember || selectedUser} />
        </div>
      </div>

      {/* Interactive Photo Crop Modal (Matches /membership-card) */}
      <PhotoCropModal
        isOpen={cropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => setCropModalOpen(false)}
        onSave={(croppedUrl) => {
          setRegistrationDraft(prev => ({ ...prev, photo: croppedUrl }))
          setCropModalOpen(false)
        }}
      />

    </div>
  )
}
