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

/**
 * Hexagonal-chamfered button matching the design.
 * Navy fill with orange hex endpoints in lite mode.
 */

const sizes = {
  sm: { padding: '0.4rem 1.2rem', fontSize: '0.65rem', tracking: tracking.wider },
  md: { padding: '0.6rem 1.8rem', fontSize: '0.75rem', tracking: tracking.wider },
  lg: { padding: '0.8rem 2.4rem', fontSize: '0.85rem', tracking: tracking.widest },
}

const chamfer = 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)'

export function Button({ children, onClick, color, variant = 'filled', size = 'md', disabled, fullWidth, style: extraStyle }: ButtonProps) {
  const s = sizes[size]
  const accent = color || palette.accent
  const fill = palette.fill

  const base: React.CSSProperties = {
    fontFamily: font.family,
    fontSize: s.fontSize,
    fontWeight: 700,
    letterSpacing: s.tracking,
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
    ...extraStyle,
  }

  const variants: Record<string, React.CSSProperties> = {
    filled: {
      ...base,
      background: fill,
      color: palette.textOnFill,
      border: `2px solid ${accent}`,
      clipPath: chamfer,
    },
    ghost: {
      ...base,
      background: `${accent}15`,
      color: palette.textPrimary,
      border: `1.5px solid ${accent}40`,
      clipPath: chamfer,
    },
    outline: {
      ...base,
      background: 'transparent',
      color: accent,
      border: `1.5px solid ${accent}60`,
      borderRadius: 4,
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
