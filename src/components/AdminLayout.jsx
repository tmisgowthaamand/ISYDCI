import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminUser, setAdminUser] = useState('Super Admin')
  const navigate = useNavigate()
  const location = useLocation()

  // Authentication Guard
  useEffect(() => {
    const authData = localStorage.getItem('isydci_admin_auth')
    if (!authData) {
      // Optional: allow local browsing of simulator without strict forced logout, or default to admin
      localStorage.setItem('isydci_admin_auth', JSON.stringify({ user: 'Super Admin', token: 'mock' }))
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

  // Grouped Navigation matching the screenshot structure
  const accessNavItems = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2.5" />
          <path d="M7 8h4" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
          <circle cx="16.5" cy="8" r="1.5" />
        </svg>
      ),
    },
  ]

  const whatsappNavItems = [
    {
      name: 'Bot Messages & Media',
      path: '/admin/bot-messages',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      ),
    },
    {
      name: 'Flow Simulator',
      path: '/admin/flow-simulator',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="20" x="5" y="2" rx="3" />
          <path d="M12 18h.01" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* ==============================================================
          LEFT SIDEBAR (MATCHING SCREENSHOT 1 & SCREENSHOT 2)
          ============================================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0c1427] text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Top: Brand / Logo */}
        <div>
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-sm flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="ISYDCI" className="w-full h-full object-contain rounded-full" />
              </div>
              <div className="leading-tight">
                <div className="font-black text-white text-base tracking-wide font-['Montserrat']">
                  ISYDCI
                </div>
                <div className="text-[10px] font-semibold text-slate-400 tracking-wider">
                  Election Data & WhatsApp
                </div>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white text-xl p-1 cursor-pointer"
            >
              &times;
            </button>
          </div>

          {/* Navigation Groups */}
          <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-170px)]">
            
            {/* GROUP 1: ACCESS */}
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 py-1">
                ACCESS
              </div>
              {accessNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 ${
                      isActive
                        ? 'border border-blue-500/80 bg-blue-600/15 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-white'}`}>
                        {item.icon}
                      </span>
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* GROUP 2: WHATSAPP BOT (With Flow Simulator as 2nd item) */}
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 py-1">
                WHATSAPP BOT
              </div>
              {whatsappNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all duration-150 ${
                      isActive
                        ? 'border border-blue-500/90 bg-blue-600/15 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-white'}`}>
                        {item.icon}
                      </span>
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

          </div>
        </div>

        {/* Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-[#091021]">
          <div className="text-[11px] text-slate-400 px-3 py-1 font-medium flex items-center justify-between">
            <span>ISYDCI &middot; Active Portal</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50"></span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-30 md:hidden"
        />
      )}

      {/* ==============================================================
          MAIN CONTENT AREA
          ============================================================== */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top Navbar Header */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
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
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Admin Panel
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">&bull; ISYDCI WACTO Bot</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/membership-card"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-95 cursor-pointer"
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
