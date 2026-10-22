import { useEffect, useState, forwardRef } from 'react'
import QRCode from 'qrcode'

// High-fidelity ID Card Front
export const CardFront = forwardRef(function CardFront({ member, className = '' }, ref) {
  const {
    name = '',
    leaderPhoto = '/events/1.png',
    leaderName = 'Visanath Shetty',
    state = '',
    district = '',
    assembly = '',
    zone = '',
    memberId = '',
    regNo = '49/1997',
    orgTamil = 'அகில இந்திய விளையாட்டு & இளைஞர் மேம்பாட்டு இயக்கம்',
    orgName = 'INTERNATIONAL SPORTS & YOUTH DEVELOPMENT CAMPAIGN',
    address = 'எண் 5/79, சீனிவாச பெருமாள் கோயில் தெரு, சென்னை-600128',
    phone = '+91-99946 27551',
    website = 'www.isydci.org',
    email = 'support@isydci.org',
    addressHQ = 'VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001',
  } = member || {}

  // Records saved from WhatsApp / admin carry `photoUrl`; web registrations carry `photo`. Accept both.
  const photo = (member && (member.photo || member.photoUrl)) || ''

  return (
    <div
      ref={ref}
      className={`relative w-[340px] h-[540px] rounded-[24px] bg-white overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-200/90 select-none ${className}`}
      style={{
        boxShadow: '0 20px 45px -10px rgba(11, 30, 63, 0.2), 0 0 0 1px rgba(11, 30, 63, 0.08)',
        fontFamily: "'Poppins', sans-serif"
      }}
    >
      {/* ================= TOP HEADER (WHITE THEME) ================= */}
      <div className="relative w-full h-[105px] bg-white overflow-hidden shrink-0 border-b border-slate-100">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 340 105"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M-20,50 C60,82 140,26 240,60 C290,78 320,58 360,50 L360,105 L-20,105 Z" fill="rgba(11, 30, 63, 0.04)" />
          <path d="M-10,65 C70,92 150,42 250,68 C295,80 325,66 360,60 L360,80 C320,86 285,96 245,84 C150,56 75,102 -10,84 Z" fill="#0b1e3f" />
          <path d="M-10,84 C80,104 160,60 260,86 C300,98 330,86 360,80 L360,105 L-10,105 Z" fill="#ffffff" />
          <path d="M-10,63 C70,90 150,40 250,66 C295,78 325,64 360,58" stroke="#f59e0b" strokeWidth="2.5" />
        </svg>

        {/* Left Official Logo - Enhanced Size & Clarity */}
        <div className="absolute left-3 bottom-2 z-20 flex items-center">
          <div className="w-[62px] h-[62px] rounded-full p-[1.5px] bg-white shadow-lg ring-2 ring-[#0b1e3f] flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="ISYDCI Logo"
              className="w-full h-full object-contain rounded-full"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
        </div>

        {/* Header Texts (English Only) */}
        <div className="relative z-10 pt-2 px-2 pl-[74px] text-center">
          <h1 className="text-[#0b1e3f] text-[10.5px] font-extrabold tracking-tight leading-tight font-['Montserrat'] uppercase">
            {orgName}
          </h1>
        </div>
      </div>

      {/* ================= MIDDLE MEMBER DETAILS ================= */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-1 z-10 bg-white">
        {/* Exact 137x136 Photo Frame (Zero Gap, No Tick Mark) */}
        <div className="relative mb-1 shrink-0">
          <div className="w-[137px] h-[136px] rounded-[16px] p-0 bg-[#0b1e3f] border-[2.5px] border-[#0b1e3f] shadow-md overflow-hidden">
            {photo ? (
              <img
                src={photo}
                alt={name || 'Member'}
                className="w-full h-full object-cover rounded-[13.5px] block"
                onError={(e) => {
                  e.target.src = '/athletes/1.png'
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                <svg className="w-10 h-10 fill-slate-300" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <span className="text-[9px] font-bold mt-1 text-slate-500">137 × 136 PHOTO</span>
              </div>
            )}
          </div>
        </div>

        {/* Member Full Name */}
        <h2 className="text-[#0b1e3f] text-[16px] font-black tracking-wide uppercase text-center leading-tight font-['Montserrat'] px-2 min-h-[20px]">
          {name || ''}
        </h2>

        {/* Badges / State / District / Assembly / Zone */}
        <div className="mt-0.5 flex flex-col items-center gap-0.5 w-full">
          {/* State (Capital Case) */}
          {state ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 leading-tight">
              <span className="tracking-wide uppercase">{state.toUpperCase()}</span>
              <span className="bg-[#0b1e3f] text-white text-[8.5px] font-extrabold px-1.5 py-0.2 rounded tracking-wide uppercase">
                STATE
              </span>
            </div>
          ) : null}

          {/* District (Capital Case) */}
          {district ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 leading-tight">
              <span className="tracking-wide uppercase">{district.toUpperCase()}</span>
              <span className="bg-[#0b1e3f] text-white text-[8.5px] font-extrabold px-1.5 py-0.2 rounded tracking-wide uppercase">
                DIST
              </span>
            </div>
          ) : null}

          {/* Assembly (Title Case) */}
          {assembly ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 leading-tight">
              <span className="capitalize">{assembly.toLowerCase().replace(/(?:^|\s|-|\/)\S/g, m => m.toUpperCase())}</span>
              <span className="bg-[#0b1e3f] text-white text-[8.5px] font-extrabold px-1.5 py-0.2 rounded tracking-wide uppercase">
                ASSM
              </span>
            </div>
          ) : null}

          {/* Zone (Capital Case) */}
          {zone ? (
            <div className="text-[10px] font-extrabold text-slate-900 tracking-wider uppercase leading-tight">
              {zone.toUpperCase()}
            </div>
          ) : null}

          {/* Member Card ID */}
          {memberId ? (
            <div className="mt-0.5 bg-slate-50 border border-slate-300 px-3 py-0.5 rounded-md">
              <span className="text-[12px] font-black text-[#0b1e3f] tracking-wider font-mono">
                {memberId}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ================= BOTTOM FOOTER (WHITE THEME) ================= */}
      <div className="relative w-full h-[95px] bg-white border-t border-slate-100 shrink-0 overflow-hidden flex flex-col justify-end pb-2.5 px-3 text-center">
        <svg
          className="absolute top-0 left-0 right-0 w-full h-[22px] pointer-events-none"
          viewBox="0 0 340 22"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M-10,0 L350,0 L350,6 C280,16 190,4 100,12 C50,16 10,12 -10,10 Z" fill="#0b1e3f" />
          <path d="M-10,8 C60,14 140,5 240,14 C290,10 330,5 350,3" stroke="#f59e0b" strokeWidth="2" />
          <path d="M-10,10 C60,16 140,7 240,16 C290,11 330,7 350,5 L350,22 L-10,22 Z" fill="#ffffff" />
        </svg>

        {/* Footer Content */}
        <div className="relative z-10 pt-1.5 pb-0.5">
          <div className="text-[#0b1e3f] text-[9.5px] font-extrabold tracking-wider uppercase">
            NATIONAL HEADQUARTERS
          </div>
          <div className="text-slate-800 text-[8.5px] font-semibold leading-tight mt-0.5">
            {addressHQ}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1 text-[8px] text-[#0b1e3f] font-semibold tracking-tight">
            <span>{phone}</span>
            <span>•</span>
            <span className="underline">{website}</span>
            <span>•</span>
            <span>{email}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

// High-fidelity ID Card Back
export const CardBack = forwardRef(function CardBack({ member, className = '' }, ref) {
  const {
    dob = '',
    age = '',
    bloodGroup = 'A+',
    state = '',
    sport = 'ATHLETICS & SPORTS',
    address = '',
    contact = '',
    memberId = '',
    presidentName = 'VISANATH SHETTY',
    presidentRole = 'Founder & State / National President',
    orgName = 'Tamilnadu & National Sports Campaign',
    disclaimer = '"This card is the property of International Sports & Youth Development Campaign of India. If found, please return it to the provided address."',
  } = member || {}

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

  useEffect(() => {
    const codeId = memberId || 'ISYDCI-MEMBER'
    const origin = typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file:')
      ? window.location.origin
      : 'http://localhost:5173'
    const payload = `${origin}/membership-card?id=${encodeURIComponent(codeId)}`
    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('QR code generation error:', err))
  }, [memberId])

  return (
    <div
      ref={ref}
      className={`relative w-[340px] h-[540px] rounded-[24px] bg-white overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-200/90 select-none ${className}`}
      style={{
        boxShadow: '0 20px 45px -10px rgba(11, 30, 63, 0.2), 0 0 0 1px rgba(11, 30, 63, 0.08)',
        fontFamily: "'Poppins', sans-serif"
      }}
    >

      {/* ================= TOP SWOOSH HEADER (WHITE THEME) ================= */}
      <div className="relative w-full h-[115px] bg-white border-b border-slate-100 overflow-hidden shrink-0">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 340 115"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M-10,35 C80,60 160,20 260,65 C305,80 335,62 360,55 L360,82 C320,90 285,102 245,86 C150,52 75,108 -10,82 Z" fill="#0b1e3f" />
          <path d="M-10,37 C80,62 160,22 260,67 C305,82 335,64 360,57" stroke="#f59e0b" strokeWidth="2" />
          <path d="M-10,75 C70,105 170,40 270,85 C310,100 335,90 360,80 L360,118 L-10,118 Z" fill="#ffffff" />
        </svg>

        {/* Top-Left Circular Logo Badge - Enhanced Size & Clarity */}
        <div className="absolute top-2 left-3 z-20">
          <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-white shadow-xl ring-2 ring-[#0b1e3f] flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-full h-full object-contain rounded-full"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
        </div>

        <div className="absolute top-3.5 right-4 z-10 text-right pl-[80px]">
          <div className="text-[#0b1e3f] text-[11px] font-extrabold tracking-wide">
            ISYDCI MEMBERSHIP CARD
          </div>
          <div className="text-slate-500 text-[9px] font-semibold">
            OFFICIAL MEMBER IDENTITY
          </div>
        </div>
      </div>

      {/* ================= MIDDLE INFORMATION ROWS (SPORT/ROLE/STATE REMOVED) ================= */}
      <div className="relative z-10 flex-1 px-6 pt-3.5 pb-1 flex flex-col justify-between bg-white">
        <div className="space-y-3.5 text-[12.5px] text-slate-900">
          {/* DOB */}
          <div className="grid grid-cols-[108px_12px_1fr] items-center">
            <span className="font-bold tracking-wider text-slate-600 text-[11.5px] uppercase">
              DATE OF BIRTH
            </span>
            <span className="font-bold text-[#0b1e3f]">:</span>
            <span className="font-extrabold text-slate-900">{dob || '—'}</span>
          </div>

          {/* Age */}
          <div className="grid grid-cols-[108px_12px_1fr] items-center">
            <span className="font-bold tracking-wider text-slate-600 text-[11.5px] uppercase">
              AGE
            </span>
            <span className="font-bold text-[#0b1e3f]">:</span>
            <span className="font-extrabold text-slate-900">{age || '—'}</span>
          </div>

          {/* Blood Group */}
          <div className="grid grid-cols-[108px_12px_1fr] items-center">
            <span className="font-bold tracking-wider text-slate-600 text-[11.5px] uppercase">
              BLOOD GROUP
            </span>
            <span className="font-bold text-[#0b1e3f]">:</span>
            <span className="font-black text-rose-700 text-[13.5px]">{bloodGroup || 'A+'}</span>
          </div>

          {/* Address */}
          <div className="grid grid-cols-[108px_12px_1fr] items-start">
            <span className="font-bold tracking-wider text-slate-600 text-[11.5px] uppercase pt-0.5">
              ADDRESS
            </span>
            <span className="font-bold text-[#0b1e3f] pt-0.5">:</span>
            <span className="font-semibold text-slate-800 text-[12px] leading-snug break-words">
              {address || '—'}
            </span>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-[108px_12px_1fr] items-center">
            <span className="font-bold tracking-wider text-slate-600 text-[11.5px] uppercase">
              CONTACT
            </span>
            <span className="font-bold text-[#0b1e3f]">:</span>
            <span className="font-extrabold text-slate-900 tracking-wide text-[13px] font-mono">
              {contact || '—'}
            </span>
          </div>
        </div>

        {/* Divider & Signature + QR Section */}
        <div className="mt-auto pt-3.5 pb-2 flex items-end justify-between border-t border-dashed border-slate-200">
          {/* QR Code Container */}
          <div className="flex flex-col items-center">
            <div className="w-[84px] h-[84px] bg-white p-1 rounded-lg border border-slate-300 shadow-sm flex items-center justify-center">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
              )}
            </div>
            <span className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-wider">
              SCAN TO VERIFY
            </span>
          </div>

          {/* Signature & Authority */}
          <div className="flex flex-col items-center text-center max-w-[160px]">
            {/* Elegant Signature Drawing SVG */}
            <div className="h-[36px] w-[130px] flex items-center justify-center mb-0.5">
              <svg viewBox="0 0 160 40" className="w-full h-full text-[#0b1e3f] stroke-current" fill="none">
                <path
                  d="M10 28 C 30 10, 45 35, 60 15 C 75 -2, 85 38, 95 18 C 105 2, 110 25, 125 15 C 135 10, 145 28, 155 20 M20 22 L140 22"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="font-['Montserrat'] font-black text-[#0b1e3f] text-[11.5px] tracking-wide uppercase">
              {presidentName}
            </div>
            <div className="text-[9px] font-bold text-slate-600 leading-tight">
              {presidentRole}
            </div>
            <div className="text-[8px] font-medium text-slate-500 leading-tight mt-0.5">
              {orgName}
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM FOOTER WITH DISCLAIMER (WHITE THEME) ================= */}
      <div className="relative w-full rounded-b-[24px] bg-slate-50 border-t-2 border-[#0b1e3f] text-slate-700 p-3 text-center shrink-0">
        <p className="text-[9.5px] font-medium leading-relaxed italic px-1 text-slate-700">
          {disclaimer}
        </p>
      </div>
    </div>
  )
})

// Flip Card Container with 3D animation
export default function MembershipCard({
  member,
  frontRef,
  backRef,
  flipped = false,
  onFlip,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center max-w-full overflow-hidden ${className}`}>
      {/* 3D Flip Card Container with responsive scale on narrow mobile devices */}
      <div className="w-full flex justify-center py-1 overflow-x-hidden">
        <div
          className="w-[340px] h-[540px] shrink-0 cursor-pointer group select-none origin-top max-[365px]:scale-[0.88] max-[385px]:scale-[0.94] transition-transform"
          onClick={onFlip}
          title="Click to flip card"
          style={{ perspective: '1200px' }}
        >
        <div
          className="relative w-full h-full transition-transform duration-700 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 w-full h-full backface-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(1px)',
              opacity: flipped ? 0 : 1,
              pointerEvents: flipped ? 'none' : 'auto',
              transition: 'opacity 0.2s ease-in-out 0.15s',
            }}
          >
            <CardFront ref={frontRef} member={member} />
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 w-full h-full backface-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(1px)',
              opacity: flipped ? 1 : 0,
              pointerEvents: flipped ? 'auto' : 'none',
              transition: 'opacity 0.2s ease-in-out 0.15s',
            }}
          >
            <CardBack ref={backRef} member={member} />
          </div>
        </div>
      </div>
    </div>

      {/* Flip Prompt Hint below card */}
      <button
        type="button"
        onClick={onFlip}
        className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors py-1 px-3.5 rounded-full bg-slate-200/70 hover:bg-slate-200 cursor-pointer shadow-xs"
      >
        <span>⮀</span>
        <span>{flipped ? 'Click card to see front side' : 'Click card to flip & see back side'}</span>
      </button>
    </div>
  )
}
