import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/uiStore'
import { useData } from '../store/dataStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusDot'
import { closeStream, listCameras, openCamera, openScreen, streamOk, type CamDevice } from '../lib/media'

export function VisionView() {
  const [cameras, setCameras] = useState<CamDevice[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
  const [screenShot, setScreenShot] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const addFile = useData((s) => s.addFile)
  const pushToast = useUi((s) => s.pushToast)

  // Enumerate labels only after permission; video element binding
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => { /* noop */ })
    }
  }, [stream])

  useEffect(() => () => { closeStream(stream); closeStream(screenStreamRef.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startCam = async () => {
    setStarting(true); setCamError(null)
    try {
      const s = await openCamera()
      setStream(s)
      const devs = await listCameras()
      setCameras(devs)
      pushToast({ title: 'Camera connected', body: devs[0]?.label ?? 'Default camera', kind: 'success' })
    } catch (err) {
      const e = err as DOMException
      setCamError(
        e.name === 'NotAllowedError' ? 'Permission denied — allow camera access in your browser and retry.'
        : e.name === 'NotFoundError' ? 'No camera hardware detected on this machine.'
        : e.name === 'NotReadableError' ? 'Camera is busy in another application.'
        : `Camera error: ${e.message ?? e.name}`,
      )
    } finally {
      setStarting(false)
    }
  }

  const stopCam = () => {
    closeStream(stream)
    setStream(null)
    setShot(null)
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !streamOk(stream)) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth || 1280
    c.height = v.videoHeight || 720
    c.getContext('2d')?.drawImage(v, 0, 0)
    const url = c.toDataURL('image/png')
    setShot(url)
    addFile({ name: `capture-${new Date().toISOString().slice(11, 19)}.png`, kind: 'image', size: '—' })
    pushToast({ title: 'Capture saved', body: 'Frame captured to Files.', kind: 'success' })
  }

  const shareScreen = async () => {
    try {
      const s = await openScreen()
      screenStreamRef.current = s
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = s
        void screenVideoRef.current.play()
      }
      s.getVideoTracks()[0]?.addEventListener('ended', () => { screenStreamRef.current = null; setScreenShot(null) })
      pushToast({ title: 'Screen share live', body: 'Analyzing what you choose to show — nothing else.', kind: 'info' })
    } catch {
      pushToast({ title: 'Screen share cancelled', kind: 'info' })
    }
  }

  const grabScreen = () => {
    const v = screenVideoRef.current
    if (!v || !screenStreamRef.current) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth || 1280
    c.height = v.videoHeight || 720
    c.getContext('2d')?.drawImage(v, 0, 0)
    setScreenShot(c.toDataURL('image/png'))
    addFile({ name: `screen-${new Date().toISOString().slice(11, 19)}.png`, kind: 'image', size: '—' })
    pushToast({ title: 'Screen frame saved', kind: 'success' })
  }

  const live = streamOk(stream)

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="row__icon"><Icon name="eye" /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Vision</h2>
          <div className="t-xs t-low">Camera and screen analysis — permission-gated, nothing runs until you start it</div>
        </div>
        <StatusBadge tone={live ? 'ok' : 'idle'}>{live ? 'LIVE' : 'OFFLINE'}</StatusBadge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {/* Camera panel */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <Icon name="camera" width={15} style={{ color: 'var(--cyan)' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{live ? 'LIVE CAMERA' : 'CAMERA'}</span>
            {cameras.length > 0 && <span className="badge badge--muted">{cameras.length} device{cameras.length > 1 ? 's' : ''}</span>}
          </div>
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#03050a', display: 'grid', placeItems: 'center' }}>
            <video ref={videoRef} muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: live ? 'block' : 'none' }} />
            {!live && (
              <div className="empty" style={{ padding: 30 }}>
                <Icon name="camera" width={30} />
                <div className="empty-title">{camError ? 'Camera unavailable' : 'CAMERA NOT CONNECTED'}</div>
                <div className="empty-sub">{camError ?? 'Connect a compatible camera to enable camera access.'}</div>
                <Button variant="primary" icon="power" onClick={startCam} disabled={starting}>
                  {starting ? 'Requesting…' : 'CONNECT CAMERA'}
                </Button>
              </div>
            )}
            {live && <span className="badge badge--err" style={{ position: 'absolute', top: 10, left: 10 }}>● REC READY</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, flexWrap: 'wrap' }}>
            <Button size="sm" icon="camera" onClick={capture} disabled={!live}>Capture</Button>
            <Button size="sm" icon="refresh" onClick={() => { stopCam(); window.setTimeout(startCam, 150) }} disabled={!live}>Switch</Button>
            <Button size="sm" icon="stop" onClick={stopCam} disabled={!live}>Stop</Button>
            {shot && <a className="btn btn--sm" href={shot} download="ultron-capture.png" style={{ textDecoration: 'none' }}>Save PNG</a>}
          </div>
          {shot && (
            <div style={{ padding: '0 12px 12px' }}>
              <img src={shot} alt="Latest camera capture" style={{ borderRadius: 10, border: '1px solid var(--line-strong)', maxHeight: 150 }} />
            </div>
          )}
        </div>

        {/* Screen panel */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <Icon name="monitor" width={15} style={{ color: '#9cc0ff' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>SCREEN ANALYSIS</span>
          </div>
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#03050a', display: 'grid', placeItems: 'center' }}>
            <video ref={screenVideoRef} muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: screenStreamRef.current ? 'block' : 'none' }} />
            {!screenStreamRef.current && (
              <div className="empty" style={{ padding: 30 }}>
                <Icon name="monitor" width={30} />
                <div className="empty-title">Screen share idle</div>
                <div className="empty-sub">Pick a window or display to analyze. The browser shows you exactly what is shared.</div>
                <Button variant="primary" icon="monitor" onClick={shareScreen}>SHARE SCREEN</Button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12 }}>
            <Button size="sm" icon="camera" onClick={grabScreen} disabled={!screenStreamRef.current}>Grab frame</Button>
            <Button size="sm" icon="stop" onClick={() => { closeStream(screenStreamRef.current); screenStreamRef.current = null; setScreenShot(null) }} disabled={!screenStreamRef.current}>Stop</Button>
            {screenShot && <a className="btn btn--sm" href={screenShot} download="ultron-screen.png" style={{ textDecoration: 'none' }}>Save PNG</a>}
          </div>
          {screenShot && (
            <div style={{ padding: '0 12px 12px' }}>
              <img src={screenShot} alt="Latest screen capture" style={{ borderRadius: 10, border: '1px solid var(--line-strong)', maxHeight: 150 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
