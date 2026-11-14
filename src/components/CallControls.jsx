import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL, apiJson, getAuthToken } from '../config/api.js'

function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatCallTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * WebRTC + Meta WhatsApp Calling API controls for a CRM contact thread.
 * Supports:
 *  - Requesting 72-hour outbound call permission (1/24h, 2/7d guarded by backend)
 *  - Initiating outbound WebRTC calls when permission is active
 *  - Answering / rejecting incoming WhatsApp calls via polling + RTCPeerConnection
 *  - Automatic two-way call audio recording (MediaRecorder + AudioContext) & playback
 */
export default function CallControls({ phone, name }) {
  const [permission, setPermission] = useState({ allowed: false, status: 'none', expiresAt: null })
  const [activeCall, setActiveCall] = useState(null)
  const [callHistory, setCallHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [directionFilter, setDirectionFilter] = useState('all')
  const [telecallerFilter, setTelecallerFilter] = useState('all')
  const [recording, setRecording] = useState(false)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pcRef = useRef(null)
  const streamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const audioRef = useRef(null)
  const recorderRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioDestRef = useRef(null)
  const audioSilencerRef = useRef(null)
  const chunksRef = useRef([])
  const recordingCallIdRef = useRef(null)
  const activeCallIdRef = useRef(null)
  const elapsedRef = useRef(0)

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    activeCallIdRef.current = activeCall?.callId || null
  }, [activeCall?.callId])

  const stopAndUploadRecording = () => {
    const rec = recorderRef.current
    const callId = recordingCallIdRef.current
    if (!rec || rec.state === 'inactive') {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      setRecording(false)
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
            audioSilencerRef.current = null
          }
          recorderRef.current = null
          recordingCallIdRef.current = null
          setRecording(false)

          if (callId && blob.size >= 100) {
            const reader = new FileReader()
            reader.onloadend = async () => {
              try {
                await apiJson(`/api/calls/${encodeURIComponent(callId)}/recording`, {
                  method: 'POST',
                  body: JSON.stringify({ audioBase64: reader.result, mimeType, durationSec }),
                })
                await loadLeadCallState()
              } catch (_) {}
              resolve()
            }
            reader.readAsDataURL(blob)
            return
          }
        } catch (_) {}
        setRecording(false)
        resolve()
      }
      try {
        rec.requestData?.()
        rec.stop()
      } catch (_) {
        setRecording(false)
        resolve()
      }
    })
  }

  const ensureAudioMix = async () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const dest = ctx.createMediaStreamDestination()
      // Keep-alive silent oscillator + sink ensures Firefox/Chrome continuously pump frames to MediaStreamDestination
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
      audioSilencerRef.current = silencer
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume().catch(() => {})
    }
    return { ctx: audioCtxRef.current, dest: audioDestRef.current, silencer: audioSilencerRef.current }
  }

  const startRecording = async callId => {
    if (!callId || recorderRef.current || typeof MediaRecorder === 'undefined') return
    if (!streamRef.current && !remoteStreamRef.current) return
    try {
      const { dest } = await ensureAudioMix()
      const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : ''
      const rec = preferred ? new MediaRecorder(dest.stream, { mimeType: preferred }) : new MediaRecorder(dest.stream)
      chunksRef.current = []
      rec.ondataavailable = evt => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data)
      }
      rec.start(500)
      recorderRef.current = rec
      recordingCallIdRef.current = callId
      setRecording(true)
    } catch (_) {}
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
    remoteStreamRef.current = null
    setMuted(false)
    setElapsed(0)
  }

  const loadLeadCallState = async () => {
    if (!phone) return
    try {
      const res = await apiJson(`/api/calls/lead/${encodeURIComponent(phone)}`)
      if (res?.permission) setPermission(res.permission)
      const list = res?.calls || []
      setCallHistory(list)
      const live = list.find(c => ['ringing', 'pre_accepted', 'accepted', 'active'].includes(c.status))
      if (live) {
        setActiveCall(live)
        // If an outbound call was just answered by the user, apply remote SDP answer
        if (
          live.direction === 'outbound' &&
          live.status === 'accepted' &&
          live.sdpSession?.answer &&
          pcRef.current &&
          !pcRef.current.currentRemoteDescription
        ) {
          await pcRef.current.setRemoteDescription({ type: 'answer', sdp: live.sdpSession.answer }).catch(() => {})
        }
        if (['accepted', 'active'].includes(live.status) && !recorderRef.current) {
          startRecording(live.callId)
        }
      } else if (activeCallIdRef.current) {
        activeCallIdRef.current = null
        setActiveCall(null)
        cleanupMedia()
      }
    } catch (_) {}
  }

  useEffect(() => {
    setError('')
    setActiveCall(null)
    setShowHistory(false)
    cleanupMedia()
    loadLeadCallState()
    const id = setInterval(loadLeadCallState, 3000)

    const targetDigits = String(phone || '').replace(/\D/g, '')
    const targetTail = targetDigits.slice(-10)
    const onCallEvent = evt => {
      const updated = evt?.detail?.call
      if (!updated?.callId) return
      const callDigits = String(updated.waId || updated.rawWaId || '').replace(/\D/g, '')
      if (targetTail && !callDigits.endsWith(targetTail)) return
      setCalls(prev => {
        const idx = prev.findIndex(c => c.callId === updated.callId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], ...updated }
          return next
        }
        return [updated, ...prev]
      })
    }
    window.addEventListener('isydci:call_event', onCallEvent)

    return () => {
      clearInterval(id)
      window.removeEventListener('isydci:call_event', onCallEvent)
      cleanupMedia()
    }
  }, [phone])

  useEffect(() => {
    if (!activeCall || !['accepted', 'active'].includes(activeCall.status)) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [activeCall?.callId, activeCall?.status])

  const createPeerConnection = async () => {
    const { ctx, dest, silencer } = await ensureAudioMix()
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    stream.getTracks().forEach(track => pc.addTrack(track, stream))
    if (stream.getAudioTracks().length) {
      const localSrc = ctx.createMediaStreamSource(stream)
      localSrc.connect(dest)
      if (silencer) localSrc.connect(silencer)
    }
    pc.ontrack = evt => {
      if (evt.streams?.[0]) {
        remoteStreamRef.current = evt.streams[0]
        if (audioRef.current) audioRef.current.srcObject = evt.streams[0]
        if (evt.streams[0].getAudioTracks().length && audioCtxRef.current && audioDestRef.current) {
          const remoteSrc = audioCtxRef.current.createMediaStreamSource(evt.streams[0])
          remoteSrc.connect(audioDestRef.current)
          if (audioSilencerRef.current) remoteSrc.connect(audioSilencerRef.current)
        }
        if (activeCallIdRef.current && !recorderRef.current) {
          startRecording(activeCallIdRef.current)
        }
      }
    }
    pcRef.current = pc
    return pc
  }

  const gatherSdp = pc =>
    new Promise(resolve => {
      if (pc.signalingState === 'closed') return resolve('')
      if (pc.iceGatheringState === 'complete') return resolve(pc.localDescription?.sdp || '')
      let timer = null
      const finish = () => {
        if (timer) clearTimeout(timer)
        pc.removeEventListener('icegatheringstatechange', onState)
        resolve(pc.signalingState === 'closed' ? '' : pc.localDescription?.sdp || '')
      }
      const onState = () => {
        if (pc.iceGatheringState === 'complete') finish()
      }
      pc.addEventListener('icegatheringstatechange', onState)
      timer = setTimeout(finish, 1500)
    })

  const requestPermission = async () => {
    setBusy(true)
    setError('')
    try {
      await apiJson('/api/calls/permission-request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      })
      await loadLeadCallState()
    } catch (err) {
      setError(err.message || 'Failed to request call permission')
    } finally {
      setBusy(false)
    }
  }

  const startOutboundCall = async () => {
    setBusy(true)
    setError('')
    try {
      await cleanupMedia()
      const pc = await createPeerConnection()
      const offer = await pc.createOffer({ offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)
      const sdpOffer = await gatherSdp(pc)
      const res = await apiJson('/api/calls/outbound', {
        method: 'POST',
        body: JSON.stringify({ phone, sdpOffer }),
      })
      if (res?.call) {
        activeCallIdRef.current = res.call.callId
        setActiveCall(res.call)
      }
    } catch (err) {
      await cleanupMedia()
      setError(err.message || 'Failed to start call')
    } finally {
      setBusy(false)
    }
  }

  const answerInboundCall = async () => {
    if (!activeCall?.callId) return
    setBusy(true)
    setError('')
    try {
      const pc = await createPeerConnection()
      const offerSdp = activeCall.sdpSession?.offer
      if (offerSdp) {
        await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
      }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const sdpAnswer = await gatherSdp(pc)
      const res = await apiJson(`/api/calls/${encodeURIComponent(activeCall.callId)}/accept`, {
        method: 'POST',
        body: JSON.stringify({ sdpAnswer }),
      })
      if (res?.call) {
        setActiveCall(res.call)
        startRecording(res.call.callId)
      }
    } catch (err) {
      await cleanupMedia()
      setError(err.message || 'Failed to answer call')
    } finally {
      setBusy(false)
    }
  }

  const rejectInboundCall = async () => {
    if (!activeCall?.callId) return
    setBusy(true)
    try {
      await apiJson(`/api/calls/${encodeURIComponent(activeCall.callId)}/reject`, { method: 'POST' })
      setActiveCall(null)
      await cleanupMedia()
    } catch (err) {
      setError(err.message || 'Failed to reject call')
    } finally {
      setBusy(false)
    }
  }

  const hangupCall = async () => {
    if (!activeCall?.callId) return
    setBusy(true)
    try {
      await cleanupMedia()
      await apiJson(`/api/calls/${encodeURIComponent(activeCall.callId)}/terminate`, { method: 'POST' })
      setActiveCall(null)
      await loadLeadCallState()
    } catch (err) {
      setError(err.message || 'Failed to end call')
    } finally {
      setBusy(false)
    }
  }

  const toggleMute = () => {
    if (!streamRef.current) return
    const next = !muted
    streamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !next
    })
    setMuted(next)
  }

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {!activeCall && (
        <>
          {permission.allowed ? (
            <button
              type="button"
              onClick={startOutboundCall}
              disabled={busy}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
              title={`Call ${name || phone} (permission active until ${permission.expiresAt ? new Date(permission.expiresAt).toLocaleString() : 'permanent'})`}
            >
              <span>📞</span>
              <span>Call</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={requestPermission}
              disabled={busy}
              className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
              title={`Request 72h WhatsApp call permission (status: ${permission.status})`}
            >
              <span>📞</span>
              <span>{permission.status === 'pending' ? 'Perm Pending' : 'Allow Call'}</span>
            </button>
          )}
        </>
      )}

      {activeCall && activeCall.direction === 'inbound' && activeCall.status === 'ringing' && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2 py-1 rounded-lg animate-pulse">
          <span className="text-[11px] font-bold text-amber-900">📲 Incoming Call</span>
          <button
            type="button"
            onClick={answerInboundCall}
            disabled={busy}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={rejectInboundCall}
            disabled={busy}
            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
          >
            Reject
          </button>
        </div>
      )}

      {activeCall && !(activeCall.direction === 'inbound' && activeCall.status === 'ringing') && (
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2 py-1 rounded-lg">
          <span className="text-[11px] font-bold text-emerald-900 inline-flex items-center gap-1">
            {activeCall.status === 'ringing' ? '🔔 Ringing…' : `🎙️ ${formatDuration(elapsed)}`}
            {recording && <span className="text-[9px] font-black text-rose-600">● REC</span>}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold cursor-pointer"
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            type="button"
            onClick={hangupCall}
            disabled={busy}
            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
          >
            Hang Up
          </button>
        </div>
      )}

      {callHistory.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHistory(v => !v)}
          className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
          title="View call records & audio recordings"
        >
          📋 Calls ({callHistory.length})
        </button>
      )}

      {showHistory && (() => {
        const telecallers = Array.from(new Set(callHistory.map(c => c.telecaller_id).filter(Boolean)))
        const inboundCount = callHistory.filter(c => (c.call_direction || c.direction) === 'inbound').length
        const outboundCount = callHistory.filter(c => (c.call_direction || c.direction) !== 'inbound').length
        const recordedCount = callHistory.filter(c => (c.recording_status || (c.recordingUrl ? 'ready' : 'none')) === 'ready').length
        const filteredCalls = callHistory.filter(c => {
          const dir = (c.call_direction || c.direction) === 'inbound' ? 'inbound' : 'outbound'
          if (directionFilter !== 'all' && dir !== directionFilter) return false
          if (telecallerFilter !== 'all' && (c.telecaller_id || '') !== telecallerFilter) return false
          return true
        })
        const authToken = getAuthToken()
        return (
          <div className="absolute right-0 top-full mt-1.5 w-[420px] max-h-[460px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
              <div>
                <div className="text-xs font-black text-slate-900">Call Records & Recordings</div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {callHistory.length} total · {inboundCount} inbound · {outboundCount} outbound · {recordedCount} recorded
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 font-bold cursor-pointer"
                aria-label="Close call records"
              >
                ✕
              </button>
            </div>

            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center gap-2 bg-white">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'inbound', label: `Inbound (${inboundCount})` },
                  { id: 'outbound', label: `Outbound (${outboundCount})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDirectionFilter(tab.id)}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      directionFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <select
                value={telecallerFilter}
                onChange={e => setTelecallerFilter(e.target.value)}
                className="ml-auto px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700"
                aria-label="Filter by telecaller"
              >
                <option value="all">All Telecallers</option>
                {telecallers.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="p-3 space-y-2.5 overflow-y-auto">
              {filteredCalls.length === 0 ? (
                <div className="text-[11px] text-slate-400 text-center py-6">No matching call records</div>
              ) : (
                filteredCalls.map(c => {
                  const isInbound = (c.call_direction || c.direction) === 'inbound'
                  const dir = isInbound ? 'Inbound' : 'Outbound'
                  const dur = c.duration_seconds ?? c.durationSec ?? 0
                  const isAttended = Boolean(c.attended ?? c.answeredAt)
                  const recStatus = c.recording_status || (c.recordingUrl ? 'ready' : 'none')
                  const streamUrl = `${API_BASE_URL}/api/calls/${encodeURIComponent(c.callId)}/recording?token=${encodeURIComponent(authToken)}`
                  const ext = String(c.recordingMimeType || '').includes('ogg') ? 'ogg' : 'webm'
                  const statusLabel = isAttended
                    ? 'Answered'
                    : c.status === 'failed'
                      ? 'Failed'
                      : c.status === 'rejected'
                        ? 'Rejected'
                        : 'Unanswered'
                  const statusTone = isAttended
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : c.status === 'failed' || c.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'

                  return (
                    <div key={c.callId} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                            isInbound
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {isInbound ? '↙ Inbound' : '↗ Outbound'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${statusTone}`}>
                            {statusLabel}
                          </span>
                          {c.telecaller_id && (
                            <span className="text-[10px] font-semibold text-slate-500">· {c.telecaller_id}</span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700 shrink-0">{formatDuration(dur)}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-medium">{formatCallTime(c.startedAt || c.createdAt)}</div>

                      {isAttended && recStatus === 'ready' && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                          <audio controls preload="metadata" src={streamUrl} className="w-full h-8" />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-emerald-700 font-semibold">● Recording ready</span>
                            <a
                              href={streamUrl}
                              download={`isydci-${dir.toLowerCase()}-${c.waId}-${c.callId.slice(-8)}.${ext}`}
                              className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold inline-flex items-center gap-1 border border-blue-200"
                            >
                              ⬇ Download
                            </a>
                          </div>
                        </div>
                      )}

                      {isAttended && recStatus === 'pending' && (
                        <div className="text-[10px] text-amber-600 font-semibold italic pt-0.5">Processing recording...</div>
                      )}

                      {isAttended && recStatus === 'failed' && (
                        <div className="text-[10px] text-rose-500 font-medium italic pt-0.5">Recording unavailable</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })()}

      {error && (
        <span className="text-[10px] text-rose-600 font-semibold max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
