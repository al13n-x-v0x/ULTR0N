import { Icon } from '../Icon'

interface ToggleProps {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ on, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className="switch"
      data-on={on}
      onClick={() => onChange(!on)}
    />
  )
}

export function ToggleRow({ on, onChange, title, sub, icon, disabled }: {
  on: boolean
  onChange: (v: boolean) => void
  title: string
  sub?: string
  icon?: string
  disabled?: boolean
}) {
  return (
    <div className="row" style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      {icon && <span className="row__icon"><Icon name={icon as never} /></span>}
      <div className="row__main">
        <span className="row__title">{title}</span>
        {sub && <span className="row__sub">{sub}</span>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  )
}
