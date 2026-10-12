import PageHeader from '../components/PageHeader.jsx'
import { pillars } from '../data/site.js'

export default function Pillars() {
  return (
    <>
      <PageHeader kicker="Strategic Framework" title="Five Pillars Defining Our Path Forward" subtitle="Each pillar is a deliberate commitment — together they form the foundation of a new India in sport." bg="/events/3.png" />

      <section className="bg-gradient-to-b from-navy to-navy-2 text-white py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(500px_300px_at_15%_20%,rgba(30,136,229,.22),transparent_60%),radial-gradient(500px_300px_at_85%_80%,rgba(47,158,68,.22),transparent_60%)]" />
        <div className="max-w-[1200px] mx-auto px-5 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {pillars.map(p => (
              <div key={p.n} className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/9 hover:border-accent/50">
                <div className="font-heading font-black text-5xl leading-none num-gradient">{p.n}</div>
                <h3 className="text-lg font-bold text-white mt-3 mb-2">{p.t}</h3>
                <p className="text-slate-300 text-sm m-0">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-accent font-bold tracking-[3px] text-xs uppercase">Deep Dive</span>
            <h2 className="text-navy text-3xl md:text-4xl font-extrabold mt-2">How the Pillars Work Together</h2>
          </div>
          <div className="grid gap-5 max-w-[900px] mx-auto">
            {pillars.map(p => (
              <div key={p.n} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[70px_1fr] gap-3 sm:gap-5 shadow-[0_10px_30px_rgba(11,30,63,.08)]">
                <div className="font-heading font-black text-4xl sm:text-[42px] num-gradient">{p.n}</div>
                <div>
                  <h3 className="text-navy font-bold text-lg mb-1.5">{p.t}</h3>
                  <p className="text-slate-600 m-0">{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
