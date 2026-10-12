import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="min-h-[70vh] grid place-items-center text-white bg-[linear-gradient(120deg,rgba(11,30,63,.85),rgba(18,42,87,.8)),url('/events/10.png')] bg-cover bg-center">
      <div className="relative text-center max-w-[1000px] px-5 pt-30 pb-15">
        <span className="inline-block px-3.5 py-1.5 rounded-full bg-white/10 border border-white/25 text-xs tracking-[2px] uppercase mb-5">404</span>
        <h1 className="text-4xl md:text-6xl font-black">Page Not Found</h1>
        <p className="text-lg opacity-90 max-w-xl mx-auto mt-4 mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-gradient text-white px-6 py-3 rounded-full font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2">← Back to Home</Link>
      </div>
    </section>
  )
}
