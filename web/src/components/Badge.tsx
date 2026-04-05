import { type ReactNode } from 'react'
import { font, tracking, palette } from './theme'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'soft' | 'outline'
}

export function Badge({ children, color, variant = 'soft' }: BadgeProps) {
  const c = color || palette.accent
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: c, color: palette.textOnAccent, border: 'none' },
    soft: { background: `${c}18`, color: c, border: `1px solid ${c}30` },
    outline: { background: 'transparent', color: c, border: `1px solid ${c}50` },
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.28rem 0.7rem',
      borderRadius: 999,
      fontFamily: font.family,
      fontSize: '0.56rem',
      fontWeight: 700,
      letterSpacing: tracking.wide,
      textTransform: 'uppercase',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}
