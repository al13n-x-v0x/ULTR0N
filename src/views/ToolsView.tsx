import { useEffect, useRef } from 'react'
import { useData } from '../store/dataStore'
import { Icon } from '../components/Icon'
import { Meter } from '../components/ui/Meter'
import { Ring } from '../components/ui/Meter'
import { StatusBadge } from '../components/ui/StatusDot'

export function ToolsView() {
  const metrics = useData((s) => s.metrics)

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="view-head">
        <span className="row__icon"><Icon name="activity" /></span>
        <div style={{ flex: 1 }}>
          <h2>System Monitor</h2>
          <div className="t-xs t-low">Live telemetry, refreshed smoothly every 1.6s</div>
        </div>
        <StatusBadge tone={metrics.cpu > 85 ? 'warn' : 'ok'}>{metrics.cpu > 85 ? 'HIGH LOAD' : 'NOMINAL'}</StatusBadge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div className="panel" style={{ padding: 18 }}>
          <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 12 }}>Primary Systems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <Meter label="CPU load" value={metrics.cpu} />
            <Meter label="Memory (RAM)" value={metrics.ram} />
            <Meter label="GPU" value={metrics.gpu} />
            <Meter label="Storage" value={metrics.disk} />
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 12 }}>Environment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <Meter label="Temperature" value={metrics.temp} unit="°C" />
            <Meter label="Network activity" value={metrics.net} />
            <div className="row" style={{ padding: '2px 0' }}>
              <span className="t-sm t-mid" style={{ flex: 1 }}>Uptime</span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-hi)' }}>{metrics.uptime}</span>
            </div>
            <div className="row" style={{ padding: '2px 0' }}>
              <span className="t-sm t-mid" style={{ flex: 1 }}>Battery</span>
              <span className="t-sm" style={{ color: 'var(--text-low)' }}>via Device API when granted</span>
            </div>
            <div className="row" style={{ padding: '2px 0' }}>
              <span className="t-sm t-mid" style={{ flex: 1 }}>Network state</span>
              <StatusBadge tone={navigator.onLine ? 'ok' : 'err'}>{navigator.onLine ? 'ONLINE' : 'OFFLINE'}</StatusBadge>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 12 }}>CPU Threads</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {metrics.cores.map((c) => (
              <Ring key={c.name} value={c.load} size={52} stroke={4} sub={c.name} />
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 12 }}>CPU History</div>
          <Sparkline data={metrics.history} width={320} height={72} />
          <div className="t-xs t-low" style={{ marginTop: 8 }}>
            Rolling window of CPU load — rendered as a static SVG that updates per tick (no per-frame canvas).
          </div>
        </div>
      </div>
    </div>
  )
}

function Sparkline({ data, width, height }: { data: number[]; width: number; height: number }) {
  const ref = useRef<SVGSVGElement | null>(null)
  useEffect(() => { ref.current?.setAttribute('data-len', String(data.length)) }, [data.length])
  const max = Math.max(...data, 40)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ')
  return (
    <svg ref={ref} className="spark" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(34,211,238,0.35)" />
          <stop offset="1" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill="url(#sparkFill)" />
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth={1.6} />
    </svg>
  )
}
