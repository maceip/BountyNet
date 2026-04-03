import { type ReactNode } from 'react'
import { font, tracking, palette } from './theme'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  color?: string
  variant?: 'filled' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  fullWidth?: boolean
  style?: React.CSSProperties
}

const sizes = {
  sm: { padding: '0.35rem 0.9rem', fontSize: '0.7rem', radius: 8, tracking: tracking.wider },
  md: { padding: '0.55rem 1.4rem', fontSize: '0.78rem', radius: 11, tracking: tracking.wider },
  lg: { padding: '0.75rem 2rem', fontSize: '0.85rem', radius: 14, tracking: tracking.widest },
}

export function Button({ children, onClick, color = palette.teal, variant = 'ghost', size = 'md', disabled, fullWidth, style: extraStyle }: ButtonProps) {
  const s = sizes[size]

  const base: React.CSSProperties = {
    fontFamily: font.family,
    fontSize: s.fontSize,
    fontWeight: 600,
    letterSpacing: s.tracking,
    textTransform: 'uppercase',
    padding: s.padding,
    borderRadius: s.radius,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    ...extraStyle,
  }

  const variants: Record<string, React.CSSProperties> = {
    filled: {
      ...base,
      background: color,
      color: palette.white,
      border: `1.5px solid ${color}`,
    },
    ghost: {
      ...base,
      background: `${color}15`,
      color: palette.ink,
      border: `1.5px solid ${color}35`,
    },
    outline: {
      ...base,
      background: 'transparent',
      color,
      border: `1.5px solid ${color}60`,
    },
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={variants[variant]}
      onMouseEnter={e => {
        if (disabled) return
        if (variant === 'ghost') {
          e.currentTarget.style.background = `${color}28`
          e.currentTarget.style.borderColor = `${color}70`
          e.currentTarget.style.transform = 'translateY(-1px)'
        } else if (variant === 'filled') {
          e.currentTarget.style.filter = 'brightness(1.1)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        } else {
          e.currentTarget.style.background = `${color}12`
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = variants[variant].background as string
        e.currentTarget.style.borderColor = variants[variant].border?.toString().split(' ').pop() || ''
        e.currentTarget.style.filter = ''
        e.currentTarget.style.transform = ''
      }}
    >
      {children}
    </button>
  )
}
