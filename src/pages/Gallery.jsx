import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { galleryImages } from '../data/site.js'

function GalleryCard({ src, label, onClick }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div onClick={onClick} className="group relative overflow-hidden rounded-xl aspect-video shadow-[0_10px_30px_rgba(11,30,63,.08)] cursor-pointer bg-slate-200">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-xl" />
      )}
      <img
        src={src} alt={label} loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="absolute left-3.5 bottom-3 text-white font-semibold text-[13px] opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300 z-10">{label}</span>
    </div>
  )
}

export default function Gallery() {
  const [active, setActive] = useState(null)
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && setActive(null)
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      <PageHeader kicker="On Ground" title="Events" subtitle="Upcoming tournaments and moments from training camps, competitions and community drives across India." bg="/events/6.png" />

      {/* UPCOMING EVENTS */}
      <section className="bg-[#0b1e3f] py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex items-center gap-4 mb-10">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Upcoming</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Snooker 2026 featured card */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-8 bg-white/4 border border-white/10 rounded-2xl overflow-hidden">
            {/* Left: info */}
            <div className="p-7 md:p-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Upcoming</span>
                <span className="text-white/40 text-xs">ISYDCI Sanctioned</span>
              </div>
              <h2 className="text-white text-2xl md:text-3xl font-black font-heading mb-1">
                Tamil Nadu <span className="text-gradient">Snooker</span> 2026
              </h2>
              <p className="text-white/50 text-sm mb-6">The Open State Championship · Chennai, Tamil Nadu</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                {[
                  { label: 'Dates', value: '01 – 04 Oct 2026' },
                  { label: 'Venue', value: "Killer's Cue, Chennai" },
                  { label: 'Entry Fee', value: '₹2,000' },
                  { label: 'Prize Pool', value: '₹1,50,000' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest block mb-0.5">{label}</span>
                    <span className="text-white font-semibold text-sm">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { amount: '₹60K', title: 'Champion' },
                  { amount: '₹35K', title: 'Runner-up' },
                  { amount: '₹10K', title: 'Highest Break' },
                ].map(({ amount, title }) => (
                  <div key={title} className="bg-white/5 rounded-lg px-3 py-2 text-center min-w-[80px]">
                    <strong className="block num-gradient font-black font-heading text-base">{amount}</strong>
                    <span className="text-white/40 text-[10px]">{title}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setActive('/snooker/pamphlet.png')}
                  className="btn-gradient text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all">
                  View Details
                </button>
                <a href="/snooker/pamphlet.pdf" target="_blank" rel="noopener noreferrer"
                  className="border border-white/25 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all">
                  Download Pamphlet ↓
                </a>
              </div>

              <p className="text-white/25 text-[11px] mt-4">Entries close 24 Sep 2026 · 64 seats only · First paid, first confirmed</p>
            </div>

            {/* Right: announcement image */}
            <div className="hidden lg:block relative overflow-hidden">
              <img
                src="/snooker/announcement.png"
                alt="Tamil Nadu Snooker 2026"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          {/* RSS Classic card */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-8 bg-white/4 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-7 md:p-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Upcoming</span>
                <span className="text-white/40 text-xs">ISYDCI Affiliated · Organised by NBA</span>
              </div>
              <h2 className="text-white text-2xl md:text-3xl font-black font-heading mb-1">
                RSS <span className="text-gradient">Classic</span> 2026
              </h2>
              <p className="text-white/50 text-sm mb-6">Bodybuilding Championship · Presented by Stay Strong Gym · Tamil Nadu</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                {[
                  { label: 'Date', value: '18 October 2026' },
                  { label: 'Venue', value: 'Tamil Nadu' },
                  { label: 'Entry Fee', value: '₹5,000' },
                  { label: 'Champion Prize', value: '₹1,00,000' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest block mb-0.5">{label}</span>
                    <span className="text-white font-semibold text-sm">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <p className="text-white/40 text-[11px] uppercase tracking-widest mb-2">Weight Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {['55kg','60kg','65kg','70kg','75kg','80kg','85kg','90kg','95kg','100kg','100+kg'].map(c => (
                    <span key={c} className="bg-white/8 border border-white/10 text-white/70 text-[11px] px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { amount: '₹5,000', title: '1st / Category' },
                  { amount: '₹3,000', title: '2nd / Category' },
                  { amount: '₹2,000', title: '3rd / Category' },
                ].map(({ amount, title }) => (
                  <div key={title} className="bg-white/5 rounded-lg px-3 py-2 text-center min-w-[80px]">
                    <strong className="block num-gradient font-black font-heading text-base">{amount}</strong>
                    <span className="text-white/40 text-[10px]">{title}</span>
                  </div>
                ))}
              </div>

              <div className="text-white/50 text-xs space-y-1 mb-5">
                <p><span className="text-white/30">Kesavan (ISYDCI TN Secretary)</span> · 9600154537</p>
                <p><span className="text-white/30">Sairam (NBA TN Secretary)</span> · +91 98408 13870</p>
                <p><span className="text-white/30">Vinoth (Stay Strong Gym)</span> · 98846 48936</p>
              </div>

              <button onClick={() => setActive('/rss-classic/poster.jpg')}
                className="btn-gradient text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all">
                View Poster
              </button>
            </div>

            <div className="hidden lg:block relative overflow-hidden">
              <img src="/rss-classic/poster.jpg" alt="RSS Classic 2026"
                className="w-full h-full object-cover object-top" />
            </div>
          </div>
        </div>
      </section>

      {/* PAST EVENTS */}
      <section className="bg-[#f7f2e2] py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex items-center gap-4 mb-10">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Past Events</span>
            <div className="flex-1 h-px bg-navy/10" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
            {galleryImages.map((g, i) => (
              <GalleryCard key={i} src={g.src} label={g.label} onClick={() => setActive(g.src)} />
            ))}
          </div>
        </div>
      </section>

      {/* LIGHTBOX */}
      {active && (
        <div className="fixed inset-0 bg-slate-950/92 z-[100] grid place-items-center p-5" onClick={() => setActive(null)}>
          <button onClick={() => setActive(null)} className="absolute top-5 right-6 bg-white/10 border border-white/30 text-white w-11 h-11 rounded-full text-xl cursor-pointer">✕</button>
          <img src={active} alt="event" className="max-w-[92vw] max-h-[90vh] rounded-xl" />
        </div>
      )}
    </>
  )
}
