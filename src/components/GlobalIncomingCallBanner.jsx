import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL, apiJson, getAuthToken } from '../config/api.js'

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Global telecaller-routed incoming WhatsApp call banner.
 * Connects to GET /api/calls/events (filtered on the server by req.admin.username)
 * so each telecaller only receives rings for their own assigned leads (or unassigned leads).
 */
export default function GlobalIncomingCallBanner() {
  const [incomingCall, setIncomingCall] = useState(null)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const pcRef = useRef(null)
  const streamRef = useRef(null)
  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioDestRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordingCallIdRef = useRef(null)
  const elapsedRef = useRef(0)

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    if (!incomingCall || !['accepted', 'active'].includes(incomingCall.status)) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [incomingCall?.callId, incomingCall?.status])

  const stopAndUploadRecording = () => {
    const rec = recorderRef.current
    const callId = recordingCallIdRef.current
    if (!rec || rec.state === 'inactive') {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const durationSec = elapsedRef.current
      rec.onstop = async () => {
        try {
          const mimeType = rec.mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: mimeType })
          chunksRef.current = []
          if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {})
            audioCtxRef.current = null
            audioDestRef.current = null
          }
          recorderRef.current = null
          recordingCallIdRef.current = null
          if (callId && blob.size >= 100) {
            const reader = new FileReader()
            reader.onloadend = async () => {
              try {
                await apiJson(`/api/calls/${encodeURIComponent(callId)}/recording`, {
                  method: 'POST',
                  body: JSON.stringify({ audioBase64: reader.result, mimeType, durationSec }),
                })
              } catch (_) {}
              resolve()
            }
            reader.readAsDataURL(blob)
            return
          }
        } catch (_) {}
        resolve()
      }
      try {
        rec.requestData?.()
        rec.stop()
      } catch (_) {
        resolve()
      }
    })
  }

  const cleanupMedia = async () => {
    await stopAndUploadRecording()
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setMuted(false)
    setElapsed(0)
  }

  const refreshActive = async () => {
    try {
      const res = await apiJson('/api/calls/active')
      const inbound = (res?.calls || []).find(
        c => (c.call_direction || c.direction) === 'inbound' && ['ringing', 'pre_accepted', 'accepted', 'active'].includes(c.status)
      )
      if (inbound) {
        setIncomingCall(prev => (prev?.callId === inbound.callId ? { ...prev, ...inbound } : inbound))
      } else {
        setIncomingCall(prev => {
          if (prev && ['accepted', 'active'].includes(prev.status)) cleanupMedia()
          return null
        })
      }
    } catch (_) {}
  }

  useEffect(() => {
    refreshActive()
    const token = getAuthToken()
    let es = null
    if (token && typeof EventSource !== 'undefined') {
      es = new EventSource(`${API_BASE_URL}/api/calls/events?token=${encodeURIComponent(token)}`)
      es.addEventListener('call', evt => {
        try {
          const payload = JSON.parse(evt.data)
          const c = payload?.call
          if (!c) return
          const isInbound = (c.call_direction || c.direction) === 'inbound'
          if (!isInbound) return
          if (['ringing', 'pre_accepted', 'accepted', 'active'].includes(c.status)) {
            setIncomingCall(c)
          } else {
            setIncomingCall(prev => (prev?.callId === c.callId ? null : prev))
            cleanupMedia()
          }
        } catch (_) {}
      })
    }
    const poll = setInterval(refreshActive, 4000)
    return () => {
      if (es) es.close()
      clearInterval(poll)
      cleanupMedia()
    }
  }, [])

  const answerCall = async () => {
    if (!incomingCall?.callId) return
    setBusy(true)
    setError('')
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const dest = ctx.createMediaStreamDestination()
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      oscGain.gain.value = 0
      osc.connect(oscGain)
      oscGain.connect(dest)
      osc.start()
      const silencer = ctx.createGain()
      silencer.gain.value = 0
      silencer.connect(ctx.destination)
      audioCtxRef.current = ctx
      audioDestRef.current = dest

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      if (stream.getAudioTracks().length) {
        const localSrc = ctx.createMediaStreamSource(stream)
        localSrc.connect(dest)
        localSrc.connect(silencer)
      }
      pc.ontrack = evt => {
        if (evt.streams?.[0]) {
          if (audioRef.current) audioRef.current.srcObject = evt.streams[0]
          if (evt.streams[0].getAudioTracks().length) {
            const remoteSrc = ctx.createMediaStreamSource(evt.streams[0])
            remoteSrc.connect(dest)
            remoteSrc.connect(silencer)
          }
        }
      }
      pcRef.current = pc

      if (incomingCall.sdpSession?.offer) {
        await pc.setRemoteDescription({ type: 'offer', sdp: incomingCall.sdpSession.offer })
      }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const sdpAnswer = await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve(pc.localDescription?.sdp || '')
        const timer = setTimeout(() => resolve(pc.localDescription?.sdp || ''), 1500)
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timer)
            resolve(pc.localDescription?.sdp || '')
          }
        })
      })

      const res = await apiJson(`/api/calls/${encodeURIComponent(incomingCall.callId)}/accept`, {
        method: 'POST',
        body: JSON.stringify({ sdpAnswer }),
      })
      if (res?.call) {
        setIncomingCall(res.call)
        if (typeof MediaRecorder !== 'undefined') {
          const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
              ? 'audio/webm'
              : ''
          const rec = preferred ? new MediaRecorder(dest.stream, { mimeType: preferred }) : new MediaRecorder(dest.stream)
          chunksRef.current = []
          rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
          rec.start(500)
          recorderRef.current = rec
          recordingCallIdRef.current = res.call.callId
        }
      }
    } catch (err) {
      await cleanupMedia()
      setError(err.message || 'Failed to answer call')
    } finally {
      setBusy(false)
    }
  }

  const rejectCall = async () => {
    if (!incomingCall?.callId) return
    setBusy(true)
    try {
      await apiJson(`/api/calls/${encodeURIComponent(incomingCall.callId)}/reject`, { method: 'POST' })
      setIncomingCall(null)
      await cleanupMedia()
    } catch (err) {
      setError(err.message || 'Failed to reject call')
    } finally {
      setBusy(false)
    }
  }

  const hangupCall = async () => {
    if (!incomingCall?.callId) return
    setBusy(true)
    try {
      await cleanupMedia()
      await apiJson(`/api/calls/${encodeURIComponent(incomingCall.callId)}/terminate`, { method: 'POST' })
      setIncomingCall(null)
    } catch (err) {
      setError(err.message || 'Failed to end call')
    } finally {
      setBusy(false)
    }
  }

  const toggleMute = () => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }

  // Hide duplicate banner if user already has this exact lead open in Inbox
  const inboxPhone = new URLSearchParams(location.search).get('phone')
  if (!incomingCall) return <audio ref={audioRef} autoPlay playsInline className="hidden" />
  if (location.pathname.startsWith('/admin/inbox') && inboxPhone && incomingCall.waId === inboxPhone && !pcRef.current) {
    return <audio ref={audioRef} autoPlay playsInline className="hidden" />
  }

  const isLive = ['accepted', 'active'].includes(incomingCall.status)

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="fixed top-4 right-4 z-50 w-80 bg-white border border-blue-200 rounded-2xl shadow-2xl p-3.5 space-y-2.5 animate-fadeIn">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600 animate-ping'}`} />
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
                {isLive ? `Live Call · ${formatDuration(elapsed)}` : 'Incoming WhatsApp Call'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              {incomingCall.leadName || `+${incomingCall.waId}`}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">+{incomingCall.waId}</div>
          </div>
          {incomingCall.telecaller_id && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
              → {incomingCall.telecaller_id}
            </span>
          )}
        </div>

        {error && <div className="text-[10px] text-rose-600 font-semibold">{error}</div>}

        <div className="flex items-center gap-1.5">
          {!isLive ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={answerCall}
                className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                📞 Answer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={rejectCall}
                className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  muted ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {muted ? '🔇 Unmute' : '🎙 Mute'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={hangupCall}
                className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                End Call
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(`/admin/inbox?phone=${encodeURIComponent(incomingCall.waId)}`)}
            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            title="Open Lead Chat"
          >
            💬
          </button>
        </div>
      </div>
    </>
  )
}
