import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import GlobalIncomingCallBanner from './GlobalIncomingCallBanner.jsx'

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminUser, setAdminUser] = useState('Super Admin')
  const [role, setRole] = useState('super_admin')
  const [roleLabel, setRoleLabel] = useState('Super Admin')
  const navigate = useNavigate()
  const location = useLocation()
  const isDeveloper = role === 'super_super_admin'
  const isTelecaller = role === 'telecaller'

  // Authentication Guard (token + role come from /api/auth/login; the backend re-checks every request)
  useEffect(() => {
    const authData = localStorage.getItem('isydci_admin_auth')
    if (!authData) {
      navigate('/admin/login')
      return
    }
    try {
      const parsed = JSON.parse(authData)
      if (parsed && parsed.token && parsed.user) {
        setAdminUser(parsed.displayName || parsed.user)
        setRole(parsed.role || 'super_admin')
        setRoleLabel(
          parsed.roleLabel ||
            (parsed.role === 'super_super_admin'
              ? 'Super Super Admin (Developer)'
              : parsed.role === 'telecaller'
                ? 'Telecaller'
                : 'Super Admin')
        )
        // developer-only pages are never shown to a Super Admin or Telecaller
        if (location.pathname.startsWith('/admin/dev') && parsed.role !== 'super_super_admin') {
          navigate(parsed.role === 'telecaller' ? '/admin/telecaller' : '/admin/dashboard')
        }
        // telecallers only access their dedicated dashboard, inbox, and assigned leads
        if (
          parsed.role === 'telecaller' &&
          !['/admin/telecaller', '/admin/inbox', '/admin/leads'].some(p => location.pathname.startsWith(p))
        ) {
          navigate('/admin/telecaller')
        }
      } else {
        localStorage.removeItem('isydci_admin_auth')
        navigate('/admin/login')
      }
    } catch {
      localStorage.removeItem('isydci_admin_auth')
      navigate('/admin/login')
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

  const icon = d => (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  )

  // GROUP 3: CRM (both roles)
  const crmNavItems = [
    { name: 'Inbox', path: '/admin/inbox', icon: icon(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>) },
    { name: 'Leads', path: '/admin/leads', icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /><path d="M19 8v6" /><path d="M22 11h-6" /></>) },
    { name: 'Incomplete Registrations', path: '/admin/incomplete', icon: icon(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>) },
    { name: 'Templates', path: '/admin/templates', icon: icon(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>) },
  ]

  // GROUP 4: DEVELOPER MODE (Super Super Admin only)
  const devNavItems = [
    { name: 'Telecallers & Routing', path: '/admin/dev/telecallers', icon: icon(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></>) },
    { name: 'Providers', path: '/admin/dev/providers', icon: icon(<><path d="M12 2v4" /><path d="M12 18v4" /><path d="m4.93 4.93 2.83 2.83" /><path d="m16.24 16.24 2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><circle cx="12" cy="12" r="4" /></>) },
    { name: 'Webhook & Flow Logs', path: '/admin/dev/logs', icon: icon(<><path d="M4 4h16v16H4z" /><path d="M8 9h8" /><path d="M8 13h6" /><path d="M8 17h4" /></>) },
    { name: 'Flow Deploy', path: '/admin/dev/flow', icon: icon(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>) },
    { name: 'Admin Accounts', path: '/admin/dev/admins', icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8l2 2-2 2" /><path d="M21 10h-6" /></>) },
    { name: 'Audit Log', path: '/admin/dev/audit', icon: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" /></>) },
  ]

  const renderGroup = (title, items, accent = 'blue') => (
    <div className="space-y-1">
      <div className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 ${accent === 'amber' ? 'text-amber-400' : 'text-slate-400'}`}>
        {title}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 ${
              isActive
                ? accent === 'amber'
                  ? 'border border-amber-500/80 bg-amber-500/15 text-white font-bold shadow-xs'
                  : 'border border-blue-500/80 bg-blue-600/15 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 font-medium'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`shrink-0 transition-colors ${isActive ? (accent === 'amber' ? 'text-amber-400' : 'text-blue-400') : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  )

  return (
    <div className={`bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white ${
      location.pathname.startsWith('/admin/inbox') ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'
    }`}>
      
      {/* ==============================================================
          LEFT SIDEBAR (MATCHING SCREENSHOT 1 & SCREENSHOT 2)
          ============================================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0c1427] text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Top: Brand / Logo */}
        <div>
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 group">
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
          <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-170px)] custom-scrollbar-dark">
            {isTelecaller ? (
              renderGroup('TELECALLER DESK', [
                { name: 'Telecaller Dashboard', path: '/admin/telecaller', icon: icon(<><rect width="7" height="9" x="3" y="3" rx="1.5" /><rect width="7" height="5" x="14" y="3" rx="1.5" /><rect width="7" height="9" x="14" y="12" rx="1.5" /><rect width="7" height="5" x="3" y="16" rx="1.5" /></>) },
                { name: 'Inbox', path: '/admin/inbox', icon: crmNavItems[0].icon },
                { name: 'My Leads', path: '/admin/leads', icon: crmNavItems[1].icon },
              ])
            ) : (
              <>
                {/* GROUP 1: ACCESS */}
                {renderGroup('ACCESS', accessNavItems)}

                {/* GROUP 2: WHATSAPP BOT */}
                {renderGroup('WHATSAPP BOT', whatsappNavItems)}

                {/* GROUP 3: CRM — leads, inbox, templates (Super Admin + Developer) */}
                {renderGroup('CRM', crmNavItems)}

                {/* GROUP 4: DEVELOPER MODE — only rendered for the Super Super Admin */}
                {isDeveloper && renderGroup('Developer Mode', devNavItems, 'amber')}
              </>
            )}
          </div>
        </div>

        {/* Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-[#091021]">
          <div className="text-[11px] text-slate-400 px-3 py-1 font-medium flex items-center justify-between">
            <span className="truncate" title={`${adminUser} · ${roleLabel}`}>
              {adminUser} &middot; <span className={isDeveloper ? 'text-amber-300' : isTelecaller ? 'text-blue-300' : 'text-slate-300'}>{isDeveloper ? 'Developer' : isTelecaller ? 'Telecaller' : 'Super Admin'}</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50 shrink-0"></span>
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
      <div className={`flex-1 md:ml-64 flex flex-col min-w-0 max-w-full ${
        location.pathname.startsWith('/admin/inbox')
          ? 'h-screen max-h-screen overflow-hidden'
          : 'min-h-screen overflow-x-hidden'
      }`}>
        
        {/* Top Navbar Header */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 sm:p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full border shrink-0 ${isDeveloper ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>
                {isDeveloper ? 'Super Super Admin' : 'Super Admin'}
              </span>
              <span className="text-xs text-slate-400 hidden md:inline truncate">&bull; {isDeveloper ? 'Developer Mode' : 'ISYDCI WhatsApp CRM'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/membership-card"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-95 cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">New Card</span>
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              title="View Public Site"
            >
              <span className="hidden xs:inline">Public Site &rarr;</span>
              <span className="xs:hidden">🌐</span>
            </Link>
          </div>
        </header>

        {/* Page Content Rendered Here */}
        <main className={`flex-1 min-w-0 max-w-full ${
          location.pathname.startsWith('/admin/inbox')
            ? 'p-1.5 sm:p-2 md:p-3 flex flex-col min-h-0 overflow-hidden'
            : 'p-3 sm:p-5 lg:p-8 overflow-x-hidden'
        }`}>
          <Outlet />
        </main>
      </div>

      <GlobalIncomingCallBanner />
    </div>
  )
}
