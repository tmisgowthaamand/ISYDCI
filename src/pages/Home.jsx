import { Link } from 'react-router-dom'
import { galleryImages } from '../data/site.js'
import { members } from '../data/members.js'

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-screen min-h-[100dvh] flex flex-col justify-center items-center text-white overflow-hidden bg-[linear-gradient(120deg,rgba(11,30,63,.45),rgba(18,42,87,.35)),url('/events/10.png')] bg-cover bg-center">
        <div className="relative text-center max-w-[1000px] w-full px-5 pt-28 pb-16 my-auto flex flex-col items-center">
          <span className="inline-block px-3.5 py-1.5 rounded-full bg-white/10 border border-white/25 text-xs tracking-[2px] uppercase mb-4 sm:mb-5">
            Since 1997 • A National Movement
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight">
            Building the Future of <span className="text-gradient">Indian Sports</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg opacity-90 max-w-3xl mx-auto mt-4 sm:mt-5 mb-7 sm:mb-8">
            More than an organization — a movement to revolutionize India's sports ecosystem,
            identify untapped potential, and provide elite resources so every athlete can compete at the highest level.
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap">
            <Link to="/about" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2">Discover Our Mission →</Link>
            <Link to="/athletes" className="border-2 border-white text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-white hover:text-navy transition-all inline-flex items-center gap-2">Meet Our Athletes</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mt-8 sm:mt-12 md:mt-14 w-full max-w-4xl bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5">
            <div className="text-center"><strong className="block font-heading text-2xl sm:text-3xl font-black text-[#a8e6b4]">28+</strong><span className="text-[11px] sm:text-xs opacity-85 tracking-wider">YEARS OF IMPACT</span></div>
            <div className="text-center"><strong className="block font-heading text-2xl sm:text-3xl font-black text-[#a8e6b4]">5</strong><span className="text-[11px] sm:text-xs opacity-85 tracking-wider">STRATEGIC PILLARS</span></div>
            <div className="text-center"><strong className="block font-heading text-2xl sm:text-3xl font-black text-[#a8e6b4]">100+</strong><span className="text-[11px] sm:text-xs opacity-85 tracking-wider">EVENTS HOSTED</span></div>
            <div className="text-center"><strong className="block font-heading text-2xl sm:text-3xl font-black text-[#a8e6b4]">∞</strong><span className="text-[11px] sm:text-xs opacity-85 tracking-wider">UNTAPPED POTENTIAL</span></div>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="bg-[#0b1e3f] py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(47,158,68,.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-5 relative">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
            <div>
              <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Upcoming Events</span>
              <h2 className="text-white text-3xl md:text-4xl font-black font-heading mt-1">2 Events This October</h2>
            </div>
            <span className="bg-red-600 text-white text-[11px] font-bold tracking-[2px] uppercase py-1.5 px-4 rounded-full">
              ⚡ Snooker entries close 24 Sep 2026
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* — SNOOKER 2026 — */}
            <div className="bg-white/4 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <img src="/snooker/announcement.png" alt="Tamil Nadu Snooker 2026" className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1e3f] via-[#0b1e3f]/40 to-transparent" />
                <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Entries close 24 Sep</span>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <h3 className="text-white text-2xl font-black font-heading mb-1">Tamil Nadu <span className="text-gradient">Snooker</span> 2026</h3>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-5">The Open State Championship · Chennai</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Date', value: '01 – 04 Oct 2026' },
                    { label: 'Venue', value: "Killer's Cue, Arumbakkam" },
                    { label: 'Entry Fee', value: '₹2,000 / Player' },
                    { label: 'Format', value: '64-Player Knockout' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
                      <span className="text-white/40 text-[10px] uppercase tracking-widest block mb-0.5">{label}</span>
                      <span className="text-white font-semibold text-sm">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3">Prize Pool · ₹1,50,000</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[['₹60K','Champion'],['₹35K','Runner-up'],['₹10K','Highest Break']].map(([a,t]) => (
                      <div key={t}><strong className="block num-gradient font-black font-heading text-lg">{a}</strong><span className="text-white/40 text-[10px]">{t}</span></div>
                    ))}
                  </div>
                </div>
                <h4 className="text-white font-bold text-sm mb-3">How to Register</h4>
                <ol className="space-y-2 mb-6 flex-1">
                  {['Scan QR & pay ₹2,000 on any UPI app','Screenshot the UTR / reference number','WhatsApp it + name, age, city & club','Receive your draw number before 27 Sep'].map((s,i) => (
                    <li key={i} className="flex gap-2.5 text-white/65 text-sm items-start">
                      <span className="btn-gradient text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>{s}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <img src="/snooker/entry-card.png" alt="QR" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  <div className="flex flex-col gap-2 justify-center">
                    <a href="/snooker/pamphlet.pdf" target="_blank" rel="noopener noreferrer"
                      className="border border-white/20 text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-white/10 transition-all">
                      Download Pamphlet ↓
                    </a>
                    <p className="text-white/25 text-[10px]">Maha Seva Dal Foundation · Axis Bank</p>
                  </div>
                </div>
              </div>
            </div>

            {/* — RSS CLASSIC 2026 — */}
            <div className="bg-white/4 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <img src="/rss-classic/poster.jpg" alt="RSS Classic 2026" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1e3f] via-[#0b1e3f]/40 to-transparent" />
                <span className="absolute top-3 left-3 bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Upcoming</span>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <h3 className="text-white text-2xl font-black font-heading mb-1">RSS <span className="text-gradient">Classic</span> 2026</h3>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-5">Bodybuilding Championship · Tamil Nadu · Organised by NBA · Affiliated by ISYDCI</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Date', value: '18 October 2026' },
                    { label: 'Venue', value: 'Tamil Nadu' },
                    { label: 'Entry Fee', value: '₹5,000 / Player' },
                    { label: 'Presenter', value: 'Stay Strong Gym' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
                      <span className="text-white/40 text-[10px] uppercase tracking-widest block mb-0.5">{label}</span>
                      <span className="text-white font-semibold text-sm">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-3">Cash Prize Per Category</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[['₹5,000','1st'],['₹3,000','2nd'],['₹2,000','3rd']].map(([a,t]) => (
                      <div key={t}><strong className="block num-gradient font-black font-heading text-lg">{a}</strong><span className="text-white/40 text-[10px]">{t} Place</span></div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-3 text-center">
                    <strong className="num-gradient font-black font-heading text-xl">₹1,00,000</strong>
                    <span className="text-white/40 text-[10px] block">Champion of Champion</span>
                  </div>
                </div>
                <div className="mb-5">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Weight Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['55kg','60kg','65kg','70kg','75kg','80kg','85kg','90kg','95kg','100kg','100+kg'].map(c => (
                      <span key={c} className="bg-white/8 border border-white/10 text-white/60 text-[10px] px-2.5 py-1 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-auto space-y-1.5 text-xs text-white/50 mb-5">
                  <p>Kesavan (ISYDCI TN Secretary) · <a href="tel:+919600154537" className="text-accent hover:underline">9600154537</a></p>
                  <p>Sairam (NBA TN Secretary) · <a href="tel:+919840813870" className="text-accent hover:underline">+91 98408 13870</a></p>
                  <p>Vinoth (Stay Strong Gym) · <a href="tel:+919884648936" className="text-accent hover:underline">98846 48936</a></p>
                </div>
                <Link to="/gallery" className="btn-gradient text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all text-center">
                  View Full Details →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ABOUT PREVIEW */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-15 items-center">
          <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(11,30,63,.08)] aspect-[4/3]">
            <img src="/events/7.png" alt="ISYDCI athletes" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">About ISYDCI</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2 mb-4">More Than an Organization — It Is a Movement.</h2>
            <p className="text-slate-700 text-base leading-relaxed">
              The <b>International Sports and Youth Development Campaign of India</b> is committed to
              revolutionizing the national sports ecosystem by identifying untapped potential and
              providing the elite resources necessary to compete at the highest levels.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {['Ecosystem','Untapped Potential','Unyielding Spirit','Elite Resources','Nation First'].map(t => (
                <span key={t} className="bg-green-50 text-accent px-3 py-1.5 rounded-full text-xs font-semibold">{t}</span>
              ))}
            </div>
            <div className="mt-6">
              <Link to="/about" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2">Read More →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* OUR ATHLETES */}
      <section className="bg-[#f7f2e2] py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Rising Stars</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2">Our Athletes</h2>
            <p className="text-slate-500 mt-3">Meet the talented young athletes enrolled under the ISYDCI programme.</p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-4 sm:gap-10 md:gap-16">
            {members.filter(m => m.photo).map(m => (
              <Link to="/athletes" key={m.id} className="group flex flex-col items-center gap-2.5 sm:gap-3">
                <div className="w-28 h-28 xs:w-36 xs:h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-[3px] border-navy/15 shadow-[0_8px_30px_rgba(11,30,63,.1)] transition-all duration-300 group-hover:border-accent group-hover:shadow-[0_8px_30px_rgba(47,158,68,.25)] group-hover:-translate-y-1">
                  <img src={m.photo} alt={m.name} className="w-full h-full object-cover object-top" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-navy text-sm block">{m.name}</span>
                  <span className="text-xs text-slate-500">{m.sport}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/athletes" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2">View All Athletes →</Link>
          </div>
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">On Ground</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2">Recent Events</h2>
            <p className="text-slate-500 mt-3">Snapshots from training camps, tournaments and community drives.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
            {galleryImages.slice(0, 6).map((g, i) => (
              <Link to="/gallery" key={i} className="group relative overflow-hidden rounded-xl aspect-video shadow-[0_10px_30px_rgba(11,30,63,.08)] bg-gray-200">
                <img src={g.src} alt={g.label} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="absolute left-3.5 bottom-3 text-white font-semibold text-[13px] opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300 z-10">{g.label}</span>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/gallery" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2">View Full Gallery →</Link>
          </div>
        </div>
      </section>
    </>
  )
}
