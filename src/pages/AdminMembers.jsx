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

  const cardFrontModalRef = useRef(null)
  const cardBackModalRef = useRef(null)

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

  const openPreviewModal = (member) => {
    setSelectedMember(member)
    setCardFlipped(false)
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

  const handleDownloadCard = async () => {
    if (!selectedMember) return
    try {
      setDownloading(true)
      const node = cardFlipped ? cardBackModalRef.current : cardFrontModalRef.current
      if (!node) return
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      const name = selectedMember.name ? selectedMember.name.replace(/\s+/g, '_') : 'ISYDCI_MEMBER'
      link.download = `${name}_${cardFlipped ? 'BACK' : 'FRONT'}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Download card error:', err)
      alert('Could not download image. Please try again.')
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
                          onClick={() => openPreviewModal(m)}
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

      {/* ================= CARD PREVIEW 3D MODAL (GLASSY FROSTED THEME) ================= */}
      {modalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto">
          <div className="relative bg-white/95 backdrop-blur-2xl text-slate-800 rounded-2xl sm:rounded-3xl border border-white shadow-2xl max-w-[880px] w-full max-h-[92vh] overflow-y-auto p-4 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-stretch animate-fadeIn my-auto">
            
            {/* Close Button Top Right */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none p-1 transition-colors cursor-pointer"
            >
              &times;
            </button>

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
                  <span>{cardFlipped ? 'SEE CARD FRONT' : 'SEE CARD BACK'}</span>
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
                  <span>{downloading ? 'GENERATING PNG...' : `DOWNLOAD ${cardFlipped ? 'BACK' : 'FRONT'} PNG`}</span>
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
        </div>
      )}

    </div>
  )
}
