import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import MembershipCard, { CardFront, CardBack } from '../components/MembershipCard.jsx'
import { toPng } from 'html-to-image'
import { API_BASE_URL } from '../config/api.js'

export default function AdminMembers() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedMember, setSelectedMember] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [copiedToast, setCopiedToast] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [actionNotice, setActionNotice] = useState('')
  const [modalViewTab, setModalViewTab] = useState('card') // 'card' | 'whatsapp'
  const [simCardTab, setSimCardTab] = useState('combined') // 'combined' | 'front' | 'back'

  const cardFrontModalRef = useRef(null)
  const cardBackModalRef = useRef(null)
  const dualCardModalRef = useRef(null)

  const showNotice = (msg) => {
    setActionNotice(msg)
    setTimeout(() => setActionNotice(''), 3000)
  }

  // Fetch members from backend API
  const fetchMembers = async (q = '') => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/members${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.members)) {
          setMembers(data.members)
          return
        }
      }
      // If server unreachable, check localStorage
      const local = JSON.parse(localStorage.getItem('isydci_members') || '[]')
      setMembers(local)
    } catch {
      const local = JSON.parse(localStorage.getItem('isydci_members') || '[]')
      setMembers(local)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchMembers(searchQuery)
  }

  const openPreviewModal = (member, tab = 'card') => {
    setSelectedMember(member)
    setCardFlipped(false)
    setModalViewTab(tab)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedMember(null)
  }

  // Toggle Member Verification Status (Syncs to Backend API)
  const handleToggleStatus = async (member, e) => {
    e.stopPropagation()
    const nextStatus = member.status === 'Verified' ? 'Pending' : 'Verified'
    
    setMembers(prev => prev.map(m =>
      (m.id === member.id || m.memberId === member.memberId)
        ? { ...m, status: nextStatus }
        : m
    ))
    showNotice(`Status updated to ${nextStatus} for ${member.name}`)

    try {
      await fetch(`${API_BASE_URL}/api/members/${member.id || member.memberId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
    } catch (err) {
      console.warn('Backend sync error:', err)
    }
  }

  const handleShare = () => {
    if (!selectedMember) return
    const origin = typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file:')
      ? window.location.origin
      : 'http://localhost:5173'
    const cardUrl = `${origin}/membership-card?id=${encodeURIComponent(selectedMember.memberId || '')}`
    navigator.clipboard?.writeText(cardUrl)
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2500)
  }

  // Download Full Combined Card (Both Front & Back together on plain transparent background)
  const handleDownloadCard = async () => {
    if (!selectedMember) return
    try {
      setDownloading(true)
      const filename = `${selectedMember.memberId || 'ISYDCI'}_card.png`
      const node = dualCardModalRef.current

      if (node) {
        const dataUrl = await toPng(node, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: null, // Plain transparent background (no black box)
        })
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else if (selectedMember.cardFullUrl) {
        // Fallback to Cloudinary URL if available
        try {
          const res = await fetch(selectedMember.cardFullUrl)
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = filename
          link.href = blobUrl
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1500)
        } catch {
          window.open(selectedMember.cardFullUrl, '_blank')
        }
      } else {
        throw new Error('Card container not found')
      }
    } catch (err) {
      console.error('Download card error:', err)
      alert('Could not download card image. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteMember = async (id, name, e) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete member: ${name}?`)) return
    try {
      await fetch(`${API_BASE_URL}/api/members/${id}`, { method: 'DELETE' })
      setMembers(prev => prev.filter(m => m.id !== id && m.memberId !== id))
      showNotice(`Deleted member: ${name}`)
    } catch {
      setMembers(prev => prev.filter(m => m.id !== id && m.memberId !== id))
      showNotice(`Deleted member: ${name}`)
    }
  }

  const filteredMembers = members.filter(m => {
    const matchesSearch =
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.memberId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.contact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.assembly?.toLowerCase().includes(searchQuery.toLowerCase())

    if (statusFilter === 'ALL') return matchesSearch
    return matchesSearch && m.status === statusFilter
  })

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* Top Admin Header Bar */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/90 px-2.5 py-0.5 rounded-full border border-blue-200/80">
                Official Directory
              </span>
              <span className="text-xs text-slate-400">• State &amp; National Registry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0b1e3f] tracking-tight font-['Montserrat']">
              Members Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {members.length} registered member{members.length !== 1 ? 's' : ''} in central database
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => fetchMembers(searchQuery)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 shadow-sm text-slate-700 text-xs font-bold hover:border-slate-300 transition-all cursor-pointer backdrop-blur-sm"
            >
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>Refresh</span>
            </button>
            <Link
              to="/membership-card"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Generate New Card</span>
            </Link>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {actionNotice}
            </span>
            <button onClick={() => setActionNotice('')} className="text-blue-700 font-bold hover:text-blue-900 cursor-pointer">&times;</button>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white/80 backdrop-blur-xl p-3.5 sm:p-4 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto w-full sm:w-auto">
            {['ALL', 'Verified', 'Pending'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st} {st !== 'ALL' ? `(${members.filter(m => m.status === st).length})` : `(${members.length})`}
              </button>
            ))}
          </div>

          {/* Search Input Form */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, card ID, phone, district..."
                className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-9.5 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Main Members Table (Frosted Glass Theme) */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-5">Member</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Blood Group</th>
                <th className="py-3.5 px-4">Status (Click to Toggle)</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    Loading registered members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-blue-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M7 7h10" />
                        <path d="M7 12h10" />
                        <path d="M7 17h6" />
                      </svg>
                    </div>
                    <div className="font-extrabold text-[#0b1e3f] text-sm font-['Montserrat']">
                      No Registered Members Found
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {searchQuery ? 'Try clearing your search query.' : 'Use the generator to add your first member.'}
                    </p>
                    <Link
                      to="/membership-card"
                      className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Register New Member</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr
                    key={m.id || m.memberId}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() => openPreviewModal(m)}
                  >
                    {/* Member Photo, Name & ID */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.photo || m.photoUrl || '/athletes/1.png'}
                          alt={m.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
                          onError={(e) => { e.target.src = '/athletes/1.png' }}
                        />
                        <div>
                          <div className="font-extrabold text-[#0b1e3f] group-hover:text-blue-600 transition-colors font-['Montserrat'] uppercase">
                            {m.name}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-blue-600">
                            {m.memberId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 capitalize">
                        {m.assembly || m.district || '—'}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">
                        {m.state || 'TAMIL NADU'}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {m.contact || '—'}
                    </td>

                    {/* Blood Group */}
                    <td className="py-3.5 px-4 font-bold text-rose-700">
                      {m.bloodGroup || 'A+'}
                    </td>

                    {/* Verification Status with Click-to-Toggle */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(m, e)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          m.status === 'Verified'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                        }`}
                        title="Click to toggle status between Verified & Pending"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'Verified' ? 'bg-blue-600' : 'bg-amber-500'}`} />
                        <span>{m.status || 'Verified'}</span>
                      </button>
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap text-xs">
                      {m.joinedDate || 'Recent'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openPreviewModal(m, 'whatsapp')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005d4b] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-200 shadow-2xs"
                          title="Simulate WhatsApp Flow for this member"
                        >
                          <span>💬</span>
                          <span>WhatsApp Flow</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreviewModal(m, 'card')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          title="Preview 3D ID Card"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMember(m.id || m.memberId, m.name, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-xs"
                          title="Delete Member"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= CARD PREVIEW & WHATSAPP SIMULATOR MODAL ================= */}
      {modalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto">
          <div className="relative bg-white/95 backdrop-blur-2xl text-slate-800 rounded-2xl sm:rounded-3xl border border-white shadow-2xl max-w-[920px] w-full max-h-[94vh] overflow-y-auto p-4 sm:p-7 flex flex-col gap-4 animate-fadeIn my-auto">
            
            {/* Modal Header & View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 pr-8">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalViewTab('card')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    modalViewTab === 'card'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🪪</span>
                  <span>Official 3D Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalViewTab('whatsapp')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    modalViewTab === 'whatsapp'
                      ? 'bg-[#005d4b] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>💬</span>
                  <span>WhatsApp Flow Simulator</span>
                </button>
              </div>

              <Link
                to={`/admin/flow-simulator?id=${selectedMember.memberId}&phone=${selectedMember.contact}`}
                className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-all self-start sm:self-auto"
                title="Open in dedicated WhatsApp Bot Flow Simulator"
              >
                <span>Full Flow Simulator</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* Close Button Top Right */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none p-1 transition-colors cursor-pointer"
            >
              &times;
            </button>

            {/* TAB CONTENT 1: WHATSAPP BOT FLOW SIMULATOR */}
            {modalViewTab === 'whatsapp' ? (
              <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start animate-fadeIn">
                {/* Authentic WhatsApp Phone Mockup */}
                <div className="w-[340px] h-[580px] bg-slate-900 rounded-[38px] p-2.5 shadow-2xl ring-1 ring-slate-800 relative flex flex-col overflow-hidden shrink-0">
                  {/* Phone Screen Container */}
                  <div className="w-full h-full rounded-[30px] bg-[#efeae2] flex flex-col overflow-hidden relative text-slate-800 font-sans">
                    {/* Status Bar */}
                    <div className="bg-[#005d4b] text-white pt-2 px-5 pb-1 flex justify-between items-center text-[10px] font-medium shrink-0">
                      <span>11:00 am</span>
                      <div className="flex items-center gap-1.5">
                        <span>5G</span>
                        <div className="w-4 h-2 rounded-2xs border border-white flex items-center p-0.5">
                          <div className="w-full h-full bg-white rounded-3xs" />
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Header */}
                    <div className="bg-[#005d4b] text-white px-3 py-2 flex items-center justify-between shadow-xs shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs">
                          IS
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1 leading-tight">
                            <span>ISYDCI Official Bot</span>
                            <span className="w-3 h-3 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[8px] font-black">✓</span>
                          </div>
                          <div className="text-[9px] text-teal-100/80">Business account</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-white/90">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                    </div>

                    {/* Chat Bubble Area */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
                      {/* Encryption Banner */}
                      <div className="bg-[#ffeecd] text-[#54656f] text-[9px] p-1.5 rounded-lg text-center shadow-2xs leading-tight">
                        🔒 Messages are end-to-end encrypted.
                      </div>

                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-[#d9fdd3] text-slate-900 rounded-xl rounded-tr-xs px-2.5 py-1 text-xs shadow-2xs">
                          <span>Hi</span>
                          <span className="text-[9px] text-slate-400 ml-2">11:00 am ✓✓</span>
                        </div>
                      </div>

                      {/* Bot Welcome Back Bubble */}
                      <div className="bg-white rounded-xl rounded-tl-xs p-2.5 shadow-2xs border border-slate-200/60 space-y-1">
                        <div className="font-extrabold text-[#005d4b] text-xs flex items-center gap-1">
                          <span>🏆</span>
                          <span>Welcome back, {selectedMember.name}!</span>
                        </div>
                        <div className="text-[11px] text-slate-700 leading-relaxed">
                          You are an accredited athlete member with ISYDCI.
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] space-y-0.5">
                          <div>👤 Athlete: <strong className="text-slate-900">{selectedMember.name}</strong></div>
                          <div>🆔 ID: <strong className="font-mono text-teal-800">{selectedMember.memberId}</strong></div>
                          <div>📍 State: <strong>{selectedMember.state || 'TAMIL NADU'}</strong> • {selectedMember.district || selectedMember.assembly || 'TRICHY'}</div>
                          <div className="text-emerald-700 font-bold">✓ Verified Athlete (Reg: 49/1997)</div>
                        </div>
                      </div>

                      {/* Card Message Bubble with Tabs */}
                      <div className="bg-white rounded-xl rounded-tl-xs p-2.5 shadow-2xs border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-[#0b1e3f]">🪪 Official Membership Card</span>
                          <span className="text-[9px] text-slate-400">11:00 am</span>
                        </div>

                        {/* Card Side Switcher Tabs */}
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={() => setSimCardTab('combined')}
                            className={`flex-1 py-0.5 rounded transition-all cursor-pointer ${simCardTab === 'combined' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                          >
                            Combined
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimCardTab('front')}
                            className={`flex-1 py-0.5 rounded transition-all cursor-pointer ${simCardTab === 'front' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                          >
                            Front
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimCardTab('back')}
                            className={`flex-1 py-0.5 rounded transition-all cursor-pointer ${simCardTab === 'back' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                          >
                            Back
                          </button>
                        </div>

                        {/* Scaled Mini Card */}
                        <div className="overflow-hidden rounded-lg bg-slate-100 p-1 flex items-center justify-center border border-slate-200">
                          {simCardTab === 'combined' && (
                            <div className="flex flex-col gap-1 items-center scale-[0.44] origin-top -mb-[300px]">
                              <CardFront member={selectedMember} />
                              <CardBack member={selectedMember} />
                            </div>
                          )}
                          {simCardTab === 'front' && (
                            <div className="scale-[0.52] origin-top -mb-[250px]">
                              <CardFront member={selectedMember} />
                            </div>
                          )}
                          {simCardTab === 'back' && (
                            <div className="scale-[0.52] origin-top -mb-[250px]">
                              <CardBack member={selectedMember} />
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-1 pt-1">
                          <button
                            type="button"
                            onClick={handleDownloadCard}
                            className="w-full py-1.5 px-2 bg-[#005d4b] hover:bg-[#075e54] text-white font-bold text-[10px] rounded-lg shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>📥 Download Card</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleShare}
                            className="w-full py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>🔗 Share Card</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Chat Message Input Bar */}
                    <div className="bg-[#f0f2f5] p-2 flex items-center gap-1.5 border-t border-slate-200 shrink-0">
                      <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-slate-400 border border-slate-200">
                        Type a message...
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#005d4b] text-white flex items-center justify-center text-[10px]">
                        ➤
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Member Details & Flow Info */}
                <div className="flex-1 flex flex-col justify-between w-full max-w-sm pt-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        WhatsApp Flow Verified
                      </span>
                      <span className="text-xs text-slate-400">• Returning Member</span>
                    </div>

                    <h2 className="text-2xl font-black text-[#0b1e3f] tracking-tight font-['Montserrat']">
                      {selectedMember.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 mb-4">
                      Simulated WhatsApp chat experience for this registered athlete.
                    </p>

                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl mb-4 text-xs text-emerald-950 space-y-1">
                      <div className="font-bold flex items-center gap-1 text-emerald-800">
                        <span>⚡</span>
                        <span>Automated Member Detection</span>
                      </div>
                      <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                        When <strong>{selectedMember.name}</strong> sends any message on WhatsApp from <strong>{selectedMember.contact}</strong>, the ISYDCI bot instantly recognizes their registered member record and delivers their verified ID card immediately.
                      </p>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 border-t border-b border-slate-100 py-3 mb-5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Member ID</span>
                        <span className="font-mono font-bold text-teal-800">{selectedMember.memberId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Contact / WhatsApp</span>
                        <span className="font-mono font-bold text-slate-800">{selectedMember.contact}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">State & District</span>
                        <span className="font-semibold text-slate-800">{selectedMember.state || 'Tamil Nadu'} • {selectedMember.district || selectedMember.assembly || 'Trichy'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Status</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">Verified Athlete ✅</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 w-full">
                    <Link
                      to={`/admin/flow-simulator?id=${selectedMember.memberId}&phone=${selectedMember.contact}`}
                      className="w-full py-3 px-4 rounded-xl bg-[#005d4b] hover:bg-[#075e54] active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 transition-all cursor-pointer text-center"
                    >
                      <span>💬 OPEN IN FULL FLOW SIMULATOR</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleDownloadCard}
                      disabled={downloading}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>📥 DOWNLOAD CARD PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
                    >
                      <span>{copiedToast ? '✓ Copied Card Link!' : '📋 Copy Direct Card Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-stretch">
                {/* LEFT COLUMN: 3D FLIP CARD */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <MembershipCard
                    member={selectedMember}
                    frontRef={cardFrontModalRef}
                    backRef={cardBackModalRef}
                    flipped={cardFlipped}
                    onFlip={() => setCardFlipped(prev => !prev)}
                  />
                </div>

                {/* RIGHT COLUMN: CARD PREVIEW CREDENTIALS & ACTION BUTTONS */}
                <div className="flex-1 flex flex-col justify-between w-full max-w-sm pt-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Official Card
                      </span>
                      <span className="text-xs text-slate-400">• CR80 300 DPI</span>
                    </div>
                    <h2 className="text-2xl font-black text-[#0b1e3f] tracking-tight font-['Montserrat']">
                      Member Details
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 mb-5">
                      Live verified member identification record.
                    </p>

                    {/* Details Table */}
                    <div className="space-y-3 text-xs text-slate-700 border-t border-b border-slate-100 py-4 mb-5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Full Name</span>
                        <span className="font-extrabold text-[#0b1e3f] uppercase text-sm">
                          {selectedMember.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Card ID</span>
                        <span className="font-mono font-bold text-blue-700 tracking-wider">
                          {selectedMember.memberId}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Status</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                          selectedMember.status === 'Verified'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {selectedMember.status || 'Verified'}
                        </span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="text-slate-500 font-semibold">Location</span>
                        <span className="font-bold text-slate-800 text-right capitalize">
                          {selectedMember.assembly || selectedMember.district || 'Tamil Nadu'}
                        </span>
                      </div>

                      {selectedMember.contact && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Contact</span>
                          <span className="font-mono font-bold text-slate-700">
                            {selectedMember.contact}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => setCardFlipped(!cardFlipped)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-200 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3 7 3-3 3 3" />
                        <path d="M6 4v10a4 4 0 0 0 4 4h10" />
                        <path d="m21 17-3 3-3-3" />
                        <path d="M18 20V10a4 4 0 0 0-4-4H4" />
                      </svg>
                      <span>FLIP CARD</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadCard}
                      disabled={downloading}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>{downloading ? 'GENERATING PNG...' : 'DOWNLOAD CARD'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span>{copiedToast ? 'Copied Card Link!' : 'Copy Card URL'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Dual Card Container for Full 2-in-1 Card Download on Plain Transparent Background */}
      {selectedMember && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <div
            ref={dualCardModalRef}
            className="inline-flex p-4 bg-transparent gap-6 items-center select-none"
            style={{ width: '740px', backgroundColor: 'transparent' }}
          >
            <CardFront member={selectedMember} />
            <CardBack member={selectedMember} />
          </div>
        </div>
      )}

    </div>
  )
}
