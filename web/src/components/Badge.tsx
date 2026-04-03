import { type ReactNode } from 'react'
import { font, tracking, palette } from './theme'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'soft' | 'outline'
}

export function Badge({ children, color = palette.teal, variant = 'soft' }: BadgeProps) {
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: color, color: palette.white, border: 'none' },
    soft: { background: `${color}20`, color, border: `1px solid ${color}30` },
    outline: { background: 'transparent', color, border: `1px solid ${color}50` },
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.7rem',
      borderRadius: 100,
      fontFamily: font.family,
      fontSize: '0.6rem',
      fontWeight: 600,
      letterSpacing: tracking.widest,
      textTransform: 'uppercase',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}
