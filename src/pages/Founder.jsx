import PageHeader from '../components/PageHeader.jsx'

export default function Founder() {
  return (
    <>
      <PageHeader kicker="The Legacy" title="From the Ring to the World Stage" subtitle="The vision of Visanath Shetty — founder of ISYDCI." bg="/events/11.png" />

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(11,30,63,.08)] relative">
            <img src="/events/1.png" alt="Visanath Shetty" className="w-full h-full object-cover" />
            <div className="absolute bottom-5 left-5 right-5 bg-black/45 p-3.5 rounded-xl backdrop-blur-md text-white">
              <strong className="font-heading text-xl block">Visanath Shetty</strong>
              <span className="text-[13px] opacity-80">Founder • National In-charge</span>
            </div>
          </div>
          <div>
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">The Vision</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2 mb-4">A Vow Born Inside the Boxing Ring</h2>
            <p className="text-slate-700 text-base leading-relaxed mb-3">
              <span className="text-accent font-bold font-heading">1977 —</span> The journey began inside the boxing ring. As a
              spirited junior boxer, <b>Visanath Shetty</b> witnessed firsthand the immense talent
              hidden within India's underprivileged communities — and the lack of support holding them back.
            </p>
            <p className="text-slate-700 text-base leading-relaxed">
              Driven by a vow that no athlete would ever be left behind because of poverty, he launched
              this campaign in <b>Karnataka in 1997</b>. The goal was simple yet profound: empower
              the needy, provide world-class platforms for the poor, and demonstrate the true,
              unyielding power of India to the global sporting community.
            </p>
            <blockquote className="mt-8 p-6 border-l-4 border-accent bg-green-50 rounded-r-xl italic text-slate-700">
              "We don't just train athletes; we build the future of India. By giving the
              underprivileged a chance to shine on the world stage, we prove that India's greatest
              strength lies in its grit, its youth, and its untapped potential."
              <cite className="block mt-2.5 font-semibold text-navy not-italic">— Visanath Shetty, Founder, ISYDCI</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f2e2] py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Timeline</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2">Milestones of the Movement</h2>
          </div>
          <div className="max-w-[820px] mx-auto grid gap-5">
            {[
              { y: '1977', t: 'The Spark', d: 'Visanath Shetty steps into the boxing ring as a junior boxer and witnesses the hidden talent of India\'s underprivileged youth.' },
              { y: '1997', t: 'Founding', d: 'ISYDCI launched in Karnataka with a vow: no athlete left behind because of poverty.' },
              { y: '2000s', t: 'Expansion', d: 'Programs extended to Tamil Nadu and other southern states. First state offices opened.' },
              { y: '2026', t: 'National Presence', d: 'Head office at VB Bhavan, New Delhi. Active athlete-registration drives across multiple states.' },
            ].map(m => (
              <div key={m.y} className="bg-white rounded-xl p-6 border-l-[5px] border-accent shadow-[0_10px_30px_rgba(11,30,63,.08)]">
                <span className="text-accent font-extrabold font-heading tracking-wider">{m.y}</span>
                <h3 className="text-navy font-bold mt-1 mb-1.5">{m.t}</h3>
                <p className="text-slate-600 m-0">{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
