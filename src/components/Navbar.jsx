import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { navLinks } from '../data/site.js'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${scrolled || open ? 'bg-navy border-white/10 shadow-[0_4px_25px_rgba(0,0,0,.4)]' : 'bg-transparent border-white/10'}`}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 flex items-center py-2.5 gap-3 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 cursor-pointer" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="ISYDCI" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain" />
            <div className="font-heading font-extrabold text-white text-xs sm:text-sm leading-tight whitespace-nowrap">
              ISYDCI
              <small className="hidden xl:block font-medium text-white/70 text-[10px] tracking-wider">International Sports and Youth Development Campaign of India</small>
            </div>
          </Link>

          {/* Desktop Navigation Links (Visible on lg: 1024px and above) */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1 ml-auto">
            {navLinks.map(l => (
              <NavLink
                key={l.to} to={l.to} end={l.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-lg font-semibold text-xs xl:text-[13px] text-white transition-colors whitespace-nowrap ${isActive ? 'bg-green-900/40 text-accent-2 font-bold' : 'hover:bg-white/10 hover:text-accent-2'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile & Tablet Hamburger Toggle (Visible below lg: 1024px including iPad Mini, Surface Pro) */}
          <button
            className="lg:hidden ml-auto bg-transparent border-0 text-white cursor-pointer w-10 h-10 relative flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            <span className={`block w-5 h-[2px] bg-white rounded transition-all duration-300 ${open ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white rounded transition-all duration-300 ${open ? 'opacity-0 scale-0' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white rounded transition-all duration-300 ${open ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>

        {/* Mobile & Tablet Dropdown Drawer */}
        <div className={`lg:hidden flex flex-col bg-[#0b1e3f] border-t border-white/10 overflow-y-auto transition-all duration-300 ease-in-out ${open ? 'max-h-[85vh] p-4 shadow-2xl opacity-100' : 'max-h-0 p-0 opacity-0 pointer-events-none'}`}>
          <div className="space-y-1">
            {navLinks.map(l => (
              <NavLink
                key={l.to} to={l.to} end={l.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all ${isActive ? 'bg-green-900/50 text-accent-2 font-bold border-l-4 border-accent' : 'hover:bg-white/10'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile Quick Footer / Legal Links (No Admin link shown here) */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-4 text-xs text-slate-300 px-2 py-1">
            <Link to="/privacy-policy" onClick={() => setOpen(false)} className="hover:text-white transition-colors">Privacy Policy</Link>
            <span className="opacity-40">•</span>
            <Link to="/terms-and-conditions" onClick={() => setOpen(false)} className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
          </div>
        </div>
      </nav>

      {/* Mobile & Tablet Backdrop when menu open */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}
    </>
  )
}
