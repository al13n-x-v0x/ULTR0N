import { Icon } from '../Icon'

export type DotTone = 'ok' | 'warn' | 'err' | 'idle'

export function StatusDot({ tone, pulse }: { tone: DotTone; pulse?: boolean }) {
  return <span className={`dot dot--${tone} ${pulse ? 'dot--pulse' : ''}`} />
}

export function StatusBadge({ tone, children }: { tone: DotTone; children: string }) {
  const cls = tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : tone === 'err' ? 'err' : 'muted'
  return (
    <span className={`badge badge--${cls}`}>
      <StatusDot tone={tone} pulse={tone === 'ok'} />
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon as never} width={34} />
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action}
    </div>
  )
}
