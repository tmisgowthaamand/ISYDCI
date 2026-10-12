import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import PageHeader from '../components/PageHeader.jsx'
import MembershipCard, { CardFront, CardBack } from '../components/MembershipCard.jsx'
import { API_BASE_URL } from '../config/api.js'

const makeAutoMemberId = () => `ISYDCI-${Math.random().toString(16).substring(2, 10).toUpperCase()}`

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 85 }, (_, i) => String(CURRENT_YEAR - i))

const parseDob = (dobStr) => {
  if (!dobStr) return { day: '', month: '', year: '' }
  const parts = dobStr.trim().split(/\s+/)
  if (parts.length === 3) {
    return {
      day: parts[0].padStart(2, '0'),
      month: parts[1],
      year: parts[2],
    }
  }
  return { day: '', month: '', year: '' }
}

const initialEmptyProfile = {
  name: '',
  photo: '',
  leaderPhoto: '/events/1.png',
  leaderName: 'Visanath Shetty',
  state: '',
  district: '',
  assembly: '',
  zone: '',
  memberId: '',
  regNo: '49/1997',
  dob: '',
  age: '',
  bloodGroup: 'A+',
  sport: '',
  address: '',
  contact: '',
  presidentName: 'VISANATH SHETTY',
  presidentRole: 'Founder & National President',
  orgName: 'International Sports & Youth Development Campaign',
  addressHQ: 'VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001',
}

