import PageHeader from '../components/PageHeader.jsx'

export default function About() {
  return (
    <>
      <PageHeader kicker="About Us" title="More Than an Organization — It Is a Movement." subtitle="Revolutionizing India's sports ecosystem since 1997." bg="/events/7.png" />

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-15 items-center">
          <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(11,30,63,.08)] aspect-[4/3]">
            <img src="/events/9.png" alt="Athletes training" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Our Mission</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2 mb-4">Identifying Untapped Potential. Delivering Elite Resources.</h2>
            <p className="text-slate-700 text-base leading-relaxed mb-3">
              The <b>International Sports and Youth Development Campaign of India (ISYDCI)</b> is
              committed to revolutionizing the national sports ecosystem by identifying untapped
              potential and providing the elite resources necessary to compete at the highest levels.
            </p>
            <p className="text-slate-700 text-base leading-relaxed">
              From the grassroots to the global arena, we build pathways that transform grit and raw
              talent into world-class performance — irrespective of background, caste, or income.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {['Ecosystem','Untapped Potential','Unyielding Spirit','Elite Resources','Nation First'].map(t => (
                <span key={t} className="bg-green-50 text-accent px-3 py-1.5 rounded-full text-xs font-semibold">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f2e2] py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">What We Stand For</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2">Our Core Values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { i: '🏆', t: 'Excellence', d: 'Relentless pursuit of world-class standards in every discipline.' },
              { i: '🤝', t: 'Inclusion', d: 'No athlete left behind because of poverty or circumstance.' },
              { i: '🛡️', t: 'Integrity', d: 'Transparent governance in every rupee spent and every decision made.' },
              { i: '🔥', t: 'Grit', d: 'The unyielding spirit that defines Indian athletes.' },
            ].map(v => (
              <div key={v.t} className="bg-white border border-slate-200 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(11,30,63,.08)]">
                <div className="text-4xl mb-3">{v.i}</div>
                <h3 className="text-navy text-lg font-bold mb-2">{v.t}</h3>
                <p className="text-slate-600 text-sm m-0">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
