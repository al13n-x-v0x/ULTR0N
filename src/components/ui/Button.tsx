import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from '../Icon'
import { Tooltip } from './Tooltip'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'md' | 'sm'
  icon?: string
  children?: ReactNode
}

export function Button({ variant = 'default', size = 'md', icon, children, className, style, ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' ? `btn--${variant}` : '', size === 'sm' ? 'btn--sm' : '', className ?? '']
    .filter(Boolean).join(' ')
  return (
    <button className={cls} style={style} {...rest}>
      {icon && <Icon name={icon as never} width={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  )
}

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string
  title: string
  active?: boolean
  size?: number
}

export function IconButton({ icon, title, active, size = 16, className, style, ...rest }: IconBtnProps) {
  return (
    <Tooltip label={title}>
      <button
        className={`btn--icon ${className ?? ''}`}
        aria-label={title}
        data-active={active}
        style={{
          color: active ? 'var(--cyan)' : undefined,
          background: active ? 'var(--cyan-soft)' : undefined,
          ...style,
        }}
        {...rest}
      >
        <Icon name={icon as never} width={size} />
      </button>
    </Tooltip>
  )
}
