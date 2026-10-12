export default function PageHeader({ kicker, title, subtitle, bg = '/events/10.png' }) {
  return (
    <section
      className="text-white pt-36 pb-20 bg-cover bg-center relative"
      style={{ backgroundImage: `linear-gradient(120deg,rgba(0,0,0,.45),rgba(0,0,0,.35)),url(${bg})` }}
    >
      <div className="relative text-center max-w-[900px] mx-auto px-5">
        {kicker && (
          <span className="inline-block px-3.5 py-1.5 rounded-full bg-white/12 border border-white/25 text-xs tracking-[2px] uppercase mb-4">
            {kicker}
          </span>
        )}
        <h1 className="text-3xl md:text-5xl font-black">{title}</h1>
        {subtitle && <p className="text-[17px] opacity-90 mt-2.5 mx-auto max-w-[720px]">{subtitle}</p>}
      </div>
    </section>
  )
}