export default function MembershipCardPage() {
  const [member, setMember] = useState(initialEmptyProfile)
  const [flipped, setFlipped] = useState(false)
  const [viewMode, setViewMode] = useState('flip') // 'flip' or 'sideBySide'
  const [downloading, setDownloading] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedDetails, setSavedDetails] = useState(null)
  const [toastNotification, setToastNotification] = useState(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)

  // Direct element references for PNG export
  const interactiveFrontRef = useRef(null)
  const interactiveBackRef = useRef(null)
  const staticFrontRef = useRef(null)
  const staticBackRef = useRef(null)
  const dualCardRef = useRef(null)
  const hiddenFrontRef = useRef(null)
  const hiddenBackRef = useRef(null)

  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)

  // Auto-load member details if ?id= query parameter is in URL (from scanned QR code)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const idParam = params.get('id')
      if (idParam) {
        fetch(`${API_BASE_URL}/api/members/${encodeURIComponent(idParam)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.member) {
              setMember(prev => ({
                ...prev,
                ...data.member,
              }))
            }
          })
          .catch(err => console.warn('Could not auto-load member card by ID:', err))
      }
    } catch (_) {}
  }, [])

  // Handle Photo Upload with 137x136 Cropper
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCropImageSrc(event.target.result)
        setCropModalOpen(true)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    }
  }

  const handleCroppedPhotoSave = (croppedDataUrl) => {
    setMember(prev => ({
      ...prev,
      photo: croppedDataUrl,
      memberId: prev.memberId || makeAutoMemberId(),
    }))
  }

  // Handle Form input changes with silent background auto-generation of ID
  const handleFieldChange = (field, value) => {
    setMember(prev => {
      let nextId = prev.memberId
      if (!nextId && value.trim()) {
        nextId = makeAutoMemberId()
      }
      return {
        ...prev,
        [field]: value,
        memberId: nextId,
      }
    })
  }

  // Handle Date of Birth Part Selector (Day, Month, Year) & Auto Calculate Age
  const dobParts = parseDob(member.dob)
  const handleDobPartChange = (part, val) => {
    const current = parseDob(member.dob)
    const nextParts = { ...current, [part]: val }
    
    let formattedDob = ''
    if (nextParts.day || nextParts.month || nextParts.year) {
      formattedDob = `${nextParts.day || '01'} ${nextParts.month || 'Jan'} ${nextParts.year || '2000'}`.trim()
    }

    let calculatedAge = member.age
    if (nextParts.year && parseInt(nextParts.year, 10) > 1900) {
      const birthYear = parseInt(nextParts.year, 10)
      const thisYear = new Date().getFullYear()
      if (thisYear >= birthYear) {
        calculatedAge = String(thisYear - birthYear)
      }
    }

    setMember(prev => ({
      ...prev,
      dob: formattedDob,
      age: calculatedAge,
      memberId: prev.memberId || makeAutoMemberId(),
    }))
  }

  // Reset form to empty
  const handleClearForm = () => {
    setMember(initialEmptyProfile)
    setSavedSuccess(false)
    setSavedDetails(null)
  }

  // Universal File Download Helper (Works for base64 data URLs & Cloudinary URLs)
  const triggerFileDownload = async (source, filename) => {
    if (!source) return
    try {
      if (source.startsWith('data:image')) {
        const link = document.createElement('a')
        link.download = filename
        link.href = source
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return
      }
      // For remote URLs (e.g. Cloudinary) fetch as blob to force browser download
      const res = await fetch(source)
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
      // Direct link fallback
      const link = document.createElement('a')
      link.download = filename
      link.href = source
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Handle PNG Downloads
  const downloadFront = async () => {
    try {
      setDownloading(true)
      const node = viewMode === 'sideBySide' ? staticFrontRef.current : interactiveFrontRef.current
      if (!node) throw new Error('Card Front not found')
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
      const filename = member.name ? member.name.trim().replace(/\s+/g, '_') : 'ISYDCI_MEMBER'
      await triggerFileDownload(dataUrl, `${filename}_ID_FRONT.png`)
    } catch (err) {
      console.error('Download Front Error:', err)
      alert('Failed to download card front. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const downloadBack = async () => {
    try {
      setDownloading(true)
      const node = viewMode === 'sideBySide' ? staticBackRef.current : interactiveBackRef.current
      if (!node) throw new Error('Card Back not found')
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
      const filename = member.name ? member.name.trim().replace(/\s+/g, '_') : 'ISYDCI_MEMBER'
      await triggerFileDownload(dataUrl, `${filename}_ID_BACK.png`)
    } catch (err) {
      console.error('Download Back Error:', err)
      alert('Failed to download card back. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const downloadBoth = async () => {
    try {
      setDownloading(true)
      const node = dualCardRef.current
      if (!node) throw new Error('Combined card container not found')
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: null, // Plain transparent background (no black box)
      })
      const cardId = member.memberId || makeAutoMemberId()
      const filename = `${cardId}_card.png`
      await triggerFileDownload(dataUrl, filename)
    } catch (err) {
      console.error('Download Both Error:', err)
      alert('Failed to download combined card. Please try again.')
    } finally {
      setDownloading(false)
    }
  }


  // Save to Admin Database & Upload to Cloudinary, Auto-Download Full Card PNG, and Notify
  const handleSaveRegistration = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)

      // Guarantee an auto-generated unique ID behind the scenes
      const finalMemberId = member.memberId || makeAutoMemberId()
      const memberToSave = { ...member, memberId: finalMemberId }
      setMember(memberToSave)

      // 1. Capture high-resolution full card image (front & back on plain transparent background)
      let fullCardPng = ''
      try {
        if (dualCardRef.current) {
          fullCardPng = await toPng(dualCardRef.current, {
            pixelRatio: 3,
            cacheBust: true,
            backgroundColor: null, // Plain transparent background (no black box)
          })
        }
      } catch (captureErr) {
        console.warn('Canvas capture notice:', captureErr)
      }

      // 2. Post to backend server (uploads ONLY full card & profile photo to Cloudinary in isydci/members/<USER_NAME>/)
      let backendSaved = null
      try {
        const res = await fetch(`${API_BASE_URL}/api/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: memberToSave.name || 'MEMBER',
            photo: memberToSave.photo,
            cardFullImage: fullCardPng,
            state: memberToSave.state,
            district: memberToSave.district,
            assembly: memberToSave.assembly,
            zone: memberToSave.zone,
            dob: memberToSave.dob,
            age: memberToSave.age,
            bloodGroup: memberToSave.bloodGroup,
            contact: memberToSave.contact,
            address: memberToSave.address,
            memberId: finalMemberId,
            status: 'Verified',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.member) {
            backendSaved = data.member
          }
        }
      } catch (apiErr) {
        console.warn('Backend API connection notice:', apiErr)
      }

      const safeName = (memberToSave.name || 'ISYDCI_MEMBER').trim().replace(/\s+/g, '_').toUpperCase()
      const finalFullImage = backendSaved?.cardFullUrl || fullCardPng

      // 3. Fallback/Sync with LocalStorage (Only storing full card and profile photo)
      const existing = JSON.parse(localStorage.getItem('isydci_members') || '[]')
      const newEntry = backendSaved || {
        ...memberToSave,
        id: Date.now(),
        registeredAt: new Date().toISOString(),
        status: 'Verified',
        cloudinaryFolder: `isydci/members/${safeName}`,
        photoUrl: memberToSave.photo,
        cardFullUrl: finalFullImage,
      }
      localStorage.setItem('isydci_members', JSON.stringify([newEntry, ...existing]))

      setSavedDetails(newEntry)
      setSavedSuccess(true)

      // 4. Automatically download ONLY the FULL CARD (e.g. ISYDCI-3B00A07F_card.png) on plain transparent background
      const fullCardFilename = `${finalMemberId}_card.png`
      const cardToDownload = fullCardPng || finalFullImage
      if (cardToDownload) {
        await triggerFileDownload(cardToDownload, fullCardFilename)
      }

      // 5. Trigger Top-Right Corner Notification Toast
      setToastNotification({
        memberId: finalMemberId,
        name: memberToSave.name || 'MEMBER',
        fullCardImg: cardToDownload,
        cloudinaryFolder: newEntry.cloudinaryFolder || `isydci/members/${safeName}`,
        photoUrl: newEntry.photoUrl || memberToSave.photo,
        downloadFilename: fullCardFilename,
      })

    } catch (err) {
      console.error('Save error:', err)
      alert('Could not complete registration. Please try again.')
    } finally {
      setSaving(false)
    }
  }


  return (
    <>
      <PageHeader
        kicker="Official Membership"
        title="Membership ID Card"
        subtitle="Generate and download your official member identity card as high-resolution PNG."
      />

      {/* Main Section */}
      <section className="bg-[#f8fafc] py-14 md:py-20 text-slate-800 min-h-screen font-sans">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6">

          {/* Top Control Bar */}
          <div className="mb-8 bg-white/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-l-[5px] border-blue-600 shadow-[0_10px_30px_rgba(11,30,63,.06)] border border-slate-200/80">
            <div>
              <span className="text-blue-600 font-bold tracking-[2.5px] text-xs uppercase">
                Digital Membership
              </span>
              <h2 className="text-[#0b1e3f] text-lg sm:text-xl font-extrabold tracking-tight mt-0.5 font-['Montserrat']">
                Live ID Card Designer &amp; Generator
              </h2>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('flip')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'flip'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3D Flip Card View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sideBySide')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'sideBySide'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front &amp; Back (Side-by-Side)
              </button>
            </div>
          </div>

          {/* Layout Grid: Dynamic to fit side-by-side or flip mode */}
          <div className={
            viewMode === 'sideBySide'
              ? 'grid grid-cols-1 xl:grid-cols-12 gap-8 items-start'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'
          }>

            {/* ================= CARD PREVIEW CONTAINER ================= */}
            <div className={
              viewMode === 'sideBySide'
                ? 'xl:col-span-7 flex flex-col items-center'
                : 'lg:col-span-5 flex flex-col items-center'
            }>
              <div className="w-full bg-white/85 backdrop-blur-xl border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 shadow-[0_10px_35px_rgba(11,30,63,.08)] flex flex-col items-center overflow-hidden">
                
                {/* Header */}
                <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full border border-slate-200" />
                    <div>
                      <h3 className="font-extrabold text-sm text-[#0b1e3f]">Live ID Card Preview</h3>
                      <p className="text-[11px] text-blue-600 font-semibold">Official CR80 Portrait Standard</p>
                    </div>
                  </div>
                  <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    300 DPI Export
                  </span>
                </div>

                {/* Card Container Based on View Mode */}
                {viewMode === 'flip' ? (
                  <MembershipCard
                    member={member}
                    frontRef={interactiveFrontRef}
                    backRef={interactiveBackRef}
                    flipped={flipped}
                    onFlip={() => setFlipped(v => !v)}
                  />
                ) : (
                  <div className="w-full flex flex-row flex-wrap items-center justify-center gap-6 py-2">
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-3 border border-blue-200">
                        Card Front
                      </span>
                      <CardFront ref={staticFrontRef} member={member} />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-3 border border-blue-200">
                        Card Back
                      </span>
                      <CardBack ref={staticBackRef} member={member} />
                    </div>
                  </div>
                )}

                {/* Download Buttons Bar */}
                <div className="mt-8 w-full max-w-lg">
                  <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-500 mb-3 text-center">
                    Instant Download Options (High-Res PNG)
                  </h4>
                  
                  <div className="space-y-2.5">
                    {/* Primary Hero Button: Full 2-in-1 Combined Card with Auto-Generated Member Code */}
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={downloadBoth}
                      className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm flex flex-wrap items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 border border-blue-500 overflow-hidden"
                      title={`Download Full Combined Card (${member.memberId || 'ISYDCI'}_card.png)`}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span className="shrink-0">Full Card PNG</span>
                      <span className="font-mono text-[11px] font-bold bg-blue-700/80 px-2.5 py-0.5 rounded-md border border-blue-400/40 truncate max-w-[240px]">
                        {member.memberId || 'ISYDCI'}_card.png
                      </span>
                    </button>

                    {/* Secondary Individual Side Buttons */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={downloadFront}
                        className="w-full bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 border border-slate-700 whitespace-nowrap overflow-hidden"
                        title="Download Front Side PNG"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="truncate">Front PNG</span>
                      </button>

                      <button
                        type="button"
                        disabled={downloading}
                        onClick={downloadBack}
                        className="w-full bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 border border-slate-700 whitespace-nowrap overflow-hidden"
                        title="Download Back Side PNG"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="truncate">Back PNG</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quality Badge */}
                <div className="mt-3.5 text-[11px] text-slate-500 text-center flex items-center justify-center gap-2">
                  <span>🔒 High Resolution 300 DPI Export</span>
                  <span>•</span>
                  <span>Scannable QR Verified</span>
                </div>
              </div>
            </div>

            {/* ================= EDIT CARD DETAILS / FORM (WITH SELECT DOB) ================= */}
            <div className={
              viewMode === 'sideBySide'
                ? 'xl:col-span-5'
                : 'lg:col-span-7'
            }>
              <div className="bg-white/85 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-[0_10px_35px_rgba(11,30,63,.08)]">
                
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                  <div>
                    <h3 className="text-xl font-black font-['Montserrat'] text-[#0b1e3f]">
                      Enter Member Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select date of birth and fill details to preview card live.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer border border-slate-200"
                    >
                      <span>Clear Form</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveRegistration} className="space-y-5">
                  
                  {/* Photo & Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Photo Upload with 137x136 Cropper */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Member Photo (137 × 136)
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-14 rounded-lg object-cover border border-slate-300 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          {member.photo ? (
                            <img
                              src={member.photo}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400 text-center px-1">NO PHOTO</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="inline-block w-full text-center cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-3 rounded-xl border border-slate-200 transition-all">
                            <span>📷 Upload &amp; Crop (137×136)</span>
                            <input
                              type="file"
                              accept="image/jpeg, image/png, image/jpg, image/webp"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Member Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Full Name (Uppercase)
                      </label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-bold tracking-wide uppercase transition-all"
                        placeholder="e.g. LAKSHAN KARTHIK"
                        required
                      />
                    </div>
                  </div>

                  {/* State, District, Assembly, Zone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        State
                      </label>
                      <input
                        type="text"
                        value={member.state}
                        onChange={(e) => handleFieldChange('state', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white uppercase transition-all"
                        placeholder="e.g. TAMIL NADU"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        District (DIST)
                      </label>
                      <input
                        type="text"
                        value={member.district}
                        onChange={(e) => handleFieldChange('district', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white uppercase transition-all"
                        placeholder="e.g. CHENNAI"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Assembly (ASSM)
                      </label>
                      <input
                        type="text"
                        value={member.assembly}
                        onChange={(e) => handleFieldChange('assembly', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white capitalize transition-all"
                        placeholder="e.g. Thiyagarayanagar"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Zone / Region
                      </label>
                      <input
                        type="text"
                        value={member.zone}
                        onChange={(e) => handleFieldChange('zone', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white uppercase transition-all"
                        placeholder="e.g. CHENNAI ZONE"
                      />
                    </div>
                  </div>

                  {/* Date of Birth (Select Date, Month, Year) & Age Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Date of Birth with 3 Dropdowns */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Date of Birth (Select Date • Month • Year)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Day / Date */}
                        <select
                          value={dobParts.day}
                          onChange={(e) => handleDobPartChange('day', e.target.value)}
                          className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
                        >
                          <option value="">Date</option>
                          {DAYS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>

                        {/* Month */}
                        <select
                          value={dobParts.month}
                          onChange={(e) => handleDobPartChange('month', e.target.value)}
                          className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
                        >
                          <option value="">Month</option>
                          {MONTHS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>

                        {/* Year */}
                        <select
                          value={dobParts.year}
                          onChange={(e) => handleDobPartChange('year', e.target.value)}
                          className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
                        >
                          <option value="">Year</option>
                          {YEARS.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Age (Auto-calculated, still editable) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Age (Years)
                      </label>
                      <input
                        type="text"
                        value={member.age}
                        onChange={(e) => handleFieldChange('age', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-bold transition-all"
                        placeholder="e.g. 32"
                      />
                    </div>
                  </div>

                  {/* Blood Group & Contact Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Blood Group
                      </label>
                      <select
                        value={member.bloodGroup}
                        onChange={(e) => handleFieldChange('bloodGroup', e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-bold transition-all"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone (10 Digits)
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        value={member.contact}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                          handleFieldChange('contact', val)
                        }}
                        className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                        placeholder="e.g. 7305171482"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Address (For Card Back)
                    </label>
                    <textarea
                      rows={2}
                      value={member.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="e.g. Anna Nagar, Chennai - 600040"
                    />
                  </div>

                  {/* Submit / Save Button */}
                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold px-8 py-3 rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                          <span>Uploading to Cloudinary &amp; Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>Save &amp; Register Member</span>
                          <span>&rarr;</span>
                        </>
                      )}
                    </button>

                    {savedSuccess && savedDetails && (
                      <div className="bg-gradient-to-br from-blue-50 to-emerald-50/50 border-2 border-emerald-500/80 rounded-2xl p-4.5 text-xs text-blue-900 space-y-3 animate-fadeIn shadow-lg shadow-emerald-500/10">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-extrabold text-emerald-800 flex items-center gap-1.5 text-sm">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">✓</span>
                            <span>Member Registered &amp; Cloudinary Synced!</span>
                          </span>
                          <span className="font-mono text-blue-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-xs text-xs">
                            {savedDetails.memberId}
                          </span>
                        </div>
                        <div className="text-slate-600 flex items-center justify-between flex-wrap gap-1">
                          <span>Cloudinary User Folder:</span>
                          <code className="text-emerald-900 font-mono font-bold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                            {savedDetails.cloudinaryFolder || `isydci/members/${savedDetails.name}`}
                          </code>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-emerald-200/60 flex items-center gap-1.5">
                          <span>✓</span> Full card auto-downloaded as <strong className="font-mono text-emerald-950 font-bold">{savedDetails.memberId}_card.png</strong> on transparent background.
                        </div>

                        {/* Interactive Buttons */}
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                          >
                            <span>👁️ View Full Card</span>
                          </button>
                          <button
                            type="button"
                            onClick={downloadBoth}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                            title={`Download ${savedDetails.memberId}_card.png`}
                          >
                            <span>⬇️ Download Full Card PNG</span>
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </form>

              </div>
            </div>

          </div>

          {/* ================= BOTTOM GUIDELINES & STANDARDS ================= */}
          <div className="mt-16 pt-12 border-t border-slate-200/80">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="text-blue-600 font-bold tracking-[3px] text-xs uppercase">
                Card Guidelines
              </span>
              <h3 className="text-[#0b1e3f] text-2xl sm:text-3xl font-extrabold mt-1.5 font-['Montserrat']">
                Official Membership Verification &amp; Standards
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xl mx-auto">
                Authorized sports campaign identification protocols for athletes, coaches, and registered youth members across India.
              </p>
            </div>

            <div className="max-w-[840px] mx-auto grid gap-4 sm:gap-5">
              {[
                {
                  tag: '1997',
                  title: 'Official Recognition Across India',
                  desc: 'ISYDCI digital membership cards are officially recognized across all sanctioned district, state, and national tournaments, training camps, and youth athletic trials.',
                },
                {
                  tag: 'SECURITY',
                  title: 'Tamper-Proof QR Code Verification',
                  desc: 'Every card features a scannable dynamic QR code linked directly to the central member registry database for instant on-field validation.',
                },
                {
                  tag: 'SPECIFICATION',
                  title: 'CR80 Portrait 300 DPI High-Resolution Standard',
                  desc: 'Precision formatted to official CR80 card specifications (340 × 540 px) with high-density 300 DPI output, ready for professional PVC card printing and digital passes.',
                },
                {
                  tag: '2026',
                  title: 'National Headquarters Backing & Registry',
                  desc: 'Issued by International Sports and Youth Development Campaign of India, Head Office at VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001.',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white/80 backdrop-blur-xl rounded-xl p-5 sm:p-6 border-l-[5px] border-blue-600 border border-slate-200/80 shadow-[0_10px_30px_rgba(11,30,63,.06)] transition-all hover:shadow-[0_14px_35px_rgba(11,30,63,.10)]"
                >
                  <span className="text-blue-600 font-extrabold font-['Montserrat'] tracking-wider text-xs uppercase">
                    {item.tag}
                  </span>
                  <h4 className="text-[#0b1e3f] font-bold text-base sm:text-lg mt-1 mb-1 font-['Montserrat']">
                    {item.title}
                  </h4>
                  <p className="text-slate-600 text-xs sm:text-sm m-0 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ================= HIDDEN COMBINED CARD FOR DUAL-SIDE PNG EXPORT (PLAIN TRANSPARENT BACKGROUND) ================= */}
          <div className="overflow-hidden h-0 opacity-0 pointer-events-none">
            <div
              ref={dualCardRef}
              className="inline-flex p-4 bg-transparent gap-6 items-center select-none"
              style={{ width: '740px', backgroundColor: 'transparent' }}
            >
              <CardFront ref={hiddenFrontRef} member={member} />
              <CardBack ref={hiddenBackRef} member={member} />
            </div>
          </div>

          {/* ================= PHOTO CROP MODAL (137x136) ================= */}
          <PhotoCropModal
            isOpen={cropModalOpen}
            imageSrc={cropImageSrc}
            onClose={() => setCropModalOpen(false)}
            onSave={handleCroppedPhotoSave}
          />

          {/* ================= TOP-RIGHT CORNER NOTIFICATION TOAST ================= */}
          {toastNotification && (
            <div className="fixed top-20 right-4 sm:right-6 z-[9999] max-w-sm sm:max-w-md w-[calc(100%-2rem)] bg-white/95 backdrop-blur-2xl border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(16,185,129,0.28)] animate-slideInRight transition-all text-slate-800">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0 shadow-xs ring-2 ring-emerald-200">
                    ✓
                  </span>
                  <div>
                    <h4 className="font-black text-[#0b1e3f] text-sm font-['Montserrat'] leading-tight">
                      Saved &amp; Registered!
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-blue-600">
                        {toastNotification.memberId}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                        Cloudinary Synced
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setToastNotification(null)}
                  className="text-slate-400 hover:text-slate-800 text-xl font-bold leading-none p-1 cursor-pointer transition-colors"
                  title="Close notification"
                >
                  &times;
                </button>
              </div>

              <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 text-xs space-y-1.5 mb-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Member Name:</span>
                  <span className="font-extrabold text-[#0b1e3f] uppercase truncate max-w-[190px]">
                    {toastNotification.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Cloudinary Folder:</span>
                  <span className="font-mono text-[10px] text-emerald-800 font-bold bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded truncate max-w-[210px]">
                    {toastNotification.cloudinaryFolder}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-bold pt-1.5 border-t border-slate-200/60">
                  <span className="text-emerald-600">✓</span>
                  <span>Front &amp; Back PNG auto-downloaded to your device</span>
                </div>
              </div>

              {/* Action Buttons in Toast: View Card & Download Full Card */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViewModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                >
                  <span>👁️ View Card</span>
                </button>
                <button
                  type="button"
                  onClick={downloadBoth}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                  title={toastNotification.downloadFilename || `${toastNotification.memberId}_card.png`}
                >
                  <span>⬇️ Download Card PNG</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= FULL HIGH-VISIBILITY VIEW ID CARDS MODAL ================= */}
          {viewModalOpen && (
            <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 flex flex-col gap-6 animate-fadeIn my-auto text-slate-800">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="ISYDCI" className="w-10 h-10 rounded-full border border-slate-200" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-[#0b1e3f] text-base sm:text-lg font-['Montserrat']">
                          Official Digital ID Cards
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Verified ID Card
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {savedDetails?.name || member.name} • {savedDetails?.memberId || member.memberId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="text-slate-400 hover:text-slate-800 text-2xl font-bold leading-none p-1 cursor-pointer transition-colors"
                    title="Close preview"
                  >
                    &times;
                  </button>
                </div>

                {/* Main Visual: Front Card & Back Card Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start justify-items-center">
                  {/* FRONT CARD */}
                  <div className="flex flex-col items-center gap-3 w-full max-w-[340px]">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="font-extrabold text-xs text-[#0b1e3f] uppercase tracking-wider">
                        1. Front Side (CR80)
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">300 DPI</span>
                    </div>

                    <div className="rounded-[24px] overflow-hidden shadow-2xl border border-slate-200/90 bg-white">
                      <CardFront member={savedDetails || member} />
                    </div>

                    <div className="w-full">
                      <button
                        type="button"
                        onClick={downloadFront}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <span>⬇️ Download Front PNG</span>
                      </button>
                    </div>
                  </div>

                  {/* BACK CARD */}
                  <div className="flex flex-col items-center gap-3 w-full max-w-[340px]">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="font-extrabold text-xs text-[#0b1e3f] uppercase tracking-wider">
                        2. Back Side (Terms &amp; QR)
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">300 DPI</span>
                    </div>

                    <div className="rounded-[24px] overflow-hidden shadow-2xl border border-slate-200/90 bg-white">
                      <CardBack member={savedDetails || member} />
                    </div>

                    <div className="w-full">
                      <button
                        type="button"
                        onClick={downloadBack}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <span>⬇️ Download Back PNG</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Official ID Record:</span>
                    <code className="text-[#0b1e3f] font-bold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {savedDetails?.memberId || member.memberId || 'ISYDCI'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={downloadBoth}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      title={`Download ${savedDetails?.memberId || member.memberId || 'ISYDCI'}_card.png`}
                    >
                      <span>⬇️ Download Full Card</span>
                      <span className="font-mono text-[11px] opacity-90 hidden sm:inline">({savedDetails?.memberId || member.memberId || 'ISYDCI'}_card.png)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewModalOpen(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>
      </section>
    </>
  )
}

// Interactive Crop Profile Photo Modal (137x136 Aspect Ratio, Touch & Mouse Drag Enabled)
function PhotoCropModal({ imageSrc, isOpen, onClose, onSave }) {
  const canvasRef = useRef(null)
  const cropBoxRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const stateRef = useRef({
    img: null,
    imgX: 0,
    imgY: 0,
    baseScale: 1,
    zoom: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isPinching: false,
    pinchStartDist: 0,
    pinchStartZoom: 1,
  })

  const CROP_BOX_W = 190
  const CROP_BOX_H = 188.6 // exact 137x136 proportion

  // Lock background page scroll while photo cropper modal is open
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [isOpen])

  const clampPosition = (img, imgX, imgY, baseScale, currentZoom) => {
    const currentScale = baseScale * currentZoom
    const drawW = img.width * currentScale
    const drawH = img.height * currentScale
    const boxLeft = (360 - CROP_BOX_W) / 2
    const boxTop = (310 - CROP_BOX_H) / 2
    const boxRight = boxLeft + CROP_BOX_W
    const boxBottom = boxTop + CROP_BOX_H

    let newX = imgX
    let newY = imgY

    if (drawW >= CROP_BOX_W) {
      if (newX > boxLeft) newX = boxLeft
      if (newX + drawW < boxRight) newX = boxRight - drawW
    } else {
      newX = (360 - drawW) / 2
    }

    if (drawH >= CROP_BOX_H) {
      if (newY > boxTop) newY = boxTop
      if (newY + drawH < boxBottom) newY = boxBottom - drawH
    } else {
      newY = (310 - drawH) / 2
    }

    return { x: newX, y: newY }
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !stateRef.current.img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const { img, imgX, imgY, baseScale, zoom: currentZoom } = stateRef.current
    const currentScale = baseScale * currentZoom
    ctx.drawImage(img, imgX, imgY, img.width * currentScale, img.height * currentScale)
  }

  useEffect(() => {
    if (!isOpen || !imageSrc) return
    const img = new Image()
    img.onload = () => {
      const scaleW = CROP_BOX_W / img.width
      const scaleH = CROP_BOX_H / img.height
      const baseScale = Math.max(scaleW, scaleH)
      const currentZoom = 1

      let imgX = (360 - img.width * baseScale) / 2
      let imgY = (310 - img.height * baseScale) / 2
      const clamped = clampPosition(img, imgX, imgY, baseScale, currentZoom)

      stateRef.current = {
        img,
        imgX: clamped.x,
        imgY: clamped.y,
        baseScale,
        zoom: currentZoom,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        isPinching: false,
        pinchStartDist: 0,
        pinchStartZoom: 1,
      }
      setZoom(1)
      drawCanvas()
    }
    img.src = imageSrc
  }, [isOpen, imageSrc])

  const handleZoom = (val) => {
    const newZoom = parseFloat(val)
    setZoom(newZoom)
    const oldZoom = stateRef.current.zoom
    stateRef.current.zoom = newZoom

    const centerX = 360 / 2
    const centerY = 310 / 2
    const ratio = newZoom / oldZoom

    let newX = centerX - (centerX - stateRef.current.imgX) * ratio
    let newY = centerY - (centerY - stateRef.current.imgY) * ratio

    const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, newZoom)
    stateRef.current.imgX = clamped.x
    stateRef.current.imgY = clamped.y
    drawCanvas()
  }

  // Touch Event Listeners with non-passive preventDefault so the mobile page NEVER scrolls
  useEffect(() => {
    if (!isOpen) return
    const el = cropBoxRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        stateRef.current.isDragging = true
        stateRef.current.dragStartX = e.touches[0].clientX - stateRef.current.imgX
        stateRef.current.dragStartY = e.touches[0].clientY - stateRef.current.imgY
      } else if (e.touches.length === 2) {
        stateRef.current.isPinching = true
        stateRef.current.pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        stateRef.current.pinchStartZoom = stateRef.current.zoom
      }
    }

    const onTouchMove = (e) => {
      if (e.cancelable) {
        e.preventDefault()
      }
      if (e.touches.length === 1 && stateRef.current.isDragging && stateRef.current.img) {
        const newX = e.touches[0].clientX - stateRef.current.dragStartX
        const newY = e.touches[0].clientY - stateRef.current.dragStartY
        const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, stateRef.current.zoom)
        stateRef.current.imgX = clamped.x
        stateRef.current.imgY = clamped.y
        drawCanvas()
      } else if (e.touches.length === 2 && stateRef.current.isPinching) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const ratio = dist / (stateRef.current.pinchStartDist || 1)
        const nextZoom = Math.min(3, Math.max(1, stateRef.current.pinchStartZoom * ratio))
        handleZoom(nextZoom)
      }
    }

    const onTouchEnd = () => {
      stateRef.current.isDragging = false
      stateRef.current.isPinching = false
    }

    const onWheel = (e) => {
      if (e.cancelable) e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      const nextZoom = Math.min(3, Math.max(1, stateRef.current.zoom + delta))
      handleZoom(nextZoom)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [isOpen])

  // Mouse handlers for desktop
  const handleMouseDown = (e) => {
    stateRef.current.isDragging = true
    stateRef.current.dragStartX = e.clientX - stateRef.current.imgX
    stateRef.current.dragStartY = e.clientY - stateRef.current.imgY
  }

  const handleMouseMove = (e) => {
    if (!stateRef.current.isDragging || !stateRef.current.img) return
    const newX = e.clientX - stateRef.current.dragStartX
    const newY = e.clientY - stateRef.current.dragStartY
    const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, stateRef.current.zoom)
    stateRef.current.imgX = clamped.x
    stateRef.current.imgY = clamped.y
    drawCanvas()
  }

  const handleMouseUp = () => {
    stateRef.current.isDragging = false
  }

  const handleCropAndSave = () => {
    const { img, imgX, imgY, baseScale, zoom: currentZoom } = stateRef.current
    if (!img) return

    const clamped = clampPosition(img, imgX, imgY, baseScale, currentZoom)
    const boxLeft = (360 - CROP_BOX_W) / 2
    const boxTop = (310 - CROP_BOX_H) / 2

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = 274
    outputCanvas.height = 272
    const outCtx = outputCanvas.getContext('2d')
    outCtx.imageSmoothingEnabled = true
    outCtx.imageSmoothingQuality = 'high'

    const currentScale = baseScale * currentZoom
    let srcX = (boxLeft - clamped.x) / currentScale
    let srcY = (boxTop - clamped.y) / currentScale
    let srcW = CROP_BOX_W / currentScale
    let srcH = CROP_BOX_H / currentScale

    if (srcX < 0) srcX = 0
    if (srcY < 0) srcY = 0
    if (srcX + srcW > img.width) srcW = img.width - srcX
    if (srcY + srcH > img.height) srcH = img.height - srcY

    outCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputCanvas.width, outputCanvas.height)
    const croppedUrl = outputCanvas.toDataURL('image/jpeg', 0.95)
    onSave(croppedUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ touchAction: 'none' }}
    >
      <div
        className="bg-[#111827] border border-white/15 rounded-2xl p-4 sm:p-5 max-w-[440px] w-full flex flex-col gap-3.5 shadow-2xl max-h-[96vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base font-['Montserrat']">Crop Profile Photo</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none p-1 cursor-pointer">&times;</button>
        </div>

        {/* Cropper Container with Touch Action None */}
        <div
          ref={cropBoxRef}
          className="relative w-full h-[310px] bg-black rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none flex items-center justify-center touch-none"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} width={360} height={310} className="block pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative rounded-lg border-2 border-white/90 shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]"
              style={{ width: `${CROP_BOX_W}px`, height: `${CROP_BOX_H}px` }}
            >
              {/* 3x3 Grid Lines */}
              <div className="absolute inset-0 border-l border-r border-white/40 left-1/3 right-1/3" />
              <div className="absolute inset-0 border-t border-b border-white/40 top-1/3 bottom-1/3" />
            </div>
          </div>
        </div>

        {/* Helpful Touch Gesture Hint */}
        <p className="text-[11px] text-center text-slate-400 font-medium -mt-1 select-none">
          👆 Drag photo to adjust position • Pinch or slider to zoom
        </p>

        {/* Zoom Controls with + / - Quick Buttons */}
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => handleZoom(Math.max(1, zoom - 0.2))}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">ZOOM</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => handleZoom(e.target.value)}
            className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <button
            type="button"
            onClick={() => handleZoom(Math.min(3, zoom + 0.2))}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Zoom in"
          >
            +
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropAndSave}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95"
          >
            CROP &amp; SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
