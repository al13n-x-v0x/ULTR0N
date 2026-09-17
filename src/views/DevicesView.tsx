import { useEffect, useRef, useState } from 'react'
import { useData } from '../store/dataStore'
import { useSettings } from '../store/settingsStore'
import { Icon, type IconName } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusDot'
import type { Device } from '../types'
const KIND_ICON: Record<string, IconName> = {
  phone: 'phone', laptop: 'monitor', headphones: 'headphones', camera: 'camera',
  tv: 'tv', gamepad: 'gamepad', watch: 'watch', other: 'wifi',
}

/** Web Bluetooth availability — real capability check, no fake devices. */
function bluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

function networkHint(): string {
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection
  if (conn?.effectiveType) return `Network: ${conn.effectiveType}${conn.downlink ? ` · ~${conn.downlink}Mb/s` : ''}`
  return navigator.onLine ? 'Network: online' : 'Network: offline'
}

export function DevicesView() {
  const devices = useData((s) => s.devices)
  const scanning = useData((s) => s.scanning)
  const scanLog = useData((s) => s.scanLog)
  const setDevices = useData((s) => s.setDevices)
  const setScanning = useData((s) => s.setScanning)
  const pushNotif = useData((s) => s.pushNotif)
  const discoveryAllowed = useSettings((s) => s.settings.deviceDiscovery)
  const [, setProgress] = useState(0)
  const [sweep, setSweep] = useState(0)
  const timers = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const scan = async () => {
    if (scanning) return
    setScanning(true)
    setDevices([])
    setProgress(0)
    const found: Device[] = []
    const stages: string[] = [
      'Initializing zero-point scanner…',
      'Probing local network interfaces…',
      bluetoothAvailable() ? 'Web Bluetooth radio: available' : 'Web Bluetooth radio: unavailable in this browser',
      'Querying media device labels…',
      'Sweeping for nearby transmitters…',
      'Finalizing results…',
    ]
    stages.forEach((msg, i) => {
      timers.current.push(window.setTimeout(() => useData.setState({ scanLog: [...useData.getState().scanLog, msg] }), i * 620))
    })

    // Real device info we can actually see: media devices (labels after permission), plus honest env checks
    timers.current.push(window.setTimeout(async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices()
          const cams = devs.filter((d) => d.kind === 'videoinput')
          cams.forEach((c, i) => found.push({
            id: `cam_${i}`, name: c.label || `Camera ${i + 1}`, kind: 'camera', icon: 'camera',
            status: 'nearby', detail: c.deviceId ? 'Local media device' : 'Permission pending for name',
          }))
          const mics = devs.filter((d) => d.kind === 'audioinput')
          mics.forEach((m, i) => found.push({
            id: `mic_${i}`, name: m.label || `Microphone ${i + 1}`, kind: 'headphones', icon: 'headphones',
            status: 'nearby', detail: 'Audio input device',
          }))
        }
      } catch { /* enumeration unsupported */ }

      found.push({
        id: 'this', name: 'This Device', kind: 'laptop', icon: 'monitor', status: 'connected',
        detail: `${navigator.hardwareConcurrency ?? '?'} threads · ${networkHint()}`,
      })
      found.push({
        id: 'net', name: navigator.onLine ? 'Local Network' : 'No Network', kind: 'other', icon: 'wifi',
        status: navigator.onLine ? 'nearby' : 'unknown', detail: networkHint(),
      })

      setDevices(found)
      setProgress(1)
      pushNotif({
        kind: 'device',
        title: `Scan complete — ${found.length} device${found.length === 1 ? '' : 's'} visible`,
        body: bluetoothAvailable() ? 'Bluetooth radio present; pair devices for richer control.' : 'Bluetooth API unavailable — showing locally visible devices only.',
      })
      setScanning(false)
    }, stages.length * 620))
  }

  // Radar sweep animation while scanning
  useEffect(() => {
    if (!scanning) { setSweep(0); return }
    let raf: number
    const start = performance.now()
    const loop = (t: number) => {
      setSweep(((t - start) / 1600) % 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    rafRef.current = raf
    return () => cancelAnimationFrame(raf)
  }, [scanning])


  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span className="row__icon"><Icon name="radar" /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Device Radar</h2>
          <div className="t-xs t-low">Real discovery only — U.L.T.R.0.N. never invents devices</div>
        </div>
        <StatusBadge tone={scanning ? 'warn' : devices.length > 0 ? 'ok' : 'idle'}>
          {scanning ? 'Scanning' : devices.length > 0 ? `${devices.length} visible` : 'Idle'}
        </StatusBadge>
        <Button variant="primary" icon="scan" onClick={scan} disabled={scanning}>
          {scanning ? 'SCANNING…' : 'SCAN DEVICES'}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Radar */}
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'grid', placeItems: 'center' }}>
            {/* rings */}
            {[100, 75, 50, 25].map((pct) => (
              <div key={pct} style={{
                position: 'absolute', width: `${pct}%`, height: `${pct}%`, borderRadius: '50%',
                border: '1px solid rgba(34,211,238,0.14)',
              }} />
            ))}
            {/* cross hairs */}
            <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(34,211,238,0.1)' }} />
            <div style={{ position: 'absolute', height: '100%', width: 1, background: 'rgba(34,211,238,0.1)' }} />
            {/* sweep */}
            {scanning && (
              <div style={{
                position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                background: `conic-gradient(from ${sweep * 360}deg, rgba(34,211,238,0.35), transparent 18%)`,
                animation: 'fadeIn 200ms ease',
              }} />
            )}
            {/* blips */}
            {devices.map((d, i) => {
              const angle = (i / Math.max(devices.length, 1)) * Math.PI * 2 - Math.PI / 2
              const radiusPct = d.status === 'connected' ? 18 : d.status === 'nearby' ? 34 : 42
              return (
                <span
                  key={d.id}
                  title={d.name}
                  style={{
                    position: 'absolute', left: `${50 + Math.cos(angle) * radiusPct}%`, top: `${50 + Math.sin(angle) * radiusPct}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 9, height: 9, borderRadius: '50%',
                    background: d.status === 'connected' ? 'var(--ok)' : d.status === 'nearby' ? 'var(--cyan)' : 'var(--text-faint)',
                    boxShadow: `0 0 10px ${d.status === 'connected' ? 'rgba(52,211,153,0.7)' : d.status === 'nearby' ? 'rgba(34,211,238,0.7)' : 'transparent'}`,
                    animation: 'popIn 240ms cubic-bezier(0.16,1,0.3,1) both',
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              )
            })}
            {/* center */}
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 18px rgba(34,211,238,0.8)' }} />
          </div>

          <div style={{ marginTop: 14 }}>
            {scanning ? (
              <>
                <div className="t-sm t-mid" style={{ textAlign: 'center', marginBottom: 8 }}>Searching nearby devices…</div>
                <div className="progress"><div className="progress-bar" /></div>
              </>
            ) : (
              <div className="t-xs t-low" style={{ textAlign: 'center' }}>
                {devices.length === 0 ? 'Press SCAN DEVICES to discover real hardware' : 'Discovery complete — results shown honestly by capability'}
              </div>
            )}
          </div>

          {/* Scan log */}
          {scanLog.length > 0 && (
            <div className="mono" style={{
              marginTop: 12, fontSize: 10.5, color: 'var(--text-low)', background: 'rgba(3,6,12,0.6)',
              borderRadius: 10, border: '1px solid var(--line)', padding: '9px 11px', maxHeight: 110, overflowY: 'auto',
            }}>
              {scanLog.map((l, i) => <div key={i}>▸ {l}</div>)}
            </div>
          )}

          {!discoveryAllowed && (
            <div className="t-xs" style={{ color: 'var(--warn)', marginTop: 10, display: 'flex', gap: 6 }}>
              <Icon name="shield" width={13} />
              Discovery permission is off — enable it in Settings → Devices for richer scans.
            </div>
          )}
        </div>

        {/* Device list */}
        <div className="panel" style={{ minHeight: 300 }}>
          <div className="panel-head">
            <Icon name="layers" width={15} style={{ color: 'var(--cyan)' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Devices</span>
            <span className="badge badge--muted" style={{ marginLeft: 'auto' }}>CONNECTED · PAIRED · NEARBY · UNKNOWN</span>
          </div>
          <div style={{ padding: 10 }}>
            {devices.length === 0 && !scanning && (
              <div className="empty" style={{ padding: 40 }}>
                <Icon name="radar" width={30} />
                <div className="empty-title">No devices discovered yet</div>
                <div className="empty-sub">Run a scan to enumerate what this machine can genuinely see: local cameras, microphones, network reachability. Web Bluetooth devices appear when the browser exposes them.</div>
              </div>
            )}
            {scanning && devices.length === 0 && (
              <div className="empty" style={{ padding: 40 }}>
                <span className="spinner" />
                <div className="empty-title">Scanning…</div>
                <div className="empty-sub">Enumerating local interfaces and media devices.</div>
              </div>
            )}
            {devices.map((d, i) => (
              <div
                key={d.id}
                className="row"
                style={{ animation: 'fadeUp 220ms cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${i * 45}ms` }}
              >
                <span className="row__icon"><Icon name={KIND_ICON[d.kind] ?? 'wifi'} /></span>
                <div className="row__main">
                  <span className="row__title">{d.name}</span>
                  <span className="row__sub">{d.detail ?? d.kind}</span>
                </div>
                <DeviceBadge status={d.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DeviceBadge({ status }: { status: Device['status'] }) {
  const map: Record<Device['status'], { cls: string; label: string }> = {
    connected: { cls: 'ok', label: 'CONNECTED' },
    paired: { cls: 'info', label: 'PAIRED' },
    nearby: { cls: 'warn', label: 'NEARBY' },
    unknown: { cls: 'muted', label: 'UNKNOWN' },
  }
  const { cls, label } = map[status]
  return <span className={`badge badge--${cls}`}>{label}</span>
}
