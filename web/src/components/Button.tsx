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
  sm: { padding: '0.4rem 1.2rem', fontSize: '0.65rem', tracking: tracking.wider },
  md: { padding: '0.6rem 1.8rem', fontSize: '0.75rem', tracking: tracking.wider },
  lg: { padding: '0.8rem 2.4rem', fontSize: '0.85rem', tracking: tracking.widest },
}

export function Button({ children, onClick, color, variant = 'filled', size = 'md', disabled, fullWidth, style: extraStyle }: ButtonProps) {
  const s = sizes[size]
  const accent = color || palette.accent
  const fill = palette.fill

  const base: React.CSSProperties = {
    fontFamily: font.family,
    fontSize: s.fontSize,
    fontWeight: 700,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    padding: s.padding,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    position: 'relative',
    borderRadius: 8,
    ...extraStyle,
  }

  const variants: Record<string, React.CSSProperties> = {
    filled: {
      ...base,
      background: accent,
      color: palette.textOnAccent,
      border: `1px solid ${accent}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px ${accent}22`,
    },
    ghost: {
      ...base,
      background: palette.panelLight,
      color: palette.textPrimary,
      border: `1px solid ${palette.border}`,
    },
    outline: {
      ...base,
      background: fill,
      color: palette.textOnFill,
      border: `1px solid ${accent}55`,
    },
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={variants[variant]}
      onMouseEnter={e => {
        if (disabled) return
        e.currentTarget.style.filter = 'brightness(1.15)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = `0 4px 16px ${accent}30`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = ''
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {children}
    </button>
  )
}
