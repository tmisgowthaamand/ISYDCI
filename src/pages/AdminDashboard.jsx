import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    verifiedCount: 0,
    pendingCount: 0,
    districtsCount: 0,
    statesCount: 0,
    recentMembers: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats)
        }
      })
      .catch(err => console.error('Error fetching dashboard stats:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/90 px-2.5 py-0.5 rounded-full border border-blue-200/80">
              Administrative Control
            </span>
            <span className="text-xs text-slate-400">• Official Live Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1e3f] tracking-tight font-['Montserrat']">
            Dashboard Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Member records, card generation analytics &amp; verification controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/admin/members"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 shadow-sm text-slate-700 text-xs font-bold hover:border-slate-300 transition-all cursor-pointer backdrop-blur-sm whitespace-nowrap"
          >
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Member Directory ({stats.totalMembers})</span>
          </Link>
          <Link
            to="/membership-card"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Generate New Card</span>
          </Link>
        </div>
      </div>

      {/* 4 Overview Metric Cards (Glassy Frosted Design & Executive Color Accents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Members */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-blue-200 transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Members
            </div>
            <div className="text-2xl font-black text-[#0b1e3f] font-['Montserrat']">
              {stats.totalMembers}
            </div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
              Active Central Registry
            </div>
          </div>
        </div>

        {/* Card 2: Verified Cards */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-indigo-200 transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Verified Cards
            </div>
            <div className="text-2xl font-black text-indigo-600 font-['Montserrat']">
              {stats.verifiedCount}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Approved ID Cards
            </div>
          </div>
        </div>

        {/* Card 3: Pending Verification */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-amber-200 transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Review
            </div>
            <div className="text-2xl font-black text-amber-600 font-['Montserrat']">
              {stats.pendingCount}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Awaiting Approval
            </div>
          </div>
        </div>

        {/* Card 4: Regions Covered */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-purple-200 transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Districts Coverage
            </div>
            <div className="text-2xl font-black text-[#0b1e3f] font-['Montserrat']">
              {stats.districtsCount} Districts
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Tamil Nadu &amp; National
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Recent Registrations & Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left: Recent Registrations Table */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-7">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-[#0b1e3f] font-['Montserrat']">
                Recent Member Registrations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official cards generated through admin &amp; member portal.
              </p>
            </div>
            <Link
              to="/admin/members"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <span>View all ({stats.totalMembers})</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="space-y-3">
            {stats.recentMembers && stats.recentMembers.length > 0 ? (
              stats.recentMembers.map(m => (
                <div
                  key={m.id || m.memberId}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100/90 bg-white/50 hover:border-blue-200 hover:bg-blue-50/20 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={m.photo || m.photoUrl || '/athletes/1.png'}
                      alt={m.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                    />
                    <div>
                      <div className="font-extrabold text-xs text-[#0b1e3f] uppercase">
                        {m.name}
                      </div>
                      <div className="text-[11px] font-mono text-blue-600 font-bold">
                        {m.memberId}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <span className="hidden sm:inline-block text-xs font-semibold text-slate-600 capitalize">
                      {m.district || m.assembly || 'Tamil Nadu'}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                      m.status === 'Verified'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {m.status || 'Verified'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="14" x="3" y="5" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <circle cx="8" cy="15" r="1.5" />
                    <line x1="12" y1="15" x2="17" y2="15" />
                  </svg>
                </div>
                <h3 className="text-sm font-extrabold text-[#0b1e3f] font-['Montserrat']">
                  No Member Registrations Yet
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Your directory is ready. Generate and register your first member identity card.
                </p>
                <Link
                  to="/membership-card"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Generate First ID Card</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Operations & Directory Controls (Glassy Frosted Theme) */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200/80">
                Quick Actions
              </span>
            </div>
            <h2 className="text-base font-extrabold text-[#0b1e3f] font-['Montserrat'] mb-1">
              Management Operations
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Direct access to directory tools, card printing &amp; verification.
            </p>

            <div className="space-y-3">
              <Link
                to="/membership-card"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white/60 hover:bg-blue-50/40 hover:border-blue-200 transition-all group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="14" x="3" y="5" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <circle cx="8" cy="15" r="1.5" />
                      <line x1="12" y1="15" x2="17" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0b1e3f] group-hover:text-blue-600 transition-colors">
                      ID Card Designer
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Live 3D preview &amp; 300 DPI export
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:text-blue-600 text-sm font-bold transition-colors">&rarr;</span>
              </Link>

              <Link
                to="/admin/management"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white/60 hover:bg-indigo-50/40 hover:border-indigo-200 transition-all group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0b1e3f] group-hover:text-indigo-600 transition-colors">
                      Verification Controls
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Approve or review member statuses
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:text-indigo-600 text-sm font-bold transition-colors">&rarr;</span>
              </Link>

              <Link
                to="/admin/members"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white/60 hover:bg-slate-100 hover:border-slate-300 transition-all group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0b1e3f] group-hover:text-blue-600 transition-colors">
                      Member Directory
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Search, download &amp; manage records
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:text-blue-600 text-sm font-bold transition-colors">&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex flex-col gap-2.5">
            <Link
              to="/admin/members"
              className="w-full py-2.5 text-center text-xs font-bold rounded-xl bg-[#0b1e3f] hover:bg-[#16366f] text-white transition-all shadow-sm"
            >
              Open Full Members Table &rarr;
            </Link>
            <Link
              to="/"
              className="w-full py-2 text-center text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              Return to Public Website Home
            </Link>
          </div>
        </div>

      </div>

    </div>
  )
}
