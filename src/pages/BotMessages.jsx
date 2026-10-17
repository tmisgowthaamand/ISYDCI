import React, { useState } from 'react'
import isydciLabels from '../data/isydci.labels.json'

export default function BotMessages() {
  const [activeTab, setActiveTab] = useState('labels')

  const botMedia = [
    {
      title: 'Official ISYDCI ID Card Template',
      type: 'PNG Image',
      size: '1.2 MB',
      purpose: 'Sent when athlete taps [Download ID Card]',
      status: 'Active · Cloudinary Verified',
      endpoint: '/api/whatsapp/send-image'
    },
    {
      title: 'National Championship Official Poster',
      type: 'JPEG Image',
      size: '2.4 MB',
      purpose: 'Sent during Tournament Info & Trials greeting',
      status: 'Active · CDN Cached',
      endpoint: '/api/whatsapp/send-image'
    },
    {
      title: 'ISYDCI Official Accreditation Rulebook',
      type: 'PDF Document',
      size: '3.8 MB',
      purpose: 'Sent on demand for state secretary verification',
      status: 'Active · Verified',
      endpoint: '/api/whatsapp/send-document'
    }
  ]

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-blue-600 selection:text-white">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 pb-2 border-b border-slate-200">
        <span className="hover:text-blue-600 cursor-pointer">WhatsApp bot</span>
        <span className="text-slate-300 font-bold">&rsaquo;</span>
        <span className="text-slate-900 font-bold">Bot Messages & Media</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Bot Messages & Media
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage backend webhook reply templates, label-driven routing interceptors, and Cloudinary media assets for ISYDCI WhatsApp bot.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Backend-Only Labels</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {isydciLabels?.backend_only?.length || 6}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            Intercepted directly by webhook
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dual Routing Labels</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {isydciLabels?.dual?.length || 5}
          </div>
          <div className="text-xs text-blue-600 font-medium mt-1">
            Triggers WACTO node + Backend log
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cloudinary Media</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {botMedia.length} Assets
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            High-res ID Cards & Posters
          </div>
        </div>
      </div>

      {/* Label Routing Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-sm text-slate-900">
              Configured Label Interceptors ({isydciLabels ? Object.values(isydciLabels).flat().length : 0})
            </div>
            <div className="text-xs text-slate-500">
              Defined in <code className="text-blue-600 font-mono">adapters/isydci.labels.json</code>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Label / Button Title</th>
                <th className="py-3 px-4">Routing Kind</th>
                <th className="py-3 px-4">Action / Handler</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(isydciLabels?.backend_only || []).map((label, idx) => (
                <tr key={`b-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{label}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      backend_only
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    Intercepted by server webhook; replies with live athlete database data or ID card media.
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </td>
                </tr>
              ))}

              {(isydciLabels?.dual || []).map((label, idx) => (
                <tr key={`d-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{label}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      dual
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    Advances to WACTO node while logging athlete interaction in sports analytics desk.
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </td>
                </tr>
              ))}

              {(isydciLabels?.opens_wacto || []).map((label, idx) => (
                <tr key={`w-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{label}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      opens_wacto
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    Quick reply button sent by backend to return athlete back into WACTO interactive canvas.
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cloudinary Media Assets */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div>
          <div className="font-bold text-sm text-slate-900">
            Cloudinary Delivery Assets
          </div>
          <div className="text-xs text-slate-500">
            Media links sent through WACTO <code className="text-slate-700 font-mono">/messages/send-image</code> endpoint
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {botMedia.map((m, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                  {m.type}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{m.size}</span>
              </div>
              <div className="font-bold text-xs text-slate-900">{m.title}</div>
              <div className="text-[11px] text-slate-500">{m.purpose}</div>
              <div className="text-[10px] text-emerald-600 font-bold pt-1">{m.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
