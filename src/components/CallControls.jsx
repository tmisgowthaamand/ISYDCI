import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../config/api.js'

function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * WebRTC + Meta WhatsApp Calling API controls for a CRM contact thread.
 * Supports:
 *  - Requesting 72-hour outbound call permission (1/24h, 2/7d guarded by backend)
 *  - Initiating outbound WebRTC calls when permission is active
 *  - Answering / rejecting incoming WhatsApp calls via polling + RTCPeerConnection
 *  - Mute / Hangup during active calls
 */
export default function CallControls({ phone, name }) {
  const [permission, setPermission] = useState({ allowed: false, status: 'none', expiresAt: null })
  const [activeCall, setActiveCall] = useState(null)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pcRef = useRef(null)
  const streamRef = useRef(null)
  const audioRef = useRef(null)

  const cleanupMedia = () => {
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

  const loadLeadCallState = async () => {
    if (!phone) return
    try {
      const res = await apiJson(`/api/calls/lead/${encodeURIComponent(phone)}`)
      if (res?.permission) setPermission(res.permission)
      const live = (res?.calls || []).find(c => ['ringing', 'pre_accepted', 'accepted', 'active'].includes(c.status))
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
      } else if (activeCall) {
        setActiveCall(null)
        cleanupMedia()
      }
    } catch (_) {}
  }

  useEffect(() => {
    setError('')
    setActiveCall(null)
    cleanupMedia()
    loadLeadCallState()
    const id = setInterval(loadLeadCallState, 3000)
    return () => {
      clearInterval(id)
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
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    stream.getTracks().forEach(track => pc.addTrack(track, stream))
    pc.ontrack = evt => {
      if (audioRef.current && evt.streams?.[0]) {
        audioRef.current.srcObject = evt.streams[0]
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
      const pc = await createPeerConnection()
      const offer = await pc.createOffer({ offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)
      const sdpOffer = await gatherSdp(pc)
      const res = await apiJson('/api/calls/outbound', {
        method: 'POST',
        body: JSON.stringify({ phone, sdpOffer }),
      })
      if (res?.call) setActiveCall(res.call)
    } catch (err) {
      cleanupMedia()
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
      if (res?.call) setActiveCall(res.call)
    } catch (err) {
      cleanupMedia()
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
      cleanupMedia()
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
      await apiJson(`/api/calls/${encodeURIComponent(activeCall.callId)}/terminate`, { method: 'POST' })
      setActiveCall(null)
      cleanupMedia()
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {!activeCall && (
        <>
          {permission.allowed ? (
            <button
              type="button"
              onClick={startOutboundCall}
              disabled={busy}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
              title={`Call ${name || phone} (permission active until ${permission.expiresAt ? new Date(permission.expiresAt).toLocaleString() : '72h'})`}
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
          <span className="text-[11px] font-bold text-emerald-900">
            {activeCall.status === 'ringing' ? '🔔 Ringing…' : `🎙️ ${formatDuration(elapsed)}`}
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

      {error && (
        <span className="text-[10px] text-rose-600 font-semibold max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}

