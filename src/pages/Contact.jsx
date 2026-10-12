import PageHeader from '../components/PageHeader.jsx'

export default function Contact() {
  return (
    <>
      <PageHeader kicker="Get In Touch" title="Contact & Support" subtitle="Reach out to our offices or support the movement directly." bg="/events/12.png" />

      <section className="bg-gradient-to-b from-[#f7f2e2] to-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Office Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_10px_30px_rgba(11,30,63,.08)]">
              <h3 className="text-navy font-bold mb-5 flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-lg bg-green-50 text-accent grid place-items-center text-lg">📍</span>
                Office Addresses
              </h3>
              {[
                ['Head Office','VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001'],
                ['State Office','G1, 8th Street, New Colony, Adambakkam, Chennai – 600018'],
                ['Email', <a href="mailto:isaydcindia@gmail.com" className="text-accent hover:underline">isaydcindia@gmail.com</a>],
                ['Website', <a href="http://www.isaydcindia.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">www.isaydcindia.com</a>],
                ['Mobile', <a href="tel:+919994627551" className="text-accent hover:underline">+91 99946 27551</a>],
                ['TN Secretary', <span>V. Kesavan — <a href="tel:+919600154537" className="text-accent hover:underline">+91 96001 54537</a></span>],
              ].map(([k,v]) => (
                <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-3 my-2.5 text-xs sm:text-[14.5px] text-slate-700">
                  <b className="min-w-[110px] text-navy shrink-0">{k}</b><span>{v}</span>
                </div>
              ))}
            </div>

            {/* Bank Card */}
            <div className="bg-gradient-to-br from-navy to-navy-2 text-white rounded-2xl p-6 sm:p-8 shadow-[0_10px_30px_rgba(11,30,63,.08)]">
              <h3 className="text-white font-bold mb-5 flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-lg bg-white/10 text-[#a8e6b4] grid place-items-center text-lg">🏦</span>
                Official Donation Account
              </h3>
              {[
                ['Bank','Axis Bank Ltd — Injambakkam Branch'],
                ['Account Name','International Sports and Youth Development Campaign'],
                ['A/C Number','926010013055280'],
                ['Customer ID','981964757'],
                ['IFSC Code','UTIB0005685'],
                ['A/C Type','Savings'],
                ['Opened On','06-04-2026'],
              ].map(([k,v]) => (
                <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-3 my-2.5 text-xs sm:text-[14.5px] text-slate-300">
                  <b className="min-w-[110px] text-white shrink-0">{k}</b><span>{v}</span>
                </div>
              ))}
              <div className="mt-4 p-3 bg-accent/20 rounded-lg text-[13px] text-[#a8e6b4]">
                Every contribution directly funds grassroots training, equipment, and travel for underprivileged athletes.
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_10px_30px_rgba(11,30,63,.08)]">
            <h3 className="text-navy font-bold mb-5 flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-lg bg-green-50 text-accent grid place-items-center text-lg">✉️</span>
              Send Us a Message
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); alert('Thank you! We will get back to you shortly.') }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <input required placeholder="Your Name" className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
              <input required type="email" placeholder="Email" className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
              <input type="tel" placeholder="Phone" className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
              <input placeholder="Subject" className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
              <textarea required placeholder="Your Message" rows={5} className="sm:col-span-2 w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none resize-y focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
              <button type="submit" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all justify-self-start">Send Message →</button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
