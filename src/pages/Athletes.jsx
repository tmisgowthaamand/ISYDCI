import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { members } from '../data/members.js'

const sportIcon = (s = '') => {
  const x = s.toLowerCase()
  if (x.includes('boxing')) return '🥊'
  if (x.includes('foot')) return '⚽'
  if (x.includes('skat')) return '🛼'
  if (x.includes('rifle') || x.includes('shoot')) return '🎯'
  if (x.includes('kabaddi')) return '🤼'
  if (x.includes('volley')) return '🏐'
  if (x.includes('crick')) return '🏏'
  if (x.includes('athlet') || x.includes('run')) return '🏃'
  if (x.includes('kho')) return '🏃'
  if (x.includes('raider')) return '🤼'
  if (x.includes('gymnast')) return '🤸'
  return '🏆'
}

export default function Athletes() {
  return (
    <>
      <PageHeader kicker="Our Athletes" title="Registered Members & Rising Talents" subtitle="Athletes enrolled under the ISYDCI member-registration programme." bg="/events/8.png" />

      <section className="bg-[#f7f2e2] py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          {/* Register CTA */}
          <div className="bg-navy rounded-2xl p-7 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <h3 className="text-white font-bold text-lg mb-1">Are you an athlete?</h3>
              <p className="text-white/60 text-sm">Register with ISYDCI and get access to elite training, competitions, and recognition.</p>
            </div>
            <Link to="/contact" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all shrink-0 whitespace-nowrap">
              Register Now →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {members.map(m => (
              <article key={m.id} className="group bg-white rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(11,30,63,.06)] hover:shadow-[0_12px_40px_rgba(11,30,63,.12)] transition-all duration-400 hover:-translate-y-1">
                <div className="flex flex-col sm:flex-row">
                  {/* Photo */}
                  <div className="relative sm:w-[220px] shrink-0 aspect-square sm:aspect-auto overflow-hidden">
                    {m.photo
                      ? <img src={m.photo} alt={m.name} loading="lazy" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                      : <div className="w-full h-full grid place-items-center text-[72px] bg-gradient-to-br from-green-50 to-green-100">{sportIcon(m.sport)}</div>}
                    <div className="absolute top-3 left-3 bg-navy/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold">
                      {m.gender === 'Female' ? '♀' : '♂'} {m.gender}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-heading text-navy text-[22px] font-extrabold leading-tight">{m.name}</h3>
                      <div className="flex items-center gap-2 mt-2 mb-4">
                        <span className="btn-gradient text-white text-xs font-bold px-3 py-1 rounded-full">{sportIcon(m.sport)} {m.sport}</span>
                        <span className="bg-navy/8 text-navy text-xs font-bold px-3 py-1 rounded-full">Age {m.age}</span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="w-7 h-7 rounded-full bg-[#f7f2e2] grid place-items-center text-[13px]">📍</span>
                          {m.state}
                        </div>
                        {m.medals && (
                          <div className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="w-7 h-7 rounded-full bg-[#f7f2e2] grid place-items-center text-[13px] shrink-0 mt-0.5">🏅</span>
                            <span>{m.medals}</span>
                          </div>
                        )}
                        {m.extra && (
                          <div className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="w-7 h-7 rounded-full bg-[#f7f2e2] grid place-items-center text-[13px] shrink-0 mt-0.5">⚡</span>
                            <span><b className="text-navy">Additional:</b> {m.extra}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-dashed border-slate-200">
                      <div className="flex gap-2 flex-wrap">
                        {m.sport.split(/[&,]/).map(s => s.trim()).filter(Boolean).map(s => (
                          <span key={s} className="bg-green-50 text-accent text-[11px] font-semibold px-2.5 py-1 rounded-full">{s}</span>
                        ))}
                        {m.medals && m.medals.includes('National') && (
                          <span className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">🔥 National Level</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
