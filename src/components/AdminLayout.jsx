import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminUser, setAdminUser] = useState('admin')
  const navigate = useNavigate()
  const location = useLocation()

  // Authentication Guard
  useEffect(() => {
    const authData = localStorage.getItem('isydci_admin_auth')
    if (!authData) {
      navigate('/admin/login', { replace: true })
      return
    }
    try {
      const parsed = JSON.parse(authData)
      if (parsed && parsed.user) {
        setAdminUser(parsed.user)
      }
    } catch {
      // Fallback
    }
  }, [navigate, location.pathname])

  const handleLogout = () => {
    localStorage.removeItem('isydci_admin_auth')
    navigate('/admin/login')
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Exactly the 3 requested navigation items with professional vector icons
  const navItems = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      ),
    },
    {
      name: 'Members',
      path: '/admin/members',
      icon: (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      name: 'Member Management',
      path: '/admin/management',
      icon: (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2.5" />
          <path d="M7 8h4" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
          <circle cx="16.5" cy="8" r="1.5" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* Subtle Ambient Glass Glow in background */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ==============================================================
          LEFT SIDEBAR (FROSTED GLASS & MODERN SLATE/BLUE THEME)
          ============================================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/85 backdrop-blur-xl border-r border-slate-200/80 text-slate-700 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-[4px_0_24px_rgba(15,23,42,0.03)] md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Top: Brand / Logo */}
        <div>
          <div className="p-5 border-b border-slate-100/90 flex items-center justify-between">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/80 flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="ISYDCI" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <div className="font-black text-[#0b1e3f] text-base tracking-wide font-['Montserrat']">
                  ISYDCI
                </div>
                <div className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">
                  Directory Admin
                </div>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-800 text-xl p-1 cursor-pointer"
            >
              &times;
            </button>
          </div>

          {/* 3 Sidebar Navigation Items */}
          <div className="p-4 space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 py-1 mb-1">
              Main Menu
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs sm:text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-bold'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/80 border border-transparent font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Bottom of Sidebar (ADMIN: admin & Logout) */}
        <div className="p-4 border-t border-slate-100/90 bg-slate-50/60 backdrop-blur-sm">
          <div className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200/70 text-xs text-slate-600 font-mono flex items-center gap-2.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-500/50"></span>
            <span className="truncate">ADMIN: <strong className="text-[#0b1e3f] font-bold">{adminUser}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2.5 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* ==============================================================
          MAIN CONTENT AREA
          ============================================================== */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top Navbar: Frosted Glass Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/80 border border-blue-200/80 px-2.5 py-0.5 rounded-full">
                Admin Panel
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Live System</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/membership-card"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">New Card</span>
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Public Site &rarr;
            </Link>
          </div>
        </header>

        {/* Page Content Rendered Here */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
